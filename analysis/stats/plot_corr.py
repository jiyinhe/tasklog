"""
Plot correlations between task properties
"""
import networkx as nx
import simplejson as js
from scipy.stats import kendalltau
import pylab

# task property node names
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

# thresh: first X mins user spend on a task
t_thresh = -1

inputfile = lambda x: '../output/variables_1st%smin.json'%x


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
            C.append(((TP_nodes[prop1], TP_nodes[prop2]), (tau, p)))
    return dict(C)


# data should contain array of tuples:
# (prop1, prop2, tau, p)
# sign: plot positive (1) or negative (-1)
def plot_corr_taskproperties(data, sign):
    G = nx.Graph()
    # Get nodes
#    nodes = list(set([d for sublist in data for d in sublist[0:2]]))
#    nodes = [TP_nodes[n] for n in nodes] 
#    G.add_nodes_from(nodes)

    # Edges
    e = []
    weight = []
    edge_labels = {}
    nodes = []
    for n1, n2, tau, p in data:
        n1 = TP_nodes[n1]
        n2 = TP_nodes[n2]
        # Only include edge if correlage is significant
        if p < 0.01:
            G.add_edge(n1, n2)
            nodes += [n1, n2]
            if tau > 0 and sign > 0:
                e.append((n1, n2))
                weight.append(tau*10)
                edge_labels[(n1, n2)] = '%.2f'%tau 

            elif tau < 0 and sign < 0:
                e.append((n1, n2))
                weight.append(tau*10*-1)
                edge_labels[(n1, n2)] = '%.2f'%tau 

    pos=nx.spring_layout(G, k=0.5, iterations=100, scale=8)

    nodes = list(set(nodes))
    G.add_nodes_from(nodes)

    nx.draw_networkx_nodes(G, pos, node_size=2000, node_color='w')
    nx.draw_networkx_labels(G, pos,font_size=16,font_family='sans-serif')
    if sign > 0:
        nx.draw_networkx_edges(G, pos, edgelist=e, width=weight)
    else:
        nx.draw_networkx_edges(G, pos, edgelist=e, width=weight, style="dashed")
    nx.draw_networkx_edge_labels(G, pos, edge_labels)
    
# Plot correlations between a group of variables
def plot_group(group, TP_C):
    G = nx.Graph()
    # Nodes
    G.add_nodes_from(group)

    # Edges
    edge_labels = {}
    weight_pos = []
    weight_neg = []
    e_pos = []
    e_neg = []
    for g in TP_C:
        if not (g[0] in group and g[1] in group):
            continue
        n1 = g[0]
        n2 = g[1]
        tau, p = TP_C[g]

        # Only include edge if correlage is significant
        if p < 0.05:
            G.add_edge(n1, n2)
            if tau > 0:
                e_pos.append((n1, n2))
                weight_pos.append(tau*15)
                edge_labels[(n1, n2)] = '%.2f'%tau 

            elif tau < 0:
                e_neg.append((n1, n2))
                weight_neg.append(tau*15*-1)
                edge_labels[(n1, n2)] = '%.2f'%tau 

    pos=nx.spring_layout(G, k=0.5, iterations=300, scale=10)

    nx.draw_networkx_nodes(G, pos, node_size=3000, node_color='w')
    nx.draw_networkx_labels(G, pos, font_size=22, font_family='sans-serif')
    nx.draw_networkx_edges(G, pos, edgelist=e_pos, width=weight_pos)
    nx.draw_networkx_edges(G, pos, edgelist=e_neg, width=weight_neg, style="dashed")
#    nx.draw_networkx_edge_labels(G, pos, edge_labels, font_size=14)
    

def plot_between_group(group1, group2, TP_C):
    G = nx.Graph()
    G.add_nodes_from(group1 + group2)

    # Edges
    edge_labels = {}
    weight_pos = []
    weight_neg = []
    e_pos = []
    e_neg = []
    for g in TP_C:
        add = False
        if (g[0] in group1 and g[1] in group2):
            add = True
        elif (g[0] in group2 and g[1] in group1):
            add = True
        if not add:
            continue

        n1 = g[0]
        n2 = g[1]
        tau, p = TP_C[g]

        # Only include edge if correlage is significant
        if p < 0.05:
            G.add_edge(n1, n2)
            if tau > 0:
                e_pos.append((n1, n2))
                weight_pos.append(tau*15)
                edge_labels[(n1, n2)] = '%.2f'%tau 

            elif tau < 0:
                e_neg.append((n1, n2))
                weight_neg.append(tau*15*-1)
                edge_labels[(n1, n2)] = '%.2f'%tau 

    colors = ['w' if node in group1 else '#A9D0F5' for node in G.nodes()]
    pos=nx.spring_layout(G, k=0.5, iterations=200, scale=10)

    nx.draw_networkx_nodes(G, pos,  node_size=3000, node_color=colors)
 
    nx.draw_networkx_labels(G, pos, font_size=22, font_family='sans-serif')

    nx.draw_networkx_edges(G, pos, edgelist=e_pos, width=weight_pos)
    nx.draw_networkx_edges(G, pos, edgelist=e_neg, width=weight_neg, style="dashed")
#    nx.draw_networkx_edge_labels(G, pos, edge_labels, font_size=14)
 


if __name__ == '__main__':
    # load data
    f = open(inputfile(t_thresh))
    data = js.load(f)
    f.close()
        
    TP = data['task_properties']
    C_TP = corr_task_properties(TP)

    # Plot group 1: CL, COM, DIF, TL, SAT
    pylab.figure()
    group1 = ['CL', 'COM', 'DIF', 'TL', 'SAT']
    group2 = ['COL', 'KT', 'KP']
    group3 = ['IMP', 'STG', 'UR']

#    plot_group(group1, C_TP)  
#    filename = 'plots/group_%s.png'%(''.join([x[0] for x in group]))

   
    g1 = group2
    g2 = group3
    plot_between_group(g1, g2, C_TP)     

    filename = 'plots/group_%s_%s.png'%(''.join([x[0] for x in g1]),
            ''.join([x[0] for x in g2]))  

    pylab.axis('off')
    pylab.savefig(filename)

    pylab.show()



