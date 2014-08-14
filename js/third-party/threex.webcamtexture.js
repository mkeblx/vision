var THREEx = THREEx || {}

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

THREEx.WebcamTexture = function(options){

	var video	= document.createElement('video');
	video.id = 'vid-src';
	video.width	= 320;
	video.height = 240;
	video.autoplay = true;
	video.loop = true;

	//document.body.appendChild(video);

	this.video = video;

	var texture	= new THREE.Texture( video );
	this.texture = texture;

	this.update	= function(delta, now){
		if( video.readyState !== video.HAVE_ENOUGH_DATA )	return;
		texture.needsUpdate	= true;		
	}

	this.successCallback = function(stream) {
	  window.stream = stream;
	  video.src = window.URL.createObjectURL(stream);
	}

	this.errorCallback = function(error){
	  console.log("navigator.getUserMedia error: ", error);
	}

	this.setSource = function(id) {
		if (!!window.stream) {
			this.video.src = null;
			window.stream.stop();
		}

		var constraints = {
			video: {optional: [{sourceId: id}]}
		};

		navigator.getUserMedia(constraints, this.successCallback, this.errorCallback);
	}

	this.togglePlay = function(){
		if (video.paused) {
			video.play();
		} else {
			video.pause();
		}
	}

	this.destroy = function(){
		video.pause();
	}
}

