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
    T_unfinished = [] 
    T_zero = []
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
 
        # Stats for unfinished tasks
        stage = T_prop['task_stage']
        X_tasks = [s for s in stage if stage[s] < 5 and s in u_tasks]
        # stats for unfinished tasks
        for t in X_tasks:
            # Get # sessions for this task
            S = [s for s in T_sessions if s[0]['taskid'] == t]
            # Get session per day
            dates = [(s[0]['timestamp_bson'].date(), s) for s in S]
            dates.sort(key=lambda x: x[0])
            dd = []
            time_per_day = []
            for k, g in itertools.groupby(dates, lambda x: x[0]):
                dd.append(k) 
                segments = [sorted(x[1], key=lambda y: y['timestamp_bson']) for x in g]
                time = [(s[-1]['timestamp_bson'] - s[0]['timestamp_bson']).total_seconds() for s in segments]             
                time_per_day.append(sum(time))
 
            T_unfinished.append({
                'taskid': t, 
                '#session': len(S),
                '#s_per_day': len(S)/float(len(dd)),
                '#duration': T_time[t],
                '#time_per_day': np.mean(time_per_day)
            })

        # Stats for zero query tasks
        Y_tasks = [s for s in u_tasks if countQ[s] == 0]
        for t in Y_tasks:
            # Get # sessions for this task
            S = [s for s in T_sessions if s[0]['taskid'] == t]
            # Get session per day
            dates = [(s[0]['timestamp_bson'].date(), s) for s in S]
            dates.sort(key=lambda x: x[0])
            dd = []
            time_per_day = []
            for k, g in itertools.groupby(dates, lambda x: x[0]):
                dd.append(k) 
                segments = [sorted(x[1], key=lambda y: y['timestamp_bson']) for x in g]
                time = [(s[-1]['timestamp_bson'] - s[0]['timestamp_bson']).total_seconds() for s in segments]             
                time_per_day.append(sum(time))
 
            T_zero.append({
                'taskid': t, 
                '#session': len(S),
                '#s_per_day': len(S)/float(len(dd)),
                '#duration': T_time[t],
                '#time_per_day': np.mean(time_per_day)
            })
     
    print 'Unfinished tasks:'
    X_session = [x['#session'] for x in T_unfinished]
    X_s_perday = [x['#s_per_day'] for x in T_unfinished]
    X_duration = [x['#duration'] for x in T_unfinished]
    X_t_perday = [x['#time_per_day'] for x in T_unfinished]

    print 'Avg. #sessions:', np.mean(X_session), np.median(X_session)
    print 'Avg. #session per day:', np.mean(X_s_perday), np.median(X_s_perday)
    print 'Avg. #duration:', np.mean(X_duration), np.median(X_duration)
    print 'Avg. #time_per_day:', np.mean(X_t_perday), np.median(X_t_perday)

    print 'zeroQ tasks:'
    X_session = [x['#session'] for x in T_zero]
    X_s_perday = [x['#s_per_day'] for x in T_zero]
    X_duration = [x['#duration'] for x in T_zero]
    X_t_perday = [x['#time_per_day'] for x in T_zero]

    print 'Avg. #sessions:', np.mean(X_session), np.median(X_session)
    print 'Avg. #session per day:', np.mean(X_s_perday), np.median(X_s_perday)
    print 'Avg. #duration:', np.mean(X_duration), np.median(X_duration)
    print 'Avg. #time_per_day:', np.mean(X_t_perday), np.median(X_t_perday)

   




