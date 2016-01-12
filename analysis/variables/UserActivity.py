"""
Query stats:
- number of queries per task
- number of queries in the first task session (a substantial session that last longer
  than X mins)
- Patterns of query reformulations
"""
import itertools

class UserActivity(object):
    # Data contains tab groups, each tab group contains url groups
    def __init__(self, data, to_include, time_thresh, session_thresh):
        self.data = data
        self.T = to_include
        self.session_thresh = session_thresh

        self.user_path, self.user_path_stream = self.user_path(data)
        self.all_tasks = [e[0]['taskid'] for e in self.user_path_stream if e[0]['taskid'] in self.T]

        self.firstXmins = self.get_firstXmins(time_thresh)

    # Assign tab groups whether or not user is on that tab
    def user_path(self, data):
        user_path = []
        user_path_stream = []
        previous_on = 0
        for tab in data:
            tabid = tab['tabid']
            tab_group = tab['tab_group']
            on = False
            for urlg in tab_group:
                url = urlg['url']
                url_group = urlg['url_group']
                events = [e['event'] for e in url_group]
                # If there is a switch, then user comes to this tab
                if len([e for e in events if 'switch' in e])>0:
                    on = True
                    previous_on = tabid 
                    break
                # If the user has clicked something, then he should be on this tab
                elif len([e for e in events if 'link_click' in e])>0:
                    on = True
                    previous_on = tabid
                # This means the user has been staying the same tab, the tabs in between
                # are automatic events
                elif previous_on == tabid:
                    on = True
                    break 
                
            tab['on'] = on 
            for ug in tab_group:
                user_path.append((tab['tabid'], tab['on'], ug))
                for event in ug['url_group']:
                    user_path_stream.append((event, tab['on']))
        return user_path, user_path_stream

    # Get first X mins user has spent on a task
    # if time_thresh == -1, take all
    # for each tab-url group, if user is "on" the tab, then we count the time being
    # spent;
    # if user is not "on", then include the events, but doesn't count the time being
    # spent
    def get_firstXmins(self, time_thresh):
        i = 0
        T_X = dict([(t, ([], 0, False)) for t in self.all_tasks])
        for event, on in self.user_path_stream:
            task = event['taskid']
            if not task in self.T:
                i += 1
                continue

            tmp_stream, time, stop = T_X.get(task, ([], 0, False))
            # If this task has reached stop criterion, then skip it
            if stop:
                i += 1
                continue
            # if the user is not 'on' the tab-url, then don't count the time
            if on: 
                # Find the next "on" event to compute how long the user has stayed on
                # this tab-url after this event
                j = i + 1
                while j < len(self.user_path_stream):
                    next_event, next_on = self.user_path_stream[j]
                    if next_on:
                        d = (next_event['timestamp_bson']-event['timestamp_bson']).total_seconds()
                        # if it's an inactivity larger than the session thresh, then assume
                        # it's the end of a session, don't count the time
                        if d < self.session_thresh * 60:
                            if time_thresh == -1 or time + d <= time_thresh * 60:
                                tmp_stream.append(event) 
                                time += d
                            else:
                                stop = True
                        break 

                    j += 1
            else:
                tmp_stream.append(event)

            T_X[task] = (tmp_stream, time, stop)
            i += 1   

#        for task in T_X:
#            stream, time, stop = T_X[task]
#            print task, len(stream), time, time < time_thresh*60
        return T_X
           
        # Count number of queries within the first X mins
        def number_of_queries(self):    


     

    
