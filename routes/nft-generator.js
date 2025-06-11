const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
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
    files: 100 // Max 100 files
  },
  fileFilter: function (req, file, cb) {
    // Only allow PNG files
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG files are allowed'), false);
    }
  }
});

// Store generation jobs
const generationJobs = new Map();

// Upload layers and start generation
router.post('/generate', upload.array('layers'), async (req, res) => {
  try {
    console.log('NFT Generator: Starting generation process');
    
    const { collectionName, collectionSize, collectionDescription, rarityMode, optionalLayers } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!collectionName || !collectionSize) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const size = parseInt(collectionSize);
    if (size < 1 || size > 10000) {
      return res.status(400).json({ error: 'Invalid collection size' });
    }

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
      files: files.map(f => ({
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
    const { generateCollectionWithLayers } = require('../BitHeadzArtEngine/index.js');

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
  const layerStructure = [];
  const layerGroups = new Map();

  // Group files by layer name
  files.forEach(file => {
    const layerName = extractLayerName(file.originalname);
    if (!layerGroups.has(layerName)) {
      layerGroups.set(layerName, []);
    }
    layerGroups.get(layerName).push(file);
  });

  // Create layer directories and move files
  layerGroups.forEach((files, layerName) => {
    const layerDir = path.join(layersDir, layerName);
    fs.mkdirSync(layerDir, { recursive: true });

    files.forEach(file => {
      const destPath = path.join(layerDir, file.originalname);
      fs.copyFileSync(file.path, destPath);
    });

    layerStructure.push({
      name: layerName,
      count: files.length,
      path: layerDir
    });
  });

  return layerStructure.sort((a, b) => {
    const aOrder = getLayerOrder(a.name);
    const bOrder = getLayerOrder(b.name);
    return aOrder - bOrder;
  });
}

// Extract layer name from filename
function extractLayerName(fileName) {
  const prefixMatch = fileName.match(/^(\d+)_(.+?)(?:\.png)?$/i);
  if (prefixMatch) {
    return prefixMatch[2].replace(/[^a-zA-Z0-9]/g, '_');
  }
  return fileName.replace(/\.png$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
}

// Get layer order from name
function getLayerOrder(layerName) {
  const match = layerName.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 999;
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

module.exports = router; 