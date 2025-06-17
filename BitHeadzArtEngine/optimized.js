/*************************************************************
 * BitHeadzArtEngine - Optimized NFT Art Generator
 * 
 * CURRENT FUNCTIONALITY & FEATURES:
 * 
 * 1. LAYER ORGANIZATION:
 *    - Expects layers in folders with numeric prefixes (e.g., "01_Background", "02_Base")
 *    - Automatically detects layer order from folder names
 *    - Supports any number of layers and trait categories
 * 
 * 2. TRAIT SELECTION & RARITY:
 *    - Bell-curve distribution for natural rarity distribution
 *    - Configurable layer probabilities (0-100%)
 *    - Optional layers (Gear, Buttons) with configurable chances
 *    - Duplicate prevention with combination tracking
 *    - Maximum 5 attempts per NFT to ensure uniqueness
 * 
 * 3. IMAGE PROCESSING:
 *    - 1000x1000 pixel output resolution
 *    - PNG format with optimized compression
 *    - Memory-efficient image caching
 *    - Streaming image processing for large collections
 * 
 * 4. PERFORMANCE OPTIMIZATIONS:
 *    - Batch processing with adaptive batch sizes:
 *      * Small collections (1-500): 2 NFTs per batch
 *      * Medium collections (501-2000): 4 NFTs per batch
 *      * Large collections (2001-5000): 6 NFTs per batch
 *      * Extra large (5000+): 8 NFTs per batch
 *    - Memory management with automatic cleanup
 *    - Parallel processing with controlled concurrency
 *    - Optimized file I/O with streaming
 * 
 * 5. CONFIGURATION OPTIONS:
 *    - Collection size (1-10,000 NFTs)
 *    - Collection name and description
 *    - Custom CID for metadata
 *    - Active layer configuration with probabilities
 *    - Rarity mode selection
 *    - Progress callback for real-time updates
 * 
 * 6. OUTPUT STRUCTURE:
 *    - /images/ - Generated NFT images (1.png, 2.png, etc.)
 *    - /metadata/ - JSON metadata files (1.json, 2.json, etc.)
 *    - Metadata includes: name, description, image URI, attributes
 * 
 * 7. ERROR HANDLING:
 *    - Graceful failure handling for missing layers
 *    - Memory cleanup on errors
 *    - Detailed error logging
 *    - Fallback mechanisms for corrupted images
 * 
 * 8. MEMORY MANAGEMENT:
 *    - Automatic memory clearing every 50 operations
 *    - Image cache with size limits
 *    - Canvas cleanup after each NFT
 *    - Garbage collection when available
 * 
 * USAGE EXAMPLE:
 * const result = await generateCollectionWithLayersOptimized({
 *   layersDir: "/path/to/layers",
 *   outputDir: "/path/to/output",
 *   collectionSize: 100,
 *   collectionName: "My Collection",
 *   collectionDescription: "A unique NFT collection",
 *   activeLayers: {
 *     "Background": { active: true, probability: 100 },
 *     "Gear": { active: true, probability: 50 }
 *   },
 *   onProgress: (progress, message, details) => {
 *     console.log(`${progress}% - ${message}`);
 *   }
 * });
 * 
 * LAYER STRUCTURE EXPECTED:
 * /layers/
 *   01_Background/
 *     - background1.png
 *     - background2.png
 *   02_Base/
 *     - base1.png
 *     - base2.png
 *   03_Eyes/
 *     - eyes1.png
 *     - eyes2.png
 *   ... (any number of layers)
 * 
 * Key optimizations:
 * - Streaming image processing
 * - Memory-efficient batch processing
 * - Reduced canvas operations
 * - Optimized file I/O
 * - Smart garbage collection
 * - Parallel processing with controlled concurrency
 *************************************************************/

import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { pipeline } from "stream/promises";
import os from 'os';

// Optimized settings for energy efficiency
const optimizedSettings = {
  width: 1000,
  height: 1000,
  gearChance: 0.5,
  buttonsChance: 0.3,
  // Always use low memory settings for better compatibility
  maxConcurrentImages: 2,
  memoryClearThreshold: 50,
  batchSize: {
    small: 2,    // 1-500 NFTs
    medium: 4,   // 501-2000 NFTs
    large: 6,    // 2001-5000 NFTs
    xlarge: 8    // 5000+ NFTs
  }
};

/***************************************************************
 * Global state with memory management
 ***************************************************************/
const usedCombinations = new Set();
const usageCounts = {};
const imageCache = new Map(); // Cache loaded images for reuse
let memoryUsageCounter = 0;

/***************************************************************
 * Memory management utilities
 ***************************************************************/
function clearMemory() {
  console.log('Optimized Engine: Clearing memory...');
  
  // Clear image cache
  imageCache.forEach((image, key) => {
    if (image && image.src) {
      image.src = null;
    }
  });
  imageCache.clear();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Reset counter
  memoryUsageCounter = 0;
  
  // Small delay to allow cleanup
  return new Promise(resolve => setTimeout(resolve, 50));
}

function getOptimalBatchSize(collectionSize) {
  if (collectionSize <= 500) return optimizedSettings.batchSize.small;
  if (collectionSize <= 2000) return optimizedSettings.batchSize.medium;
  if (collectionSize <= 5000) return optimizedSettings.batchSize.large;
  return optimizedSettings.batchSize.xlarge;
}

/***************************************************************
 * Optimized random normal distribution
 ***************************************************************/
function randomNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/***************************************************************
 * Optimized trait selection with bell curve
 ***************************************************************/
function pickTraitBellCurve(filenames) {
  const N = filenames.length;
  const mean = (N - 1) / 2;
  const stdev = N / 6;
  let idx;
  do {
    const z = randomNormal();
    const val = z * stdev + mean;
    idx = Math.round(val);
  } while (idx < 0 || idx >= N);
  return filenames[idx];
}

/***************************************************************
 * Optimized image loading with caching
 ***************************************************************/
async function loadImageOptimized(filepath) {
  const cacheKey = filepath;
  
  // Check cache first
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  // Load image if not cached
  const image = await loadImage(filepath);
  
  // Cache the image (limit cache size)
  if (imageCache.size < optimizedSettings.maxConcurrentImages * 10) {
    imageCache.set(cacheKey, image);
  }
  
  return image;
}

/***************************************************************
 * Optimized layer drawing with reduced canvas operations
 ***************************************************************/
async function drawLayersOptimized(chosenLayers, settings) {
  const canvas = createCanvas(settings.width, settings.height);
  const ctx = canvas.getContext("2d");

  // Clear canvas once
  ctx.clearRect(0, 0, settings.width, settings.height);

  try {
    // Process layers sequentially to reduce memory pressure
    for (const layerObj of chosenLayers) {
      const img = await loadImageOptimized(layerObj.filepath);
      ctx.drawImage(img, 0, 0, settings.width, settings.height);
    }
    
    return canvas;
  } catch (error) {
    // Clean up canvas on error
    canvas.width = 0;
    canvas.height = 0;
    throw error;
  }
}

/***************************************************************
 * Optimized NFT generation with better uniqueness handling
 ***************************************************************/
async function generateOneNFTOptimized(edition, layersOrder, settings, onProgress) {
  let chosenLayers;
  let combinationKey = "";
  let attempts = 0;
  const maxAttempts = 5; // Reduced from 10 to save energy

  do {
    chosenLayers = [];
    combinationKey = "";

    for (const { folder } of layersOrder) {
      // Check if this layer is active and should be included
      const layerName = folder.replace(/^\d+_/, "");
      const layerConfig = settings.activeLayers[layerName];
      
      // Check if layer is active and determine probability
      let shouldInclude = true;
      let layerProbability = 1.0;
      
      if (layerConfig && typeof layerConfig === 'object') {
        if (layerConfig.active !== undefined) {
          shouldInclude = layerConfig.active;
          layerProbability = layerConfig.probability ? layerConfig.probability / 100 : 1.0;
        }
      } else if (settings.activeLayers[layerName] !== undefined) {
        shouldInclude = settings.activeLayers[layerName];
        layerProbability = shouldInclude ? 1.0 : 0.0;
      }
      
      // Skip layer if not active
      if (!shouldInclude) continue;
      
      // Apply probability
      if (Math.random() > layerProbability) continue;

      const folderPath = path.join(settings.layersDir, folder);
      
      if (!fs.existsSync(folderPath)) continue;

      const files = fs
        .readdirSync(folderPath)
        .filter((f) => f.toLowerCase().endsWith(".png"))
        .sort();

      if (files.length === 0) continue;

      // Pick a file using the specified rarity mode
      let pickedFile;
      switch (settings.rarityMode) {
        case 'bell-curve':
          pickedFile = pickTraitBellCurve(files);
          break;
        case 'random':
          pickedFile = files[Math.floor(Math.random() * files.length)];
          break;
        case 'equal':
          pickedFile = files[Math.floor(Math.random() * files.length)];
          break;
        default:
          pickedFile = pickTraitBellCurve(files);
      }

      chosenLayers.push({
        layerName,
        filename: pickedFile,
        filepath: path.join(folderPath, pickedFile),
      });

      combinationKey += `${layerName}:${pickedFile}|`;
    }

    attempts++;
  } while (usedCombinations.has(combinationKey) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    console.warn(`Max attempts reached for NFT #${edition}. Using current combination.`);
    // Don't add to used combinations if we're forcing this one
    // This allows for some duplicates when variety is limited
  } else {
    usedCombinations.add(combinationKey);
  }

  // Update usage counts
  chosenLayers.forEach(({ layerName, filename }) => {
    if (!usageCounts[layerName]) {
      usageCounts[layerName] = {};
    }
    if (!usageCounts[layerName][filename]) {
      usageCounts[layerName][filename] = 0;
    }
    usageCounts[layerName][filename] += 1;
  });

  // Composite final image
  const canvas = await drawLayersOptimized(chosenLayers, settings);
  
  // Create metadata
  const metadata = {
    name: `${settings.collectionName} #${edition}`,
    description: settings.collectionDescription,
    image: settings.customCID 
      ? `ipfs://${settings.customCID}/${edition}.png`
      : `${edition}.png`,
    attributes: chosenLayers.map(({ layerName, filename }) => ({
      trait_type: layerName,
      value: filename.replace('.png', '')
    }))
  };

  return {
    edition,
    canvas,
    metadata,
    chosenLayers
  };
}

/***************************************************************
 * Optimized batch processing with controlled concurrency
 ***************************************************************/
async function generateBatchOptimized(batch, layersOrder, settings, onProgress) {
  const results = [];
  const batchSize = batch.length;
  
  // Process batch with controlled concurrency
  const concurrency = Math.min(optimizedSettings.maxConcurrentImages, batchSize);
  
  for (let i = 0; i < batchSize; i += concurrency) {
    const chunk = batch.slice(i, i + concurrency);
    const chunkPromises = chunk.map(edition => 
      generateOneNFTOptimized(edition, layersOrder, settings, onProgress)
    );
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    
    // Increment memory counter
    memoryUsageCounter += chunk.length;
    
    // Clear memory if threshold reached
    if (memoryUsageCounter >= optimizedSettings.memoryClearThreshold) {
      await clearMemory();
    }
  }
  
  return results;
}

/***************************************************************
 * Optimized collection generation with streaming
 ***************************************************************/
async function generateCollectionOptimized(total, layersOrder, settings, onProgress) {
  let totalGenerated = 0;
  const batchSize = getOptimalBatchSize(total);
  
  console.log(`Optimized Engine: Using batch size ${batchSize} for collection of ${total} NFTs`);

  // Report initial progress
  if (onProgress) {
    onProgress(0, 'Starting optimized generation...', `Preparing to generate ${total} NFTs`);
  }

  // Generate in optimized batches
  for (let current = 1; current <= total; current += batchSize) {
    const end = Math.min(current + batchSize - 1, total);
    const batch = [];
    
    for (let i = current; i <= end; i++) {
      batch.push(i);
    }

    console.log(`Optimized Engine: Generating NFTs ${current} to ${end}...`);
    
    const batchResults = await generateBatchOptimized(batch, layersOrder, settings, onProgress);
    
    // Save batch results with streaming
    await saveBatchResultsOptimized(batchResults, settings);
    
    totalGenerated += batch.length;

    // Update progress
    if (onProgress) {
      const progress = (totalGenerated / total) * 100;
      const message = `Generated ${totalGenerated}/${total} NFTs`;
      const details = `Batch ${current}-${end} completed`;
      
      onProgress(progress, message, details);
      console.log(`Optimized Engine: Progress: ${totalGenerated}/${total} (${progress.toFixed(1)}%)`);
    }
  }

  // Final memory cleanup
  await clearMemory();
  
  return totalGenerated;
}

/***************************************************************
 * Optimized batch saving with streaming
 ***************************************************************/
async function saveBatchResultsOptimized(batchResults, settings) {
  const imagesDir = path.join(settings.outputDir, "images");
  const metadataDir = path.join(settings.outputDir, "metadata");
  
  // Ensure directories exist
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(metadataDir, { recursive: true });
  
  // Use Promise.allSettled for better error handling and parallel processing
  const savePromises = batchResults.map(async ({ edition, canvas, metadata }) => {
    try {
      // Save image with optimized settings
      const imagePath = path.join(imagesDir, `${edition}.png`);
      const imageStream = canvas.createPNGStream({ 
        compressionLevel: 6, // Balanced compression
        filters: canvas.PNG_FILTER_NONE // Faster encoding
      });
      const writeStream = fs.createWriteStream(imagePath, {
        highWaterMark: 64 * 1024 // 64KB buffer for better performance
      });
      
      await pipeline(imageStream, writeStream);
      
      // Save metadata with synchronous write for small files (faster)
      const metadataPath = path.join(metadataDir, `${edition}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Clear canvas to free memory immediately
      canvas.width = 0;
      canvas.height = 0;
      
    } catch (error) {
      console.error(`Error saving NFT ${edition}:`, error);
      throw error;
    }
  });
  
  // Wait for all saves to complete with better error handling
  const results = await Promise.allSettled(savePromises);
  
  // Check for any failures
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length > 0) {
    console.error(`NFT Generator: ${failures.length} files failed to save`);
    throw new Error(`${failures.length} files failed to save`);
  }
}

/***************************************************************
 * Main optimized generation function
 ***************************************************************/
async function generateCollectionWithLayersOptimized(config) {
  const {
    layersDir,
    outputDir,
    collectionSize = 100,
    collectionName = "MyNFT",
    collectionDescription = "A unique NFT collection",
    customCID = "",
    rarityMode = "bell-curve",
    activeLayers = {},
    allowDuplicates = false,
    onProgress
  } = config;

  // Reset global state
  usedCombinations.clear();
  Object.keys(usageCounts).forEach(key => delete usageCounts[key]);
  imageCache.clear();
  memoryUsageCounter = 0;

  // Create output directories
  const imagesDir = path.join(outputDir, "images");
  const metadataDir = path.join(outputDir, "metadata");
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(metadataDir, { recursive: true });

  // Detect layer structure
  const layersOrder = detectLayerStructure(layersDir);
  
  if (layersOrder.length === 0) {
    throw new Error("No valid layers found in the layers directory");
  }

  // Initialize usage counts for each layer
  layersOrder.forEach(({ folder }) => {
    const layerName = folder.replace(/^\d+_/, "");
    usageCounts[layerName] = {};
  });

  // Settings object
  const settings = {
    ...optimizedSettings,
    layersDir,
    outputDir,
    collectionName,
    collectionDescription,
    customCID,
    rarityMode,
    activeLayers
  };

  // Process active layers configuration
  if (activeLayers) {
    Object.keys(activeLayers).forEach(layerName => {
      const layerConfig = activeLayers[layerName];
      if (layerConfig && typeof layerConfig === 'object') {
        // New probability-based system is handled in generateOneNFTOptimized
        // No need for legacy gear/buttons handling here
      }
    });
  }

  console.log(`Optimized Engine: Starting generation of ${collectionSize} NFTs...`);
  console.log(`Optimized Engine: Layers detected: ${layersOrder.map(l => l.folder).join(', ')}`);

  // Strict uniqueness enforcement
  const maxCombinations = calculateMaxCombinations(layersOrder, settings);
  if (!allowDuplicates && collectionSize > maxCombinations) {
    throw new Error(`Requested collection size (${collectionSize}) exceeds the maximum number of unique combinations possible with the uploaded layers (${maxCombinations}). Please upload more trait variations or reduce the collection size.`);
  }

  // Generate collection with optimized processing
  const totalGenerated = await generateCollectionOptimized(
    collectionSize,
    layersOrder,
    settings,
    onProgress
  );

  console.log(`Optimized Engine: Generation completed! Generated ${totalGenerated} NFTs.`);
  console.log("Optimized Engine: Usage counts:", usageCounts);

  return {
    totalGenerated,
    usageCounts,
    layersOrder: layersOrder.map(l => l.folder)
  };
}

/***************************************************************
 * Detect layer structure from directory
 ***************************************************************/
function detectLayerStructure(layersDir) {
  if (!fs.existsSync(layersDir)) {
    return [];
  }

  const items = fs.readdirSync(layersDir, { withFileTypes: true });
  const layerFolders = items
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .filter(name => /^\d+_/.test(name))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/^(\d+)/)[1]);
      const bNum = parseInt(b.match(/^(\d+)/)[1]);
      return aNum - bNum;
    })
    .map(folder => ({ folder }));

  return layerFolders;
}

// Utility to calculate the maximum number of unique combinations
function calculateMaxCombinations(layersOrder, settings) {
  let total = 1;
  for (const { folder } of layersOrder) {
    const layerName = folder.replace(/^[0-9]+_/, "");
    const layerConfig = settings.activeLayers[layerName];
    let shouldInclude = true;
    let layerProbability = 1.0;
    if (layerConfig && typeof layerConfig === 'object') {
      if (layerConfig.active !== undefined) {
        shouldInclude = layerConfig.active;
        layerProbability = layerConfig.probability ? layerConfig.probability / 100 : 1.0;
      }
    } else if (settings.activeLayers[layerName] !== undefined) {
      shouldInclude = settings.activeLayers[layerName];
      layerProbability = shouldInclude ? 1.0 : 0.0;
    }
    if (!shouldInclude || layerProbability === 0) continue;
    const folderPath = path.join(settings.layersDir, folder);
    if (!fs.existsSync(folderPath)) continue;
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => f.toLowerCase().endsWith(".png"));
    // The expected number of files that will be included, on average, is files.length * layerProbability
    // But for strict uniqueness, we must assume all files could be chosen
    if (files.length === 0) continue;
    total *= files.length;
  }
  return total;
}

export {
  generateCollectionWithLayersOptimized
}; 