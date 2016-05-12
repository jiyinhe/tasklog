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

# threshold for time based session split, in mins
session_thresh = 30

# threshold for counting task interruptions, in seconds
gap_thresh = 10
# Interruption happens within a fixed period, in mins
period = 30

# threshold for counting page view dwell time, in seconds
# larger than 10 seconds to actually read something
pv_thresh = 10


# Partial observations of log time thresh (in min)
# i.e., the first 5, 10 mins of a task
#t_thresh = 10
#t_thresh = 20
#t_thresh = 30
t_thresh = -1 

outputfile = '../output/variables_1st%smin.json'%t_thresh
#outputfile = '../output/variables_1st%smin_alltask.json'%t_thresh



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
    X = []
    Y = []
    TA = []
    for u in users:
        data = list(DataLabeled.find({'userid': u['userid']}))[0]['data']
        events = event_stream(data)
      
        to_include = postQ[u['userid']]  
        # include all tasks including those without postQ 
#        to_include = list(set([e['taskid'] for e in events if e['taskid'] not in Filter]))

        # There may be a few tasks that are in postQ but not in the event stream 
        # possible missing reasons:
        # - conflicting labels, assigned to a general category
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
        T_length_day = T.get_task_lengths()
        # Task sessions
        T_sessions = T.get_task_sessions()
        # count task interruptions
        T_interruptions = T.count_task_interruptions(T_sessions, gap_thresh, period) 
      
        # Get the search stats
        UA = UserActivity.UserActivity(data, to_include, t_thresh, session_thresh)
        countQ = UA.number_of_queries()
        countC = UA.number_of_SERPclicks()
        countQbC = UA.number_of_QbC()
        QP = UA.query_similarity()
        PV = UA.pageview_stats(pv_thresh)  

        # Actual time spent on each task
        T_time = UA.total_time_on_task()
 
        # for test 
        #TMP = PV
        #key = 'from_external_link'
        #X += [TMP[t][key] for t in TMP] 
        #Y += [T_length[t] for t in TMP]            
        #TA += [t for t in TMP]
        
        UD = []
        for task in u_tasks:
            D = {
                'taskid': task,
                'userid': u['userid'],
                'duration_day': T_length_day[task],
                'duration_time': T_time[task],
                'interruptions': T_interruptions[task],
                'number_queries': countQ[task],
                'number_clicks': countC[task],
                'number_q_before_c': countQbC[task],
                'query_similarity': QP.get(task, None),
                'number_pageview': PV[task]['total_pv'],
                'number_unique_pageview': PV[task]['unique_pv'],
                'number_revisits': PV[task]['revisits'],
                'from_SERP_view': PV[task]['from_SERP'],
                'from_external_link': PV[task]['from_external_link'],
                'from_omni_url': PV[task]['from_omni'],
            }
            UD.append(D)
        User_data[u['userid']] = UD

    # Store data 
    DATA = {'task_properties': Task_properties, 
            'user_data': User_data,
        }

    # test
    #r, p = kendalltau(X, Y)
    #print r, p

    #for prop in T_prop:
    #    answers = Task_properties[prop]
    #    Y = [answers[t] for t in TA]
    #    k, p = kendalltau(X, Y)
    #    print prop, k, p,
    #    if p < 0.05:
    #        print '*'
    #    else:
    #        print

    f = open(outputfile, 'w')
    js.dump(DATA, f, default=json_util.default)
    f.close()

