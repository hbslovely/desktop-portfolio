const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DIST_DIR = path.join(__dirname, '../dist');

const SKIP_PATTERNS = ['polyfills', 'runtime', 'vendor', 'scripts', 'worker'];

const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

function shouldSkip(filePath) {
  const basename = path.basename(filePath);
  return SKIP_PATTERNS.some((pattern) => basename.includes(pattern));
}

function removeSourceMaps() {
  const mapFiles = glob.sync('**/*.js.map', {
    cwd: DIST_DIR,
    absolute: true,
  });

  mapFiles.forEach((mapFile) => {
    fs.unlinkSync(mapFile);
    console.log(`🗑️  Removed source map: ${path.basename(mapFile)}`);
  });
}

function obfuscateFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');

    if (code.length < 100 || shouldSkip(filePath)) {
      console.log(`⏭️  Skipping: ${path.basename(filePath)}`);
      return;
    }

    console.log(`🔒 Obfuscating: ${path.basename(filePath)}`);

    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
    fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf8');

    console.log(`✅ Obfuscated: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Error obfuscating ${filePath}:`, error.message);
    process.exitCode = 1;
  }
}

function obfuscateBuild() {
  console.log('🚀 Starting post-build obfuscation...');

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ Dist directory not found: ${DIST_DIR}`);
    console.error('   Run "npm run build:plain" first.');
    process.exit(1);
  }

  removeSourceMaps();

  const jsFiles = glob.sync('**/*.js', {
    cwd: DIST_DIR,
    absolute: true,
    ignore: ['**/node_modules/**', '**/*.spec.js'],
  });

  console.log(`📦 Found ${jsFiles.length} JavaScript files`);

  jsFiles.forEach(obfuscateFile);

  if (process.exitCode) {
    console.error('❌ Obfuscation finished with errors.');
    process.exit(process.exitCode);
  }

  console.log('✨ Obfuscation complete!');
}

obfuscateBuild();
