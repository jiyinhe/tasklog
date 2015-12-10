"""
This class extrapolate the task labels from anchor 
events to all events in the log
"""

class TaskLabel(object):
    
    # Input: 
    # log - the raw log of a participant
    # tasks - the task relations of the participant
    def __init__(self, log, tasks):
        self.log = log
        self.tasks = tasks
        # Set a 5 mins time gap threshold for grouping events with same tabid and
        # urls
        self.time_gap_thresh = 5       

    # Segment log based on tab-id and url 
    # - Assumption: consecutive events with the same tabid and url belong to the 
    # same task 
    # - If the consecutive events with the same tabid and url has a time gap larger
    # than 5 mins, we split them into two groups.  
    # - If user has explicitly labelled events to different tasks, then split it
    # 
    # It does not necessarily mean that they belong to the same tasks, as the two
    # groups may have the same task label after all.   See some analysis in
    # SearchPattern.ipynb
    def segmentTabURL(self):
        groups = []
        current_l = self.log[0]
        group = [current_l]
        for l in self.log[1:]:
            time_gap = (l['timestamp_bson'] - current_l['timestamp_bson']).total_seconds()/60
            if not (l['url'] == current_l['url']
                or l['affected_tab_id'] == current_l['affected_tab_id']
                ):
                    groups.append(group)
                    group = []
            # If it's same tab and url, but time_gap is large
            elif time_gap > self.time_gap_thresh:
                    groups.append(group)
                    group = []
            current_l = l
            group.append(current_l)
        groups.append(group)
        return groups 


    # Pass 1: within the same TAB-URL group, get the label if there is one
    def assignSegmentLabels(self):
        groups = self.segmentTabURL()
        for g in groups: 
            labels = list(set([x['taskid'] for x in g]))
            if 'NA' in labels:
                labels.remove('NA')
            if len(labels) > 1:
                print [x['event'] for x in g], labels
        



