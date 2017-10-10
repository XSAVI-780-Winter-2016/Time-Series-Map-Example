// create a map in the "map" div, set the view to a given place and zoom

// add a Stamen terrain map
var stamenTerrain = new L.StamenTileLayer("terrain");

// create leaflet container and add basemaps
var map = new L.Map("map", {
	center: [42.9,-75.0],
	zoom: 7,
	minZoom: 5,
	maxZoom: 18,
	layers: [stamenTerrain]
});


//creating permenant big legend
var legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {

    var div = L.DomUtil.create('div', 'info legend');
    
    	div.innerHTML += 
    		'<b>SSO Discharge Treatment and Volume*</b><br />' +
    		'<svg class="left" width="22" height="18"><circle cx="10" cy="9" r="8" class="legendSvg1"/></svg><span>Untreated</span><br />' +
    		'<svg class="left" width="22" height="18"><circle cx="10" cy="9" r="8" class="legendSvg2"/></svg><span>Partially Treated Without Disinfection</span><br />' +
    		'<svg class="left" width="22" height="18"><circle cx="10" cy="9" r="8" class="legendSvg3"/></svg><span>Partially Treated With Disinfection</span><br />' +
    		'<svg class="left" width="22" height="18"><circle cx="10" cy="9" r="8" class="legendSvg4"/></svg><span>Other</span><br />' +
    		'<span>*<b>Larger</b> dots represent <b>larger</b> discharge volumes.</span><br />' + 
    		'<svg class="left" width="22" height="18"><path d = "m 2 2 L 18 2 L 10 16 L 2 2" class="legendSvg"/></svg><span>Triangles denote unknown discharge volume.</span><br /><br />' + 
    		'<b>Get the Data</b><br />' +
    		'<span><a href=\"data/ssoreports.csv\">Download SSO Reports (CSV)</a><br />' +
    		'<a href=\"ftp://ftp.dec.state.ny.us/dow/SSODischargeReports/Sewage_Discharge_Reports.xlsx\">Download SSO Reports from NYSDEC (XLSX)</a><br />' +
    		'</span><br />' +
    		'<b>Credits</b><a class=\"link\" href=\"http://nijel.org/\"><img src=\"css/images/NiJeL.png\" width=\"75\" height=\"75\" /></a><br />' +
    		'<span>Data from the <a href=\"http://www.dec.ny.gov/chemical/90321.html\">NYSDEC</a><br />' + 
    		'Rainfall data from <a href=\"http://www.wunderground.com/weather/api\">Weather Underground</a></span><br />';

    return div;
};

legend.addTo(map);

//creating links to data and time controls
function drawTimeControlLegend(filterMin, filterMax) {
	// create time strings
	var maxDateDay = filterMax.getDate();
	var maxDateMonth = filterMax.getMonth() + 1;
	var maxDateYear = filterMax.getFullYear();	
	var filterMaxDay = filterMax.getDate();
	var filterMaxMonth = filterMax.getMonth() + 1;
	var filterMaxYear = filterMax.getFullYear();	
	var filterMinDay = filterMin.getDate();
	var filterMinMonth = filterMin.getMonth() + 1;
	var filterMinYear = filterMin.getFullYear();	
	var maxDateString = maxDateMonth + "/" + maxDateDay + "/" + maxDateYear;
	var rangeString = "<b>" + filterMinMonth + "/" + filterMinDay + "/" + filterMinYear + "</b> through <b>" + filterMaxMonth + "/" + filterMaxDay + "/" + filterMaxYear + "</b>";
		
	var legend_data = L.control({position: 'bottomleft'});

	legend_data.onAdd = function (map) {

		var div = L.DomUtil.create('div', 'info legendmap');
		
			div.innerHTML += 
				'<b>Time Controls</b><br />' +
				'<span>Latest SSO Report: <b>' + maxDateString + '</b><br />' +
				'Date Range of SSO Reports Shown:<br />' + rangeString + '</span><br /><br />' + 
				'<b>Show SSO Discharges For:</b><br />' +				
				'<span><a onclick=\"setDates(1)\" href=\"javascript:void(0);\">Latest Week of Data</a><br />' +				
				'<a onclick=\"setDates(2)\" href=\"javascript:void(0);\">Latest Month of Data</a><br />' +				
				'<a onclick=\"setDates(3)\" href=\"javascript:void(0);\">All Data Available</a><br /></span>';
		return div;
	};

	legend_data.addTo(map);

}

// create control for geocoding
L.Control.geocoder().addTo(map);


// create a layer groups to catch the new markers
var dotsGroup = L.featureGroup();

// set dataset as global variable and empty
var dataset;

// use d3 to open process and scale csv data
d3.csv("data/ssoreports.csv", function(data) { 
	dataset = data;
	
	parseIntegers(dataset);
	parseDates(dataset);
	
	dateView = 2;
	drawDots(dataset, dateView);
	
});


function parseIntegers(dataset) {
	$.each(dataset, function( i, d ) {
		d.volume_gallons_int = parseInt(d.volume_gallons);
	});
}

function parseDates(dataset) {
	var dateTimeFormatSlash = d3.time.format("%Y/%m/%d %I:%M %p");
	var dateFormatSlash = d3.time.format("%x");

	var dateTimeFormat = d3.time.format("%m-%d-%y %I:%M %p");
	var dateFormat = d3.time.format("%m-%d-%y");

	$.each(dataset, function( i, d ) {
		if (d.discovery_date) {
			var discovery_date_string = d.discovery_date;
			var dateObject = dateTimeFormatSlash.parse(discovery_date_string);
			if (dateObject) {
				d.discovery_date_object = dateObject;
			} 
		}		

		if (d.ending_date_time) {
			var ending_date_time_string = d.ending_date_time;
			var dateObject = dateTimeFormatSlash.parse(ending_date_time_string);
			if (dateObject) {
				d.ending_date_time_object = dateObject;
			} 
		}		

		if (!d.expected_ending_date_time || d.expected_ending_date_time == 'Expected ending date of discharge not reported') {
		} else {
			var expected_ending_date_time_string = d.expected_ending_date_time;
			var dateObject = dateTimeFormatSlash.parse(expected_ending_date_time_string);
			if (!dateObject) {
				d.expected_ending_date_time_object = dateObject;
			} 
		}

	});
}

// function to set dates to new filterMin and filterMax, then initialize the map again.
function setDates(num) {
	dateView = num;
	drawDots(dataset, dateView);
} 


function drawDots(dataset, dateView) {

	//console.log(dataset);

    // load dataset into crossfilter 
	var cf = crossfilter(dataset);

	// set dimensions for filtering by sample date
	var bySampleDate = cf.dimension(function(d) { return d.discovery_date_object; });

	//console.log(bySampleDate);

	// default values for filterMin and filterMax
	var datadateMin = d3.min(dataset, function(d) { return d.discovery_date_object; });
	var datadateMax = d3.max(dataset, function(d) { return d.discovery_date_object; });
	var filterMax = datadateMax.clone();
	
	// set filterMin base on selection
	if (dateView == 1) {
		var filterMin = datadateMax.clone();
		filterMin.addDays(-7);
	} else if (dateView == 2){  
		var filterMin = datadateMax.clone();
		filterMin.addMonths(-1);
	} else if (dateView == 3) {
		var filterMin = datadateMin.clone();
	}	
		
	// initialize map and charts
	initialize_map(filterMin, filterMax, datadateMin, datadateMax, bySampleDate);
	
} // close drawMakers

	

function initialize_map(filterMin, filterMax, datadateMax, datadateMin, bySampleDate) {

	// clear all map layers	
	dotsGroup.clearLayers();

	// clear legend
	d3.select(".legendmap").remove();

	// pass date objects to the legend function
	drawTimeControlLegend(filterMin, filterMax);

	// filter data by data range selected
	bySampleDate.filterRange([filterMin, filterMax]);

	// return all data within the filter
	var dataBySampleDate = bySampleDate.top(Infinity);
	//console.log(dataBySampleDate);

	// iterate thorugh dataset and create a markers and a marker group for the points
	$.each(dataBySampleDate, function( i, d ) {
	
		if (!d.latitude || !d.longitude) {
		} else {

			// set dot fill color
	   		if (d.treated_state_of_discharge == "Untreated") {
	   			//If discharge is untreated
		   		dot_color = "#F03B20";
	   		} else if (d.treated_state_of_discharge == "Partially Treated Without Disinfection") {
	   			//If count is within the possible risk range
		   		dot_color = "#FEB24C";
	   		} else if (d.treated_state_of_discharge == "Partially Treated With Disinfection") {
	   			//If count is within the possible risk range
		   		dot_color = "#FFEDA0";
	   		} else {
	   			//If count is within the unacceptable range
		   		dot_color = "#BDBDBD";
	   		}

			// set d3 log scale for radius
			var rScale = d3.scale.log()
				.domain([1, d3.max(dataBySampleDate, function(d) { return d.volume_gallons_int; })])
				.rangeRound([5,30]);	
			
			var formatNumber = d3.format(",.0f");	

			if (!d.volume_gallons_int) {
				var discharge = "Unknown Number of Gallons";
				
				var dot = new L.RegularPolygonMarker(
					[d.latitude, d.longitude], {
						numberOfSides: 3,
						rotation: 90.0,
						radius: 10,
						color: 'black',
						weight: 1,
						fillColor: dot_color,
						fillOpacity: 0.5,
						clickable: true
				});
				
			} else {
				r = rScale(d.volume_gallons_int);
				var discharge = formatNumber(d.volume_gallons_int) + " Gallons";
				
				var dot = new L.CircleMarker(
					[d.latitude, d.longitude], {
						radius: r,
						color: 'black',
						weight: 1,
						fillColor: dot_color,
						fillOpacity: 0.5,
						clickable: true
				});

			}
		
			
				if (!d.closest_street_address && !d.city) {
					var gAddress = '<br />';
				} else if (!d.closest_street_address) {
					var gAddress = d.city + ', NY <br />';
				} else {
					var gAddress = d.closest_street_address + ', ' + d.city + ', NY <br />';
				}
			
				if (!d.explained_if_other) {
				} else {
					d.treated_state_of_discharge = d.treated_state_of_discharge + "; " + d.explained_if_other;
				}
			
				if (!d.discovery_date_object) {
				} else {
					var sday = d.discovery_date_object.getDate();
					var smonth = d.discovery_date_object.getMonth() + 1;
					var syear = d.discovery_date_object.getFullYear();
					var shours = d.discovery_date_object.getHours();
					var sminutes = d.discovery_date_object.getMinutes();
				
					if (sminutes < 10) {
						sminutes = "0" + sminutes;
					} else {}
				
					var discovery_date = "" + smonth + "/" + sday + "/" + syear + " " + shours + ":" + sminutes;
				}


			
			var popupContent = "<h3>" + discharge + " of Sewage Discharged into the " + d.receiving_water_body +"</h3><p><i>Location:</i> " + d.facility_name + "; " + gAddress + "<i>Treatment of Discharge:</i> <b>" + d.treated_state_of_discharge + "</b><br /><i>Date Discovered:</i> " + discovery_date + "<br /><i>Duration of Discharge (hours:minutes):</i> " + d.duration_hours_minutes + "<br /><i>Reason for Discharge:</i> " + d.reason_for_discharge + " " + d.other_explanation + "<br /><i>Corrective Actions:</i> " + d.corrective_actions + "</p>"; 
		
			var popupOptions = {
				minWidth: 50,
				maxWidth: 300,
				autoPanPadding: new L.Point(5, 60)
			}
							
			dot.bindPopup(popupContent, popupOptions);	

			dotsGroup.addLayer(dot);
			
		} // close if else for lat lon

	}) // close each
	
	// add dotsGroup to the map
	dotsGroup.addTo(map).bringToBack();

} // close initialize_map



// create layer switcher
var baseLayers = {
    "Stamen Terrain Map": stamenTerrain
};

var overlays = {
    "SSO Reports": dotsGroup,
};

L.control.layers(baseLayers, overlays).addTo(map);






