// Test script for large collection generation
import { generateCollectionWithLayers } from './BitHeadzArtEngine/index.js';
import path from 'path';
import fs from 'fs';

async function testLargeCollection() {
  console.log('Testing large collection generation...');
  
  // Create test layers directory
  const testLayersDir = path.join(process.cwd(), 'test-layers');
  const testOutputDir = path.join(process.cwd(), 'test-output');
  
  // Clean up previous test
  if (fs.existsSync(testLayersDir)) {
    fs.rmSync(testLayersDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  }
  
  // Create test layer structure
  fs.mkdirSync(testLayersDir, { recursive: true });
  
  // Create simple test layers
  const layers = ['00_Background', '01_Body', '02_Head'];
  layers.forEach((layer, index) => {
    const layerDir = path.join(testLayersDir, layer);
    fs.mkdirSync(layerDir, { recursive: true });
    
    // Create a simple colored square for each layer
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Different colors for each layer
    const colors = ['#ff0000', '#00ff00', '#0000ff'];
    ctx.fillStyle = colors[index];
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(layerDir, 'test.png'), buffer);
  });
  
  console.log('Test layers created. Starting generation...');
  
  try {
    const startTime = Date.now();
    
    const result = await generateCollectionWithLayers({
      layersDir: testLayersDir,
      outputDir: testOutputDir,
      collectionSize: 300, // Test with 300 NFTs
      collectionName: 'TestCollection',
      collectionDescription: 'Test collection for large generation',
      rarityMode: 'random',
      optionalLayers: {},
      onProgress: (progress, message, details) => {
        console.log(`Progress: ${progress.toFixed(1)}% - ${message} - ${details}`);
      }
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Generation completed successfully!`);
    console.log(`📊 Generated ${result.totalGenerated} NFTs`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📁 Output directory: ${testOutputDir}`);
    
    // Verify files were created
    const imagesDir = path.join(testOutputDir, 'images');
    const metadataDir = path.join(testOutputDir, 'metadata');
    
    const imageCount = fs.readdirSync(imagesDir).length;
    const metadataCount = fs.readdirSync(metadataDir).length;
    
    console.log(`🖼️  Images created: ${imageCount}`);
    console.log(`📄 Metadata files created: ${metadataCount}`);
    
    if (imageCount === result.totalGenerated && metadataCount === result.totalGenerated) {
      console.log('✅ All files created successfully!');
    } else {
      console.log('❌ File count mismatch!');
    }
    
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  } finally {
    // Clean up test files
    if (fs.existsSync(testLayersDir)) {
      fs.rmSync(testLayersDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    console.log('🧹 Test files cleaned up');
  }
}

// Run the test
testLargeCollection().catch(console.error); 