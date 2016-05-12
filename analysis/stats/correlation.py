"""
Compute correlations between variables
"""
import simplejson as js
import plot_corr as pc
from scipy.stats import pearsonr, kendalltau
import pylab 
from sklearn.cluster import AffinityPropagation

# thresh: first X mins user spend on a task
time_thresh = [-1]

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
#	'duration':'Task duration',
	'from_SERP_view': ('\\# Pageviews by search', 7),
#	'from_external_link':'Pageviews from link',
#	'from_omni_url':'Pageviews from URL navigation',
	'interruptions':'Multi-tasking',
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

# Correlation between task properties
def corr_task_properties(TP):
    C = []
    props = sorted(TP.keys())
    for i in range(len(props)-1):
        prop1 = props[i]
        tasks = sorted([t for t in TP[prop1]])
        X = [TP[prop1][t] for t in tasks]

        for j in range(i+1, len(props)):
            prop2 = props[j]
            Y = [TP[prop2][t] for t in tasks]
            tau, p = kendalltau(X, Y)            
            C.append((prop1, prop2, tau, p))  

    # Table print
    data = dict([((c[0], c[1]), (c[2], c[3])) for c in C])
    headers = sorted([(p, TP_nodes[p]) for p in props], key=lambda x: x[1])
    print '\\begin{tabular}{l',
    for i in range(len(props)):
        print 'r@{}l',
    print '}'

    # Multicolumn to align numbers with '.'
    for tp, name in headers:
        print '&', 
        print '\multicolumn{2}{c}{' + name + '}',
    print '\\\\'

    # Table rows
    for tp1, name1 in headers:
        # row header
        print name1, '&',
        i = 0
        for tp2, name2 in headers:
            # score
            if tp1 == tp2:
                print '-&-',
                if i < len(headers) - 1:
                    print '&',
            else:
                score = data.get((tp1, tp2))
                if score == None:
                    score = data.get((tp2, tp1))
                tau, p = score
                # prepare print out
                sign = ''
                if p < 0.01:
                    sign = '$^{**}$'
                elif p < 0.05:
                    sign = '$^{*}$' 

                score_p1, score_p2 = str('%.2f'%tau).split('.')
                # Format score for aligning '.'
                number = score_p1 + '.&' + score_p2
                # Add decoration for significance
                if p < 0.05:
                    score_p1 = '\\textbf{' + score_p1 + '.' + '}'
                    score_p2 = '\\textbf{' + score_p2 + '}'
                    number = score_p1 +'&' + score_p2 + sign
                print number,
                if i < len(headers)-1:
                    print '&',
            i += 1
        print '\\\\'
        print '%'

    print '\\end{tabular}'
    print
    print
    return C

# Correlation between task properties and user activities
def corr_task_properties_user_data(TP, UD):
    C = []
    T_props = sorted(TP.keys())
    U_props = sorted([(up, UD_nodes[up][0], UD_nodes[up][1]) 
        for up in UD_nodes], key=lambda x: x[2])

    # Header
    print '\\begin{tabular}{l',
    for i in range(len(T_props)):
        print 'r@{}l',
    print '}'  

    # Multicolumn to align numbers with '.'
    for tp in T_props:
        print '&', 
        print '\multicolumn{2}{c}{' + TP_nodes[tp] + '}',
    print '\\\\'

    for up, up_name, idx in U_props:
        tasks = sorted([t for t in UD[up]])
        X = [UD[up][t] for t in tasks if not UD[up][t] == None]

        # Activity header
        print up_name, '&',
        i = 0
        for tp in T_props:
            # for query similarities it may be none
            Y = [TP[tp][t] for t in tasks if not UD[up][t] == None]
            tau, p = kendalltau(X, Y)
            C.append((up, tp, tau, p))

            # prepare print out
            sign = ''
            if p < 0.01:
                sign = '$^{**}$'
            elif p < 0.05:
                sign = '$^{*}$' 

            score_p1, score_p2 = str('%.2f'%tau).split('.')
            # Format score for aligning '.'
            number = score_p1 + '.&' + score_p2
            # Add decoration for significance
            if p < 0.05:
                score_p1 = '\\textbf{' + score_p1 + '.' + '}'
                score_p2 = '\\textbf{' + score_p2 + '}'
                number = score_p1 +'&' + score_p2 + sign
            print number,
            if i < len(T_props)-1:
                print '&',
            i += 1
        print '\\\\'
        print '%'
    print '\\end{tabular}'
    return C


if __name__ == '__main__':

    for t_thresh in time_thresh:
        # load data
        f = open(inputfile(t_thresh))
        data = js.load(f)
        f.close()
        
        TP = data['task_properties']
        C_TP = corr_task_properties(TP)

        UD = prepare_user_data(data['user_data'])
        C_TPU = corr_task_properties_user_data(TP, UD) 


        # Run clustering
        af = AffinityPropagation(affinity='precomputed', verbose=True)
        x_label = sorted([p for p in TP])
        data = dict([((tp[0], tp[1]), (tp[2])) for tp in C_TP])
        X = []
        for x in x_label:
            row = []
            for y in x_label:
                if x == y:
                    sim = 1
                else:
                    sim = data.get((x, y))
                    if sim == None:
                        sim = data[(y, x)]
                row.append(abs(sim))      
            X.append(row)

        labels = af.fit_predict(X)
        print
        for l in range(len(x_label)):
            print TP_nodes[x_label[l]], labels[l]

        # positive correlation between task properties
#        pylab.figure()
#        pc.plot_corr_taskproperties(C_TP, 1)
#        pylab.axis('off')
    
        # negative correlation between task properties
#        pylab.figure()
#        pc.plot_corr_taskproperties(C_TP, -1)

#        pylab.axis('off')
#        pylab.show()
