/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


var socket = io.connect(undefined, {'port': 8080, 'connect timeout': 1000});
var userMe = {id: undefined, username: undefined, room: {}};

// on connection to server, ask for user's name with an anonymous callback
socket.on('connect', function() {
  console.log("connect");
  // call the server-side function 'add user' and send one parameter (value of prompt)
  userMe.id = socket.socket.sessionid;
  console.log("Update VideoId");
  var continuing = true;
  var username = "";
  var errorMsg = "";
  while (continuing)
  {
    continuing = false;
    // var youtubeLink = $("#videoid").val();
    var username = prompt("Please enter your name. "+errorMsg, "John Doe");
    if (username !== null && username !== "")
    {
      // username is valid
      continuing = false;
    } else if (username === "") {
      continuing = true;
      errorMsg = "Cannot be blank.";
    } else {
      // Cancel
      username = "Guest";
      continuing = false;
    }
  }
  userMe.username = username;
  socket.emit('add user', userMe.username);
});

// listener, whenever the server emits 'update room', this updates the room features
socket.on('update room', function(data) {
  console.log("update room", data);
  // Update userMe
  userMe.room = data;
  // Update the room name
  $('#roomName').html(data.name);
  // Update the moderators list
  $("#moderators").html("Moderator(s): " + data.moderators.join(", "));
  if (
          userMe.room.moderators[0] === null // Lobby has null moderators and so anyone can edit.
          || $.inArray(userMe.id, data.moderators) !== -1)
  {
    var roomName = $("#roomName");
    roomName.attr("contenteditable", "true");
    roomName.bind('keyup', function(event) {
      var roomName = $("#roomName");
      // roomName.text( roomName.text().replace('\n',' ') );
      var newName = roomName.text();
      if (newName != "")
      {
        //if (!$("#roomName").is(":focus")) {
        var roomId = userMe.room.id;
        editRoom(roomId, {name: newName});
      }
    });
  }
  else
  {
    var roomName = $("#roomName");
    roomName.attr("contenteditable", "false");
    roomName.unbind('keyup');
  }
  // Clear last video container
  $('#screen').html("").css("display", "none");
  // Check if there is a video connected to this class
  if (data.screen.videoid !== null)
  {
    console.log("Displaying video for room " + data.name);
    // Display class YouTube video!
    $('#screen').css("display", "block").append('<iframe id="player" type="text/html" src="http://www.youtube.com/embed/' + data.screen.videoid + '?enablejsapi=1&autoplay=1&autohide=2" frameborder="0" allowfullscreen>');
  }
  else
    console.log("No video to display for room " + data.name);

  $('#conversation').html(""); // Clear conversation
  // Fill in conversation
  $.each(data.chat, function(key, convo) {
    console.log("convo:", convo);
    $('#conversation').append('<li><strong>' + convo.username + '</strong>: ' + convo.msg + '</li>');
  });

  resizePage();
  var convoBox = $('#conversation');
  convoBox.scrollTop(convoBox[0].scrollHeight);

});

// listener, whenever the server emits 'updatechat', this updates the chat body
socket.on('update chat', function(username, msg) {
  console.log("update chat", username, msg);
  //if (userMe.room.id == room.id) {
  var convoBox = $('#conversation');
  convoBox.append('<li><strong>' + username + '</strong>: ' + msg + '</li>');
  convoBox.scrollTop(convoBox[0].scrollHeight);
  //} else {
  //   console.log("Not in the correct room.");
  //}
});

// listener, whenever the server emits 'updaterooms', this updates the room the client is in
socket.on('update rooms list', function(rooms, current_room) {
  console.log('update rooms', rooms, current_room);
  if (current_room === undefined || current_room === null)
    current_room = userMe.room;
  else
    userMe.room = current_room; // Update userMe
  $('#rooms').empty();
  $.each(rooms, function(key, value) {
    console.log(key, value);
    if (value.id === current_room.id) {
      $('#rooms').append('<div class="room current">' + value.name + '</div>');
    }
    else {
      $('#rooms').append('<a href="#" onclick="switchRoom(' + value.id + ')"><div class="room">' + value.name + '</div></a>');
    }
  });
});

// A forced refresh request from the server
socket.on('push refresh', function(selector, newRoomid) {
  console.log("Push Refresh",selector,newRoomid);
  if (
          (selector.room.id !== undefined && selector.room.id === userMe.room.id)  // In select room
          || (selector.username !== undefined && selector.username === userMe.id) // Are select user
          )
  {
    // You have been selected to refresh.
    if (newRoomid !== undefined)
      switchRoom(newRoomid); // Update room.
    else
      switchRoom(userMe.room.id); // Update room.
  }
});

function switchRoom(roomId) {
  console.log("switch Room", roomId);
  socket.emit('switch Room', roomId);
}

function addRoom() {
  var roomName = prompt("Room name?");
  //var youtubeLink = prompt("YouTube URL. Leave blank for none.");
  //var youtubeVideoId = (youtubeLink != "")?youtubeId(youtubeLink):null;
  // socket.emit('add room', { name: roomName, videoid: youtubeVideoId } );
  if (roomName) // Check if roomName is valid
    socket.emit('add room', {name: roomName});
}

function removeRoom() {
  if (userMe.room.id !== 0) // Check if Lobby room 
    socket.emit('remove room', userMe.room.id);
  // User no longer belongs to a room.
  else
    alert("You cannot remove the Lobby room.");
  
  // Go to Lobby
  // switchRoom(0); // This is taken care of by the server-side
}

function editRoom(roomid, options) {
  socket.emit('edit room', roomid, options);
}


/*
 * @author       Rob W (http://stackoverflow.com/a/7513356/938089
 * @description  Executes function on a framed YouTube video (see previous link)
 *               For a full list of possible functions, see:
 *               http://code.google.com/apis/youtube/js_api_reference.html
 * @param String frame_id The id of (the div containing) the frame
 * @param String func     Desired function to call, eg. "playVideo"
 * @param Array  args     (optional) List of arguments to pass to function func*/
function callPlayer(frame_id, func, args) {
  if (window.jQuery && frame_id instanceof jQuery)
    frame_id = frame_id.get(0).id;
  var iframe = document.getElementById(frame_id);
  if (iframe && iframe.tagName.toUpperCase() != 'IFRAME') {
    iframe = iframe.getElementsByTagName('iframe')[0];
  }
  if (iframe) {
    // Frame exists, 
    iframe.contentWindow.postMessage(JSON.stringify({
      "event": "command",
      "func": func,
      "args": args || [],
      "id": frame_id
    }), "*");
  }
}


// Source: http://stackoverflow.com/a/3452617
function youtubeId(url) {
  if (url.indexOf("?") !== -1 && url.indexOf("v=") !== -1)
  {
    var video_id = url.split('?')[1].split('v=')[1];
    var ampersandPosition = video_id.indexOf('&');
    if (ampersandPosition !== -1) {
      video_id = video_id.substring(0, ampersandPosition);
    }
    return video_id;
  }
  else
    return undefined; // Not valid YouTube Link
}

// Source: http://stackoverflow.com/a/37687
function replaceURLWithHTMLLinks(text) {
  var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(exp, "<a href='$1' target='_blank'>$1</a>");
}

function toggleLights(state)
{
  var lightsLayer = $("#lightsLayer");
  lightsLayer.stop();
  if (state === 0)
  {
    // Turn Lights Off
    //$('body').stop().animate({backgroundColor: "#000"}, 500);
    //$('#toggleLights').attr('onclick', "toggleLights(1);");
    lightsLayer.show();
    lightsLayer.animate({opacity: 1.0}, 1000, function() {
      resizePage();
    });
    lightsLayer.bind('click', function() {
      toggleLights(1);
    });
    toggleRoomList(1);
  }
  else
  {
    // Turn Lights On
    //$('body').stop().animate({backgroundColor: "#fff"}, 500);
    //$('#toggleLights').attr('onclick', "toggleLights(0);");
    lightsLayer.animate({opacity: 0.0}, 500, function() {
      lightsLayer.hide();
      resizePage();
    });
    lightsLayer.unbind('click');
    toggleRoomList(0);
  }
  resizePage();
}

function toggleRoomList(state)
{
  var roomList = $("#roomList");
  if (state === 0)
  {
    // Is Closed => Open
    roomList.removeClass("closed").addClass("open");
    $("#toggleRoomList").unbind('click');
    $("#toggleRoomList").bind('click', function() {
      toggleRoomList(1);
    });
  }
  else
  {
    // Is Open => Close
    roomList.removeClass("open").addClass("closed");
    $("#toggleRoomList").unbind('click');
    $("#toggleRoomList").bind('click', function() {
      toggleRoomList(0);
    });
  }
  resizePage();
}


function updateVideoId()
{
  console.log("Update VideoId");
  var continuing = true;
  var errorMsg = "";
  while (continuing)
  {
    continuing = false;
    // var youtubeLink = $("#videoid").val();
    var youtubeLink = prompt("Enter the YouTube Link. Blank = Display No Video. " + errorMsg, "Example: http://www.youtube.com/watch?v=fES1tRiuqbU");
    errorMsg = "";
    if (youtubeLink !== null && youtubeLink !== "")
    {
      var youtubeVideoId = youtubeId(youtubeLink);
      if (youtubeVideoId !== undefined) // Check if found valid YouTube Id
      {
        editRoom(userMe.room.id, {screen: {videoid: youtubeVideoId}});
        continuing = false;
      } else {
        errorMsg = "Error: Invalid YouTube link. Please try again.";
        continuing = true;
      }
    } else if (youtubeLink === "") {
      editRoom(userMe.room.id, {screen: {videoid: null}});
      continuing = false;
    } else {
      // Cancel
      continuing = false;
    }
  }
}

// on load of page
$(function() {
  // when the client clicks SEND
  $('#sendMsg').click(function() {
    var message = $('#chatMsg').val();
    $('#chatMsg').val('');
    message = replaceURLWithHTMLLinks(message);
    // tell server to execute 'sendchat' and send along one parameter
    if (message != "") // If not blank message
      socket.emit('send chat', message);
  });

  // when the client hits ENTER on their keyboard
  $('#chatMsg').keypress(function(e) {
    if (e.which == 13) {
      $(this).blur();
      $('#sendMsg').focus().click();
      $('#chatMsg').focus();
    }
  });

  $("#toggleRoomList").bind('click', function() {
    toggleRoomList(1);
  });

  resizePage();
});


(function($, sr) {

  // debouncing function from John Hann
  // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
  var debounce = function(func, threshold, execAsap) {
    var timeout;

    return function debounced() {
      var obj = this, args = arguments;
      function delayed() {
        if (!execAsap)
          func.apply(obj, args);
        timeout = null;
      }
      ;

      if (timeout)
        clearTimeout(timeout);
      else if (execAsap)
        func.apply(obj, args);

      timeout = setTimeout(delayed, threshold || 100);
    };
  }
  // smartresize 
  jQuery.fn[sr] = function(fn) {
    return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr);
  };

})(jQuery, 'smartresize');


// usage:
$(window).smartresize(function() {
  // Resize the display thingy
  resizePage();
});

function resizePage() {
  console.log("Resizing Page")
  // Working variables
  var roomList = $("#roomList");
  var toggleRoomList = $("#toggleRoomList");
  var currRoom = $("#currentRoom");
  var convoBox = $("#conversation");
  var screen = $("#screen");
  var player = $("#player");
  // Dimensions
  // Window / Body
  var wWidth = $(window).width()
          - parseInt($("body").css('padding-left'))
          - parseInt($("body").css('padding-right'));

  var wHeight = $(window).height()
          - parseInt($("body").css('padding-top'))
          - parseInt($("body").css('padding-bottom'));
  // Room List
  var rLH = wHeight * 1.0;
  var rLW = wWidth * 0.2;
  if (roomList.hasClass("open")) // Check if opened
    rLW = (rLW > 200) ? (200) : (rLW < 120) ? (120) : rLW;
  else
    rLW = 1;
  // Current Room
  var cRH = wHeight;
  var cRW = wWidth
          - rLW
          - toggleRoomList.width();
  var roomHeaderHeight = 0
          + $('#roomName').height()
          + $('#moderators').height()
          + $('#modOptions').height();

  if ($("#lightsLayer").css("display") === "none")
  {
    // Lights are still on
    // Display normally

    // Screen / Video Player
    var sT = 0;
    var sW = cRW
            - parseInt(currRoom.css('padding-left'))
            - parseInt(currRoom.css('padding-right'));
    var sH = (cRH
            - roomHeaderHeight
            - parseInt(currRoom.css('padding-top'))
            - parseInt(currRoom.css('padding-bottom')))
            * 0.7;
    var sPT = 0;
    var sPR = 0;
    var sPB = 0;
    var sPL = 0;
    /*
     * // Used for positioning inside TV screen image.
     var sPT = sH * 0.023845;
     var sPR = sW * 0.019029;
     var sPB = sH * 0.268256338301;
     var sPL = sW * 0.022835;
     sH = sH - sPT - sPB;
     sW = sW - sPL - sPR;
     */
    // Conversation log box
    var cBT = 0;
    var cBH = cRH
            - roomHeaderHeight
            - $('#chatMsg').height()
            - $('#sendMsg').height()
            - parseInt(currRoom.css('padding-top'))
            - parseInt(currRoom.css('padding-bottom'))
            - ((screen.css('display') != 'none') ? (sH) : (0)
            );

  }
  else
  {
    // Lights are off
    // Maximize the screen and conversation box
    
    // Screen / Video Player
    var sT = -1*roomHeaderHeight 
            + $("#lightsLayer span").height();
    var sW = cRW
            - parseInt(currRoom.css('padding-left'))
            - parseInt(currRoom.css('padding-right'));
    var sH = (cRH
            - 0
            - parseInt(currRoom.css('padding-top'))
            - parseInt(currRoom.css('padding-bottom')))
            * 0.7;
    var sPT = 0;
    var sPR = 0;
    var sPB = 0;
    var sPL = 0;
    /*
     * // Used for positioning inside TV screen image.
     var sPT = sH * 0.023845;
     var sPR = sW * 0.019029;
     var sPB = sH * 0.268256338301;
     var sPL = sW * 0.022835;
     sH = sH - sPT - sPB;
     sW = sW - sPL - sPR;
     */
    // Conversation log box
    var cBT = -1*roomHeaderHeight 
            + $("#lightsLayer span").height();
    var cBH = cRH
            + 0
            - $('#chatMsg').height()
            - $('#sendMsg').height()
            - parseInt(currRoom.css('padding-top'))
            - parseInt(currRoom.css('padding-bottom'))
            - $("#lightsLayer span").height()
            - ((screen.css('display') != 'none') ? ( sH ) : ( 0 )
            );

  }

  // Stop previous animations
  roomList.stop();
  toggleRoomList.stop();
  currRoom.stop();
  convoBox.stop();
  screen.stop();
  // Animate CSS changes/resizes
  roomList.animate({
    height: rLH,
    width: rLW
  }, 100);
  toggleRoomList.animate({
    height: rLH,
  }, 100);
  currRoom.animate({
    height: cRH,
    width: cRW
  }, 100);
  convoBox.animate({
    top: cBT,
    height: cBH,
    width: sW
  }, 100);
  $("#chatMsg, #sendMsg").animate({
    top: cBT
  });
  screen.animate({
    top: sT,
    height: sH,
    width: sW,
    paddingTop: sPT,
    paddingRight: sPR,
    paddingBottom: sPB,
    paddingLeft: sPL
  }, 100);
  /*
   screen.animate({ 
   height: sH, 
   width: sW, 
   paddingTop: 0, 
   paddingRight: 0, 
   paddingBottom: 0, 
   paddingLeft:  0
   }, 100);
   player.animate({ 
   height: sH, 
   width: sW, 
   paddingTop: sPT, 
   paddingRight: sPR, 
   paddingBottom: sPB, 
   paddingLeft:  sPL
   }, 100);
   */
}