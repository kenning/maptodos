
var currentMarker = null;

var markersArray = [];

var markerImgUrl = 'http://i.imgur.com/zNM7luw.png';

var taskListDep = new Deps.Dependency;
var locDep = new Deps.Dependency;





//Main 'initialize' function
Template.map.rendered = function() {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://maps.googleapis.com/maps/api/js?v=3.exp&' + 'libraries=places&'+'callback=window.initialize';
  document.body.appendChild(script);

  window.initialize = function() {
    var mapOptions = {
      center: {lat:  -34.397, lng: 150.644},
      zoom: 8
    };
    var map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

    //Establishes a decorator which:
    var initializeMarker = function(marker) {
      //Makes an event listener that, on click, 
      //centers the camera, finds an associated Location file, and sets currentMarker to that.
      google.maps.event.addListener(marker, 'click', function() {
        var position = {A:marker.getPosition().A, F:marker.getPosition().F};

        data = Locations.findOne({latLng:position});
        if(data){
          var infowindow = new google.maps.InfoWindow({
            content:  data['locationName']
          });          
          infowindow.open(map,marker);
        }
        map.setZoom(8);
        map.setCenter(marker.getPosition());

        currentMarker = marker;
      });

      markersArray.push(marker);
      
      locDep.changed();
      taskListDep.changed();
    }


    //Makes a new marker on clicking on the map
    google.maps.event.addListener(map, 'click', function (event) {
      var marker = new google.maps.Marker({
        position: event.latLng,
        map:map,
        icon: markerImgUrl
      });
      initializeMarker(marker);
      currentMarker = marker;
      console.log(currentMarker);
    });


    //Finds all locations and puts a pin in them
    var allLocations = Locations.find({}).fetch();
    for(var i = 0; i < allLocations.length; i++) {
      var ll = allLocations[i].latLng;
      var newMarker = new google.maps.Marker({
        position: {
          lat:parseFloat(ll.A),
          lng:parseFloat(ll.F)
        },
        map: map,
        icon: markerImgUrl
      });

      initializeMarker(newMarker);
      currentMarker = newMarker;
    }

  
    var allTasks = Tasks.find({}).fetch();
    var markersHaveTasksArray = new Array(markersArray.length);
    for(var i = 0; i < allTasks.length; i++) {
      for(var j = 0; j < markersArray.length; j++) {
        if(allTasks[i].latLng.A === markersArray[j].position.A &&
           allTasks[i].latLng.F === markersArray[j].position.F) {
          markersHaveTasksArray[j] = true;
        }
      }
    }
  }
}  





Template.body.helpers({
  tasks: function() {
    taskListDep.depend();

    var matchingPosition = {A:currentMarker.getPosition().A, F:currentMarker.getPosition().F};

    var matchingTasks = Tasks.find({latLng:matchingPosition}, {sort:{createdAt: -1}});

    return matchingTasks;
  },
  allTasks: function() {
    taskListDep.depend();

    return Tasks.find({}, {sort:{createdAt:-1}});
  },
  locationNamed: function() {
    locDep.depend();

    // if(!currentMarker) return false;
    var matchingPosition = {A:currentMarker.getPosition().A, F:currentMarker.getPosition().F}
    var doesLocationExist = !!Locations.findOne({latLng:matchingPosition});

    return doesLocationExist;
  },
  currentMarkerExists: function() {
    locDep.depend();

    return !!currentMarker;    
  }
});

Template.body.events({
  "submit .new-task":function(event){
    event.preventDefault()

    var text = event.target.text.value;

    var matchingPosition = {A:currentMarker.getPosition().A, F:currentMarker.getPosition().F};
    // var thisLocation = Locations.findOne({latLng:matchingPosition});

    var taskId = Tasks.insert({
      latLng: matchingPosition,
      text: text,
      checked:false,
    })

    event.target.text.value = "";

    taskListDep.changed();

    return false;
  },
  "submit .new-location":function(event){

    event.preventDefault();

    Locations.insert({
      locationName: event.target.text.value, 
      createdAt: new Date(), 
      latLng: currentMarker.getPosition()
    });

    event.target.text.value = "";

    locDep.changed();

    return false;
  }
});

Template.task.events({
  "click .toggle-checked":function() {
    Tasks.update(this._id, {$set:{checked: ! this.checked}});
    
    taskListDep.changed();
  },
  "click .delete": function(){
    Tasks.remove(this._id);

    //If there are no more tasks at this location, delete the pin
    var matchingPosition = {A:this.latLng.A, F:this.latLng.F};
    var allTheSameLocationTasks = Tasks.find({latLng:matchingPosition}).fetch();
    if(allTheSameLocationTasks.length === 0 ) {
      var thisLocation = Locations.findOne({latLng:matchingPosition})
      Locations.remove(thisLocation._id);
      locDep.changed();
      for(var i = 0; i < markersArray.length; i++) {
        matchingPosition = "(" + matchingPosition['A'] + ", " + matchingPosition['F'] + ")";

        if(markersArray[i].position.toString() === matchingPosition) {
          if(markersArray[i] === currentMarker) currentMarker = null;
          markersArray[i].setMap(null);
          markersArray.splice(i, 1);

          break;
        }
      }
    }
  },
  "click .task":function() {
    map.setCenter(this.latLng);
    taskListDep.changed();
  }
});
