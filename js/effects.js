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
import { Vector2 } from 'three';

// threejs effects list
let effects = {
  toneMapping : {
        exposure : 1.5,
        method : 0, // Default
  },
  luminosityShader : {
    shader : new ShaderPass(LuminosityShader),
    enabled : false,
  },
  sobelShader : {
      shader : new ShaderPass(SobelOperatorShader),
      enabled : false,
  },
  halftonePass : {
    shader : new HalftonePass(),
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
  RGBShift : {
    shader : new ShaderPass(RGBShiftShader),
    scale : 0.0015,
    enabled : false,
  },
  bloom : {
      shader : null,
      settings : {
        strength : 1.0,
        radius : 0.2,
        threshold : 0.1,
      },
    
      enabled : false,
    
      update : () => {
        effects.bloom.shader = new UnrealBloomPass(
          new Vector2(window.innerWidth, window.innerHeight),
          effects.bloom.settings.strength,
          effects.bloom.settings.radius,
          effects.bloom.settings.threshold
        );
      },
  },
  afterImagePass : {
    shader : new AfterimagePass(),
    enabled : false,
  },
  kaleidoShader : {
    shader : new ShaderPass(KaleidoShader),
    enabled : false,
  },
  glitchPass : {
    shader : new GlitchPass(),
    enabled : false,
  },
  outputPass : {
    shader : new OutputPass(),
    enabled : true,
  },
  applyPostProcessing : function(scene, renderer, camera){
    this.bloom.update();
    
    // clean slate
    let composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    
    let allEffects = Object.keys(this); 
  
    allEffects.forEach(effect => {
      if (this[`${effect}`].enabled) 
        composer.addPass(this[`${effect}`].shader);
        //composer.addPass(new RenderPass(scene, camera));
    });

    return composer;
  }
}

export default effects;