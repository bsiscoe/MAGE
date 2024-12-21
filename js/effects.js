import { RenderPass } from 'three/addons/postprocessing/RenderPass'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { DotScreenShader } from 'three/addons/shaders/DotScreenShader.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'
import { LuminosityShader } from 'three/addons/shaders/LuminosityShader.js';
import { SobelOperatorShader } from 'three/addons/shaders/SobelOperatorShader.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import { ColorifyShader } from 'three/addons/shaders/ColorifyShader.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { KaleidoShader } from 'three/addons/shaders/KaleidoShader.js';
import { TechnicolorShader } from 'three/addons/shaders/TechnicolorShader.js';
import { ToonShader1, ToonShader2, ToonShaderHatching, ToonShaderDotted} from 'three/addons/shaders/ToonShader.js';
import { BleachBypassShader } from 'three/addons/shaders/BleachBypassShader.js';
import { Vector2 } from 'three';

// threejs effects list
let effects = {
  toneMapping : {
        exposure : 1.5,
        method : 0, // Default
  },
  sobelShader : {
      shader : new ShaderPass(SobelOperatorShader),
      enabled : false,
  },
  halftonePass : {
    shader : new HalftonePass(),
    enabled : false, 
  },
  luminosityShader : {
    shader : new ShaderPass(LuminosityShader),
    enabled : false,
  },
  gammaCorrectionShader : {
    shader : new ShaderPass(GammaCorrectionShader),
    enabled : false,
  },
  dotShader : {
    shader : new ShaderPass(DotScreenShader),
    scale : 4.0,
    enabled : false,
  },
  colorifyShader : {
    shader : new ShaderPass(ColorifyShader),
    enabled : false,
  },
  technicolorShader : {
    shader : new ShaderPass(TechnicolorShader),
    enabled : false,
  },
  toonShader : {
    shader : new ShaderPass(ToonShader1),
    enabled : false,
    toonShaderChoice : 0,
    update : function() {
      this.shader = new ShaderPass(this.toonShaderChoice)
    },
  },
  bleachBypassShader : {
    shader : new ShaderPass(BleachBypassShader),
    enabled : false,
  },
  RGBShift : {
    shader : new ShaderPass(RGBShiftShader),
    enabled : false,
  },
  bloom : {
    settings : {
        strength : 1.0,
        radius : 0.2,
        threshold : 0.1,
    },
    shader : new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      1.6,
      0.2,
      0.2,
    ),
    
    enabled : false,
    
    update : function() {
      this.shader?.dispose(); // CALL DISPOSE TO PREVENT MEM LEAKS
      this.shader = new UnrealBloomPass(
        new Vector2(window.innerWidth, window.innerHeight),
        this.settings.strength,
        this.settings.radius,
        this.settings.threshold
      );
    },
  },
  afterImagePass : {
    shader : new AfterimagePass(),
    enabled : false,
    update : function (damp){
      this.shader?.dispose();
      this.shader = new AfterimagePass(damp);
    },
  },
  kaleidoShader : {
    shader : new ShaderPass(KaleidoShader),
    enabled : false,
  },
  glitchPass : {
    shader : new GlitchPass(64),
    enabled : false,
  },
  outputPass : {
    shader : new OutputPass(),
    enabled : true,
  },
  applyPostProcessing : function(scene, renderer, camera, composer) {
    
  // CALL DISPOSE TO PREVENT MEM LEAKS
  this.bloom.update(); 
  this.afterImagePass.update();
  this.toonShader.update();

    // clean slate
    composer?.dispose();
    let newComposer = new EffectComposer(renderer);
    newComposer.addPass(new RenderPass(scene, camera));

    let allEffects = Object.keys(this); 
  
    allEffects.forEach(effect => {
      if (this[`${effect}`].enabled) 
        newComposer.addPass(this[`${effect}`].shader);
        //composer.addPass(new RenderPass(scene, camera));
    });

    return newComposer;
  }
}

export default effects;