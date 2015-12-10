# Get all user tasks, prepare for manual analysis of task topic categorisation
import sys
sys.path.append('../db/')

from db import TaskLogDB
import itertools

db = TaskLogDB()


# Export everything about user defined tasks in the format of
# userid, taskname, subtasks, postQ_answers
def exportUserTasks(user):
    # Get postQ content
    postQ = {}
    if 'postQ' in user:
        postQ = user['postQ']['questionnaire']
 
    # Get all tasks
    T = db.getUserTasks(u['userid'])
    T = [(t, T[t]) for t in T]
    
    # Get all top level tasks
    level0 = dict(itertools.ifilter(lambda x: x[1]['task_level'] == 0, T))
 
    # Get all subtasks
    level1 = itertools.ifilter(lambda x: x[1]['task_level'] == 1, T)
    # Assign subtasks to their parents 
    for l in level1:
        parent = l[1]['task_parent']
        if 'subtasks' in level0[parent]:
            level0[parent]['subtasks'].append(l[1]['task_name'])
        else:
            level0[parent]['subtasks'] = [l[1]['task_name']]

  
    # Get postQ answers and print out tasks
    for tid in level0:
        t = level0[tid]
        line = [user['userid'], t['task_name']]
        if 'subtasks' in t:
            line.append('; '.join(t['subtasks']))
        else:
            line.append('NA')

        # If the task has a postQ answer
        if tid in postQ:
            line.append('Y')
            Q = postQ[tid]
            keys = sorted(Q.keys())
            line += [str(Q[k]) for k in keys]
        else:
            line.append('N')
        print '\t'.join(line)    
            

if __name__ == '__main__':
    users = db.getUsers()

    # print the header
    header = ['userid', 'task', 'subtasks', 'postQ']
    for u in users:
        if 'postQ' in u:
            for tid in u['postQ']['questionnaire']:
                keys = sorted(u['postQ']['questionnaire'][tid].keys())
                header += [k.replace('_', ' ') for k in keys]
                break
            break
    print '\t'.join(header)
 
    for u in users:
        exportUserTasks(u)


