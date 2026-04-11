# MAGE Engine - Modular Architecture for Graphics and Effects

[![Video Title](https://img.youtube.com/vi/5CxVeUv1_FY/0.jpg)](https://www.youtube.com/watch?v=5CxVeUv1_FY)

MAGE is an AI-powered music visualizer that utilizes heavy randomization of Shaderpark shaders to create unique, audio-reactive environments. Perfect for musicians looking to produce captivating music videos, artists trying to create mesmerizing visual effects, or developers exploring generative AI and audio-reactive environments.

## Installation

```bash
npm install mage
```

## Quick Start

```javascript
import { initMAGE } from 'mage';

const engine = initMAGE({
  canvas: document.getElementById('myCanvas'),  // Optional: specify a canvas element
  withControls: true,                            // Optional: include controls (default: true)
  autoStart: true,                               // Optional: automatically start rendering (default: false)
  log: true                                      // Optional: enable logging (default: true)
});

engine.start();
```

## Public API

### `initMAGE(options?)`

Initializes and returns a MAGE engine instance with the specified configuration.

**Options:**
- `canvas?: HTMLCanvasElement` - Target canvas element for rendering (optional)
- `withControls?: boolean` - Enable interactive UI controls (default: true)
- `autoStart?: boolean` - Start rendering immediately (default: false)
- `log?: boolean` - Enable console logging (default: true)

**Returns:** `MAGEEngineAPI` instance

### Engine Methods

#### Rendering & Lifecycle

- **`start()`** - Starts rendering in the canvas (initializes with default preset)
- **`dispose()`** - Cleans up resources and stops rendering

#### Audio Playback

- **`loadAudio(url: string)`** - Load audio from a URL or file path
- **`isAudioLoaded(): boolean`** - Check if audio is currently loaded
- **`play()`** - Play the currently loaded audio
- **`pause()`** - Pause the currently playing audio
- **`seek(time: number)`** - Seek to a specific time in the audio (in seconds)
- **`scrubAudio(time: number)`** - Scrub/drag through the audio timeline
- **`getAudioTime(): number`** - Get the current playback time (in seconds)
- **`getAudioDuration(): number`** - Get the total duration of loaded audio (in seconds)

#### Presets

- **`loadPreset(preset: object | string)`** - Load a preset from a JSON object or URL
- **`toPreset()`** - Export the current state as a MAGEPreset JSON object

#### Display

- **`swapCanvas(canvas: HTMLCanvasElement)`** - Switch to a different canvas element
- **`toggleFullscreen()`** - Toggle fullscreen mode
- **`getEngineTime(): number`** - Get the current engine/visualization time

#### Capture & Preview

- **`captureFramePreview()`** - Capture the current frame as a preview image
- **`captureThumbnail()`** - Capture a thumbnail of the current visualization

#### Controls

- **`initControls()`** - Initialize interactive UI controls
- **`showViewportMessage(message: string, duration?: number)`** - Display a temporary message in the viewport

## Example Usage

```javascript
import { initMAGE } from 'mage';

// Initialize engine
const engine = initMAGE({
  canvas: document.getElementById('visualizer'),
  withControls: true,
  autoStart: true
});

// Load and play audio
await engine.loadAudio('/path/to/music.mp3');
engine.play();

// Load a preset
engine.loadPreset({
  // preset configuration object
});

// Seek and control playback
engine.seek(30); // Jump to 30 seconds
console.log(engine.getAudioTime()); // Current time
console.log(engine.getAudioDuration()); // Total duration

// Capture visualization
const thumbnail = engine.captureThumbnail();

// Export current state
const currentPreset = engine.toPreset();
```
