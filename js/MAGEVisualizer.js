import { generateshaderparkcode } from "./generateshaderparkcode";
import { BoxGeometry } from 'three';
import { createSculptureWithGeometry } from "shader-park-core";

export class MAGEVisualizer {
  constructor(engine) {
    this.engine = engine;
    this.seed = 0;
    this.shaderIndex = -1;
    this.shaders = [];
    this.skyboxPreset = null;
    this.mesh = null;
    this.scale = 10.0;
    this.intersected = false;
    this.clickable = false;
    this.controllingAudio = false;
    this.render_tooltips = true;
    this.centerClickRadiusNdc = 0.35;
  }

  /**
   * @typedef {Object} ShaderLoadOptions
   * @property {string|object} [shader] - The shader code to load, either as a string or an object containing a 'shader' property. If invalid or missing, a new shader will be generated.
   * @property {boolean} [addToHistory=false] - Whether to add the loaded shader to the history for navigation.
   * @property {boolean} [clearHistory=false] - Whether to clear the shader history when loading this shader.
   */

  /**
   * @param {ShaderLoadOptions} options 
   * @returns {string|null} The final shader code that was loaded, or null if loading failed.
   * @description Loads a shader into the visualizer, replacing the current one. If no valid shader code is provided, generates a new shader using the built-in generator. 
   * Optionally adds the shader to the history for navigation and can clear history when loading a new shader. Returns the final shader code that was loaded, or null 
   * if loading failed due to invalid input.
   */

  load({ shader = null, addToHistory = true, clearHistory = false } = {}){

    // If shader input is missing/invalid, generate one.
    let finalShaderCode = null;
    let shaderCode = shader;
    if (typeof shaderCode === 'string') {
      finalShaderCode = shaderCode;
    } else if (
      shaderCode &&
      typeof shaderCode === 'object' &&
      typeof shaderCode.shader === 'string'
    ) {
      finalShaderCode = shaderCode.shader;
    } else if (
      shaderCode &&
      typeof shaderCode === 'object' &&
      typeof shaderCode.code === 'string'
    ) {
      finalShaderCode = shaderCode.code;
    } else {
      finalShaderCode = generateshaderparkcode(this, 'generator_v1.5');
    }
    if (!finalShaderCode) {
      throw new Error('Failed to load shader: No valid shader code provided and generation failed.');
      return null;
    }
    if (clearHistory) {
      this.shaders = [];
      this.shaderIndex = -1;
    }
    if (addToHistory) {
      this.shaders.push({
        //id: MAGEEngine.#_idFromShaderCode(finalShaderCode),
        shader: finalShaderCode,
        timestamp: Date.now(),
      });
      this.shaderIndex = this.shaders.length - 1;
    }

    this.createMesh(finalShaderCode);
  }

  createMesh(shaderCode) {
    const state = this.engine.state;
    const geometry = new BoxGeometry(20000, 20000, 20000);
    
    // Only pass audio params if the shader declares them
    const hasAudioInputs = shaderCode &&
      shaderCode.includes('let bass = input()') &&
      shaderCode.includes('let mid = input()') &&
      shaderCode.includes('let treble = input()') &&
      shaderCode.includes('let energy = input()') &&
      shaderCode.includes('let spectralCentroid = input()') &&
      shaderCode.includes('let energyTrend = input()');
    
    this.mesh = createSculptureWithGeometry(geometry, shaderCode, () => {
          const callback = {
            time: state.time ?? 0,
            size: state.size ?? 0,
            pointerDown: state.pointerDown ?? 0,
            mouse: state.mouse ?? { x: 0, y: 0 },
            _scale: this.scale ?? 1,
          };
          
          // Only add audio params if shader declares them (allows legacy shaders to work)
          if (hasAudioInputs) {
            callback.bass = state.currBass ?? 0;
            callback.mid = state.currMid ?? 0;
            callback.treble = state.currTreble ?? 0;
            callback.energy = state.currEnergy ?? 0;
            callback.spectralCentroid = state.currCentroid ?? 0;
            callback.energyTrend = state.currEnergyTrend ?? 0;
          }
          
          return callback;
    });
  }

  getActiveShader() {
    if (this.shaderIndex >= 0 && this.shaderIndex < this.shaders.length) {
      return this.shaders[this.shaderIndex].shader;
    }
    return null;
  }

  previousShader() {
    if (this.shaders.length <= 1) {
      return;
    }
    let nextShader;
    if (this.shaderIndex <= 0) {
      this.engine.showViewportMessage(`Reached first visualizer.`, 25);
      return;
    } else {
      nextShader = this.shaders[this.shaderIndex - 1];
      this.shaderIndex--;
    }
    this.load({ shader: nextShader.shader, addToHistory: false });
    this.engine.showViewportMessage(`Loading previous visualizer...`, 25);
    return;
  }

  nextShader() {
    if (this.shaders.length <= 1) {
      return;
    }
    let nextShader;
    if (this.shaderIndex >= this.shaders.length - 1) {
      this.engine.showViewportMessage(`Reached latest visualizer.`, 25);
      return;
    } else {
      nextShader = this.shaders[this.shaderIndex + 1];
      this.shaderIndex++;
    }
    this.load({ shader: nextShader.shader, addToHistory: false });
    this.engine.showViewportMessage(`Loading next visualizer...`, 25);
    return;
  }
}