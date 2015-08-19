/* Admins querying the log records at /logpeek*/

$(document).ready(function(){
    //enable datepicker 1
    $('#from').datepicker({
        format: 'mm/dd/yyyy',
        startDate: '08/01/2015',
        endDate: '12/31/2015',
        orientation: 'top', 
        
    }).on('changeDate', function(){
        //change the starting date of picker 2
        $('#to').datepicker('setStartDate', $('#from').val());
    });

    //enable datepicker 2
    $('#to').datepicker({
        format: 'mm/dd/yyyy',
        startDate: '08/01/2015',
        endDate: '12/31/2015',
        orientation: 'top', 
        
    }).on('changeDate', function(){
        $('#from').datepicker('setEndDate', $('#to').val());
    });


    //submit query to DB to retrieve records
    $("#querylog").click(function(){
        //Get the local time, may need to convert to UTC time
        //but we probably don't care
        var defaultStart = new Date(2015, 7, 1, 0, 0, 0, 0)
        var defaultEnd = new Date(2015, 11, 31, 23, 59, 59, 0)

        if($('#from').val()=== '')
            $('#fromdate').val(defaultStart.getTime());
        else{
            var from = $('#from').datepicker('getDate').getTime();
            $('#fromdate').val(from);
        }

        if($('#to').val() === '')
            $('#todate').val(defaultEnd.getTime());
        else{
            var to = new Date($('#to').datepicker('getDate'));
            //set To to the end of the selected day
            to = new Date(to.getTime() + 24*60*60000-1).getTime();
            $('#todate').val(to);
        }
        $('#queryform').submit();
    });
});




