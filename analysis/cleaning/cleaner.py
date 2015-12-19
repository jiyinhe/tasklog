from pymongo import MongoClient
import userinfo 
from bson.objectid import ObjectId
from datetime import datetime
import itertools
import re

"""
Clean the chrome log data:
 - Only include valid user and experiment period
 - Remove items that are related to the removed items
 - Remove SERP related to removed search
 - Entries related to certain tasks should be removed as the user indicated

Correct pagination in tab-search events as SEs have changed pagination urls
"""
# DB connection to localhost
client = MongoClient()
# Get DB
db = client.db_tasklog_server
# Collections
User = db.user
UserTask = db.user_tasks
LogChrome = db.log_chrome
LogSERP = db.log_serp

# DB for cleaned data
db_clean = client.db_tasklog_clean
UserClean = db_clean.user
UserTaskClean = db_clean.user_tasks
LogChromeClean = db_clean.log_chrome
LogSERPClean = db_clean.log_serp

def cleanUsers():
    # Get valid users from the user collection
    validIDs = userinfo.UserIDs.keys()
    userlist = []
    for u in User.find({"userid":{"$in": validIDs}}):
        # To keep the original objectIds
        u['_id'] = ObjectId(u['_id'])
        userlist.append(u)

    # Move to db_clean
    # Drop exisiting clean collection first
    UserClean.drop() 
    UserClean.insert_many(userlist) 
 
    return userlist

""" We don't filter valid experiment period here, 
    some users (mostly testers) enter the tasks earlier, 
    and started the experiment later
"""
def cleanUserTasks():
    validIDs = userinfo.UserIDs.keys()
    tasks = []
    for t in UserTask.find({"userid": {"$in": validIDs}}):
        # To keep the original objectIds
        t['_id'] = ObjectId(t['_id'])
        tasks.append(t) 
    # Move to db_clean
    UserTaskClean.drop()
    UserTaskClean.insert_many(tasks)

"""
Heuristics for cleaning
 1. Filter valid users and valid experiment period

 2. If an entry is removed, it means the user does not want his input or the url he
   viewed to be logged, however this may not apply for the same url in a different
   situation:
    - remove the activities related to a removed url within the same tab, and remove
      these. 
    - by removing, we keep the event and tabID, but remove the rest information

 3. We do NOT filter out "tasklog.cs.ucl.ac.uk/*", or "localhost",
"chrome://extensions" -- these are not required to be annotated, process it in
analysis, and users may be working on developing something with localhost or chrome
extensions 
"""
def cleanLog():
    # Record removed items for cleaning log_serp
    RM = [];
    cleanL = [];
    for userid in userinfo.UserIDs:
        # Get all log valid entries
        dates = userinfo.UserIDs[userid]
        if len(dates) > 0:
            start_date = datetime(dates[0][0], dates[0][1], dates[0][2], 0, 0, 0)
            end_date = datetime(dates[1][0], dates[1][1], dates[1][2], 23, 59, 59)
            # Filter valid experiment period for valid users
            log = LogChrome.find({'userid': userid, 
                'timestamp_bson': {'$gte': start_date, 
                '$lte': end_date} 
                })
        else:
            log = LogChrome.find({'userid': userid})

        # Group by tab_id, trace the url change within the same tab
        L = sorted(log, key=lambda l: l['affected_tab_id']) 
        for k, g in itertools.groupby(L, lambda l: l['affected_tab_id']):
            tab_group = list(g)
            # Sort by time, check if continuous same urls are 
            # related to a removed item
            tab_group.sort(key=lambda x: x['timestamp_bson'])
          
            # Identify segments that should be removed 
            current_url = tab_group[0]['url']
            seg = [tab_group[0]]
            segs = [];
            rm = False
            # If the first event is marked removed, then the segment should be removed
            # or the first event falls into the tasks that should be removed
            if seg[0]['removed']:
                rm = True
            elif 'task' in seg[0]['annotation']:
                if seg[0]['annotation']['task']['taskid'] in userinfo.TaskToRM:
                    rm = True
            for t in tab_group[1:]:
                if t['url'] != current_url:
                    segs.append([rm, seg])
                    seg = []
                    rm = False
                    current_url = t['url']
                seg.append(t)
                # If one of the event is associated with "removed"
                # or a task that should be cleared, then the whole segment should be
                # removed
                if t['removed']:
                    rm = True
                elif 'task' in seg[0]['annotation']:
                    if seg[0]['annotation']['task']['taskid'] in userinfo.TaskToRM:
                        rm = True

            segs.append([rm, seg])
            for rm, seg in segs:
               for s in seg:
                    # If removed, remove the url, details
                    if (rm):
                        RM.append([t['userid'], t['url'], t['timestamp_bson']]) 
                        s['details'] = 'removed'
                        s['removed'] = True
                        s['url'] = 'removed'
                    cleanL.append(s)

    #Store the cleaned Log
    LogChromeClean.drop()
    LogChromeClean.insert_many(cleanL)

    print 'Log entry removed:', len(RM) 
    return RM           

# remove serps related to removed searches
def cleanSERP(RM):
    all_entries = LogSERP.find({})
    entries = []
    count = 0
    for e in all_entries:
        idx = [e['userid'], e['url'], e['timestamp_bson']]
        if idx in RM:
            count += 1
        else:
            entries.append(e)
    print 'SERP removed:', count
    # Store in clean
    LogSERPClean.drop()
    LogSERPClean.insert_many(entries)
   
def correct_pagination():
    # In log_chrome, update it in tab-search events
    entries = LogChrome.find({'event': 'tab-search'})
    for e in entries:
        to_update = {}
        start = 0
        if e['details']['engine'] == 'google':
            pass
        elif e['details']['engine'] == 'bing':
            if 'first=' in e['url']:
                reg = re.compile('first=\d+?[&$]')
                tmp = reg.findall(e['url'])[0]
                start = int(tmp.split('=')[1].split('&')[0])
                to_update = {'_id': e['_id'], 'url': e['url']}
        elif e['details']['engine'] == 'yahoo':
            pass

        if not to_update == {}:
            LogChromeClean.update_one(
                {'_id': to_update['_id']},
                {'$set': {'details.start': start}}
            )
            # In log_serp, update it in every serp
            LogSERPClean.update_one({'url': to_update['url']}, 
                {'$set': {'start': start}}
            )

def clean():
    # Filter valid users 
    cleanUsers()
    # Filter user tasks
    cleanUserTasks()
    # Filter log
    RM = cleanLog()
    # Filter serp
    cleanSERP(RM)

    # Correct pagination info
    correct_pagination()
   
if __name__ == "__main__":
    clean() 


