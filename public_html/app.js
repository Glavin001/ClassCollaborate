var express = require('express');
var app = express.createServer();
var io = require('socket.io').listen(app);
var path = require('path');
var $ = require('jquery');
// Custom external files
var mycommon = require('./common.js');

app.listen(8080);

// routing
app.use(express.static(path.join(__dirname, '')));

app.get('/', function(req, res) {
  console.log("app.get", req, res);
  var path = "/index.html";
  res.sendfile(__dirname + path);
});

// usernames which are currently connected to the chat
var usernames = {};
var rId = 0; // Stores the room id that increments for every new room added.

// rooms which are currently available in chat
var rooms = [
  {id: 0, name: 'Lobby', password: "", screen: { videoid: ""}, chat: [], moderators: ["Glavin"]},
  {id: 1, name: 'CSCI 4477 - Data Mining', password: "", screen: { videoid: 'fES1tRiuqbU'}, chat: [], moderators: ["Pawan Lingras"]},
  {id: 2, name: 'Test', password: "", screen: { videoid: null}, chat: [], moderators: ["Glavin"]}
];

io.sockets.on('connection', function(socket) {
  
  if (socket.sid === undefined || socket.sid === null) {
        socket.sid = socket.handshake.sessionID;
  }

  socket.emit('connected', { status: 'ok' });
  
  // when the user disconnects.. perform this
  socket.on('disconnect', function() {
    // remove the username from global usernames list
    delete usernames[socket.username];
    // update list of users in chat, client-side
    io.sockets.emit('update users', usernames);
    // echo globally that this client has left
    // socket.broadcast.emit('update chat', 'SERVER', socket.username + ' has disconnected');
    socket.leave(socket.room);
  });


// ====== Users

  // when the client emits 'adduser', this listens and executes
  socket.on('add user', function(username) {
    // store the username in the socket session for this client
    socket.username = username;
    // store the room name in the socket session for this client
    socket.room = rooms[0];
    // add the client's username to the global list
    usernames[username] = username;
    // send client to current room
    socket.join(socket.room);
    // update the client side display of current room
    socket.emit('update room', socket.room);
    // echo to client they've connected
    // socket.emit('update chat', "SERVER", 'you have connected to ' + socket.room.name);
    // echo to room 1 that a person has connected to their room
    //socket.broadcast.to(socket.room).emit('update chat', 'SERVER', username + ' has connected to this room');
    socket.emit('update rooms list', rooms, socket.room);

  });

// ====== Rooms

  socket.on('add room', function(newroom) {
    var id = (rId);
    // Verify id is unique
    while ( getObjects(rooms, 'id', id).length > 0 )
      id++;
    rId = id; // Update the rId for later use.
    newroom = { id: id, name: newroom.name, screen: { videoid: null }, chat: [], moderators: [socket.username] };
    rooms.push(newroom);
    socket.broadcast.emit('update rooms list', rooms, undefined);
    socket.emit('update rooms list', rooms, newroom);
    socket.emit('update room', newroom);
  });


  socket.on('remove room', function(roomid) {
    var index = getRoomIndex(roomid);
    rooms.remove(index);
    socket.emit('update rooms list', rooms, socket.room);
    socket.broadcast.emit('update rooms list', rooms, undefined);
  });
  
  socket.on('edit room', function(roomid, options) {
    console.log("edit room", roomid, options);
    var index = getRoomIndex(rooms, roomid);
    console.log("index", index);
    var forceRefresh = false;
    if (index >= 0)
    {
      if ($.inArray(socket.username, rooms[index].moderators) != -1)
      {
        if (options.name != undefined)
        {
          rooms[index].name = options.name;
        }
        if (options.screen != undefined && options.screen.videoid != undefined)
        {
          rooms[index].screen.videoid = options.screen.videoid;
          forceRefresh = true;
        }
        if (options.addModerator != undefined)
        {
          rooms[index].moderator.push(options.addModerator);
        }
        socket.emit('update rooms list', rooms, socket.room); // Send update back to same socket user
        socket.broadcast.emit('update rooms list', rooms, undefined);
        if (forceRefresh)
        {
          socket.emit('push refresh', {username: socket.username, room: socket.room});
          socket.broadcast.emit('push refresh', {username: socket.username, room: socket.room});
        }
      }
      else
        console.log("User " + socket.username + " does not have permission to edit room " + rooms[index].name + ".");
    }
    else
    {
      console.log("Index out of bounds:", index);
    }
  });
  
  socket.on('switch Room', function(newroomid) {
    var newroom = getRoom(newroomid);
    console.log("newroom:", newroom, newroomid, rooms);
    // leave the current room (stored in session)
    socket.leave(socket.room);
    // join new room, received as function parameter
    socket.join(newroom);
    //socket.emit('update chat', 'SERVER', 'You have connected to ' + newroom.name);
    // sent message to OLD room
    //socket.broadcast.to(socket.room).emit('update chat', 'SERVER', socket.username + ' has left this room');
    // update socket session room title
    socket.room = newroom;
    socket.emit('update room', socket.room);
    //socket.broadcast.to(newroom).emit('update chat', 'SERVER', socket.username + ' has joined this room');
    socket.emit('update rooms list', rooms, newroom);
    // update the client side display of current room
  });

  // when the client emits 'send chat', this listens and executes
  socket.on('send chat', function(data) {
    // we tell the client to execute 'updatechat' with 2 parameters
    io.sockets.in(socket.room).emit('update chat', socket.username, data, socket.room);
    // Add message to room chat log
    var roomIndex = getRoomIndex(rooms, socket.room.id);
    if ( roomIndex >= 0 )
      rooms[roomIndex].chat.push({username: socket.username, msg: data});
  });


  // Custom Helper Functions
  function getRoom(roomId) {
    return getObjects(rooms, 'id', roomId)[0];
  }

  function getRoomIndex(allRooms, id) {
    var i;
    for (i = 0; i < allRooms.length; i++)
    {
      if (allRooms[i].id == id)
      {
        return i; // Found room!
      }
    }
    return -1; // Did not find room
  }

  // Array Remove - By John Resig (MIT Licensed)
  // http://ejohn.org/blog/javascript-array-remove/
  Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
  };

  // Source: http://stackoverflow.com/a/4992429 
  function getObjects(obj, key, val) {
    var objects = [];
    for (var i in obj) {
      if (!obj.hasOwnProperty(i))
        continue;
      if (typeof obj[i] == 'object') {
        objects = objects.concat(getObjects(obj[i], key, val));
      } else if (i == key && obj[key] == val) {
        objects.push(obj);
      }
    }
    return objects;
  }

});