// TO DO 

// shaders can be less twisty when grid and ALSO
// more effects bindings
// kaleidoscope stretching (not currently fixable)
// make more presets
// add more threejs effects
// finalize video demo
// add more skyboxes
// skybox upload
// fix controllingAudio playback rate logic WHY ME DAWG
// adjust tweakpane ui to not have unnecessary values and have more

import { 
  Quaternion,
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
  AudioContext,
  AudioLoader, 
  AudioAnalyser,
  TextureLoader, 
  CubeTextureLoader,
  LoadingManager,
  Raycaster,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
  SRGBColorSpace,
  NoToneMapping,
  LinearToneMapping,
  ReinhardToneMapping,
  CineonToneMapping,
  ACESFilmicToneMapping,
  AgXToneMapping,
  NeutralToneMapping,
  CustomToneMapping,
  HalfFloatType } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { createSculptureWithGeometry } from 'https://unpkg.com/shader-park-core/dist/shader-park-core.esm.js';
import { generateshaderparkcode } from './generateshaderparkcode.js';
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer'
import Stats from 'three/addons/libs/stats.module'
import { reverseAudioBuffer } from './helpers.js';
import effects from './effects.js';
import {ToonShader1,
  ToonShader2,
  ToonShaderHatching,
  ToonShaderDotted} from 'three/addons/shaders/ToonShader.js';


{

//////////////////////
///GLOBAL VARIABLES///
//////////////////////
{
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
  var tooltipUI;
  var tooltipImage;
  var audioFile;
  var listener;
  var tooltipRenderer;
  var audioBuffer;
}
window.TIME_MULTIPLIER = 1.0;

let shader_index = -1;

let timeIncreasing = true;

let fileInput = document.getElementById('file');

let audio = null;
let reversedAudio = null;
let playbackTime = 0; // Tracks current playback time manually
let isReversed = false;

let visualizer = {
    path : '',
    mesh : null,
    shader : null,
    analyser : null,
    scale : 10.0,
    intersected : false,
    clickable : false,
    controllingAudio : false,
    render_tooltips : true
};

// shaderpark preset shaders
let shaders = [
  'default', 
  'dev',
  'og', 
  'react', 
  'example', 
  'test', 
  'test2', 
  'test3'
]

let inputs = {
  currMouse : new Vector3(),
  pointerDown: 0.0,
  currPointerDown: 0.0,
}

// visualizer and control states
let state = {
    mouse : new Vector3(),
    currMouse : new Vector3(),
    size : 0.0,
    pointerDown: 0.0,
    pointerDownMultiplier: 0.0,
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
const DEFAULT_PRESET_COUNT = 9;
const SKYBOX_COUNT = 9;
window.presetManager = {
  userPresetCount : +(localStorage.getItem('userPresetCount') || 0),
  currentPreset : 0, // default scene
  currentlyLoadingPreset : false,
}

window.selectNextPreset = function() {
  loadVisualizer(true);
}

////////////////
/// THREE JS ///
////////////////

window.addEventListener('load', () => {
  createScene();

  composer = effects.applyPostProcessing(scene, renderer, camera);

  initTweakpane();

  eventSetup();

  createPresetButtons();

  loadDefaultPreset();

  if (getOS() !== ('Windows' || 'Mac OS' || 'Linux')) 
    switchControls(); // call switchControls if not on a PC
    
  render();
});

const createScene = () => {
  // initialize scene
  scene = new Scene();

  // initialize camera
  camera = new PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 100000 );
  camera.position.z = 5.5;
  camera.lookAt(0,10,100)

  // init audio listener
  listener = new AudioListener();
  camera.add( listener );    

  // initialize renderer
  renderer = new WebGLRenderer({
  });
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setClearColor( new Color(1, 1, 1), 0);
  renderer.toneMappingexposure = effects.toneMapping.exposure; 
  renderer.outputColorSpace = SRGBColorSpace;
  document.body.appendChild( renderer.domElement );

  stats = new Stats();
  document.body.appendChild(stats.domElement);
  stats.dom.style.display = 'none';

  // initialize 2D renderer
  tooltipRenderer = new CSS2DRenderer();
  tooltipRenderer.setSize(window.innerWidth, window.innerHeight)
  tooltipRenderer.domElement.style.position = 'absolute'
  tooltipRenderer.domElement.style.top = '0px'
  tooltipRenderer.domElement.style.pointerEvents = 'none'
  document.body.appendChild(tooltipRenderer.domElement)

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

    // add in tooltip ui
    tooltipImage = document.createElement('img');
    tooltipImage.src = 'https://bsiscoe.github.io/MAGE/resources/middlemouse.png';
    const div = document.createElement('div')
    div.appendChild(tooltipImage)
    tooltipUI = new CSS2DObject(div);
    tooltipUI.scale.set(0.05,0.05,0.05)
    scene.add(tooltipUI)
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

const randomizeSettings = () => {
  state.minimizing_factor = Math.random() * 1.99 + 0.01;
  state.power_factor = Math.random() * 9 + 1;
  state.pointerDownMultiplier = Math.random();
  state.base_speed = Math.random() * 0.89 + 0.01;
  state.easing_speed = Math.random() * 0.89 + 0.01;
  state.scale = Math.random() * 199 + 1;
  state.autoRotate = Math.random() > 0.5 ? true : false;
  state.autorotateSpeed = Math.random() * 49.9 + 0.1

  effects.bloom.settings.enabled = Math.random() > 0.5 ? true : false;
  if (effects.bloom.settings.enabled) {
    effects.bloom.settings.strength = Math.random() * 10;
    effects.bloom.settings.radius = Math.random() * 20 - 10;
    effects.bloom.settings.threshold = Math.random() * 10;
  }

  effects.toneMapping.method = Math.ceil(Math.random() * 7);
  effects.toneMapping.exposure = 1.0;
  effects.RGBShift.enabled = Math.random() > 0.5 ? true : false;
  effects.sobelShader.enabled = Math.random() > 0.7 ? true : false;
  effects.luminosityShader.enabled = Math.random() > 0.75 ? true : false;
  effects.kaleidoShader.enabled = Math.random() > 0.85 ? true : false;
  effects.gammaCorrectionShader.enabled = Math.random() > 0.75 ? true : false;
  effects.halftonePass.enabled = Math.random() > 0.75 ? true : false;
  effects.colorifyShader.enabled = Math.random() > 0.75 ? true : false;

  window.pane.refresh();
  composer = effects.applyPostProcessing(scene, renderer, camera, composer);
}

const initTweakpane = () => {
    const pane = new Pane();
    pane.on('change', function () { // make save button show up if changed
      if (presetManager.currentPreset < DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1 && !presetManager.currentlyLoadingPreset) {
        presetManager.currentPreset = DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1 
        handleUI(presetManager.currentPreset); 
      }
    });

    pane.addButton({
      title: 'Randomize',
      label: '???'
    }).on('click', () => {
      randomizeSettings();
      window.pane.refresh();
    });

    // get skybox paths
    let skyboxOptions = {};
    for (let i = 1; i <= SKYBOX_COUNT; i++) {
      skyboxOptions[`${i}`] = `https://bsiscoe.github.io/MAGE/resources/preset${i}/`;
    }

    // add skybox paths to tweakpane
    pane.addBinding(visualizer, 'path', {
      label: 'Skybox',
      options: skyboxOptions,
    }).on('change', () => {
      loadSkybox(visualizer.path);
    });

    // visualizer ui
    const firstTab = pane.addTab({
      pages: [
        {title: 'Scene Settings'},
        {title: 'Post Processing'},
      ],
    });

    {
      const vizui = firstTab.pages[0]; 
      
      vizui.addBinding(state, 'minimizing_factor', {min:0.01, max:2.00, label:'MOD 1'});
      vizui.addBinding(state, 'power_factor', {min:1.0, max:10.0, label:'MOD 2'});
      vizui.addBinding(state, 'pointerDownMultiplier', {min: 0.0, max: 1.0, label: 'MOD 3'});
      vizui.addBinding(state, 'base_speed', {min: 0.01, max: 0.9, label: 'Base Speed'})
      vizui.addBinding(state, 'easing_speed', {min: 0.01, max: .9, label: 'Easing Speed' })
      vizui.addBinding(visualizer, 'scale', {min: 1, max: 200.0, label: 'scale'});
      vizui.addBinding(window, 'TIME_MULTIPLIER', {min: 0.1, max: 100, label: 'Time'});
      vizui.addBinding(controls, 'autoRotate', {label: 'Auto Rotate'});
      vizui.addBinding(controls, 'autoRotateSpeed', {min: 0.1, max: 50.0, label: 'Rotation Speed'})
    }

    // bloom ui
    {
      const bloomui = firstTab.pages[1].addFolder({title: 'Bloom Settings'}).on('change', () => {
        setTimeout(()=>{composer = effects.applyPostProcessing(scene, renderer, camera, composer)}, 10);
      })
      bloomui.addBinding(effects.bloom.settings, 'strength', {min: 0.0, max: 10.0, label: 'Strength' });
      bloomui.addBinding(effects.bloom.settings, 'radius', {min: -10.0, max: 10.0, label: 'Radius' });
      bloomui.addBinding(effects.bloom.settings, 'threshold', {min: 0.0, max: 10.0, label: 'Threshold' });
      bloomui.addBinding(effects.bloom, 'enabled', {label: 'Enable Bloom'})
    }

    // post processing ui
    {
      const ppui = firstTab.pages[1].addFolder({title: 'Post Processing Effects'}).on('change', () => {
        setTimeout(()=>{composer = effects.applyPostProcessing(scene, renderer, camera, composer)}, 10);
      });
      // tone mapping
      {
        ppui.addBinding(effects.toneMapping, 'method', {
          label: 'ToneMapping',
          options: {
             Linear : LinearToneMapping,
             Cineon : CineonToneMapping,
             Filmic : ACESFilmicToneMapping,
             NoTone : NoToneMapping,
             Reinhard : ReinhardToneMapping,
             AGX : AgXToneMapping,
             Neutral : NeutralToneMapping,
             //Custom : CustomToneMapping,
          }
        }).on('change', () => {
          effects.outputPass.enabled = true; 
          composer = effects.applyPostProcessing(scene, renderer, camera, composer);
          renderer.toneMapping = effects.toneMapping.method;
          pane.refresh();
        });
        ppui.addBinding(renderer, 'toneMappingExposure', {min: -500.0, max: 500.0, label: 'Exposure' });
      }

      const pptab = ppui.addTab({
        pages: [
          {title: 'Effect Enabled'},
          {title: 'Effect Settings'},
        ],
      });
      
      let rgbShiftAmount = pptab.pages[1].addBinding(effects.RGBShift.shader.uniforms.amount, 'value', {min: 0, max: 0.1, label: 'RGB Shift'});
      let rgbShiftAngle = pptab.pages[1].addBinding(effects.RGBShift.shader.uniforms.angle, 'value', {min: 0, max: Math.PI * 2, label: 'Angle'});
      rgbShiftAmount.hidden = true;
      rgbShiftAngle.hidden = true;
      pptab.pages[0].addBinding(effects.RGBShift, 'enabled', {label: 'RGBShift'}).on('change', ()=>{
        if (effects.RGBShift.enabled) {
          rgbShiftAmount.hidden = false;
          rgbShiftAngle.hidden = false;
        } else {
          rgbShiftAmount.hidden = true;
          rgbShiftAngle.hidden = true;
        }
      });
      pptab.pages[0].addBinding(effects.dotShader, 'enabled', {label: 'Dot FX'});
      pptab.pages[0].addBinding(effects.technicolorShader, 'enabled', {label: 'Technicolor'});
      pptab.pages[0].addBinding(effects.luminosityShader, 'enabled', {label: 'Luminosity'});
      let afterImageDamp = pptab.pages[1].addBinding(effects.afterImagePass.shader.uniforms.damp, 'value', {
        min: 0.0,
        max: 1.0,
        label: "After Image Damp",
      });
      afterImageDamp.hidden = true;
      pptab.pages[0].addBinding(effects.afterImagePass, 'enabled', {label: 'After Image'}).on('change', ()=>{
        effects.afterImagePass.enabled ? afterImageDamp.hidden = false : afterImageDamp.hidden = true;
      });
      pptab.pages[0].addBinding(effects.sobelShader, 'enabled', {label: 'Sobel'}).on('change', () => {
        effects.sobelShader.shader.uniforms[ 'resolution' ].value.x = window.innerWidth * window.devicePixelRatio;
        effects.sobelShader.shader.uniforms[ 'resolution' ].value.y = window.innerHeight * window.devicePixelRatio;
      });

      // let glitchAmount = pptab.pages[1].addBinding(effects.glitchPass, 'size', {label: 'Glitch Amount'});
      // glitchAmount.hidden = true;
      pptab.pages[0].addBinding(effects.glitchPass, 'enabled', {label: "Glitch"}).on('change',()=>{
        // effects.glitchPass.enabled ? glitchAmount.hidden = false : glitchAmount.hidden = true;
      });
      let colorifyHue = pptab.pages[1].addBinding(effects.colorifyShader, 'color', {label: 'Colorify Hue'});
      colorifyHue.hidden = true;
      pptab.pages[0].addBinding(effects.colorifyShader, 'enabled', {label: "Colorify"}).on('change', () => {
        effects.colorifyShader.enabled ? colorifyHue.hidden = false : colorifyHue.hidden = true;
      });
      // let toonShaderChoice = pptab.pages[1].addBinding(effects.toonShader, 'toonShaderChoice', 
      //   {
      //   label: 'Toon Shader',
      //   options: {
      //     ToonShader1 : ToonShader1,
      //     ToonShader2 : ToonShader2,
      //     ToonShaderHatching : ToonShaderHatching,
      //     ToonShaderDotted : ToonShaderDotted,
      //     }
      //   });
      // toonShaderChoice.hidden = true;
      // pptab.pages[0].addBinding(effects.toonShader, 'enabled', {label: 'Toon Shader'}).on('change',()=>{
      //   effects.toonShader.enabled ? toonShaderChoice.hidden = false : toonShaderChoice.hidden = true;
      // })
      pptab.pages[0].addBinding(effects.halftonePass, 'enabled', {label: 'Halftone'});
      pptab.pages[0].addBinding(effects.gammaCorrectionShader, 'enabled', {label: 'Gamma Correction'});
      let kaleidoSides = pptab.pages[1].addBinding(effects.kaleidoShader.shader.uniforms.sides, 'value', {label: 'Kaleidoscope sides'}); 
      let kaleidoAngle = pptab.pages[1].addBinding(effects.kaleidoShader.shader.uniforms.angle, 'value', {label: 'Kaleidoscope angle'});
      kaleidoAngle.hidden = true;
      kaleidoSides.hidden = true;
      pptab.pages[0].addBinding(effects.kaleidoShader, 'enabled', {label: 'Kaleid'}).on('change', ()=>{
        if (effects.kaleidoShader.enabled) {
          kaleidoAngle.hidden = false;
          kaleidoSides.hidden = false;
        } else {
          kaleidoAngle.hidden = true;
          kaleidoSides.hidden = true;
        }
      });
      pptab.pages[0].addBinding(effects.outputPass, 'enabled', {label: 'Output Pass'});
    }

    // camera ui
    {
      const camui = pane.addFolder({title: 'Camera Settings'}).on('change', (ev) => {
        camera.updateProjectionMatrix();
      });
      camui.addBinding(camera, 'fov', {min: 1, max: 359, label: 'FOV'});
      camui.addBinding(state, 'camTilt', {min: 0.0, max: 2*Math.PI, label: 'Camera Orientation'}).on('change', () => {
        camera.up.set(Math.sin(state.camTilt), Math.cos(state.camTilt), -Math.sin(state.camTilt));
        //camera.lookAt(0, 0, 0);        // now call lookAt
      })
      camui.addButton({
        title: 'Reset',
        label: 'Camera Position'
      }).on('click', () => {
        controls.reset();
      })
    }

    // pane.addBinding(effects.outlinePass, 'enabled').on('change', () => {
    //   effects.outlinePass.init();
    // });

    pane.addBinding(effects.copyShader, 'enabled');

    window.pane = pane;
    window.pane.hidden = true;
}

function updatePlaybackTime() {
  const deltaTime = clock.getDelta();

  if (isReversed) {
    playbackTime -= deltaTime * Math.abs(reversedAudio.playbackRate);
  } else {
    playbackTime += deltaTime * audio.playbackRate;
  }

  // Clamp playback time to buffer duration
  playbackTime = Math.max(0, Math.min(audio.buffer.duration, playbackTime));
}

const eventSetup = () => {

  // resizing window event
  window.addEventListener( 'resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    tooltipRenderer.setSize(window.innerWidth, window.innerHeight);
    composer = effects.applyPostProcessing(scene, renderer, camera, composer);
  });

  // Mouse events
  window.addEventListener( 'pointermove', (event) => {
    if (visualizer.controllingAudio) {
      state.currMouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
      state.currMouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    } else {
      state.currMouse.x = ( event.clientX / window.innerWidth ) / 4 - 1;
      state.currMouse.y = - ( event.clientY / window.innerHeight ) / 4 + 1;
    }

    inputs.currMouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    inputs.currMouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    // control audio playback rate and volume TO DO FIX
    if (visualizer.controllingAudio) {
      // const playbackRate = state.currMouse.x * 4 + 1;
    
      // if (playbackRate < 0) {
      //   if (!isReversed) {
      //     // Switch to reversed audio
      //       const reversedOffset = audio.buffer.duration - playbackTime;
      //       reversedAudio.offset = reversedOffset;
      //       audio.stop();
      //       reversedAudio.play();
      //       isReversed = true;
      //   }

      //   reversedAudio.setPlaybackRate(Math.abs(playbackRate));
      // } else {
      //   if (isReversed) {
      //     // Switch to normal audio
      //     const normalOffset = audio.buffer.duration - playbackTime;
      //     audio.offset = normalOffset;
      //     reversedAudio.stop();
      //     audio.play();
      //     isReversed = false;
      //   }
        
      //   audio.setPlaybackRate(playbackRate);
      // }
    
  
    
    

      //   // shrink the orb for feedback
      //   state.volume_multiplier = state.currMouse.y * 2
      //   //camera.fov += state.currMouse.y
      //   state.base_speed = Math.max(0.1, Math.min(0.9, state.base_speed+state.mouse.y/50))
      //   state.minimizing_factor = Math.max(0.01, Math.min(1.0, state.minimizing_factor+state.currMouse.y/100));
      //   visualizer.scale = Math.max(1.0, Math.min(30.0, visualizer.scale+state.currMouse.y));
      //   audio.setVolume(Math.max(0.0, Math.min(1.0, audio.getVolume() + state.currMouse.y/5))); //state.currMouse.y * .2
    }
    tooltipUI.visible = false;
    if (visualizer.clickable && visualizer.render_tooltips) tooltipUI.visible = true;
  });
  
  window.addEventListener( 'pointerdown', (event) => {
    state.currPointerDown = 1.0;
    
    if (!visualizer.clickable) {
      return;
    }
    
    controls.enabled = false;
    if (event.button == 1) { 
      visualizer.controllingAudio = true;
      tooltipImage.src = 'https://bsiscoe.github.io/MAGE/resources/controltips2.png';
    }

    if (event.button == 2) {
      tooltipImage.hidden = false;
      visualizer.render_tooltips = true;
      tooltipUI.visible = true;
      window.pane.hidden = true;
      stats.dom.style.display = 'none';
      toggleUI();
    }
  });

  window.addEventListener( 'pointerup', (event) => {
    tooltipImage.src = "https://bsiscoe.github.io/MAGE/resources/controltips.png";
    visualizer.controllingAudio = false;
    controls.enabled = true;
    audio.setPlaybackRate(1);
    reversedAudio.pause();
    state.currPointerDown = 0.0 + 1 * state.pointerDownMultiplier;
    
    // clicked outside of visualizer
    if (!visualizer.intersected || !visualizer.clickable) {
      return;
    }
    
    if (event.button == 0) {
      if (!audio.isPlaying) audio.play(); else audio.pause();
      if (presetManager.currentPreset == 0) {
        visualizer.render_tooltips = true;
        tooltipUI.visible = true;
        window.pane.hidden = true;
        toggleUI();
        selectRandomPreset();
      }
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
    generatePreset();
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
      selectRandomPreset();
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
    tooltipImage.hidden = true;
    visualizer.render_tooltips = false;
    window.pane.hidden = true;
    stats.dom.style.display = 'none';
    toggleUI();
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
}

const createPresetButtons = () => {
  // scene preset buttons
  for (let presetNumber = 1; presetNumber <= (DEFAULT_PRESET_COUNT + presetManager.userPresetCount); presetNumber++) {   // make one for each preset
    createPresetButton(presetNumber);
  }
}

function createPresetButton (presetNumber, isNewButton) {
  // if this cookie has been deleted do not make a button
  if (presetNumber > DEFAULT_PRESET_COUNT && 
    !isNewButton && 
    localStorage.getItem('preset'+presetNumber) === null) 
  {
    return;
  }

  document.querySelector('.ui_bgs').insertAdjacentHTML('beforeend', createDivSceneButton(presetNumber)); // chatgpt
  document.getElementById(`preset${presetNumber}`).addEventListener('click', async () => {
    if (presetNumber <= DEFAULT_PRESET_COUNT) { // is default preset
      fetch(`https://bsiscoe.github.io/MAGE/resources/preset${presetNumber}/preset.json`)       // fetch the preset files
        .then(response => response.json())
        .then(data => {
          const jsonString = JSON.stringify(data);
          loadPreset(jsonString);
        })
        .catch((error) => {
          console.error('Error loading preset:', error);
        });
    } else {
      loadPreset(localStorage.getItem('preset'+presetNumber));       // load a user preset
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

const loadDefaultPreset = () => {
  presetManager.currentPreset = 0;
  let presetPath = `https://bsiscoe.github.io/MAGE/resources/preset0/`;
  loadSkybox(presetPath);
  loadAudio(null, presetPath + '0.mp3'); // blank audio file
  loadVisualizer(true);
}

const toggleUI = () => {
  const buttonsContainer = document.querySelector('.ui_buttons');
  buttonsContainer.style.display = buttonsContainer.style.display == 'flex' ? 'none' : 'flex';
  const bgContainer = document.querySelector('.ui_bgs');
  bgContainer.style.display = bgContainer.style.display == 'block' ? 'none' : 'block';
}

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
  toggleUI();
  let hideUIbutton = document.getElementById('ui_hide');
  hideUIbutton.style.display = 'none';
}

const render = () => {
  requestAnimationFrame( render );
  let delta = clock.getDelta();

  // alternates flow of time to prevent animation bugs
  if ((state.time < 180) && timeIncreasing) { // 3 minutes
    state.time += TIME_MULTIPLIER*delta;
  } else {
    timeIncreasing = false;
    state.time -= TIME_MULTIPLIER*delta;
    if (state.time <= 0) {
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

  //updatePlaybackTime();

  // analyze audio using FFT
  if (audio.isPlaying || reversedAudio.isPlaying) {

    // FFT Bucket 2
    let bass_analysis = Math.pow((visualizer.analyser.getFrequencyData()[2]/255)*state.minimizing_factor, state.power_factor);
    bass_input = bass_analysis + delta * state.base_speed;

    // TO DO : FFT MID AND HIGH
    let mid_analysis = Math.pow((visualizer.analyser.getFrequencyData()[4]/255)*state.minimizing_factor, state.power_factor);
    mid_input = mid_analysis + delta * state.base_speed;
  }

  // combine analysis for now
  // TO DO 
  //bass_input += mid_input;

  // add audio input to states
  let val = Math.sin(state.time)*(state.size)*0.02+0.1;
  state.currAudio = bass_input + val * state.base_speed + delta * state.base_speed;
  state.size = (1-state.easing_speed) * state.currAudio + state.easing_speed * state.size + state.volume_multiplier*.01;
  
  if (bass_input > 0.163) {
    shake();
    controls.update();
  }

  // ONLY CHECK PIXEL IF IT INTERSECTS

  if (controls.enabled && getOS() === ('Windows' || 'Mac OS' || 'Linux')) {
    let raycaster = new Raycaster();
    raycaster.setFromCamera(inputs.currMouse, camera);
    let intersects = raycaster.intersectObject(visualizer.mesh);
    if ( intersects.length > 0) {
      visualizer.intersected = true;
        
      // Render Shader Park material to the render target
      renderer.setRenderTarget(renderTarget);
      renderer.render(rtScene, rtCamera);
      renderer.setRenderTarget(null); // Reset to default framebuffer
  
      // Read pixel color from render target
      const pixelBuffer = new Uint8Array(4);
      const x = Math.floor((inputs.currMouse.x + 1) * 0.5 * renderTarget.width);
      const y = Math.floor((inputs.currMouse.y + 1) * 0.5 * renderTarget.height);
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
  
  var zoom = controls.target.distanceTo( controls.object.position )
  tooltipUI.position.set(0,zoom/2.2,0)
  tooltipRenderer.render(scene, camera);

  composer.render(scene, camera);
}

const loadPreset = (jsonInput) => {
  presetManager.currentlyLoadingPreset = true;
  let preset = JSON.parse(jsonInput);
  loadSkybox(preset.path);
  loadVisualizer(false, preset.shader);
  loadControls(preset.controls);
  window.pane.importState(preset.settings);
  composer = effects.applyPostProcessing(scene, renderer, camera, composer);
  window.pane.refresh();
  if (typeof audioFile === 'undefined') loadAudio(null, preset.path + '.mp3');
  audio.autoplay = true;
  presetManager.currentlyLoadingPreset = false;
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

const loadControls = (presetControls) => {
  if (presetControls) {
    const { target0, position0, zoom0 } = presetControls;
    controls.target0.copy(target0);
    controls.position0.copy(position0);
    controls.zoom0 = zoom0;
    controls.reset();
  }
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

const generatePreset = () => {
  //randomizeSettings();
  loadVisualizer(false);
  presetManager.currentPreset = DEFAULT_PRESET_COUNT + presetManager.userPresetCount + 1;
  handleUI(presetManager.currentPreset);
}

const selectRandomPreset = () => {
    let randomNumber = randomPreset();

    if (localStorage.getItem('preset'+randomNumber) === null && randomNumber > DEFAULT_PRESET_COUNT) {
      randomNumber = randomPreset();
    } else {
      document.getElementById(`preset${randomNumber}`).click();
      audio.autoplay = true;
      handleUI(presetManager.currentPreset);
    }

    function randomPreset() {
      return Math.ceil(Math.random() * (DEFAULT_PRESET_COUNT + presetManager.userPresetCount));
    }
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
            controls.update();
          },

          // This is a quadratic function that return 0 at first, then return 0.5 when t=0.5,
          // then return 0 when t=1 ;
          getQuadra: function getQuadra(t) {
            return 9.436896e-16 + (4*t) - (4*(t*t)) ;
          }

        };

}
      
function shake() {
      	//screenShake.shake( camera, new Vector3(0, -50, 0),10 );
        // camera.position.set(0,0,-4.5);
        // controls.update();
        
        // setTimeout(() => {camera.position.set(0,0,-5.5);}, 100);
        // controls.update();
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

  pane.refresh();
}

const growVisualizer = () => {
  state.size += .03*(1-state.easing_speed+0.01);
}

}