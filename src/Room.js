'use strict';

var Room = function(name, id, options){
	this.users = [];
	this.name = name;
	this.id = id;
	this.options = options || {};
	this.status = 'available';
};

Room.prototype.addUser = function(user){
	if (this.status === 'available'){
		this.users.push(user);
	}
};

Room.prototype.destroy = function(){

};

module.exports = Room;