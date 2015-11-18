from pymongo import MongoClient
import userinfo 
from bson.objectid import ObjectId
from datetime import datetime
import itertools

"""
Clean the chrome log data:
 - Only include valid user and experiment period
 - Remove items that are related to the removed items
 - Remove SERP related to removed search
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
            for t in tab_group[1:]:
                if t['url'] != current_url:
                    segs.append([rm, seg])
                    seg = []
                    rm = False
                    current_url = t['url']
                seg.append(t)
                if t['removed']:
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
   

def clean():
    # Filter valid users 
    cleanUsers()
    # Filter user tasks
    cleanUserTasks()
    # Filter log
    RM = cleanLog()
    # Filter serp
    cleanSERP(RM)

if __name__ == "__main__":
    clean() 


