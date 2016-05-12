"""
Stats about tasks
 - task lengths
 - task sessions
 - task interruptions
"""
import itertools 

# inactivity threshold for split task sessions
class Tasks(object):
    def __init__(self, event_stream, tasks_to_include, session_thresh):
        self.events = event_stream
        self.T = tasks_to_include
        self.session_thresh = 30

    def get_task_lengths(self):
        T_length = {}
        T_length_day = {}
        tasks = [(d['taskid'], d['timestamp_bson']) for d in self.events if d['taskid'] in self.T]
        tasks.sort(key=lambda x: x[0])
        for k, g in itertools.groupby(tasks, lambda x: x[0]):
            g = sorted(list(g), key=lambda x: x[1])
            # Get task length
            T_length_day[k] = (g[-1][1] - g[0][1]).days + 1
            T_length[k] = (g[-1][1] - g[0][1]).total_seconds()
        return T_length_day


    # If there is a 30 mins inactivity, split the session
    # Ignore events lableled as "None" tasks:
    # - do not add them as individual sessions
    # - do not treat them as interrupting the current session if there is not an
    # inactivity > 30 mins 
    def get_task_sessions(self):
        data = self.events
        current_task = '' 
        session = []
        sessions = []
        i = 1
        while i > len(data):
            if not data[i]['taskid'] == 'None':
                current_task = data[i]['taskid']
                session = [data[i]]
            i += 1
        for e in data[1:]:
            inactive = (e['timestamp_bson'] - data[i-1]['timestamp_bson']).total_seconds()
            split = False
            split_type = ''
            # Inactivity > threshold, must split
            if inactive > self.session_thresh * 60:
                split = True
                split_type = 'time'
            # small gap, but task is changing   
            elif not e['taskid'] == current_task:
                # If the next task is None, ignore it unless the inactivity is above
                # threhold
                if not e['taskid'] == 'None':
                    split = True
                    split_type = 'task'
            # split
            if split:
                # do not add None task as individual sessions
                if len(session) > 0 and not current_task == 'None':
                    sessions.append((session))
                    session = []
                current_task = e['taskid']
            # add current event to session but ignore None task events
            if not e['taskid'] == 'None':
                session.append(e) 
            i += 1
        # Add last batch
        if len(session) > 0 and not current_task == 'None':
            sessions.append(session)
        """
        for s in sessions:
            time = (s[-1]['timestamp_bson'] - s[0]['timestamp_bson']).total_seconds()
            print s[0]['timestamp_bson'], set([xx['taskid'] for xx in s]), time
        """
        return sessions

    # count interruptions of each task, an interruption is counted when:
    # - user comes back to the task latter
    # - there is a gap larger than a threshold
    # - the interruption happens within a fixed period 
    # - If the interrupting task is None, don't count it (filtered in the
    # task_session already)
    def count_task_interruptions(self, task_sessions, gap_thresh, period):
        all_tasks = set([t['taskid'] for t in self.events if t['taskid'] in self.T])
        # ending session time of each task
        task_time = [(s[0]['taskid'], s[-1]['timestamp_bson']) for s in task_sessions]
        task_time.sort(key=lambda x: x[0])
        end_time = []
        for k, g in itertools.groupby(task_time, lambda x: x[0]):
            g = list(g)
            end_time.append((k, max([x[1] for x in g])))
        end_time = dict(end_time)

        T_sessions = {}
        i = 0
        for session in task_sessions:
            taskid = session[0]['taskid']
            tmp = T_sessions.get(taskid, [])
            # If the session is split over inactivity time gap, then no interruption
            # should be counted
            if i < len(task_sessions)-1:
                next_session = task_sessions[i+1] 
                no_interrupt = False 
                if (next_session[0]['timestamp_bson'] -session[-1]['timestamp_bson']).total_seconds() > self.session_thresh:
                    no_interrupt = True
            tmp.append((session, no_interrupt))
            T_sessions[taskid] = tmp
            i += 1

        interruption = dict([(t, 0) for t in all_tasks])
        for task in all_tasks:
            sessions = T_sessions[task]
            for i in range(len(sessions)):
                s, no_interrupt = sessions[i]
                if not no_interrupt:
                    # check if the user comes back
                    if i < len(sessions) - 1:
                        # check if the session is shorter than a fixed period
                        time = (s[-1]['timestamp_bson'] - s[0]['timestamp_bson']).total_seconds() < period * 60
                        if time:
                            # check if the interruption is longer than a threshold
                            next_session, no_interrupt = sessions[i+1]
                            gap = (next_session[0]['timestamp_bson']-s[-1]['timestamp_bson']).total_seconds()
                            if gap > gap_thresh:
                                interruption[task] += 1
        return interruption


