"""
Format data for R for GLM
"""
import simplejson as js

# thresh: first X mins user spend on a task
t_thresh = -1

inputfile = lambda x: '../output/variables_1st%smin.json'%x

TP_nodes = {
    'task_stage': 'STG',
    'task_collaboration': 'COL',
    'task_difficulty_subjective': 'DIF',
    'task_sailence_subjective': 'IMP',
    'task_frequency': 'FQ',
    'task_satisfaction': 'SAT',
    'task_knowledge_topic': 'KT',
    'task_complexity_objective': 'CL',
    'task_knowledge_procedure': 'KP',
    'task_complexity_subjective': 'COM',
    'task_length': 'TL',
    'task_urgency_subjective': 'UR'
}

UD_nodes = {
	'duration_time':'duration',
	'from_SERP_view': ('pageviewserp'),
#	'from_external_link':'Pageviews from link',
#	'from_omni_url':'Pageviews from URL navigation',
	'interruptions':'multitasking',
	'number_clicks': 'clicks',
	'number_pageview': 'pageviews',
	'number_q_before_c': 'qbc',
	'number_queries': 'queries',
	'number_revisits': 'pagerevisit',
	'number_unique_pageview': 'pageviewuniq',
	'query_similarity': 'qsim',
}

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


def print_data(TP, UD):
    prop1 = sorted(TP.keys())
    prop2 = sorted(UD_nodes.keys())

    tasks = UD[prop2[0]].keys()
    headers = ['taskid'] + [TP_nodes[p] for p in prop1] + [UD_nodes[p] for p in prop2]
    print ','.join(headers)

    for t in range(len(tasks)):
        task = tasks[t]
        row = []
        row.append(task)
        for p in prop1:
#            if p == 'task_satisfaction':
#                score = 1 if TP[p][task] > 3 else 0 
#                row.append(score)
#            else:
             row.append(TP[p][task])
        for p in prop2:
            row.append(UD[p][task]) 
        print ','.join([str(r) for r in row]) 


if __name__ == '__main__':
    f = open(inputfile(t_thresh))
    data = js.load(f)
    f.close()
        
    TP = data['task_properties']
    UD = prepare_user_data(data['user_data'])

    print_data(TP, UD)  










