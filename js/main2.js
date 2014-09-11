'use strict';

var bc;

var $cmd;
var $msg;

$(init);

function init() {
	$cmd = $('#cmd');
	$msg = $('#msg');

	var options = {

	};
	bc = new BC(options);

	$('#cmd-form').submit(function(){
		var val = $cmd.val().trim();
		bc.sendCmd(val);
		$cmd.val('');
		return false;
	});
	bc.socket.on('cmd', receiveCmd);

	$('#msg-form').submit(function(){
		var val = $msg.val().trim();
		bc.sendMsg(val);
		$msg.val('');
		return false;
	});
	bc.socket.on('msg', receiveMsg);

	$('#room-form').submit(setRoom);

	// custom commands
	$('#container').on('click', '.cmd', function(ev){
		var $this = $(this);

		var cmd = $this.data('value');
		var cmdObj = {
			name: cmd,
			data: {
				value: null
			}
		};

		if (cmd == 'color') {
			cmdObj.data.value = $('#color-param').val();
		}

		bc.sendCmd(cmdObj);
	});
}

var commands = {
	'list': {
		description: 'list users',
		action: function(data){
			var $el = $('<div>').text(data.value);
			$('#cmds').prepend($el);
		}
	},
	'color': {
		description: 'change background color',
		action: function(data){
			console.log(data);
			$('body').css('background-color', data.value);
		}
	}
};

function receiveCmd(cmd) {
	var cmdName = _.isString(cmd) ? cmd : cmd.name;
	console.log('received command: ' + cmdName);

	if (_.isString(cmd)) {
		var $el = $('<div>').text(cmd);
		$('#cmds').prepend($el);
	} else {
		if (_.contains(_.keys(commands), cmdName)) {
			var _cmd = commands[cmdName];
			_cmd.action(cmd.data);
		} else {
			console.log('unknown command');
		}
	}
}

function receiveMsg(msg) {
	console.log('received message: ' + msg);
	var $el = $('<div>').text(msg);
	$('#msgs').prepend($el);
}

function setRoom(e) {
	e.preventDefault();

	var name = $('#room').val();
	if (name != '') {
		window.location.hash = '#'+name;
		bc.socket.emit('joinRoom', name);
	}

	return false;
}

