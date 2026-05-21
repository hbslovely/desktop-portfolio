# Yu-Gi-Oh! Card Images Download Guide

## Overview

This guide explains how to download all Yu-Gi-Oh! card images locally to comply with YGOPRODeck API best practices.

## Why Download Images Locally?

According to YGOPRODeck API guidelines:
> "Do not continually hotlink images directly from this site. Please download and re-host the images yourself."

By downloading images locally, we:
- ✅ Comply with API terms of service
- ✅ Improve app performance (no external requests)
- ✅ Enable offline functionality
- ✅ Reduce bandwidth usage on YGOPRODeck servers
- ✅ Have full control over image availability

## Download Process

### Automatic Download Script

We've created an automated Node.js script that will:
1. Fetch the complete card list from YGOPRODeck API (~13,000 cards)
2. Download 3 versions of each image:
   - **Normal** (421x614px) - Full card image
   - **Small** (168x246px) - Thumbnail version
   - **Cropped** (cropped artwork) - Card art only

### Directory Structure

```
src/assets/images/yugi/
├── {cardId}.jpg              # Normal size images
├── small/
│   └── {cardId}.jpg          # Small thumbnails
├── cropped/
│   └── {cardId}.jpg          # Cropped artwork
├── manifest.json             # Download metadata
└── .gitignore                # Ignore images in git
```

### Storage Requirements

- **Total Images**: ~39,000 files (13,000 cards × 3 sizes)
- **Estimated Size**: 
  - Normal: ~2.5 GB
  - Small: ~600 MB
  - Cropped: ~800 MB
  - **Total: ~3.9 GB**

⚠️ **Important**: Make sure you have at least 5 GB of free disk space.

## How to Download

### Step 1: Run the Download Script

```bash
npm run download-yugioh-images
```

This will start the download process. You'll see progress updates like:

```
Starting Yu-Gi-Oh! card image download...
Fetching card list from API...
Found 13126 cards
Progress: 100/13126 processed (100 downloaded, 0 skipped, 0 failed)
Progress: 200/13126 processed (200 downloaded, 0 skipped, 0 failed)
...
```

### Step 2: Wait for Completion

The download will take approximately:
- **Fast connection (100+ Mbps)**: 30-60 minutes
- **Medium connection (10-50 Mbps)**: 1-3 hours
- **Slow connection (<10 Mbps)**: 3-6 hours

### Step 3: Verify Download

After completion, you'll see a summary:

```
=== Download Complete ===
Downloaded: 13126
Skipped (already exists): 0
Failed: 0
Total cards processed: 13126
```

A `manifest.json` file will be created with download metadata.

## Script Features

### Rate Limiting
- Downloads in batches of 10 images
- 1-second delay between batches
- Respects YGOPRODeck's 20 requests/second limit

### Error Handling
- Automatic retry (up to 3 times) on failure
- Continues on error, doesn't stop entire process
- Failed downloads are logged

### Resume Capability
- Skips already downloaded images
- Safe to interrupt and restart
- Won't re-download existing files

## Troubleshooting

### Download Interrupted

Simply run the command again:
```bash
npm run download-yugioh-images
```

The script will skip already downloaded files and continue.

### Failed Downloads

Check the console output for failed card IDs. You can:
1. Run the script again (it will retry failed images)
2. Manually download specific images if needed

### Disk Space Issues

If you run out of space:
1. Free up disk space
2. Delete partial downloads: `rm -rf src/assets/images/yugi/*.jpg`
3. Run the script again

### Network Issues

If you have unstable internet:
- The script will retry failed downloads automatically
- Consider downloading in smaller batches during stable periods
- The script can be safely interrupted and resumed

## Updating Images

To get new card images when YGOPRODeck adds new cards:

```bash
npm run download-yugioh-images
```

The script will only download new cards and skip existing ones.

## Manual Download (Alternative)

If you prefer to download manually:

1. Go to [YGOPRODeck Download Page](https://db.ygoprodeck.com/card-images/)
2. Download the image pack
3. Extract to `src/assets/images/yugi/`
4. Organize into subdirectories (normal, small, cropped)

## Post-Download

### Verify App Functionality

After downloading, test the app:
1. Open Yu-Gi-Oh! app
2. Search for cards
3. Verify images load from local files
4. Check card detail modal shows full images

### Performance

With local images:
- ✅ Instant image loading
- ✅ No network requests for images
- ✅ Works offline
- ✅ Faster page navigation

## Git Considerations

Images are excluded from git via `.gitignore`:
- Images are NOT committed to repository
- Each developer/deployment must download images separately
- Keeps repository size manageable

## Deployment

For production deployment:

### Option 1: Download During Build
Add to your CI/CD pipeline:
```bash
npm run download-yugioh-images
```

### Option 2: Pre-downloaded Package
1. Download images once
2. Create a compressed archive
3. Upload to cloud storage (S3, CDN)
4. Download during deployment

### Option 3: Separate CDN
1. Upload images to your own CDN
2. Update `IMAGE_BASE_URL` in `yugioh.service.ts`
3. Serve from your CDN

## Maintenance

### Periodic Updates

Run monthly to get new cards:
```bash
npm run download-yugioh-images
```

### Storage Monitoring

Monitor disk usage:
```bash
du -sh src/assets/images/yugi/
```

### Cleanup Old Images

To remove all images and re-download:
```bash
rm -rf src/assets/images/yugi/*.jpg
rm -rf src/assets/images/yugi/small/*.jpg
rm -rf src/assets/images/yugi/cropped/*.jpg
npm run download-yugioh-images
```

## License & Attribution

- **Images**: © Konami Digital Entertainment
- **Source**: YGOPRODeck (https://ygoprodeck.com/)
- **Terms**: Follow YGOPRODeck API guidelines
- **Attribution**: Credit YGOPRODeck in your app

## Support

For issues with the download script:
1. Check network connection
2. Verify disk space
3. Review console error messages
4. Check YGOPRODeck API status

For API-related issues:
- Visit: https://ygoprodeck.com/api-guide/
- Discord: YGOPRODeck community

## Summary

```bash
# Download all images (one command)
npm run download-yugioh-images

# Expected: 3.9 GB download
# Time: 30 minutes to 6 hours depending on connection
# Result: 13,000+ cards with 3 image sizes each
```

That's it! Your Yu-Gi-Oh! app will now use local images for better performance and compliance with API guidelines.

