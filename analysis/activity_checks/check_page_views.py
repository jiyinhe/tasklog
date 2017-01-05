"""
Check user page views
"""
import pymongo
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import itertools
import re


# DB connection to localhost
client = MongoClient()
# Get DB
db = client.db_tasklog_clean

# collection to store new data
DataLabeled = db.data_labeled
Users = db.user

# Assign tab groups whether or not user is on that tab
def user_path(data):
    user_path = []
    previous_on = 0
    for tab in data:
        tabid = tab['tabid']
        tab_group = tab['tab_group']
        on = False
        for urlg in tab_group:
            url = urlg['url']
            url_group = urlg['url_group']
            events = [e['event'] for e in url_group]
            # If there is a switch, then user comes to this tab
            if len([e for e in events if 'switch' in e])>0:
                on = True
                previous_on = tabid 
                break
            # If the user has clicked something, then he should be on this tab
            elif len([e for e in events if 'link_click' in e])>0:
                on = True
                previous_on = tabid
            # This means the user has been staying the same tab, the tabs in between
            # are automatic events
            elif previous_on == tabid:
                on = True
                break 
                
        tab['on'] = on 
        for ug in tab_group:
            user_path.append((tab['tabid'], tab['on'], ug))
    return user_path

# get search, click, pageview events
# dwell time of pageview
def search_click_pageview(path):
    time_start = 0
    E = []
    i = 0
    while i < len(path):
        tabid, on, ug = path[i]
        current_url = ug['url']
        group = ug['url_group']
        # If on, compute the dwell time
        if on == True:
            # find next 'on' event
            dwell = -1
            for j in range(i+1, len(path)):
                next_id, next_on, next_ug = path[j]
                if next_on == True:
                    # Check if next on is on the same tab same url, if so they can be merged
                    if next_id == tabid and next_ug['url'] == current_url:
                        group += next_ug['url_group']
                        continue
                    else:
                        # otherwise compute the dwell time
                        current_start = ug['url_group'][0]
                        next_start = next_ug['url_group'][0] 
                        dwell = (next_start['timestamp_bson'] - current_start['timestamp_bson']).total_seconds() 
                        break
            E.append((tabid, current_url, dwell, group))
            # afterwards, skip the not on group and the merged group
            i = j
        else:
            i += 1  
        if i == len(path) - 1:
            dwell = -1
            E.append((tabid, current_url, dwell, group))
            break

    # TODO: 
    # if a tab-search is in the group, then the url must be a SERP
    # otherwise check the source of the url: SERP, direct url, link-click

    for e in E:
        print e[0], e[1], e[2]
        print [x['event'] for x in e[3]]
        for x in e[3]:
            if x['event'] == 'tab-search-new':
                print x['details']['query']
        print

if __name__ == '__main__':
    for u in Users.find({}):
        D = list(DataLabeled.find({'userid': u['userid']}))[0]
        path = user_path(D['data'])
        search_click_pageview(path)

        """
        for tab in path:
            for ug in tab['tab_group']:
                if tab['on'] == False:
                    print [e['event'] for e in ug['url_group']]
        """
