# MAGE Engine - Modular Architecture for Graphics and Effects

[![Video Title](https://img.youtube.com/vi/5CxVeUv1_FY/0.jpg)](https://www.youtube.com/watch?v=5CxVeUv1_FY)

MAGE is an AI-powered music visualizer that utilizes heavy randomization of Shaderpark shaders to create unique, audio-reactive environments. Perfect for musicians looking to produce captivating music videos, artists trying to create mesmerizing visual effects, or developers exploring generative AI and audio-reactive environments.

## Installation

```bash
npm install @notrac/mage
```

## Quick Start

```javascript
import { initMAGE } from '@notrac/mage';

const engine = initMAGE({
  canvas: document.getElementById('myCanvas'),      // Optional: specify a canvas element
  withControls: { active: true, integrated: true }, // Optional: include controls (default: true)
  autoStart: true,                                  // Optional: automatically start rendering (default: false)
  log: true                                         // Optional: enable logging (default: true)
});

engine.start();
```

## Public API

### `initMAGE(options?)`

Initializes and returns a MAGE engine instance with the specified configuration.

**Options:**
- `canvas?: HTMLCanvasElement` - Target canvas element for rendering (optional)
- `withControls?: { active: boolean; integrated: boolean }` - Enable controls and choose integrated or detached layout
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

- **`loadPreset(preset: MAGEPreset)`** - Load a preset object
- **`toPreset()`** - Export the current state as a MAGEPreset JSON object

#### Display

- **`swapCanvas(canvas: HTMLCanvasElement)`** - Switch to a different canvas element
- **`toggleFullscreen()`** - Toggle fullscreen mode
- **`getEngineTime(): number`** - Get the current engine/visualization time

#### Capture & Preview

- **`captureFramePreview(options?: CaptureFramePreviewOptions)`** - Capture the current frame as a preview image
- **`captureThumbnail(preset: MAGEPreset, options?: CaptureThumbnailOptions)`** - Capture a thumbnail for a preset

#### Controls

- **`initControls()`** - Initialize interactive UI controls
- **`showViewportMessage(message: string, duration?: number)`** - Display a temporary message in the viewport

## Example Usage

```javascript
import { initMAGE } from '@notrac/mage';

// Initialize engine
const engine = initMAGE({
  canvas: document.getElementById('visualizer'),
  withControls: { active: true, integrated: false },
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
engine.scrubAudio(5); // Move playback forward by 5 seconds
console.log(engine.getAudioTime()); // Current time
console.log(engine.getAudioDuration()); // Total duration

// Capture visualization
const preset = engine.toPreset();
const thumbnail = await engine.captureThumbnail(preset, {
  width: 224,
  height: 224,
  type: 'image/png',
  quality: 0.84,
  settleFrames: 2,
});

// Export current state
const currentPreset = engine.toPreset();
```
