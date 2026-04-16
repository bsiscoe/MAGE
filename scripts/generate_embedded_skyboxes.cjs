const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const resourcesDir = path.join(projectRoot, 'resources/skyboxes');
const outputFile = path.join(projectRoot, 'js', 'skyboxes.js');

const FACE_NAMES = ['left', 'right', 'up', 'down', 'front', 'back'];
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function findFaceFile(presetDir, faceName) {
  for (const ext of EXTENSIONS) {
    const candidate = path.join(presetDir, `sky_${faceName}.${ext}`);
    if (fs.existsSync(candidate)) {
      return { filePath: candidate, ext };
    }
  }
  return null;
}

function fileToDataUri(filePath, ext) {
  const bytes = fs.readFileSync(filePath);
  const base64 = bytes.toString('base64');
  return `data:${MIME_TYPES[ext]};base64,${base64}`;
}

function collectSkyboxIds() {
  const entries = fs.readdirSync(resourcesDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && /^skybox\d+$/.test(entry.name))
    .map(entry => Number.parseInt(entry.name.replace('skybox', ''), 10))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function collectSkyboxIdsWithCompleteSkyboxes() {
  const ids = collectSkyboxIds();
  const complete = [];

  for (const skyboxId of ids) {
    const skyboxDir = path.join(resourcesDir, `skybox${skyboxId}`);
    let hasAnyFace = false;
    let isComplete = true;

    for (const faceName of FACE_NAMES) {
      const faceFile = findFaceFile(skyboxDir, faceName);
      if (faceFile) {
        hasAnyFace = true;
      } else {
        isComplete = false;
      }
    }

    if (!hasAnyFace) {
      continue;
    }

    if (!isComplete) {
      throw new Error(
        `Skybox skybox${skyboxId} has partial skybox images. Include all six faces (${FACE_NAMES.join(', ')}) or remove the partial files.`,
      );
    }

    complete.push(skyboxId);
  }

  return complete;
}

function parseArgs(argv) {
  const parsed = {
    minSkybox: null,
    maxSkybox: null,
    skyboxIds: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--minSkybox' && i + 1 < argv.length) {
      parsed.minSkybox = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (token === '--maxSkybox' && i + 1 < argv.length) {
      parsed.maxSkybox = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (token === '--skyboxIds' && i + 1 < argv.length) {
      parsed.skyboxIds = argv[++i]
        .split(',')
        .map(value => Number.parseInt(value.trim(), 10))
        .filter(Number.isFinite)
        .filter(value => value >= 0)
        .sort((a, b) => a - b);
    }
  }

  return parsed;
}

function buildTargetSkyboxIds(options) {
  if (Array.isArray(options.skyboxIds) && options.skyboxIds.length > 0) {
    return [...new Set(options.skyboxIds)].sort((a, b) => a - b);
  }

  const hasRange = Number.isFinite(options.minSkybox) || Number.isFinite(options.maxSkybox);
  if (!hasRange) {
    return collectSkyboxIdsWithCompleteSkyboxes();
  }

  const minSkybox = Number.isFinite(options.minSkybox) ? options.minSkybox : 0;
  const maxSkybox = Number.isFinite(options.maxSkybox) ? options.maxSkybox : minSkybox;
  if (maxSkybox < minSkybox) {
    throw new Error(`Invalid range: maxSkybox (${maxSkybox}) is smaller than minSkybox (${minSkybox}).`);
  }

  const skyboxIds = [];
  for (let id = minSkybox; id <= maxSkybox; id++) {
    skyboxIds.push(id);
  }
  return skyboxIds;
}

function buildEmbeddedSkyboxes(targetSkyboxIds) {
  const embedded = {};
  const availableSkyboxIds = new Set(collectSkyboxIds());

  for (const skyboxId of targetSkyboxIds) {
    if (!availableSkyboxIds.has(skyboxId)) {
      throw new Error(`Missing resources folder for skybox${skyboxId}.`);
    }

    const skyboxDir = path.join(resourcesDir, `skybox${skyboxId}`);
    const faces = {};

    for (const faceName of FACE_NAMES) {
      const faceFile = findFaceFile(skyboxDir, faceName);
      if (!faceFile) {
        throw new Error(`Missing sky_${faceName} image in skybox${skyboxId}. Expected one of: ${EXTENSIONS.join(', ')}.`);
      }
      faces[faceName] = fileToDataUri(faceFile.filePath, faceFile.ext);
    }

    embedded[skyboxId] = faces;
  }

  return embedded;
}

function toModuleSource(embedded) {
  const serialized = JSON.stringify(embedded, null, 2);

  return `const EMBEDDED_SKYBOXES = ${serialized};\n\n`
    + `function deepClone(value) {\n`
    + `  return JSON.parse(JSON.stringify(value));\n`
    + `}\n\n`
    + `export function hasEmbeddedSkybox(presetId) {\n`
    + `  const key = Number.parseInt(\`${'${presetId}'}\`, 10);\n`
    + `  return Number.isFinite(key) && Object.hasOwn(EMBEDDED_SKYBOXES, key);\n`
    + `}\n\n`
    + `export function getEmbeddedSkyboxFaces(presetId) {\n`
    + `  const key = Number.parseInt(\`${'${presetId}'}\`, 10);\n`
    + `  if (!Number.isFinite(key) || !Object.hasOwn(EMBEDDED_SKYBOXES, key)) {\n`
    + `    return null;\n`
    + `  }\n`
    + `\n`
    + `  return deepClone(EMBEDDED_SKYBOXES[key]);\n`
    + `}\n\n`
    + `export function registerEmbeddedSkybox(presetId, faces) {\n`
    + `  const key = Number.parseInt(\`${'${presetId}'}\`, 10);\n`
    + `  if (!Number.isFinite(key) || key < 0) {\n`
    + `    return false;\n`
    + `  }\n`
    + `\n`
    + `  if (!faces || typeof faces !== 'object' || Array.isArray(faces)) {\n`
    + `    return false;\n`
    + `  }\n`
    + `\n`
    + `  const requiredFaces = ['left', 'right', 'up', 'down', 'front', 'back'];\n`
    + `  for (const face of requiredFaces) {\n`
    + `    if (typeof faces[face] !== 'string' || !faces[face].startsWith('data:image/')) {\n`
    + `      return false;\n`
    + `    }\n`
    + `  }\n`
    + `\n`
    + `  EMBEDDED_SKYBOXES[key] = deepClone(faces);\n`
    + `  return true;\n`
    + `}\n\n`
    + `export { EMBEDDED_SKYBOXES };\n`;
}

function main() {
  if (!fs.existsSync(resourcesDir)) {
    throw new Error(`Resources directory not found: ${resourcesDir}`);
  }

  const options = parseArgs(process.argv.slice(2));
  const targetSkyboxIds = buildTargetSkyboxIds(options);
  if (targetSkyboxIds.length === 0) {
    throw new Error('No complete skyboxes found. Add sky_left/right/up/down/front/back images under resources/skyboxes/skyboxX.');
  }

  const embedded = buildEmbeddedSkyboxes(targetSkyboxIds);
  const source = toModuleSource(embedded);

  fs.writeFileSync(outputFile, source, 'utf8');

  const generatedCount = Object.keys(embedded).length;
  const generatedIds = targetSkyboxIds.join(', ');
  console.log(
    `Generated ${path.relative(projectRoot, outputFile)} with ${generatedCount} embedded skybox preset(s) for ids: ${generatedIds}.`,
  );
}

main();
