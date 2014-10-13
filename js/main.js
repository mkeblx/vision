'use strict';

var camera, scene, renderer;
var effect, controls;
var element, container;
var composer, renderPass;
var colorPasses;

var clock = new THREE.Clock();

var settings = {
  tracking: {
    enabled: false
  },
  size: 10,
  filter: null,
  flipX: false,
  flipY: false,
  freeLook: false,
  sync: false
};

var _params = {
  fov: 60,
  filter: 'default'
};

var randomEnabled = false;

var _uniforms;

var renderTarget;

var fbRef, roomRef;

var updateFns = [];

var screenObj;

var htracker;
var head = {x: 0, y: 0, z: 0};
var face = {angle: 0, width: 0, height: 0, x: 0, y: 0};
var haveTracking = false;

var faceMesh, debugTex, debugCtx;

var webcamTexture;

var first = true;

navigator.getUserMedia = navigator.getUserMedia ||
          navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
var isMobile = navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i)
            || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPad/i)
            || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/BlackBerry/i)
            || navigator.userAgent.match(/Windows Phone/i);


var fullScreenButton;

var vrEffect;
var vrControls;

var has = {
  WebVR: !!navigator.getVRDevices
};

var riftMode = has.WebVR && !isMobile;


var videoSelect = $('#videoSource');

var vidSources = [];

function gotSources(sourceInfos) {
  var n = 0;
  for (var i = 0; i != sourceInfos.length; ++i) {
    var sourceInfo = sourceInfos[i];
    var option = $('<option>');
    option.val(sourceInfo.id);
    if (sourceInfo.kind === 'video') {
      n++;
      vidSources.push({
          label: sourceInfo.label || 'camera ' + n,
          id: sourceInfo.id
        });
      option.html(sourceInfo.label || 'camera ' + n);
      videoSelect.append(option);

    } else {
      //console.log('Some other kind of source: ', sourceInfo);
    }
  }
  console.log(vidSources.length + ' video sources found');


  postSources();

}

if (typeof MediaStreamTrack === 'undefined'){
  console.log('This browser does not support MediaStreamTrack.\n\nTry Chrome.');
} else {
  if (MediaStreamTrack.getSources) {
    MediaStreamTrack.getSources(gotSources);
  } else {
    $('#cam-sec').hide();
    init();
    animate();
  }
}

function postSources() {
  videoSelect.find('option:last-child').attr('selected', 'selected');

  init();
  animate();
}

function init() {
  fullScreenButton = document.getElementById('fs-button');

  if (settings.sync)
    setupFb();

  scene = new THREE.Scene();

  setupRendering();

  setupScene();

  if (settings.tracking.enabled) {
    setupFacebox();

    setupTracking();
  }

  setupUI();

  if (isMobile) {

    if (settings.freeLook) {
      window.addEventListener('deviceorientation', setOrientationControls, true);
    }

    element.addEventListener('click', fullscreen, false);
  }

  window.addEventListener('resize', resize, false);
  setTimeout(resize, 1);
}

function setupFb() {
  fbRef = new Firebase('https://cardboard-vision.firebaseio.com/');

  var roomsRef = fbRef.child('rooms');

  var room = 'global';
  var hash = window.location.hash.substr(1);

  if (hash == null || hash == '') {
    room = Math.round(Math.random()*1000);
    window.location.hash = room;
  } else {
    room = hash;
  }

  roomRef = roomsRef.child(room);

  roomRef.on('value', function(s){
    var v = s.val();
    if (v == null)
      return;

    var filter = v.filter;
    var fov = v.fov;

    _params.filter = filter;
    _params.fov = fov;

    setFOV(fov);
    switchValue(filter);

    $('#color-cubes div').removeClass('selected');
    $('#color-cubes').find('div:contains("'+filter+'")').addClass('selected');
  });
}

function setOrientationControls(e) {
  if (!e.alpha) {
    return;
  }

  controls = new THREE.DeviceOrientationControls(camera, true);
  controls.connect();
  controls.update();

  window.removeEventListener('deviceorientation', setOrientationControls);
}

function setupScene() {
  camera = new THREE.PerspectiveCamera(90, 1, 0.001, 7000);
  camera.position.set(0, 3, 0);
  scene.add(camera);

  var light = new THREE.HemisphereLight(0x777777, 0x000000, 0.6);
  scene.add(light);

  //setupFloor();
  setupWebcam();
}

function setupFloor() {
  var texture = THREE.ImageUtils.loadTexture(
    'textures/patterns/checker.png'
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat = new THREE.Vector2(50, 50);
  texture.anisotropy = renderer.getMaxAnisotropy();

  var material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    specular: 0xffffff,
    shininess: 20,
    shading: THREE.FlatShading,
    map: texture
  });

  var geometry = new THREE.PlaneGeometry(1000, 1000);

  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -2;
  scene.add(mesh);
}

function setupWebcam() {
  var id = videoSelect.val();
  webcamTexture = new THREEx.WebcamTexture();

  webcamTexture.setSource(id);

  var w = 640, h = 480;
  var aspect = w/h;

  var size = settings.size;

  screenObj = new THREE.Object3D();

  setFOV(_params.fov);

  var geo = new THREE.PlaneGeometry(size, 1/aspect * size);

  var testTexture = THREE.ImageUtils.loadTexture('textures/test-pattern.jpg');

  colorPasses.colorPass.uniforms.tDiffuse.value = testTexture;

  var material = colorPasses.colorPass.material;
  material.side = THREE.DoubleSide;

  var mesh = new THREE.Mesh(geo, material);

  if (settings.flipY) {
    mesh.scale.y = -1;
  }
  if (settings.flipX) {
    mesh.scale.x = -1;
  }

  screenObj.add(mesh);


  var glowTexture = THREE.ImageUtils.loadTexture('textures/border.png');

  var bR = 1.2;
  geo = new THREE.PlaneGeometry(size*1.15, (1/aspect*size) * 1.2);
  var mat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0xaaaaaa,
    transparent: true
  });
  var glowMesh = new THREE.Mesh(geo, mat);

  glowMesh.position.z = -0.1;

  //screenObj.add(glowMesh);

  scene.add(screenObj);
}

/* TODO: 
-capture with filter
-capture meta data: geo, orientation, etc
-upload to cloud, social media
-place in scene: smaller, next to main video feed
*/
function snapshot() {
  var canvas = document.querySelector('#snapshot');
  var ctx = canvas.getContext('2d');

  if (stream) {
    ctx.drawImage(webcamTexture.video, 0, 0);
    //document.querySelector('img').src = canvas.toDataURL('image/png');
  } else {
    console.log('no stream active');
  }
}

$('#capture-btn').on('click', function(){
  snapshot();
});

function setupRendering() {
  var renderTargetParams = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBFormat,
    stencilBuffer: true };

  renderTarget = new THREE.WebGLRenderTarget( 320, 240, renderTargetParams );

  renderer = new THREE.WebGLRenderer();
  element = renderer.domElement;
  container = document.getElementById('canvas');
  container.appendChild(element);

  function VREffectLoaded(error) {
    if (error) {
      fullScreenButton.innerHTML = error;
      fullScreenButton.classList.add('error');
    }
  }

  colorPasses = new THREEx.ColorAdjust.Passes();

  _uniforms = colorPasses.colorPass.uniforms;

  updateFns.push(function(dt){
    colorPasses.update(dt);
  });

  setInterval(function(){
    if( randomEnabled === false ) return;
    var values  = Object.keys(THREEx.ColorAdjust.colorCubes);
    var index = Math.floor(Math.random()*values.length);
    var filter = values[index];

    $('#color-cubes div').removeClass('selected');
    $('#color-cubes').find('div:contains("'+filter+'")').addClass('selected');

    switchValue(filter);
  }, 5*1000);

  //switchValue(_params['filter']);

  if (riftMode) {
    vrEffect = new THREE.VREffect(renderer, VREffectLoaded);
    vrControls = new THREE.VRControls(camera);
  } else {
    effect = new THREE.StereoEffect(renderer, { separation: 0.3 });
  }
}

// horizontal FOV
function fovToDist(fov) {
  var rad = fov*0.5 *Math.PI/180;
  var d = 0.5*settings.size / Math.tan(rad);
  console.log(fov + 'deg : ' + d);
  return d;
}

function setFOV(fov) {
  var dist = -fovToDist(fov);
  screenObj.position.set(0, 3, dist);
  $('#fov').html(fov+'&deg;');
  $('#fov-select').val(fov);
}

function switchValue(value){
  var unis = colorPasses.setColorCube(value);

  _uniforms = unis;

  $('#filter-value').html(value);
  _params.filter = value;

  sendCmd({
    name: 'filter',
    data: {
      value: value
    }
  });

  setHashParams();
}

function switchRandom(){
  randomEnabled = randomEnabled === false ? true : false;
}


function getHashParam(paramName) {
  var params = getHashParams();
  return params[paramName];
}

function setHashParams() {
  var hash = 'fov:' + _params['fov'] + '|filter:' + _params['filter'];
  // window.location.hash = hash;
}

function getHashParams() {
  var hash = window.location.hash.substr(1);

  console.log(hash);

  if (hash == null || hash == '')
    return {};
  
  var params = {};
  var parts = hash.split('|');

  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].split(':');
    params[p[0]] = p[1];
  }

  return params;
}

function sendCmd(cmd) {
  console.log('sendCmd: ' + cmd);

  if (settings.sync) {
    roomRef.update({
      filter: _params['filter'],
      fov: _params['fov']
    });
  }
}

function receiveCmd(cmd) {
  console.log('receiveCmd: ' + cmd);
}

function setupUI() {
  $('#color-cubes').on('click', 'div', function(ev){
    var $this = $(this);
    var val = $this.html();
    $this.parent().find('div').removeClass('selected');
    $this.addClass('selected');

    randomEnabled = false;

    switchValue(val);
  });

  videoSelect.on('change', changeCam);

  $('#fov-select').on('input change', function(ev){
    var val = $(this).val();
    console.log('fov: ' + val);

    _params.fov = val;
    setFOV(val);
    sendCmd({
      name: 'fov',
      data: {
        value: val
      }
    });
    setHashParams();
  });

  $('#toggle-play').on('click', function(ev){
    webcamTexture.togglePlay();
  });

  $('#random-mode').on('click', function(ev){
    switchRandom();
  });

  fullScreenButton.addEventListener('click', function(){
    vrEffect.setFullScreen(true);
  }, true);

  $(window).on('hashchange',function(){ 
    // console.log(window.location.hash.slice(1));
    // handle manual change of params in url
  });
}

function setupTracking() {
  var statusMessages = {
    'whitebalance' : 'checking for stability of camera whitebalance',
    'detecting' : 'detecting face',
    'hints' : 'hmm. detecting the face is taking a long time',
    'redetecting' : 'lost track of face, redetecting',
    'lost' : 'lost track of face',
    'found' : 'tracking humanoid face'
  };

  var videoInput = webcamTexture.video;
  var canvasInput = document.getElementById('vid-canvas');
  var debugOverlay = document.getElementById('debug');
  
  var _settings = {
    ui: 0,
    fadeVideo: 1,
    debug: debugOverlay,
    calcAngles: true
  };

  htracker = new headtrackr.Tracker(_settings);
  htracker.init(videoInput, canvasInput, true);
  htracker.start();

  document.addEventListener('headtrackrStatus', function(ev) {
    var htmsg = document.getElementById('headtrackerMessage');
    
    if (ev.status in statusMessages) {
      var msg = statusMessages[ev.status];
      console.log(ev.status, msg);

      if (ev.status == 'found') {
        haveTracking = true;
        console.log('have tracking');
        //htracker.stop();
        //htracker.start();
        toggleFacebox(true);
      } else if (ev.status == 'lost' || ev.status == 'redetecting') {
        haveTracking = false;
        console.log('LOST tracking');
        toggleFacebox(false);
      }

      // htmsg.innerHTML = msg; // todo : draw text in space
    }

  }, true);

  document.addEventListener('headtrackingEvent', function(ev) {
    haveTracking = true;

    head.x = ev.x.toFixed(2);
    head.y = ev.y.toFixed(2);
    head.z = ev.z.toFixed(2);

   // updateTrackingUI();
  });

  document.addEventListener('facetrackingEvent', function(ev) {
    face.width = ev.width;
    face.height = ev.height;
    face.x = ev.x;
    face.y = ev.y;
    face.angle = ev.angle;

    updateFacebox();
  });

  // draw Marker

}

function setupFacebox() {
  var w = 320, h = 240;
  var aspect = w/h;

  var size = settings.size;

  debugCtx = document.getElementById('debug');
  debugTex = new THREE.Texture(debugCtx);
  debugTex.needsUpdate = true;

  var geo = new THREE.PlaneGeometry(1, 1);
  geo = new THREE.PlaneGeometry(size, 1/aspect * size);
  var mat = new THREE.MeshBasicMaterial({
    //color: 0x3878ff,
    transparent: true,
    opacity: 0.93,
    map: debugTex
  });



  faceMesh = new THREE.Mesh(geo, mat);

  faceMesh.position.z = 0.04;
  faceMesh.visible = true;

  screenObj.add(faceMesh);
}

function updateFacebox() {
  return;
  var w = 320, h = 240;

  faceMesh.rotation.z = -face.angle;

  var s = 1/ (w/10);

  faceMesh.scale.y = 1 * face.width * s;
  faceMesh.scale.x = 1 * face.height * s;

  faceMesh.position.x = (face.x - w/2) * s;
  faceMesh.position.y = -(face.y - h/2) * s;
}

function toggleFacebox(show) {
  faceMesh.visible = show !== undefined ? show : !faceMesh.visible;
}

function resize() {
  var width = container.offsetWidth;
  var height = container.offsetHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (riftMode) {
    renderer.setSize(width, height);
  } else {
    renderer.setSize(width, height);
    effect.setSize(width, height);
  }
}

function update(dt) {
  resize();

  camera.updateProjectionMatrix();

  if (settings.tracking.enabled) {
    debugTex.needsUpdate = true;
  }

  if (window.stream) {
    colorPasses.colorPass.uniforms.tDiffuse.value = webcamTexture.texture;
  }

  if (controls) {
    controls.update(dt);
  }

  webcamTexture.update();

  updateFns.forEach(function(f){
    f(dt);
  });
}

function render(dt) {
  if (riftMode)
    vrEffect.render(scene, camera);
  else
    effect.render(scene, camera);
}

function animate(t) {
  requestAnimationFrame(animate);

  var dt = clock.getDelta();

  update(dt);
  render(dt);
}

function changeCam() {
  var id = videoSelect.val();
  console.log('set vid source to: ' + id);
  webcamTexture.setSource(id);
}

function fullscreen() {
  if (container.requestFullscreen) {
    container.requestFullscreen();
  } else if (container.msRequestFullscreen) {
    container.msRequestFullscreen();
  } else if (container.mozRequestFullScreen) {
    container.mozRequestFullScreen();
  } else if (container.webkitRequestFullscreen) {
    container.webkitRequestFullscreen();
  }
}
