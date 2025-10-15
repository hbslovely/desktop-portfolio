#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Yu-Gi-Oh! Image Download Progress${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Count images
NORMAL_COUNT=$(ls -1 src/assets/images/yugi/*.jpg 2>/dev/null | wc -l | tr -d ' ')
SMALL_COUNT=$(ls -1 src/assets/images/yugi/small/*.jpg 2>/dev/null | wc -l | tr -d ' ')
CROPPED_COUNT=$(ls -1 src/assets/images/yugi/cropped/*.jpg 2>/dev/null | wc -l | tr -d ' ')

# Expected total
EXPECTED=13126

# Calculate percentage
PERCENT=$((NORMAL_COUNT * 100 / EXPECTED))

echo -e "${GREEN}Normal images:${NC}   $NORMAL_COUNT / $EXPECTED ($PERCENT%)"
echo -e "${GREEN}Small images:${NC}    $SMALL_COUNT / $EXPECTED"
echo -e "${GREEN}Cropped images:${NC} $CROPPED_COUNT / $EXPECTED"
echo ""

# Calculate disk usage
DISK_USAGE=$(du -sh src/assets/images/yugi/ 2>/dev/null | cut -f1)
echo -e "${YELLOW}Disk usage:${NC} $DISK_USAGE"
echo ""

# Progress bar
BAR_LENGTH=50
FILLED=$((NORMAL_COUNT * BAR_LENGTH / EXPECTED))
EMPTY=$((BAR_LENGTH - FILLED))

printf "${GREEN}Progress: [${NC}"
printf "%${FILLED}s" | tr ' ' '='
printf "%${EMPTY}s" | tr ' ' '-'
printf "${GREEN}] ${PERCENT}%%${NC}\n"

echo ""

# Check if complete
if [ "$NORMAL_COUNT" -ge "$EXPECTED" ]; then
    echo -e "${GREEN}✅ Download Complete!${NC}"
    echo ""
    
    # Check manifest
    if [ -f "src/assets/images/yugi/manifest.json" ]; then
        echo "Manifest file exists"
        cat src/assets/images/yugi/manifest.json
    fi
else
    echo -e "${YELLOW}⏳ Download in progress...${NC}"
    echo -e "   Estimated remaining: $((EXPECTED - NORMAL_COUNT)) cards"
fi

echo ""
echo -e "${BLUE}========================================${NC}"

