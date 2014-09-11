'use strict';

var _ = require('lodash');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var colors = require('colors');
var uuid = require('node-uuid');
var path = require('path');

var Room = require('./src/Room');

var PORT = process.env.PORT || 3000;

app.get('/', function(req, res){
	res.sendFile(path.join(__dirname, 'index.html'));
});

var rooms = {'global': {}};
var clients = {};
var num_users = 0;

io.on('connection', function(client){
	console.log('a user connected');

	var c = {
		name: 'user_no_'+num_users++,
		roomId: null,
		joined: new Date(),
		obj: client
	};

	clients[client.id] = c;
	console.log(clients);


	client.on('msg', _.bind(msgReceive, c));
	client.on('cmd', _.bind(cmdReceive, c));

	client.on('joinRoom', function(id){
		var roomExists = _.has(rooms, id);
		if (!roomExists) {
			console.log('create room: '.magenta + id);
			rooms[id] = new Room('room'+_.size(rooms), id);
		}

		if (clients[client.id].roomId)
			client.leave(clients[client.id].roomId);
		client.join(id);

		clients[client.id].roomId = id;
		
		console.log('set room: '.magenta + id);
		console.log(clients);
	});

	client.on('createRoom', function(name){
		var id = uuid.v4();
		var room = new Room(name, id);
		rooms[id] = room;
	});

	client.on('join', function(){
		console.log('user joined room');
	});
	client.on('leave', function(){
		console.log('user left room');
	});

	client.on('disconnect', function(){
		console.log('deleting client: ' + client.id);
		delete clients[client.id];
		console.log('user disconnected');
	});

	client.emit('msg', 'Welcome!');
});

// custom commands
var commands = {
	'list' : {
		desc: 'list active users', 
		action: function(req){
				var data = {};
				data.str = '['+_.keys(clients).join(',')+']';
				data.value = data.str;
				return data;
			}
		},
	'color': {
		desc: 'change color',
		action: function(req){
			var data = {};
			var color = req.value;
			data.value = color;
			data.str = data.value;
			return data;
		}
	}
};

var cmdReceive = function(cmd){
	var cmdName = _.isString(cmd) ? cmd : cmd.name;
	console.log('command received: '.yellow + cmdName);
	var ctx = this.roomId;

	if (_.isString(cmd)) {
		io.to(ctx).emit('cmd', cmd);
	} else {
		if (_.contains(_.keys(commands), cmdName)) {
			var _cmd = commands[cmdName];
			console.log('predefined command: '.yellow + cmdName + ': ' + _cmd.desc);

			console.log(cmd);
			var cmdObj = {
				name: cmd.name,
				data: _cmd.action(cmd.data)
			};

			console.log('emit command to: '.yellow + ctx);
			io.to(ctx).emit('cmd', cmdObj);
		}
	}
};

var msgReceive = function(msg){
	console.log('message received: '.cyan + msg);
	var ctx = this.roomId;

	console.log(this);

	console.log('emit message to: '.cyan + ctx);
	io.to(ctx).emit('msg', msg);
};


app.use(express.static(__dirname + ''));

http.listen(PORT, function(){
	console.log('listening on port: '+PORT);
});
