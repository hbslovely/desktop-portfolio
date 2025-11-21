const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DIST_DIR = path.join(__dirname, '../dist/desktop-portfolio');

// Obfuscation options - High security settings
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false, // Set to false to avoid breaking the app
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
  unicodeEscapeSequence: false
};

function obfuscateFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Skip if file is too small or contains specific patterns
    if (code.length < 100 || 
        filePath.includes('polyfills') || 
        filePath.includes('runtime') ||
        filePath.includes('vendor')) {
      console.log(`⏭️  Skipping: ${path.basename(filePath)}`);
      return;
    }

    console.log(`🔒 Obfuscating: ${path.basename(filePath)}`);
    
    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
    const obfuscatedCode = obfuscationResult.getObfuscatedCode();
    
    fs.writeFileSync(filePath, obfuscatedCode, 'utf8');
    console.log(`✅ Obfuscated: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Error obfuscating ${filePath}:`, error.message);
  }
}

function obfuscateBuild() {
  console.log('🚀 Starting obfuscation process...');
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ Dist directory not found: ${DIST_DIR}`);
    process.exit(1);
  }

  // Find all JavaScript files in dist directory
  const jsFiles = glob.sync('**/*.js', {
    cwd: DIST_DIR,
    absolute: true,
    ignore: ['**/node_modules/**', '**/*.spec.js']
  });

  console.log(`📦 Found ${jsFiles.length} JavaScript files to obfuscate`);

  jsFiles.forEach(obfuscateFile);

  console.log('✨ Obfuscation complete!');
}

// Run obfuscation
obfuscateBuild();

