const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, '..', 'dist');

function renameIfExists(fromName, toName) {
  const fromPath = path.join(distDir, fromName);
  const toPath = path.join(distDir, toName);

  if (!fs.existsSync(fromPath)) {
    return;
  }

  if (fs.existsSync(toPath)) {
    fs.rmSync(toPath);
  }

  fs.renameSync(fromPath, toPath);
}

function rewriteSourceMapReference(fileName, mapFileName) {
  const filePath = path.join(distDir, fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8').replace(/sourceMappingURL=.*$/m, `sourceMappingURL=${mapFileName}`);
  fs.writeFileSync(filePath, contents, 'utf8');
}

renameIfExists('mage-engine.mjs', 'mage-engine.js');
renameIfExists('mage-engine.mjs.map', 'mage-engine.js.map');
rewriteSourceMapReference('mage-engine.js', 'mage-engine.js.map');

// Keep only these files in dist
const filesToKeep = [
  'mage-engine.js',
  'mage-engine.js.map',
  'mage-engine.d.ts',
];

// Read all files in dist
const files = fs.readdirSync(distDir);

// Delete files not in the keep list
files.forEach(file => {
  if (!filesToKeep.includes(file)) {
    const filePath = path.join(distDir, file);
    fs.rmSync(filePath);
    console.log(`Deleted: ${file}`);
  }
});