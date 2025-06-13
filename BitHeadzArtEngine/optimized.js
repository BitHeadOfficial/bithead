/*************************************************************
 * optimized.js - Energy-Efficient NFT Art Generator
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
  // Memory management settings
  maxConcurrentImages: 4, // Limit concurrent image loading
  memoryClearThreshold: 100, // Clear memory every 100 NFTs
  batchSize: {
    small: 5,    // 1-500 NFTs
    medium: 10,  // 501-2000 NFTs
    large: 15,   // 2001-5000 NFTs
    xlarge: 20   // 5000+ NFTs
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

      // Legacy optional layer handling
      if (folder === "05_Gear" && Math.random() > settings.gearChance) continue;
      if (folder === "07_Buttons" && Math.random() > settings.buttonsChance) continue;

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
  }
  usedCombinations.add(combinationKey);

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
  
  // Save results in parallel with controlled concurrency
  const savePromises = batchResults.map(async ({ edition, canvas, metadata }) => {
    try {
      // Save image
      const imagePath = path.join(imagesDir, `${edition}.png`);
      const imageStream = canvas.createPNGStream({ compressionLevel: 6 });
      const writeStream = fs.createWriteStream(imagePath);
      
      await pipeline(imageStream, writeStream);
      
      // Save metadata
      const metadataPath = path.join(metadataDir, `${edition}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Clear canvas to free memory
      canvas.width = 0;
      canvas.height = 0;
      
    } catch (error) {
      console.error(`Error saving NFT ${edition}:`, error);
      throw error;
    }
  });
  
  await Promise.all(savePromises);
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
        if (layerConfig.active !== undefined) {
          const probability = layerConfig.probability ? layerConfig.probability / 100 : 1;
          
          if (layerName.toLowerCase().includes('gear')) {
            settings.gearChance = layerConfig.active ? probability : 0;
          } else if (layerName.toLowerCase().includes('buttons')) {
            settings.buttonsChance = layerConfig.active ? probability : 0;
          }
        }
      } else {
        const layerFolder = layersOrder.find(l => l.folder.includes(layerName));
        if (layerFolder) {
          if (layerFolder.folder.includes('Gear')) {
            settings.gearChance = activeLayers[layerName] ? 0.5 : 0;
          } else if (layerFolder.folder.includes('Buttons')) {
            settings.buttonsChance = activeLayers[layerName] ? 0.3 : 0;
          }
        }
      }
    });
  }

  console.log(`Optimized Engine: Starting generation of ${collectionSize} NFTs...`);
  console.log(`Optimized Engine: Layers detected: ${layersOrder.map(l => l.folder).join(', ')}`);

  setOptimizedSettings({ lowMemoryMode: config.lowMemoryMode || process.env.LOW_MEMORY_MODE === 'true' });

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

export function setOptimizedSettings({ lowMemoryMode = false } = {}) {
  const totalMemGB = os.totalmem() / (1024 ** 3);
  const cpuCount = os.cpus().length;
  if (lowMemoryMode || totalMemGB < 8) {
    optimizedSettings.maxConcurrentImages = 2;
    optimizedSettings.memoryClearThreshold = 50;
    optimizedSettings.batchSize = { small: 2, medium: 4, large: 6, xlarge: 8 };
  } else if (totalMemGB < 16 || cpuCount <= 4) {
    optimizedSettings.maxConcurrentImages = 3;
    optimizedSettings.memoryClearThreshold = 75;
    optimizedSettings.batchSize = { small: 3, medium: 6, large: 10, xlarge: 12 };
  } else {
    optimizedSettings.maxConcurrentImages = 4;
    optimizedSettings.memoryClearThreshold = 100;
    optimizedSettings.batchSize = { small: 5, medium: 10, large: 15, xlarge: 20 };
  }
}

export {
  generateCollectionWithLayersOptimized
}; 