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

===================================*/ 

// Global variables persistent as the script runs
var previousTab = null;
var activeTabId = 0;
chrome.tabs.query({'active': true}, function(tabs){
        previousTab = tabs[0];
    });

var onmiquery = false;

/*===  Utitily functions === */

/* Simply log everything. 
// Extract tab info that we want to store
function extract_tabInfo(tab){
    // tab may not be ready yet, wait for a while
    var timeout = 5000
    var start = (new Date()).getTime()
    while (tab.status != 'complete'){
        if ((new Date()).getTime()-start > timeout)
            break
    };
    return  {'tabId': tab.id, 
        'windowId': tab.windowId, 
        'title': tab.title,
        'url': tab.url,  
        'status': tab.status
        }
}
*/

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
    if ('status' in changeInfo && changeInfo.status == 'complete')
        e = 'tab-loaded';
    if ('url' in changeInfo){
        e = 'tab-changeURL';
    }
   
    if (e == 'tab-loaded' || e == 'tab-changeURL'){ 
        var log = {'event': e, 'timestamp': ts,
            'current_tab': tab,
            'previous_tab': previousTab,
            }
        // set the tab tracker to the current tab
        previousTag = tab;
        console.log(log)
    }
});

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


