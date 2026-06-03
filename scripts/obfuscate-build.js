const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DIST_DIR = path.join(__dirname, '../dist');
const LARGE_FILE_BYTES = 500 * 1024;
const SKIP_PATTERNS = ['polyfills', 'runtime', 'vendor', 'scripts', 'worker'];

const baseOptions = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  simplify: true,
  unicodeEscapeSequence: false,
};

const heavyOptions = {
  ...baseOptions,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  numbersToExpressions: true,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
};

const lightOptions = {
  ...baseOptions,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.5,
  transformObjectKeys: false,
};

function shouldSkip(filePath) {
  const basename = path.basename(filePath);
  return SKIP_PATTERNS.some((pattern) => basename.includes(pattern));
}

function getOptionsForFile(filePath) {
  const size = fs.statSync(filePath).size;
  return size >= LARGE_FILE_BYTES ? lightOptions : heavyOptions;
}

function removeSourceMaps() {
  const mapFiles = glob.sync('**/*.js.map', {
    cwd: DIST_DIR,
    absolute: true,
  });

  mapFiles.forEach((mapFile) => {
    fs.unlinkSync(mapFile);
    console.log(`Removed source map: ${path.basename(mapFile)}`);
  });
}

function obfuscateFile(filePath) {
  const basename = path.basename(filePath);

  if (shouldSkip(filePath)) {
    console.log(`Skipping: ${basename}`);
    return;
  }

  const code = fs.readFileSync(filePath, 'utf8');
  if (code.length < 100) {
    console.log(`Skipping tiny file: ${basename}`);
    return;
  }

  const options = getOptionsForFile(filePath);
  const profile = options === lightOptions ? 'light' : 'heavy';

  console.log(`Obfuscating (${profile}): ${basename} (${(code.length / 1024).toFixed(1)} KB)`);

  const obfuscationResult = JavaScriptObfuscator.obfuscate(code, options);
  fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf8');

  console.log(`Done: ${basename}`);
}

function obfuscateBuild() {
  console.log('Starting post-build obfuscation...');

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Dist directory not found: ${DIST_DIR}`);
    console.error('Run "npm run build:plain" first.');
    process.exit(1);
  }

  removeSourceMaps();

  const jsFiles = glob
    .sync('**/*.js', {
      cwd: DIST_DIR,
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.spec.js'],
    })
    .sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);

  console.log(`Found ${jsFiles.length} JavaScript files`);

  for (const filePath of jsFiles) {
    try {
      obfuscateFile(filePath);
    } catch (error) {
      console.error(`Error obfuscating ${path.basename(filePath)}:`, error.message);
      process.exit(1);
    }
  }

  console.log('Obfuscation complete.');
}

obfuscateBuild();
