'use strict';

var camera, scene, renderer;
var effect, controls;
var element, container;

var clock = new THREE.Clock();

var webcamTexture;

navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
var num = navigator.userAgent.match;
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
      console.log('Some other kind of source: ', sourceInfo);
    }
  }

  console.log(vidSources.length + ' video sources found');

  postSources();

}

if (typeof MediaStreamTrack === 'undefined'){
  alert('This browser does not support MediaStreamTrack.\n\nTry Chrome Canary.');
} else {
  MediaStreamTrack.getSources(gotSources);
}

function postSources() {
  init();
  animate();
}

function init() {
  renderer = new THREE.WebGLRenderer();
  element = renderer.domElement;
  container = document.getElementById('example');
  container.appendChild(element);

  effect = new THREE.StereoEffect(renderer, { separation: 0.3 });

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(90, 1, 0.001, 7000);
  camera.position.set(0, 3, 0);
  scene.add(camera);

  var light = new THREE.HemisphereLight(0x777777, 0x000000, 0.6);
  scene.add(light);

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
  //scene.add(mesh);


  setupWebcam();

  if (isMobile)
    element.addEventListener('click', fullscreen, false);

  window.addEventListener('resize', resize, false);
  setTimeout(resize, 1);
}

function setupWebcam() {
  var id = videoSelect.value;
  webcamTexture = new THREEx.WebcamTexture(id);

  var w = 320, h = 240;
  var aspect = w/h;

  var size = 10;

  var geo = new THREE.PlaneGeometry(size, 1/aspect * size);
  var mat = new THREE.MeshBasicMaterial({
    map : webcamTexture.texture,
    side: THREE.DoubleSide
  });
  var mesh = new THREE.Mesh(geo, mat);

  mesh.position.set(0, 3, -10);

  scene.add(mesh);

  var bR = 1.05;
  geo = new THREE.PlaneGeometry(size*bR, (1/aspect*size) *bR);
  mat = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa
  });
  mesh = new THREE.Mesh(geo, mat);

  mesh.position.set(0, 3, -10);

  scene.add(mesh);
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

  webcamTexture.update();
}

function render(dt) {
  effect.render(scene, camera);
}

function animate(t) {
  requestAnimationFrame(animate);

  update(clock.getDelta());
  render(clock.getDelta());
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