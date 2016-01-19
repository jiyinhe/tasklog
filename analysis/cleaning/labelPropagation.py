import pymongo
from pymongo import MongoClient
import userinfo 
from bson.objectid import ObjectId
from datetime import datetime
import itertools
import re
import simplejson as sj
from bson import json_util

"""
J. He 
12.29.2015

Propagate labels from anchor events (tab-search, tab-loaded) to other events. 
Identify different types of 
- link_clinck: external vs. internal
- tab-search: new, backward, pagination, (change of) verticle, no-query
- tab-loaded: loading of SERP vs. other pages

Output: 
- json file: user activities groupped by consecutive tab-id
- each event is assigned with a task label (None is assigned if a url is not labelled)

Usage:
- observation of users search behaviour via tab-search 
- observation of user pageview (if a user does not spend time on a tab then the page
  cannot be viewed)
- observation of the time a user spend on a task (including multi-tasking) 
 
"""
# DB connection to localhost
client = MongoClient()
# Get DB
db = client.db_tasklog_clean
# Collections
User = db.user
UserTask = db.user_tasks
LogChrome = db.log_chrome

# collection to store new data
DataLabeled = db.data_labeled

# Output
# outfile = '../output/labeled_data.json'


def check_serp(url):
    google_reg = re.compile('.+?\.google\..+?q=.+')
    yahoo_reg = re.compile('.+?\.search\.yahoo\..+?p=.+')
    bing_reg = re.compile('.+?\.bing\..+?q=.+')
    # This may involve other service of google/bing, but it's not a big problem for
    # now
    if len(google_reg.findall(url)) > 0 or \
        len(yahoo_reg.findall(url)) > 0 or \
        len(bing_reg.findall(url)) > 0:
        return True
    else:
        return False

def clean_url(url):
    if not '#' in url:
        return url

    # do not clean SERP urls
    if not check_serp(url):
        strs = url.split('#')
        # gmail has '#' in the middle of the url, different emails are treated as
        # different sections
        if '/' in strs[1]:
            return url
        else:
            return strs[0]
    else:
        return url

# link_click:
#  - external: leads to external url
#  - internal: within page click
#  
# tab-search: 
# identify query submit events, special cases:
#  - forward-backward
#  - next page
#  - different verticle
def pass1(ulog):
    i = 0
    prev_search = {} 
    to_change = {}
    for e in ulog:
        if e['event'] == 'link_click':
            # check external/internal link
            target_url = e['details']['link_data'].get('url', '')
            if target_url.startswith('http'):
                to_change[i] = 'link_click-external'
            else:
                to_change[i] = 'link_click-internal'
            # If it's on SERP, the internal rule does not apply 
            if check_serp(e['url']):
                if target_url.startswith('/url?') or target_url.startswith('http'):
                    to_change[i] = 'link_click-SERP-result'
                else:
                    to_change[i] = 'link_click-SERP-other' 

        elif e['event'] == 'tab-search':
            # There is situations there is no query recorded, skip those as issuing a query
            if e['details']['query'] == '':
                to_change[i] = 'tab-search-noquery'
    
            # Check if it's a backward:
            # - navigation-omni_query-forward_back 
            # - navigation-link-forward_back
            elif i + 1 < len(ulog) and 'forward_back' in ulog[i+1]['event']:
                to_change[i] = 'tab-search-backward'

            # Check if it's a pagination on the same SERP
            elif not prev_search == {} and \
                prev_search['details']['query'] == e['details']['query'] and \
                    (not e['details']['start'] == prev_search['details']['start']):
                    to_change[i] = 'tab-search-pagination'                            
                            
            # Check if it's a different verticle
            elif not prev_search == {} and \
                prev_search['details']['query'] == e['details']['query'] and \
                (not e['details']['media'] == prev_search['details']['media']):
                    to_change[i] = 'tab-search-verticle'  
            else:
                to_change[i] = 'tab-search-new'    
            # Keep record of previous tab-search
            prev_search = e

        elif e['event'] == 'tab-loaded':
            # Check if it's a loding of a SERP
            if check_serp(e['url']):
                to_change[i] = 'tab-loaded-SERP'
        i += 1

    for idx in to_change:
        ulog[idx]['event'] = to_change[idx]
    return ulog


# If a tab-url tuple is not directly labelled by the user, and there is no exact
# match of label of the url, then check if a cleaned url has a match. 
def search_label_unexact(tabid, url_clean, LC):
    label = 'None'
    l = LC.get((tabid, url_clean), [])
    if len(l) == 1:
        label= l[0]
    elif len(l) > 1:
    # If there is a general category in there, take it
        if '004' in l:
            label = '004'
        elif '002' in l:
            label = '002'
        elif '000' in l:
            label = '000' 
        elif '001' in l:
            label = '001'
        elif '003' in l:
            label = '003'
        # otherwise, leave it as not assigned rather than pick one from user defined
        # labels. (This situation actually doesn't exist)
    return label
    
# Assign labels to tab-url tuples 
def assign_labels(tabid, current_url, ug, L, LC):
    # check if it's a skippable group, e.g., no url or only chrome:// 
    # check for within the url group
    labels = set([e['taskid'] if e['event'] in ['tab-loaded', 'tab-search'] else '' for e in ug])
    labels = list(labels - set(['']))
    if len(labels) == 1:
        # Only one label, assign it to all events sharing the same url and tabid
        for e in ug:
            if labels[0] == 'NA':
                # If the anchor events are not labeled, check if same url and tabid
                # has been assigned to a label
                # First try exact matching of url
                l = L.get((tabid, e['url']), 'None')
                if l == 'None':
                    # Try cleaned url
                    l = search_label_unexact(tabid, current_url, LC)
                e['taskid'] = l
            else:
                e['taskid'] = labels[0]

    elif len(labels) == 2 and 'NA' in labels: 
        # more than one tab-search/tab-loaded events, one of them are 'NA'
        # since the other tab-loaded/search events share the same url and tabids,
        # they can share the same taskid
        labels = list(set(labels) - set(['NA']))
        for e in ug:
            e['taskid'] = labels[0]

    elif len(labels) == 0:
        # no label (no tab-search and tab-loaded)
        # see if label was assigned to events in other groups sharing the same url
        # and tabids  
        for e in ug:
            l = L.get((tabid, e['url']), 'None')
            if l == 'None':
                # Try cleaned url
                l = search_label_unexact(tabid, current_url, LC)
            e['taskid'] = l
    else:
        # anchor events labled for differently, then for each event search for its
        # label 
        print labels
        for e in ug:
            if e['taskid'] == 'NA':
                l = L.get((tabid, e['url']), 'None')
                if l == 'None':
                    # Try cleaned url
                    l= search_label_unexact(tabid, current_url, LC)
                e['taskid'] = l 


# Group consecutive events sharing the same cleaned url within a tab group, and
# assign labels to these groups, propagated from the anchor events
def check_group(tabid, group, L, LC):
    # Group by url
    current_url = ''
    ug = []
    G = []
    for e in group:
        if 'current_tab' in e['details']:
            del e['details']['current_tab']
        if 'previous_tab' in e['details']:
            del e['details']['previous_tab'] 

        url_clean = clean_url(e['url'])
        if not url_clean == current_url:
            if not current_url == '':
                # Try to assign labels to each url group
                assign_labels(tabid, current_url, ug, L, LC)
                G.append({'url': current_url, 'url_group': ug})
                ug = []
            current_url = url_clean
        ug.append(e)
    if not current_url == '':
        # Try to assign labels to each url group
        assign_labels(tabid, current_url, ug, L, LC)
        G.append({'url': current_url, 'url_group':ug})
    return G 


# Group consecutive events by tabid
# Process the tab groups and assign labels to events
def pass2(ulog, L, LC):
    G = []
    # Group consecutive events by tabid
    current_tabid = 0
    group = []
    i = 0
    for e in ulog:
        if not e['affected_tab_id'] == current_tabid:
            if current_tabid > 0:
                group = check_group(current_tabid, group, L, LC)
                G.append({'index': i, 'tabid': current_tabid, 'tab_group': group})
                group = []
            current_tabid = e['affected_tab_id']
        group.append(e)
        i += 1
    if current_tabid > 0:
        group = check_group(current_tabid, group, L, LC)
        G.append({'index': i, 'tabid': current_tabid, 'tab_group': group})
    return G 

# Assume the same tab, url, title has the same task labels
# There are 8 exceptions, in all cases, the labels contain a specific user task and a
# general category (000 - 004), then use the general categories
def get_tasklabels(u):
        tasks = UserTask.find({
            'userid': u['userid']
        })
        T = []
        for t in tasks:
            T.append((str(t['_id']), {'level': t['task_level'], 'parent': t['parent_task']})) 
        T = dict(T)

        tasklabels = LogChrome.aggregate([
            {'$match': {'userid': u['userid'], 'removed': False, 
               'annotation.task': {'$exists': True} }},
            {'$project': {
                'affected_tab_id': 1, 
                'url': 1, 
                'taskid': '$annotation.task.taskid',
                'title': {'$ifNull': ['$details.current_tab.title', 'NA']},
                }},
            ])
      
        # Get the parent level task labels 
        Labels = {}
        Labels_clean = {}
        tasklabels = list(tasklabels)
        for t in tasklabels:
            # Get the parent level task labels
            t_level = T.get(t['taskid'], {}).get('level', 0)
            if t_level > 0:
                t_parent = T.get(t['taskid'], {}).get('parent', '')
                if not t_parent == '':
                    t['taskid'] = t_parent

            # Prepare the cleaned url in addition to the raw url
            url_clean = clean_url(t['url'])
            # First register the raw url
            Labels[(t['affected_tab_id'], t['url'])] = t['taskid']
            # Then check if the clean url has a different label 
            if not t['url'] == url_clean:
                tmp = Labels_clean.get((t['affected_tab_id'], url_clean), [])
                tmp.append(t['taskid'])
                Labels_clean[(t['affected_tab_id'], url_clean)] = list(set(tmp))

        return Labels, Labels_clean

if __name__ == '__main__':
    users = list(User.find())
    c = 0
    data = []
    for u in users:
        print u['userid']
        # skip admin
        if not 'userid' in u or u['userid'] == '':
            continue

        L, LC = get_tasklabels(u) 
        # Get log entries
        ulog = LogChrome.aggregate([
            {'$match': {'userid': u['userid'], 'removed': False}},
            {'$project': {'affected_tab_id': 1, 
                     'event': 1, 
                     'url': 1,
                     'details': 1,
                     'timestamp_bson': 1, 
                     'taskname': {'$ifNull': ['$annotation.task.name', 'NA']},
                     'taskid': {'$ifNull': ['$annotation.task.taskid', 'NA']},
                     'title': {'$ifNull': ['$details.current_tab.title', 'NA']},
                     }}, 
            {'$sort':{'timestamp_bson': pymongo.ASCENDING}},
        ])
        
        ulog = list(ulog)

        # handle different types of link-click and tab-search 
        ulog = pass1(ulog)

        # Group consecutive events by tabid
        TG = pass2(ulog, L, LC)

        #data[u['userid']] = TG
        data.append({'userid': u['userid'], 'data': TG})

# save output
#out = open(outfile, 'w')
#sj.dump(data, out, default=json_util.default)
#out.close()
DataLabeled.drop()
DataLabeled.insert_many(data)
 

