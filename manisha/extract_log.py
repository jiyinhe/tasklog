"""
From tasklog to extract a query log
including:
userid, timestamp, event (query or url), from_serp, dwell time
taskid
"""
import pymongo
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import itertools
import simplejson as js
from bson import json_util
import sys
sys.path.insert(0, '../analysis/variables/')
from variables import UserActivity

# DB connection to localhost
client = MongoClient()
# Get DB
db = client.db_tasklog_clean
# collection to store new data that contains task labels
# Note: only top-level task labels are used
DataLabeled = db.data_labeled
Users = db.user
Tasks = db.user_tasks
users = list(Users.find({}))

# Parameters for the user activity
t_thresh = -1
session_thresh = 30


# Output
outdir = 'data/'
outtask = '%s/taskinfo.json'%outdir
outlog = '%s/log.json'%outdir

"""
Event stream from the log 
"""
def event_stream(data):
    events = []
    # data consists of tab-groups
    for s in data:
        tab_group = s['tab_group']
        tabid = s['tabid']
        # tab groups consist of url groups
        for ug in tab_group:
            # a group of events sharing the same url
            url_group = ug['url_group']
            for e in url_group:
                events.append(e)
    events.sort(key=lambda x: x['timestamp_bson'])
    return events

# Get all tasks of a user, only top level tasks
def get_task_information(userid):
    postQ = Users.find({'userid': userid})[0]['postQ']['questionnaire']
    tasks = [{'taskid': str(t['_id']),
                'taskname': t['task'],
                'postQ': postQ.get(str(t['_id']))
                }
                for t in Tasks.find({'task_level': 0, 'userid': userid})]
    return tasks


# Events are grouped by tab: each group contains consecutive events sharing the same
# tab id and the same url (url containing different sections # are merged)
def format_data(user_path, userid):
    L = []    
    for tabid, user_on_tab, url_group in user_path:
        for ug in url_group['url_group']:
            # Information about clicks
            click = False
            click_type = None
            clicked_data = None
            if 'click' in ug['event']:
                click = True
                click_type = ug['event']
                clicked_data = ug['details']['link_data']
            # Information about search
            search = False
            search_type = None
            search_data = None
            if 'search' in ug['event']:
                search = True
                search_type = ug['event']
                search_data = ug['details']

            entry = {
                'url': ug['url'],
                'user_on_page': ug['on'],
                'timestamp': ug['timestamp_bson'].isoformat(),
                'click': click,
                'click_type':  click_type,
                'clicked_data': clicked_data,
                'search': search,
                'search_type': search_type,
                'search_data': search_data,
                'taskid': ug['taskid'],
                'event': ug['event']
            }
            L.append(entry)

    return {'userid': userid, 'log': L}



if __name__ == '__main__':
    Log = []
    TaskInfo = []
    for u in users:
        print u['userid']
        data = list(DataLabeled.find({'userid': u['userid']}))[0]['data']
        # Get task information: user, taskid, taskname, postQ
        tasks = get_task_information(u['userid'])
        TaskInfo += tasks

        # Include all 
        to_include = [t['taskid'] for t in tasks]
        ua = UserActivity.UserActivity(data, to_include, t_thresh, session_thresh)
        user_path, user_path_stream = ua.get_user_path()

        L = format_data(user_path, u['userid'])
        Log.append(L)

    with open(outtask, 'w') as o:
        js.dump(TaskInfo, o, indent=4)

    with open(outlog, 'w') as o:
        js.dump(Log, o, indent=4)




