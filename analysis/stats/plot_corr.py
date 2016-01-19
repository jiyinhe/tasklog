"""
Plot correlations between task properties
"""
import networkx as nx

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

# data should contain array of tuples:
# (prop1, prop2, tau, p)
def plot_corr_taskproperties(data):
    G = nx.Graph()
    # Get nodes
    nodes = list(set([d for sublist in data for d in sublist[0:2]]))
    nodes = [TP_nodes[n] for n in nodes] 
    G.add_nodes_from(nodes)

    # Edges
    e_pos = []
    weight_pos = []
    e_neg = []
    weight_neg = []
    edge_labels = {}
    for n1, n2, tau, p in data:
        n1 = TP_nodes[n1]
        n2 = TP_nodes[n2]
        # Only include edge if correlage is significant
        if p < 0.05:
            G.add_edge(n1, n2)
            if tau > 0:
                e_pos.append((n1, n2))
                weight_pos.append(tau*10)
            else:
                e_neg.append((n1, n2))
                weight_neg.append(tau*10*-1)
            edge_labels[(n1, n2)] = '%.2f'%tau 

    pos=nx.spring_layout(G, k=0.5, iterations=100, scale=8)

    nx.draw_networkx_nodes(G, pos, node_size=2000, node_color='w')
    nx.draw_networkx_edges(G, pos, edgelist=e_pos, width=weight_pos)
    nx.draw_networkx_edges(G, pos, edgelist=e_neg, width=weight_neg, style="dashed")
    nx.draw_networkx_labels(G,pos,font_size=16,font_family='sans-serif')
    nx.draw_networkx_edge_labels(G, pos, edge_labels)
    


