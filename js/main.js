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
  FOV: 90, // cam distance
  filter: null,
  flipX: false,
  flipY: false,
  freeLook: false
};


var randomEnabled = false;

var _uniforms;

var renderTarget;


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


var videoSelect = document.querySelector("select#videoSource");

var vidSources = [];

function gotSources(sourceInfos) {
  for (var i = 0; i != sourceInfos.length; ++i) {
    var sourceInfo = sourceInfos[i];
    var option = document.createElement("option");
    option.value = sourceInfo.id;
    if (sourceInfo.kind === 'video') {
      vidSources.push({
          label: sourceInfo.label || 'camera ' + (vidSources.length + 1),
          id: sourceInfo.id
        });
      option.text = sourceInfo.label || 'camera ' + (videoSelect.length + 1);
      videoSelect.appendChild(option);
    } else {
      //console.log('Some other kind of source: ', sourceInfo);
    }
  }

  console.log(vidSources.length + ' video sources found');

  postSources();

}

if (typeof MediaStreamTrack === 'undefined'){
  console.log('This browser does not support MediaStreamTrack.\n\nTry Chrome Canary.');
} else {
  MediaStreamTrack.getSources(gotSources);
}

function postSources() {
  init();
  animate();
}

function init() {

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

  setupFloor();
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
  var id = videoSelect.value;
  webcamTexture = new THREEx.WebcamTexture();

  webcamTexture.setSource(id);

  var w = 320, h = 240;
  var aspect = w/h;

  var size = 10;

  screenObj = new THREE.Object3D();

  var dist = -10; // settings.FOV calc
  screenObj.position.set(0, 3, dist);

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

  screenObj.add(glowMesh);

  scene.add(screenObj);
}

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


  switchValue(location.hash.substr(1) || 'default');

  effect = new THREE.StereoEffect(renderer, { separation: 0.3 });
}

function switchValue(value){
  var unis = colorPasses.setColorCube(value);

  _uniforms = unis;

  document.querySelector('#filter-value').innerText = value;
  location.hash = value;
}

function switchRandom(){
  randomEnabled = randomEnabled === false ? true : false;
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

  $('#toggle-play').on('click', function(ev){
    webcamTexture.togglePlay();
  });

  $('#random-mode').on('click', function(ev){
    switchRandom();
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

  var size = 10;

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

  renderer.setSize(width, height);
  effect.setSize(width, height);
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
  effect.render(scene, camera);
}

function animate(t) {
  requestAnimationFrame(animate);

  var dt = clock.getDelta();

  update(dt);
  render(dt);
}

function changeCam() {
  var id = videoSelect.value;
  console.log('set vid source to: ' + id);
  webcamTexture.setSource(id);
}

videoSelect.onchange = changeCam;

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
