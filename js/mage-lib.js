// MAGE Engine - Modular Architecture for Graphics and Effects
// This module serves as the main entry point for the MAGE Engine, providing
// initialization and access to core components like the engine and controls.

/* USAGE:
import { initMAGE } from './mage-lib.js';
import { initMAGE } from './mage-engine.mjs // If using ES modules

Create a MAGE object with the desired configuration options. For example:
const { engine, controls } = initMAGE({
  canvas: document.getElementById('myCanvas'), // Optional: specify a canvas element
  withControls: true, // Optional: include controls (default: true)
  autoStart: true, // Optional: automatically start the engine (default: false)
  options: { log: true } // Optional: additional engine options (default: { log: true })
});

The returned object includes the initialized engine and controls (if created) for further use in your application.
i.e.
engine.start() -> Starts rendering inside the canvas element (begins as default preset)
engine.loadPreset(MAGEPreset.SOME_PRESET_JSON) -> Loads a preset from a JSON object or URL
engine.loadAudio('path/to/audio/file.mp3') -> Loads audio from a URL or file
engine.play() -> Plays the currently loaded audio (if not already playing)
engine.pause() -> Pauses the currently playing audio
engine.toPreset() -> returns the current preset as a MAGEPreset instance
*/


// Import core components and utilities
import { MAGEEngine } from './MAGEEngine.js';

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

/**
 * Initialize the MAGE engine
 * @param {MAGEOptions} options
 * @returns {MAGEEngine}
 */
export function initMAGE({ canvas, log = false, withControls = { active: true, integrated: false }, autoStart = false } = {}) {
  // Initialize the MAGE Engine with the provided canvas and configuration options.
  const engine = new MAGEEngine({ canvas, log, withControls, autoStart });

  window.engine = engine; // Expose the engine globally for debugging and external access

  // Return the initialized engine and controls (if created) for external use.
  return engine;
}