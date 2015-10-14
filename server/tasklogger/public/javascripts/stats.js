/* Make plots of user activities for users to view */
var topX_tasks = 5;
var stats_data_url = '/users/get_stats_data';

google.load('visualization', '1', {packages: ['corechart', 'bar']});
google.setOnLoadCallback(plot_per_hour_activities());
google.setOnLoadCallback(plot_per_day_activities());
google.setOnLoadCallback(plot_task_per_hour());
google.setOnLoadCallback(plot_task_per_day());
google.setOnLoadCallback(plot_task_distribution());



$(document).ready(function(){
});


function plot_per_hour_activities(){
    $.ajax({
        type: "POST",
        url: stats_data_url,
        data: {"event": "per_hour_activities"}
    }).done(function(response){
        if (response.err){
            var e = '<h4>An error has occurd: </h4>' + response.emsg;
            $('#plot_search_hour').html(e);
        } 
        else{
            if (response.data.length == 0)
                $('#plot_search_hour')
                    .html('<h4 class="text-muted"><i>No data is available</i></span><h4>');
            else
                plot_search_hour(response.data);
        }
    });
}
function plot_per_day_activities(){
    $.ajax({
        type: "POST",
        url: stats_data_url,
        data: {"event": "per_day_activities"}
    }).done(function(response){
        if (response.err){
            var e = '<h4>An error has occurd: </h4>' + response.emsg;
            $('#plot_search_day').html(e);
        } 
        else{
            if (response.data.length == 0)
                $('#plot_search_day')
                    .html('<h4 class="text-muted"><i>No data is available</i></span><h4>');
            else
                plot_search_day(response.data);
        }
    });
}

function plot_task_per_hour(){
    $.ajax({
        type: "POST",
        url: stats_data_url,
        data: {"event": "per_hour_tasks", topX: topX_tasks}
    }).done(function(response){
        if (response.err){
            var e = '<h4>An error has occurd: </h4>' + response.emsg;
            $('#plot_task_hour').html(e);
        } 
        else{
            if (response.data.length == 0)
                $('#plot_task_hour')
                    .html('<h4 class="text-muted"><i>No data is available</i></span><h4>');
            else
                plot_task_hour(response.data);
        }
    });
}

function plot_task_per_day(){
    $.ajax({
        type: "POST",
        url: stats_data_url,
        data: {"event": "per_day_tasks", topX: topX_tasks}
    }).done(function(response){
        if (response.err){
            var e = '<h4>An error has occurd: </h4>' + response.emsg;
            $('#plot_task_day').html(e);
        } 
        else{
            if (response.data.length == 0)
                $('#plot_task_day')
                    .html('<h4 class="text-muted"><i>No data is available</i></span><h4>');
            else
                plot_task_day(response.data);
        }
    });
}

function plot_task_distribution(){
    $.ajax({
        type: "POST",
        url: stats_data_url,
        data: {"event": "task_distribution"}
    }).done(function(response){
        if (response.err){
            var e = '<h4>An error has occurd: </h4>' + response.emsg;
            $('#plot_task_distribution').html(e);
        } 
        else{
            if (response.data.length == 0)
                $('#plot_task_distribution')
                    .html('<h4 class="text-muted"><i>No data is available</i></span><h4>');
            else
                plot_task_activity_distribution(response.data);
        }
    });
}

function plot_search_hour(data){
    //Create column chart data format
    var stack_labels = ['Hour', 'Browsing', 'Search', {role: 'annotation'}],
        colors = ['#6599FF', '#FF9900'];

    var D = new google.visualization.DataTable();
    D.addColumn('number', 'Hour');
    D.addColumn('number', 'Browsing');
    D.addColumn('number', 'Search');

    //Initialise the actual data content 
    var rows = new Array(24) 
    var x_labels = []
    //Count how many days have data for each hour
    var count_days = new Array(24);
    for (var i = 0; i<24; i++){
        rows[i] = [i, 0, 0];
        if (i%2 == 0)
            x_labels.push(i);
        count_days[i] = {'search': [], 'browse': []}
    }

    //first column is for the X label (hour)
    //followed by count_browse, count_search
   for(var i = 0; i < data.length; i++){
        var hour = data[i]._id.hour;
        var day = data[i]._id.year +'_' +  data[i]._id.day;
        if (data[i]._id['event'] == 'tab-loaded'){
            rows[hour][1] += data[i].count;
            if (!count_days[hour].browse.indexOf(day) > -1) 
                count_days[hour].browse.push(day);
        }
        else {
            rows[hour][2] += data[i].count;
            if (!count_days[hour].search.indexOf(day) > -1) 
                count_days[hour].search.push(day);
        }
    }  
    //get the average
    for (var i = 0; i < rows.length; i++){
        if (count_days[i].browse.length > 0)
            rows[i][1] = rows[i][1]/count_days[i].browse.length;
        if (count_days[i].search.length > 0)
            rows[i][2] = rows[i][2]/count_days[i].search.length;
        D.addRow(rows[i])
    }
    var options = {
        width: 600,
        height: 300,
        legend: { position: 'top', maxLines: 3 },
        colors: colors,
        bar: { groupWidth: '75%' },
        isStacked: true,
        hAxis: {ticks: x_labels, 
                title: 'Hours',
                gridlines: {
                    color: '#fff',
                },
                baseline: -1,
            },
        vAxis: {
            title: 'Average number of search/browsing activities',
       }
    };
    var chart = new  google.visualization.ColumnChart(
            document.getElementById("plot_search_hour"));
    chart.draw(D, options);
}


function plot_search_day(data){
    //Create column chart data format
//    var stack_labels = ['Day', 'Browsing', 'Search', {role: 'annotation'}],
    var  colors = ['#6599FF', '#FF9900'];

    var D = new google.visualization.DataTable();
    D.addColumn('number', 'Day');
    D.addColumn('number', 'Browsing');
    D.addColumn('number', 'Search');
   
    var x_labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var ticks = [];
    var rows = new Array(8);
    rows[0] = [0, 0, 0]
    for (var i = 1; i < 8; i++){
        rows[i] = [i, 0, 0];
        ticks.push({'v': i, 'f': x_labels[i-1]})
    }
    for(var i = 0; i<data.length; i++){
        var day = data[i]._id.day;
        if (data[i]._id['event'] == 'tab-loaded'){
            rows[day][1] = data[i].count; 
        }
        else{
            rows[day][2] = data[i].count; 
        }
    } 
    D.addRows(rows);
    var options = {
        width: 450,
        height: 300,
        legend: { position: 'top', maxLines: 3 },
        colors: colors,
        bar: { groupWidth: '75%' },
        isStacked: true,
        hAxis: {ticks: ticks, 
                title: 'Day',
                gridlines: {
                    color: '#fff',
                },
            },
        vAxis: {
            title: 'Number of search/browsing activities',
       }
    };
    var chart = new  google.visualization.ColumnChart(
            document.getElementById("plot_search_day"));
    chart.draw(D, options);
}

//Data in the format of :
//[{id: {task: taskname, key: hour/day}, count: counts}]
function get_topX_tasks(data, key){
    //Get total counts of tasks, find top 5
    //Sort by task name
    data.sort(function(a, b){
        if(a._id.task < b._id.task) return -1;
        if(a._id.task > b._id.task) return 1;
        return 0
    })

    var task_counts = [];
    var current_task = '';
    var current_item = {};
    for(var i = 0; i<data.length; i++){
        if (current_task != data[i]._id.task){
            //Add previous one
            if (current_task != '')
                task_counts.push(current_item);
            //initialise the counts for current_task
            current_task = data[i]._id.task;
            current_item = {'task': current_task, 'count': 0, 'count_key': []};
            current_item[key] = [];
        }
        //Add the current item
        current_item.count += data[i].count;
        current_item[key].push(data[i]._id[key]);
        current_item.count_key.push(data[i].count);
    }
    task_counts.push(current_item);
    //Get top X 
    task_counts.sort(function(a, b){return b.count - a.count});
    var topX = task_counts.slice(0, topX_tasks);
    return topX;
}

function plot_task_hour(data){
    //prepare data for plot
    var topX = get_topX_tasks(data, 'hour');
    
    var D = new google.visualization.DataTable();
    D.addColumn('number', 'Hour');
    for(i = 0; i<topX.length; i++){
        D.addColumn('number', topX[i].task);
    }
    var rows = new Array(24) 
    var x_labels = []
    for (var i = 0; i<24; i++){
        rows[i] = new Array(topX.length + 1);
        rows[i][0] = i;
        for(var j = 1; j < topX.length+1; j++)
            rows[i][j] = 0;
        if (i%2 == 0)
            x_labels.push(i);
    }
    //first column is for the X label (hour)
    //followed by counts
    for(var i = 0; i < topX.length; i++){
        //for task i
        var hours = topX[i].hour;
        for(var j = 0; j<hours.length; j++){
            //counts for task i at row i + 1
            rows[hours[j]][i+1] = topX[i].count_key[j];
        }
    }
    D.addRows(rows); 

    var options = {
        width: 600,
        height: 300,
        legend: { position: 'top', maxLines: 3 },
        bar: { groupWidth: '75%' },
        isStacked: true,
        hAxis: {ticks: x_labels, 
                title: 'Hour',
                gridlines: {
                    color: '#fff',
                },
                baseline: -1,
            },
        vAxis: {
            title: 'Number of activities at this hour',
       }
    };
    var chart = new  google.visualization.ColumnChart(
            document.getElementById("plot_task_hour"));
    chart.draw(D, options);
}
 

function plot_task_day(data){
    //prepare data for plot
    var topX = get_topX_tasks(data, 'day');
    
    var D = new google.visualization.DataTable();
    D.addColumn('number', 'day');
    for(i = 0; i<topX.length; i++){
        D.addColumn('number', topX[i].task);
    }

    var x_labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var ticks = [];
    var rows = new Array(8);
    //Leave the first row to be all 0
    for (var i = 0; i < 8; i++){
        rows[i] = [i];
        for(var j = 0; j<topX.length; j++){
            rows[i].push(0)
        }
        if (i < 7)
            ticks.push({'v': i+1, 'f': x_labels[i]})
    }
    //Populate data
    for(var i = 0; i<topX.length; i++){
        var days = topX[i].day;
        var counts = topX[i].count_key;
        for(var j = 0; j<days.length; j++)
            rows[days[j]][i + 1] = counts[j];
    } 
    D.addRows(rows); 

    var options = {
        width: 450,
        height: 300,
        legend: { position: 'top', maxLines: 3 },
        bar: { groupWidth: '75%' },
        isStacked: true,
        hAxis: {ticks: ticks, 
                title: 'Day of Week',
                gridlines: {
                    color: '#fff',
                },
            },
        vAxis: {
            title: 'Number of activities on a day of week',
       }
    };
    var chart = new  google.visualization.ColumnChart(
            document.getElementById("plot_task_day"));
    chart.draw(D, options);
}

function plot_task_activity_distribution(data){
    data.sort(function(a, b){return b.count - a.count});
    var D = new google.visualization.DataTable();
    D.addColumn('string', 'task');
    D.addColumn('number', 'count');
    for(var i = 0; i<data.length; i++){
        D.addRow([data[i]._id.task, data[i].count]);
    }
    var options = {
        height: 500,
    }
    var chart = new google.visualization
        .PieChart(document.getElementById('plot_task_distribution'));

        chart.draw(D, options);

};





 
