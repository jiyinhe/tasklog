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

// Global variables persistent as the script runs
var previousTab = null;
var activeTabId = 0;
var data_storage_url = 'http://localhost:3000/savedata'

//Set current active tab for traceback
chrome.tabs.query({'active': true}, function(tabs){
        previousTab = tabs[0];
    });

//function for send post request to store data
function savedata(logdata){
    console.log('save data now')
    $.ajax({
        type: "POST",
        url: data_storage_url,
        data: logdata,
        success: function(msg){
            console.log(msg);
        }
    });
}

// When a new tab is open, record:
// - timestamp
// - the url of the tab (if it's a "open in new tab")
// - tabid (non essential)
chrome.tabs.onCreated.addListener(function(tab) {
    // Event name
    var e = 'tab-new';
    //timestamp
    var ts = (new Date()).getTime();
    var new_tab = tab
    log = {'event': e, 'timestamp': ts, 'new_tab': new_tab};
    console.log(log);
    savedata(log);
});

// When a tab is closed, record:
// - timestamp
// - closed_tabId
//Note:
// url can be derived from previously stored data
// we would know when chrome has been restarted:
// the tab id would be lower than existing ids
chrome.tabs.onRemoved.addListener(function(tabId){
    var e = 'tab-close';
    var ts = (new Date()).getTime();
    var closedTab = previousTab;
    log = {'event': e, 'timestamp': ts, 
        'closed_tabId': tabId};
    console.log(log);
});


// The currently activtated tab  
//  - timestamp
//  - active tab
//  - previous tab
// It can be triggered by the following stiuations:
//  1. open a new tab
//  2. click on a tab different from the current active one
//  3. close a tab 
//  4. replace a tab (e.g., when type in omnibox, switch to SERP)
chrome.tabs.onActivated.addListener(function(tab){
//    console.log(previousTab);
    activeTabId = tab.tabId;
    var e = 'tab-on';
    var ts = (new Date()).getTime();
    var current_tab = null;
    var previous_tab = previousTab;
    chrome.tabs.get(tab.tabId, function(thistab){
        current_tab = thistab;
        // set the current tab to previous tab, preparing for next move
        previousTab = current_tab;

        log = {'event': e, 'timestamp': ts, 
            'current_tab': current_tab, 
            'previous_tab': previous_tab,
            }
        console.log(log);
    });
});

// When a tab is replaced by another, it will trigger activated as well, 
// better to first insert the "replace"
chrome.tabs.onReplaced.addListener(function(addedTabId, replacedTabId){
    var e = 'tab-replaced';
    var ts = (new Date()).getTime();
    // We don't need to get more info, as it will also trigger
    // tabs.onActivated, which will then record the info of 
    // the current and replaced tab.
    log = {'event': e, 'timestamp': ts, 
            'addedTabId': addedTabId, 
            'replacedTabId': replacedTabId};
    console.log(log);
});


// When a tab has changed its url/status, log the event
// but it may not be anything that a user has done
// we log:
//  - url change 
//  - a page loaded (status change from loading to complete)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    var ts = (new Date()).getTime();
    var e = ''
    var search = {'search': false}
    if ('status' in changeInfo && changeInfo.status == 'complete')
        e = 'tab-loaded';
    if ('url' in changeInfo){
        e = 'tab-changeURL';
        search = check_searchEngine(tab.url);
    }
   
    if (e == 'tab-loaded' || e == 'tab-changeURL'){ 
        var log = {'event': e, 'timestamp': ts,
            'current_tab': tab,
            'previous_tab': previousTab,
            }
        if (e == 'tab-changeURL')
            log['search'] = search
        // set the tab tracker to the current tab
        previousTag = tab;
        console.log(log)
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
    if (google_reg.test(url)){
        query = url.split('q=')[1].split('&')[0];
        se = 'google'
    }
    else if (yahoo_reg.test(url)){
        query = url.split('p=')[1].split('&')[0];
        se = 'yahoo'
    }
    else if (bing_reg.test(url)){
        query = url.split('q=')[1].split('&')[0];
        se = 'bing'
    }
    return {'se': se, 'query': query, 'search': true}
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
        if (details.transitionType == 'generated'){
            //This should show up as input from a form in the search engine page
            //Get it from the content
            inputtype = ['omni_query'];
            if (details.transitionQualifiers.indexOf('forward_back')>-1)
                inputtype.push('forward_back');
        }
        // if transitionType is "typed", user typed in url
        else if (details.transitionType == 'typed'){
            inputtype = ['omni_url'];
            if (details.transitionQualifiers.indexOf('forward_back')>-1)
                inputtype.push(forward_back);
        }
        else if (details.transitionType == 'form_submit'){
            // Get it from the content *before* submitting the 
            // form
            inputtype = ['form_submit']
        }
        else if (details.transitionType == 'link'){
            // From this url we can find the title of the page
            // after it's loaded
            inputtype = ['link']
        }
        else
            inputtype = [details.transitionType]

        log = {'event': e, 'timestamp': ts, 
            'inputtype': inputtype,
            'details': details}
        console.log(log)
    }
});

chrome.extension.onMessage.addListener(function(request, sender, callback){
    console.log(request)
    if (request.name == 'form_submit'){
        log = {'event': 'form_submit',
               'timestamp': request.timestamp,
               'form_data': request.data,
               'senderId': sender.id,
               'senderTab': sender.tab
        }
    }
    else if (request.name == 'link_click'){
        console.log(request);
        log = {'event': 'link_click', 
                'timestamp': request.timestamp,
                'link_data': request.data,
                'senderId': sender.id,
                'senderTab': sender.tab
        }
    }
    console.log(log)
});


