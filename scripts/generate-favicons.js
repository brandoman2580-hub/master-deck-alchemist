// NOTE: Script to generate multi-resolution favicon files from SVG
// Run: node scripts/generate-favicons.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputSvg = path.join(__dirname, '../app/icon.svg');
const outputDir = path.join(__dirname, '../app');

async function generateFavicons() {
  try {
    console.log('Generating favicon files from', inputSvg);

    // Generate PNG files
    const sizes = [16, 32, 48, 64, 128, 256];
    
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `favicon-${size}x${size}.png`);
      await sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${outputPath}`);
    }

    // Generate ICO file (using 32x32 as base)
    // Note: ICO format requires special handling, using 32x32 PNG as fallback
    const icoPath = path.join(outputDir, 'favicon.ico');
    await sharp(inputSvg)
      .resize(32, 32)
      .png()
      .toFile(icoPath);
    console.log(`✓ Generated ${icoPath} (32x32 PNG format)`);

    console.log('\n✅ All favicon files generated successfully!');
    console.log('\nNote: For a proper multi-resolution ICO file, use a tool like:');
    console.log('  npx png2icons app/favicon-32x32.png app/favicon.ico --icon');
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();

