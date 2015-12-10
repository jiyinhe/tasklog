"""
Run the extraction of user patterns
"""

from TaskLabel import TaskLabel as tl
from db import TaskLogDB as db
import numpy as np

# Get connection to db
db = db()

# All user data
allUsers = db.getUsers()

def run():
    for u in allUsers:
        u_log = db.getUserLog(u['userid'])
        u_tasks = db.getUserTasks(u['userid'])
        u_tl = tl(u_log, u_tasks) 
        u_tl.assignSegmentLabels() 

 

if __name__ == '__main__':
    run()
