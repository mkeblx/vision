var THREEx = THREEx || {}

navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

THREEx.WebcamTexture	= function(sourceId){

	var video	= document.createElement('video');
	video.width	= 320;
	video.height	= 240;
	video.autoplay	= true;
	video.loop	= true;

	this.video	= video

	var constraints = {
		video: {optional: [{sourceId: sourceId}]}
	};

	this.successCallback = function(stream) {
	  window.stream = stream;
	  video.src = window.URL.createObjectURL(stream);
	}

	this.errorCallback = function(error){
	  console.log("navigator.getUserMedia error: ", error);
	}

	var texture	= new THREE.Texture( video );
	this.texture	= texture

	this.update	= function(delta, now){
		if( video.readyState !== video.HAVE_ENOUGH_DATA )	return;
		texture.needsUpdate	= true;		
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

	this.setSource(sourceId);

	this.destroy	= function(){
		video.pause()
	}
}

