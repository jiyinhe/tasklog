"""
12.29.2015
J He

Analysing relation between user multi-tasking behaviour and task properties
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

def get_data(u):
    return list(DataLabeled.find({'userid': u['userid']}))[0]


# Get the sequence user process with their tasks
def task_activities_v1(data):
    task_seq = []
    current_task = ''
    events = []
    for segment in data:
        tab_group = segment['tab_group']
        for u in tab_group:
            url_group = u['url_group']
            for e in url_group:
                if not current_task == e['taskid']:
                    if not current_task == '':
                        time = (events[-1]['timestamp_bson'] - events[0]['timestamp_bson']).total_seconds()
                        # Ignore if the user spend less than 1s for the task -
                        # usually these are automatic events 
                        if time > 1:
                            task_seq.append((current_task, events, time))
                            events = []
                    current_task = e['taskid']
                events.append(e)
    # after all loops, adding the last one
    if not current_task == '':
        time = (events[-1]['timestamp_bson'] - events[0]['timestamp_bson']).total_seconds()
        if time > 1:
            task_seq.append((current_task, events, time))
   
    for t in task_seq:
        print [e['event'] for e in t[1]]
        print t[0], t[2]         


def task_activities(data):
    # get all events
    events = []
    for s in data:
        tab_group = s['tab_group']
        tabid = s['tabid']
        for u in tab_group:
            # a group of events sharing the same url
            url_group = u['url_group']
            # If the whole group takes less than 1 second, then it's likely that
            # that are all automatic events
            time = (url_group[-1]['timestamp_bson'] - url_group[0]['timestamp_bson']).total_seconds()
            if time > 1:
                #print [(e['taskid'], e['event']) for e in url_group], time
                for e in url_group:
                    events.append(e)
    for e in events:
        print e['taskid'], e['timestamp_bson'], e['event']


if __name__ == '__main__':
    users = Users.find({})
    for u in users:
        print u['userid']
        data = get_data(u)
        task_activities(data['data']) 




 
