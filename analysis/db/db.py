"""
Handling requests to mongodb
"""
from pymongo import MongoClient
import pymongo

class TaskLogDB(object):
    def __init__(self):
        # DB connections
        client = MongoClient()
        db = client.db_tasklog_clean

        # Collections
        self.User = db.user
        self.Log = db.log_chrome
        self.UserTasks = db.user_tasks

    # Get all users
    def getUsers(self):
        return list(self.User.find({}))

    # Get the log of a user
    def getUserLog(self, userid):
        log = self.Log.aggregate([
                {'$match': {'userid': userid, 'removed': False}},
                {'$project': {'affected_tab_id': 1, 
                     'event': 1, 
                     'url': 1,
                     'timestamp_bson': 1, 
                     'taskname': {'$ifNull': ['$annotation.task.name', 'NA']},
                     'taskid': {'$ifNull': ['$annotation.task.taskid', 'NA']},
                     'title': {'$ifNull': ['$details.current_tab.title', 'NA']},
                     }}, 
                {'$sort':{'timestamp_bson': pymongo.ASCENDING}},
            ])
        return list(log)
        
    # Get the tasks of a user
    def getUserTasks(self, userid):
        tasks = self.UserTasks.find({'userid': userid})
        T = {} 
        for t in tasks:
            T[str(t['_id'])] = {'task_name': t['task'], 
                            'task_parent': t['parent_task'], 
                            'task_level': t['task_level']}
        return T 







