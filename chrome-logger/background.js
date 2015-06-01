/* This script records user activities in the background
For following activities are recorded:
1. Tab related:
 - open a new tab: timestamp, opened_url
 - close a tab: tab url, timestamp
 - switch to an existing tab: source url, current url, timestamp

2. Search/browsing related
 - type in omnibox: typed in content, type (url/keywords), page_info, timestamp
 - click on a page: tab url, link url, timestamp 
 - mouse movements sample 
*/ 


// When a new tab is open, record:
// - timestamp
// - the url of the tab (if it's a "open in new tab")
// - tabid (non essential)
chrome.tabs.onCreated.addListener(function(tab) {
    // Event name
    var e = 'new-tab';
    //timestamp
    var ts = (new Date()).getTime();
    var tab_id = tab.id;
    var tab_url = tab.url;
    log = {'event': e, 'tab_id': tab_id, 'tab_url': tab.url, 'timestamp': ts};
    console.log(log);
});

// When a tab is closed, record:
// - timestamp
// - tabid (non essential)
//Note:
// url can be derived from previously stored data
// we would know when chrome has been restarted:
// the tab id would be lower than existing ids
chrome.tabs.onRemoved.addListener(function(tabId){
    var e = 'close-tab';
    var ts = (new Date()).getTime();
    log = {'event': e, 'tab_id': tabId, 'timestamp': ts};
    console.log(log);

});


// When switching between tabs


