import {
  Scene,
  SphereGeometry,
  Vector3,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Timer,
  AudioListener,
  Audio,
  AudioLoader,
  AudioAnalyser,
  CubeTextureLoader,
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
  log,
  BoxGeometry,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { MAGEVisualizer } from './MAGEVisualizer.js';
import { MAGEPreset } from './MAGEPreset.js';
import { MAGEEffects } from './MAGEEffects.js';
import { MAGEPresetDock } from './MAGEPresetDock.js';

import { reverseAudioBuffer } from './helpers.js';
import { getEmbeddedSkyboxFaces, EMBEDDED_SKYBOXES  } from './skyboxes.js';

import { createSculptureWithGeometry } from 'shader-park-core';
import { generateshaderparkcode } from './generateshaderparkcode.js';


import { Pane } from 'tweakpane';

const controlTipsImageDataUrl = new URL('../resources/controltips.png', import.meta.url).href;


const MAGE_VERSION = '1.0.0';

/**
 * @typedef {Object} EngineControlSettings
 * @property {boolean} active - Whether to create controls for the engine
 * @property {boolean} integrated - Whether controls are integrated into the viewport (true) or separate (false)
 */

/**
 * @typedef {Object} MAGEOptions
 * @property {HTMLCanvasElement} [canvas] - The canvas element to render into
 * @property {boolean} [log=false] - Enable debug logging
 * @property {EngineControlSettings} [withControls={ active: true, integrated: false }] - Enable scene controls and specify their layout
 * @property {boolean} [autoStart=false] - Automatically start rendering
 */

export class MAGEEngine {
  #canvas = null;
  #scene = null;
  #renderer = null;
  #composer = null;
  #camera = null;
  #effects = null;
  #controlPanel = null;
  #renderTarget = null;
  #rtScene = null;
  #rtCamera = null;
  #controls = null;
  #clock = null;
  #listener = null;
  #audio = null;
  #audioFile = null;
  #reversedAudio = null;
  #audioAnalyser = null;
  #audioBuffer = null;
  #playbackTime = 0;
  #isReversed = false;
  #visualizer = null;
  #inputs = null;
  #state = null;
  #timeIncreasing = true;
  #screenShake = null;
  #currentPreset = null;
  #onAfterFrame = null;
  #onPresetLoaded = null;
  #cameraUpdateHook = null;
  #importSettingsState = null;
  #refreshSettingsUI = null;
  #animationFrameId = null;
  #isDisposed = false;
  #isRunning = false;
  #controlSettings = false;
  #viewportInputBridge = null;
  #windowInputBridge = null;
  #externalInputBridge = null;
  #externalInputUnsubscribe = null;
  #viewportWidth = 0;
  #viewportHeight = 0;
  #presetDock = null;
  #log = false;
  #viewportToast = {
    el: null,
    visible: false,
    shownAt: 0,
    durationMs: 1000,
    fadeMs: 700,
  };
  #_pendingSkyboxLoad = null;
  constructor({ canvas, log = false, autoStart = false, withControls: { active = false, integrated = false } = {} } = {}) {
    // console log version
    if (log) {
      console.log(`Initializing MAGE Engine v${MAGE_VERSION}...`);
      this.#log = true;
    }

    // Optional HTMLCanvasElement to render into. If not provided, a canvas
    // will be created and appended to document.body, matching current behavior.
    this.#canvas = canvas || null;
    this.#controlSettings = {
      active: Boolean(active),
      integrated: Boolean(integrated)
    };
    this.#controlPanel = null;
    this.#presetDock = null;

    // Core Three.js objects
    this.#scene = null;
    this.#renderer = null;
    this.#composer = null;
    this.#camera = null;
    this.#renderTarget = null;
    this.#rtScene = null;
    this.#rtCamera = null;
    this.#controls = null;
    this.#clock = null;
    this.#listener = null;

    // Audio state (detailed wiring to be migrated from index.js)
    this.#audio = null;
    this.#audioFile = null;
    this.#reversedAudio = null;
    this.#audioAnalyser = null;
    this.#audioBuffer = null;
    this.#playbackTime = 0;
    this.#isReversed = false;

    this.#visualizer = new MAGEVisualizer(this);
    this.#effects = new MAGEEffects();

    this.#inputs = {
      currMouse: new Vector3(),
      pointerDown: 0.0,
      currPointerDown: 0.0,
    };

    this.#state = {
      time_multiplier: 1.0,
      mouse: new Vector3(),
      currMouse: new Vector3(),
      size: 0.0,
      pointerDown: 0.0,
      pointerDownMultiplier: 0.0,
      currPointerDown: 0.0,
      currAudio: 0.0,
      time: 0.0,
      volume_multiplier: 0.0,
      minimizing_factor: 0.8,
      power_factor: 8.0,
      base_speed: 0.2,
      easing_speed: 0.6,
      camTilt: 0.0,
      camOrientationMode: 0,
      camOrientationSpeed: 1.0,
    };

    this.#timeIncreasing = true;
    this.#screenShake = this.#_createScreenShake();
    this.#currentPreset = null;

    // Engine Hooks - can be set by external code (e.g. controls.js) to integrate with engine lifecycle and state
    this.#onAfterFrame = null;
    this.#onPresetLoaded = null;
    this.#cameraUpdateHook = null;
    this.#importSettingsState = null;
    this.#refreshSettingsUI = null;
    this.#viewportWidth = 0;
    this.#viewportHeight = 0;
    this.#viewportToast = {
      el: null,
      visible: false,
      shownAt: 0,
      durationMs: 1000,
      fadeMs: 700,
    };
    this.#_pendingSkyboxLoad = null;
    this.#animationFrameId = null;
    this.#isDisposed = false;
    this.#isRunning = false;

    if (this.#controlSettings.active) {
      this.start();
      this.initControls();
    } else if (autoStart) {
      this.start();
    }

    // this._previewCaptureQueue = Promise.resolve();
    // this.savedPresets = [];
    // this._presetGalleryWindow = null;
  }
  /**
   * Initializes the MAGE Engine, creating the Three.js scene, camera, renderer, and other core components.
   * @return {void}
   */
  start() {
    if (this.#isRunning) {
      return;
    }
    if (this.#isDisposed) {
      console.warn('Attempted to start MAGEEngine after it was disposed. This instance cannot be restarted.');
      return;
    }
    this.#isRunning = true;

    if (!this.#scene) {
      this.#_createScene();
      this.#composer = this.#effects.applyPostProcessing(this.#scene, this.#renderer, this.#camera);
      this.#_syncSobelResolution();
    }

    this.#_render();

    if (!this.#currentPreset && !this.#visualizer.mesh) {
      this.#_loadDefaultPreset();
    }
  }

  /**
   * Returns the duration of the currently loaded audio in seconds. If no audio is loaded, returns 0.
   * @return {number} Duration of the currently loaded audio in seconds, or 0 if no audio is loaded.
   */
  getAudioDuration() {
    if (!this.#audio || !this.#audio.buffer) {
      return 0;
    }
    const duration = Number(this.#audio.buffer.duration);
    return Number.isFinite(duration) ? duration : 0;
  }

  /**
   * Returns the current playback time of the audio in seconds, accounting for play/pause state and any seeking. If no audio is loaded, returns 0.
   * @returns {number} Current playback time of the audio in seconds, or 0 if no audio is loaded.
   */
  getAudioTime() {
    return this.#playbackTime;
  }

  /**
   * Seeks to a specific time in the audio.
   * @param {number} time - The time to seek to, in seconds.
   * @returns {boolean} True if the seek was successful, false otherwise.
   */
  seek(time) {
    const duration = this.getAudioDuration();
    if (duration <= 0) {
      return false;
    }

    const clampedTime = Math.max(0, Math.min(time, duration));
    this.#playbackTime = clampedTime;

    const forwardWasPlaying = Boolean(this.#audio.isPlaying);
    const reverseWasPlaying = Boolean(this.#reversedAudio?.isPlaying);

    this.#audio.offset = clampedTime;

    if (this.#reversedAudio?.buffer) {
      const reversedTime = Math.max(0, Math.min(duration - clampedTime, this.#reversedAudio.buffer.duration));
      this.#reversedAudio.offset = reversedTime;
    }

    if (forwardWasPlaying) {
      this.#audio.stop();
    }
    if (reverseWasPlaying && this.#reversedAudio) {
      this.#reversedAudio.stop();
    }

    if (forwardWasPlaying && reverseWasPlaying) {
      if (this.#isReversed && this.#reversedAudio?.buffer) {
        this.#reversedAudio.play();
      } else {
        this.#audio.play();
      }
    } else if (forwardWasPlaying) {
      this.#audio.play();
    } else if (reverseWasPlaying && this.#reversedAudio?.buffer) {
      this.#reversedAudio.play();
    }

    return true;
  }

  /**
   * Scrubs the audio to a specific time.
   * @param {number} time - The time to scrub to, in seconds.
   * @returns {boolean} True if the scrub was successful, false otherwise.
   */
  scrubAudio(time) {
    return this.seek(time);
  }

  /**
   * Plays the currently loaded audio if it is not already playing. If no audio is loaded, this method does nothing.
   * @returns {void}
   */
  play() {
    if (!this.isAudioLoaded()) {
      return;
    }
    if (this.#audio && !this.#audio.isPlaying) {
      this.#audio.play();
    }
  }

  /**
   * Pauses the currently playing audio. If no audio is loaded or if the audio is already paused, this method does nothing.
   * @return {void}
   */
  pause() {
    if (this.#audio?.isPlaying) {
      this.#audio.pause();
    }
    if (this.#reversedAudio?.isPlaying) {
      this.#reversedAudio.pause();
    }
  }

  /**
   * Returns whether audio is currently loaded in the engine. This checks for the presence of an audio buffer in either the forward or reversed audio sources, 
   * or a standalone audioBuffer (used for file uploads).
   * @returns 
   */
  isAudioLoaded() {
    return Boolean(this.#audio?.buffer || this.#reversedAudio?.buffer || this.#audioBuffer);
  }

  /**
   * Loads audio from a file path or uploads a file.
   * @param {string} [filePath] - The path to the audio file to load.
   * @returns {void}
   */
  loadAudio(filePath) {
    const previousVolume = this.#audio?.getVolume();

    // pause previous audio
    this.#audio?.pause();
    // this.#audio?.dispose();
    this.#reversedAudio?.pause();
    // this.#reversedAudio?.dispose();

    // create an Audio source
    this.#audio = new Audio(this.#listener);
    this.#audio.setVolume(previousVolume || 1.0);
    this.#audio.setLoop(false);

    // create reversed audio source
    this.#reversedAudio = new Audio(this.#listener);
    this.#reversedAudio.setVolume(previousVolume || 1.0);
    this.#reversedAudio.setLoop(false);

    // create an AudioAnalyser, passing in the sound and desired fftSize
    this.#audioAnalyser = new AudioAnalyser(this.#audio, 64);

    const audioLoader = new AudioLoader();
    const fileInput = document.getElementById('file');

    // No path: fall back to upload via hidden input
    if (!filePath) {
      if (!fileInput) return;

      fileInput.addEventListener(
        'change',
        event => {
          const reader = new FileReader();
          reader.addEventListener('load', e => {
            this.#audioBuffer = e.target.result;
            this.#audio.context.decodeAudioData(this.#audioBuffer, buffer => {
              this.#audio.setBuffer(buffer);
              this.#reversedAudio.setBuffer(reverseAudioBuffer(buffer, this.#audio.context));
            });
          });
          this.#audioFile = event.target.files[0];
          reader.readAsArrayBuffer(this.#audioFile);
        },
        { once: true },
      );

      fileInput.click();
      return;
    }

    // Path provided: load preset/default audio from URL
    audioLoader.load(
      filePath,
      buffer => {
        this.#audio.setBuffer(buffer);
        this.#reversedAudio.setBuffer(
          reverseAudioBuffer(buffer, this.#listener.context),
        );
      },
      () => {
        // progress callback unused
      },
      () => {
        console.log('No audio found at path', filePath);
      },
    );
  }

  /**
   * Loads a preset into the engine.
   * @param {MAGEPreset} presetInput - The preset input to load.
   * @returns {MAGEPreset} The loaded preset.
   */
  loadPreset(presetInput) {
    const preset = MAGEPreset.from(presetInput);

    if (!preset) {
      const message = 'Invalid preset input: must be a JSON string, object literal, or MAGEPreset instance.';
      if (this.log) console.warn('[MAGEEngine.loadPreset] ' + message, { input: presetInput });
      return;
    }

    this.#currentPreset = preset;

    if (preset.controls) {
      this.#_loadControls(preset.controls);
    }

    if (preset.visualizer) {
      if (preset.visualizer.skyboxPreset !== undefined && preset.visualizer.skyboxPreset !== null) {
        const normalizedSkybox = this.#_normalizeSkyboxInput(preset.visualizer.skyboxPreset);
        if (normalizedSkybox) {
          this.#_loadSkybox(normalizedSkybox);
        } else if (this.log)
          console.warn('[MAGEEngine.loadPreset] Invalid skyboxPreset input; expected preset id, preset path, or { type, presetId }', { input: preset.visualizer.skyboxPreset });
      }
      if (preset.visualizer.shader) {
        this.#visualizer.load({ shader: preset.visualizer.shader, addToHistory: true, clearHistory: true });
      }
      if (typeof preset.visualizer.scale === 'number') {
        this.#visualizer.scale = preset.visualizer.scale;
      }
    }

    if (preset.state) {
      this.#_applyStatePatch(preset.state, { applied: [], warnings: [] });
    }

    if (typeof this.#importSettingsState === 'function' && preset.settings) {
      this.#importSettingsState(preset.settings);
    }

    if (preset.intent) {
      this.#_applyCompactIntent(preset.intent);
    }

    if (preset.fx) {
      this.#_applyCompactFx(preset.fx);
    }

    // if (preset.audioPath) {
    //   this.loadAudio(preset.audioPath);
    // }

    this.#_syncPostProcessingFromState();
    this.#_syncSobelResolution();

    if (typeof this.#refreshSettingsUI === 'function') {
      this.#refreshSettingsUI();
    }

    if (typeof this.#onPresetLoaded === 'function') {
      this.#onPresetLoaded(preset);
    }

    if (this.#controlSettings.active) {
      this.#controls.enabled = true;
    } else {
      this.#controls.enabled = false;
    }

    return preset;
  }

  /**
   * Swaps the current canvas with a new one.
   * @param {HTMLCanvasElement} newCanvas - The new canvas element to use.
   */
  swapCanvas(newCanvas) {
    if (this.#renderer) {
      this.#renderer.domElement.remove();
      this.#renderer.dispose();
      this.#renderer = null;
    }

    this.#canvas = newCanvas;
    this._createRenderer();
    if (this.#scene && this.#camera) {
      this.#composer = this.#effects.applyPostProcessing(this.#scene, this.#renderer, this.#camera, this.#composer);
      this.#_syncSobelResolution();
    }
  }

  /**
   * Toggles fullscreen mode for the engine's canvas. If the canvas is not currently in fullscreen, it will request fullscreen. If it is already in fullscreen, it will exit fullscreen.
   * Note: Fullscreen behavior may vary across browsers and may require user interaction to trigger. This method does not handle browser-specific fullscreen API differences or 
   * potential errors that may arise from fullscreen requests.
   * @returns {void}
   */
  toggleFullscreen() {
    if (!this.#canvas) {
      return;
    }
    if (!document.fullscreenElement) {
      this.#canvas.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen mode:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Error attempting to exit fullscreen mode:', err);
      });
    }
  }

  /**
   * Return the engine time from state
   * @returns {number} The engine time.
   */
  getEngineTime() {
    return this.#state.time;
  }

  /**
   * @typedef {Object} PresetExportSettings
   * @property {boolean} [includeState=true] - Whether to include the engine state in the exported preset.
   * @property {boolean} [includeSettings=true] - Whether to include custom settings in the exported preset.
   * @property {string} [schema='compact'] - The schema format to use for the exported preset ('compact' or 'full').
   */

  /**
   * Exports the current engine configuration as a preset object. The exported preset can include the current state, custom settings, and visualizer configuration, 
   * depending on the specified options.
   * @returns {MAGEPreset|Object} The exported preset as a MAGEPreset instance or a compact object depending on the specified schema.
   */
  toPreset() {
    const preset = {
      version: MAGE_VERSION,
      visualizer: {
        shader: this.#visualizer.shader,
        skyboxPreset: this.#visualizer.skyboxPreset,
        scale: this.#visualizer.scale,
      },
      controls: this.#controls
        ? {
          target0: this.#controls.target0,
          position0: this.#controls.position0,
          zoom0: this.#controls.zoom0,
        }
        : null,
      intent: {
        time_multiplier: this.#state.time_multiplier,
        minimizing_factor: this.#state.minimizing_factor,
        power_factor: this.#state.power_factor,
        pointerDownMultiplier: this.#state.pointerDownMultiplier,
        base_speed: this.#state.base_speed,
        easing_speed: this.#state.easing_speed,
        camTilt: this.#state.camTilt,
        camOrientationMode: this.#state.camOrientationMode,
        camOrientationSpeed: this.#state.camOrientationSpeed,
        autoRotate: this.#controls?.autoRotate,
        autoRotateSpeed: this.#controls?.autoRotateSpeed,
        fov: this.#camera?.fov,
      },
      fx: {
        passOrder: this.#effects.getPassOrder(),
        bloom: {
          enabled: this.#effects.bloom.enabled,
          strength: this.#effects.bloom.settings.strength,
          radius: this.#effects.bloom.settings.radius,
          threshold: this.#effects.bloom.settings.threshold,
        },
        toneMapping: {
          method: this.#effects.toneMapping.method,
          exposure: this.#renderer?.toneMappingExposure,
        },
        passes: {
          rgbShift: this.#effects.RGBShift.enabled,
          dot: this.#effects.dotShader.enabled,
          technicolor: this.#effects.technicolorShader.enabled,
          luminosity: this.#effects.luminosityShader.enabled,
          afterImage: this.#effects.afterImagePass.enabled,
          sobel: this.#effects.sobelShader.enabled,
          glitch: this.#effects.glitchPass.enabled,
          colorify: this.#effects.colorifyShader.enabled,
          halftone: this.#effects.halftonePass.enabled,
          gammaCorrection: this.#effects.gammaCorrectionShader.enabled,
          kaleid: this.#effects.kaleidoShader.enabled,
          outputPass: this.#effects.outputPass.enabled,
        },
        params: {
          rgbShift: {
            amount: this.#effects.RGBShift.shader.uniforms.amount.value,
            angle: this.#effects.RGBShift.shader.uniforms.angle.value,
          },
          afterImage: {
            damp: this.#effects.afterImagePass.shader.uniforms.damp.value,
          },
          colorify: {
            color: this.#effects.colorifyShader.color,
          },
          kaleid: {
            sides: this.#effects.kaleidoShader.shader.uniforms.sides.value,
            angle: this.#effects.kaleidoShader.shader.uniforms.angle.value,
          },
        },
      },
    };

    preset.state = { ...this.#state };

    if (this.#log) {
      console.log('Generated preset from current state:', preset);
    }
    return preset;
  }

  showViewportMessage(message, durationMs = 1000) {
    this.#_ensureViewportToast();
    if (!this.#viewportToast.el) {
      return;
    }

    this.#viewportToast.durationMs =
      Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1000;
    this.#viewportToast.shownAt = performance.now();
    this.#viewportToast.visible = true;

    this.#viewportToast.el.textContent = String(message ?? '');
    this.#viewportToast.el.style.opacity = '1';
    this.#viewportToast.el.style.display = 'block';
  }

  /**
   * Applies externally managed input state for this frame.
   * Calling this method automatically activates external input mode.
   * @param {Object} inputState
   * @returns {void}
   */
  setInputState(inputState = {}) {
    if (!this.#externalInputBridge) {
      this.#externalInputBridge = this.#_createInputBridgeState(this.#viewportInputBridge);
    }
    this.#_applyInputStatePatch(this.#externalInputBridge, inputState);
    this.#viewportInputBridge = this.#externalInputBridge;
  }

  /**
   * Attaches an external input source. The source can expose either:
   * - getState(): Object
   * - subscribe(handler): () => void
   * @param {Object} inputSource
   * @returns {void}
   */
  attachInputSource(inputSource = null) {
    this.detachInputSource();

    this.#externalInputBridge = this.#_createInputBridgeState(this.#viewportInputBridge);
    this.#viewportInputBridge = this.#externalInputBridge;

    if (!inputSource || typeof inputSource !== 'object') {
      return;
    }

    if (typeof inputSource.getState === 'function') {
      const snapshot = inputSource.getState();
      this.#_applyInputStatePatch(this.#externalInputBridge, snapshot);
    }

    if (typeof inputSource.subscribe === 'function') {
      const unsubscribe = inputSource.subscribe(nextState => {
        this.#_applyInputStatePatch(this.#externalInputBridge, nextState);
      });

      if (typeof unsubscribe === 'function') {
        this.#externalInputUnsubscribe = unsubscribe;
      }
    }
  }

  /**
   * Detaches any external input source and returns to internal window input listeners.
   * @returns {void}
   */
  detachInputSource() {
    if (typeof this.#externalInputUnsubscribe === 'function') {
      this.#externalInputUnsubscribe();
    }
    this.#externalInputUnsubscribe = null;
    this.#externalInputBridge = null;

    if (this.#windowInputBridge) {
      this.#viewportInputBridge = this.#windowInputBridge;
    }
  }

  // getSavedPresets() {
  //   return this.savedPresets.map(entry => this.#_safeDeepClone(entry));
  // }

  // openSavedPresetsWindow() {
  //   if (typeof window === 'undefined' || typeof window.open !== 'function') {
  //     return null;
  //   }

  //   if (!this._presetGalleryWindow || this._presetGalleryWindow.closed) {
  //     this._presetGalleryWindow = window.open('', 'mage-saved-presets', 'width=560,height=700,resizable=yes,scrollbars=yes');
  //   }

  //   this.#_renderSavedPresetsWindow();
  //   return this._presetGalleryWindow;
  // }


  /**
   * @typedef {Object} CaptureFramePreviewOptions
   * @property {number} [width = 224] - Width of the captured thumbnail in pixels (default: 224)
   * @property {number} [height = 224] - Height of the captured thumbnail in pixels (default: 224)
   * @property {string} [type = 'image/png'] - MIME type of the output image (default: 'image/png')
   * @property {number} [quality = 0.84] - Quality of the output image between 0 and 1 (default: 0.84)
   * @property {number} [settleFrames = 2] - Number of frames to render after loading preset before capturing thumbnail, to allow for any async loading and shader stabilization (default: 2)
   */



  async #_captureFramePreviewBlob({
    width = 224,
    height = 224,
    type = 'image/png',
    quality = 0.84,
  } = {}) {
    if (!this.#renderer?.domElement) {
      return null;
    }

    // Render one fresh frame right before readback to avoid stale/cleared canvas captures.
    this.#_renderSingleFrame();

    const w = Math.max(1, Number.parseInt(`${width}`, 10) || 224);
    const h = Math.max(1, Number.parseInt(`${height}`, 10) || 224);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      return null;
    }

    context.drawImage(this.#renderer.domElement, 0, 0, w, h);
    return await new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), type, quality);
    });
  }

  /**
   * Captures a thumbnail for the current visualizer and returns it as a data URL. 
   * This is a convenience method that wraps captureFramePreviewBlob and converts the resulting Blob to a data URL.
   * @param {CaptureFramePreviewOptions} options 
   * @returns {Promise<string|null>} A data URL representing the captured thumbnail, or null if the capture failed.
   */
  async captureFramePreview({
    width = 224,
    height = 224,
    type = 'image/png',
    quality = 0.84,
  } = {}) {
    const blob = await this.#_captureFramePreviewBlob({ width, height, type, quality });
    if (!blob) {
      return null;
    }
    return await this.#_blobToDataUrl(blob);
  }

  /**
   * Captures a thumbnail for the given preset. Prefer using current engine state and captureFramePreview when possible, but this method can be used to capture a thumbnail 
   * for any preset without affecting the current engine state.
   * @param {MAGEPreset} presetInput 
   * @param {CaptureThumbnailOptions} options 
   * @returns {Promise<string|null>} A data URL representing the captured thumbnail, or null if the capture failed.
   */
  async captureThumbnail(
    presetInput,
    {
      width = 224,
      height = 224,
      settleFrames = 2,
      quality = 0.84,
      type = 'image/png',
    } = {},
  ) {
    return await MAGEEngine.captureThumbnail(presetInput, {
      width,
      height,
      settleFrames,
      quality,
      type,
    });
  }

  /**
   * Captures a thumbnail for a given preset without requiring an instance of MAGEEngine.
   * @param {MAGEPreset} presetInput 
   * @param {CaptureThumbnailOptions} [options] 
   * @returns {Promise<string|null>} A data URL representing the captured thumbnail, or null if the capture failed.
    * @description This static method captures a thumbnail for a given preset without requiring an instance of MAGEEngine. 
    * It creates a temporary offscreen canvas and a new MAGEEngine instance to load the preset, render it for a few frames to allow for stabilization, 
    * and capture the resulting image as a data URL. This is useful for generating thumbnails for presets without affecting the current state of an existing engine instance.
   */
  static async captureThumbnail(
    presetInput,
    {
      width = 224,
      height = 224,
      settleFrames = 2,
      quality = 0.84,
      type = 'image/png',
    } = {},
  ) {
    if (typeof document === 'undefined') {
      return null;
    }

    const w = Math.max(1, Number.parseInt(`${width}`, 10) || 224);
    const h = Math.max(1, Number.parseInt(`${height}`, 10) || 224);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = w;
    offscreenCanvas.height = h;

    const thumbnailEngine = new MAGEEngine({ canvas: offscreenCanvas, log: false });

    try {
      thumbnailEngine.#_createScene();
      // Use a fixed pixel ratio for deterministic output across devices.
      thumbnailEngine.#renderer.setPixelRatio(1);
      thumbnailEngine.#_syncViewport(true);

      thumbnailEngine.#composer = thumbnailEngine.#effects.applyPostProcessing(
        thumbnailEngine.#scene,
        thumbnailEngine.#renderer,
        thumbnailEngine.#camera,
      );
      thumbnailEngine.#_syncSobelResolution();

      // Normalize interaction-driven runtime behavior for deterministic captures.
      if (thumbnailEngine.#controls) {
        thumbnailEngine.#controls.enabled = false;
        thumbnailEngine.#controls.autoRotate = false;
      }

      const loadedPreset = thumbnailEngine.loadPreset(presetInput);
      if (!loadedPreset) {
        return null;
      }

      // Re-apply postprocessing graph after preset load to ensure pass toggles/settings are reflected.
      thumbnailEngine.#_syncPostProcessingFromState();

      // Wait for async skybox texture loading so background is present in thumbnail output.
      await thumbnailEngine.#_waitForPendingSkyboxLoad(2000);

      //use deterministic neutral defaults instead of runtime-derived values.
      thumbnailEngine.#state.time = 0.0;
      thumbnailEngine.#state.pointerDown = 1.0;
      thumbnailEngine.#state.currPointerDown = 1.0;

      // increase size by nominal amount to prevent completely flat visualizer output for presets that derive size from audio or interactions.
      thumbnailEngine.#state.size += 0.05;

      const frames = Math.max(1, Number.parseInt(`${settleFrames}`, 10) || 2);
      for (let i = 0; i < frames; i += 1) {
        thumbnailEngine.#_renderSingleFrame();
      }

      return thumbnailEngine.#_captureFramePreviewDataUrlSync({
        width: w,
        height: h,
        type: type,
        quality: quality,
      });
    } finally {
      thumbnailEngine.#_disposeForThumbnailCapture();
      offscreenCanvas.remove();
    }
  }

  // async buildPresetPreviewMap(
  //   presets,
  //   {
  //     getId = preset => preset?.id,
  //     onProgress = null,
  //     settleFrames = 2,
  //     width = 224,
  //     height = 224,
  //   } = {},
  // ) {
  //   const result = {};
  //   if (!Array.isArray(presets) || presets.length === 0) {
  //     return result;
  //   }

  //   for (let index = 0; index < presets.length; index += 1) {
  //     const preset = presets[index];
  //     const id = getId(preset, index);
  //     if (id === undefined || id === null) {
  //       continue;
  //     }

  //     const dataUrl = await this.captureThumbnail(preset, {
  //       settleFrames,
  //       width,
  //       height,
  //     });

  //     if (dataUrl) {
  //       result[`${id}`] = dataUrl;
  //     }

  //     if (typeof onProgress === 'function') {
  //       onProgress({ index, total: presets.length, id, hasPreview: Boolean(dataUrl) });
  //     }
  //   }

  //   return result;
  // }

  // Destroys the engine instance and releases resources. After calling this method, the engine should not be used.

  /**
   * Disposes of the MAGE Engine instance, releasing all resources and references to allow for garbage collection. 
   * This includes disposing of the Three.js renderer, scene, render targets, audio sources, and any other objects 
   * created by the engine. After calling this method, the engine instance should not be used.
   * @returns {void}
   */
  dispose() {
    if (this.#isDisposed) {
      return;
    }
    if (!this.#isRunning) {
      return;
    }
    this.#isDisposed = true;
    this.#isRunning = false;
    if (this.#animationFrameId !== null) {
      cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }
    if (this.#renderer) {
      this.#renderer.dispose();
      this.#renderer.forceContextLoss();
      this.#renderer.context = null;
      this.#renderer.domElement = null;
      this.#renderer = null;
    }
    if (this.#scene) {
      this.#scene.traverse(object => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.#scene = null;
    }
    if (this.#renderTarget) {
      this.#renderTarget.dispose();
      this.#renderTarget = null;
    }
    if (this.#rtScene) {
      this.#rtScene.traverse(object => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.#rtScene = null;
    }
    if (this.#rtCamera) {
      this.#rtCamera = null;
    }
    if (this.#camera) {
      this.#camera = null;
    }
    if (this.#controls) {
      this.#controls.dispose();
      this.#controls = null;
    }
    if (typeof this.#externalInputUnsubscribe === 'function') {
      this.#externalInputUnsubscribe();
    }
    if (this.#windowInputBridge && this.#windowInputBridge !== this.#viewportInputBridge) {
      this.#windowInputBridge.detach();
    }
    if (this.#viewportInputBridge) {
      this.#viewportInputBridge.detach();
      this.#viewportInputBridge = null;
    }
    this.#externalInputUnsubscribe = null;
    this.#externalInputBridge = null;
    this.#windowInputBridge = null;
    if (this.#listener) {
      this.#listener = null;
    }
    if (this.#audio) {
      this.#audio.stop();
      this.#audio.disconnect();
      this.#audio = null;
    }
    if (this.#reversedAudio) {
      this.#reversedAudio.stop();
      this.#reversedAudio.disconnect();
      this.#reversedAudio = null;
    }
    if (this.#audioAnalyser) {
      this.#audioAnalyser = null;
    }
    if (this.#visualizer) {
      this.#visualizer.mesh = null;
      this.#visualizer.shader = null;
      this.#visualizer.shaders = [];
    }
    this.#state = null;
    this.#inputs = null;
    this.#screenShake = null;
    this.#currentPreset = null;
    // this._previewCaptureQueue = null;
    // this.savedPresets = [];
    // this._presetGalleryWindow = null;

    if (this.log) console.log('MAGE Engine disposed and resources released.');
  }

  // PRIVATE METHODS
  #_createControlPanel() {
    this.#controlPanel = this.initControls();
  }

  #_waitFrames(frameCount = 1) {
    const total = Math.max(1, Number.parseInt(`${frameCount}`, 10) || 1);
    return new Promise(resolve => {
      let remaining = total;
      const step = () => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  #_waitForPendingSkyboxLoad(timeoutMs = 2000) {
    if (!this.#_pendingSkyboxLoad) {
      return Promise.resolve();
    }

    const timeout = Math.max(0, Number.parseInt(`${timeoutMs}`, 10) || 0);
    return Promise.race([
      this.#_pendingSkyboxLoad.catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, timeout)),
    ]);
  }

  #_blobToDataUrl(blob) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  #_renderSingleFrame() {
    if (!this.#renderer || !this.#scene || !this.#camera) {
      return;
    }
    this.#_syncViewport();
    this.#_syncSobelResolution();
    if (this.#composer) {
      this.#composer.render(this.#scene, this.#camera);
    } else {
      this.#renderer.render(this.#scene, this.#camera);
    }
  }

  #_hideViewportMessage() {
    this.#_ensureViewportToast();
    if (!this.#viewportToast.el) {
      return;
    }
    this.#viewportToast.visible = false;
    this.#viewportToast.el.style.opacity = '0';
    this.#viewportToast.el.style.display = 'none';
  }

  #_syncPostProcessingFromState() {
    if (!this.#renderer || !this.#scene || !this.#camera) {
      return;
    }

    this.#renderer.toneMapping = this.#effects.toneMapping.method;

    if (this.#composer) {
      this.#composer = this.#effects.applyPostProcessing(this.#scene, this.#renderer, this.#camera, this.#composer);
    }

    this.#_syncSobelResolution();
  }

  #_syncSobelResolution() {
    if (!this.#renderer || !this.#effects.sobelShader?.shader?.uniforms?.resolution?.value) {
      return;
    }

    const resolution = this.#effects.sobelShader.shader.uniforms.resolution.value;
    const bufferWidth = this.#renderer.domElement?.width || Math.max(1, Math.floor(window.innerWidth * window.devicePixelRatio));
    const bufferHeight = this.#renderer.domElement?.height || Math.max(1, Math.floor(window.innerHeight * window.devicePixelRatio));
    resolution.x = bufferWidth;
    resolution.y = bufferHeight;
  }

  #_captureFramePreviewDataUrlSync({
    width = 224,
    height = 224,
    type = 'image/png',
    quality = 0.84,
  } = {}) {
    if (!this.#renderer?.domElement) {
      return null;
    }

    try {
      // Ensure a fresh frame has been drawn before reading the canvas snapshot.
      this.#_renderSingleFrame();

      const w = Math.max(1, Number.parseInt(`${width}`, 10) || 224);
      const h = Math.max(1, Number.parseInt(`${height}`, 10) || 224);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) {
        return null;
      }

      context.drawImage(this.#renderer.domElement, 0, 0, w, h);
      return canvas.toDataURL(type, quality);
    } catch {
      return null;
    }
  }

  // _trackSavedPreset(preset) {
  //   if (!preset || typeof preset !== 'object') {
  //     return;
  //   }

  //   const cloned = this.#_safeDeepClone(preset);
  //   cloned._savedAt = new Date().toISOString();
  //   this.savedPresets.push(cloned);
  //   this.#_renderSavedPresetsWindow();
  // }

  #_safeDeepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  #_escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  //   #_renderSavedPresetsWindow() {
  //     if (!this._presetGalleryWindow || this._presetGalleryWindow.closed) {
  //       return;
  //     }

  //     const doc = this._presetGalleryWindow.document;
  //     const items = this.savedPresets
  //       .map((preset, index) => {
  //         const thumb = typeof preset.thumbnailDataUrl === 'string' ? preset.thumbnailDataUrl : '';
  //         const ts = preset._savedAt ? this.#_escapeHtml(new Date(preset._savedAt).toLocaleString()) : 'unknown';
  //         const pretty = this.#_escapeHtml(JSON.stringify(preset, null, 2));
  //         return `
  //           <article class="card">
  //             <div class="meta">
  //               <strong>Preset ${index + 1}</strong>
  //               <span>${ts}</span>
  //             </div>
  //             ${thumb ? `<img class="thumb" src="${thumb}" alt="Preset ${index + 1} thumbnail" />` : '<div class="thumb empty">No thumbnail</div>'}
  //             <details>
  //               <summary>JSON</summary>
  //               <pre>${pretty}</pre>
  //             </details>
  //           </article>
  //         `;
  //       })
  //       .join('');

  //     doc.open();
  //     doc.write(`<!doctype html>
  // <html>
  //   <head>
  //     <meta charset="utf-8" />
  //     <title>MAGE Saved Presets</title>
  //     <style>
  //       body { margin: 0; padding: 12px; background: #0f1117; color: #e8ebf2; font-family: Arial, sans-serif; }
  //       h1 { margin: 0 0 10px; font-size: 16px; }
  //       .list { display: grid; gap: 10px; }
  //       .card { border: 1px solid #2f3440; border-radius: 10px; background: #171b24; padding: 10px; }
  //       .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 8px; }
  //       .thumb { width: 100%; max-height: 180px; object-fit: contain; border-radius: 8px; border: 1px solid #394153; background: #0b0e14; }
  //       .thumb.empty { display: grid; place-items: center; color: #8f98ad; min-height: 120px; }
  //       details { margin-top: 8px; }
  //       pre { white-space: pre-wrap; word-break: break-word; font-size: 11px; color: #c8cfde; background: #10141c; border-radius: 8px; padding: 8px; }
  //     </style>
  //   </head>
  //   <body>
  //     <h1>Saved toPreset Snapshots (${this.savedPresets.length})</h1>
  //     <div class="list">${items || '<div class="card">No presets saved yet.</div>'}</div>
  //   </body>
  // </html>`);
  //     doc.close();
  //   }

  #_setCameraUpFromTilt(tiltValue = this.#state?.camTilt) {
    if (!this.#camera || typeof tiltValue !== 'number' || !Number.isFinite(tiltValue)) {
      return;
    }

    this.#camera.up.set(
      Math.sin(tiltValue),
      Math.cos(tiltValue),
      -Math.sin(tiltValue),
    );
  }

  #_applyCompactIntent(intent) {
    if (!intent || typeof intent !== 'object') {
      return;
    }

    this.#_applyStatePatch(intent, { applied: [], warnings: [] });

    if (this.#controls) {
      if (typeof intent.autoRotate === 'boolean') {
        this.#controls.autoRotate = intent.autoRotate;
      }
      if (typeof intent.autoRotateSpeed === 'number' && Number.isFinite(intent.autoRotateSpeed)) {
        this.#controls.autoRotateSpeed = intent.autoRotateSpeed;
      }
    }

    if (this.#camera && typeof intent.fov === 'number' && Number.isFinite(intent.fov)) {
      this.#camera.fov = intent.fov;
      this.#camera.updateProjectionMatrix();
    }

    if (typeof intent.camTilt === 'number' && Number.isFinite(intent.camTilt) && this.#camera) {
      this.#_setCameraUpFromTilt(intent.camTilt);
    }
  }

  #_applyCompactFx(fx) {
    if (!fx || typeof fx !== 'object') {
      return;
    }

    if (Array.isArray(fx.passOrder)) {
      this.#effects.setPassOrder(fx.passOrder);
    }

    if (fx.bloom && typeof fx.bloom === 'object') {
      if (typeof fx.bloom.enabled === 'boolean') this.#effects.bloom.enabled = fx.bloom.enabled;
      if (typeof fx.bloom.strength === 'number' && Number.isFinite(fx.bloom.strength)) this.#effects.bloom.settings.strength = fx.bloom.strength;
      if (typeof fx.bloom.radius === 'number' && Number.isFinite(fx.bloom.radius)) this.#effects.bloom.settings.radius = fx.bloom.radius;
      if (typeof fx.bloom.threshold === 'number' && Number.isFinite(fx.bloom.threshold)) this.#effects.bloom.settings.threshold = fx.bloom.threshold;
    }

    if (fx.toneMapping && typeof fx.toneMapping === 'object') {
      if (typeof fx.toneMapping.method === 'number' && Number.isFinite(fx.toneMapping.method)) {
        this.#effects.toneMapping.method = fx.toneMapping.method;
        if (this.#renderer) {
          this.#renderer.toneMapping = fx.toneMapping.method;
        }
      }
      if (typeof fx.toneMapping.exposure === 'number' && Number.isFinite(fx.toneMapping.exposure) && this.#renderer) {
        this.#renderer.toneMappingExposure = fx.toneMapping.exposure;
      }
    }

    if (fx.passes && typeof fx.passes === 'object') {
      if (typeof fx.passes.rgbShift === 'boolean') this.#effects.RGBShift.enabled = fx.passes.rgbShift;
      if (typeof fx.passes.dot === 'boolean') this.#effects.dotShader.enabled = fx.passes.dot;
      if (typeof fx.passes.technicolor === 'boolean') this.#effects.technicolorShader.enabled = fx.passes.technicolor;
      if (typeof fx.passes.luminosity === 'boolean') this.#effects.luminosityShader.enabled = fx.passes.luminosity;
      if (typeof fx.passes.afterImage === 'boolean') this.#effects.afterImagePass.enabled = fx.passes.afterImage;
      if (typeof fx.passes.sobel === 'boolean') this.#effects.sobelShader.enabled = fx.passes.sobel;
      if (typeof fx.passes.glitch === 'boolean') this.#effects.glitchPass.enabled = fx.passes.glitch;
      if (typeof fx.passes.colorify === 'boolean') this.#effects.colorifyShader.enabled = fx.passes.colorify;
      if (typeof fx.passes.halftone === 'boolean') this.#effects.halftonePass.enabled = fx.passes.halftone;
      if (typeof fx.passes.gammaCorrection === 'boolean') this.#effects.gammaCorrectionShader.enabled = fx.passes.gammaCorrection;
      if (typeof fx.passes.kaleid === 'boolean') this.#effects.kaleidoShader.enabled = fx.passes.kaleid;
      if (typeof fx.passes.outputPass === 'boolean') this.#effects.outputPass.enabled = fx.passes.outputPass;
    }

    if (fx.params && typeof fx.params === 'object') {
      if (fx.params.rgbShift && typeof fx.params.rgbShift === 'object') {
        if (typeof fx.params.rgbShift.amount === 'number' && Number.isFinite(fx.params.rgbShift.amount)) {
          this.#effects.RGBShift.shader.uniforms.amount.value = fx.params.rgbShift.amount;
        }
        if (typeof fx.params.rgbShift.angle === 'number' && Number.isFinite(fx.params.rgbShift.angle)) {
          this.#effects.RGBShift.shader.uniforms.angle.value = fx.params.rgbShift.angle;
        }
      }

      if (fx.params.afterImage && typeof fx.params.afterImage === 'object') {
        if (typeof fx.params.afterImage.damp === 'number' && Number.isFinite(fx.params.afterImage.damp)) {
          this.#effects.afterImagePass.shader.uniforms.damp.value = fx.params.afterImage.damp;
        }
      }

      if (fx.params.kaleid && typeof fx.params.kaleid === 'object') {
        if (typeof fx.params.kaleid.sides === 'number' && Number.isFinite(fx.params.kaleid.sides)) {
          this.#effects.kaleidoShader.shader.uniforms.sides.value = fx.params.kaleid.sides;
        }
        if (typeof fx.params.kaleid.angle === 'number' && Number.isFinite(fx.params.kaleid.angle)) {
          this.#effects.kaleidoShader.shader.uniforms.angle.value = fx.params.kaleid.angle;
        }
      }

      if (fx.params.colorify && typeof fx.params.colorify === 'object' && fx.params.colorify.color !== undefined) {
        const colorValue = fx.params.colorify.color;
        if (this.#effects.colorifyShader.color && typeof this.#effects.colorifyShader.color.set === 'function') {
          try {
            this.#effects.colorifyShader.color.set(colorValue);
          } catch {
            // Keep current color if payload is not parseable by three.Color.
          }
        }
      }
    }

    if (this.#composer) {
      this.#composer = this.#effects.applyPostProcessing(this.#scene, this.#renderer, this.#camera, this.#composer);
    }
  }

  #_coercePresetInput(presetInput, report) {
    if (presetInput instanceof MAGEPreset) {
      return presetInput;
    }

    if (typeof presetInput === 'string') {
      const trimmed = presetInput.trim();
      if (!trimmed) {
        report.invalid.push('Preset input string is empty.');
        return null;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          report.invalid.push('Parsed JSON must be an object.');
          return null;
        }
        return parsed;
      } catch (error) {
        report.invalid.push(`Invalid JSON: ${error.message}`);
        return null;
      }
    }

    if (!presetInput || typeof presetInput !== 'object' || Array.isArray(presetInput)) {
      report.invalid.push('Preset input must be a JSON object, object literal, or MAGEPreset instance.');
      return null;
    }

    return presetInput;
  }

  #_extractVisualizerPatch(root, report) {
    const visualizerPatch =
      root.visualizer && typeof root.visualizer === 'object' && !Array.isArray(root.visualizer)
        ? { ...root.visualizer }
        : {};

    if (!root.visualizer && (Object.hasOwn(root, 'shader') || Object.hasOwn(root, 'path'))) {
      report.warnings.push('Legacy preset fields detected; mapped top-level shader/path into visualizer.');
    }

    if (!Object.hasOwn(visualizerPatch, 'shader') && typeof root.shader === 'string') {
      visualizerPatch.shader = root.shader;
    }

    if (!Object.hasOwn(visualizerPatch, 'skyboxPreset')) {
      if (Object.hasOwn(root, 'skyboxPreset')) {
        visualizerPatch.skyboxPreset = root.skyboxPreset;
      } else if (typeof root.path === 'string') {
        visualizerPatch.skyboxPreset = root.path;
      }
    }

    if (
      Object.hasOwn(root, 'scale') &&
      !Object.hasOwn(visualizerPatch, 'scale')
    ) {
      visualizerPatch.scale = root.scale;
    }

    return visualizerPatch;
  }

  #_extractStatePatch(root, report) {
    const statePatch = {};
    if (root.state && typeof root.state === 'object' && !Array.isArray(root.state)) {
      Object.assign(statePatch, root.state);
    } else if (Object.hasOwn(root, 'state') && root.state !== null) {
      report.invalid.push('state must be an object');
    }

    return statePatch;
  }

  #_extractControlsPatch(root, report) {
    if (!root.controls) {
      return null;
    }

    if (typeof root.controls !== 'object' || Array.isArray(root.controls)) {
      report.invalid.push('controls must be an object with target0, position0, and zoom0');
      return null;
    }

    const { target0, position0, zoom0 } = root.controls;

    return {
      target0: target0,
      position0: position0,
      zoom0: zoom0,
    };
  }

  #_normalizeSkyboxInput(skyboxInput) {
    if (skyboxInput && typeof skyboxInput === 'object' && !Array.isArray(skyboxInput)) {
      const { type, presetId } = skyboxInput;
      if (type === 'preset' && Number.isInteger(presetId) && presetId >= 0) {
        return { type, presetId };
      }
      return null;
    }

    if (Number.isInteger(skyboxInput) && skyboxInput >= 0) {
      return { type: 'preset', presetId: skyboxInput };
    }

    if (typeof skyboxInput === 'string') {
      const trimmed = skyboxInput.trim();
      if (!trimmed) {
        return null;
      }

      const numeric = Number.parseInt(trimmed, 10);
      if (Number.isInteger(numeric) && `${numeric}` === trimmed && numeric >= 0) {
        return { type: 'preset', presetId: numeric };
      }

      const pathMatch = trimmed.match(/preset(\d+)/i);
      if (pathMatch) {
        const presetId = Number.parseInt(pathMatch[1], 10);
        if (Number.isInteger(presetId) && presetId >= 0) {
          return { type: 'preset', presetId };
        }
      }
    }

    return null;
  }

  #_applyStatePatch(statePatch, report) {
    if (!statePatch || typeof statePatch !== 'object') {
      report.missing.push('state');
      return;
    }

    const stateKeys = Object.keys(statePatch);
    if (stateKeys.length === 0) {
      report.missing.push('state');
      return;
    }

    for (const key of stateKeys) {
      if (!Object.hasOwn(this.#state, key)) {
        report.warnings.push(`state.${key} is unknown and was ignored`);
        continue;
      }

      const currentValue = this.#state[key];
      const incomingValue = statePatch[key];

      if (currentValue instanceof Vector3) {
        report.applied.push(`state.${key}`);
        continue;
      }

      if (typeof currentValue === 'number') {
        this.#state[key] = incomingValue;
        report.applied.push(`state.${key}`);
        continue;
      }

      this.#state[key] = incomingValue;
      report.applied.push(`state.${key}`);
    }

    if (typeof this.#state.time_multiplier !== 'number' || !Number.isFinite(this.#state.time_multiplier)) {
      this.#state.time_multiplier = 1.0;
      report.warnings.push('state.time_multiplier was invalid after patch; reset to 1.0');
    }
  }

  #_summarizePresetReport(report) {
    const parts = [];
    parts.push(report.applied.length ? `Applied ${report.applied.length} field(s)` : 'Applied no fields');
    if (report.missing.length) {
      parts.push(`missing: ${report.missing.join(', ')}`);
    }
    if (report.invalid.length) {
      parts.push(`invalid: ${report.invalid.join(', ')}`);
    }
    if (report.warnings.length) {
      parts.push(`warnings: ${report.warnings.join(', ')}`);
    }
    return parts.join(' | ');
  }

  #_resolveSkyboxPath({ type, presetId }) {
    if (type !== 'preset' || typeof presetId !== 'number') {
      // TODO - support custom skybox paths in addition to preset-based ones
      return { resolvedPath: null, skyboxId: -1 };
    } else {
      return { resolvedPath: `../resources/preset${presetId}/`, skyboxId: presetId };
    }
  }

  #_getViewportSize() {
    if (this.#canvas) {
      const rect = this.#canvas.getBoundingClientRect();
      const width = Math.max(
        1,
        Math.floor(
          rect.width || this.#canvas.clientWidth || this.#canvas.width || 0,
        ),
      );
      const height = Math.max(
        1,
        Math.floor(
          rect.height || this.#canvas.clientHeight || this.#canvas.height || 0,
        ),
      );
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    return {
      width: Math.max(1, Math.floor(window.innerWidth || 1)),
      height: Math.max(1, Math.floor(window.innerHeight || 1)),
    };
  }

  #_syncViewport(force = false) {
    if (!this.#renderer || !this.#camera) {
      return;
    }

    const { width, height } = this.#_getViewportSize();
    if (!force && width === this.#viewportWidth && height === this.#viewportHeight) {
      return;
    }

    this.#viewportWidth = width;
    this.#viewportHeight = height;

    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();

    this.#renderer.setSize(width, height, false);

    if (this.#composer && this.#composer.setSize) {
      this.#composer.setSize(width, height);
    }

    if (this.#renderTarget && this.#renderTarget.setSize) {
      this.#renderTarget.setSize(
        Math.max(1, Math.floor(width / 4)),
        Math.max(1, Math.floor(height / 4)),
      );
    }

    this.#_syncSobelResolution();
  }

  #_ensureViewportToast() {
    if (this.#viewportToast.el && document.body.contains(this.#viewportToast.el)) {
      return;
    }

    // Skip toast creation for detached/offscreen canvases used for thumbnail capture.
    if (this.#canvas && !this.#canvas.isConnected) {
      return;
    }

    const host =
      this.#canvas?.parentElement ||
      this.#renderer?.domElement?.parentElement ||
      document.body;

    if (host && getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }

    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '30',
      pointerEvents: 'none',
      borderRadius: '999px',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      background: 'rgba(8, 12, 16, 0.64)',
      color: '#ffffff',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
      fontSize: '14px',
      fontWeight: '600',
      lineHeight: '1.2',
      letterSpacing: '0.015em',
      whiteSpace: 'nowrap',
      padding: '10px 14px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
      opacity: '0',
      display: 'none',
      transition: 'opacity 140ms linear',
    });

    host.appendChild(toast);
    this.#viewportToast.el = toast;
  }

  #_disposeForThumbnailCapture() {
    this.#_pendingSkyboxLoad = null;
    const rendererCanvas = this.#renderer?.domElement || null;

    try {
      this.#controls?.dispose?.();
    } catch {
      // no-op
    }

    try {
      this.#renderTarget?.dispose?.();
    } catch {
      // no-op
    }

    try {
      this.#renderer?.dispose?.();
      this.#renderer?.forceContextLoss?.();
    } catch {
      // no-op
    }

    if (rendererCanvas?.parentElement) {
      rendererCanvas.parentElement.removeChild(rendererCanvas);
    }

    if (this.#viewportToast?.el?.parentElement) {
      this.#viewportToast.el.parentElement.removeChild(this.#viewportToast.el);
    }
    this.#viewportToast.el = null;
  }

  #_createScene() {
    const { width, height } = this.#_getViewportSize();

    // initialize scene
    this.#scene = new Scene();

    // initialize camera
    this.#camera = new PerspectiveCamera(75, width / height, 0.1, 100000);
    this.#camera.position.z = 5.5;
    this.#camera.lookAt(0, 10, 100);

    // init audio listener
    this.#listener = new AudioListener();
    this.#camera.add(this.#listener);

    // initialize renderer
    const rendererOptions = {};
    if (this.#canvas) {
      rendererOptions.canvas = this.#canvas;
    }
    this.#renderer = new WebGLRenderer(rendererOptions);
    this.#renderer.setSize(width, height, false);
    this.#renderer.setPixelRatio(window.devicePixelRatio);
    this.#renderer.setClearColor(new Color(1, 1, 1), 0);
    // Match original renderer tone mapping exposure behavior
    this.#renderer.toneMappingExposure = this.#effects.toneMapping.exposure;
    this.#renderer.outputColorSpace = SRGBColorSpace;

    if (!this.#canvas) {
      // Match existing behavior: append the canvas to the body when not provided
      document.body.appendChild(this.#renderer.domElement);
    }

    // initialize clock
    this.#clock = new Timer();

    // Add mouse controls
    this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement, {
      enabledamping: true,
      dampingFactor: 0.25,
      zoomSpeed: 0.5,
      rotateSpeed: 0.5,
    });
    this.#controls.enabledamping = true;
    this.#controls.autoRotate = true;
    this.#controls.autoRotateSpeed = 0.2;
    this.#controls.saveState();
    this.#controls.enabled = false; // Start disabled until controls loaded

    this.#_ensureViewportToast();

    this.#_syncViewport(true);
  }

  #_loadControls(presetControls) {
    if (presetControls && this.#controls) {
      const { target0, position0, zoom0 } = presetControls;
      this.#controls.target0.copy(target0);
      this.#controls.position0.copy(position0);
      this.#controls.zoom0 = zoom0;
      this.#controls.reset();
    }
  }

  #_loadDefaultVisualizer() {
    this.#visualizer.load({ shader: generateshaderparkcode('default'), addToHistory: true });
    this.#_loadSkybox({ type: 'preset', presetId: 6 });
  }

  #_loadDefaultPreset() {
    // const defaultPreset = getEmbeddedPresetById(1);
    // if (defaultPreset) {
    //   const loadedPreset = this.loadPreset(defaultPreset);
    //   if (loadedPreset) {
    //     return loadedPreset;
    //   }
    // }

    this.#_loadDefaultVisualizer();
    return null;
  }

  #_idFromShaderCode(shaderCode) {
    // Simple hash function to generate a unique ID from shader code
    let hash = 0;
    for (let i = 0; i < shaderCode.length; i++) {
      const char = shaderCode.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `shader_${Math.abs(hash)}`;
  }

  #_loadSkybox({ type, presetId }) {
    const { resolvedPath, skyboxId } = this.#_resolveSkyboxPath({ type: type, presetId: presetId });
    if (!resolvedPath) {
      if (this.log) console.log('No valid skybox input provided:', presetId);
      return;
    }

    this.#visualizer.skyboxPreset = skyboxId;

    const loader = new CubeTextureLoader();
    const embeddedFaces = getEmbeddedSkyboxFaces(skyboxId);

    const faceUrls = embeddedFaces
      ? [
        embeddedFaces.left,
        embeddedFaces.right,
        embeddedFaces.up,
        embeddedFaces.down,
        embeddedFaces.front,
        embeddedFaces.back,
      ]
      : [
        `${resolvedPath}sky_left.jpg`,
        `${resolvedPath}sky_right.jpg`,
        `${resolvedPath}sky_up.jpg`,
        `${resolvedPath}sky_down.jpg`,
        `${resolvedPath}sky_front.jpg`,
        `${resolvedPath}sky_back.jpg`,
      ];

    this.#_pendingSkyboxLoad = new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) {
          return;
        }
        settled = true;
        this.#_pendingSkyboxLoad = null;
        resolve(result);
      };

      const texture = loader.load(
        faceUrls,
        () => finish(true),
        undefined,
        () => finish(false),
      );

      this.#scene.background = texture;
    });
  }

  /** @internal */
  removeMesh(mesh) {
    if (this.#scene && mesh) {
      this.#scene.remove(mesh);
    }
  }
  /** @internal */
  createMesh(visualizer) {
    // add shader to geometry
    const geometry = new BoxGeometry(20000, 20000, 20000);
    visualizer.mesh = createSculptureWithGeometry(geometry, visualizer.shader, () => {
      return {
        time: this.#state.time,
        size: this.#state.size,
        pointerDown: this.#state.pointerDown,
        mouse: this.#state.mouse,
        _scale: visualizer.scale,
      };
    });
    this.#scene.add(visualizer.mesh);

    // Scene and camera for rendering Shader Park
    // Render target for Shader Park output for object picking
    this.#renderTarget = new WebGLRenderTarget(
      Math.max(1, Math.floor(this.#viewportWidth / 4)),
      Math.max(1, Math.floor(this.#viewportHeight / 4)),
      {
        // use quarter res to save frames
        format: RGBAFormat,
        type: UnsignedByteType,
      },
    );
    this.#rtScene = new Scene();
    this.#rtCamera = this.#camera;
    this.#rtScene.add(visualizer.mesh.clone());

    if (this.log) console.log('Visualizer Loaded!');
  }

  #_render = () => {
    if (this.#isDisposed || !this.#state || !this.#scene || !this.#camera || !this.#renderer) {
      return;
    }

    this.#animationFrameId = requestAnimationFrame(this.#_render);
    this.#_syncViewport();

    const delta = this.#clock.getDelta();
    this.#state.time = delta;
    if (!Number.isFinite(this.#state.time_multiplier)) {
      this.#state.time_multiplier = 1.0;
    }

    // alternates flow of time to prevent animation bugs
    if (this.#state.time < 180 && this.#timeIncreasing) {
      this.#state.time += this.#state.time_multiplier * delta;
    } else {
      this.#timeIncreasing = false;
      this.#state.time -= this.#state.time_multiplier * delta;
      if (this.#state.time <= 0) {
        this.#timeIncreasing = true;
      }
    }

    // // animate tab bar (document.title)
    // const timeCalc = (1 + Math.sin(this.#state.time)) * 10 / 2;
    // if (this.#audio && this.#audio.isPlaying) {
    //   if (timeCalc > 5.0) {
    //     document.title = 'MAGE - Playing Audio...';
    //   } else {
    //     document.title = 'MAGE - Playing Audio';
    //   }
    // } else {
    //   document.title = 'MAGE';
    // }

    let bass_input = 0;
    let mid_input = 0;

    // analyze audio using FFT
    if (
      this.#audioAnalyser &&
      ((this.#audio && this.#audio.isPlaying) || (this.#reversedAudio && this.#reversedAudio.isPlaying))
    ) {
      const freqData = this.#audioAnalyser.getFrequencyData();

      // FFT Bucket 2
      const bass_analysis = Math.pow((freqData[2] / 255) * this.#state.minimizing_factor, this.#state.power_factor);
      bass_input = bass_analysis + delta * this.#state.base_speed;

      // TODO: FFT MID AND HIGH - keep existing behavior
      const mid_analysis = Math.pow((freqData[4] / 255) * this.#state.minimizing_factor, this.#state.power_factor);
      mid_input = mid_analysis + delta * this.#state.base_speed;
    }

    // add audio input to states
    const val = Math.sin(this.#state.time) * this.#state.size * 0.02 + 0.1;
    this.#state.currAudio = bass_input + val * this.#state.base_speed + delta * this.#state.base_speed;
    this.#state.size =
      (1 - this.#state.easing_speed) * this.#state.currAudio +
      this.#state.easing_speed * this.#state.size +
      this.#state.volume_multiplier * 0.01;

    // Keep controls authoritative for camera motion, then apply tilt orientation once.
    this.#controls.update();

    this.#_updateViewportInteractionFromBridge();

    if (this.#viewportToast.el && this.#viewportToast.visible) {
      const elapsedMs = performance.now() - this.#viewportToast.shownAt;
      if (elapsedMs <= this.#viewportToast.durationMs) {
        this.#viewportToast.el.style.opacity = '1';
      } else if (elapsedMs <= this.#viewportToast.durationMs + this.#viewportToast.fadeMs) {
        const fadeProgress =
          (elapsedMs - this.#viewportToast.durationMs) / this.#viewportToast.fadeMs;
        this.#viewportToast.el.style.opacity = `${Math.max(0, 1 - fadeProgress)}`;
      } else {
        this.#viewportToast.visible = false;
        this.#viewportToast.el.style.opacity = '0';
        this.#viewportToast.el.style.display = 'none';
      }
    }

    if (this.#onAfterFrame) {
      this.#onAfterFrame(this);
    }

    if (this.#cameraUpdateHook) {
      this.#cameraUpdateHook(this);
    }

    if (this.#composer) {
      this.#composer.render(this.#scene, this.#camera);
    } else {
      this.#renderer.render(this.#scene, this.#camera);
    }
  }

  #_growVisualizer() {
    this.#state.size += 0.03 * (1 - this.#state.easing_speed + 0.01);
  }

  #_isPointerNearVisualizerCenter(maxDistanceNdc = 0.35) {
    if (!this.#visualizer?.mesh || !this.#camera || !this.#inputs?.currMouse) {
      return false;
    }

    const meshCenterNdc = this.#visualizer.mesh.position.clone().project(this.#camera);
    if (!Number.isFinite(meshCenterNdc.x) || !Number.isFinite(meshCenterNdc.y)) {
      return false;
    }

    const dx = this.#inputs.currMouse.x - meshCenterNdc.x;
    const dy = this.#inputs.currMouse.y - meshCenterNdc.y;
    const distance = Math.hypot(dx, dy);
    return distance <= Math.max(0.01, Number(maxDistanceNdc) || 0.35);
  }

  #_createInputBridgeState(sourceBridge = null) {
    return {
      clientX: Number.NaN,
      clientY: Number.NaN,
      pointerOverUi: false,
      requestToggleUI: false,
      requestResetVisualizer: false,
      requestNextShader: false,
      requestPreviousShader: false,
      requestWheelDirection: 0,
      onToggleUI: sourceBridge?.onToggleUI || null,
      onHideQuickPresets: sourceBridge?.onHideQuickPresets || null,
      onUpdateTooltip: sourceBridge?.onUpdateTooltip || null,
      detach() {},
    };
  }

  #_applyInputStatePatch(bridge, patch) {
    if (!bridge || !patch || typeof patch !== 'object') {
      return;
    }

    if (Number.isFinite(patch.clientX)) bridge.clientX = Number(patch.clientX);
    if (Number.isFinite(patch.clientY)) bridge.clientY = Number(patch.clientY);
    if (typeof patch.pointerOverUi === 'boolean') bridge.pointerOverUi = patch.pointerOverUi;

    if (typeof patch.requestToggleUI === 'boolean') bridge.requestToggleUI = patch.requestToggleUI;
    if (typeof patch.requestResetVisualizer === 'boolean') bridge.requestResetVisualizer = patch.requestResetVisualizer;
    if (typeof patch.requestNextShader === 'boolean') bridge.requestNextShader = patch.requestNextShader;
    if (typeof patch.requestPreviousShader === 'boolean') bridge.requestPreviousShader = patch.requestPreviousShader;

    if (Number.isFinite(patch.requestWheelDirection)) {
      const raw = Number(patch.requestWheelDirection);
      bridge.requestWheelDirection = raw < 0 ? -1 : raw > 0 ? 1 : 0;
    }

    if (Number.isFinite(patch.currPointerDown) && this.#state) {
      this.#state.currPointerDown = Number(patch.currPointerDown);
    }
  }

  #_tryToGetInputsFromMouseEvents() {
    const inputSource = {
      getState() {
        return { clientX: 0, clientY: 0, pointerOverUi: false, currPointerDown: 0 };
      },
      subscribe(handler) {
        const onMove = event => {
          handler({
            clientX: event.clientX,
            clientY: event.clientY,
            pointerOverUi: false,
          });
        };

        const onDown = () => handler({ currPointerDown: 1.0 });
        const onUp = () => handler({ currPointerDown: 0.0 });

        window.addEventListener('pointermove', onMove, { capture: true });
        window.addEventListener('pointerdown', onDown, { capture: true });
        window.addEventListener('pointerup', onUp, { capture: true });

        return () => {
          window.removeEventListener('pointermove', onMove, { capture: true });
          window.removeEventListener('pointerdown', onDown, { capture: true });
          window.removeEventListener('pointerup', onUp, { capture: true });
        };
      },
    };

    return inputSource;
  }

  #_updateViewportInteractionFromBridge() {
    if (!this.#controlSettings.active) {
      return;
    }
    
    const bridge = this.#viewportInputBridge;
    if (!this.#renderer?.domElement || !this.#camera || !this.#visualizer || !this.#inputs || !this.#controls) {
      return;
    }

    if (!bridge) {
      // If no bridge, use defaults that allow interaction when pointer is over the canvas
      const input = this.#_tryToGetInputsFromMouseEvents();
      this.attachInputSource(input);
      return;
    }

    // use easing and linear interpolation to smoothly animate mouse this.#effects
    this.#state.pointerDown = 0.1 * this.#state.currPointerDown + 0.9 * this.#state.pointerDown;
    this.#state.mouse.lerp(this.#state.currMouse, 0.05);

    const domElement = this.#renderer.domElement;
    const rect = domElement.getBoundingClientRect();
    const hasPointer = Number.isFinite(bridge.clientX) && Number.isFinite(bridge.clientY);
    const insideViewport = Boolean(
      hasPointer
      && bridge.clientX >= rect.left
      && bridge.clientX <= rect.right
      && bridge.clientY >= rect.top
      && bridge.clientY <= rect.bottom,
    );
    const isDesktopOS = ['Windows', 'Mac OS', 'Linux'].includes(this.#_getOS());
    const canRaycast = insideViewport && !bridge.pointerOverUi && this.#controls.enabled && isDesktopOS;

    if (canRaycast) {
      const relX = (bridge.clientX - rect.left) / rect.width;
      const relY = (bridge.clientY - rect.top) / rect.height;

      this.#inputs.currMouse.x = relX * 2 - 1;
      this.#inputs.currMouse.y = -relY * 2 + 1;

      const raycaster = new Raycaster();
      raycaster.setFromCamera(this.#inputs.currMouse, this.#camera);
      const intersects = this.#visualizer.mesh ? raycaster.intersectObject(this.#visualizer.mesh) : [];

      if (intersects.length > 0) {
        this.#visualizer.intersected = true;

        if (this.#renderTarget && this.#rtScene && this.#rtCamera) {
          this.#renderer.setRenderTarget(this.#renderTarget);
          this.#renderer.render(this.#rtScene, this.#rtCamera);
          this.#renderer.setRenderTarget(null);

          const pixelBuffer = new Uint8Array(4);
          const hitNdc = intersects[0].point.clone().project(this.#camera);
          const w = this.#renderTarget.width;
          const h = this.#renderTarget.height;
          const x = Math.max(0, Math.min(w - 1, Math.floor((hitNdc.x + 1) * 0.5 * (w - 1))));
          const y = Math.max(0, Math.min(h - 1, Math.floor((hitNdc.y + 1) * 0.5 * (h - 1))));

          this.#renderer.readRenderTargetPixels(this.#renderTarget, x, y, 1, 1, pixelBuffer);

          const nearCenter = this.#_isPointerNearVisualizerCenter(this.#visualizer.centerClickRadiusNdc);
          if (pixelBuffer[3] > 0 && nearCenter) {
            this.#_growVisualizer();
            this.#visualizer.clickable = true;
          } else {
            this.#visualizer.clickable = false;
          }
        }
      } else {
        this.#visualizer.intersected = false;
        this.#visualizer.clickable = false;
      }
    } else {
      this.#visualizer.intersected = false;
      this.#visualizer.clickable = false;
      this.#visualizer.controllingAudio = false;
    }

    if (typeof bridge.onUpdateTooltip === 'function') {
      bridge.onUpdateTooltip({
        visible: this.#visualizer.clickable && this.#visualizer.render_tooltips,
        x: bridge.clientX,
        y: bridge.clientY,
      });
    }

    const canTriggerInteraction = this.#visualizer.intersected && this.#visualizer.clickable;

    if (bridge.requestWheelDirection !== 0) {
      if (canTriggerInteraction) {
        if (bridge.requestWheelDirection < 0) {
          this.#visualizer.nextShader();
        } else {
          this.#visualizer.previousShader();
        }
      }
      bridge.requestWheelDirection = 0;
    }

    if (bridge.requestToggleUI) {
      if (insideViewport && !bridge.pointerOverUi) {
        if (typeof bridge.onHideQuickPresets === 'function') {
          bridge.onHideQuickPresets();
        }
        if (typeof bridge.onToggleUI === 'function') {
          bridge.onToggleUI();
        }
      }
      bridge.requestToggleUI = false;
    }

    if (bridge.requestResetVisualizer) {
      if (canTriggerInteraction) {
        this.#visualizer.load({ shader: null, addToHistory: true, clearHistory: false });
        if (typeof bridge.onHideQuickPresets === 'function') {
          bridge.onHideQuickPresets();
        }
      }
      bridge.requestResetVisualizer = false;
    }

    if (bridge.requestNextShader) {
      if (canTriggerInteraction) {
        this.#visualizer.nextShader();
      }
      bridge.requestNextShader = false;
    }

    if (bridge.requestPreviousShader) {
      if (canTriggerInteraction) {
        this.#visualizer.previousShader();
      }
      bridge.requestPreviousShader = false;
    }
  }

  #_getOS() {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator?.userAgentData?.platform || window.navigator.platform;
    const macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
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

  #_createScreenShake() {
    const self = this;
    return {
      enabled: false,
      _timestampStart: undefined,
      _timestampEnd: undefined,
      _startPoint: undefined,
      _endPoint: undefined,

      update(camera) {
        if (this.enabled === true && camera) {
          const now = Date.now();
          if (this._timestampEnd > now) {
            const interval = (Date.now() - this._timestampStart) / (this._timestampEnd - this._timestampStart);
            this.computePosition(camera, interval);
          } else {
            if (this._startPoint) {
              camera.position.copy(this._startPoint);
            }
            this.enabled = false;
          }
        }
      },

      shake(camera, vecToAdd, milliseconds) {
        this.enabled = true;
        this._timestampStart = Date.now();
        this._timestampEnd = this._timestampStart + milliseconds;
        this._startPoint = new Vector3().copy(camera.position);
        this._endPoint = new Vector3().addVectors(camera.position, vecToAdd);
      },

      computePosition(camera, interval) {
        let position;
        if (interval < 0.4) {
          position = this.getQuadra(interval / 0.4);
        } else if (interval < 0.7) {
          position = this.getQuadra((interval - 0.4) / 0.3) * -0.6;
        } else if (interval < 0.9) {
          position = this.getQuadra((interval - 0.7) / 0.2) * 0.3;
        } else {
          position = this.getQuadra((interval - 0.9) / 0.1) * -0.1;
        }

        camera.position.lerpVectors(this._startPoint, this._endPoint, position);
        self.#controls.update();
      },

      getQuadra(t) {
        return 9.436896e-16 + 4 * t - 4 * (t * t);
      },
    };
  }
  
  initControls(options = {}) {
    if (!this.#isRunning || this.#isDisposed) {
      if (this.log) console.warn('Cannot initialize controls: MAGEEngine is not running or has been disposed.');
      return;
    }

    // Calling initControls() should fully activate control mode,
    // including bridge-driven interactions (tooltips, click actions, docks).
    this.#controlSettings.active = true;
    if (Object.hasOwn(options, 'integrated')) {
      this.#controlSettings.integrated = Boolean(options.integrated);
    }

    // enable threejs orbit controls for mouse interaction
    this.#controls.enabled = true;

    const engine = this;
    const scene = engine.#scene;
    const renderer = engine.#renderer;
    const camera = engine.#camera;
    const controls = engine.#controls;

    const host = engine.#canvas?.parentElement || renderer.domElement.parentElement || document.body;
    // Ensure host can anchor absolutely-positioned children
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }

    const state = engine.#state;
    const visualizer = engine.#visualizer;
    const inputs = engine.#inputs;

    let composer = engine.#composer;
    let audio = engine.#audio;
    let reversedAudio = engine.#reversedAudio;
    let pane = null;
    let fxStudioOverlay = null;
    let sceneCameraDock = null;
    const useIntegratedControls = Boolean(engine.#controlSettings.integrated);

    const createViewportInputBridge = () => {
      const controller = new AbortController();

      const bridge = {
        clientX: Number.NaN,
        clientY: Number.NaN,
        pointerOverUi: false,
        requestToggleUI: false,
        requestResetVisualizer: false,
        requestNextShader: false,
        requestPreviousShader: false,
        requestWheelDirection: 0,
        onToggleUI: null,
        onHideQuickPresets: null,
        onUpdateTooltip: null,
        detach() {
          controller.abort();
        },
      };

      const isUiEvent = event => {
        const target = event?.target;
        const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];

        if (!path.includes(renderer.domElement)) {
          return true;
        }

        if (!(target instanceof Element)) {
          return false;
        }

        return Boolean(
          target.closest('.tp-dfwv')
          || target.closest('.mage-pane-host')
          || target.closest('.mage-embedded-presets')
          || target.closest('.mage-fx-layers-overlay')
          || target.closest('.mage-fx-studio-overlay')
          || target.closest('.mage-fx-studio-dock')
          || target.closest('.mage-scene-camera-dock')
          || target.closest('.mage-dock-launcher')
        );
      };

      const syncPointer = event => {
        bridge.clientX = event.clientX;
        bridge.clientY = event.clientY;
        bridge.pointerOverUi = isUiEvent(event);
      };

      const resetState = () => {
        bridge.requestToggleUI = false;
        bridge.requestResetVisualizer = false;
        bridge.requestNextShader = false;
        bridge.requestPreviousShader = false;
        bridge.requestWheelDirection = 0;
        if (engine.#state) {
          engine.#state.currPointerDown = 0.0;
        }
      };

      window.addEventListener('pointermove', event => {
        syncPointer(event);
      }, { capture: true, passive: true, signal: controller.signal });

      window.addEventListener('pointerdown', event => {
        syncPointer(event);
        if (bridge.pointerOverUi) {
          resetState();
          return;
        }

        if (engine.#state) {
          engine.#state.currPointerDown = 1.0;
        }
      }, { capture: true, passive: true, signal: controller.signal });

      window.addEventListener('pointerup', event => {
        syncPointer(event);
        if (bridge.pointerOverUi) {
          resetState();
          return;
        }

        if (engine.#state) {
          engine.#state.currPointerDown = 0.0 + 1 * engine.#state.pointerDownMultiplier;
        }

        if (event.button === 2) {
          bridge.requestToggleUI = true;
        } else if (event.button === 0) {
          bridge.requestResetVisualizer = true;
        }
      }, { capture: true, passive: true, signal: controller.signal });

      window.addEventListener('wheel', event => {
        syncPointer(event);
        if (bridge.pointerOverUi) {
          return;
        }

        bridge.requestWheelDirection = event.deltaY < 0 ? -1 : event.deltaY > 0 ? 1 : 0;
      }, { capture: true, passive: true, signal: controller.signal });

      window.addEventListener('blur', resetState, { signal: controller.signal });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          resetState();
        }
      }, { signal: controller.signal });

      return bridge;
    };

    engine.#windowInputBridge = createViewportInputBridge();
    if (!engine.#externalInputBridge) {
      engine.#viewportInputBridge = engine.#windowInputBridge;
    }

    const rebuildComposer = () => {
      composer = this.#effects.applyPostProcessing(scene, renderer, camera, composer);
      engine.#composer = composer;
    };

    const tooltipUI = {
      visible: false,
      x: 0,
      y: 0,
      element: document.createElement('div'),
    };
    tooltipUI.element.style.position = 'fixed';
    tooltipUI.element.style.transform = 'translate(-50%, -50%)';
    tooltipUI.element.style.zIndex = '5';
    tooltipUI.element.style.pointerEvents = 'none';
    tooltipUI.element.style.display = 'none';
    tooltipUI.element.innerHTML = `<img src="${controlTipsImageDataUrl}" alt="controls" />`;
    document.body.appendChild(tooltipUI.element);

    const previousAfterFrame = engine.#onAfterFrame;
    engine.#onAfterFrame = engineInstance => {
      if (typeof previousAfterFrame === 'function') {
        previousAfterFrame(engineInstance);
      }

      if (tooltipUI.visible) {
        // hide regular mouse pointer
        engineInstance.#renderer.domElement.style.cursor = 'none';
        tooltipUI.element.style.display = 'block';
        tooltipUI.element.style.left = `${tooltipUI.x}px`;
        tooltipUI.element.style.top = `${tooltipUI.y}px`;
      } else {
        tooltipUI.element.style.display = 'none';
        engineInstance.#renderer.domElement.style.cursor = '';
      }
    };

    const randomizeSettings = () => {
      const randRange = (min, max) => Math.random() * (max - min) + min;
      const randInt = (min, max) => Math.floor(randRange(min, max + 1));
      const randBool = (chance = 0.5) => Math.random() < chance;

      // Scene + camera controls
      state.minimizing_factor = randRange(0.01, 2.0);
      state.power_factor = randRange(1.0, 10.0);
      state.pointerDownMultiplier = randRange(0.0, 1.0);
      state.base_speed = randRange(0.01, 0.9);
      state.easing_speed = randRange(0.01, 0.9);
      visualizer.scale = randRange(1.0, 200.0);

      controls.autoRotate = randBool(0.5);
      controls.autoRotateSpeed = randRange(0.1, 50.0);

      camera.fov = randRange(1.0, 359.0);
      camera.updateProjectionMatrix();

      state.camTilt = randRange(0.0, 2 * Math.PI);
      camera.up.set(
        Math.sin(state.camTilt),
        Math.cos(state.camTilt),
        -Math.sin(state.camTilt),
      );

      const embeddedSkyboxIds = Object.keys(EMBEDDED_SKYBOXES)
        .map(value => Number.parseInt(value, 10))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      if (embeddedSkyboxIds.length > 0) {
        const skyboxId = embeddedSkyboxIds[randInt(0, embeddedSkyboxIds.length - 1)];
        visualizer.skyboxPreset = skyboxId;
        engine.#_loadSkybox({ type: 'preset', presetId: skyboxId });
      }

      // FX toggles + all adjustable FX parameters
      this.#effects.bloom.enabled = randBool(0.55);
      this.#effects.bloom.settings.strength = randRange(0.0, 10.0);
      this.#effects.bloom.settings.radius = randRange(-10.0, 10.0);
      this.#effects.bloom.settings.threshold = randRange(0.0, 10.0);

      this.#effects.RGBShift.enabled = randBool(0.4);
      this.#effects.RGBShift.shader.uniforms.amount.value = randRange(0.0, 0.1);
      this.#effects.RGBShift.shader.uniforms.angle.value = randRange(0.0, 2 * Math.PI);

      this.#effects.afterImagePass.enabled = randBool(0.35);
      this.#effects.afterImagePass.shader.uniforms.damp.value = randRange(0.0, 1.0);

      this.#effects.colorifyShader.enabled = randBool(0.35);
      this.#effects.colorifyShader.color.setHSL(Math.random(), randRange(0.2, 1.0), randRange(0.2, 0.8));

      this.#effects.kaleidoShader.enabled = randBool(0.3);
      this.#effects.kaleidoShader.shader.uniforms.sides.value = randInt(1, 24);
      this.#effects.kaleidoShader.shader.uniforms.angle.value = randRange(0.0, 2 * Math.PI);

      this.#effects.glitchPass.enabled = randBool(0.25);
      this.#effects.dotShader.enabled = randBool(0.25);
      this.#effects.technicolorShader.enabled = randBool(0.25);
      this.#effects.luminosityShader.enabled = randBool(0.25);
      this.#effects.sobelShader.enabled = randBool(0.25);
      this.#effects.halftonePass.enabled = randBool(0.25);
      this.#effects.gammaCorrectionShader.enabled = randBool(0.25);
      this.#effects.copyShader.enabled = randBool(0.2);
      this.#effects.bleachBypassShader.enabled = randBool(0.2);
      this.#effects.toonShader.enabled = randBool(0.2);

      const toneMappingMethods = [
        LinearToneMapping,
        CineonToneMapping,
        ACESFilmicToneMapping,
        NoToneMapping,
        ReinhardToneMapping,
        AgXToneMapping,
        NeutralToneMapping,
      ];
      this.#effects.toneMapping.method = toneMappingMethods[randInt(0, toneMappingMethods.length - 1)];
      renderer.toneMapping = this.#effects.toneMapping.method;
      renderer.toneMappingExposure = randRange(-500.0, 500.0);

      const currentOrder = this.#effects.getPassOrder();
      const shuffled = currentOrder.filter(passId => passId !== 'outputPass');
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      this.#effects.setPassOrder([...shuffled, 'outputPass']);

      controls.update();
      if (pane) {
        pane.refresh();
      }
      fxStudioOverlay?.refresh();
      sceneCameraDock?.refresh();
      rebuildComposer();
    };

    const createFxStudioOverlay = () => {
      const toneMappingOptions = [
        { label: 'Linear', value: LinearToneMapping },
        { label: 'Cineon', value: CineonToneMapping },
        { label: 'Filmic', value: ACESFilmicToneMapping },
        { label: 'NoTone', value: NoToneMapping },
        { label: 'Reinhard', value: ReinhardToneMapping },
        { label: 'AGX', value: AgXToneMapping },
        { label: 'Neutral', value: NeutralToneMapping },
      ];

      const layerLabels = {
        bloom: 'Bloom',
        RGBShift: 'RGB Shift',
        dotShader: 'Dot FX',
        technicolorShader: 'Technicolor',
        luminosityShader: 'Luminosity',
        afterImagePass: 'After Image',
        sobelShader: 'Sobel',
        colorifyShader: 'Colorify',
        halftonePass: 'Halftone',
        gammaCorrectionShader: 'Gamma Correction',
        kaleidoShader: 'Kaleid',
        glitchPass: 'Glitch',
        copyShader: 'Copy Shader',
        bleachBypassShader: 'Bleach Bypass',
        toonShader: 'Toon',
        outputPass: 'Output Pass',
      };

      const syncSobelResolution = () => {
        if (!this.#effects.sobelShader?.shader?.uniforms?.resolution?.value) {
          return;
        }
        const bufferWidth = renderer.domElement.width || window.innerWidth * window.devicePixelRatio;
        const bufferHeight = renderer.domElement.height || window.innerHeight * window.devicePixelRatio;
        this.#effects.sobelShader.shader.uniforms.resolution.value.x = bufferWidth;
        this.#effects.sobelShader.shader.uniforms.resolution.value.y = bufferHeight;
      };

      const overlay = document.createElement('div');
      overlay.className = 'mage-fx-studio-dock';
      Object.assign(overlay.style, {
        position: 'fixed',
        zIndex: '40',
        display: 'none',
        pointerEvents: 'none',
      });

      const panel = document.createElement('div');
      Object.assign(panel.style, {
        width: '360px',
        maxHeight: '84vh',
        overflow: 'auto',
        padding: '12px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(13, 17, 26, 0.95)',
        color: '#fff',
        display: 'grid',
        gap: '10px',
        pointerEvents: 'auto',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
      });

      const title = document.createElement('div');
      title.textContent = 'FX Studio';
      Object.assign(title.style, {
        fontSize: '16px',
        fontWeight: '700',
      });

      const hint = document.createElement('div');
      hint.textContent = 'Drag rows to reorder. Each row combines enable and settings.';
      Object.assign(hint.style, {
        fontSize: '12px',
        opacity: '0.8',
      });

      const stackSection = document.createElement('div');
      Object.assign(stackSection.style, {
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '10px',
        padding: '8px',
        display: 'grid',
        gap: '8px',
      });

      const stackTitle = document.createElement('div');
      stackTitle.textContent = 'Effect Stack';
      Object.assign(stackTitle.style, {
        fontSize: '13px',
        fontWeight: '600',
      });

      const stackList = document.createElement('div');
      Object.assign(stackList.style, {
        display: 'grid',
        gap: '6px',
      });

      let draggedLayerId = null;

      const clearDropIndicators = () => {
        stackList
          .querySelectorAll('[data-layer-id]')
          .forEach(rowEl => {
            rowEl.style.outline = 'none';
            rowEl.style.background = 'rgba(255,255,255,0.03)';
          });
      };

      const addRangeControl = (parent, { label, min, max, step = 0.001, getValue, setValue }) => {
        const row = document.createElement('label');
        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '8px',
          alignItems: 'center',
          fontSize: '12px',
          marginBottom: '5px',
        });

        const labelEl = document.createElement('span');
        labelEl.textContent = label;

        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          minWidth: '210px',
          gap: '6px',
          alignItems: 'center',
        });

        const input = document.createElement('input');
        input.type = 'range';
        input.min = `${min}`;
        input.max = `${max}`;
        input.step = `${step}`;

        const stepText = `${step}`;
        const decimalPlaces = stepText.includes('.') ? stepText.split('.')[1].length : 0;
        const formatValue = value => {
          if (!Number.isFinite(value)) {
            return `${min}`;
          }
          return decimalPlaces > 0 ? value.toFixed(Math.min(6, decimalPlaces)) : `${Math.round(value)}`;
        };

        const valueEl = document.createElement('input');
        valueEl.type = 'number';
        valueEl.min = `${min}`;
        valueEl.max = `${max}`;
        valueEl.step = `${step}`;
        Object.assign(valueEl.style, {
          width: '82px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '4px',
          padding: '2px 4px',
        });

        const clamp = value => Math.max(min, Math.min(max, value));

        const sync = () => {
          const value = Number(getValue());
          const normalized = Number.isFinite(value) ? clamp(value) : min;
          input.value = `${normalized}`;
          valueEl.value = formatValue(normalized);
        };

        input.addEventListener('input', () => {
          const value = clamp(Number.parseFloat(input.value));
          setValue(value);
          valueEl.value = formatValue(value);
          rebuildComposer();
        });

        valueEl.addEventListener('change', () => {
          const parsed = Number.parseFloat(valueEl.value);
          if (!Number.isFinite(parsed)) {
            sync();
            return;
          }
          const value = clamp(parsed);
          setValue(value);
          input.value = `${value}`;
          valueEl.value = formatValue(value);
          rebuildComposer();
        });

        sync();
        wrap.appendChild(input);
        wrap.appendChild(valueEl);
        row.appendChild(labelEl);
        row.appendChild(wrap);
        parent.appendChild(row);
      };

      const addColorControl = (parent, { label, getValue, setValue }) => {
        const row = document.createElement('label');
        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '8px',
          alignItems: 'center',
          fontSize: '12px',
          marginBottom: '5px',
        });

        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        const input = document.createElement('input');
        input.type = 'color';
        input.value = getValue();
        Object.assign(input.style, {
          width: '40px',
          height: '22px',
          border: 'none',
          background: 'transparent',
        });

        input.addEventListener('input', () => {
          setValue(input.value);
          rebuildComposer();
        });

        row.appendChild(labelEl);
        row.appendChild(input);
        parent.appendChild(row);
      };

      const addToneMappingControl = parent => {
        const row = document.createElement('label');
        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '8px',
          alignItems: 'center',
          fontSize: '12px',
          marginBottom: '5px',
        });

        const labelEl = document.createElement('span');
        labelEl.textContent = 'Tone Mapping';

        const select = document.createElement('select');
        Object.assign(select.style, {
          minWidth: '150px',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          padding: '4px 6px',
        });

        toneMappingOptions.forEach(option => {
          const el = document.createElement('option');
          el.value = `${option.value}`;
          el.textContent = option.label;
          select.appendChild(el);
        });

        select.value = `${this.#effects.toneMapping.method}`;
        select.addEventListener('change', () => {
          this.#effects.toneMapping.method = Number.parseFloat(select.value);
          renderer.toneMapping = this.#effects.toneMapping.method;
          rebuildComposer();
        });

        row.appendChild(labelEl);
        row.appendChild(select);
        parent.appendChild(row);
      };

      const addSettingsForPass = (passId, parent) => {
        if (passId === 'bloom') {
          addRangeControl(parent, {
            label: 'Strength', min: 0, max: 10, step: 0.001,
            getValue: () => this.#effects.bloom.settings.strength,
            setValue: value => { this.#effects.bloom.settings.strength = value; },
          });
          addRangeControl(parent, {
            label: 'Radius', min: -10, max: 10, step: 0.001,
            getValue: () => this.#effects.bloom.settings.radius,
            setValue: value => { this.#effects.bloom.settings.radius = value; },
          });
          addRangeControl(parent, {
            label: 'Threshold', min: 0, max: 10, step: 0.001,
            getValue: () => this.#effects.bloom.settings.threshold,
            setValue: value => { this.#effects.bloom.settings.threshold = value; },
          });
        }

        if (passId === 'RGBShift') {
          addRangeControl(parent, {
            label: 'Amount', min: 0, max: 0.1, step: 0.0001,
            getValue: () => this.#effects.RGBShift.shader.uniforms.amount.value,
            setValue: value => { this.#effects.RGBShift.shader.uniforms.amount.value = value; },
          });
          addRangeControl(parent, {
            label: 'Angle', min: 0, max: Math.PI * 2, step: 0.001,
            getValue: () => this.#effects.RGBShift.shader.uniforms.angle.value,
            setValue: value => { this.#effects.RGBShift.shader.uniforms.angle.value = value; },
          });
        }

        if (passId === 'afterImagePass') {
          addRangeControl(parent, {
            label: 'Damp', min: 0, max: 1, step: 0.001,
            getValue: () => this.#effects.afterImagePass.shader.uniforms.damp.value,
            setValue: value => { this.#effects.afterImagePass.shader.uniforms.damp.value = value; },
          });
        }

        if (passId === 'colorifyShader') {
          addColorControl(parent, {
            label: 'Hue',
            getValue: () => `#${this.#effects.colorifyShader.color.getHexString()}`,
            setValue: value => { this.#effects.colorifyShader.color.set(value); },
          });
        }

        if (passId === 'kaleidoShader') {
          addRangeControl(parent, {
            label: 'Sides', min: 1, max: 24, step: 1,
            getValue: () => this.#effects.kaleidoShader.shader.uniforms.sides.value,
            setValue: value => { this.#effects.kaleidoShader.shader.uniforms.sides.value = Math.max(1, Math.round(value)); },
          });
          addRangeControl(parent, {
            label: 'Angle', min: 0, max: Math.PI * 2, step: 0.001,
            getValue: () => this.#effects.kaleidoShader.shader.uniforms.angle.value,
            setValue: value => { this.#effects.kaleidoShader.shader.uniforms.angle.value = value; },
          });
        }

        if (passId === 'outputPass') {
          addToneMappingControl(parent);
          addRangeControl(parent, {
            label: 'Exposure', min: -500, max: 500, step: 0.01,
            getValue: () => renderer.toneMappingExposure,
            setValue: value => { renderer.toneMappingExposure = value; },
          });
        }
      };

      const renderStack = () => {
        stackList.innerHTML = '';
        const orderedLayers = this.#effects.getPassOrder();

        orderedLayers.forEach((passId, index) => {
          const row = document.createElement('div');
          row.dataset.layerId = passId;
          Object.assign(row.style, {
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '6px',
            background: 'rgba(255,255,255,0.03)',
          });

          const header = document.createElement('div');
          Object.assign(header.style, {
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: '8px',
          });

          const dragHandle = document.createElement('div');
          const isLocked = passId === 'outputPass';
          dragHandle.textContent = isLocked ? 'x' : '::';
          Object.assign(dragHandle.style, {
            opacity: isLocked ? '0.45' : '0.7',
            cursor: isLocked ? 'not-allowed' : 'grab',
            userSelect: 'none',
            fontWeight: '700',
            width: '18px',
            textAlign: 'center',
          });

          const nameEl = document.createElement('div');
          nameEl.textContent = `${index + 1}. ${layerLabels[passId] ?? passId}`;
          nameEl.style.fontSize = '13px';
          nameEl.style.fontWeight = '600';

          const toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.checked = Boolean(this.#effects[passId]?.enabled);
          toggle.addEventListener('change', () => {
            if (!this.#effects[passId]) {
              return;
            }
            this.#effects[passId].enabled = toggle.checked;
            if (passId === 'sobelShader') {
              syncSobelResolution();
            }
            rebuildComposer();
            renderStack();
          });

          header.appendChild(dragHandle);
          header.appendChild(nameEl);
          header.appendChild(toggle);
          row.appendChild(header);

          const settings = document.createElement('div');
          Object.assign(settings.style, {
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.12)',
            display: toggle.checked || passId === 'outputPass' ? 'block' : 'none',
          });
          addSettingsForPass(passId, settings);
          if (settings.childElementCount > 0) {
            row.appendChild(settings);
          }

          row.draggable = false;
          if (!isLocked) {
            dragHandle.draggable = true;

            dragHandle.addEventListener('pointerdown', () => {
              row.draggable = true;
            });

            dragHandle.addEventListener('pointerup', () => {
              row.draggable = false;
            });

            dragHandle.addEventListener('pointercancel', () => {
              row.draggable = false;
            });

            row.addEventListener('dragstart', event => {
              if (event.target !== dragHandle) {
                event.preventDefault();
                row.draggable = false;
                return;
              }
              draggedLayerId = passId;
              row.style.opacity = '0.55';
              clearDropIndicators();
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', passId);
            });

            row.addEventListener('dragend', () => {
              row.style.opacity = '1';
              draggedLayerId = null;
              clearDropIndicators();
              row.draggable = false;
            });
          }

          row.addEventListener('dragenter', event => {
            if (!draggedLayerId || draggedLayerId === passId) {
              return;
            }
            event.preventDefault();
            clearDropIndicators();
            row.style.outline = '2px solid rgba(123, 190, 255, 0.95)';
            row.style.background = 'rgba(123, 190, 255, 0.2)';
          });

          row.addEventListener('dragleave', event => {
            if (!event.currentTarget?.contains(event.relatedTarget)) {
              row.style.outline = 'none';
              row.style.background = 'rgba(255,255,255,0.03)';
            }
          });

          row.addEventListener('dragover', event => {
            if (!draggedLayerId) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          });

          row.addEventListener('drop', event => {
            if (!draggedLayerId) {
              return;
            }
            event.preventDefault();

            const currentOrder = this.#effects.getPassOrder();
            const movable = currentOrder.filter(id => id !== 'outputPass');
            const from = movable.indexOf(draggedLayerId);
            if (from < 0) {
              return;
            }

            const targetLayerId = row.dataset.layerId;
            let to = movable.indexOf(targetLayerId);
            if (targetLayerId === 'outputPass') {
              to = movable.length - 1;
            }
            if (to < 0) {
              return;
            }

            const [moved] = movable.splice(from, 1);
            movable.splice(to, 0, moved);
            this.#effects.setPassOrder([...movable, 'outputPass']);
            rebuildComposer();
            renderStack();
          });

          stackList.appendChild(row);
        });
      };

      const closeRow = document.createElement('div');
      Object.assign(closeRow.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '6px',
      });

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Close';
      Object.assign(closeButton.style, {
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        padding: '6px 10px',
        cursor: 'pointer',
      });

      const refresh = () => {
        renderStack();
      };

      const close = () => {
        clearDropIndicators();
        overlay.style.display = 'none';
      };

      const positionDock = () => {
        const rect = renderer.domElement.getBoundingClientRect();
        const gutter = 12;
        const viewportMargin = 8;

        if (useIntegratedControls) {
          const panelWidth = Math.max(
            220,
            Math.min(300, Math.floor(rect.width * 0.28)),
          );
          const maxHeight = Math.max(200, Math.floor(rect.height - viewportMargin * 2));
          const left = Math.max(viewportMargin, rect.right - panelWidth - viewportMargin);
          const top = Math.max(viewportMargin, rect.top + viewportMargin);

          panel.style.width = `${panelWidth}px`;
          panel.style.maxHeight = `${Math.floor(maxHeight)}px`;
          overlay.style.left = `${Math.round(left)}px`;
          overlay.style.top = `${Math.round(top)}px`;
          return;
        }

        let panelWidth = Math.min(380, Math.max(280, Math.floor(window.innerWidth * 0.32)));
        const maxAllowed = Math.max(240, window.innerWidth - viewportMargin * 2);
        panelWidth = Math.min(panelWidth, maxAllowed);
        panel.style.width = `${panelWidth}px`;

        const rightSpace = window.innerWidth - rect.right - gutter;
        const leftSpace = rect.left - gutter;

        let left = rect.right + gutter;

        if (rightSpace < panelWidth && leftSpace >= panelWidth) {
          left = rect.left - panelWidth - gutter;
        } else if (rightSpace < panelWidth && leftSpace < panelWidth) {
          panelWidth = Math.max(240, Math.min(window.innerWidth - viewportMargin * 2, panelWidth));
          panel.style.width = `${panelWidth}px`;
          left = Math.max(
            viewportMargin,
            Math.min(rect.right + gutter, window.innerWidth - panelWidth - viewportMargin),
          );
        }

        const top = Math.max(
          viewportMargin,
          Math.min(rect.top, window.innerHeight - 120),
        );
        const maxHeight = Math.max(
          220,
          Math.min(rect.height, window.innerHeight - top - viewportMargin),
        );

        overlay.style.left = `${Math.round(left)}px`;
        overlay.style.top = `${Math.round(top)}px`;
        panel.style.maxHeight = `${Math.floor(maxHeight)}px`;
      };

      const handleViewportLayoutChange = () => {
        if (overlay.style.display !== 'none') {
          positionDock();
        }
      };

      const open = () => {
        refresh();
        positionDock();
        overlay.style.display = 'block';
      };

      closeButton.addEventListener('click', close);

      window.addEventListener('resize', handleViewportLayoutChange);
      window.addEventListener('scroll', handleViewportLayoutChange, true);

      closeRow.appendChild(closeButton);
      panel.appendChild(title);
      panel.appendChild(hint);
      stackSection.appendChild(stackTitle);
      stackSection.appendChild(stackList);
      panel.appendChild(stackSection);
      panel.appendChild(closeRow);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      return {
        element: overlay,
        open,
        close,
        refresh,
      };
    };

    const createSceneCameraDock = () => {
      const overlay = document.createElement('div');
      overlay.className = 'mage-scene-camera-dock';
      Object.assign(overlay.style, {
        position: 'fixed',
        zIndex: '40',
        display: 'none',
        pointerEvents: 'none',
      });

      const panel = document.createElement('div');
      Object.assign(panel.style, {
        width: '320px',
        maxHeight: '84vh',
        overflow: 'auto',
        padding: '12px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(13, 17, 26, 0.95)',
        color: '#fff',
        display: 'grid',
        gap: '10px',
        pointerEvents: 'auto',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
      });

      const title = document.createElement('div');
      title.textContent = 'Scene + Camera';
      Object.assign(title.style, {
        fontSize: '16px',
        fontWeight: '700',
      });

      const hint = document.createElement('div');
      hint.textContent = 'Visualizer state and camera controls.';
      Object.assign(hint.style, {
        fontSize: '12px',
        opacity: '0.8',
      });

      const makeSection = label => {
        const section = document.createElement('div');
        Object.assign(section.style, {
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '10px',
          padding: '8px',
        });

        const sectionTitle = document.createElement('div');
        sectionTitle.textContent = label;
        Object.assign(sectionTitle.style, {
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '8px',
        });
        section.appendChild(sectionTitle);

        const content = document.createElement('div');
        content.style.display = 'grid';
        section.appendChild(content);
        return { section, content };
      };

      const makeRow = (parent, labelText) => {
        const row = document.createElement('label');
        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '6px',
          fontSize: '12px',
        });
        const label = document.createElement('span');
        label.textContent = labelText;
        row.appendChild(label);
        parent.appendChild(row);
        return row;
      };

      const sceneSection = makeSection('Scene Settings');
      const cameraSection = makeSection('Camera Settings');
      const syncers = [];

      const addRangeControl = (parent, { label, min, max, step = 0.001, getValue, setValue, onCommit }) => {
        const row = makeRow(parent, label);
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          alignItems: 'center',
          gap: '8px',
          minWidth: '220px',
        });

        const input = document.createElement('input');
        input.type = 'range';
        input.min = `${min}`;
        input.max = `${max}`;
        input.step = `${step}`;

        const stepText = `${step}`;
        const decimalPlaces = stepText.includes('.') ? stepText.split('.')[1].length : 0;
        const formatValue = value => {
          if (!Number.isFinite(value)) {
            return `${min}`;
          }
          return decimalPlaces > 0 ? value.toFixed(Math.min(6, decimalPlaces)) : `${Math.round(value)}`;
        };

        const valueLabel = document.createElement('input');
        valueLabel.type = 'number';
        valueLabel.min = `${min}`;
        valueLabel.max = `${max}`;
        valueLabel.step = `${step}`;
        Object.assign(valueLabel.style, {
          width: '86px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '4px',
          padding: '2px 4px',
        });

        const clamp = value => Math.max(min, Math.min(max, value));

        const sync = () => {
          const value = Number(getValue());
          const normalized = Number.isFinite(value) ? clamp(value) : min;
          input.value = `${normalized}`;
          valueLabel.value = formatValue(normalized);
        };

        input.addEventListener('input', () => {
          const value = clamp(Number.parseFloat(input.value));
          setValue(value);
          valueLabel.value = formatValue(value);
          if (typeof onCommit === 'function') {
            onCommit();
          }
        });

        valueLabel.addEventListener('change', () => {
          const parsed = Number.parseFloat(valueLabel.value);
          if (!Number.isFinite(parsed)) {
            sync();
            return;
          }
          const value = clamp(parsed);
          setValue(value);
          input.value = `${value}`;
          valueLabel.value = formatValue(value);
          if (typeof onCommit === 'function') {
            onCommit();
          }
        });

        wrap.appendChild(input);
        wrap.appendChild(valueLabel);
        row.appendChild(wrap);
        syncers.push(sync);
        sync();
      };

      const addCheckboxControl = (parent, { label, getValue, setValue, onCommit }) => {
        const row = makeRow(parent, label);
        const input = document.createElement('input');
        input.type = 'checkbox';

        const sync = () => {
          input.checked = Boolean(getValue());
        };

        input.addEventListener('change', () => {
          setValue(input.checked);
          if (typeof onCommit === 'function') {
            onCommit();
          }
        });

        row.appendChild(input);
        syncers.push(sync);
        sync();
      };

      const addSelectControl = (parent, { label, options, getValue, setValue, onCommit }) => {
        const row = makeRow(parent, label);
        const select = document.createElement('select');
        Object.assign(select.style, {
          minWidth: '170px',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          padding: '4px 6px',
        });

        options.forEach(option => {
          const el = document.createElement('option');
          el.value = `${option.value}`;
          el.textContent = option.label;
          select.appendChild(el);
        });

        const sync = () => {
          select.value = `${getValue()}`;
        };

        select.addEventListener('change', () => {
          setValue(Number.parseFloat(select.value));
          if (typeof onCommit === 'function') {
            onCommit();
          }
        });

        row.appendChild(select);
        syncers.push(sync);
        sync();
      };

      const embeddedSkyboxIds = Object.keys(EMBEDDED_SKYBOXES)
        .map(value => Number.parseInt(value, 10))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

      if (
        embeddedSkyboxIds.length > 0
        && !embeddedSkyboxIds.includes(Number.parseInt(`${visualizer.skyboxPreset}`, 10))
      ) {
        visualizer.skyboxPreset = embeddedSkyboxIds[0];
      }

      addSelectControl(sceneSection.content, {
        label: 'Skybox',
        options: embeddedSkyboxIds.map(id => ({ label: `${id}`, value: id })),
        getValue: () => Number.parseInt(`${visualizer.skyboxPreset}`, 10) || embeddedSkyboxIds[0] || 0,
        setValue: value => {
          visualizer.skyboxPreset = value;
          engine.#_loadSkybox({
            type: 'preset',
            presetId: Number.parseInt(`${value}`, 10) || 0,
          });
        },
      });

      addRangeControl(sceneSection.content, {
        label: 'MOD 1',
        min: 0.01,
        max: 2.0,
        getValue: () => state.minimizing_factor,
        setValue: value => {
          state.minimizing_factor = value;
        },
      });

      addRangeControl(sceneSection.content, {
        label: 'MOD 2',
        min: 1.0,
        max: 10.0,
        step: 0.01,
        getValue: () => state.power_factor,
        setValue: value => {
          state.power_factor = value;
        },
      });

      addRangeControl(sceneSection.content, {
        label: 'MOD 3',
        min: 0.0,
        max: 1.0,
        getValue: () => state.pointerDownMultiplier,
        setValue: value => {
          state.pointerDownMultiplier = value;
        },
      });

      addRangeControl(sceneSection.content, {
        label: 'Base Speed',
        min: 0.01,
        max: 0.9,
        getValue: () => state.base_speed,
        setValue: value => {
          state.base_speed = value;
        },
      });

      addRangeControl(sceneSection.content, {
        label: 'Easing Speed',
        min: 0.01,
        max: 0.9,
        getValue: () => state.easing_speed,
        setValue: value => {
          state.easing_speed = value;
        },
      });

      addRangeControl(sceneSection.content, {
        label: 'Scale',
        min: 1,
        max: 200,
        step: 0.1,
        getValue: () => visualizer.scale,
        setValue: value => {
          visualizer.scale = value;
        },
      });

      addCheckboxControl(sceneSection.content, {
        label: 'Auto Rotate',
        getValue: () => controls.autoRotate,
        setValue: value => {
          controls.autoRotate = value;
        },
      });

      addRangeControl(sceneSection.content, {
        label: 'Rotation Speed',
        min: 0.1,
        max: 50,
        step: 0.01,
        getValue: () => controls.autoRotateSpeed,
        setValue: value => {
          controls.autoRotateSpeed = value;
        },
      });

      addRangeControl(cameraSection.content, {
        label: 'FOV',
        min: 1,
        max: 359,
        step: 1,
        getValue: () => camera.fov,
        setValue: value => {
          camera.fov = value;
          camera.updateProjectionMatrix();
        },
      });

      addRangeControl(cameraSection.content, {
        label: 'Camera Orientation',
        min: 0,
        max: 2 * Math.PI,
        step: 0.001,
        getValue: () => state.camTilt,
        setValue: value => {
          state.camTilt = value;
          camera.up.set(
            Math.sin(state.camTilt),
            Math.cos(state.camTilt),
            -Math.sin(state.camTilt),
          );
        },
      });

      const resetRow = document.createElement('div');
      Object.assign(resetRow.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '6px',
      });
      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.textContent = 'Reset Camera';
      Object.assign(resetButton.style, {
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        padding: '6px 10px',
        cursor: 'pointer',
      });
      resetButton.addEventListener('click', () => {
        controls.reset();
      });
      resetRow.appendChild(resetButton);
      cameraSection.content.appendChild(resetRow);

      const closeRow = document.createElement('div');
      Object.assign(closeRow.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '6px',
      });

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Close';
      Object.assign(closeButton.style, {
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        padding: '6px 10px',
        cursor: 'pointer',
      });

      const refresh = () => {
        syncers.forEach(sync => sync());
      };

      const close = () => {
        overlay.style.display = 'none';
      };

      const positionDock = () => {
        const rect = renderer.domElement.getBoundingClientRect();
        const gutter = 12;
        const viewportMargin = 8;

        if (useIntegratedControls) {
          const panelWidth = Math.max(
            220,
            Math.min(290, Math.floor(rect.width * 0.26)),
          );
          const maxHeight = Math.max(200, Math.floor(rect.height - viewportMargin * 2));
          const left = Math.max(viewportMargin, rect.left + viewportMargin);
          const top = Math.max(viewportMargin, rect.top + viewportMargin);

          panel.style.width = `${panelWidth}px`;
          panel.style.maxHeight = `${Math.floor(maxHeight)}px`;
          overlay.style.left = `${Math.round(left)}px`;
          overlay.style.top = `${Math.round(top)}px`;
          return;
        }

        let panelWidth = Math.min(360, Math.max(280, Math.floor(window.innerWidth * 0.28)));
        const maxAllowed = Math.max(240, window.innerWidth - viewportMargin * 2);
        panelWidth = Math.min(panelWidth, maxAllowed);
        panel.style.width = `${panelWidth}px`;

        const leftSpace = rect.left - gutter;
        const rightSpace = window.innerWidth - rect.right - gutter;
        const leftNudge = 30; // increase for more left shift

        let left = rect.left - panelWidth - gutter - leftNudge;
        if (leftSpace < panelWidth && rightSpace >= panelWidth) {
          left = rect.right + gutter;
        } else if (leftSpace < panelWidth && rightSpace < panelWidth) {
          left = viewportMargin;
        }

        const top = Math.max(viewportMargin, Math.min(rect.top, window.innerHeight - 120));
        const maxHeight = Math.max(220, Math.min(rect.height, window.innerHeight - top - viewportMargin));

        overlay.style.left = `${Math.round(left)}px`;
        overlay.style.top = `${Math.round(top)}px`;
        panel.style.maxHeight = `${Math.floor(maxHeight)}px`;
      };

      const handleViewportLayoutChange = () => {
        if (overlay.style.display !== 'none') {
          positionDock();
        }
      };

      const open = () => {
        refresh();
        positionDock();
        overlay.style.display = 'block';
      };

      closeButton.addEventListener('click', close);
      window.addEventListener('resize', handleViewportLayoutChange);
      window.addEventListener('scroll', handleViewportLayoutChange, true);

      closeRow.appendChild(closeButton);
      panel.appendChild(title);
      panel.appendChild(hint);
      panel.appendChild(sceneSection.section);
      panel.appendChild(cameraSection.section);
      panel.appendChild(closeRow);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      return {
        element: overlay,
        open,
        close,
        refresh,
      };
    };

    const initTweakpane = () => {

      // const previousPresetLoaded = engine.#onPresetLoaded;
      // engine.#onPresetLoaded = preset => {
      //   if (typeof previousPresetLoaded === 'function') {
      //     previousPresetLoaded(preset);
      //   }
      //   setQuickPresetsVisible(!preset);
      // };

      // engine.setEmbeddedPresetButtonsVisible = visible => {
      //   setQuickPresetsVisible(Boolean(visible));
      // };

      const paneMount = document.createElement('div');
      paneMount.className = 'mage-pane-host';
      Object.assign(paneMount.style, {
        position: 'absolute',
        top: useIntegratedControls ? '6px' : '8px',
        right: useIntegratedControls ? '6px' : '8px',
        zIndex: '20',
      });
      host.appendChild(paneMount);

      pane = new Pane({ container: paneMount });

      pane
        .addButton({
          title: 'Randomize',
          label: '???',
        })
        .on('click', () => {
          randomizeSettings();
          pane.refresh();
        });

      fxStudioOverlay = createFxStudioOverlay();
      sceneCameraDock = createSceneCameraDock();
      pane.hidden = true;

      // Expose tweakpane state export so engine.toPreset can include settings.
      // engine.#exportSettingsState = () => {
      //   if (!pane) {
      //     return null;
      //   }
      //   return pane.exportState();
      // };

      engine.#importSettingsState = state => {
        if (!pane) {
          return;
        } else {
          pane.importState(state);
          pane.refresh();

          renderer.toneMapping = this.#effects.toneMapping.method;
          if (typeof engine.#_syncSobelResolution === 'function') {
            engine.#_syncSobelResolution();
          }

          rebuildComposer();
          sceneCameraDock?.refresh();
          fxStudioOverlay?.refresh();
        } 
      };

      engine.#refreshSettingsUI = () => {
        if (!pane) {
          return;
        }
        pane.refresh();
        fxStudioOverlay?.refresh();
        sceneCameraDock?.refresh();
      };
    };

    const getOS = () => {
      const userAgent = window.navigator.userAgent;
      const platform =
        window.navigator?.userAgentData?.platform || window.navigator.platform;
      const macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
      const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
      const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
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
    };

    const toggleUI = () => {
      // const buttonsContainer = document.querySelector('.ui_buttons');
      // buttonsContainer.style.display =
      //   buttonsContainer.style.display === 'flex' ? 'none' : 'flex';
              // const tooltipImage = tooltipUI.element.querySelector('img');
          // if (tooltipImage) {
          //   tooltipImage.hidden = false;
          // }
          // visualizer.render_tooltips = true;
          // tooltipUI.visible = true;
      if (pane) {
        pane.hidden = !pane.hidden;
        if (pane.hidden && fxStudioOverlay) {
          fxStudioOverlay.close();
        } else {
          fxStudioOverlay.open();
        }
        if (pane.hidden && sceneCameraDock) {
          sceneCameraDock.close();
        } else {
          sceneCameraDock.open();
        }
      }
    };

    const switchControls = () => {
      visualizer.render_tooltips = false;
      if (pane) {
        pane.hidden = true;
      }
      toggleUI();
      const hideUIbutton = document.getElementById('ui_hide');
      hideUIbutton.style.display = 'none';
    };

    const eventSetup = () => {
      const hideQuickPresets = () => {
        if (engine.#presetDock) {
          engine.#presetDock.setQuickPresetsVisible(false);
        }
      };

      window.addEventListener('resize', () => {
        if (typeof engine.#_syncViewport === 'function') {
          engine.#_syncViewport(true);
        }
        if (typeof engine.#_syncSobelResolution === 'function') {
          engine.#_syncSobelResolution();
        }
        rebuildComposer();
      });

      if (engine.#windowInputBridge) {
        engine.#windowInputBridge.onToggleUI = () => {
          hideQuickPresets();
          toggleUI();
        };
        engine.#windowInputBridge.onHideQuickPresets = () => {
          hideQuickPresets();
        };
        engine.#windowInputBridge.onUpdateTooltip = ({ visible, x, y }) => {
          tooltipUI.visible = visible;
          tooltipUI.x = x;
          tooltipUI.y = y;
        };
      }

      if (engine.#externalInputBridge) {
        engine.#externalInputBridge.onToggleUI = engine.#windowInputBridge?.onToggleUI || null;
        engine.#externalInputBridge.onHideQuickPresets = engine.#windowInputBridge?.onHideQuickPresets || null;
        engine.#externalInputBridge.onUpdateTooltip = engine.#windowInputBridge?.onUpdateTooltip || null;
      }
    };

    // const openShaderSelectionWindow = visualizer => {
    //   if (!visualizer || !Array.isArray(visualizer.shaders) || visualizer.shaders.length === 0) {
    //     window.alert('No saved shaders available yet. Load a shader preset first.');
    //     return;
    //   }

    //   const existingOverlay = document.getElementById('mage-shader-picker-overlay');
    //   if (existingOverlay) {
    //     existingOverlay.remove();
    //   }

    //   const overlay = document.createElement('div');
    //   overlay.id = 'mage-shader-picker-overlay';
    //   Object.assign(overlay.style, {
    //     position: 'fixed',
    //     inset: '0',
    //     zIndex: '10000',
    //     background: 'rgba(0, 0, 0, 0.55)',
    //     display: 'flex',
    //     alignItems: 'center',
    //     justifyContent: 'center',
    //     padding: '12px',
    //   });

    //   const dialog = document.createElement('div');
    //   Object.assign(dialog.style, {
    //     width: 'min(640px, 96vw)',
    //     maxHeight: '80vh',
    //     overflow: 'auto',
    //     borderRadius: '10px',
    //     border: '1px solid rgba(255, 255, 255, 0.2)',
    //     background: 'rgba(20, 24, 30, 0.95)',
    //     color: '#fff',
    //     padding: '14px',
    //     fontFamily: 'sans-serif',
    //   });

    //   const title = document.createElement('div');
    //   title.textContent = 'Select Shader by ID';
    //   Object.assign(title.style, {
    //     fontSize: '16px',
    //     fontWeight: '600',
    //     marginBottom: '10px',
    //   });

    //   const selector = document.createElement('select');
    //   selector.size = Math.min(12, visualizer.shaders.length);
    //   Object.assign(selector.style, {
    //     width: '100%',
    //     minHeight: '180px',
    //     background: 'rgba(0, 0, 0, 0.35)',
    //     color: '#fff',
    //     border: '1px solid rgba(255, 255, 255, 0.25)',
    //     borderRadius: '8px',
    //     padding: '6px',
    //   });

    //   visualizer.shaders.forEach((shaderItem, index) => {
    //     const option = document.createElement('option');
    //     option.value = `${shaderItem.id}`;
    //     const isActive = index === visualizer.shaderIndex;
    //     option.textContent = `${isActive ? '* ' : ''}${shaderItem.id}`;
    //     option.selected = isActive;
    //     selector.appendChild(option);
    //   });

    //   const actions = document.createElement('div');
    //   Object.assign(actions.style, {
    //     display: 'flex',
    //     justifyContent: 'flex-end',
    //     gap: '8px',
    //     marginTop: '12px',
    //   });

    //   const cancelButton = document.createElement('button');
    //   cancelButton.type = 'button';
    //   cancelButton.textContent = 'Cancel';
    //   Object.assign(cancelButton.style, {
    //     border: '1px solid rgba(255, 255, 255, 0.2)',
    //     borderRadius: '6px',
    //     background: 'transparent',
    //     color: '#fff',
    //     padding: '8px 10px',
    //     cursor: 'pointer',
    //   });

    //   const applyButton = document.createElement('button');
    //   applyButton.type = 'button';
    //   applyButton.textContent = 'Apply';
    //   Object.assign(applyButton.style, {
    //     border: '1px solid rgba(255, 255, 255, 0.2)',
    //     borderRadius: '6px',
    //     background: '#2f6aff',
    //     color: '#fff',
    //     padding: '8px 10px',
    //     cursor: 'pointer',
    //   });

    //   const closeDialog = () => {
    //     overlay.remove();
    //   };

    //   const applySelectedShader = () => {
    //     const selectedShaderId = selector.value;
    //     const selectedIndex = visualizer.shaders.findIndex(
    //       shaderItem => `${shaderItem.id}` === `${selectedShaderId}`,
    //     );

    //     if (selectedIndex < 0) {
    //       return;
    //     }

    //     const selectedShader = visualizer.shaders[selectedIndex];
    //     visualizer.shaderIndex = selectedIndex;
    //     visualizer.load(selectedShader.shader, false);
    //     closeDialog();
    //   };

    //   cancelButton.addEventListener('click', closeDialog);
    //   applyButton.addEventListener('click', applySelectedShader);
    //   selector.addEventListener('dblclick', applySelectedShader);
    //   overlay.addEventListener('click', event => {
    //     if (event.target === overlay) {
    //       closeDialog();
    //     }
    //   });
    //   document.addEventListener(
    //     'keydown',
    //     event => {
    //       if (event.key === 'Escape' && document.body.contains(overlay)) {
    //         closeDialog();
    //       }
    //     },
    //     { once: true },
    //   );

    //   actions.appendChild(cancelButton);
    //   actions.appendChild(applyButton);
    //   dialog.appendChild(title);
    //   dialog.appendChild(selector);
    //   dialog.appendChild(actions);
    //   overlay.appendChild(dialog);
    //   document.body.appendChild(overlay);
    //   selector.focus();
    // };

    initTweakpane();
    eventSetup();
    if (getOS() !== ('Windows' || 'Mac OS' || 'Linux')) {
      switchControls();
    }
    
    this.#controlPanel = pane;
  }

  openPresetDock() {
    if (!this.#controlSettings.active) {
      this.initControls();
    }
    if (!this.#controlSettings.active) {
      return;
    }
    if (this.#presetDock) {
      this.#presetDock.show();
      return;
    }
    
    this.#presetDock = new MAGEPresetDock(
      this, 
      this.#scene,
      this.#renderer,
      this.#camera,
      this.#controls,
      this.#canvas,
      this.#controlSettings,
    );

    this.#presetDock.initialize();

    this.#presetDock.show();

    const handlePresetDockLayoutChange = () => {
        const { quickPresetHost } = this.#presetDock;
        if (quickPresetHost.style.display !== 'none') {
          this.#presetDock.positionPresetDock();
        }
    };
    window.addEventListener('resize', handlePresetDockLayoutChange);
    window.addEventListener('scroll', handlePresetDockLayoutChange, true);


  }
}



