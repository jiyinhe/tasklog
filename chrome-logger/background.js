/* ================================
This script records user activities in the background
For following activities are recorded:
1. Tab related:
 - open a new tab
 - close a tab
 - switch to a different tab (may also be triggered by open, close, replace)
 - tab being replaced (e.g., type in search going to SERP)
 - tab url change 
 - tab status change

2. User navigation/requests
 - transitions between different urls 
 - handle formsubmit, link click messages from content.js

3. Search engine related (for a specific list of SEs)
  This is coupled with tab-changeUrl event, mainly
  because when the navigation action happens (e.g., through
    "generated", the search url is not set yet)
 - google
 - bing 
 - yahoo
===================================*/ 
// TODO: find a way to set user_id
var user_id = "tester";
var device = "chrome";
// TODO: set the url of the server
var data_storage_url = 'http://localhost:3000/savedata'


// Global variables persistent as the script runs
var previousTab = {};
var activeTabId = 0;
var previousEvent = {};

//Set current active tab for traceback
chrome.tabs.query({'active': true}, function(tabs){
        previousTab = tabs[0];
    });

//function for send post request to store data
function savedata(logdata){
    logdata['user_id'] = user_id;
    logdata['device'] = device;
    console.log(logdata);
//    console.log(previousTab);
    $.ajax({
        type: "POST",
        url: data_storage_url,
        data: logdata,
        success: function(msg){
            if (msg != "success")
                console.log(msg);
        }
    });
}

// When a new tab is open, record.
// It can happen when:
// - open an empty new tab, and swtich to that tab (tab-new)
// - open a link in a new tab, doesn't change to that tab (tab-open-in-new)
// Details:
// - previous_tab: the activated tab before creating a new tab
// - current_tab: the current active tab after creating a new tab
// - new_tab: the created tab
// Note: it can also trigger subsequent events, including:
// onActivated, onUpdated, -- handle those in corresponding functions
chrome.tabs.onCreated.addListener(function(tab) {
    // Event name
    var e = ''
    var details = {}
    var ts = (new Date()).getTime();
    if (tab.url == "chrome://newtab/"){
        e = 'tab-new';
        details = {'previous_tab': previousTab, 
            'current_tab': tab,
            'new_tab': tab,
        };
        previousTab = tab;
    }
    // open a new tab, but stay in the current tab
    else{
        e = 'tab-open-in-new';
        details = {
            'previous_tab': previousTab,
            'current_tab': previousTab,
            'new_tab': tab,
        };
    }
    log = {'event': e, 'timestamp': ts, 
            'affected_tab_id': tab.id,
            'details': details, 
            //'search': false
            };
    previousEvent = log;
    savedata(log);
});

// When a tab is closed, record:
//Note:
// url can be derived from previously stored data
// we would know when chrome has been restarted:
// the tab id would be lower than existing ids
chrome.tabs.onRemoved.addListener(function(tabId){
    var e = 'tab-close';
    var ts = (new Date()).getTime();
    var details = {}
    log = {'event': e, 'timestamp': ts, 
        'affected_tab_id': tabId,
        'details': details, 
        //'search': false
        };
    // PreviousTab has 2 possibilities:
    // - close a tab that is not active, previousTab remain the same
    // - close a tab that is active, addressed by tab-close-switch
    previousEvent = log; 
    savedata(log);
});


// The currently activtated tab  
// It can be triggered by the following situations:
//  1. open a new tab
//  2. click on a tab different from the current active one
//  3. close a tab 
//  4. replace a tab (e.g., when type in omnibox, switch to SERP)
chrome.tabs.onActivated.addListener(function(tab){
    console.log(previousEvent['event']);
    var e = 'tab-switch';
    var ts = (new Date()).getTime();
    var current_tab = null;
    var previous_tab = previousTab;
    //check if it is triggered by open new tab, close tab, or replace
    if (previousEvent['event'] == 'tab-new'){
        e = 'tab-new-switch';
    }
    else if (previousEvent['event'] == 'tab-close'){
        e = 'tab-close-switch';
    }
    else if (previousEvent['event'] == 'tab-replaced'){
        e = 'tab-replace-switch';
    }
    //tab only contains tabId and windowId, need to get the tab
    chrome.tabs.get(tab.tabId, function(thistab){
        current_tab = thistab;
        details = {'previous_tab': previous_tab, 
                    'current_tab': current_tab}
        log = {'event': e, 'timestamp': ts, 
            'affected_tab_id': current_tab.id,
            'details': details, 
            //'search': false,
            };
        // set the current tab to previous tab, preparing for next move
        previousTab = current_tab;
        previousEvent = log;
        savedata(log);
    });
});

// When a tab is replaced by another, it will trigger activated as well, 
// better to first insert the "replace"
// It may happen when type in a url in address bar
// Here we only record the addedTabId and replacedTabId
// the details of the tabs will be handeled in tab-replace-switch
// also the previousTab will be pick up by tab-replace-switch
chrome.tabs.onReplaced.addListener(function(addedTabId, replacedTabId){
    var e = 'tab-replaced';
    var ts = (new Date()).getTime();
    var details = {'addedTabId': addedTabId, 
                   'replacedTabId': replacedTabId,
                    };
    var log = {'event': e, 'timestamp': ts, 
                'affected_tab_id': replacedTabId,
                'details': details, 
                //'search': false
                };
    previousEvent = log;
    savedata(log);
});


// When a tab has changed its url/status, log the event
// We focus on these situations:
// - url change
// - status switch to complete 
// URL change can be triggered by the following situations:
// 1. open a new tab (ignore, tab-new is sufficient)
// 2. user type in url
// 3. user search
// 4. user click a link
// 5. user submit a form
// WebNavigation captures 2, 4, 5.
// We only record when it's a search on one of the search engines.
//
// For the following cases we also ignore tab complete loading:
// - open a new tab (tab-new is sufficient) 
// A completely loaded tab can provides info such as title
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    var ts = (new Date()).getTime();
    var e = ''
    var search_check = {'search': false}
    // status change to complete
    if ('status' in changeInfo && changeInfo.status == 'complete'){
        // if its a tab-new completed loading, ignore
        if (tab.url == 'chrome://newtab/')
            e = 'tab-new-loaded';
        else
            e = 'tab-loaded';
    }
    // url change
    if ('url' in changeInfo){
        // if url change because of open new tab, ignore
        if (changeInfo.url == 'chrome://newtab/')
            e = 'tab-new-changeURL';
        else{
            e = 'tab-changeURL';
            // Check if this is a search on a search engine
            search_check = check_searchEngine(tab.url);
            if (search_check['search'] == true)
                e = 'tab-search';
        }
    }
    details = {'current_tab': tab,
                'previous_tab': previousTab}

    //only record events that are not ignored
    if (e == 'tab-loaded' || e == 'tab-search'){ 
        if (e == 'tab-search'){
                details['query'] = search_check['query'];
                details['engine'] = search_check['se'];
        }

        var log = {'event': e, 'timestamp': ts,
            'affected_tab': tab.id,
            'details': details
            }
        // set the tab tracker to the current tab
        previousTag = tab;
        previousEvent = log;
        savedata(log)
    }
});

// Handle different search engines
function check_searchEngine(url){
    //look for search engine query urls
    var google_reg = /.+?\.google\..+?q=.+/;
    var yahoo_reg = /.+?\.search\.yahoo\..+?p=.+/
    var bing_reg = /.+?\.bing\..+?q=.+/ 
    var query = ''
    var se = ''
    var search = false
    if (google_reg.test(url)){
        query = url.split('q=')[1].split('&')[0];
        se = 'google'
        search = true
    }
    else if (yahoo_reg.test(url)){
        query = url.split('p=')[1].split('&')[0];
        se = 'yahoo'
        search = true
    }
    else if (bing_reg.test(url)){
        query = url.split('q=')[1].split('&')[0];
        se = 'bing'
        search = true
    }
    return {'se': se, 'query': query, 'search': search}
}

/* ======== user navigation requests ========*/
chrome.webNavigation.onCommitted.addListener(function(details){
    // filter out the auto generated ones 
    if (details.transitionType.indexOf('auto') == -1){
        var e = "navigation"
        var ts = (new Date()).getTime();
        var inputtype = '';
        // In omnibox:
        // if transitionType is "generated", user typed in keywords
        // pattern: tab-changeURL -> omni_query -> tab-loaded
        if (details.transitionType == 'generated'){
            //This should show up as input from a form in the search engine page
            //Get it from the content
            inputtype = ['omni_query'];
            if (details.transitionQualifiers.indexOf('forward_back')>-1)
                inputtype.push('forward_back');
        }
        // if transitionType is "typed", user typed in url
        // two situations:
        // - omni_url -> tab_replaced->tab-replace-switch (id update)
        // - url_change -> omni_url -> tab-loaded (id doesn't change)
        // in both case, the track of tabs are handeled somewhere else
        else if (details.transitionType == 'typed'){
            inputtype = ['omni_url'];
            if (details.transitionQualifiers.indexOf('forward_back')>-1)
                inputtype.push('forward_back');
        }
        else if (details.transitionType == 'form_submit'){
            // Get it from the content *before* submitting the 
            // form
            inputtype = ['form_submit']
        }
        // pattern:
        // link-click (not if it's a back/forward) -> tab_changeUrl
        // -> navigation-link -> tab_loaded
        else if (details.transitionType == 'link'){
            // From this url we can find the title of the page
            // after it's loaded
            inputtype = ['link']
            if (details.transitionQualifiers.indexOf('forward_back')>-1)
                inputtype.push('forward_back');
        }
        else
            inputtype = [details.transitionType]

        e = e + '-' + inputtype.join('-');
        log = {'event': e, 'timestamp': ts, 
            'affected_tab_id': details.tabId,
            'details': details};
        previousEvent = log; 
        savedata(log)
    }
});

chrome.extension.onMessage.addListener(function(request, sender, callback){
    if (request.name == 'form_submit'){
        log = {'event': 'form_submit',
               'timestamp': request.timestamp,
               'affacted_tab_id': sender.tab.id,
               'details': {
               'form_data': request.data,
               'senderId': sender.id,
               'senderTab': sender.tab,
                }
        }
    }
    else if (request.name == 'link_click'){
        log = {'event': 'link_click', 
                'timestamp': request.timestamp,
                'affected_tab_id': sender.tab.id,
                'details': {
                'link_data': request.data,
                'senderId': sender.id,
                'senderTab': sender.tab,
                }
        }
    }
    previousEvent = log;
    savedata(log)
});


