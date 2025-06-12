/*************************************************************
 * index.js - NFT Art Generator with Bell-Curve Rarity,
 *            Optional Gear, Optional Buttons, Unique Combinations,
 *            and Trait Usage Counts.
 *************************************************************/

const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

// Default settings
const defaultSettings = {
  width: 1000,
  height: 1000,
  gearChance: 0.5,
  buttonsChance: 0.3
};

/***************************************************************
 * Global sets/maps to ensure uniqueness & track usage
 ***************************************************************/
const usedCombinations = new Set();

// usageCounts will store an object like:
// usageCounts[layerName][filename] = numberOfTimesUsed
const usageCounts = {};

/***************************************************************
 * 1) randomNormal - generates standard normal (mean=0, stdev=1)
 ***************************************************************/
function randomNormal() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/***************************************************************
 * 2) pickTraitBellCurve - picks index from filenames using bell curve
 *
 * The bell curve approach uses a random normal value to choose
 * traits near the middle of the sorted array more often.
 ***************************************************************/
function pickTraitBellCurve(filenames) {
  const N = filenames.length;
  const mean = (N - 1) / 2;
  const stdev = N / 6; // adjust if you want narrower or wider distribution
  let idx;
  do {
    const z = randomNormal();
    const val = z * stdev + mean;
    idx = Math.round(val);
  } while (idx < 0 || idx >= N);
  return filenames[idx];
}

/***************************************************************
 * 3) drawLayers - composites each chosen layer's PNG in order
 ***************************************************************/
async function drawLayers(chosenLayers, settings) {
  const canvas = createCanvas(settings.width, settings.height);
  const ctx = canvas.getContext("2d");
  
  // Clear canvas first
  ctx.clearRect(0, 0, settings.width, settings.height);

  try {
    for (const layerObj of chosenLayers) {
      const img = await loadImage(layerObj.filepath);
      ctx.drawImage(img, 0, 0, settings.width, settings.height);
      
      // Clear image reference to help garbage collection
      img.src = null;
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
 * 4) generateOneNFT - picks traits, ensures uniqueness, draws, logs usage
 ***************************************************************/
async function generateOneNFT(edition, layersOrder, settings, onProgress) {
  let chosenLayers;
  let combinationKey = "";
  let attempts = 0;

  do {
    chosenLayers = [];
    combinationKey = "";

    for (const { folder } of layersOrder) {
      // Check if this layer is active and should be included
      const layerName = folder.replace(/^\d+_/, "");
      const layerConfig = settings.activeLayers[layerName];
      
      // Check if layer is active and determine probability
      let shouldInclude = true;
      let layerProbability = 1.0; // 100% by default
      
      if (layerConfig && typeof layerConfig === 'object') {
        // New format with active and probability
        if (layerConfig.active !== undefined) {
          shouldInclude = layerConfig.active;
          layerProbability = layerConfig.probability ? layerConfig.probability / 100 : 1.0;
        }
      } else if (settings.activeLayers[layerName] !== undefined) {
        // Legacy format (boolean)
        shouldInclude = settings.activeLayers[layerName];
        layerProbability = shouldInclude ? 1.0 : 0.0;
      }
      
      // Skip layer if not active
      if (!shouldInclude) {
        continue;
      }
      
      // Apply probability (e.g., 50% chance for this layer)
      if (Math.random() > layerProbability) {
        continue;
      }
      
      // Legacy optional layer handling for backward compatibility
      if (folder === "05_Gear" && Math.random() > settings.gearChance) {
        continue;
      }
      if (folder === "07_Buttons" && Math.random() > settings.buttonsChance) {
        continue;
      }

      const folderPath = path.join(settings.layersDir, folder);
      
      // Check if folder exists
      if (!fs.existsSync(folderPath)) {
        continue;
      }

      const files = fs
        .readdirSync(folderPath)
        .filter((f) => f.toLowerCase().endsWith(".png"))
        .sort();

      if (files.length === 0) {
        continue;
      }

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
    // If combination is already used, try again up to 10 times
  } while (usedCombinations.has(combinationKey) && attempts < 10);

  if (attempts >= 10) {
    console.warn(
      `Max attempts reached for NFT #${edition}. Using current combination.`
    );
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

  // Composite final image from chosen layers
  const canvas = await drawLayers(chosenLayers, settings);

  // Save final image
  const imageName = `${settings.collectionName}_${edition}.png`;
  const imageOutPath = path.join(settings.outputDir, "images", imageName);
  
  try {
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(imageOutPath, buffer);
    
    // Clear canvas to free memory
    canvas.width = 0;
    canvas.height = 0;
  } catch (error) {
    console.error(`Error saving image for NFT #${edition}:`, error);
    throw error;
  }

  // Build metadata using the chosen traits
  const attributes = chosenLayers.map((layerObj) => ({
    trait_type: layerObj.layerName,
    value: layerObj.filename.replace(".png", ""),
  }));

  const metadata = {
    name: `${settings.collectionName} #${edition}`,
    description: settings.collectionDescription,
    image: settings.customCID ? `ipfs://${settings.customCID}/${imageName}` : `ipfs://CID/${imageName}`,
    attributes,
  };

  // Save metadata JSON
  const metaFile = `${settings.collectionName}_${edition}.json`;
  fs.writeFileSync(
    path.join(settings.outputDir, "metadata", metaFile),
    JSON.stringify(metadata, null, 2)
  );

  return { imageName, metaFile };
}

/***************************************************************
 * 5) generateCollectionInBatches - Process NFTs in batches with dynamic sizing
 ***************************************************************/
async function generateCollectionInBatches(total, batchSize, layersOrder, settings, onProgress) {
  let current = 1;
  let totalGenerated = 0;
  let memoryClearCounter = 0;

  // Dynamic batch sizing based on collection size - increased for better performance
  let dynamicBatchSize = batchSize;
  if (total > 5000) {
    dynamicBatchSize = 50; // Larger batches for very large collections
  } else if (total > 1000) {
    dynamicBatchSize = 25; // Medium-large batches for large collections
  } else if (total > 500) {
    dynamicBatchSize = 15; // Medium batches for medium collections
  } else if (total > 200) {
    dynamicBatchSize = 10; // Standard batches for medium collections
  }

  console.log(`Using dynamic batch size: ${dynamicBatchSize} for collection of ${total} NFTs`);

  // Report initial progress
  if (onProgress) {
    onProgress(0, 'Starting generation...', `Preparing to generate ${total} NFTs`);
  }

  while (current <= total) {
    const end = Math.min(current + dynamicBatchSize - 1, total);
    console.log(`Generating NFTs ${current} to ${end}...`);

    const batchPromises = [];
    for (let i = current; i <= end; i++) {
      batchPromises.push(generateOneNFT(i, layersOrder, settings, onProgress));
    }

    await Promise.all(batchPromises);
    totalGenerated += end - current + 1;
    memoryClearCounter += end - current + 1;

    // Update progress after EVERY batch completion
    if (onProgress) {
      const progress = (totalGenerated / total) * 100;
      const message = `Generated ${totalGenerated}/${total} NFTs`;
      const details = `Batch ${current}-${end} completed`;
      
      onProgress(progress, message, details);
      
      // Log progress for debugging
      console.log(`Progress: ${totalGenerated}/${total} (${progress.toFixed(1)}%)`);
    }

    // Clear memory every 250 NFTs like the original ArtEngine
    if (memoryClearCounter >= 250) {
      console.log('Clearing memory after 250 NFTs...');
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Reset counter
      memoryClearCounter = 0;
      
      // Small delay to allow memory cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    current = end + 1;
  }

  return totalGenerated;
}

/***************************************************************
 * 6) Main generation function with configurable parameters
 ***************************************************************/
async function generateCollectionWithLayers(config) {
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
    ...defaultSettings,
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
        // New format with active and probability
        if (layerConfig.active !== undefined) {
          // Convert probability percentage to decimal (e.g., 50% -> 0.5)
          const probability = layerConfig.probability ? layerConfig.probability / 100 : 1;
          
          // Set the chance for this layer
          if (layerName.toLowerCase().includes('gear')) {
            settings.gearChance = layerConfig.active ? probability : 0;
          } else if (layerName.toLowerCase().includes('buttons')) {
            settings.buttonsChance = layerConfig.active ? probability : 0;
          }
        }
      } else {
        // Legacy format (boolean)
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

  console.log(`Starting generation of ${collectionSize} NFTs...`);
  console.log(`Layers detected: ${layersOrder.map(l => l.folder).join(', ')}`);

  // Generate collection
  const totalGenerated = await generateCollectionInBatches(
    collectionSize,
    10, // batch size
    layersOrder,
    settings,
    onProgress
  );

  console.log(`Generation completed! Generated ${totalGenerated} NFTs.`);
  console.log("Usage counts:", usageCounts);

  return {
    totalGenerated,
    usageCounts,
    layersOrder: layersOrder.map(l => l.folder)
  };
}

/***************************************************************
 * 7) Detect layer structure from directory
 ***************************************************************/
function detectLayerStructure(layersDir) {
  if (!fs.existsSync(layersDir)) {
    return [];
  }

  const items = fs.readdirSync(layersDir, { withFileTypes: true });
  const layerFolders = items
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .filter(name => /^\d+_/.test(name)) // Only folders with numeric prefixes
    .sort((a, b) => {
      const aNum = parseInt(a.match(/^(\d+)/)[1]);
      const bNum = parseInt(b.match(/^(\d+)/)[1]);
      return aNum - bNum;
    })
    .map(folder => ({ folder }));

  return layerFolders;
}

/***************************************************************
 * 8) Legacy function for backward compatibility
 ***************************************************************/
async function generateCollection(total = 100, batchSize = 10) {
  console.warn("Warning: Using legacy generateCollection function. Use generateCollectionWithLayers for new implementations.");
  
  // Use default settings
  const config = {
    layersDir: path.join(__dirname, "Layers"),
    outputDir: path.join(__dirname, "build"),
    collectionSize: total,
    collectionName: "BitHead",
    collectionDescription: "A custom BitHead NFT with optional Gear, optional Buttons, and bell-curve rarity.",
    rarityMode: "bell-curve",
    optionalLayers: {}
  };

  return generateCollectionWithLayers(config);
}

module.exports = {
  generateCollection,
  generateCollectionWithLayers,
  detectLayerStructure,
  randomNormal,
  pickTraitBellCurve,
  drawLayers,
  generateOneNFT
};