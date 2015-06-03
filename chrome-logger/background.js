/* ================================
This script records user activities in the background
For following activities are recorded:
1. Tab related:
 - open a new tab
 - close a tab
 - switch to a different tab (may also trigger open, close)

2. Onmibox related
 - start input
 - change input
 - accept input
 - cancel input 

3. Record tab change -> check if this is necessary
   this should be a result of onmibox user activity
   or user click on links in a page
 - status change
 - url change
===================================*/ 

// Global variables persistent as the script runs
var previousTab = null;
chrome.tabs.query({'active': true}, function(tabs){
        previousTab = extract_tabInfo(tabs[0]);
    });



/*===  Utitily functions === */

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


// When a new tab is open, record:
// - timestamp
// - the url of the tab (if it's a "open in new tab")
// - tabid (non essential)
chrome.tabs.onCreated.addListener(function(tab) {
    console.log(previousTab);
    // Event name
    var e = 'tab-new';
    //timestamp
    var ts = (new Date()).getTime();
    var new_tab = extract_tabInfo(tab)
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


// When switching between tabs, record:
//  - timestamp
//  - active tab
//  - previous tab
// These situation would triger "switch":
//  1. open a new tab
//  2. click on a tab different from the current active one
//  3. close a tab 
chrome.tabs.onActivated.addListener(function(tab){
//    console.log(previousTab);
    var e = 'tab-switch';
    var ts = (new Date()).getTime();
    var current_tab = null;
    var previous_tab = previousTab;
    chrome.tabs.get(tab.tabId, function(thistab){
        current_tab = extract_tabInfo(thistab);
        // set the current tab to previous tab, preparing for next move
        previousTab = current_tab;

        log = {'event': e, 'timestamp': ts, 
            'current_tab': current_tab, 
            'previous_tab': previous_tab,
            }
        console.log(log);
    });
});


/* ==== Omnibox related ==== */

// When user start to input in omnibox, record
// - timestamp
chrome.omnibox.onInputStarted.addListener(function(){
    var e = 'omnibox-startInput'
    var ts = (new Date()).getTime();
    log = {'event': e, 'timestamp': ts}
    console.log(log)
}); 



