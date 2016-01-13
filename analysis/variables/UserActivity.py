"""
Query stats:
- number of queries per task
- number of queries in the first task session (a substantial session that last longer
  than X mins)
- Patterns of query reformulations
"""
import itertools
import urllib
import re
# Only these search events are treated as issuing new queries
SETypes = ['tab-search-new', 'tab-search-verticle'] 

class UserActivity(object):
    # Data contains tab groups, each tab group contains url groups
    def __init__(self, data, to_include, time_thresh, session_thresh):
        self.data = data
        self.T = to_include
        self.session_thresh = session_thresh
        self.time_thresh = time_thresh

        self.user_path, self.user_path_stream = self.user_path(data)
        self.all_tasks = list(set([e[0]['taskid'] for e in self.user_path_stream if e[0]['taskid'] in self.T]))

        self.T_firstXmins = self.get_firstXmins(time_thresh)

        self.pageviews = self.pageViews()
        
    
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
            event['on'] = on
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
                        # it's the end of a session, don't count the time, just add
                        # the event
                        if d < self.session_thresh * 60:
                            if time_thresh == -1 or time + d <= time_thresh * 60:
                                tmp_stream.append((event, d)) 
                                time += d
                            else:
                                stop = True
                        break 

                    j += 1
            # If the user is not "on" the tab for the event, then add the event, but
            # don't count the time
            else:
                tmp_stream.append((event, 0))

            T_X[task] = (tmp_stream, time, stop)
            i += 1   

#        for task in T_X:
#            stream, time, stop = T_X[task]
#            print task, len(stream), time, time < 10*60
#            print task, [s[0]['event'] for s in stream]            
        return T_X
           
    # Count number of queries within the first X mins
    def number_of_queries(self):    
        T_Q = dict([(t, 0) for t in self.all_tasks])
        for task in T_Q:
            stream, time, stop = self.T_firstXmins[task]
            queries = list(itertools.ifilter(lambda x: x[0]['event'] in SETypes, stream))
            T_Q[task] = len(queries)
        
        return T_Q    

    # Count number of clicks within the first X mins
    def number_of_SERPclicks(self):
        T_C = dict([t, 0] for t in self.all_tasks)
        for task in T_C:
            stream, time, stop = self.T_firstXmins[task]
            clicks = list(itertools.ifilter(lambda x: x[0]['event'] =='link_click-SERP-result', stream))
            T_C[task] = len(clicks)
        return T_C 

   
    # Count number of queries before the first click  
    def number_of_QbC(self):
        T_QbC = dict([(t, 0) for t in self.all_tasks])
        for task in T_QbC:
            stream, time, stop = self.T_firstXmins[task]
            count = 0
            for e in stream:
                if e[0]['event'] == 'link_click-SERP-result':
                    break
                elif e[0]['event'] in SETypes:
                    count += 1
            T_QbC[task] = count
        
        return T_QbC

    # Query similarities within the first X mins of a task
    def query_similarity(self):
        T_QP = {}
        for task in self.all_tasks:
            stream, time, stop = self.T_firstXmins[task]
            pattern = []
            queries = list(itertools.ifilter(lambda x: x[0]['event'] in SETypes, stream))
            # Get all queries for the task
            Q = [urllib.unquote_plus(q[0]['details']['query']).split(' ') for q in queries]
            sim = []
            for i in range(len(Q)):
                for j in range(i+1, len(Q)):
                    # Jaccard similarity
                    overlap = set(Q[i]).intersection(set(Q[j]))
                    total_terms = set(Q[i]).union(set(Q[j])) 
                    if len(total_terms)> 0:
                        score = float(len(overlap))/float(len(total_terms))
                        sim.append(score) 

            s = 0
            if len(sim) > 0:
                s = sum(sim)/len(sim)
                T_QP[task] = s
            #else:
            #    if len(Q) == 0:
            #        T_QP[task] = 0
            #    elif len(Q) == 1:
            #        T_QP[task] = 1

        return T_QP 

    # Get pageview dwell time and page load source
    # for sources, get 3 types of sources:
    # - via external links
    # - via omni_url
    # - via SERP
    # ignore other types of sources, e.g., internal links, bookmarks, etc.
    def pageViews(self):
        pv = {}
        for task in self.all_tasks:
            stream, time, stop = self.T_firstXmins[task]

            url_group = []
            current_url = '^'
            ug = []           
            for e, duration in stream:
                if not e['url'] == current_url:
                    if not current_url == '^':
                        url_clean = self.clean_url(current_url)
                        ug.append({'url': current_url, 
                                'group': url_group,
                                'url_clean': url_clean})
                        url_group = []
                    current_url = e['url'] 
                url_clean = self.clean_url(current_url)
                url_group.append((e, duration))

            url_clean = self.clean_url(current_url)
            ug.append({'url': current_url, 
                'group': url_group,
                'url_clean': url_clean})

            i = 0
            for g in ug: 
                url = g['url']
                group = g['group']
                url_clean = g['url_clean']

                # add source
                if g.get('source', '') == '':
                    g['source'] = 'other'

                # dwell time
                dwell = sum([d[1] for d in group if d[0]['on']])
                g['dwell'] = dwell

                # If the page is a SERP, then the source is 'search'
                if self.check_serp(url):
                    g['source'] = 'search'
                
                # If there is link-click (on SERP or on an external link of a page), 
                # or omni_url
                # action on this page, find the target page
                # and mark its source as link-click (SERP or external) or omni_url
                sources = list(itertools.ifilter(lambda x: x[0]['event'] in
                            ['link_click-SERP-result', 
                                'link_click-external',
                                'navigation-omni_url'
                            ], group))
                for s, on in sources:
                    target = s['url']
                    if 'link_click' in s['event']:
                        target = s['details'].get('link_data', {}).get('url', 'None')
                        # for SERPs target url sometimes is part of the linked url
                        if s['event'] == 'link_click-SERP-result':
                            if 'url=' in target:
                                target = urllib.unquote(target.split('url=')[1].split('&')[0])
                    # Find the target page
                    for j in range(i, len(ug)):
                        next_url = ug[j]['url']
                        next_url_clean = ug[j]['url_clean']
                        if next_url == target or next_url_clean == target:
                            ug[j]['source'] = s['event']
                            break
                    # sometimes there is no target page, it could be that the user
                    # does a new search/forward-backward before the target page gets
                    # loaded
                i += 1 
            pv[task] = ug   
            tmp = [u for u in ug if u['source'] == 'link_click-external']
            tmp2 = [u for u in ug if u['source'] == 'link_click-SERP-result']
        return pv     
    

    def pageview_stats(self, pv_thresh):
        stats = {}
        for task in self.pageviews:
            pvs = []
            ug = self.pageviews[task]
            tmp = [u for u in ug if 'link_click' in u['source']]
            for u in ug:
                # - skip those have a dwell time lower than x seconds -- too short to
                # read anything
                # - skip SERP and pages with empty url
                if u['url'] == '' or u['source'] == 'search' or u['dwell'] < pv_thresh:
                    continue
                pvs.append(u) 

            urls = [x['url'] for x in pvs]
            sources = [x['source'] for x in pvs]
            # Total number of page views
            stats[task] = {
                    'total_pv': len(urls),
                    'unique_pv': len(set(urls)),
                    'revisits': len(urls) - len(set(urls)),
                    'from_SERP': len([s for s in sources if 'SERP' in s]),
                    'from_external_link': len([s for s in sources if 'external' in s]),
                    'from_omni': len([s for s in sources if 'omni' in s])
                } 
        return stats
 
    def check_url_source(self, url, SERP_url, link_url, internal_url, omni_url):
        if self.check_serp(url):
            return 'serp'
        elif url in omni_url:
            return 'nav'
        #elif url  
        else:
            return 'other'

    def check_serp(self, url):
        google_reg = re.compile('.+?\.google\..+?q=.+')
        yahoo_reg = re.compile('.+?\.search\.yahoo\..+?p=.+')
        bing_reg = re.compile('.+?\.bing\..+?q=.+')
        # This may involve other service of google/bing, but it's not a big problem for
        # now
        if len(google_reg.findall(url)) > 0 or \
            len(yahoo_reg.findall(url)) > 0 or \
            len(bing_reg.findall(url)) > 0:
            return True
        else:
            return False

    def clean_url(self, url):
        if not '#' in url:
            return url

        # do not clean SERP urls
        if not self.check_serp(url):
            strs = url.split('#')
            # gmail has '#' in the middle of the url, different emails are treated as
            # different sections
            if '/' in strs[1]:
                return url
            else:
                return strs[0]
        else:
            return url


