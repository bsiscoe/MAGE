import { NoToneMapping, LinearToneMapping, ReinhardToneMapping, CineonToneMapping, ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping } from 'three';
import { Pane } from 'tweakpane';
import effects from './effects.js';
import { getEmbeddedPresetById, getEmbeddedPresetIds } from './presets.js';
import { EMBEDDED_SKYBOXES } from './skyboxes.js';
const controlTipsImageDataUrl = new URL('../resources/controltips.png', import.meta.url).href;
import { MAGEEngine } from './MAGEEngine.js';

type EngineWithRequiredRefs = MAGEEngine & {
  scene: any;
  renderer: any;
  camera: any;
  controls: any;
  state: any;
  visualizer: any;
  inputs: any;
  composer: any;
};

function requireEngineRefs(engine: MAGEEngine): EngineWithRequiredRefs {
  if (
    !engine.scene
    || !engine.renderer
    || !engine.camera
    || !engine.controls
    || !engine.state
    || !engine.visualizer
    || !engine.inputs
    || !engine.composer
  ) {
    throw new Error('MAGEControls requires initialized engine refs (scene/renderer/camera/controls/state/visualizer/inputs/composer).');
  }

  return engine as EngineWithRequiredRefs;
}

class MAGEControls {
  engine: EngineWithRequiredRefs;
  scene: any;
  camera: any;
  controls: any;
  state: any;
  host: any;
  visualizer: any;
  inputs: any;
  embeddedPresetIds: any;
  composer: any;
  pane: any;
  fxStudioOverlay: any;
  sceneCameraDock: any;
  renderer: any;
  hostInlineLayout: any;
  tooltipUI: {
    visible: boolean;
    x: number;
    y: number;
    element: HTMLDivElement;
  };

  constructor(engineInstance: MAGEEngine) {
    this.engine = requireEngineRefs(engineInstance);
    this.scene = this.engine.scene;
    this.renderer = this.engine.renderer;
    this.camera = this.engine.camera;
    this.controls = this.engine.controls;

    this.host = this.engine.canvas?.parentElement || this.engine.renderer.domElement.parentElement || document.body;

    // Ensure host can anchor absolutely-positioned children
    if (getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }

    this.state = this.engine.state;
    this.visualizer = this.engine.visualizer;
    this.inputs = this.engine.inputs;

    this.embeddedPresetIds = getEmbeddedPresetIds();

    this.composer = this.engine.composer;
    this.pane = null;
    this.fxStudioOverlay = null;
    this.sceneCameraDock = null;

    this.hostInlineLayout = {
      width: this.host.style.width,
      height: this.host.style.height,
      maxWidth: this.host.style.maxWidth,
      maxHeight: this.host.style.maxHeight,
      aspectRatio: this.host.style.aspectRatio,
      margin: this.host.style.margin,
    }

    this.tooltipUI = {
      visible: false,
      x: 0,
      y: 0,
      element: document.createElement('div'),
    };

    // Expose relevant engine properties for easier access within controls methods without needing to reference 'this.engine' repeatedly.
    const tooltipUI = this.tooltipUI;
    tooltipUI.element.style.position = 'fixed';
    tooltipUI.element.style.transform = 'translate(-50%, -50%)';
    tooltipUI.element.style.zIndex = '5';
    tooltipUI.element.style.pointerEvents = 'none';
    tooltipUI.element.style.display = 'none';
    tooltipUI.element.innerHTML = `<img src="${controlTipsImageDataUrl}" alt="controls" />`;
    this.host.appendChild(tooltipUI.element);

    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
    
    const previousAfterFrame = this.engine.onAfterFrame;
    this.engine.cameraUpdateHook = (engine: EngineWithRequiredRefs) => {};
    this.engine.onAfterFrame = (engine: EngineWithRequiredRefs) => {
        if (typeof previousAfterFrame === 'function') {
          previousAfterFrame(engine);
        }

        if (tooltipUI.visible) {
          // hide regular mouse pointer
          engine.renderer.domElement.style.cursor = 'none';
          tooltipUI.element.style.display = 'block';
          tooltipUI.element.style.left = `${tooltipUI.x}px`;
          tooltipUI.element.style.top = `${tooltipUI.y}px`;
        } else {
          tooltipUI.element.style.display = 'none';
          engine.renderer.domElement.style.cursor = '';
        }
    };
  }

  private isHostFullscreen() {
      // Support both standard and prefixed fullscreenElement for compatibility
      const fullscreenElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      return fullscreenElement === this.host;
  }

  private applyFullscreenHostLayout(active: boolean) {
    const { host, hostInlineLayout } = this;

    if (active) {
        host.style.width = '100vw';
        host.style.height = '100vh';
        host.style.maxWidth = '100vw';
        host.style.maxHeight = '100vh';
        host.style.aspectRatio = 'auto';
        host.style.margin = '0';
        return;
      }

      host.style.width = hostInlineLayout.width;
      host.style.height = hostInlineLayout.height;
      host.style.maxWidth = hostInlineLayout.maxWidth;
      host.style.maxHeight = hostInlineLayout.maxHeight;
      host.style.aspectRatio = hostInlineLayout.aspectRatio;
      host.style.margin = hostInlineLayout.margin;
  }

  private requestHostFullscreen = async() => {
      if (typeof this.host.requestFullscreen === 'function') {
        await this.host.requestFullscreen();
        return;
      }
      if (typeof this.host.webkitRequestFullscreen === 'function') {
        this.host.webkitRequestFullscreen();
      }
  }

  private exitHostFullscreen = async() => {
      if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
        return;
      }
      if (typeof (document as any).webkitExitFullscreen === 'function') {
        (document as any).webkitExitFullscreen();
      }
  }

  private handleFullscreenChange() {
      this.applyFullscreenHostLayout(this.isHostFullscreen());
      this.syncViewportAndPostFx();
  }

  private syncViewportAndPostFx() {
    const engine = this.engine;
        if (typeof engine._syncViewport === 'function') {
          engine._syncViewport(true);
        }
        if (typeof engine._syncSobelResolution === 'function') {
          engine._syncSobelResolution();
        }
        this.rebuildComposer();
        this.fxStudioOverlay?.refresh();
        this.sceneCameraDock?.refresh();
  }

  private rebuildComposer = () => {
    const { scene, renderer, camera, composer } = this;
    const newComposer = effects.applyPostProcessing(scene, renderer, camera, composer);
    this.engine.composer = newComposer;
    this.composer = newComposer;
  }

  private loadPresetById = async (presetId: number) => {
    const embeddedPreset = getEmbeddedPresetById(presetId);
    if (embeddedPreset) {
      const appliedEmbedded = this.engine.loadPreset(embeddedPreset);
      return Boolean(appliedEmbedded);
    }

    return false;
  }

  private getOS() {
    const userAgent = window.navigator.userAgent;
    const platform =
      (window.navigator as any)?.userAgentData?.platform || window.navigator.platform;
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

  private switchControls() {
    this.engine.visualizer.render_tooltips = false;
    if (this.pane) {
      this.pane.hidden = true;
    }
    this.toggleUI();
    const hideUIbutton = document.getElementById('ui_hide');
    hideUIbutton && (hideUIbutton.style.display = 'none');
  }

  public applyLegacyPlatformControlsBehavior() {
    // controls_old.js effectively checked only against 'Windows' due JS || semantics.
    if (this.getOS() !== 'Windows') {
      this.switchControls();
    }
  }

  public toggleFullscreen = async() => {
          try {
            if (this.isHostFullscreen()) {
              await this.exitHostFullscreen();
            } else {
              await this.requestHostFullscreen();
            }
          } catch {
            // Ignore unsupported API or gesture-gated failures.
          }
  }

  private createViewportInteractionHelpers() {
    const { renderer, visualizer, tooltipUI } = this;

    const isPointerInViewport = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return (
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom
      );
    };

    const clearViewportInteractionState = () => {
      visualizer.intersected = false;
      visualizer.clickable = false;
      visualizer.controllingAudio = false;
      tooltipUI.visible = false;
    };

    const isPointerOverUi = (event: MouseEvent) => {
      const target = event?.target;
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

    const shouldBlockViewportInput = (event: MouseEvent) => isPointerOverUi(event);

    return {
      isPointerInViewport,
      clearViewportInteractionState,
      isPointerOverUi,
      shouldBlockViewportInput,
    };
  }

  private bindViewportPointerAndWheelHandlers(
    setQuickPresetsVisible: (visible: boolean) => void,
    helpers: {
      isPointerInViewport: (event: MouseEvent) => boolean;
      clearViewportInteractionState: () => void;
      isPointerOverUi: (event: MouseEvent) => boolean;
      shouldBlockViewportInput: (event: MouseEvent) => boolean;
    },
  ) {
    const {
      renderer,
      controls,
      state,
      visualizer,
      inputs,
      tooltipUI,
    } = this;

    window.addEventListener('wheel', (event: any) => {
      if (helpers.shouldBlockViewportInput(event)) {
        helpers.clearViewportInteractionState();
        return;
      }

      if (!helpers.isPointerInViewport(event)) {
        helpers.clearViewportInteractionState();
        return;
      }

      if (event.deltaY < 0) {
        if (visualizer.clickable && visualizer.intersected) {
          visualizer.nextShader();
        }
      } else if (event.deltaY > 0) {
        if (visualizer.clickable && visualizer.intersected) {
          visualizer.previousShader();
        }
      }
    }, { passive: false });

    window.addEventListener('resize', () => {
      this.syncViewportAndPostFx();
    });

    window.addEventListener('pointermove', event => {
      if (helpers.shouldBlockViewportInput(event)) {
        helpers.clearViewportInteractionState();
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;

      const inside = relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1;

      if (!inside) {
        helpers.clearViewportInteractionState();
        return;
      }

      inputs.currMouse.x = relX * 2 - 1;
      inputs.currMouse.y = -relY * 2 + 1;

      if (visualizer.controllingAudio) {
        state.currMouse.x = relX * 2 - 1;
        state.currMouse.y = -relY * 2 + 1;
      } else {
        state.currMouse.x = relX / 4 - 1;
        state.currMouse.y = -relY / 4 + 1;
      }

      tooltipUI.x = event.clientX;
      tooltipUI.y = event.clientY;
      tooltipUI.visible = visualizer.clickable && visualizer.render_tooltips;
    });

    window.addEventListener('pointerdown', event => {
      if (helpers.shouldBlockViewportInput(event)) {
        helpers.clearViewportInteractionState();
        state.currPointerDown = 0.0;
        return;
      }

      if (!helpers.isPointerInViewport(event)) {
        helpers.clearViewportInteractionState();
        return;
      }
      if (!visualizer.clickable || !visualizer.intersected) {
        return;
      }
      state.currPointerDown = 1.0;
    });

    window.addEventListener('pointerup', event => {
      if (event.button === 2) {
        if (helpers.isPointerInViewport(event) && !helpers.isPointerOverUi(event)) {
          setQuickPresetsVisible?.(false);
          this.toggleUI();
        }
        helpers.clearViewportInteractionState();
        state.currPointerDown = 0.0;
        return;
      }

      if (helpers.shouldBlockViewportInput(event)) {
        helpers.clearViewportInteractionState();
        state.currPointerDown = 0.0;
        return;
      }

      if (!helpers.isPointerInViewport(event)) {
        helpers.clearViewportInteractionState();
        return;
      }

      visualizer.controllingAudio = false;
      controls.enabled = true;

      state.currPointerDown = 0.0 + 1 * state.pointerDownMultiplier;

      if (!visualizer.intersected || !visualizer.clickable) {
        return;
      }

      if (event.button === 0) {
        this.engine.visualizer.load({ shader: null, addToHistory: true, clearHistory: false });
        setQuickPresetsVisible?.(false);
      }
    });

    renderer.domElement.addEventListener('pointerleave', () => {
      helpers.clearViewportInteractionState();
    });
  }

  public eventSetup() {
    const { setQuickPresetsVisible } = this.setupQuickPresetDock();
    const helpers = this.createViewportInteractionHelpers();
    this.bindViewportPointerAndWheelHandlers(setQuickPresetsVisible, helpers);
  }

  public toggleUI() {
    const { 
          pane,
          fxStudioOverlay,
          sceneCameraDock } = this;

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
  }

  public setupQuickPresetDock() {
    const { renderer, host } = this;

    const quickPresetHost = document.createElement('div');
    const visiblePresetIds = getEmbeddedPresetIds().filter((presetId: number) => presetId !== 0);
    let quickPresetButtons: HTMLButtonElement[] = [];
    const quickPresetPreviewImages = new Map<number, HTMLImageElement>();
    let selectedPresetId: number | null = null;
    const engineLoadingMask = document.createElement('div');
    const engineLoadingLabel = document.createElement('div');

    const setQuickPresetsVisible = (visible: boolean) => {
      quickPresetHost.style.display = visible ? 'flex' : 'none';
      if (visible) {
        positionPresetDock();
      }
    };

    quickPresetHost.className = 'mage-embedded-presets';
    Object.assign(quickPresetHost.style, {
      position: 'fixed',
      zIndex: '41',
      display: 'none',
      flexDirection: 'column',
      gap: '10px',
      padding: '10px',
      maxHeight: '72vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'linear-gradient(150deg, rgba(18,26,38,0.78), rgba(11,16,25,0.82))',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      alignItems: 'flex-start',
    });
    host.appendChild(quickPresetHost);

    const positionPresetDock = () => {
      const rect = renderer.domElement.getBoundingClientRect();
      const gutter = 12;
      const viewportMargin = 8;
      const panelWidth = 214;
      const leftSpace = rect.left - gutter;
      const rightSpace = window.innerWidth - rect.right - gutter;
      const leftNudge = 30;

      let left = rect.left - panelWidth - gutter - leftNudge;
      if (leftSpace < panelWidth && rightSpace >= panelWidth) {
        left = rect.right + gutter;
      } else if (leftSpace < panelWidth && rightSpace < panelWidth) {
        left = viewportMargin;
      }

      const top = Math.max(viewportMargin, Math.min(rect.top, window.innerHeight - 120));
      const maxHeight = Math.max(220, Math.min(rect.height, window.innerHeight - top - viewportMargin));

      quickPresetHost.style.left = `${Math.round(left)}px`;
      quickPresetHost.style.top = `${Math.round(top)}px`;
      quickPresetHost.style.maxHeight = `${Math.floor(maxHeight)}px`;
    };

    const handlePresetDockLayoutChange = () => {
      if (quickPresetHost.style.display !== 'none') {
        positionPresetDock();
      }
    };
    window.addEventListener('resize', handlePresetDockLayoutChange);
    window.addEventListener('scroll', handlePresetDockLayoutChange, true);

    engineLoadingMask.className = 'mage-engine-loading-mask';
    Object.assign(engineLoadingMask.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '35',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(6,10,16,0.9)',
      pointerEvents: 'auto',
      backdropFilter: 'blur(3px)',
    });

    engineLoadingLabel.textContent = 'Loading engine...';
    Object.assign(engineLoadingLabel.style, {
      color: '#fff',
      fontSize: '14px',
      fontWeight: '700',
      letterSpacing: '0.02em',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.22)',
      background: 'rgba(14,22,34,0.86)',
      padding: '10px 14px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
    });
    engineLoadingMask.appendChild(engineLoadingLabel);
    host.appendChild(engineLoadingMask);

    const setEngineLoadingMaskActive = (active: boolean, message = 'Loading engine...') => {
      const engine = this.engine;
      const visible = Boolean(active);
      engineLoadingMask.style.display = visible ? 'flex' : 'none';
      engineLoadingLabel.textContent = message;
      renderer.domElement.style.visibility = visible ? 'hidden' : 'visible';
      if (visible && typeof engine._showViewportMessage === 'function') {
        engine._showViewportMessage(message, 60_000);
      } else if (!visible && typeof engine._hideViewportMessage === 'function') {
        engine._hideViewportMessage();
      }
    };

    const setQuickPresetButtonsDisabled = (disabled: boolean) => {
      for (const button of quickPresetButtons) {
        button.disabled = disabled;
        button.style.opacity = disabled ? '0.6' : '1';
        button.style.cursor = disabled ? 'progress' : 'pointer';
      }
    };

    quickPresetButtons = visiblePresetIds.map((presetId: number) => {
      const button = document.createElement('button');
      button.type = 'button';
      Object.assign(button.style, {
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '10px',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
        color: '#fff',
        fontSize: '11px',
        fontWeight: '600',
        letterSpacing: '0.02em',
        lineHeight: '1',
        padding: '6px',
        cursor: 'pointer',
        display: 'grid',
        gap: '6px',
        width: '194px',
        textAlign: 'left',
        boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
        transition: 'transform 120ms ease, filter 120ms ease, opacity 120ms ease',
      });

      const preview = document.createElement('img');
      preview.alt = `Preset ${presetId} preview`;
      preview.width = 184;
      preview.height = 184;
      preview.loading = 'lazy';
      Object.assign(preview.style, {
        width: '100%',
        height: '184px',
        objectFit: 'contain',
        aspectRatio: '1 / 1',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)',
        background:
          'radial-gradient(circle at 20% 20%, rgba(66,191,255,0.35), rgba(49,129,255,0.2) 35%, rgba(15,20,30,0.9) 70%)',
        opacity: '0.92',
      });

      const caption = document.createElement('div');
      caption.textContent = `Preset ${presetId}`;
      Object.assign(caption.style, {
        fontSize: '11px',
        fontWeight: '700',
        padding: '0 2px 2px',
      });

      button.appendChild(preview);
      button.appendChild(caption);
      quickPresetPreviewImages.set(presetId, preview);

      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-1px)';
        button.style.filter = 'brightness(1.06)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.filter = 'brightness(1)';
      });

      button.addEventListener('click', async () => {
        setQuickPresetButtonsDisabled(true);
        const ok = await this.loadPresetById(presetId);
        setQuickPresetButtonsDisabled(false);
        if (ok) {
          selectedPresetId = presetId;
          setQuickPresetsVisible(false);
        }
      });

      quickPresetHost.appendChild(button);

      return button;
    });

    // Controls own quick-preset visibility state instead of reading engine.currentPreset.
    setQuickPresetsVisible(!selectedPresetId);

    const replaceWithRuntimePresetPreviews = async () => {
      const engine = this.engine;
      if (typeof engine.captureThumbnail !== 'function') {
        return;
      }

      setEngineLoadingMaskActive(true, 'Loading engine...');
      setQuickPresetButtonsDisabled(true);

      try {
        const total = visiblePresetIds.length;
        for (let index = 0; index < total; index += 1) {
          const presetId = visiblePresetIds[index];
          const preset = getEmbeddedPresetById(presetId);
          const imageEl = quickPresetPreviewImages.get(presetId);
          if (!preset || !imageEl) {
            continue;
          }

          setEngineLoadingMaskActive(true, `Loading engine... (${index + 1}/${total})`);
          const settleFrames = index < 3 ? 4 : 2;
          const dataUrl = await engine.captureThumbnail(preset, {
            settleFrames,
            width: 184,
            height: 184,
          });

          if (dataUrl) {
            imageEl.src = dataUrl;
          }
        }
      } finally {
        setEngineLoadingMaskActive(false);
        setQuickPresetButtonsDisabled(false);
      }
    };

    setTimeout(() => {
      replaceWithRuntimePresetPreviews().catch(() => {
        setEngineLoadingMaskActive(false);
        setQuickPresetButtonsDisabled(false);
      });
    }, 120);

    return {
      setQuickPresetsVisible,
    };
  }

  public createAudioTestDock() {
        const { host } = this;

    const engine = this.engine;
    const panel = document.createElement('div');
    panel.className = 'mage-audio-test-dock';
    Object.assign(panel.style, {
      position: 'absolute',
      left: '8px',
      bottom: '8px',
      zIndex: '21',
      width: '320px',
      maxWidth: 'calc(100% - 16px)',
      padding: '10px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.2)',
      background: 'rgba(11,16,25,0.92)',
      color: '#fff',
      display: 'grid',
      gap: '8px',
      fontSize: '12px',
      pointerEvents: 'auto',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    });

    const title = document.createElement('div');
    title.textContent = 'Audio Test';
    Object.assign(title.style, {
      fontWeight: '700',
      fontSize: '13px',
    });

    const timelineRow = document.createElement('div');
    timelineRow.style.display = 'grid';
    timelineRow.style.gap = '6px';

    const timeLabel = document.createElement('div');
    timeLabel.textContent = '0.00 / 0.00';
    Object.assign(timeLabel.style, {
      textAlign: 'right',
      opacity: '0.9',
      fontVariantNumeric: 'tabular-nums',
    });

    const scrubber = document.createElement('input');
    scrubber.type = 'range';
    scrubber.min = '0';
    scrubber.max = '0';
    scrubber.step = '0.01';
    scrubber.value = '0';
    scrubber.disabled = true;
    scrubber.style.width = '100%';

    const makeRateRow = (labelText: string, defaultValue: number) => {
      const row = document.createElement('label');
      Object.assign(row.style, {
        display: 'grid',
        gridTemplateColumns: '90px 1fr 64px',
        gap: '8px',
        alignItems: 'center',
      });

      const label = document.createElement('span');
      label.textContent = labelText;

      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0.25';
      range.max = '4';
      range.step = '0.05';
      range.value = `${defaultValue}`;

      const number = document.createElement('input');
      number.type = 'number';
      number.min = '0.25';
      number.max = '4';
      number.step = '0.05';
      number.value = `${defaultValue}`;
      Object.assign(number.style, {
        width: '64px',
        textAlign: 'right',
        background: 'rgba(0,0,0,0.5)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '4px',
        padding: '2px 4px',
      });

      const sync = (value: number) => {
        const clamped = Math.max(0.25, Math.min(4, value));
        range.value = `${clamped}`;
        number.value = clamped.toFixed(2);
        return clamped;
      };

      const getValue = () => {
        const parsed = Number.parseFloat(number.value);
        if (!Number.isFinite(parsed)) {
          return Number.parseFloat(range.value);
        }
        return Math.max(0.25, Math.min(4, parsed));
      };

      range.addEventListener('input', () => {
        sync(Number.parseFloat(range.value));
        applyRates();
      });

      number.addEventListener('change', () => {
        sync(getValue());
        applyRates();
      });

      row.appendChild(label);
      row.appendChild(range);
      row.appendChild(number);

      return {
        row,
        getValue,
        sync,
      };
    };

    const controlsRow = document.createElement('div');
    Object.assign(controlsRow.style, {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      justifyContent: 'space-between',
    });

    const reverseLabel = document.createElement('label');
    reverseLabel.style.display = 'flex';
    reverseLabel.style.alignItems = 'center';
    reverseLabel.style.gap = '6px';
    const reverseToggle = document.createElement('input');
    reverseToggle.type = 'checkbox';
    const reverseText = document.createElement('span');
    reverseText.textContent = 'Reverse';
    reverseLabel.appendChild(reverseToggle);
    reverseLabel.appendChild(reverseText);

    const buttonWrap = document.createElement('div');
    buttonWrap.style.display = 'flex';
    buttonWrap.style.gap = '6px';

    const makeButton = (text: string) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      Object.assign(button.style, {
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        padding: '4px 8px',
        cursor: 'pointer',
      });
      return button;
    };

    const playButton = makeButton('Play');
    const pauseButton = makeButton('Pause');
    buttonWrap.appendChild(playButton);
    buttonWrap.appendChild(pauseButton);

    controlsRow.appendChild(reverseLabel);
    controlsRow.appendChild(buttonWrap);

    const forwardRate = makeRateRow('Forward Rate', 1.0);
    const reverseRate = makeRateRow('Reverse Rate', 1.0);

    const getDuration = () => {
      const duration = Number(engine.audio?.buffer?.duration ?? engine.reversedAudio?.buffer?.duration ?? 0);
      return Number.isFinite(duration) ? duration : 0;
    };

    const getTrackProgress = (track: any) => {
      if (!track) {
        return 0;
      }
      const base = Number(track._progress) || 0;
      const live = track.isPlaying
        ? Math.max(track.context.currentTime - track._startedAt, 0) * (Number(track.playbackRate) || 1)
        : 0;
      return base + live;
    };

    const setSeekPosition = (forwardTime: number) => {
      const duration = getDuration();
      if (duration <= 0 || !engine.audio?.buffer) {
        return null;
      }

      const clamped = Math.max(0, Math.min(duration, forwardTime));
      const reverseStart = Math.max(0, Math.min(duration, duration - clamped));

      // Reset progress then seek by offset; Three.js Audio.play() arg is delay, not seek time.
      if (engine.audio) {
        engine.audio.stop();
        engine.audio.offset = clamped;
      }
      if (engine.reversedAudio?.buffer) {
        engine.reversedAudio.stop();
        engine.reversedAudio.offset = reverseStart;
      }

      engine.playbackTime = clamped;
      return clamped;
    };

    const getCurrentForwardTime = () => {
      const duration = getDuration();
      if (duration <= 0) {
        return 0;
      }

      if (engine.audio?.isPlaying && typeof engine.getAudioTime === 'function') {
        return Math.max(0, Math.min(duration, engine.getAudioTime()));
      }

      if (engine.reversedAudio?.isPlaying) {
        const reverseHead = (Number(engine.reversedAudio.offset) || 0) + getTrackProgress(engine.reversedAudio);
        return Math.max(0, Math.min(duration, duration - reverseHead));
      }

      if (Number.isFinite(Number(engine.playbackTime))) {
        return Math.max(0, Math.min(duration, Number(engine.playbackTime)));
      }

      const forwardHead = (Number(engine.audio?.offset) || 0) + getTrackProgress(engine.audio);
      return Math.max(0, Math.min(duration, forwardHead));
    };

    const applyRates = () => {
      const forward = forwardRate.getValue();
      const reverse = reverseRate.getValue();
      if (engine.audio?.setPlaybackRate) {
        engine.audio.setPlaybackRate(forward);
      }
      if (engine.reversedAudio?.setPlaybackRate) {
        engine.reversedAudio.setPlaybackRate(reverse);
      }
    };

    const playFromTime = (forwardTime: number) => {
      const clamped = setSeekPosition(forwardTime);
      if (!Number.isFinite(clamped)) {
        return;
      }

      const playReverse = reverseToggle.checked;

      if (playReverse && engine.reversedAudio?.buffer) {
        engine.reversedAudio.play();
        engine.isReversed = true;
      } else {
        engine.audio?.play();
        engine.isReversed = false;
      }

      applyRates();
    };

    const pausePlayback = () => {
      const current = getCurrentForwardTime();
      if (engine.audio?.isPlaying) {
        engine.audio.pause();
      }
      if (engine.reversedAudio?.isPlaying) {
        engine.reversedAudio.pause();
      }
      setSeekPosition(current);
    };

    scrubber.addEventListener('input', () => {
      const targetTime = Number.parseFloat(scrubber.value);
      if (!Number.isFinite(targetTime)) {
        return;
      }

      const forwardPlaying = Boolean(engine.audio?.isPlaying);
      const reversePlaying = Boolean(engine.reversedAudio?.isPlaying);
      const isPlaying = forwardPlaying || reversePlaying;

      if (isPlaying && typeof engine.scrubAudio === 'function') {
        const reverseSelected = reverseToggle.checked;
        if ((reverseSelected && !reversePlaying) || (!reverseSelected && !forwardPlaying)) {
          playFromTime(targetTime);
        } else {
          engine.scrubAudio(targetTime);
        }
      } else {
        setSeekPosition(targetTime);
      }
    });

    reverseToggle.addEventListener('change', () => {
      engine.isReversed = reverseToggle.checked;
      const current = getCurrentForwardTime();
      if (engine.audio?.isPlaying || engine.reversedAudio?.isPlaying) {
        playFromTime(current);
      } else {
        setSeekPosition(current);
      }
    });

    playButton.addEventListener('click', () => {
      playFromTime(getCurrentForwardTime());
    });

    pauseButton.addEventListener('click', () => {
      pausePlayback();
    });

    const refresh = () => {
      const duration = getDuration();
      const current = getCurrentForwardTime();
      scrubber.max = `${duration}`;
      if (document.activeElement !== scrubber) {
        scrubber.value = `${Math.max(0, Math.min(duration, current))}`;
      }
      scrubber.disabled = duration <= 0;
      reverseToggle.checked = Boolean(engine.isReversed);
      timeLabel.textContent = `${current.toFixed(2)} / ${duration.toFixed(2)}`;
      applyRates();
    };

    timelineRow.appendChild(scrubber);
    timelineRow.appendChild(timeLabel);

    panel.appendChild(title);
    panel.appendChild(timelineRow);
    panel.appendChild(forwardRate.row);
    panel.appendChild(reverseRate.row);
    panel.appendChild(controlsRow);
    host.appendChild(panel);

    return {
      element: panel,
      refresh,
    };
  }

  public createFxStudioOverlay() {

    const { engine, host, renderer } = this;
    const rebuildComposer = this.rebuildComposer;

    const toneMappingOptions = [
      { label: 'Linear', value: LinearToneMapping },
      { label: 'Cineon', value: CineonToneMapping },
      { label: 'Filmic', value: ACESFilmicToneMapping },
      { label: 'NoTone', value: NoToneMapping },
      { label: 'Reinhard', value: ReinhardToneMapping },
      { label: 'AGX', value: AgXToneMapping },
      { label: 'Neutral', value: NeutralToneMapping },
    ];

    const layerLabels: Record<string, string> = {
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
      const uniforms = effects.sobelShader?.shader?.uniforms as any;
      if (!uniforms?.resolution?.value) {
        return;
      }
      const bufferWidth = renderer.domElement.width || window.innerWidth * window.devicePixelRatio;
      const bufferHeight = renderer.domElement.height || window.innerHeight * window.devicePixelRatio;
      uniforms.resolution.value.x = bufferWidth;
      uniforms.resolution.value.y = bufferHeight;
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

    let draggedLayerId: any = null;

    const clearDropIndicators = () => {
      stackList
        .querySelectorAll<HTMLElement>('[data-layer-id]')
        .forEach(rowEl => {
          rowEl.style.outline = 'none';
          rowEl.style.background = 'rgba(255,255,255,0.03)';
        });
    };

    const addRangeControl = (parent: HTMLElement, { label, min, max, step = 0.001, getValue, setValue }: { label: string; min: number; max: number; step?: number; getValue: () => number; setValue: (value: number) => void }) => {
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
      const formatValue = (value: number) => {
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

      const clamp = (value: number) => Math.max(min, Math.min(max, value));

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
        this.rebuildComposer();
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
        this.rebuildComposer();
      });

      sync();
      wrap.appendChild(input);
      wrap.appendChild(valueEl);
      row.appendChild(labelEl);
      row.appendChild(wrap);
      parent.appendChild(row);
    };

    const addColorControl = (parent: HTMLElement, { label, getValue, setValue }: { label: string; getValue: () => string; setValue: (value: string) => void }) => {
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
        this.rebuildComposer();
      });

      row.appendChild(labelEl);
      row.appendChild(input);
      parent.appendChild(row);
    };

    const addToneMappingControl = (parent: HTMLElement) => {
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

      select.value = `${effects.toneMapping.method}`;
      select.addEventListener('change', () => {
        effects.toneMapping.method = Number.parseFloat(select.value);
        renderer.toneMapping = effects.toneMapping.method;
        this.rebuildComposer();
      });

      row.appendChild(labelEl);
      row.appendChild(select);
      parent.appendChild(row);
    };

    const addSettingsForPass = (passId: string, parent: HTMLElement) => {
      if (passId === 'bloom') {
        addRangeControl(parent, {
          label: 'Strength', min: 0, max: 10, step: 0.001,
          getValue: () => effects.bloom.settings.strength,
          setValue: value => { effects.bloom.settings.strength = value; },
        });
        addRangeControl(parent, {
          label: 'Radius', min: -10, max: 10, step: 0.001,
          getValue: () => effects.bloom.settings.radius,
          setValue: value => { effects.bloom.settings.radius = value; },
        });
        addRangeControl(parent, {
          label: 'Threshold', min: 0, max: 10, step: 0.001,
          getValue: () => effects.bloom.settings.threshold,
          setValue: value => { effects.bloom.settings.threshold = value; },
        });
      }

      if (passId === 'RGBShift') {
        const rgbShiftUniforms = effects.RGBShift?.shader?.uniforms as any;
        addRangeControl(parent, {
          label: 'Amount', min: 0, max: 0.1, step: 0.0001,
          getValue: () => Number(rgbShiftUniforms?.amount?.value ?? 0),
          setValue: value => {
            if (rgbShiftUniforms?.amount) {
              rgbShiftUniforms.amount.value = value;
            }
          },
        });
        addRangeControl(parent, {
          label: 'Angle', min: 0, max: Math.PI * 2, step: 0.001,
          getValue: () => Number(rgbShiftUniforms?.angle?.value ?? 0),
          setValue: value => {
            if (rgbShiftUniforms?.angle) {
              rgbShiftUniforms.angle.value = value;
            }
          },
        });
      }

      if (passId === 'afterImagePass') {
        const afterImageUniforms = effects.afterImagePass?.shader?.uniforms as any;
        addRangeControl(parent, {
          label: 'Damp', min: 0, max: 1, step: 0.001,
          getValue: () => Number(afterImageUniforms?.damp?.value ?? 0),
          setValue: value => {
            if (afterImageUniforms?.damp) {
              afterImageUniforms.damp.value = value;
            }
          },
        });
      }

      if (passId === 'colorifyShader') {
        addColorControl(parent, {
          label: 'Hue',
          getValue: () => `#${effects.colorifyShader.color.getHexString()}`,
          setValue: value => { effects.colorifyShader.color.set(value); },
        });
      }

      if (passId === 'kaleidoShader') {
        const kaleidoUniforms = effects.kaleidoShader?.shader?.uniforms as any;
        addRangeControl(parent, {
          label: 'Sides', min: 1, max: 24, step: 1,
          getValue: () => Number(kaleidoUniforms?.sides?.value ?? 1),
          setValue: value => {
            if (kaleidoUniforms?.sides) {
              kaleidoUniforms.sides.value = Math.max(1, Math.round(value));
            }
          },
        });
        addRangeControl(parent, {
          label: 'Angle', min: 0, max: Math.PI * 2, step: 0.001,
          getValue: () => Number(kaleidoUniforms?.angle?.value ?? 0),
          setValue: value => {
            if (kaleidoUniforms?.angle) {
              kaleidoUniforms.angle.value = value;
            }
          },
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
      const orderedLayers: string[] = effects.getPassOrder();
      const effectPassMap = effects as Record<string, { enabled?: boolean } | undefined>;

      orderedLayers.forEach((passId: string, index: number) => {
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
        toggle.checked = Boolean(effectPassMap[passId]?.enabled);
        toggle.addEventListener('change', () => {
          const pass = effectPassMap[passId];
          if (!pass) {
            return;
          }
          pass.enabled = toggle.checked;
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

          row.addEventListener('dragstart', (event: DragEvent) => {
            if (event.target !== dragHandle) {
              event.preventDefault();
              row.draggable = false;
              return;
            }
            draggedLayerId = passId;
            row.style.opacity = '0.55';
            clearDropIndicators();
            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) {
              return;
            }
            dataTransfer.effectAllowed = 'move';
            dataTransfer.setData('text/plain', passId);
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

        row.addEventListener('dragleave', (event: DragEvent) => {
          const currentTarget = event.currentTarget as HTMLElement | null;
          if (!currentTarget?.contains(event.relatedTarget as Node | null)) {
            row.style.outline = 'none';
            row.style.background = 'rgba(255,255,255,0.03)';
          }
        });

        row.addEventListener('dragover', (event: DragEvent) => {
          if (!draggedLayerId) {
            return;
          }
          event.preventDefault();
          const dataTransfer = event.dataTransfer;
          if (dataTransfer) {
            dataTransfer.dropEffect = 'move';
          }
        });

        row.addEventListener('drop', (event: DragEvent) => {
          if (!draggedLayerId) {
            return;
          }
          event.preventDefault();

          const currentOrder: string[] = effects.getPassOrder();
          const movable = currentOrder.filter((id: string) => id !== 'outputPass');
          const from = movable.indexOf(draggedLayerId);
          if (from < 0) {
            return;
          }

          const targetLayerId = row.dataset.layerId ?? '';
          let to = movable.indexOf(targetLayerId);
          if (targetLayerId === 'outputPass') {
            to = movable.length - 1;
          }
          if (to < 0) {
            return;
          }

          const [moved] = movable.splice(from, 1);
          movable.splice(to, 0, moved);
          effects.setPassOrder([...movable, 'outputPass']);
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
    host.appendChild(overlay);

    return {
      element: overlay,
      open,
      close,
      refresh,
    };
  }

  public createSceneCameraDock() {
    const engine = this.engine;
    const renderer = engine.renderer;
    const camera = engine.camera;
    const controls = engine.controls;
    const state = engine.state;
    const visualizer = engine.visualizer;
    const host = this.host;
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

    const makeSection = (label: string): { section: HTMLDivElement; content: HTMLDivElement } => {
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

    const makeRow = (parent: HTMLElement, labelText: string): HTMLLabelElement => {
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
    const syncers: Array<() => void> = [];

    type RangeControlConfig = {
      label: string;
      min: number;
      max: number;
      step?: number;
      getValue: () => number;
      setValue: (value: number) => void;
      onCommit?: () => void;
    };

    type CheckboxControlConfig = {
      label: string;
      getValue: () => boolean;
      setValue: (value: boolean) => void;
      onCommit?: () => void;
    };

    type SelectOption = {
      label: string;
      value: number;
    };

    type SelectControlConfig = {
      label: string;
      options: SelectOption[];
      getValue: () => number;
      setValue: (value: number) => void;
      onCommit?: () => void;
    };

    const addRangeControl = (parent: HTMLElement, { label, min, max, step = 0.001, getValue, setValue, onCommit }: RangeControlConfig): HTMLLabelElement => {
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
      const formatValue = (value: number) => {
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

      const clamp = (value: number) => Math.max(min, Math.min(max, value));

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
      return row;
    };

    const addCheckboxControl = (parent: HTMLElement, { label, getValue, setValue, onCommit }: CheckboxControlConfig) => {
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

    const addSelectControl = (parent: HTMLElement, { label, options, getValue, setValue, onCommit }: SelectControlConfig) => {
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

      options.forEach((option: SelectOption) => {
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
      setValue: (value: number) => {
        visualizer.skyboxPreset = value;
        engine._loadSkybox({
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
      setValue: (value: number) => {
        state.minimizing_factor = value;
      },
    });

    addRangeControl(sceneSection.content, {
      label: 'MOD 2',
      min: 1.0,
      max: 10.0,
      step: 0.01,
      getValue: () => state.power_factor,
      setValue: (value: number) => {
        state.power_factor = value;
      },
    });

    addRangeControl(sceneSection.content, {
      label: 'MOD 3',
      min: 0.0,
      max: 1.0,
      getValue: () => state.pointerDownMultiplier,
      setValue: (value: number) => {
        state.pointerDownMultiplier = value;
      },
    });

    addRangeControl(sceneSection.content, {
      label: 'Base Speed',
      min: 0.01,
      max: 0.9,
      getValue: () => state.base_speed,
      setValue: (value: number) => {
        state.base_speed = value;
      },
    });

    addRangeControl(sceneSection.content, {
      label: 'Easing Speed',
      min: 0.01,
      max: 0.9,
      getValue: () => state.easing_speed,
      setValue: (value: number) => {
        state.easing_speed = value;
      },
    });

    addRangeControl(sceneSection.content, {
      label: 'Scale',
      min: 1,
      max: 200,
      step: 0.1,
      getValue: () => visualizer.scale,
      setValue: (value: number) => {
        visualizer.scale = value;
      },
    });

    addCheckboxControl(sceneSection.content, {
      label: 'Auto Rotate',
      getValue: () => controls.autoRotate,
      setValue: (value: boolean) => {
        controls.autoRotate = value;
      },
    });

    addRangeControl(sceneSection.content, {
      label: 'Rotation Speed',
      min: 0.1,
      max: 50,
      step: 0.01,
      getValue: () => controls.autoRotateSpeed,
      setValue: (value: number) => {
        controls.autoRotateSpeed = value;
      },
    });

    addRangeControl(cameraSection.content, {
      label: 'FOV',
      min: 1,
      max: 359,
      step: 1,
      getValue: () => camera.fov,
      setValue: (value: number) => {
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
      setValue: (value: number) => {
        state.camTilt = value;
        camera.up.set(
          Math.sin(state.camTilt),
          Math.cos(state.camTilt),
          -Math.sin(state.camTilt),
        );
      },
    });

    const syncCameraOrientationModeUi = () => {
      const showContinuousSpeed = Number(state.camOrientationMode) === 2;
      camOrientationSpeedRow.style.display = showContinuousSpeed ? 'grid' : 'none';
    };

    // add select control for camera orientation mode with options for static, pointer-based, and continuous rotation
    addSelectControl(cameraSection.content, {
      label: 'Camera Orientation Mode',
      options: [
        { label: 'Static', value: 0 },
        { label: 'Pointer-Based', value: 1 },
        { label: 'Continuous Rotation', value: 2 },
      ],
      getValue: () => state.camOrientationMode,
      setValue: (value: number) => {
        state.camOrientationMode = value;
        syncCameraOrientationModeUi();
      },
    });

    // add range control for constant camera orientation multiplier that changes camera orientation continuously
    // only appears when camera orientation mode is set to continuous rotation
    const camOrientationSpeedRow = addRangeControl(cameraSection.content, {
      label: 'Camera Orientation Speed',
      min: 0.01,
      max: 5,
      step: 0.01,
      getValue: () => state.camOrientationSpeed,
      setValue: (value: number) => {
        state.camOrientationSpeed = value;
        engine.cameraUpdateHook = () => {
          state.camTilt += state.camOrientationSpeed * 0.01;
          if (state.camOrientationMode === 2) {
            camera.up.set(
              Math.sin(state.camTilt),
              Math.cos(state.camTilt),
              -Math.sin(state.camTilt),
            );
          }
        };

      },
    });
    syncers.push(syncCameraOrientationModeUi);
    syncCameraOrientationModeUi();

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
    host.appendChild(overlay);

    return {
      element: overlay,
      open,
      close,
      refresh,
    };
  }

  public initTweakpane() {
      const { 
        engine, 
        host } = this;

    // const previousPresetLoaded = engine.onPresetLoaded;
    // engine.onPresetLoaded = preset => {
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
      top: '8px',
      right: '8px',
      zIndex: '20',
    });
    host.appendChild(paneMount);

    this.pane = new Pane({ container: paneMount });

    this.pane
      .addButton({
        title: 'Randomize',
        label: '???',
      })
      .on('click', () => {
        this.randomizeSettings();
        this.pane?.refresh();
      });

    this.fxStudioOverlay = this.createFxStudioOverlay();
    this.sceneCameraDock = this.createSceneCameraDock();
    this.pane.hidden = true;

    // Expose tweakpane state export/import so engine presets can include settings.
    engine.exportSettingsState = () => {
      if (!this.pane) {
        return null;
      }
      return this.pane.exportState();
    };

    engine.importSettingsState = (state: any) => {
      if (!this.pane) {
        return;
      }

      this.pane.importState(state);
      this.pane.refresh();

      this.renderer.toneMapping = effects.toneMapping.method;
      if (typeof engine._syncSobelResolution === 'function') {
        engine._syncSobelResolution();
      }

      this.rebuildComposer();
      this.sceneCameraDock?.refresh();
      this.fxStudioOverlay?.refresh();
    };

    engine.refreshSettingsUI = () => {
      if (!this.pane) {
        return;
      }
      this.pane.refresh();
      this.fxStudioOverlay?.refresh();
      this.sceneCameraDock?.refresh();
    };
  }

  public randomizeSettings() {
      const { 
          engine, 
          camera,
          controls,
          state,
          visualizer,
            renderer,
          pane,
          fxStudioOverlay,
          sceneCameraDock } = this;

          const randRange = (min: number, max: number) => Math.random() * (max - min) + min;
          const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));
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
        engine._loadSkybox({ type: 'preset', presetId: skyboxId });
      }

      // FX toggles + all adjustable FX parameters
      effects.bloom.enabled = randBool(0.55);
      effects.bloom.settings.strength = randRange(0.0, 10.0);
      effects.bloom.settings.radius = randRange(-10.0, 10.0);
      effects.bloom.settings.threshold = randRange(0.0, 10.0);

      effects.RGBShift.enabled = randBool(0.4);
      const rgbShiftUniforms = effects.RGBShift?.shader?.uniforms as any;
      if (rgbShiftUniforms?.amount) {
        rgbShiftUniforms.amount.value = randRange(0.0, 0.1);
      }
      if (rgbShiftUniforms?.angle) {
        rgbShiftUniforms.angle.value = randRange(0.0, 2 * Math.PI);
      }

      effects.afterImagePass.enabled = randBool(0.35);
      const afterImageUniforms = effects.afterImagePass?.shader?.uniforms as any;
      if (afterImageUniforms?.damp) {
        afterImageUniforms.damp.value = randRange(0.0, 1.0);
      }

      effects.colorifyShader.enabled = randBool(0.35);
      effects.colorifyShader.color.setHSL(Math.random(), randRange(0.2, 1.0), randRange(0.2, 0.8));

      effects.kaleidoShader.enabled = randBool(0.3);
      const kaleidoUniforms = effects.kaleidoShader?.shader?.uniforms as any;
      if (kaleidoUniforms?.sides) {
        kaleidoUniforms.sides.value = randInt(1, 24);
      }
      if (kaleidoUniforms?.angle) {
        kaleidoUniforms.angle.value = randRange(0.0, 2 * Math.PI);
      }

      effects.glitchPass.enabled = randBool(0.25);
      effects.dotShader.enabled = randBool(0.25);
      effects.technicolorShader.enabled = randBool(0.25);
      effects.luminosityShader.enabled = randBool(0.25);
      effects.sobelShader.enabled = randBool(0.25);
      effects.halftonePass.enabled = randBool(0.25);
      effects.gammaCorrectionShader.enabled = randBool(0.25);
      effects.copyShader.enabled = randBool(0.2);
      effects.bleachBypassShader.enabled = randBool(0.2);
      effects.toonShader.enabled = randBool(0.2);

      const toneMappingMethods = [
        LinearToneMapping,
        CineonToneMapping,
        ACESFilmicToneMapping,
        NoToneMapping,
        ReinhardToneMapping,
        AgXToneMapping,
        NeutralToneMapping,
      ];
      effects.toneMapping.method = toneMappingMethods[randInt(0, toneMappingMethods.length - 1)];
      renderer.toneMapping = effects.toneMapping.method;
      renderer.toneMappingExposure = randRange(-500.0, 500.0);

      const currentOrder: string[] = effects.getPassOrder();
      const shuffled = currentOrder.filter((passId: string) => passId !== 'outputPass');
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      effects.setPassOrder([...shuffled, 'outputPass']);

      controls.update();
      if (pane) {
        pane.refresh();
      }
      fxStudioOverlay?.refresh();
      sceneCameraDock?.refresh();
      this.rebuildComposer();
  }
}

// LEGACY INIT CONTROLS
export function initControls(engine: MAGEEngine) {
  const controls = new MAGEControls(engine);
  controls.initTweakpane();
  controls.eventSetup();
  return controls;
}


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