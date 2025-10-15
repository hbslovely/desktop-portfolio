const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const IMAGE_BASE_URL = 'https://images.ygoprodeck.com/images/cards';
const OUTPUT_DIR = path.join(__dirname, '../src/assets/images/yugi');
const OUTPUT_DIR_SMALL = path.join(OUTPUT_DIR, 'small');
const OUTPUT_DIR_CROPPED = path.join(OUTPUT_DIR, 'cropped');

// Create directories if they don't exist
[OUTPUT_DIR, OUTPUT_DIR_SMALL, OUTPUT_DIR_CROPPED].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Download helper with retry
function downloadImage(url, filepath, retries = 3) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (retries > 0 && response.statusCode >= 500) {
        console.log(`Retrying ${url} (${retries} retries left)`);
        setTimeout(() => {
          downloadImage(url, filepath, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
      } else {
        file.close();
        fs.unlink(filepath, () => {});
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlink(filepath, () => {});
      if (retries > 0) {
        console.log(`Retrying ${url} due to error (${retries} retries left)`);
        setTimeout(() => {
          downloadImage(url, filepath, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

// Delay helper to respect rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch all cards from API
function fetchAllCards() {
  return new Promise((resolve, reject) => {
    https.get(API_URL, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Main download function
async function downloadAllImages() {
  console.log('Fetching card list from API...');
  
  try {
    const cards = await fetchAllCards();
    console.log(`Found ${cards.length} cards`);
    
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;
    
    // Download images in batches to respect rate limits
    const batchSize = 10;
    const delayBetweenBatches = 1000; // 1 second
    
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (card) => {
        const cardId = card.id;
        
        // Check if we have multiple images
        const images = card.card_images || [];
        
        for (const imageInfo of images) {
          const imageId = imageInfo.id;
          
          // Paths for different sizes
          const normalPath = path.join(OUTPUT_DIR, `${imageId}.jpg`);
          const smallPath = path.join(OUTPUT_DIR_SMALL, `${imageId}.jpg`);
          const croppedPath = path.join(OUTPUT_DIR_CROPPED, `${imageId}.jpg`);
          
          try {
            // Download normal size (only if not exists)
            if (!fs.existsSync(normalPath)) {
              await downloadImage(`${IMAGE_BASE_URL}/${imageId}.jpg`, normalPath);
              downloaded++;
            } else {
              skipped++;
            }
            
            // Download small size (only if not exists)
            if (!fs.existsSync(smallPath)) {
              await downloadImage(`${IMAGE_BASE_URL}_small/${imageId}.jpg`, smallPath);
            }
            
            // Download cropped size (only if not exists)
            if (!fs.existsSync(croppedPath)) {
              await downloadImage(`${IMAGE_BASE_URL}_cropped/${imageId}.jpg`, croppedPath);
            }
            
            if ((downloaded + skipped) % 100 === 0) {
              console.log(`Progress: ${downloaded + skipped}/${cards.length} processed (${downloaded} downloaded, ${skipped} skipped, ${failed} failed)`);
            }
          } catch (error) {
            console.error(`Failed to download image for card ${imageId}:`, error.message);
            failed++;
          }
        }
      }));
      
      // Delay between batches to respect rate limits
      if (i + batchSize < cards.length) {
        await delay(delayBetweenBatches);
      }
    }
    
    console.log('\n=== Download Complete ===');
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Skipped (already exists): ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total cards processed: ${cards.length}`);
    
    // Create a manifest file
    const manifest = {
      downloadDate: new Date().toISOString(),
      totalCards: cards.length,
      downloaded: downloaded,
      skipped: skipped,
      failed: failed,
      imageDirectory: OUTPUT_DIR
    };
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    console.log('\nManifest saved to:', path.join(OUTPUT_DIR, 'manifest.json'));
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the download
console.log('Starting Yu-Gi-Oh! card image download...');
console.log('This will take a while (13,000+ cards)...');
console.log('Images will be saved to:', OUTPUT_DIR);
console.log('');

downloadAllImages();

