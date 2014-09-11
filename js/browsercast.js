'use strict';

function BC(options) {
	this.options = options || {};

	this.init(options);
}

BC.prototype.init = function(options) {
	this.socket = io();

	var hash = window.location.hash.substr(1);
	if (hash == '') {
		hash = 'room'+Math.round(Math.random()*1000);
		window.location.hash = hash;
	}

	this.setRoom(hash);
};

BC.prototype.setRoom = function(name) {
	this.socket.emit('joinRoom', name);
};

BC.prototype.sendCmd = function(cmd) {
	if (cmd == '') return;
	console.log('sending command: ' + cmd);
	this.socket.emit('cmd', cmd);
};

BC.prototype.sendMsg = function(msg) {
	if (msg == '') return;
	console.log('sending message: ' + msg);
	this.socket.emit('msg', msg);
};

BC.prototype.destroy = function() {
	this.socket = null;
};
