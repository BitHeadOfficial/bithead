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

// Track active user sessions
const activeSessions = new Map();

// Cleanup function for abandoned jobs
function cleanupAbandonedJobs() {
  const now = new Date();
  const maxAge = 60 * 60 * 1000; // Extended to 60 minutes for large collections
  
  generationJobs.forEach((job, id) => {
    const age = now - job.createdAt;
    if (age > maxAge) {
      console.log(`NFT Generator: Cleaning up abandoned job ${id} (age: ${Math.round(age / 1000 / 60)} minutes)`);
      cleanupGenerationJob(id);
    }
  });
}

// Cleanup function for specific job
function cleanupGenerationJob(generationId) {
  try {
    const job = generationJobs.get(generationId);
    if (job) {
      // Remove temporary files
      const tempDir = path.join(__dirname, '../temp', generationId);
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`NFT Generator: Cleaned up temp directory for job ${generationId}`);
      }

      // Remove job from memory
      generationJobs.delete(generationId);
      console.log(`NFT Generator: Cleaned up job ${generationId}`);
    }
  } catch (error) {
    console.error(`NFT Generator: Cleanup error for job ${generationId}:`, error);
  }
}

// Cancel generation endpoint
router.post('/cancel/:generationId', (req, res) => {
  try {
    const { generationId } = req.params;
    const job = generationJobs.get(generationId);

    if (!job) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    // Mark job as cancelled
    job.status = 'cancelled';
    job.message = 'Generation cancelled by user';
    job.details = 'User cancelled the generation process';

    // Clean up the job
    cleanupGenerationJob(generationId);

    res.json({ 
      success: true, 
      message: 'Generation cancelled successfully' 
    });

  } catch (error) {
    console.error('Cancel generation error:', error);
    res.status(500).json({ error: 'Failed to cancel generation' });
  }
});

// Upload layers and start generation
router.post('/generate', upload.any(), async (req, res) => {
  try {
    console.log('NFT Generator: Starting generation process');
    
    const { collectionName, collectionSize, collectionDescription, rarityMode, activeLayers, customCID, lowMemoryMode } = req.body;
    const files = req.files;
    const filePaths = req.body.filePaths;

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
      customCID: customCID || '',
      rarityMode,
      activeLayers: JSON.parse(activeLayers || '{}'),
      files: validFiles.map((f, index) => ({
        originalname: f.originalname,
        path: f.path,
        webkitRelativePath: filePaths && filePaths[index] ? filePaths[index] : f.originalname
      })),
      createdAt: new Date(),
      outputPath: null,
      downloadAttempted: false,
      lastDownloadAttempt: null,
      downloadCount: 0,
      lowMemoryMode
    };

    generationJobs.set(generationId, job);

    // Start generation in background with optimized settings
    generateCollectionOptimized(job);

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
      totalGenerated: job.totalGenerated,
      downloadAttempted: job.downloadAttempted || false,
      lastDownloadAttempt: job.lastDownloadAttempt,
      downloadCount: job.downloadCount || 0,
      collectionSize: job.collectionSize
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

    // Validate zip file integrity before serving
    try {
      const stats = fs.statSync(job.outputPath);
      if (stats.size === 0) {
        return res.status(500).json({ error: 'Generated zip file is corrupted (empty)' });
      }
      
      // Check if file is reasonably sized (at least 1KB for a valid zip)
      if (stats.size < 1024) {
        console.warn(`NFT Generator: Suspiciously small zip file: ${stats.size} bytes for job ${generationId}`);
      }
      
      console.log(`NFT Generator: Serving zip file: ${stats.size} bytes for job ${generationId}`);
    } catch (statError) {
      console.error(`NFT Generator: Error checking zip file stats:`, statError);
      return res.status(500).json({ error: 'Generated zip file is corrupted' });
    }

    // Track download attempt
    job.downloadAttempted = true;
    job.lastDownloadAttempt = new Date();
    job.downloadCount = (job.downloadCount || 0) + 1;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${job.collectionName}_collection.zip"`);
    res.setHeader('Content-Length', fs.statSync(job.outputPath).size);

    // Stream the zip file with error handling
    const fileStream = fs.createReadStream(job.outputPath);
    
    // Handle stream errors
    fileStream.on('error', (error) => {
      console.error(`NFT Generator: File stream error for job ${generationId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed due to file corruption' });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log(`NFT Generator: Client disconnected during download for job ${generationId}`);
      fileStream.destroy();
    });

    fileStream.pipe(res);

    // Clean up after download with extended delay for large collections
    fileStream.on('end', () => {
      console.log(`NFT Generator: Download completed for job ${generationId}`);
      
      // Calculate cleanup delay based on collection size
      const baseDelay = 5 * 60 * 1000; // 5 minutes base
      const sizeMultiplier = Math.max(1, job.collectionSize / 1000); // 1 minute per 1000 NFTs
      const cleanupDelay = Math.min(baseDelay * sizeMultiplier, 30 * 60 * 1000); // Max 30 minutes
      
      console.log(`NFT Generator: Scheduling cleanup for job ${generationId} in ${Math.round(cleanupDelay / 1000 / 60)} minutes`);
      
      setTimeout(() => {
        cleanupGenerationJob(generationId);
      }, cleanupDelay);
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Optimized generation function with energy-efficient processing
async function generateCollectionOptimized(job) {
  try {
    console.log(`NFT Generator: Starting optimized generation for job ${job.id}`);
    console.log(`NFT Generator: Job files count: ${job.files.length}`);
    console.log(`NFT Generator: Collection size: ${job.collectionSize}`);
    
    // Optimized timeout based on collection size
    const generationTimeout = Math.max(180000, job.collectionSize * 500); // Reduced from 1000ms to 500ms per NFT
    console.log(`NFT Generator: Setting optimized generation timeout to ${generationTimeout}ms`);
    
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

    console.log(`NFT Generator: Created temp directory: ${tempDir}`);

    // Organize uploaded files into layer structure
    const layerStructure = organizeLayers(job.files, layersDir);
    
    console.log(`NFT Generator: Layer structure result:`, layerStructure.map(l => `${l.folder}: ${l.count} files`));
    
    job.message = 'Validating layer structure...';
    job.progress = 20;

    // Validate layer structure
    if (layerStructure.length === 0) {
      throw new Error('No valid layers found');
    }

    job.message = 'Generating NFTs...';
    job.progress = 30;

    // Import the optimized BitHeadzArtEngine
    const { generateCollectionWithLayersOptimized } = await import('../BitHeadzArtEngine/optimized.js');

    // Generate the collection with optimized settings
    const generationPromise = generateCollectionWithLayersOptimized({
      layersDir,
      outputDir,
      collectionSize: job.collectionSize,
      collectionName: job.collectionName,
      collectionDescription: job.collectionDescription,
      customCID: job.customCID,
      rarityMode: job.rarityMode,
      activeLayers: job.activeLayers,
      lowMemoryMode: job.lowMemoryMode,
      onProgress: (progress, message, details) => {
        job.progress = progress;
        job.message = message;
        job.details = details;
        
        // Calculate totalGenerated based on progress
        job.totalGenerated = Math.floor((progress / 100) * job.collectionSize);
        
        console.log(`NFT Generator: Progress update - ${job.totalGenerated}/${job.collectionSize} (${progress.toFixed(1)}%)`);
      }
    });

    // Add timeout to generation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Generation timeout after ${generationTimeout}ms`));
      }, generationTimeout);
    });

    const generationResult = await Promise.race([generationPromise, timeoutPromise]);

    job.message = 'Creating download package...';
    job.progress = 90;

    // Create zip file with streaming for large collections
    const zipPath = path.join(tempDir, `${job.collectionName}_collection.zip`);
    await createZipArchiveOptimized(outputDir, zipPath, job.collectionSize);

    job.message = 'Generation completed!';
    job.progress = 100;
    job.status = 'completed';
    job.totalGenerated = generationResult.totalGenerated;
    job.outputPath = zipPath;
    job.details = `Generated ${generationResult.totalGenerated} NFTs successfully`;

    console.log(`NFT Generator: Generation completed for job ${job.id}`);

  } catch (error) {
    console.error(`NFT Generator: Generation failed for job ${job.id}:`, error);
    let userMessage = 'Generation failed';
    if (error.message && (error.message.includes('ENOMEM') || error.message.includes('out of memory'))) {
      userMessage = 'Generation failed: Out of memory. Try enabling Low Memory Mode or reducing collection size.';
    } else if (error.message && error.message.includes('canvas')) {
      userMessage = 'Generation failed: Canvas dependency error. Please ensure all native dependencies are installed (see README).';
    }
    job.status = 'failed';
    job.message = userMessage;
    job.details = error.message;
    
    // Clean up temporary files on failure
    try {
      const tempDir = path.join(__dirname, '../temp', job.id);
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`NFT Generator: Cleaned up temp directory for failed job ${job.id}`);
      }
    } catch (cleanupError) {
      console.error(`NFT Generator: Cleanup error for failed job ${job.id}:`, cleanupError);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}

// Organize uploaded files into layer structure
function organizeLayers(files, layersDir) {
  console.log(`NFT Generator: Organizing ${files.length} files into layers...`);
  console.log(`NFT Generator: Sample file names:`, files.slice(0, 5).map(f => f.originalname));
  console.log(`NFT Generator: Sample webkitRelativePaths:`, files.slice(0, 5).map(f => f.webkitRelativePath));
  
  const layerStructure = [];
  const layerGroups = new Map();

  // Group files by layer name and extract layer order
  files.forEach(file => {
    const layerInfo = extractLayerInfo(file.webkitRelativePath || file.originalname);
    console.log(`NFT Generator: File "${file.webkitRelativePath || file.originalname}" -> Layer: ${layerInfo.name}, Order: ${layerInfo.order}`);
    
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
      const fileName = (file.webkitRelativePath || file.originalname).split('/').pop();
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

// Optimized zip creation with streaming for large collections
function createZipArchiveOptimized(sourceDir, outputPath, collectionSize) {
  return new Promise((resolve, reject) => {
    let output, archive;
    
    try {
      // Create write stream
      output = fs.createWriteStream(outputPath);
      
      // Create archive with better settings
      archive = archiver('zip', {
        zlib: { level: 6 }, // Balanced compression level for speed vs size
        store: false // Ensure compression is used
      });

      // Handle write stream events
      output.on('close', () => {
        const totalBytes = archive.pointer();
        console.log(`NFT Generator: Archive created successfully: ${totalBytes} total bytes`);
        
        // Validate the zip file was created properly
        if (totalBytes === 0) {
          reject(new Error('Generated zip file is empty'));
          return;
        }
        
        // Check if file exists and has content
        if (!fs.existsSync(outputPath)) {
          reject(new Error('Zip file was not created'));
          return;
        }
        
        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          reject(new Error('Zip file is empty'));
          return;
        }
        
        console.log(`NFT Generator: Zip file validated: ${stats.size} bytes`);
        resolve();
      });

      output.on('error', (err) => {
        console.error('NFT Generator: Write stream error:', err);
        reject(err);
      });

      // Handle archive events
      archive.on('error', (err) => {
        console.error('NFT Generator: Archive error:', err);
        reject(err);
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('NFT Generator: Archive warning:', err);
        } else {
          console.error('NFT Generator: Archive warning:', err);
          reject(err);
        }
      });

      // Pipe archive to output
      archive.pipe(output);

      // Add directories with error checking
      const imagesPath = path.join(sourceDir, 'images');
      const metadataPath = path.join(sourceDir, 'metadata');
      
      if (fs.existsSync(imagesPath)) {
        archive.directory(imagesPath, 'images');
      } else {
        console.warn('NFT Generator: Images directory not found:', imagesPath);
      }
      
      if (fs.existsSync(metadataPath)) {
        archive.directory(metadataPath, 'metadata');
      } else {
        console.warn('NFT Generator: Metadata directory not found:', metadataPath);
      }

      // Finalize the archive
      archive.finalize();
      
    } catch (error) {
      console.error('NFT Generator: Zip creation error:', error);
      
      // Clean up on error
      if (output) {
        output.destroy();
      }
      if (archive) {
        archive.destroy();
      }
      
      // Remove partial file if it exists
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (unlinkError) {
          console.error('NFT Generator: Failed to remove partial zip file:', unlinkError);
        }
      }
      
      reject(error);
    }
  });
}

// Cleanup old jobs periodically
setInterval(() => {
  cleanupAbandonedJobs();
}, 10 * 60 * 1000); // Check every 10 minutes

export default router; 