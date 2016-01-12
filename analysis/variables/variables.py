"""
Compute statistics for variables to be analysed
Unobservables:
 - task properties

Observables:
 - multi-tasking level
 - task length
 - task sessions
 - queries
 - SERP clicks
 - page views 
"""

import pymongo
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import itertools
import re
import Tasks, UserActivity
import numpy as np
from scipy.stats import pearsonr, kendalltau
import simplejson as js
from bson import json_util

outputfile = '../output/variables.txt'

# threshold for time based session split, in mins
session_thresh = 30

# threshold for counting task interruptions, in seconds
gap_thresh = 10
# Interruption happens within a fixed period, in mins
period = 30

# Partial observations of log time thresh (in min)
# i.e., the first 5, 10 mins of a task
time_thresh = [-1]
#time_thresh = [5, 10, 20, -1]

# DB connection to localhost
client = MongoClient()
# Get DB
db = client.db_tasklog_clean
# collection to store new data that contains task labels
# Note: only top-level task labels are used
DataLabeled = db.data_labeled
Users = db.user
users = list(Users.find({}))

# Tasks to be filtered out
Filter = ['None', '000', '001', '002', '003', '004']
# Tasks annotated with postQ
postQ = dict([(u['userid'], u['postQ']['questionnaire'].keys()) for u in users])

bloom_map = {
    'remember': 1,
    'understadn': 2,
    'apply': 3,
    'analyse': 4,
    'evaluate': 5,
    'create': 6
}

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

# Get task properties
def get_task_properties(u):
    T_prop = {}
    Q = u['postQ']['questionnaire']
    for q in Q:
        for question in Q[q].keys():
            if question == 'task_goals_quantity':
                continue
            answers = T_prop.get(question, {})
            a = Q[q][question]
            # process bloom's taxonomy
            if question == 'task_complexity_objective':
                a = bloom_map[a]
            answers.update({q:a})
            T_prop[question] = dict(answers)
    return T_prop


if __name__ == '__main__':
    Task_properties = {} 
    User_data = {} 
    for u in users:
        data = list(DataLabeled.find({'userid': u['userid']}))[0]['data']
        events = event_stream(data)
        to_include = postQ[u['userid']]  
        
        u_tasks = list(set([e['taskid'] for e in events if e['taskid'] in to_include]))
 
        # Get task properties
        T_prop = get_task_properties(u) 
        for prop in T_prop:
            tmp = Task_properties.get(prop, {})
            tmp.update(T_prop[prop])
            Task_properties[prop] = tmp

        # Get task statistics
        T = Tasks.Tasks(events, to_include, session_thresh)
        # Task length
        T_length = T.get_task_lengths()
        # Task sessions
        T_sessions = T.get_task_sessions()
        # count task interruptions
        T_interruptions = T.count_task_interruptions(T_sessions, gap_thresh, period) 
      
        # Get the search stats
        for t_thresh in time_thresh:
            UA = UserActivity.UserActivity(data, to_include, t_thresh, session_thresh)

 
        for task in u_tasks:
            D = {
                'userid': u['userid'],
                'duration': T_length[task],
                'interruptions': T_interruptions[task]
            }
            User_data[task] = D

        # Test
        interrupt = [T_interruptions[t] for t in T_interruptions]
#        print u['userid'], len(T_prop), len(T_length), len(T_sessions), np.mean(interrupt), np.std(interrupt)

    # Store data 
    DATA = {'task_properties': Task_properties, 
            'user_data': User_data,
        }

    X = [User_data[task]['duration'] for task in User_data]
    thresh = 600
    print len(list(itertools.ifilter(lambda x: x> thresh, X)))
    print len(User_data)
    

    f = open(outputfile, 'w')
    js.dump(DATA, f, default=json_util.default)
    f.close()

