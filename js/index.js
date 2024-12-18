//import './style.css'

import { 
  Scene, 
  SphereGeometry, 
  PlaneGeometry,
  Vector2,
  Vector3, 
  PerspectiveCamera, 
  WebGLRenderer, 
  Color, 
  MeshBasicMaterial, 
  Mesh, 
  Clock, 
  AudioListener, 
  Audio,
  AudioContext,
  AudioLoader, 
  AudioAnalyser,
  TextureLoader, 
  CineonToneMapping,
  LinearToneMapping,
  LoadingManager,
  Raycaster,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
  SRGBColorSpace
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { createSculptureWithGeometry } from 'https://unpkg.com/shader-park-core/dist/shader-park-core.esm.js';
import { generateshaderparkcode } from './generateshaderparkcode.js';
import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { DotScreenShader } from 'three/addons/shaders/DotScreenShader.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LuminosityShader } from 'three/addons/shaders/LuminosityShader.js';
import { SobelOperatorShader } from 'three/addons/shaders/SobelOperatorShader.js';
import * as AudioPlayerPlugin from 'https://unpkg.com/tweakpane-plugin-audio-player@0.0.2/dist/tweakpane-plugin-audio-player.js';
import {CSS2DRenderer, CSS2DObject} from 'three/addons/renderers/CSS2DRenderer'
import Stats from 'three/addons/libs/stats.module'

//////////////////////
///GLOBAL VARIABLES///
//////////////////////
{
window['TIME_MULTIPLIER'] = 1.0;
var screenShake = ScreenShake();
var scene;
var renderer;
var composer;
var camera;
var stats;
var renderTarget;
var rtScene;
var rtCamera;
var controls;
var clock;
var divContainer;
var img;
var audioFile;
var listener;
var labelRenderer;
var audioBuffer;
var context;
var reversedAudioBuffer;
var reversedAudio;
var shader_index = -1;
var timeIncreasing = true;
var pointer = new Vector2();
var fileInput = document.getElementById('file');
var visualizer = {
    generated : false, // TESTING
    mesh : null,
    shader : null,
    analyser : null,
    scale : 10.0,
};
var audio = null;
var toneMapping = {
    exposure : 1.5,
};
var bloomSettings = {
    strength : 1.6,
    radius : 0.4,
    threshold : 0.1,
}
var bloom = {
  shader : new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    bloomSettings.strength,
    bloomSettings.radius,
    bloomSettings.threshold
    ),
  enabled : true,
  toggle : () => {
    bloom.enabled = !bloom.enabled;
    applyPostProcessing();
  }
}
var RGBShift = {
    shader : new ShaderPass(RGBShiftShader),
    scale : 0.0015,
    enabled : false,
    toggle : () => {
      RGBShift.enabled = !RGBShift.enabled;
      applyPostProcessing();
    }
}
var dotShader = {
    shader : new ShaderPass(DotScreenShader),
    scale : 4.0,
    enabled : false,
    toggle : () => {
      dotShader.enabled = !dotShader.enabled;
      applyPostProcessing();
    }
}
var effects = [bloom, RGBShift, dotShader];
  
}

// shaderpark definitions
let shaders = [
  'default', 
  'og', 
  'react', 
  'example', 
  'test', 
  'test2', 
  'test3'
]

// visualizer and control states
var state = {
    mouse : new Vector3(),
    currMouse : new Vector3(),
    size : 0.0,
    pointerDown: 0.0,
    currPointerDown: 0.0,
    currAudio: 0.0,
    time : 0.0,
    volume_multiplier : 0.0,
    minimizing_factor : 0.8,
    power_factor : 8.0,
    base_speed : 0.2,
    easing_speed : 0.6,
    rotate_toggle : false,
    autorotateSpeed : 0.2,
}

var intersected = false;
var clickable = false;

// resizing window event
window.addEventListener( 'resize', onWindowResize );

// file upload event
document.getElementById("file").addEventListener("change", loadAudio, false);

// document.getElementById('btn').addEventListener('click', function() {
//   saveScene();
// })

// document.getElementById('btn2').addEventListener('click', function() {
//   restoreScene();
// })

////////////////
/// THREE JS ///
////////////////

window.onload = function(){ 
  
  eventSetup();

  createScene();

  createVisualizer(true); // true selects from array

  loadAudio();

  applyPostProcessing();

  addUI();
    
  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
  labelRenderer.setSize(this.window.innerWidth, this.window.innerHeight)
}

function applyPostProcessing() {
  // clean slate
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  
  // go thru effects array
  for (var i = 0; i < effects.length; i++) {
    if (effects[i].enabled) {
      composer.addPass(effects[i].shader);
    }
  }

  // const outputPass = new OutputPass();
  // composer.addPass(outputPass);
}

function createVisualizer(selecting) {
  
  // SHADER
  console.log("Loading shader... ")

  if (!selecting) {
    visualizer.shader = generateshaderparkcode('gpt-3'); 
    console.log("Shader successfully generated")
  } else {
    shader_index++;

    if (shader_index == shaders.length) {
      shader_index = 0;
    }
    console.log(shaders[shader_index] + " selected")
    visualizer.shader = generateshaderparkcode(shaders[shader_index]);
  }

  // MESHES
    // add shader to geometry
    var geometry  = new SphereGeometry(40, 60, 60);
    visualizer.mesh = createSculptureWithGeometry(geometry, visualizer.shader, () => {
      return {
        time : state.time,
        size : state.size,
        pointerDown: state.pointerDown,
        mouse: state.mouse,
        _scale: visualizer.scale
      }
    })
    scene.add(visualizer.mesh);

    // Scene and camera for rendering Shader Park
    // Render target for Shader Park output
    renderTarget = new WebGLRenderTarget(window.innerWidth/4, window.innerHeight/4, {
      format: RGBAFormat,
      type: UnsignedByteType,
    });
    rtScene = new Scene();
    rtCamera = camera;
    let targetMesh = createSculptureWithGeometry(geometry, visualizer.shader, () => {
      return {
        time : state.time,
        size : state.size,
        pointerDown: state.pointerDown,
        mouse: state.mouse,
        _scale: visualizer.scale
      }
    })
    rtScene.add(targetMesh);

    // create a skybox
    geometry = new SphereGeometry(400, 60, 40);
    geometry.scale(-1, 1, 1);
    let texture = new TextureLoader().load("https://bsiscoe.github.io/MAGE/resources/skybox.png");
    let material = new MeshBasicMaterial({map: texture});
    let mesh = new Mesh(geometry, material);
    scene.add(mesh);
}

function loadAudio() {
  /////////////
  /// AUDIO ///
  /////////////

  // create an AudioListener and add it to the camera
  listener = new AudioListener();
  camera.add( listener );  

  // create an Audio source
  if (audio) {
    //audio.pause()
  }
  audio = new Audio( listener );
  reversedAudio = new Audio( listener )
  const audioLoader = new AudioLoader();

  var fileInput = document.querySelector( '#file' );
  fileInput.addEventListener( 'change', function( event ) {

    var reader = new FileReader();
    reader.addEventListener( 'load', function ( event ) {

      audioBuffer = event.target.result;
      context = AudioContext.getContext();
      context.decodeAudioData( audioBuffer, function ( buffer ) {
        audio.setBuffer( buffer );
      });

      // reversedAudioBuffer = reverseAudioBuffer(audioBuffer);
      // context.decodeAudioData( reversedAudioBuffer, function ( buffer ) {
      //   reversedAudio.setBuffer( buffer );
      // });
      
    });

    audioFile = event.target.files[0];
    reader.readAsArrayBuffer( audioFile );
    if (audioFile != null) {
      img.src = 'https://bsiscoe.github.io/MAGE/resources/controltips.png';
      document.title = "MAGE - Playing Audio";
    }
  });

  audio.autoplay = true;

  // create an AudioAnalyser, passing in the sound and desired fftSize
  visualizer.analyser = new AudioAnalyser( audio, 32 );
    

  // const audioplay = document.getElementById("audio");
  // const currentTimeDisplay = document.getElementById("currentTime");

  // audioplay.addEventListener("timeupdate", () => {
  //   currentTimeDisplay.textContent = audio.currentTime; 
  // });

  // reset scale
  visualizer.scale = 10.0
  state.minimizing_factor = .8;

  // get the average frequency of the sound
  const data = visualizer.analyser.getAverageFrequency();
}

function reverseAudioBuffer(audioBuffer) {
  
  console.log("Listener:", listener);
  console.log("Audio Context:", listener.context);
  const newBuffer = listener.context.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );


  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        for (let i = 0; i < originalData.length; i++) {
            reversedData[i] = originalData[originalData.length - 1 - i];
        }
    }

  return newBuffer;
}

function addUI() {
  const pane = new Pane();

    // music ui
    // const musicui = pane.addFolder({title: 'Music'})
    // pane.registerPlugin(AudioPlayerPlugin);
    // musicui.addBlade({
    //   view: 'audio-player',
    //   source: 'music.wav',
    //   label: 'track'
    // });

    // visualizer ui
    const vizui = pane.addFolder({title: 'Visualizer'}); 
    vizui.addButton({
      title: 'GENERATE',
      label: 'Scene Generation'
    }).on('click', () => {
      scene.remove( visualizer.mesh );
      createVisualizer(false);
    })
    vizui.addButton({
      title: 'SELECT',
      label: 'Scene Generation'
    }).on('click', () => {
      scene.remove( visualizer.mesh );
      createVisualizer(true);
    })
    vizui.addBinding(state, 'minimizing_factor', {min:0.01, max:2.00, label:'MOD 1'});
    vizui.addBinding(state, 'power_factor', {min:1.0, max:10.0, label:'MOD 2'});
    vizui.addBinding(state, 'base_speed', {min: 0.01, max: 0.9, label: 'Base Speed'})
    vizui.addBinding(state, 'easing_speed', {min: 0.01, max: .9, label: 'Easing Speed' })
    vizui.addBinding(visualizer, 'scale', {min: 1, max: 200.0, label: 'scale'});
    vizui.addBinding(window, 'TIME_MULTIPLIER', {min: 0.1, max: 100, label: 'Time'});
    vizui.addBinding(state, 'autorotateSpeed', {min: 0.1, max: 10.0, label: 'Rotation Speed'}).on('change', (ev) => {
      controls.autoRotateSpeed = state.autorotateSpeed;
    })
    vizui.addButton({
      title: 'Toggle',
      label: 'Auto Rotate',
    }).on('click', (ev) => {
      controls.autoRotate = !controls.autoRotate;
    })

    // bloom ui
    const bloomui = pane.addFolder({title: 'Bloom Settings'}).on('change', () => {
      bloom.shader = new UnrealBloomPass(
        new Vector2(window.innerWidth, window.innerHeight),
        bloomSettings.strength,
        bloomSettings.radius,
        bloomSettings.threshold
      )
      applyPostProcessing();
    })
    bloomui.addBinding(bloomSettings, 'strength', {min: 0.0, max: 10.0, label: 'Strength' });
    bloomui.addBinding(bloomSettings, 'radius', {min: -10.0, max: 10.0, label: 'Radius' });
    bloomui.addBinding(bloomSettings, 'threshold', {min: 0.0, max: 10.0, label: 'Threshold' });
    bloomui.addButton({
      title: 'Toggle',
      label: 'Bloom Effect',   // optional
    }).on('click', () => {
      bloom.toggle();
    });

    const ppui = pane.addFolder({title: 'Post Processing Effects'});
    ppui.addBinding(toneMapping, 'exposure').on('change', (ev) => {
      renderer.toneMappingExposure = toneMapping.exposure;
    })
    ppui.addButton({
      title: 'Toggle',
      label: 'RGBShift Effect',   // optional
    }).on('click', () => {
      RGBShift.toggle();
    });
    ppui.addButton({
      title: 'Toggle',
      label: 'Dot Shader Effect',   // optional
    }).on('click', () => {
      dotShader.toggle();
    });

    // camera ui
    const camui = pane.addFolder({title: 'Camera Settings'}).on('change', (ev) => {
      camera.updateProjectionMatrix();
    });
    camui.addBinding(camera, 'fov', {min: 1, max: 359, label: 'FOV'});
    camui.addButton({
      title: 'Reset',
      label: 'Camera Position'
    }).on('click', () => {
      controls.reset();
    })
    window.pane = pane;
    window.pane.hidden = true;
}

function createScene() {
  // initialize scene
  scene = new Scene();

  // initialize camera
  camera = new PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
  camera.position.z = 5.5;

  // initialize renderer
  renderer = new WebGLRenderer({ antialias: true, transparent: true, premultipliedAlpha : false });
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setClearColor( new Color(1, 1, 1), 0);
  document.body.appendChild( renderer.domElement );
  renderer.toneMapping = CineonToneMapping;
  renderer.toneMappingexposure = toneMapping.exposure;
  renderer.outputColorSpace = SRGBColorSpace;

  stats = new Stats();
  document.body.appendChild(stats.domElement);
  stats.dom.style.display = 'none';

  // initialize 2D renderer
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0px'
  labelRenderer.domElement.style.pointerEvents = 'none'
  document.body.appendChild(labelRenderer.domElement)

  // add in tooltip ui
  img = document.createElement('img');
  img.src = 'https://bsiscoe.github.io/MAGE/resources/middlemouse.png';
  const div = document.createElement('div')
  div.appendChild(img)
  divContainer = new CSS2DObject(div);
  divContainer.scale.set(0.2,0.2,0.2)
  divContainer.position.set(0,2,0)
  scene.add(divContainer)

  // initialize clock
  clock = new Clock();

  // Add mouse controlls
  controls = new OrbitControls( camera, renderer.domElement, {
    enabledamping : true,
    dampingFactor : 0.25,
    zoomSpeed : 0.5,
    rotateSpeed : 0.5
  } );
  controls.enabledamping = true;
  controls.autoRotate = state.rotate_toggle;
  controls.autoRotateSpeed = state.autorotateSpeed;
  controls.saveState();
}

function ScreenShake() {

        return {

          // When a function outside ScreenShake handle the camera, it should
          // always check that ScreenShake.enabled is false before.
          enabled: false,

          _timestampStart: undefined,

          _timestampEnd: undefined,

          _startPoint: undefined,

          _endPoint: undefined,


          // update(camera) must be called in the loop function of the renderer,
          // it will repositioned the camera according to the requested shaking.
          update: function update(camera) {
            if ( this.enabled == true ) {
              const now = Date.now();
              if ( this._timestampEnd > now ) {
                let interval = (Date.now() - this._timestampStart) / 
                  (this._timestampEnd - this._timestampStart) ;
                this.computePosition( camera, interval );
              } else {
                camera.position.copy(this._startPoint);
                this.enabled = false;
              };
            };
          },


          // This initialize the values of the shaking.
          // vecToAdd param is the offset of the camera position at the climax of its wave.
          shake: function shake(camera, vecToAdd, milliseconds) {
            this.enabled = true ;
            this._timestampStart = Date.now();
            this._timestampEnd = this._timestampStart + milliseconds;
            this._startPoint = new Vector3().copy(camera.position);
            this._endPoint = new Vector3().addVectors( camera.position, vecToAdd );
          },


          computePosition: function computePosition(camera, interval) {

            // This creates the wavy movement of the camera along the interval.
            // The first bloc call this.getQuadra() with a positive indice between
            // 0 and 1, then the second call it again with a negative indice between
            // 0 and -1, etc. Variable position will get the sign of the indice, and
            // get wavy.
            if (interval < 0.4) {
              var position = this.getQuadra( interval / 0.4 );
            } else if (interval < 0.7) {
              var position = this.getQuadra( (interval-0.4) / 0.3 ) * -0.6;
            } else if (interval < 0.9) {
              var position = this.getQuadra( (interval-0.7) / 0.2 ) * 0.3;
            } else {
              var position = this.getQuadra( (interval-0.9) / 0.1 ) * -0.1;
            }

            // Here the camera is positioned according to the wavy 'position' variable.
            camera.position.lerpVectors( this._startPoint, this._endPoint, position );
          },

          // This is a quadratic function that return 0 at first, then return 0.5 when t=0.5,
          // then return 0 when t=1 ;
          getQuadra: function getQuadra(t) {
            return 9.436896e-16 + (4*t) - (4*(t*t)) ;
          }

        };

};
      
function shake() {
      	//screenShake.shake( camera, new Vector3(0, -5, 0), 100 );
}
    
function saveScene() {
  localStorage.setItem('bloomSettings', JSON.stringify(window.bloomSettings));
  //localStorage["state"] = JSON.stringify(state);
  localStorage.setItem('visualizer', JSON.stringify(window.visualizer));
}

function restoreScene() {
  bloomSettings = JSON.parse(localStorage.getItem('bloomSettings'));
  //state = JSON.parse(localStorage["state"]);
  visualizer = JSON.parse(localStorage.getItem('visualizer'));
}   

function eventSetup() {
  // resizing window event
  window.addEventListener( 'resize', onWindowResize );

  const canvas = document.querySelector('canvas');

  // canvas.addEventListener('click', () => {
  //   canvas.requestPointerLock();
  // });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
        console.log('Pointer locked: interaction enabled.');
    } else {
        console.log('Pointer unlocked: interaction disabled.');
    }
  });

  // Keyboard events
  window.onkeydown = function(e) {
    switch (e.code) {
      case 'Space':
        window.pane.hidden = !window.pane.hidden;
        stats.dom.style.display = stats.dom.style.display == 'none' ? 'block' : 'none';
        break;
      default:
        break;
    }
  }

  // Mouse events
  window.addEventListener( 'pointermove', (event) => {
    state.currMouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    state.currMouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    if (controls.enabled == false) {
      
    }
  }, false );
  
  window.addEventListener( 'pointerdown', (event) => {
    if (clickable) {
      controls.enabled = false;
      img.hidden = true;
      state.currPointerDown = 1.0
    }
  });

  window.addEventListener( 'pointerup', (event) => {
    // read file
    if (clickable) {
      if (event.button == 0) {
        fileInput.click();
        clickable = false;
      }
    }
    audio.setPlaybackRate(1.0); 
    audio.play();
    img.hidden = false;
    controls.enabled = true;
    state.currPointerDown = 0.0;
  }); 


  // document.getElementById('btn').addEventListener('click', function() {
  //   saveScene();
  // })

  // document.getElementById('btn2').addEventListener('click', function() {
  //   restoreScene();
  // })
  
}

function animate() {
  requestAnimationFrame( animate );
  
  // alternates flow of time to prevent animation bugs
  if (timeIncreasing && state.time < 1000) {
    state.time += TIME_MULTIPLIER*clock.getDelta();
    
  } else {
    timeIncreasing = false;
    state.time -= TIME_MULTIPLIER*clock.getDelta();
    if (state.time == 0) {
      timeIncreasing = true
    }
  }
 
  // animate tab bar
  let timeCalc =  (1 + Math.sin(state.time)) * 10 / 2;
  if (audioFile != null) {
    if (timeCalc > 5.0) {
      document.title = "MAGE - Playing Audio...";
    } else {
      document.title = "MAGE - Playing Audio";
    }
  }

  // use easing and linear interpolation to smoothly animate mouse effects
  state.pointerDown = .1 * state.currPointerDown + .9 * state.pointerDown;
  state.mouse.lerp(state.currMouse, .05 );

  var audio_input = 0;

  if (audio != null) {
    let analysis = Math.pow((visualizer.analyser.getFrequencyData()[2]/255)*state.minimizing_factor, state.power_factor);
    //console.log(analysis)
    audio_input = analysis + clock.getDelta() * state.base_speed;
  }
  //console.log(clock.getDelta())
  let val = Math.sin(state.time)*(state.size)*0.02+0.1;
  state.currAudio = audio_input + val *state.base_speed + clock.getDelta() * state.base_speed;
  state.size = (1-state.easing_speed) * state.currAudio + state.easing_speed * state.size + state.volume_multiplier*.01;
  if (audio_input > 0.03) {
    shake();
  }
  // Start Sphere animation 
  let raycaster = new Raycaster();
  raycaster.setFromCamera(state.currMouse, camera);
  let intersects = raycaster.intersectObject(visualizer.mesh);
    
  // if orbit controls are disabled then control audio
  if (controls.enabled == false) {
    audio.setPlaybackRate(state.currMouse.x + 1); 
      if (audio.getPlaybackRate() < 0) {
        audio.setPlaybackRate(Math.abs(audio.getPlaybackRate()))
      }
      if (audio.getPlaybackRate() < 0 && audioBuffer != null) {
          audio.currentTime = 0;
        } else {
      }
      //console.log(audio.getVolume())

      // shrink the orb for feedback
      state.volume_multiplier = state.currMouse.y * 2
      camera.fov += state.currMouse.y
      state.base_speed = Math.max(0.1, Math.min(0.9, state.base_speed+state.currMouse.y/50))
      state.minimizing_factor = Math.max(0.01, Math.min(1.0, state.minimizing_factor+state.currMouse.y/100));
      visualizer.scale = Math.max(1.0, Math.min(30.0, visualizer.scale+state.currMouse.y)); //state.currMouse.y * .2
      audio.setVolume(Math.max(0.0, Math.min(1.0, audio.getVolume() + state.currMouse.y/2 * 0.1)));
  } else

  // ONLY CHECK PIXEL IF IT INTERSECTS
  if ( intersects.length > 0 ) {
    intersected = true;
      
    // Render Shader Park material to the render target
    renderer.setRenderTarget(renderTarget);
    renderer.render(rtScene, rtCamera);
    renderer.setRenderTarget(null); // Reset to default framebuffer

    // Read pixel color from render target
    const pixelBuffer = new Uint8Array(4);
    const x = Math.floor((state.currMouse.x + 1) * 0.5 * renderTarget.width);
    const y = Math.floor((state.currMouse.y + 1) * 0.5 * renderTarget.height);
    renderer.readRenderTargetPixels(renderTarget, x, y, 1, 1, pixelBuffer);

    // Check if pixel belongs to shader (e.g., non-zero alpha)
    if (pixelBuffer[3] > 0) {
      // Grow sphere
      state.size += .03*(1-state.easing_speed+0.01)
      clickable = true;
      divContainer.visible = true;
    } else {
      clickable = false;
      divContainer.visible = false;
    }
  } else {
    intersected = false;
    clickable = false;
    divContainer.visible = false;
  }
  stats.update();
  //screenShake.update(camera);
  controls.update();
  labelRenderer.render(scene, camera)
  composer.render(scene, camera);
}

		