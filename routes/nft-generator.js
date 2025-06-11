import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Preserve original filename
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10000 // Increased to 10000 to handle very large collections
  }
});

// Store generation jobs
const generationJobs = new Map();

// Upload layers and start generation
router.post('/generate', upload.any(), async (req, res) => {
  try {
    console.log('NFT Generator: Starting generation process');
    
    const { collectionName, collectionSize, collectionDescription, rarityMode, optionalLayers } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Filter and validate files
    const validFiles = files.filter(file => {
      if (file.mimetype !== 'image/png') {
        console.log(`Skipping non-PNG file: ${file.originalname} (${file.mimetype})`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'No valid PNG files uploaded' });
    }

    if (!collectionName || !collectionSize) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const size = parseInt(collectionSize);
    if (size < 1 || size > 10000) {
      return res.status(400).json({ error: 'Invalid collection size' });
    }

    console.log(`NFT Generator: Processing ${validFiles.length} valid PNG files`);

    // Create generation job
    const generationId = uuidv4();
    const job = {
      id: generationId,
      status: 'processing',
      progress: 0,
      message: 'Preparing layers...',
      details: '',
      totalGenerated: 0,
      collectionName,
      collectionSize: size,
      collectionDescription,
      rarityMode,
      optionalLayers: JSON.parse(optionalLayers || '{}'),
      files: validFiles.map(f => ({
        originalname: f.originalname,
        path: f.path
      })),
      createdAt: new Date(),
      outputPath: null
    };

    generationJobs.set(generationId, job);

    // Start generation in background
    generateCollection(job);

    res.json({ 
      success: true, 
      generationId,
      message: 'Generation started successfully'
    });

  } catch (error) {
    console.error('NFT Generator Error:', error);
    res.status(500).json({ error: 'Generation failed', details: error.message });
  }
});

// Check generation status
router.get('/status/:generationId', (req, res) => {
  try {
    const { generationId } = req.params;
    const job = generationJobs.get(generationId);

    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    res.json({
      status: job.status,
      progress: job.progress,
      message: job.message,
      details: job.details,
      totalGenerated: job.totalGenerated
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Download generated collection
router.get('/download/:generationId', (req, res) => {
  try {
    const { generationId } = req.params;
    const job = generationJobs.get(generationId);

    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Generation not completed' });
    }

    if (!job.outputPath || !fs.existsSync(job.outputPath)) {
      return res.status(404).json({ error: 'Generated files not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${job.collectionName}_collection.zip"`);

    // Stream the zip file
    const fileStream = fs.createReadStream(job.outputPath);
    fileStream.pipe(res);

    // Clean up after download
    fileStream.on('end', () => {
      // Clean up files after a delay
      setTimeout(() => {
        cleanupGenerationJob(generationId);
      }, 60000); // 1 minute delay
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Background generation function
async function generateCollection(job) {
  try {
    console.log(`NFT Generator: Starting generation for job ${job.id}`);
    
    // Update status
    job.message = 'Organizing layers...';
    job.progress = 10;

    // Create temporary directory for this generation
    const tempDir = path.join(__dirname, '../temp', job.id);
    const layersDir = path.join(tempDir, 'layers');
    const outputDir = path.join(tempDir, 'output');
    const imagesDir = path.join(outputDir, 'images');
    const metadataDir = path.join(outputDir, 'metadata');

    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(layersDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.mkdirSync(metadataDir, { recursive: true });

    // Organize uploaded files into layer structure
    const layerStructure = organizeLayers(job.files, layersDir);
    
    job.message = 'Validating layer structure...';
    job.progress = 20;

    // Validate layer structure
    if (layerStructure.length === 0) {
      throw new Error('No valid layers found');
    }

    job.message = 'Generating NFTs...';
    job.progress = 30;

    // Import the BitHeadzArtEngine
    const { generateCollectionWithLayers } = await import('../BitHeadzArtEngine/index.js');

    // Generate the collection
    const generationResult = await generateCollectionWithLayers({
      layersDir,
      outputDir,
      collectionSize: job.collectionSize,
      collectionName: job.collectionName,
      collectionDescription: job.collectionDescription,
      rarityMode: job.rarityMode,
      optionalLayers: job.optionalLayers,
      onProgress: (progress, message, details) => {
        job.progress = 30 + (progress * 0.6); // 30-90% for generation
        job.message = message;
        job.details = details;
      }
    });

    job.message = 'Creating download package...';
    job.progress = 90;

    // Create zip file
    const zipPath = path.join(tempDir, `${job.collectionName}_collection.zip`);
    await createZipArchive(outputDir, zipPath);

    job.message = 'Generation completed!';
    job.progress = 100;
    job.status = 'completed';
    job.totalGenerated = generationResult.totalGenerated;
    job.outputPath = zipPath;
    job.details = `Generated ${generationResult.totalGenerated} NFTs successfully`;

    console.log(`NFT Generator: Generation completed for job ${job.id}`);

  } catch (error) {
    console.error(`NFT Generator: Generation failed for job ${job.id}:`, error);
    job.status = 'failed';
    job.message = 'Generation failed';
    job.details = error.message;
  }
}

// Organize uploaded files into layer structure
function organizeLayers(files, layersDir) {
  console.log(`NFT Generator: Organizing ${files.length} files into layers...`);
  
  const layerStructure = [];
  const layerGroups = new Map();

  // Group files by layer name and extract layer order
  files.forEach(file => {
    const layerInfo = extractLayerInfo(file.originalname);
    console.log(`NFT Generator: File "${file.originalname}" -> Layer: ${layerInfo.name}, Order: ${layerInfo.order}`);
    
    if (!layerGroups.has(layerInfo.name)) {
      layerGroups.set(layerInfo.name, {
        order: layerInfo.order,
        files: []
      });
    }
    layerGroups.get(layerInfo.name).files.push(file);
  });

  console.log(`NFT Generator: Found ${layerGroups.size} layer groups:`);
  layerGroups.forEach((layerData, layerName) => {
    console.log(`  - ${layerName}: ${layerData.files.length} files, order ${layerData.order}`);
  });

  // Create layer directories and move files
  layerGroups.forEach((layerData, layerName) => {
    // Create folder with numeric prefix based on layer order
    const folderName = `${layerData.order.toString().padStart(2, '0')}_${layerName}`;
    const layerDir = path.join(layersDir, folderName);
    fs.mkdirSync(layerDir, { recursive: true });

    console.log(`NFT Generator: Creating layer directory: ${folderName}`);

    layerData.files.forEach(file => {
      // Extract just the filename from the path (e.g., "H_Green_Ball.png" from "02_Head/H_Green_Ball.png")
      const fileName = file.originalname.split('/').pop();
      const destPath = path.join(layerDir, fileName);
      fs.copyFileSync(file.path, destPath);
    });

    layerStructure.push({
      name: layerName,
      count: layerData.files.length,
      path: layerDir,
      folder: folderName,
      order: layerData.order
    });
  });

  const sortedStructure = layerStructure.sort((a, b) => a.order - b.order);
  console.log(`NFT Generator: Final layer structure:`);
  sortedStructure.forEach(layer => {
    console.log(`  - ${layer.folder}: ${layer.count} files`);
  });

  return sortedStructure;
}

// Extract layer name and order from filename
function extractLayerInfo(fileName) {
  // Handle file paths like "02_Head/H_Green_Ball.png"
  const pathParts = fileName.split('/');
  if (pathParts.length > 1) {
    // Extract from folder name (e.g., "02_Head")
    const folderName = pathParts[0];
    const prefixMatch = folderName.match(/^(\d+)_(.+)$/);
    if (prefixMatch) {
      return {
        name: prefixMatch[2], // Return "Head" from "02_Head"
        order: parseInt(prefixMatch[1])
      };
    }
  }
  
  // Fallback to original logic for direct filenames
  const prefixMatch = fileName.match(/^(\d+)_(.+?)(?:\.png)?$/i);
  if (prefixMatch) {
    return {
      name: prefixMatch[2].replace(/[^a-zA-Z0-9]/g, '_'),
      order: parseInt(prefixMatch[1])
    };
  }
  
  return {
    name: fileName.replace(/\.png$/i, '').replace(/[^a-zA-Z0-9]/g, '_'),
    order: 999
  };
}

// Create zip archive
function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Cleanup generation job
function cleanupGenerationJob(generationId) {
  try {
    const job = generationJobs.get(generationId);
    if (job) {
      // Remove temporary files
      const tempDir = path.join(__dirname, '../temp', generationId);
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      // Remove job from memory
      generationJobs.delete(generationId);
      console.log(`NFT Generator: Cleaned up job ${generationId}`);
    }
  } catch (error) {
    console.error(`NFT Generator: Cleanup error for job ${generationId}:`, error);
  }
}

// Cleanup old jobs periodically
setInterval(() => {
  const now = new Date();
  generationJobs.forEach((job, id) => {
    const age = now - job.createdAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (age > maxAge) {
      cleanupGenerationJob(id);
    }
  });
}, 60 * 60 * 1000); // Check every hour

export default router; 