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
var device = "chrome";
// TODO: set the url of the server
//var domain = 'http://localhost:3000';
var domain = 'http://tasklog.cs.ucl.ac.uk';
var data_storage_url = domain + '/savedata';
var serp_storage_url = domain + '/saveserp';
var check_userid_url = domain + '/users/checkid';

/* Functions communicating with Popup */

// TODO: For testing purpose, this allows reset of userid
// when reloading the extension 
// chrome.storage.sync.remove('userid');

// check userid when starting
var user_id = '';
//when starting try to get userid
get_user_id();

function get_user_id(){
    chrome.storage.sync.get('userid', function(item){
        if (item["userid"] === undefined){
            //Userid not set, show a notification
            chrome.notifications.create(
                "userid",
                {
                    "type": "basic",
                    "iconUrl": "icons/icon_38.png",
                    "title": "WARNING: UserID is not set",
                    "message": "Please set your unique userID for chrome logger",
                    "priority": 2,
                });
            //Also put a sign on the popup
            chrome.browserAction.setBadgeText({"text": "!"}) 
        }
        else
            user_id = item['userid'];
    });
}

//check user id called from popup
var check_userid = function(){
//    var user_id = '0QDWIJ';
    return user_id;
}

//set userid that is input from popup
var set_userid = function(userid, callback){
    //check if the userid exists in db
    $.ajax({
        type: "POST",
        url: check_userid_url,
        data: {"userid": userid},
        success: function(response){
            if (response.err){
                //notify the user with a notification
                chrome.notifications.clear('userid');
                chrome.notifications.create(
                    "userid",
                    {
                        "type": "basic",
                        "iconUrl": "icons/icon_38.png",
                        "title": "ERROR: UserID does not exist.",
                        "message": "Please try again, or retrieve your UserID following the link below",
                        "priority": 2,
                    });
                // Clear the badge
                chrome.browserAction.setBadgeText({"text": ""});
            }
            else {
                chrome.storage.sync.set({'userid': response.user.userid});
                
                user_id = response.user.userid;
                // Send notification
                chrome.notifications.clear('userid');
                chrome.notifications.create(
                    "userid_set",
                    {
                        "type": "basic",
                        "iconUrl": "icons/icon_38.png",
                        "title": "THANKS: UserId successfully set.",
                        "message": "Your UserId has been set for chrome logger",
                        "priority": 2,
                    });
                // Clear the badge
                chrome.browserAction.setBadgeText({"text": ""});
            }
            if (typeof callback == 'function'){
                callback.call(this, response);
            }
        }
    });
}

var blacklist = [];
var blacklist_as_input = '';
get_blacklist();

//process  blacklist
var set_blacklist = function(content, callback){
    blacklist_as_input = content;
    var urls = content.split('\n');
    //list to match
    blacklist = [];
    for(var i = 0; i<urls.length; i++){
        //remove http:// or https://
        var tmp = urls[i].replace('https://', '').replace('http://', '');
        if (tmp == '')
            continue
        //match all urls following a prefix 
        if(tmp.split('*').length > 1){
            blacklist.push({'prefix': true, 'str':tmp.split('*')[0]});
        }
        //exact match
        else{
            blacklist.push({'prefix': false, 'str': tmp});
        }
    }
    //Save it in local storage
    //The parse list
    //and the raw input
    chrome.storage.sync.set({'blacklist': blacklist, 
            'blacklist_as_input': blacklist_as_input,
        });

    if (typeof callback == 'function'){
          callback.call(this, blacklist_as_input);
    }
}

//Get the blacklist from storage
function get_blacklist(){
    blacklist == [];
    blacklist_as_input = '';
    chrome.storage.sync.get('blacklist', function(item){
        if (item["blacklist"] === undefined){
            blacklist = [];
        }
        else{
            blacklist = item['blacklist'];
            
        }
    });
    chrome.storage.sync.get('blacklist_as_input', function(item){
        if (item["blacklist_as_input"] === undefined){
            blacklist_as_input = '';
        }
        else{
            blacklist_as_input = item['blacklist_as_input'];
            
        }
    });
}

//communicating with popup
var check_blacklist = function(){
    return blacklist_as_input;
}

/* Functions for logging */

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
    console.log(logdata)
    //First check if the url is in the blacklist
    //console.log(blacklist)
    //console.log(logdata.url)
    var to_log = true;
    for(var i = 0; i<blacklist.length; i++){
        //Strip out https:// or http:// part
        var tmp_url = logdata.url.replace('https://', '').replace('http://', '');
        if (blacklist[i].prefix){
            if (tmp_url.substring(0, blacklist[i].str.length) == blacklist[i].str){
                to_log = false;
                break;
            }
        }
        else{
            //exact match
            if (tmp_url == blacklist[i].str){
                to_log = false;
                break;
            }
        }
    }
    //console.log(to_log)
    if (!to_log)
        return false

    //console.log(logdata.event)
    logdata['userid'] = user_id;
    logdata['device'] = device;
    logdata['annotation'] = {};
    logdata['to_annotate'] = false; 
    logdata['removed'] = false;
    //Create toy data for testing
    //logdata['timestamp'] = logdata['timestamp'] - 60*1000*60*24

    // We only ask for a few events to be annotated
    // use tab-loaded for the pages users browsed
    // use tab-search for Web search users performed with google, bing, yahoo. 
    if (logdata['event'] == 'tab-search'){
        //Sometimes SE directly brings to a page without a query
        if (! logdata['details'].query == ''){
            logdata['to_annotate'] = true;
        }
    }
    else if (logdata['event'] == 'tab-loaded' && 
        //filter out certain doamins
        !(logdata.url.substring(0, 6) === 'chrome' || 
        logdata.url.substring(0, 16) === 'http://localhost' || 
        logdata.url.substring(0, 21) === 'http://tasklog.cs.ucl') 
    )
    {
       logdata['to_annotate'] = true;
    } 
    //If tab keeps loading the same url, then don't repaetedly annotate it
    //This usually happens in case such as editing google doc
    //Or people follow in-page links
    //It doesn't help though if people browse in-page links 
    //in between other activities
    if (logdata.event == 'tab-loaded' && logdata.details.note != undefined
        && logdata.details.note == 'load-same'){
        logdata.to_annotate = false;
    }

    //If a SERP loaded, send message to content.js
    if (logdata['event'] == 'tab-loaded'){
        var se =  check_searchEngine(logdata['url']);
        //console.log(se)
        if(se.search){
            //If it's a serp, then it doesn't need to be annotated
            //as the query will be annotated
            logdata.to_annotate = false;

            var tabid = logdata.affected_tab_id;
            chrome.tabs.sendMessage(tabid, {msg: 'serp loaded', 'se': se.se, 
                'start': se.start_count, 'media': se.media},
                function(response) {
                    //console.log(response)   
                    //var serp = pako.inflate(response.serp, {'to': 'string'})
                    //var serp = response.serp
                    //var newwindow = window.open();
                    //newwindow.document.write('<html>' + pako.inflate(serp, {'to': 'string'}) + '</html>')
                    //save serp
                    //console.log(response)
                    if (response!=undefined){
                        var serpdata = {
                            'serp': response.serp,
                            'url': logdata.url,
                            'timestamp': logdata.timestamp,
                            'userid': logdata.userid,
                            'engine': se.se,
                            'start': se.start_count,
                            'media': se.media
                        }
                        save_serp(serpdata);
                    }
                });  
        }
    }

    //check if storage is empty
    chrome.storage.sync.get('logdata', function(item){
        var stored_log = []
        if (item['logdata'] === undefined){
            //nothing in storage
            stored_log = [logdata];
        }
        else{
            //something already in storage
            stored_log = item['logdata'];
            stored_log.push(logdata);
            // check if the delay of storing in DB is due to userid issue
            for (var i = 0; i < stored_log.length; i++){
                if ((user_id != '') && (stored_log[i]['userid'] == ''))
                    stored_log[i]['userid'] = user_id;
            }
        }
        //if userid is not set, send notification
        if (user_id == ''){
            //store it in storage
            chrome.storage.sync.set({'logdata': stored_log})

            chrome.notifications.create(
                "userid",
                {
                    "type": "basic",
                    "iconUrl": "icons/icon_38.png",
                    "title": "WARNING: UserID is not set",
                    "message": "Please set your unique userID for chrome logger",
                    "priority": 2,
                });
        }
        else{
            //otherwise try to store it in db
            $.ajax({
                type: "POST",
                url: data_storage_url,
                data: {"data": JSON.stringify(stored_log)},
//                dataType: "json",
                success: function(response){
                    if (response.err){
                        //error occured, log stay in storage
                        chrome.storage.sync.set({'logdata': stored_log})
                        console.log(response.emsg);
                    }
                    else{
                        //success, clear storage for logdata
                        chrome.storage.sync.remove('logdata');
                    }
                }
            });
        }
    });
}

//Save SERP content
function save_serp(serpdata){
//    console.log('about to save serp')
    //check if storage is empty
    chrome.storage.sync.get('serpdata', function(item){
        var stored_log = []
        if (item['serpdata'] === undefined){
            //nothing in storage
            stored_log = [serpdata];
        }
        else{
            //something already in storage
            stored_log = item['serpdata'];
            stored_log.push(serpdata);
            // check if the delay of storing in DB is due to userid issue
            for (var i = 0; i < stored_log.length; i++){
                if ((user_id != '') && (stored_log[i]['userid'] == ''))
                    stored_log[i]['userid'] = user_id;
            }
        }
        //if userid is not set, send notification
        //console.log(stored_log);
        if (user_id == ''){
            console.log('user id not set')
            //store it in storage
            chrome.storage.sync.set({'serpdata': stored_log})

            chrome.notifications.create(
                "userid",
                {
                    "type": "basic",
                    "iconUrl": "icons/icon_38.png",
                    "title": "WARNING: UserID is not set",
                    "message": "Please set your unique userID for chrome logger",
                    "priority": 2,
                });
        }
        else{
 //           console.log('save serp')
            //otherwise try to store it in db
            $.ajax({
                type: "POST",
                url: serp_storage_url,
                data: {"data": JSON.stringify(stored_log)},
                //dataType: "json",
                success: function(response){
//                    console.log(response)
                    if (response.err){
                        //error occured, log stay in storage
                        chrome.storage.sync.set({'serpdata': stored_log})
                        console.log(response.emsg);
                    }
                    else{
                        //success, clear storage for logdata
                        chrome.storage.sync.remove('serpdata');
                    }
                }
            });
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
            'url': tab.url,
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
        'url':'',
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
//    console.log(previousEvent['event']);
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
            'url': current_tab.url,
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
                'url': '',
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
                details['start'] = search_check['start_count'];
                details['media'] = search_check['media'];
        }

        //If it's a tab-loaded, check if it's a contious reloading
        //like in google doc
        if (e == 'tab-loaded'){
            var previous_url = previousEvent.url.split('#')[0];
            var current_url = tab.url.split('#')[0];
            if (previousEvent.event == 'tab-loaded' && 
                previous_url == current_url)  
                details.note = 'load-same';
        }
 
       var log = {'event': e, 'timestamp': ts,
            'affected_tab_id': tab.id,
            'details': details,
            'url': tab.url,
            }

       // set the tab tracker to the current tab
        previousTab = tab;
        previousEvent = log;
        savedata(log)
    }
});

// Handle different search engines
function check_searchEngine(url){
    //look for search engine query urls
    //Web search
    var google_reg = /.+?\.google\..+?q=.+/;
    var yahoo_reg = /.+?\.search\.yahoo\..+?p=.+/
    var bing_reg = /.+?\.bing\..+?q=.+/ 

//    var test = 'https://www.google.co.uk/search?q=asos+dresses+clearence&rlz=1C1CAFA_enGB612GB612&oq=asos+dresses+clearence&aqs=chrome..69i57.7426j0j7&sourceid=chrome&es_sm=93&ie=UTF-8#q=new+look+dresses' 
//    test = 'https://www.google.co.uk/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=UK+visa'
//    console.log(test.match(google_reg))

    var query = '';
    var se = '';
    var search = false;
    var start = 0;
    var media = 'web';
    if (google_reg.test(url)){
        var google_q_reg = /(\?|#|&)q=.+?(&|$)/g
        var q = []
        while( match = google_q_reg.exec(url))
            q.push(match[0])
        query = q[q.length-1].split('q=')[1].split('&')[0];
//        console.log(query)
//        query = url.split('q=')[1].split('&')[0];
        se = 'google'
        search = true
        tmp = url.split('start=');
        reg_tbm = /tbm=.+?(&|$)/g
        if (tmp.length > 1)
            start = parseInt(tmp[1].split('&')[0]);
        tbms = url.match(reg_tbm);
        //console.log(tbms)
        if (tbms!=null){
            mediatype = tbms[tbms.length-1].split('=')[1].split('&')[0];
            console.log(mediatype)
            if (mediatype == 'isch')
                media = 'images';
            else if (mediatype == 'nws')
                media = 'news';
            else if (mediatype == 'vid')
                media = 'videos';
            else if (mediatype == 'shop')
                media = 'shopping';
            else if (mediatype == 'bks')
                media = 'books';
            else if (mediatype == 'app')
                media = 'apps';
        }
        else if (url.indexOf('/flights/')>-1)
            media = 'flights';
        else if (url.indexOf('/maps/') > -1 || url.indexOf('/maps?')>-1)
            media = 'maps';
   }
    else if (yahoo_reg.test(url)){
        query = url.split('p=')[1].split('&')[0];
        se = 'yahoo';
        search = true;
        //It seems to be updated to pstart
        tmp = url.split('from=');
        if (tmp.length > 1)
            start = parseInt(tmp[1].split('&')[0]);
        if (url.indexOf('images.search') > -1)
            media = 'images';
        else if (url.indexOf('video.search') > -1)
            media = 'videos';
        else if (url.indexOf('news.search') > -1)
            media = 'news';
        else if (url.indexOf('/local/') > -1)
            media = 'local';
        else if (url.indexOf('answers.search') > -1)
            media = 'answers';
        else if (url.indexOf('celebrity.search')>-1)
            media = 'celebrity';
        else if (url.indexOf('recipes.search') > -1)
            media = 'recipes';
    }
    else if (bing_reg.test(url)){
        query = url.split('q=')[1].split('&')[0];
        se = 'bing';
        search = true;
        //It seems to be updated to 'first='
        tmp = url.split('b=');
        if (tmp.length > 1)
            start = parseInt(tmp[1].split('&')[0]);
        if (url.indexOf('/images/') > -1)
            media = 'images';
        else if (url.indexOf('/videos/')> -1)
            media = 'videos'
        else if (url.indexOf('/maps/')> -1)
            media = 'maps';
        else if (url.indexOf('/news/')>-1)
            media = 'news';
        else if (url.indexOf('/explore?')>-1)
            media = 'explore';
    }
    //console.log('startpage', start)
    console.log(media);
    return {'se': se, 'query': query, 'search': search, 'start_count': start, 'media': media}
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
//            console.log(previousEvent)
        }
        else
            inputtype = [details.transitionType]

        e = e + '-' + inputtype.join('-');
        log = {'event': e, 'timestamp': ts, 
            'affected_tab_id': details.tabId,
            'details': details, 
            'url': details.url,
        };
        previousEvent = log; 
        savedata(log)
    }
});

chrome.runtime.onMessage.addListener(function(request, sender, callback){
    var log = {}
    if (request.name == 'form_submit'){
        log = {'event': 'form_submit',
               'timestamp': request.timestamp,
               'affected_tab_id': sender.tab.id,
               'details': {
               'form_data': request.data,
               'senderId': sender.id,
               'senderTab': sender.tab,
                },
               'url': sender.tab.url
        }
        previousEvent = log;
        savedata(log)
    }
    else if (request.name == 'link_click'){
        log = {'event': 'link_click', 
                'timestamp': request.timestamp,
                'affected_tab_id': sender.tab.id,
                'details': {
                'link_data': request.data,
                'senderId': sender.id,
                'senderTab': sender.tab,
                },
                'url': sender.tab.url
        }
        previousEvent = log;
        savedata(log)
    }
});




