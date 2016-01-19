"""
Compute descriptive stats for Sec 4.1
- number of queries per task
- number of pageview per task
- duration per task
"""
import pymongo
from pymongo import MongoClient
from bson.objectid import ObjectId

import simplejson as js
import numpy as np
import pylab
import scipy.stats.stats as st

# thresh: first X mins user spend on a task
inputfile = lambda x: '../output/variables_1st%smin_alltask.json'%x

# DB connection to localhost
client = MongoClient()
# Get DB
db = client.db_tasklog_clean
# collection to store new data that contains task labels
# Note: only top-level task labels are used
DataLabeled = list(db.data_labeled.find({}))
Users = db.user
users = list(Users.find({}))

# Tasks to be filtered out
Filter = ['None', '000', '001', '002', '003', '004']
# Tasks annotated with postQ
postQ = dict([(u['userid'], u['postQ']['questionnaire'].keys()) for u in users])




# flatten user data per tasks
def prepare_user_data(data):
    D = {}
    for u in data:
        for d in data[u]:
            for prop in d:
                if not prop in ['userid', 'taskid']:
                    tmp = D.get(prop, {})
                    tmp.update({d['taskid']:d[prop]})
                    D[prop] = tmp
    return D

def stats(data):
    print data.keys()
    # number of queries
    Q = data['number_queries']
    num_q = [Q[q] for q in Q]
    count_0 = [Q[q] for q in Q if Q[q] == 0] 
    count_1 = [Q[q] for q in Q if Q[q] == 1]
    count_2 = [Q[q] for q in Q if Q[q] == 2]
    print 'Total number of queries:', sum(num_q)
    print 'Avg. number of queries per task:', sum(num_q)/float(len(num_q))
    print 'Median #Q p.t:', np.median(num_q)
    print 'min:', min(num_q), 'max:', max(num_q)
    print 'Number of zeros:', len(count_0), len(count_0)/float(len(num_q))
    z, p = st.skewtest(num_q)
    print 'Skewness:', st.skew(num_q), z, p
#    pylab.hist(num_q)
    print 

    # number of page views
    P = data['number_pageview']
    num_p = [P[p] for p in P]
    count_0 = [P[p] for p in P if P[p] == 0]
    print 'Total number of pageviews:', sum(num_p) 
    print 'Avg. :', sum(num_p)/float(len(num_p))
    print 'Median:', np.median(num_p)
    print 'min:', min(num_p), 'max:', max(num_p)
    print 'Number of zeros:', len(count_0) 
    print
#    pylab.hist(num_p)

    # duration per task 
    D = data['duration_day']
    d_t = [D[t] for t in D]
    print 'Avg. duration_day:', sum(d_t)/float(len(d_t))
    print 'Median duration_day:', np.median(d_t)
    print 'min:', min(d_t), 'max:', max(d_t)
    print
#    pylab.hist(d_t)


    D = data['duration_time']
    d_t = [D[t] for t in D]
    print 'Avg. duration_time:', sum(d_t)/float(len(d_t))
    print 'Median duration_time:', np.median(d_t)
    print 'min:', min(d_t), 'max:', max(d_t)
    print
#    pylab.hist(d_t)

def stats_task():
    # Number of user defined and annotated tasks
    tasks = []
    for u in DataLabeled:
        user_data = u['data']
        for d in user_data:
            tab_group = d['tab_group']
            for tab in tab_group:
                url_group = tab['url_group']
                for g in url_group:
                    if not g['taskid'] in Filter:
                        tasks.append(g['taskid'])
    print 'Number of user defined tasks:', len(set(tasks))

    # Number of postQ tasks
    count = 0
    for u in postQ:
        count += len(postQ[u])
    print 'Number of postQ tasks:', count

if __name__ == '__main__':
    t_thresh = -1
    # load data
    f = open(inputfile(t_thresh))
    data = js.load(f)
    f.close()

    UD = prepare_user_data(data['user_data'])
    stats(UD)      

    stats_task()
#    pylab.show()
 
