import { initMAGE } from '@notrac/mage';

let engine;

window.addEventListener('load', () => {
  engine = initMAGE();
  engine.start();

  // Public embed API: host pages can fetch presets from any source
  // (DB, API, CMS) and apply them directly through the engine.
  window.mageEngine = engine;
});
