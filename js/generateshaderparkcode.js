
const SHADERPARK_WHITELIST_SPEC = Object.freeze({
  Geometry: Object.freeze([
    'sphere',
    'box',
    'boxFrame',
    'torus',
    'line',
    'cylinder',
    'grid',
  ]),
  Construction: Object.freeze([
    'union',
    'difference',
    'blend',
    'intersect',
    'mixGeo',
    'shape',
  ]),
  Transforms: Object.freeze([
    'displace',
    'setSpace',
    'mirrorX',
    'mirrorY',
    'mirrorZ',
    'mirrorXYZ',
    'mirrorN',
    'rotateX',
    'rotateY',
    'rotateZ',
    'reset',
    'getSpace',
    'getSpherical',
    'getRayDirection',
  ]),
  SurfaceModifiers: Object.freeze([
    'expand',
    'shell',
    'setSDF',
  ]),
  Material: Object.freeze([
    'color',
    'metal',
    'shine',
    'mixMat',
    'hsv2rgb',
    'rgb2hsv',
    'occlusion',
    'fresnel',
    'noLighting',
    'lightDirection',
  ]),
  Inputs: Object.freeze([
    'input',
    'mouse',
    'mouseIntersection',
    'time',
    'normal',
  ]),
  Math: Object.freeze([
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'nsin',
    'exp',
    'log',
    'exp2',
    'log2',
    'pow',
    'sqrt',
    'inversesqrt',
    'mod',
    'fract',
    'abs',
    'sign',
    'floor',
    'ceil',
    'min',
    'max',
    'clamp',
    'mix',
    'smoothstep',
    'length',
    'distance',
    'dot',
    'cross',
    'normalize',
    'reflect',
    'refract',
    'toSpherical',
    'fromSpherical',
    'noise',
    'fractalNoise',
    'sphericalDistribution',
  ]),
  GlobalSettings: Object.freeze([
    'setGeometryQuality',
    'setStepSize',
    'setMaxIterations',
  ]),
});

const SHADERPARK_WHITELIST = new Set(Object.values(SHADERPARK_WHITELIST_SPEC).flat());

const CODEGEN_BLOCK_SPEC = Object.freeze({
  GeometryBlock: Object.freeze({
    allowed: Object.freeze(['sphere', 'boxFrame', 'torus', 'cylinder', 'grid']),
    order: 'after material',
    safeCombinations: Object.freeze(['sphere', 'boxFrame', 'torus', 'cylinder', 'grid']),
  }),
  TransformBlock: Object.freeze({
    allowed: Object.freeze(['reset', 'rotateX', 'rotateY', 'rotateZ', 'getSpace']),
    order: 'after construction, before surface',
    safeCombinations: Object.freeze(['reset + rotateXYZ', 'rotateXYZ only']),
  }),
  SurfaceBlock: Object.freeze({
    allowed: Object.freeze(['expand', 'shell']),
    order: 'after transform, before material',
    safeCombinations: Object.freeze(['expand', 'expand + shell']),
  }),
  MaterialBlock: Object.freeze({
    allowed: Object.freeze(['color', 'metal', 'shine']),
    order: 'before geometry',
    safeCombinations: Object.freeze(['color + metal + shine']),
  }),
  ConstructionBlock: Object.freeze({
    allowed: Object.freeze(['blend']),
    order: 'between geometry layers',
    safeCombinations: Object.freeze(['blend(level)']),
  }),
});

export const SHADER_FAMILIES = Object.freeze(['ORB', 'BLOB', 'GRID', 'HELIX', 'HYBRID', 'COMPLEX']);
export const SIGNATURE_STYLES = Object.freeze(['clean_minimal', 'organic_reactor', 'geometric_ritual', 'helix_engine']);

const SIGNATURE_STYLE_SPECS = Object.freeze({
  clean_minimal: Object.freeze({
    allowedShapes: Object.freeze(['sphere', 'torus']),
    structure: Object.freeze({ type: 'single_core', minNodes: 1, maxNodes: 2, blendBase: 0.05, blendWaveAmp: 0.03 }),
    colorSystem: Object.freeze({ mode: 'mono_duotone', sat: 0.35, val: 0.88, hueOffsets: Object.freeze([0, 0.04, -0.03]) }),
    motion: Object.freeze({ style: 'slow_orbit', amp: 0.06, wobble: 0.02 }),
    noise: Object.freeze({ behavior: 'subtle', intensity: 0.015, freqMin: 0.8, freqMax: 1.5 }),
  }),
  organic_reactor: Object.freeze({
    allowedShapes: Object.freeze(['sphere', 'cylinder', 'torus']),
    structure: Object.freeze({ type: 'nested_reactor', minNodes: 3, maxNodes: 5, blendBase: 0.16, blendWaveAmp: 0.12 }),
    colorSystem: Object.freeze({ mode: 'bio_heat', sat: 0.7, val: 0.78, hueOffsets: Object.freeze([0, 0.09, 0.18]) }),
    motion: Object.freeze({ style: 'pulsed_spin', amp: 0.2, wobble: 0.08 }),
    noise: Object.freeze({ behavior: 'reactive', intensity: 0.08, freqMin: 1.2, freqMax: 2.4 }),
  }),
  geometric_ritual: Object.freeze({
    allowedShapes: Object.freeze(['boxFrame', 'grid', 'torus']),
    structure: Object.freeze({ type: 'ritual_stack', minNodes: 3, maxNodes: 4, blendBase: 0.11, blendWaveAmp: 0.06 }),
    colorSystem: Object.freeze({ mode: 'ritual_triad', sat: 0.55, val: 0.82, hueOffsets: Object.freeze([0, 1 / 3, 2 / 3]) }),
    motion: Object.freeze({ style: 'locked_axes', amp: 0.09, wobble: 0.04 }),
    noise: Object.freeze({ behavior: 'engraved', intensity: 0.03, freqMin: 0.9, freqMax: 1.9 }),
  }),
  helix_engine: Object.freeze({
    allowedShapes: Object.freeze(['torus', 'cylinder', 'sphere']),
    structure: Object.freeze({ type: 'helix_chain', minNodes: 3, maxNodes: 6, blendBase: 0.14, blendWaveAmp: 0.09 }),
    colorSystem: Object.freeze({ mode: 'teal_magenta_drive', sat: 0.68, val: 0.86, hueOffsets: Object.freeze([0, 0.45, 0.58]) }),
    motion: Object.freeze({ style: 'axial_drive', amp: 0.16, wobble: 0.06 }),
    noise: Object.freeze({ behavior: 'engine_hum', intensity: 0.05, freqMin: 1.0, freqMax: 2.1 }),
  }),
});

export function getShaderParkWhitelistSpec() {
  return SHADERPARK_WHITELIST_SPEC;
}

export function getCodegenBlockSpec() {
  return CODEGEN_BLOCK_SPEC;
}

function clampRange(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function clampInt(value, min, max) {
  return Math.trunc(clampRange(value, min, max));
}

function normalizeSeed(seed) {
  if (seed === undefined || seed === null) {
    return 'mage-default-seed';
  }
  return String(seed);
}

function xmur3(seedText) {
  let hash = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = Math.imul(hash ^ seedText.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return function nextHash() {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
}

function mulberry32(seedInt) {
  let state = seedInt >>> 0;
  return function nextFloat() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRng(seed) {
  const hashFactory = xmur3(normalizeSeed(seed));
  const prng = mulberry32(hashFactory());

  return {
    float(min = 0, max = 1) {
      return min + (max - min) * prng();
    },
    int(min, max) {
      return Math.floor(this.float(min, max + 1));
    },
    bool(probability = 0.5) {
      return this.float(0, 1) < probability;
    },
    pick(list) {
      return list[this.int(0, list.length - 1)];
    },
  };
}

function formatFloat(value, digits = 4) {
  return Number(value).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatSignedLiteral(value, digits = 4) {
  const num = Number(value);
  if (num < 0) {
    return `-${formatFloat(Math.abs(num), digits)}`;
  }
  return `+${formatFloat(num, digits)}`;
}

function normalizeFamily(familyName) {
  if (!familyName) {
    return null;
  }
  const upper = String(familyName).toUpperCase();
  if (SHADER_FAMILIES.includes(upper)) {
    return upper;
  }
  return null;
}

function normalizeSignature(signatureName) {
  if (!signatureName) {
    return null;
  }
  const normalized = String(signatureName).toLowerCase();
  if (SIGNATURE_STYLES.includes(normalized)) {
    return normalized;
  }
  return null;
}

function pickSignature(rng) {
  return rng.pick(SIGNATURE_STYLES);
}

function biasedRange(rng, min, max, biasPower = 1.8) {
  const raw = rng.float(0, 1);
  const biased = Math.pow(raw, biasPower);
  return min + (max - min) * biased;
}

function buildSignatureLayer(signature, rng, complexity) {
  const spec = SIGNATURE_STYLE_SPECS[signature];
  const energy = clampRange(0.25 + complexity * 0.65 + rng.float(-0.06, 0.06), 0.12, 0.98);
  const density = clampRange(0.3 + complexity * 0.6 + rng.float(-0.08, 0.08), 0.1, 0.98);
  const sharedTimeScale = biasedRange(rng, 0.12, 0.62, 1.55) * (0.7 + energy * 0.6);
  const sharedNoiseFreq = rng.float(spec.noise.freqMin, spec.noise.freqMax) * (0.85 + density * 0.3);
  const noiseIntensity = spec.noise.intensity * (0.45 + energy * 0.85);
  const baseHue = rng.float(0, 1);
  const baseShapeScale = biasedRange(rng, 0.48, 1.18, 1.6);
  const baseWobbleFreq = biasedRange(rng, 0.48, 1.95, 1.45);

  const structureCount = clampInt(
    Math.round(spec.structure.minNodes + (spec.structure.maxNodes - spec.structure.minNodes) * density),
    spec.structure.minNodes,
    spec.structure.maxNodes,
  );

  return {
    name: signature,
    spec,
    anchors: {
      energy,
      density,
      baseHue,
      baseShapeScale,
      baseWobbleFreq,
      sharedTimeScale,
      sharedNoiseFreq,
      noiseIntensity,
    },
    structureType: spec.structure.type,
    nodeCount: structureCount,
  };
}

function applySignatureToGeometry(signatureLayer, geometry, rng) {
  const { spec, nodeCount, anchors } = signatureLayer;
  const nodes = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const kind = spec.allowedShapes[i % spec.allowedShapes.length];
    const rhythm = i / Math.max(1, nodeCount - 1);
    const scale = anchors.baseShapeScale * (1.0 - rhythm * 0.22 + anchors.energy * 0.12);
    const wobbleFreq = anchors.baseWobbleFreq * (1 + rhythm * 0.18);
    const pulseFreq = anchors.baseWobbleFreq * (0.9 + rhythm * 0.23);
    const wobble = spec.motion.wobble * (0.65 + anchors.energy * 0.5);

    nodes.push(createNode(rng, kind, anchors.energy, {
      scale,
      wobble,
      wobbleFreq,
      pulseFreq,
      expandAmp: anchors.noiseIntensity,
      noiseFreq: anchors.sharedNoiseFreq,
      pulseAmp: anchors.noiseIntensity * 0.75,
      pointerGain: 0.06 + anchors.energy * 0.1,
      rotate: [
        spec.motion.style === 'locked_axes' ? 0 : rng.float(-1.1, 1.1),
        spec.motion.style === 'locked_axes' ? rhythm * 0.55 : rng.float(-1.1, 1.1),
        spec.motion.style === 'locked_axes' ? 0 : rng.float(-1.1, 1.1),
      ],
    }));
  }
  geometry.nodes = nodes;
}

function pickFamily(rng) {
  return rng.pick(SHADER_FAMILIES);
}

function buildGlobalSettings(rng, complexity) {
  const geometryQuality = clampInt(Math.round(20 + complexity * 40 + rng.float(-2, 3)), 16, 80);
  const stepSize = clampRange(0.85 - complexity * 0.32 + rng.float(-0.05, 0.04), 0.35, 0.9);
  const maxIterations = clampInt(Math.round(18 + complexity * 110 + rng.float(-8, 8)), 48, 240);

  return {
    geometryQuality,
    stepSize,
    maxIterations,
    constraints: {
      geometryQuality: { min: 16, max: 80 },
      stepSize: { min: 0.35, max: 0.9 },
      maxIterations: { min: 48, max: 240 },
    },
  };
}

function buildInputBindings(rng, signatureLayer = null) {
  const minBaseSize = rng.float(0.16, 0.34);
  const baseSizeBias = rng.float(0.22, 0.56);
  const audioGain = rng.float(0.85, 1.65);
  const pressGain = rng.float(0.06, 0.28);
  const timeScale = signatureLayer ? signatureLayer.anchors.sharedTimeScale : rng.float(0.18, 0.66);
  const timeOffset = rng.float(-Math.PI, Math.PI);

  return {
    minBaseSize,
    baseSizeBias,
    audioGain,
    pressGain,
    timeScale,
    timeOffset,
    constraints: {
      minBaseSize: { min: 0.12, max: 0.4 },
      baseSizeBias: { min: 0.16, max: 0.7 },
      audioGain: { min: 0.6, max: 1.9 },
      pressGain: { min: 0, max: 0.5 },
      timeScale: { min: 0.1, max: 0.8 },
    },
  };
}

function buildTransformParams(rng, complexity, signatureLayer = null) {
  const motionAmp = signatureLayer ? signatureLayer.spec.motion.amp : 0.35 + complexity;
  const lockAxes = signatureLayer && signatureLayer.spec.motion.style === 'locked_axes';
  return {
    mouseYaw: lockAxes ? 0.9 : rng.float(0.7, 2.5),
    mousePitch: lockAxes ? 0.9 : rng.float(0.7, 2.5),
    rayYaw: rng.float(0.6, 2.1),
    rayPitch: rng.float(0.6, 2.1),
    rayRoll: rng.float(0.6, 2.1),
    yawWaveFreq: rng.float(0.4, 1.6),
    pitchWaveFreq: rng.float(0.4, 1.7),
    rollFreq: rng.float(0.25, 1.2),
    yawWaveAmp: rng.float(0.08, 0.45) * motionAmp,
    pitchWaveAmp: rng.float(0.08, 0.45) * motionAmp,
    rollAmp: rng.float(0.06, 0.42) * motionAmp,
    phase: rng.float(0, Math.PI * 2),
  };
}

function buildMaterialParams(rng, complexity, signatureLayer = null) {
  const colorSystem = signatureLayer ? signatureLayer.spec.colorSystem : null;
  const baseHue = signatureLayer ? signatureLayer.anchors.baseHue : rng.float(0, 1);
  const sat = colorSystem ? colorSystem.sat : rng.float(0.35, 0.75);
  const val = colorSystem ? colorSystem.val : rng.float(0.55, 0.9);
  const offsets = colorSystem ? colorSystem.hueOffsets : [0, 0.23, 0.46];
  const hueToChannel = offset => {
    const hue = (baseHue + offset) % 1;
    return clampRange(0.12 + val * (1 - Math.abs(0.5 - hue) * 1.6) * (0.55 + sat * 0.45), 0.1, 0.92);
  };

  return {
    baseColor: [hueToChannel(offsets[0]), hueToChannel(offsets[1]), hueToChannel(offsets[2])],
    waveAmp: [0.07 + sat * 0.12, 0.06 + sat * 0.1, 0.05 + sat * 0.11],
    waveFreq: [0.45 + val * 0.9, 0.52 + val * 0.85, 0.49 + val * 0.88],
    mouseMix: 0.04 + sat * 0.08,
    layerShift: (0.12 + sat * 0.32) * complexity,
    metal: 0.24 + sat * 0.45,
    shine: 0.28 + val * 0.5,
    colorSystem: colorSystem ? colorSystem.mode : 'free',
    baseHue,
  };
}

function buildConstructionParams(rng, complexity, signatureLayer = null) {
  const styleStruct = signatureLayer ? signatureLayer.spec.structure : null;
  const layeringDepth = styleStruct
    ? signatureLayer.nodeCount
    : clampInt(Math.round(2 + complexity * 5 + rng.float(-1, 1)), 2, 8);
  return {
    layeringDepth,
    blendBase: styleStruct ? styleStruct.blendBase : rng.float(0.08, 0.22),
    blendWaveAmp: styleStruct ? styleStruct.blendWaveAmp : rng.float(0.03, 0.2) * (0.4 + complexity),
    blendFreq: rng.float(0.3, 1.8),
    indexPhase: rng.float(0.2, 1.2),
  };
}

function createNode(rng, kind, complexity, overrides = {}) {
  return {
    kind,
    scale: rng.float(0.45, 1.35),
    minSize: rng.float(0.08, 0.24),
    pointerGain: rng.float(0.03, 0.2),
    wobble: rng.float(0, 0.14) * (0.2 + complexity),
    wobbleFreq: rng.float(0.45, 2.4),
    phase: rng.float(0, Math.PI * 2),
    rotate: [rng.float(-1.6, 1.6), rng.float(-1.6, 1.6), rng.float(-1.6, 1.6)],
    expandAmp: rng.float(0.0001, 0.1) * complexity,
    noiseFreq: rng.float(0.6, 2.8),
    pulseAmp: rng.float(0, 0.08) * complexity,
    pulseFreq: rng.float(0.4, 2.3),
    shellThickness: 0,
    minThickness: rng.float(0.02, 0.16),
    thicknessScale: rng.float(0.08, 0.35),
    heightScale: rng.float(0.5, 1.8),
    gridCount: rng.int(2, 9),
    ...overrides,
  };
}

function createFamilySchema(family, rng, complexity, constructionParams) {
  const depth = constructionParams.layeringDepth;
  if (family === 'ORB') {
    const nodes = [
      createNode(rng, 'sphere', complexity, {
        scale: rng.float(0.8, 1.25),
        minSize: rng.float(0.14, 0.26),
        expandAmp: rng.float(0.0001, 0.03) * complexity,
      }),
      createNode(rng, 'torus', complexity, {
        scale: rng.float(0.62, 0.95),
        minSize: rng.float(0.1, 0.2),
        thicknessScale: rng.float(0.15, 0.28),
      }),
    ];
    return {
      geometry: { nodes },
      constraints: {
        nodeCount: { min: 2, max: 2 },
        minSize: { min: 0.1, max: 2.2 },
      },
    };
  }

  if (family === 'BLOB') {
    const nodes = [
      createNode(rng, 'sphere', complexity, {
        scale: rng.float(0.75, 1.25),
        expandAmp: rng.float(0.06, 0.18) * (0.4 + complexity),
        pulseAmp: rng.float(0.04, 0.12) * (0.4 + complexity),
        shellThickness: rng.float(0.01, 0.06),
      }),
      createNode(rng, 'sphere', complexity, {
        scale: rng.float(0.4, 0.78),
        expandAmp: rng.float(0.05, 0.16) * (0.4 + complexity),
      }),
      createNode(rng, 'cylinder', complexity, {
        scale: rng.float(0.28, 0.68),
        heightScale: rng.float(0.9, 2.1),
        thicknessScale: rng.float(0.12, 0.24),
      }),
    ];
    return {
      geometry: { nodes },
      constraints: {
        nodeCount: { min: 3, max: 3 },
        minSize: { min: 0.08, max: 2.4 },
      },
    };
  }

  if (family === 'GRID') {
    const nodes = [
      createNode(rng, 'grid', complexity, {
        scale: rng.float(0.52, 1.18),
        minSize: rng.float(0.18, 0.36),
        gridCount: rng.int(3, 9),
        thicknessScale: rng.float(0.04, 0.14),
      }),
      createNode(rng, 'cylinder', complexity, {
        scale: rng.float(0.2, 0.62),
        heightScale: rng.float(1.2, 2.2),
      }),
    ];
    return {
      geometry: { nodes },
      constraints: {
        nodeCount: { min: 2, max: 2 },
        minSize: { min: 0.16, max: 2.6 },
      },
    };
  }

  if (family === 'HELIX') {
    const nodes = [
      createNode(rng, 'torus', complexity, {
        scale: rng.float(0.48, 0.9),
        thicknessScale: rng.float(0.1, 0.2),
      }),
      createNode(rng, 'torus', complexity, {
        scale: rng.float(0.52, 0.96),
        thicknessScale: rng.float(0.1, 0.2),
        rotate: [rng.float(0.6, 1.8), rng.float(0.6, 1.8), rng.float(0.6, 1.8)],
      }),
      createNode(rng, 'cylinder', complexity, {
        scale: rng.float(0.12, 0.28),
        heightScale: rng.float(1.6, 2.8),
        thicknessScale: rng.float(0.18, 0.26),
      }),
    ];
    return {
      geometry: { nodes },
      constraints: {
        nodeCount: { min: 3, max: 3 },
        minSize: { min: 0.08, max: 2.1 },
      },
    };
  }

  if (family === 'HYBRID') {
    const nodes = [
      createNode(rng, 'sphere', complexity, {
        scale: rng.float(0.62, 1.05),
      }),
      createNode(rng, 'grid', complexity, {
        scale: rng.float(0.46, 0.98),
        gridCount: rng.int(3, 8),
      }),
      createNode(rng, 'torus', complexity, {
        scale: rng.float(0.34, 0.72),
      }),
    ];
    return {
      geometry: { nodes },
      constraints: {
        nodeCount: { min: 3, max: 3 },
        minSize: { min: 0.1, max: 2.3 },
      },
    };
  }

  const complexCount = clampInt(depth + 1, 4, 8);
  const complexKinds = ['sphere', 'torus', 'cylinder', 'grid', 'boxFrame'];
  const nodes = [];
  for (let i = 0; i < complexCount; i += 1) {
    nodes.push(createNode(rng, rng.pick(complexKinds), complexity, {
      scale: rng.float(0.24, 1.15),
      expandAmp: rng.float(0.02, 0.16) * (0.3 + complexity),
      pulseAmp: rng.float(0.01, 0.1) * (0.3 + complexity),
      gridCount: rng.int(2, 10),
    }));
  }
  return {
    geometry: { nodes },
    constraints: {
      nodeCount: { min: 4, max: 8 },
      minSize: { min: 0.08, max: 2.8 },
    },
  };
}

function createParameterGraph(seed, complexity = 0.58, forcedFamily = null, forcedSignature = null) {
  const rng = createSeededRng(seed);
  const boundedComplexity = clampRange(Number(complexity), 0, 1);
  const family = normalizeFamily(forcedFamily) || pickFamily(rng);
  const signature = normalizeSignature(forcedSignature) || pickSignature(rng);
  const signatureLayer = buildSignatureLayer(signature, rng, boundedComplexity);
  const globalSettings = buildGlobalSettings(rng, boundedComplexity);
  const inputBindings = buildInputBindings(rng, signatureLayer);
  const transforms = buildTransformParams(rng, boundedComplexity, signatureLayer);
  const material = buildMaterialParams(rng, boundedComplexity, signatureLayer);
  const construction = buildConstructionParams(rng, boundedComplexity, signatureLayer);
  const familySchema = createFamilySchema(family, rng, boundedComplexity, construction);
  applySignatureToGeometry(signatureLayer, familySchema.geometry, rng);

  return {
    seed: normalizeSeed(seed),
    family,
    signature,
    complexity: boundedComplexity,
    signatureLayer,
    globalSettings,
    inputBindings,
    transforms,
    material,
    construction,
    geometry: familySchema.geometry,
    constraints: familySchema.constraints,
    blockSpec: CODEGEN_BLOCK_SPEC,
  };
}

function buildConstructionBlock(ir, nodeIndex) {
  if (nodeIndex === 0) {
    return { type: 'ConstructionBlock', operations: [] };
  }
  const c = ir.construction;
  const blendExpr = `max(0.02, min(0.45, ${formatFloat(c.blendBase)} + nsin(t * ${formatFloat(c.blendFreq)} + ${formatFloat(nodeIndex * c.indexPhase)}) * ${formatFloat(c.blendWaveAmp)}))`;
  return {
    type: 'ConstructionBlock',
    operations: [`blend(${blendExpr});`],
  };
}

function buildTransformBlock(ir, node, nodeIndex) {
  const t = ir.transforms;
  const phase = formatFloat(node.phase + t.phase);
  const wobble = formatFloat(node.wobble * 0.5);
  
  // Mid modulates wobble frequency (meso layer: structural motion)
  const wobbleFreqModulated = `(${formatFloat(node.wobbleFreq)} * (0.6 + mid * 1.0))`;
  
  // Mid also modulates rotation intensity (meso layer: rotational flow)
  const rayYawModulated = `${formatFloat(t.rayYaw)} * (0.75 + mid * 0.5)`;
  const rayPitchModulated = `${formatFloat(t.rayPitch)} * (0.75 + mid * 0.5)`;
  
  return {
    type: 'TransformBlock',
    operations: [
      'reset();',
      `rotateY(rayDir.x * ${rayYawModulated} + mx * ${formatFloat(t.mouseYaw)} + sin(t * ${formatFloat(t.yawWaveFreq)}) * ${formatFloat(t.yawWaveAmp)});`,
      `rotateX(rayDir.y * ${rayPitchModulated} + my * ${formatFloat(t.mousePitch)} + cos(t * ${formatFloat(t.pitchWaveFreq)}) * ${formatFloat(t.pitchWaveAmp)});`,
      `rotateZ(rayDir.z * ${formatFloat(t.rayRoll)} + sin(t * ${formatFloat(t.rollFreq)} + ${formatFloat(t.phase)}) * ${formatFloat(t.rollAmp)});`,
      `rotateX(${formatFloat(node.rotate[0])} + sin(t * ${wobbleFreqModulated} + ${phase}) * ${wobble});`,
      `rotateY(${formatFloat(node.rotate[1])} + cos(t * ${wobbleFreqModulated} + ${phase}) * ${wobble});`,
      `rotateZ(${formatFloat(node.rotate[2])} + nsin(t * ${wobbleFreqModulated} + ${phase}) * ${wobble});`,
    ],
  };
}

function buildSurfaceBlock(node, spaceVar) {
  const operations = [];
  const expandTerms = [];
  
  // Treble modulates expand amplitude (micro layer: detail and sparkle)
  const expandAmpModulated = `${formatFloat(node.expandAmp)} * (0.45 + treble * 1.2)`;
  const pulseAmpModulated = `${formatFloat(node.pulseAmp)} * (0.5 + treble * 1.0)`;
  
  if (node.expandAmp > 0.0001) {
    expandTerms.push(`noise(${spaceVar} * ${formatFloat(node.noiseFreq)}) * ${expandAmpModulated}`);
  }
  if (node.pulseAmp > 0.0001) {
    expandTerms.push(`nsin(t * ${formatFloat(node.pulseFreq)} + ${formatFloat(node.phase)}) * ${pulseAmpModulated}`);
  }
  if (expandTerms.length > 0) {
    operations.push(`expand(${expandTerms.join(' + ')});`);
  }
  if (node.shellThickness > 0.0001) {
    operations.push(`shell(${formatFloat(node.shellThickness)});`);
  }

  return {
    type: 'SurfaceBlock',
    operations,
  };
}

function buildMaterialBlock(ir, nodeIndex) {
  const m = ir.material;
  const layerPhase = formatFloat(nodeIndex * m.layerShift);
  const centroidShift = `(spectralCentroid - 0.5) * 0.32`;
  const centroidContrast = `0.85 + abs(spectralCentroid - 0.5) * 0.7`;
  const cR = `min(1.0, max(0.0, (${formatFloat(m.baseColor[0])} + ${centroidShift}) * ${centroidContrast} + rayDir.x * ${formatFloat(0.22 + m.mouseMix)} + sin(t * ${formatFloat(m.waveFreq[0])} + ${layerPhase}) * ${formatFloat(m.waveAmp[0])}))`;
  const cG = `min(1.0, max(0.0, (${formatFloat(m.baseColor[1])} + (spectralCentroid - 0.5) * 0.05) * ${centroidContrast} + rayDir.y * ${formatFloat(0.22 + m.mouseMix)} + cos(t * ${formatFloat(m.waveFreq[1])} + ${layerPhase}) * ${formatFloat(m.waveAmp[1])}))`;
  const cB = `min(1.0, max(0.0, (${formatFloat(m.baseColor[2])} - ${centroidShift}) * ${centroidContrast} + rayDir.z * ${formatFloat(0.22 + m.mouseMix)} + nsin(t * ${formatFloat(m.waveFreq[2])} + ${layerPhase}) * ${formatFloat(m.waveAmp[2])}))`;

  return {
    type: 'MaterialBlock',
    operations: [
      `color(${cR}, ${cG}, ${cB});`,
      `metal(max(0.0, min(1.0, ${formatFloat(m.metal)} * (0.7 + energy * 0.6) + pointerDown * 0.12)));`,
      `shine(max(0.0, min(1.0, ${formatFloat(m.shine)} * (0.8 + energy * 0.4) + size * 0.05)));`,
    ],
  };
}

function makeSizeExpr(node) {
  // Bass modulates geometry scale (macro layer: large deformation)
  const bassScale = `(0.8 + bass * 0.4)`;
  return `max(${formatFloat(node.minSize)}, baseSize * ${formatFloat(node.scale)} * ${bassScale} + pointerDown * ${formatFloat(node.pointerGain)} + sin(t * ${formatFloat(node.wobbleFreq)} + ${formatFloat(node.phase)}) * ${formatFloat(node.wobble)})`;
}

function buildGeometryBlock(node) {
  const sizeExpr = makeSizeExpr(node);
  let operation = `sphere(${sizeExpr});`;

  if (node.kind === 'torus') {
    const thicknessExpr = `max(${formatFloat(node.minThickness)}, ${sizeExpr} * ${formatFloat(node.thicknessScale)})`;
    operation = `torus(${sizeExpr}, ${thicknessExpr});`;
  } else if (node.kind === 'cylinder') {
    const radiusExpr = `max(${formatFloat(node.minThickness)}, ${sizeExpr} * ${formatFloat(node.thicknessScale)})`;
    const heightExpr = `max(${formatFloat(node.minSize)}, ${sizeExpr} * ${formatFloat(node.heightScale)})`;
    operation = `cylinder(${radiusExpr}, ${heightExpr});`;
  } else if (node.kind === 'grid') {
    const thicknessExpr = `max(${formatFloat(node.minThickness)}, ${sizeExpr} * ${formatFloat(node.thicknessScale)})`;
    // Shader Park's grid helper expects (num, scale, roundness).
    // Keep num as a compile-time integer to avoid runtime parser issues.
    operation = `grid(${node.gridCount}, ${sizeExpr}, ${thicknessExpr});`;
  } else if (node.kind === 'boxFrame') {
    const thicknessExpr = `max(${formatFloat(node.minThickness)}, ${sizeExpr} * ${formatFloat(node.thicknessScale)})`;
    operation = `boxFrame(vec3(${sizeExpr}), ${thicknessExpr});`;
  }

  return {
    type: 'GeometryBlock',
    operations: [operation],
  };
}

function emitShaderFromIR(ir) {
  const g = ir.globalSettings;
  const i = ir.inputBindings;
  
  // Initialize shader with global settings and input bindings
  const lines = [
    `setGeometryQuality(${g.geometryQuality});`,
    `setStepSize(${formatFloat(g.stepSize)});`,
    `setMaxIterations(${g.maxIterations});`,
    'let size = input();',
    'let pointerDown = input();',
    'let bass = input();',
    'let mid = input();',
    'let treble = input();',
    'let energy = input();',
    'let spectralCentroid = input();',
    'let energyTrend = input();',
    'let mx = mouse.x;',
    'let my = mouse.y;',
    'let rayDir = normalize(getRayDirection());',
    'let s = getSpace();',
    `let t = time * ${formatFloat(i.timeScale)} ${formatSignedLiteral(i.timeOffset)};`,
    // Energy modulates overall animation intensity and baseSize scaling
    `let baseSize = max(${formatFloat(i.minBaseSize)}, ${formatFloat(i.baseSizeBias)} + size * ${formatFloat(i.audioGain)} * (0.8 + energy * 0.4) + pointerDown * ${formatFloat(i.pressGain)});`,
  ];

  ir.geometry.nodes.forEach((node, index) => {
    const constructionBlock = buildConstructionBlock(ir, index);
    const transformBlock = buildTransformBlock(ir, node, index);
    const surfaceBlock = buildSurfaceBlock(node, 's');
    const materialBlock = buildMaterialBlock(ir, index);
    const geometryBlock = buildGeometryBlock(node);

    lines.push(...constructionBlock.operations);
    lines.push(...transformBlock.operations);
    lines.push(...surfaceBlock.operations);
    lines.push(...materialBlock.operations);
    lines.push(...geometryBlock.operations);
  });

  return lines.join('\n');
}

export function generateShader(seed, options = {}) {
  const complexity = options.complexity === undefined ? 0.58 : options.complexity;
  const family = options.family || null;
  const signature = options.signature || null;
  const params = createParameterGraph(seed, complexity, family, signature);
  const code = emitShaderFromIR(params);
  return { code, params };
}

const LEGACY_PROFILE_MAP = Object.freeze({
  // default: { seed: 'mage-default', complexity: 0.54, family: 'HYBRID' },
  // 'default.bak': { seed: 'mage-default-bak', complexity: 0.52, family: 'ORB' },
  // dev: { seed: 'mage-dev', complexity: 0.68, family: 'HELIX' },
  // og: { seed: 'mage-og', complexity: 0.62, family: 'BLOB' },
  'generator_v1.5': { seed: 'mage-generator-v1-5', complexity: 0.5, family: 'ORB' },
  'generator_v1.5_extreme': { seed: 'mage-generator-v1-5', complexity: 1.0, family: 'COMPLEX' },
  'generator_v1.5_light': { seed: 'mage-generator-v1-5', complexity: 0.1 },
});

export function generateshaderparkcode(visualizer = null, shader = 'generator_v1.5') {
  const key = typeof shader === 'string' ? shader : 'generator_v1.5';

  if (key === 'default') {
    return `
          let size = input()
      let pointerDown = input()
      time = .3*time
	  size *= 1.3
      rotateY(mouse.x * -2 * PI / 2 * (1+nsin(time)))
      rotateX(mouse.y * 2 * PI / 2 * (1+nsin(time)))
      metal(.5*size)
      let rayDir = normalize(getRayDirection())
      let clampedColor = vec3(rayDir.x+.2, rayDir.y+.25, rayDir.z+.2)
      color(clampedColor)

      rotateY(sin(getRayDirection().y*8*(ncos(sin(time)))+size))
	  rotateX(cos((getRayDirection().x*16*nsin(time)+size)))
	  rotateZ(ncos((getRayDirection().z*4*cos(time)+size)))
      boxFrame(vec3(size), size*.1)
      shine(0.8*size)
      blend(nsin(time*(size))*0.1+0.1)
      sphere(size/2-pointerDown*.3)
      blend(ncos((time*(size)))*0.1+0.1)
      boxFrame(vec3(size-.075*pointerDown), size)
    `.toString().trim();
  }
  const profile = LEGACY_PROFILE_MAP[key] || {
    seed: `mage-${normalizeSeed(key)}`,
    complexity: 0.58,
    family: null,
  };

  if (visualizer && typeof visualizer.seed === 'number') {
    visualizer.seed += 1; // Add random offset to avoid collisions with legacy seeds
  } else {
    console.warn(`generateshaderparkcode: No visualizer provided, using profile "${key}" with seed "${profile.seed}"`);
  }

  return generateShader(profile.seed + (visualizer ? visualizer.seed : 0), {
    complexity: profile.complexity,
    family: profile.family,
  }).code.toString().trim();
}

function extractFunctionCalls(code) {
  const regex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  const calls = [];
  let match = regex.exec(code);
  while (match) {
    calls.push(match[1]);
    match = regex.exec(code);
  }
  return calls;
}

function collectInvalidShaderFunctions(code) {
  const allowed = new Set([...SHADERPARK_WHITELIST, 'vec2', 'vec3', 'vec4']);
  const calls = extractFunctionCalls(code);
  return calls.filter(name => !allowed.has(name));
}

function hasNoZeroSizeGeometry(params) {
  return params.geometry.nodes.every(node => {
    if (node.minSize <= 0) {
      return false;
    }
    if (node.kind === 'torus' || node.kind === 'cylinder' || node.kind === 'grid' || node.kind === 'boxFrame') {
      return node.minThickness > 0;
    }
    return true;
  });
}

export function runShaderGeneratorValidation() {
  const seedA = 'validation-seed-a';
  const seedB = 'validation-seed-b';
  const options = { complexity: 0.72, family: 'COMPLEX' };

  const first = generateShader(seedA, options);
  const second = generateShader(seedA, options);
  const third = generateShader(seedB, options);

  const sameSeedIdentical = first.code === second.code && JSON.stringify(first.params) === JSON.stringify(second.params);
  const differentSeedsDiffer = first.code !== third.code;

  const functionsWithoutRng = [
    generateShader,
    createParameterGraph,
    emitShaderFromIR,
    buildConstructionBlock,
    buildTransformBlock,
    buildSurfaceBlock,
    buildMaterialBlock,
    buildGeometryBlock,
  ];

  const noMathRandomOutsideRng = functionsWithoutRng.every(fn => !fn.toString().includes('Math.random'));

  const invalidFunctions = [
    ...collectInvalidShaderFunctions(first.code),
    ...collectInvalidShaderFunctions(third.code),
  ];
  const noInvalidFunctions = invalidFunctions.length === 0;

  const noZeroSizeGeometry = hasNoZeroSizeGeometry(first.params) && hasNoZeroSizeGeometry(third.params);

  return {
    sameSeedIdentical,
    differentSeedsDiffer,
    noMathRandomOutsideRng,
    noInvalidFunctions,
    invalidFunctions: [...new Set(invalidFunctions)],
    noZeroSizeGeometry,
    passed: sameSeedIdentical && differentSeedsDiffer && noMathRandomOutsideRng && noInvalidFunctions && noZeroSizeGeometry,
  };
}

export function generateFamilySnapshots(seed, complexity = 0.62) {
  const normalizedSeed = normalizeSeed(seed);
  const result = {};
  SHADER_FAMILIES.forEach(family => {
    const generated = generateShader(`${normalizedSeed}:${family}`, { family, complexity });
    result[family] = generated;
  });
  return result;
}

/*
Example of a good legacy generator. This is the kind of code we want to be able to generate with the new system, 
but it was written by hand before the new system existed. We can use this as a sanity check for the new generator, 
and eventually aim to replicate its visual style and behavior with the new system.

else if (shader == 'generator_v1.2') {
        const shapeChoices = ['sphere', 'boxFrame', 'torus', 'cylinder', 'grid'];
        const numShapes = Math.floor(Math.random() * 4) + 2; // Random number of shapes between 2 and 5
        let shapes = [];
      
        // Randomly decide how many shapes and which shapes to include
        for (let i = 0; i < numShapes; i++) {
          const shapeChoice = shapeChoices[Math.floor(Math.random() * shapeChoices.length)];
          const sizeFactor = Math.random() * 0.5 + 0.5; // Random size factor for variability
          shapes.push({ shape: shapeChoice, sizeFactor });
        }
      
        // Functions to return random values each time they are called
        const randomRotateFactor = () => Math.random() * 2 + 1;
        const randomBoolean = () => Math.random() < 0.5;
        const useSameFactor = () => Math.random() < 0.3; // Adjust probability for shared factors
        const sharedFactor = randomRotateFactor(); // Shared rotation factor
      
        const randomMetal = () => Math.random() * 0.5 + 0.3;
        const randomShine = () => Math.random() * 0.5 + 0.3;
        const randomBlend = () => Math.random() * 0.2 + 0.1;
        const noiseFactor = () => Math.random() * 2;
        const expansionFactor = () => Math.random() * 0.5;
        const timeFactor = () => Math.random() * 0.9 + 0.1;
      
        // Rotation variables
        const rotateXActive = randomBoolean();
        const rotateYActive = randomBoolean();
        const rotateZActive = randomBoolean();
      
        const rotateXFactor = randomRotateFactor();
        const rotateYFactor = useSameFactor() ? sharedFactor : randomRotateFactor();
        const rotateZFactor = useSameFactor() ? sharedFactor : randomRotateFactor();
      
        // Generate ShaderPark code string deterministically
        const shaderCode = `
          setMaxIterations(${Math.floor(Math.random() * 200)});
          setStepSize(${Math.random() * 0.9});
      
          let size = input();
          let pointerDown = input();
          time *= ${timeFactor()}; // Randomize time multiplier between 0.1 and 1
      
          // Rotations with conditional application
          ${rotateXActive ? `rotateX(getRayDirection().y * ${rotateXFactor} + time * ${rotateXFactor});` : ''}
          ${rotateYActive ? `rotateY(getRayDirection().x * ${rotateYFactor} + time * ${rotateYFactor});` : ''}
          ${rotateZActive ? `rotateZ(getRayDirection().z * ${rotateZFactor} + time * ${rotateZFactor});` : ''}
      
          // Set color
          color(getRayDirection().x, getRayDirection().y, getRayDirection().z);
      
          let s = getSpace();
      
          // Render the shapes
          ${shapes.map(({ shape, sizeFactor }) => {
            const adjustedSize = `size * ${sizeFactor} - pointerDown * 0.05`;
            const n = `noise(s * ${noiseFactor()})`;
            const applyNoise = Math.random() < 0.5;
      
            switch (shape) {
              case 'sphere':
                return applyNoise
                  ? `expand(${n} * ${expansionFactor()}); sphere(${adjustedSize} / 2);`
                  : `sphere(${adjustedSize} / 2);`;
              case 'boxFrame':
                return applyNoise
                  ? `expand(${n} * ${expansionFactor()}); boxFrame(vec3(${adjustedSize}), ${adjustedSize} * 0.1);`
                  : `boxFrame(vec3(${adjustedSize}), ${adjustedSize} * 0.1);`;
              case 'torus':
                return applyNoise
                  ? `expand(${n} * ${expansionFactor()}); torus(${adjustedSize}, ${adjustedSize} / 4);`
                  : `torus(${adjustedSize}, ${adjustedSize} / 4);`;
              case 'cylinder':
                return applyNoise
                  ? `expand(${n} * ${expansionFactor()}); cylinder(${adjustedSize} / 4, ${adjustedSize});`
                  : `cylinder(${adjustedSize} / 4, ${adjustedSize});`;
              case 'grid':
                return applyNoise
                  ? `expand(${n} * ${expansionFactor()}); grid(${Math.floor(Math.random() * 3) + 3}, ${adjustedSize} / 3, 0.01 * ${adjustedSize});`
                  : `grid(${Math.floor(Math.random() * 3) + 3}, ${adjustedSize} / 3, 0.01 * ${adjustedSize});`;
              default:
                return '';
            }
          }).join('\n')}
      
          blend(nsin(time * size) * ${randomBlend()});
        `;
      
        return shaderCode;
*/
