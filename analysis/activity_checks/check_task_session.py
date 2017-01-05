"""
Check when a task session (i.e., same url, same tabid, sharing the same taskid) is a
valid session:
- the user needs to be on that tab 
- and the user needs to do something/spend some time on that tab
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

def check_session(session):
    events = [s['event'] for s in session]
    time = (session[-1]['timestamp_bson'] - session[0]['timestamp_bson']).total_seconds()
    switch = sum([int('switch' in e) for e in events]) > 0

    # check how much time does it need for a user to click on something
    click = sum([int('click' in e) for e in events]) > 0
    if click and time < 1 and time > 0:
        print events, time

    """
    # filter sessions shorter than 1 second
    if time < 1:
        print events, time, False, session[0]['taskid']
    else:
        print events, time, True, session[0]['taskid']
    
    if time > 1 and set(events)==set(['tab-loaded']):
        print 'auto', session[0]['taskid']
    """

if __name__ == '__main__':
    for u in list(Users.find({})):
        # Flatten the data to event stream
        D = []
        data = list(DataLabeled.find({'userid': u['userid']}))
        for d in data:
            tab = d['data'] 
            for t in tab:
                for url_group in t['tab_group']:
                    for e in url_group['url_group']:
                        D.append(e)
        session = []
        current_task = ''
        for e in D:
            if not e['taskid'] == current_task:
                if not current_task == '':
                    check_session(session)
                    session = []
                current_task = e['taskid']
            session.append(e)
             
                            

