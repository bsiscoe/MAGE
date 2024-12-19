// TO DO 

// something...
// tweakpane skybox folder
// fix controllingAudio playback rate logic
// add more threejs effects
// bloom and tone mapping 
// fix bloom 
// save camera properties
// add more scene presets
// add more skyboxes
// adjust tweakpane ui to not have unnecessary values and have more
// RANDOM TWEAK PANE VALUES
// better randomization and more fx


import { 
  Scene, 
  SphereGeometry, 
  BoxGeometry,
  PlaneGeometry,
  BackSide,
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
  AudioLoader, 
  AudioAnalyser,
  TextureLoader, 
  CubeTextureLoader,
  CineonToneMapping,
  LinearToneMapping,
  ReinhardToneMapping,
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
import {CSS2DRenderer, CSS2DObject} from 'three/addons/renderers/CSS2DRenderer'
import Stats from 'three/addons/libs/stats.module'

//////////////////////
///GLOBAL VARIABLES///
//////////////////////
{
window.TIME_MULTIPLIER = 1.0;
var screenShake = ScreenShake();
var scene;
var renderer;
var composer;
var camera;
var stats;
var skybox;
var renderTarget;
var rtScene;
var rtCamera;
var controls;
var clock;
var tooltipUI;
var img;
var audioFile;
var listener;
var labelRenderer;
var audioBuffer;
var reversedAudio;
var shader_index = -1;
var timeIncreasing = true;
var pointer = new Vector2();
var fileInput = document.getElementById('file');
var visualizer = {
    path : null,
    mesh : null,
    shader : null,
    analyser : null,
    scale : 10.0,
    intersected : false,
    clickable : false,
    controllingAudio : false,
    render_tooltips : true
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
  enabled : false,
}
var RGBShift = {
    shader : new ShaderPass(RGBShiftShader),
    scale : 0.0015,
    enabled : false,
}
var dotShader = {
    shader : new ShaderPass(DotScreenShader),
    scale : 4.0,
    enabled : false,
}

  
}

// shaderpark preset shaders
let shaders = [
  'default', 
  'og', 
  'react', 
  'example', 
  'test', 
  'test2', 
  'test3'
]

// threejs effects list
let effects = [
  bloom, RGBShift, dotShader
];

// visualizer and control states
let state = {
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
    rotate_toggle : true,
    autorotateSpeed : 0.2,
    camTilt : 0.0,
}

// preset states
const DEFAULT_PRESET_COUNT = 8;
window.presetManager = {
  userPresetCount : +(localStorage.getItem('userPresetCount') || 0),
  currentPreset : 0, // default scene
  currentlyLoadingPreset : false,
}

////////////////
/// THREE JS ///
////////////////

window.addEventListener('load', () => {
  createScene();

  loadVisualizer(true); // true selects default from the array

  applyPostProcessing();

  initTweakpane();

  eventSetup();

  loadDefaultPreset();

  if (getOS() !== ('Windows' || 'Mac OS' || 'Linux')) 
    switchControls(); // call switchControls if not on a PC
    
  render();
});

const getOS = () => {
  const userAgent = window.navigator.userAgent,
      platform = window.navigator?.userAgentData?.platform || window.navigator.platform,
      macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
      windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
      iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  let os = null;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'Mac OS';
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'iOS';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (/Linux/.test(platform)) {
    os = 'Linux';
  }

  return os;
}

const switchControls = () => {
  // force onscreen controls to show
  visualizer.render_tooltips = false;
  window.pane.hidden = true;
  const buttonsContainer = document.querySelector('.ui_buttons');
  buttonsContainer.style.display = buttonsContainer.style.display == 'flex' ? 'none' : 'flex';
  const bgContainer = document.querySelector('.ui_bgs');
  bgContainer.style.display = bgContainer.style.display == 'block' ? 'none' : 'block';
  let hideUIbutton = document.getElementById('ui_hide');
  hideUIbutton.style.display = 'none';
}

const applyPostProcessing = () => {
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

const loadVisualizer = (choosing_from_array, using_cookie_data) => {

  console.log("Loading visualizer... ")

  // remove old mesh
  scene.remove( visualizer.mesh );

  // SHADER
  if (!using_cookie_data) {
    visualizer.shader = choosing_from_array ? 
                      generateshaderparkcode(shaders[++shader_index]) : 
                      generateshaderparkcode('generated');

    console.log(choosing_from_array ? 
              shaders[shader_index] + " selected" : 
              "Shader successfully generated");

  } else {
    visualizer.shader = using_cookie_data;
  }

  createMeshes();
}

const createMeshes = () => {
    // add shader to geometry
    var geometry  = new SphereGeometry(160, 60, 60);
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
    // Render target for Shader Park output for object picking
    renderTarget = new WebGLRenderTarget(window.innerWidth/8, window.innerHeight/8, { // use quarter res to save frames
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

    console.log("Visualizer Loaded!")
}

const loadSkybox = (texturePath) => {
    visualizer.path = texturePath;
    const loader = new CubeTextureLoader();
    loader.setPath(texturePath);
    let texture = loader.load( [
      'sky_left.jpg','sky_right.jpg',

      'sky_up.jpg','sky_down.jpg',

      'sky_front.jpg','sky_back.jpg',
    ] );
    scene.background = texture;

    // var geometry  = new SphereGeometry(10000, 60, 60);
    // var skybox = createSculptureWithGeometry(geometry, generateshaderparkcode('background'), () => {
    //   return {
    //     time : state.time,
    //     _scale: visualizer.scale
    //   }
    // })
    // scene.add(skybox);
}

const loadAudio = (event, filePath) => {
  const previousVolume = audio?.getVolume();

  // pause previous audio
  audio?.pause();
  reversedAudio?.pause();

  // create an Audio source
  audio = new Audio( listener );
  audio.setVolume(previousVolume || 1.0);
  audio.setLoop(false);

  // create reversed audio source
  reversedAudio = new Audio( listener )
  reversedAudio.setVolume(previousVolume || 1.0);
  reversedAudio.setLoop(false);

  visualizer.analyser = new AudioAnalyser( audio, 64 );   // create an AudioAnalyser, passing in the sound and desired fftSize

  const audioLoader = new AudioLoader();
  
  audioLoader.load( 
      filePath, 
      
      function( buffer ) {
        audio.setBuffer(buffer);
  
        reversedAudio.setBuffer(reverseAudioBuffer(buffer, listener.context));
      }, 
      function ( xhr ) {
        //console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
      }, 
      function ( err ) {
        console.log('No audio found - Choosing a file');
        // uploading a file
        fileInput.addEventListener( 'change', function( event ) {
          var reader = new FileReader();
          reader.addEventListener( 'load', function ( event ) {
            audioBuffer = event.target.result;
            audio.context.decodeAudioData( audioBuffer, function ( buffer ) {
              audio.setBuffer( buffer );
              reversedAudio.setBuffer(reverseAudioBuffer(buffer, audio.context));
            });     
          });
          audioFile = event.target.files[0];
          reader.readAsArrayBuffer( audioFile );
        });
        fileInput.click();
        audio.autoplay = true;
      }
  );
}

const reverseAudioBuffer = (buffer, audioContext) => {
  const reversedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);
    for (let i = 0; i < originalData.length; i++) {
      reversedData[i] = originalData[originalData.length - 1 - i];
    }
  }

  return reversedBuffer;
}

const initTweakpane = () => {
  const pane = new Pane();
  pane.on('change', function () { // make save button show up if changed
    if (presetManager.currentPreset < DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1 && !presetManager.currentlyLoadingPreset) {
      presetManager.currentPreset = DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1 
      handleUI(presetManager.currentPreset); 
    }
  });

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
    vizui.addBinding(state, 'minimizing_factor', {min:0.01, max:2.00, label:'MOD 1'});
    vizui.addBinding(state, 'power_factor', {min:1.0, max:10.0, label:'MOD 2'});
    vizui.addBinding(state, 'base_speed', {min: 0.01, max: 0.9, label: 'Base Speed'})
    vizui.addBinding(state, 'easing_speed', {min: 0.01, max: .9, label: 'Easing Speed' })
    vizui.addBinding(visualizer, 'scale', {min: 1, max: 200.0, label: 'scale'});
    vizui.addBinding(window, 'TIME_MULTIPLIER', {min: 0.1, max: 100, label: 'Time'});
    vizui.addBinding(controls, 'autoRotate', {label: 'Auto Rotate'});
    vizui.addBinding(controls, 'autoRotateSpeed', {min: 0.1, max: 10.0, label: 'Rotation Speed'})

    // bloom ui
    const bloomui = pane.addFolder({title: 'Bloom Settings'}).on('change', () => {
      updateBloom();
    })
    bloomui.addBinding(bloomSettings, 'strength', {min: 0.0, max: 10.0, label: 'Strength' });
    bloomui.addBinding(bloomSettings, 'radius', {min: -10.0, max: 10.0, label: 'Radius' });
    bloomui.addBinding(bloomSettings, 'threshold', {min: 0.0, max: 10.0, label: 'Threshold' });
    bloomui.addBinding(bloom, 'enabled', {label: 'Enable Bloom'})

    const ppui = pane.addFolder({title: 'Post Processing Effects'}).on('change', () => {
      applyPostProcessing();
    });
    ppui.addBinding(renderer, 'toneMappingExposure', {min: -500.0, max: 500.0, label: 'Exposure' });
    ppui.addBinding(RGBShift, 'enabled', {label: 'RGBShift Shader'})
    ppui.addBinding(dotShader, 'enabled', {label: 'Enable Dot Shader'})

    // camera ui
    const camui = pane.addFolder({title: 'Camera Settings'}).on('change', (ev) => {
      camera.updateProjectionMatrix();
    });
    camui.addBinding(camera, 'fov', {min: 1, max: 359, label: 'FOV'});
    camui.addBinding(state, 'camTilt', {min: 0.0, max: .15, label: 'Camera Orientation'}).on('change', () => {
      // const x = Math.cos(state.camTilt) * camera.up.x - Math.sin(state.camTilt) * camera.up.y;
      // const y = Math.sin(state.camTilt) * camera.up.x + Math.cos(state.camTilt) * camera.up.y;
      // camera.up.set(x, y, camera.up.z);       // set up
      // camera.lookAt(0, 0, 0);        // now call lookAt
    })
    camui.addButton({
      title: 'Reset',
      label: 'Camera Position'
    }).on('click', () => {
      controls.reset();
    })
    window.pane = pane;
    window.pane.hidden = true;
}

const updateBloom = () => {
  bloom.shader = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    bloomSettings.strength,
    bloomSettings.radius,
    bloomSettings.threshold
  )
  applyPostProcessing();
}

const createScene = () => {
  // initialize scene
  scene = new Scene();

  // initialize camera
  camera = new PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 100000 );
  camera.position.z = 5.5;

  // init audio listener
  listener = new AudioListener();
  camera.add( listener );    

  // initialize renderer
  renderer = new WebGLRenderer({ antialias: true, transparent: true, premultipliedAlpha : false });
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setClearColor( new Color(1, 1, 1), 0);
  renderer.toneMapping = CineonToneMapping;
  renderer.toneMappingexposure = toneMapping.exposure;
  renderer.outputColorSpace = SRGBColorSpace;
  document.body.appendChild( renderer.domElement );

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
  img.src = '../resources/middlemouse.png';
  const div = document.createElement('div')
  div.appendChild(img)
  tooltipUI = new CSS2DObject(div);
  tooltipUI.scale.set(0.2,0.2,0.2)
  tooltipUI.position.set(0,2,0)
  scene.add(tooltipUI)

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

const loadDefaultPreset = () => {
  presetManager.currentPreset = 0;
  let presetPath = `../resources/preset0/`;
  loadSkybox(presetPath);
  loadAudio(null, presetPath + '0.mp3'); // blank audio file
}

const getRandomPreset = () => {
    // select a random preset
    let randomNumber = Math.ceil(Math.random() * (DEFAULT_PRESET_COUNT + presetManager.userPresetCount));
    while (localStorage.getItem('preset'+randomNumber) === null && randomNumber > DEFAULT_PRESET_COUNT) {
      randomNumber = Math.ceil(Math.random() * (DEFAULT_PRESET_COUNT + presetManager.userPresetCount));
    }
    document.getElementById(`preset${randomNumber}`).click();
    audio.autoplay = true;
    presetManager.currentPreset = DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1;
    loadVisualizer(false, false);
    handleUI(presetManager.currentPreset);
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

}
      
function shake() {
      	screenShake.shake( camera, new Vector3(5, 0, 0),5 );
}

const eventSetup = () => {

  // resizing window event
  window.addEventListener( 'resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    labelRenderer.setSize(this.window.innerWidth, this.window.innerHeight);
  });

  // Mouse events
  window.addEventListener( 'pointermove', (event) => {
    state.currMouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    state.currMouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    // control audio playback rate and volume
    if (visualizer.controllingAudio) {
      // const playbackRate = state.currMouse.x * 2;
    
      // // Get the audio context from the listener
      // const audioContext = audio.listener.context;
    
      // if (playbackRate < 0) {
      //   // Set the playback rate for reversed audio
      //   reversedAudio.setPlaybackRate(Math.abs(playbackRate)); 
    
      //   // If reversed audio is not playing, start it from the corresponding position
      //   if (!reversedAudio.isPlaying) {
      //     // Stop the normal audio
      //     audio.stop(); 
    
      //     // Set the offset for reversed audio
      //     reversedAudio.offset = reversedAudio.buffer.duration - audio.context.currentTime;
    
      //     // Start reversed audio from calculated position
      //     reversedAudio.play();
      //     reversedAudio.isPlaying = true;
      //   }
      // } else {
      //   // Set the playback rate for normal audio
      //   audio.setPlaybackRate(playbackRate); 
    
      //   // If normal audio is not playing, start it from the corresponding position
      //   if (!audio.isPlaying) {
      //     // Stop the reversed audio
      //     reversedAudio.stop(); 
    
      //     // Set the offset for normal audio
      //     audio.offset = reversedAudio.context.currentTime;
    
      //     // Start normal audio from calculated position
      //     audio.play();
      //   }
      // }
    
    

        // shrink the orb for feedback
        state.volume_multiplier = state.currMouse.y * 2
        //camera.fov += state.currMouse.y
        state.base_speed = Math.max(0.1, Math.min(0.9, state.base_speed+state.mouse.y/50))
        state.minimizing_factor = Math.max(0.01, Math.min(1.0, state.minimizing_factor+state.currMouse.y/100));
        visualizer.scale = Math.max(1.0, Math.min(30.0, visualizer.scale+state.currMouse.y));
        audio.setVolume(Math.max(0.0, Math.min(1.0, audio.getVolume() + state.currMouse.y/5))); //state.currMouse.y * .2
    }
    tooltipUI.visible = false;
    visualizer.clickable && visualizer.render_tooltips && (tooltipUI.visible = true);
  });
  
  window.addEventListener( 'pointerdown', (event) => {
    state.currPointerDown = 1.0;
    
    if (!visualizer.clickable) {
      return;
    }
    
    controls.enabled = false;
    if (event.button == 1) { 
      visualizer.controllingAudio = true;
      img.src = '../resources/controltips2.png';
    }

    if (event.button == 2) {
      visualizer.render_tooltips = true;
      tooltipUI.visible = true;
      window.pane.hidden = true;
      const buttonsContainer = document.querySelector('.ui_buttons');
      buttonsContainer.style.display = buttonsContainer.style.display == 'flex' ? 'none' : 'flex';
      const bgContainer = document.querySelector('.ui_bgs');
      bgContainer.style.display = bgContainer.style.display == 'block' ? 'none' : 'block';
    }
  });

  window.addEventListener( 'pointerup', (event) => {
    img.src = "../resources/controltips.png";
    visualizer.controllingAudio = false;
    controls.enabled = true;
    audio.setPlaybackRate(1);
    reversedAudio.pause();
    state.currPointerDown = 0.0;
    
    // clicked outside of visualizer
    if (!visualizer.intersected || !visualizer.clickable) {
      return;
    }
    
    if (event.button == 0) {
      if (presetManager.currentPreset == 0) getRandomPreset();
      if (!audio.isPlaying) audio.play(); else audio.pause();
    }

    if (event.button == 1) {
      reversedAudio.pause()
      audio.play();
    }
  }); 

  // scroll event
  window.addEventListener("wheel", (event) => {
    // console.log(event.deltaY)
    // if (intersected && clickable) {
    //   controls.enabled = false;
    //   audio.setVolume(Math.max(0.0, Math.min(1.0, audio.getVolume() - event.deltaY/5000)));
    // }
    // controls.enabled = true;
  })

  // generate button
  document.getElementById('ui_regenerate').addEventListener('click', function() {
    loadVisualizer(false);
    presetManager.currentPreset = DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1;
    handleUI(presetManager.currentPreset);
  });

  // Delete button - ONLY WORKS FOR USER CREATED PRESETS
  let deleteButton = document.getElementById('ui_delete');
  deleteButton.style.display = 'none';
  deleteButton.addEventListener('click', function() {
    const userConsent = confirm("Are you sure you would like to delete this preset?");
    if (userConsent) {
      localStorage.removeItem('preset'+presetManager.currentPreset);
      const buttonElement = document.getElementById(`preset${presetManager.currentPreset}`);
      if (buttonElement) {
        buttonElement.closest('.ui.ui_bg').remove();
      }
      presetManager.userPresetCount--;
      getRandomPreset();
    }
  });

  // Save button
  let saveButton = document.getElementById('ui_save');
  saveButton.style.display = 'none';
  saveButton.addEventListener('click', function() {
    const userConsent = confirm("Do you allow cookies to store your data?");
    if (userConsent) {
      try {
        presetManager.userPresetCount++;
        let jsonString = bundleSceneIntoJSON();
        localStorage.setItem('preset'+presetManager.currentPreset, jsonString);
        localStorage.setItem('userPresetCount', presetManager.userPresetCount);
        createPresetButton(presetManager.currentPreset, true);
        alert("Cookie has been saved.  " + 'preset'+presetManager.currentPreset);
        handleUI(presetManager.currentPreset);
      } catch (error) {
          presetManager.userPresetCount--;
          alert("Error Saving Cookie! " + error.message);
      }
    } else {
      alert("Got it. No Cookie will be saved.");
    }
    this.blur(); // Removes focus from the button
  });

  // upload button
  document.getElementById('ui_upload').addEventListener('click', function() {
    loadAudio();
  });

  // hide ui button
  document.getElementById('ui_hide').addEventListener('click', function() {
    visualizer.render_tooltips = false;
    window.pane.hidden = true;
    stats.dom.style.display = 'none';
    const buttonsContainer = document.querySelector('.ui_buttons');
    buttonsContainer.style.display = buttonsContainer.style.display == 'flex' ? 'none' : 'flex';
    const bgContainer = document.querySelector('.ui_bgs');
    bgContainer.style.display = bgContainer.style.display == 'block' ? 'none' : 'block';
  });

  // tweakpane settings button
  document.getElementById('ui_settings').addEventListener('click', function() {
    window.pane.hidden = !window.pane.hidden;
    stats.dom.style.display = stats.dom.style.display == 'none' ? 'block' : 'none';
  });

  // copy button
  document.getElementById('ui_copy').addEventListener('click', function() {
    let jsonString = bundleSceneIntoJSON();
    navigator.clipboard.writeText(jsonString)
    .then(() => {
      console.log("JSON copied to clipboard");
      alert('Scene copied to clipboard, you can now share it with others!');
    })
    .catch(err => {
      console.error("Failed to copy JSON: ", err);
      alert('Error copying to clipboard: ' + err);
    });
  });

  // preset button
  document.getElementById('ui_load').addEventListener('click', function() {
    let text = prompt("Enter your copied code: ");
    if (text !== null) {
      // Do something with the entered text
      loadPreset(text);
    }
    presetManager.currentPreset = DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1;
    handleUI(presetManager.currentPreset);
  });

  // scene preset buttons
  for (let presetNumber = 1; presetNumber <= (DEFAULT_PRESET_COUNT + presetManager.userPresetCount); presetNumber++) {   // make one for each preset
    createPresetButton(presetNumber);
  }
}

const bundleSceneIntoJSON = () => {
  controls.saveState();// save camera position
  const { target0, position0, zoom0 } = controls;
  const state = { target0, position0, zoom0 };
  let data = {
    shader: visualizer.shader,
    path: visualizer.path,
    settings: window.pane.exportState(),
    controls: state,
    camera: camera
  }
  console.log(data.controls)
  return JSON.stringify(data);
}

const handleUI = (presetNumber) => {
  if (presetNumber <= DEFAULT_PRESET_COUNT) {
    document.getElementById('ui_save').style.display = 'none';
    document.getElementById('ui_delete').style.display = 'none';
  } else {
    document.getElementById('ui_save').style.display = localStorage.getItem('preset'+presetNumber) === null ? 'block' : 'none';
    document.getElementById('ui_delete').style.display = localStorage.getItem('preset'+presetNumber) !== null ? 'block' : 'none';
  }
}

const createPresetButton = (presetNumber, isNewButton) => {
  // if this cookie has been deleted do not make a button
  if (presetNumber > DEFAULT_PRESET_COUNT && 
    !isNewButton && 
    localStorage.getItem('preset'+presetNumber) === null) 
  {
    return;
  }

  document.querySelector('.ui_bgs').insertAdjacentHTML('beforeend', createDivSceneButton(presetNumber)); // chatgpt
  document.getElementById(`preset${presetNumber}`).addEventListener('click', () => {
    if (presetNumber <= DEFAULT_PRESET_COUNT) { // is default preset
      fetch(`../resources/preset${presetNumber}/preset.json`)       // fetch the preset files
        .then(response => response.json())
        .then(data => {
          const jsonString = JSON.stringify(data);
          loadPreset(jsonString);
        })
        .catch((error) => {
          console.error('Error loading preset:', error);
        });
    } else {
      let data = localStorage.getItem('preset'+presetNumber);
      loadPreset(data);       // load a user preset
    }


    console.log(`Loading Preset: ${presetNumber}`);

    presetManager.currentPreset = presetNumber;

    handleUI(presetManager.currentPreset);
  });

  function createDivSceneButton(presetNumber) {
    const userPresetIcon = 'scene_grad08'
    
    // template presets
    if (!(presetNumber > DEFAULT_PRESET_COUNT)) {
      return `  
      <div class="ui ui_bg">
        <button class="ui_bg_item scene_grad05" id="preset${presetNumber}"></button>
        <div class="ui_bg_label" id="preset${presetNumber}Label">${presetNumber}</div>
        <div style="clear:both;"></div>
      </div> 
      `;   
    } 

    // user presets
    if (!(presetNumber > DEFAULT_PRESET_COUNT + presetManager.userPresetCount)) {
      return `  
      <div class="ui ui_bg">
        <button class="ui_bg_item ${userPresetIcon}" id="preset${presetNumber}"></button>
        <div class="ui_bg_label" id="preset${presetNumber}Label">${presetNumber}</div>
        <div style="clear:both;"></div>
      </div> 
      `;  
    }
  
    // create a button to restore this scene
    return `  
      <div class="ui ui_bg">
        <button class="ui_bg_item ${userPresetIcon}" id="preset${presetNumber}"></button>
        <div class="ui_bg_label" id="preset${presetNumber}Label">${presetNumber}</div>
        <div style="clear:both;"></div>
      </div> 
      `;   
  }
}

const loadPreset = (jsonInput) => {
  presetManager.currentlyLoadingPreset = true;
  let preset = JSON.parse(jsonInput);
  loadSkybox(preset.path);
  loadVisualizer(false, preset.shader);
  loadControls(preset.controls);
  window.pane.importState(preset.settings);
  updateBloom();
  if (typeof audioFile === 'undefined') loadAudio(null, preset.path + '.mp3');
  audio.autoplay = true;
  presetManager.currentlyLoadingPreset = false;
}

const loadControls = (presetControls) => {
  if (presetControls) {
    const { target0, position0, zoom0 } = presetControls;
    controls.target0.copy(target0);
    controls.position0.copy(position0);
    controls.zoom0 = zoom0;
    controls.reset();
  }
};

const growVisualizer = () => {
  state.size += .03*(1-state.easing_speed+0.01);
}

const render = () => {
  requestAnimationFrame( render );
  
  // alternates flow of time to prevent animation bugs
  if ((state.time < 180) && timeIncreasing) { // 3 minutes
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
  if (audio.isPlaying) {
    if (timeCalc > 5.0) {
      document.title = "MAGE - Playing Audio...";
    } else {
      document.title = "MAGE - Playing Audio";
    }
  } else {
    document.title = "MAGE";
  }

  // use easing and linear interpolation to smoothly animate mouse effects
  state.pointerDown = .1 * state.currPointerDown + .9 * state.pointerDown;
  state.mouse.lerp(state.currMouse, .05 );

  var bass_input = 0;
  var mid_input = 0;

  // analyze audio using FFT
  if (audio != null) {
    // FFT Bucket 2
    let bass_analysis = Math.pow((visualizer.analyser.getFrequencyData()[2]/255)*state.minimizing_factor, state.power_factor);
    bass_input = bass_analysis + clock.getDelta() * state.base_speed;

    // TO DO : FFT MID AND HIGH
    let mid_analysis = Math.pow((visualizer.analyser.getFrequencyData()[4]/255)*state.minimizing_factor, state.power_factor);
    mid_input = mid_analysis + clock.getDelta() * state.base_speed;
  }

  // combine analysis for now
  // TO DO 
  //bass_input += mid_input;

  // add audio input to states
  let val = Math.sin(state.time)*(state.size)*0.02+0.1;
  state.currAudio = bass_input + val *state.base_speed + clock.getDelta() * state.base_speed;
  state.size = (1-state.easing_speed) * state.currAudio + state.easing_speed * state.size + state.volume_multiplier*.01;
  if (bass_input > 0.3) {
    shake();
  }

  // ONLY CHECK PIXEL IF IT INTERSECTS

  if (controls.enabled && getOS() === ('Windows' || 'Mac OS' || 'Linux')) {
    let raycaster = new Raycaster();
    raycaster.setFromCamera(state.currMouse, camera);
    let intersects = raycaster.intersectObject(visualizer.mesh);
    if ( intersects.length > 0) {
      visualizer.intersected = true;
        
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
        growVisualizer();
        visualizer.clickable = true;
      } else {
        visualizer.clickable = false;
      }
    } else {
      visualizer.intersected = false;
      visualizer.clickable = false;
    }
  }

  stats.update();
  screenShake.update(camera);
  controls.update();
  if (visualizer.render_tooltips) labelRenderer.render(scene, camera);
  composer.render(scene, camera);
}

// Initialize the up vector
let up = new THREE.Vector3(0, 1, 0);
const speed = 0.5; // Rotation speed

function updatecamTilt(time) {
    const angle = time * speed;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Rotate the up vector around the z-axis
    

    // Apply the updated up vector to a camera or object if needed
    // camera.up.copy(up).normalize(); // Uncomment if used with a camera
}
		