import simplejson as js
import plot_corr as pc
from scipy.stats import pearsonr, kendalltau
import pylab 
from sklearn.cluster import AffinityPropagation
import itertools
import numpy as np

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
	'duration':('Task duration', 9),
	'from_SERP_view': ('\\# Pageviews by search', 7),
#	'from_external_link':'Pageviews from link',
#	'from_omni_url':'Pageviews from URL navigation',
	'interruptions':('Multi-tasking', 8),
	'number_clicks': ('\\# Clicks', 4),
	'number_pageview': ('\\# Pageviews', 5),
	'number_q_before_c': ('\\# Queries before Click', 2),
	'number_queries': ('\\# Queries', 1),
	'number_revisits': ('\\# Pageview revisit', 8),
	'number_unique_pageview': ('\\# Pageviews uniq', 6),
	'query_similarity': ('Query similarity', 3),
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


def cluster_on_TP(TP, prop_labels):
    X = []

    d_labels = sorted(TP[prop_labels[0]].keys())
    for d in d_labels:
        row = []
        for p in prop_labels:
            row.append(TP[p][d])
        X.append(row)

    # cluster 
    af = AffinityPropagation(affinity='euclidean', verbose=True)
    labels = af.fit_predict(X)
    C = [(labels[i], d_labels[i]) for i in range(len(d_labels))]
    return C

def cluster_on_UD(UD):
    X = []
    prop_labels = UD.keys()
    d_labels = sorted(UD[prop_labels[0]].keys())
    docs = []
    for d in d_labels:
        row = []
        add = True
        for p in prop_labels:
            if UD[p][d] == None:
                add = False
                continue
            row.append(UD[p][d])
        if add:
            X.append(row)
            docs.append(d)

    af = AffinityPropagation(affinity='euclidean', verbose=True)
    labels = af.fit_predict(X)
    C = [(labels[i], docs[i]) for i in range(len(docs))]
    return C

def examine_clusters(C, TP):
    cluster_labels = [c[0] for c in C]
    for p in TP:
        V = [] 
        for c in range(max(cluster_labels)):
            cluster = list(itertools.ifilter(lambda x: x[0] == c, C))
            docs = [c[1] for c in cluster]
            values = [TP[p][d] for d in docs] 
            V.append(np.median(values))
        print p, V 

if __name__ == '__main__':
    f = open(inputfile(t_thresh))
    data = js.load(f)
    f.close()
        
    TP = data['task_properties']
    TP = dict([(TP_nodes[p], TP[p]) for p in TP])
    UD = prepare_user_data(data['user_data'])


    prop_labels = sorted(TP.keys())
    C = cluster_on_TP(TP, prop_labels)
    print [c[0] for c in C]

    C = cluster_on_UD(UD)
    print [c[0] for c in C]

    examine_clusters(C, TP)



