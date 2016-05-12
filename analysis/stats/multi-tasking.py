"""
Stats of multi-tasking behaviour of users
- per user
- per task
"""
import simplejson as js
import numpy as np
import pylab
import scipy.stats.stats as st

import matplotlib
matplotlib.rcParams.update({'font.size': 20})
matplotlib.rcParams['pdf.fonttype'] = 42
matplotlib.rcParams['ps.fonttype'] = 42

outputdir="plots/"

# thresh: first X mins user spend on a task
inputfile = lambda x: '../output/variables_1st%smin_alltask.json'%x

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

def multi_tasking_tasks(data):
    interrupt = data['interruptions']
    I = [interrupt[i] for i in interrupt]
    multi = [x for x in I if x > 0]
    print
    print 'percentage of task with multi-tasking:', len(multi)/float(len(I)) 



def multi_tasking_user(data):
    T = []
    G = []
    for u in data:
        u_data = data[u]
        taskids = [x['taskid'] for x in u_data]
        interruptions = [x['interruptions'] for x in u_data]
        median = np.median(interruptions)
        G.append((median, interruptions))
        T.append(len(taskids))
#    print len(set(T))

    G.sort(key=lambda x: x[0])
    G = [g[1] for g in G]
    print len(G)
    # Kruskal-Wallis H-test (non-parametric ANOVA)
    h, p = st.kruskal(G[0], G[1], G[2], G[3], G[4], G[5], G[6], G[7], G[8], G[9],
        G[10], G[11], G[12], G[13], G[14], G[15], G[16], G[17], G[18], G[19])
    print 'Krusdal-Wallis H-test for difference between levels of multi-tasking of users'
    print 'H:', h, 'p-value:', p


    # boxplot
    pylab.figure()
    prop = {'linewidth': 2}
    flierprops = {'markersize': 10}
    pylab.boxplot(G, boxprops=prop, medianprops=prop, flierprops = flierprops)
    pylab.xlabel('Users')
    pylab.tight_layout()
    pylab.savefig(outputdir+'/multi_tasking_users.png')
 
if __name__ == '__main__':
    t_thresh = -1
    # load data
    f = open(inputfile(t_thresh))
    data = js.load(f)
    f.close()

    multi_tasking_user(data['user_data'])

    UD = prepare_user_data(data['user_data'])
    multi_tasking_tasks(UD)
    pylab.show()
 
