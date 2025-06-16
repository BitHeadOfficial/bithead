import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createCanvas, loadImage } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/*************************************************************
 * NFT Generator Route - Professional NFT Collection Generator
 * 
 * INTEGRATION WITH BitHeadzArtEngine:
 * 
 * This route serves as the API layer for the BitHeadzArtEngine, providing:
 * 
 * 1. FILE UPLOAD & ORGANIZATION:
 *    - Accepts PNG files uploaded via web interface
 *    - Organizes files into proper trait categories using smart detection
 *    - Creates layer structure expected by BitHeadzArtEngine
 *    - Handles folder-based organization (Background/, Base/, Eyes/, etc.)
 * 
 * 2. TRAIT CATEGORY DETECTION:
 *    - Automatically detects trait categories from folder structure
 *    - Assigns proper layer orders (Background=1, Base=2, Eyes=5, etc.)
 *    - Supports custom trait categories with fallback ordering
 *    - Handles files without folder structure gracefully
 * 
 * 3. IMAGE COMPRESSION & OPTIMIZATION:
 *    - Compresses large images to 1024x1024 pixels for performance
 *    - Maintains aspect ratio during compression
 *    - Fallback to original images if compression fails
 *    - Sequential processing to avoid memory issues
 * 
 * 4. GENERATION WORKFLOW:
 *    - File upload → Trait organization → Image compression → NFT generation
 *    - Background processing with real-time progress updates
 *    - Job management with unique IDs for tracking
 *    - Automatic cleanup of temporary files
 * 
 * 5. API ENDPOINTS:
 *    - POST /generate - Start NFT generation
 *    - GET /status/:id - Check generation progress
 *    - GET /download/:id - Download completed collection
 *    - POST /cancel/:id - Cancel generation
 *    - POST /test-upload - Test file upload functionality
 * 
 * 6. CONFIGURATION OPTIONS:
 *    - Collection size (1-10,000 NFTs)
 *    - Collection name and description
 *    - Custom CID for metadata
 *    - Active layer configuration with probabilities
 *    - Rarity mode selection
 * 
 * 7. OUTPUT & DELIVERY:
 *    - ZIP file containing images and metadata
 *    - Optimized compression for large collections
 *    - Streaming download for large files
 *    - Progress tracking during download
 * 
 * 8. ERROR HANDLING & RELIABILITY:
 *    - Comprehensive error logging
 *    - Graceful failure handling
 *    - Automatic cleanup on errors
 *    - Timeout protection for long operations
 *    - Memory management for large collections
 * 
 * EXPECTED FILE STRUCTURE:
 * Users upload files organized in folders like:
 * Background/
 *   - background1.png
 *   - background2.png
 * Base/
 *   - base1.png
 *   - base2.png
 * Eyes/
 *   - eyes1.png
 *   - eyes2.png
 * 
 * The system automatically:
 * 1. Detects trait categories from folder names
 * 2. Assigns proper layer orders
 * 3. Compresses images if needed
 * 4. Passes organized structure to BitHeadzArtEngine
 * 5. Generates unique NFTs with proper layering
 * 
 * This creates a professional, scalable NFT generation system
 * suitable for creators of all skill levels.
 *************************************************************/

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

// Test endpoint to verify upload functionality
router.post('/test-upload', upload.any(), (req, res) => {
  try {
    console.log('NFT Generator: Test upload endpoint called');
    console.log('NFT Generator: Request body keys:', Object.keys(req.body));
    console.log('NFT Generator: Files count:', req.files ? req.files.length : 0);
    
    if (req.files && req.files.length > 0) {
      console.log('NFT Generator: Sample file info:', {
        originalname: req.files[0].originalname,
        mimetype: req.files[0].mimetype,
        size: req.files[0].size,
        path: req.files[0].path
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Upload test successful',
      fileCount: req.files ? req.files.length : 0,
      bodyKeys: Object.keys(req.body)
    });
  } catch (error) {
    console.error('NFT Generator: Test upload error:', error);
    res.status(500).json({ error: 'Test upload failed', details: error.message });
  }
});

// Upload layers and start generation
router.post('/generate', upload.any(), async (req, res) => {
  try {
    console.log('NFT Generator: Starting generation process');
    console.log('NFT Generator: Request body keys:', Object.keys(req.body));
    console.log('NFT Generator: Files count:', req.files ? req.files.length : 0);
    
    const { collectionName, collectionSize, collectionDescription, rarityMode, activeLayers, customCID } = req.body;
    const files = req.files;
    const filePaths = req.body.filePaths;

    console.log('NFT Generator: Collection name:', collectionName);
    console.log('NFT Generator: Collection size:', collectionSize);
    console.log('NFT Generator: Rarity mode:', rarityMode);

    if (!files || files.length === 0) {
      console.log('NFT Generator: No files uploaded');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Filter and validate files
    const validFiles = files.filter(file => {
      if (file.mimetype !== 'image/png') {
        console.log(`NFT Generator: Skipping non-PNG file: ${file.originalname} (${file.mimetype})`);
        return false;
      }
      return true;
    });

    console.log(`NFT Generator: Valid PNG files: ${validFiles.length}/${files.length}`);

    if (validFiles.length === 0) {
      console.log('NFT Generator: No valid PNG files found');
      return res.status(400).json({ error: 'No valid PNG files uploaded' });
    }

    if (!collectionName || !collectionSize) {
      console.log('NFT Generator: Missing required fields:', { collectionName, collectionSize });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const size = parseInt(collectionSize);
    if (isNaN(size) || size < 1 || size > 10000) {
      console.log('NFT Generator: Invalid collection size:', collectionSize);
      return res.status(400).json({ error: 'Invalid collection size' });
    }

    console.log(`NFT Generator: Processing ${validFiles.length} valid PNG files for ${size} NFTs`);

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
      lowMemoryMode: true,
    };

    generationJobs.set(generationId, job);

    console.log(`NFT Generator: Created job ${generationId} with ${job.files.length} files`);

    // Start generation in background with optimized settings
    try {
      generateCollectionOptimized(job).catch(error => {
        console.error(`NFT Generator: Background generation error for job ${generationId}:`, error);
        job.status = 'failed';
        job.message = 'Generation failed in background process';
        job.details = error.message;
      });
    } catch (error) {
      console.error(`NFT Generator: Error starting background generation for job ${generationId}:`, error);
      job.status = 'failed';
      job.message = 'Failed to start generation process';
      job.details = error.message;
    }

    res.json({ 
      success: true, 
      generationId,
      message: 'Generation started successfully'
    });

  } catch (error) {
    console.error('NFT Generator Error:', error);
    console.error('NFT Generator Error Stack:', error.stack);
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

    // Set headers for file download with better caching
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${job.collectionName}_collection.zip"`);
    res.setHeader('Content-Length', fs.statSync(job.outputPath).size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Increase timeout for large files
    const fileSize = fs.statSync(job.outputPath).size;
    const timeoutMs = Math.max(300000, fileSize / 1000); // 5 minutes minimum, 1ms per byte
    req.setTimeout(timeoutMs);
    res.setTimeout(timeoutMs);

    // Stream the zip file with error handling and progress tracking
    const fileStream = fs.createReadStream(job.outputPath, { 
      highWaterMark: 64 * 1024 // 64KB chunks for better memory management
    });
    
    let bytesSent = 0;
    const totalBytes = fs.statSync(job.outputPath).size;
    
    // Track progress
    fileStream.on('data', (chunk) => {
      bytesSent += chunk.length;
      if (bytesSent % (1024 * 1024) === 0) { // Log every MB
        console.log(`NFT Generator: Download progress for job ${generationId}: ${Math.round(bytesSent / 1024 / 1024)}MB / ${Math.round(totalBytes / 1024 / 1024)}MB`);
      }
    });

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

    // Handle response errors
    res.on('error', (error) => {
      console.error(`NFT Generator: Response error for job ${generationId}:`, error);
      fileStream.destroy();
    });

    // Pipe with error handling
    fileStream.pipe(res);

    // Clean up after download with extended delay for large collections
    fileStream.on('end', () => {
      console.log(`NFT Generator: Download completed for job ${generationId} (${Math.round(totalBytes / 1024 / 1024)}MB)`);
      
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
    
    // Optimized timeout based on collection size and image complexity
    const baseTimeout = 180000; // 3 minutes base
    const perNFTTimeout = 2000; // 2 seconds per NFT
    const largeImageTimeout = 5000; // Extra 5 seconds for large images
    const generationTimeout = baseTimeout + (job.collectionSize * perNFTTimeout) + largeImageTimeout;
    console.log(`NFT Generator: Setting optimized generation timeout to ${generationTimeout}ms (${Math.round(generationTimeout/1000/60)} minutes)`);
    
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
    const layerStructure = await organizeTraits(job.files, layersDir);
    
    console.log(`NFT Generator: Layer structure result:`, layerStructure.map(l => `${l.folder}: ${l.count} files`));
    
    job.message = 'Validating layer structure...';
    job.progress = 20;

    // Validate layer structure
    if (layerStructure.length === 0) {
      throw new Error('No valid layers found');
    }

    // NEW: Compress images AFTER layer organization is complete
    job.message = 'Compressing layer images...';
    job.progress = 25;
    
    console.log(`NFT Generator: Starting image compression for ${layerStructure.length} layers`);
    
    // Compress images in each layer sequentially to avoid memory issues
    for (let i = 0; i < layerStructure.length; i++) {
      const layer = layerStructure[i];
      const layerProgress = 25 + (i / layerStructure.length) * 5; // 25% to 30%
      
      job.message = `Compressing ${layer.name} images...`;
      job.progress = layerProgress;
      
      console.log(`NFT Generator: Compressing layer ${i + 1}/${layerStructure.length}: ${layer.name}`);
      
      try {
        await compressLayerImages(layer.path, 1024);
        console.log(`NFT Generator: Successfully compressed layer: ${layer.name}`);
      } catch (error) {
        console.error(`NFT Generator: Error compressing layer ${layer.name}:`, error);
        // Continue with other layers - don't fail the entire process
      }
    }
    
    console.log(`NFT Generator: Completed image compression for all layers`);

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
      lowMemoryMode: true,
      onProgress: (progress, message, details) => {
        job.progress = progress;
        job.message = message;
        job.details = details;
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

    // Wait for generation to complete
    const generationResult = await Promise.race([generationPromise, timeoutPromise]);

    job.message = 'Preparing download package...';
    job.progress = 90;

    // Create ZIP file after generation is complete
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
      userMessage = 'Generation failed: Out of memory. Try reducing collection size.';
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

// Optimized zip creation with streaming for large collections
function createZipArchiveOptimized(sourceDir, outputPath, collectionSize) {
  return new Promise((resolve, reject) => {
    let output, archive;
    
    try {
      // Create write stream with larger buffer for better performance
      output = fs.createWriteStream(outputPath, { 
        highWaterMark: 1024 * 1024 // 1MB buffer for better throughput
      });
      
      // Use faster compression settings for large collections
      const compressionLevel = collectionSize > 5000 ? 1 : collectionSize > 1000 ? 3 : 6;
      console.log(`NFT Generator: Using compression level ${compressionLevel} for ${collectionSize} NFTs`);
      
      // Create archive with optimized settings
      archive = archiver('zip', {
        zlib: { 
          level: compressionLevel, // Faster compression for large collections
          memLevel: 8, // Higher memory usage for better compression speed
          windowBits: 15 // Standard window size
        },
        store: false // Ensure compression is used
      });

      // Set archive to use more memory for better performance
      archive.pointer(); // Initialize pointer

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

      // Add progress tracking for large collections
      if (collectionSize > 1000) {
        let fileCount = 0;
        archive.on('entry', (entry) => {
          fileCount++;
          if (fileCount % 100 === 0) {
            console.log(`NFT Generator: Added ${fileCount} files to archive...`);
          }
        });
      }

      // Pipe archive to output
      archive.pipe(output);

      // Add directories with optimized approach for large collections
      const imagesPath = path.join(sourceDir, 'images');
      const metadataPath = path.join(sourceDir, 'metadata');
      
      if (fs.existsSync(imagesPath)) {
        // For very large collections, use glob pattern to add files more efficiently
        if (collectionSize > 5000) {
          console.log('NFT Generator: Using optimized file addition for large collection...');
          // Add images directory with optimized settings
          archive.directory(imagesPath, 'images', { 
            name: 'images',
            date: new Date()
          });
        } else {
          archive.directory(imagesPath, 'images');
        }
      } else {
        console.warn('NFT Generator: Images directory not found:', imagesPath);
      }
      
      if (fs.existsSync(metadataPath)) {
        // Add metadata directory
        if (collectionSize > 5000) {
          archive.directory(metadataPath, 'metadata', { 
            name: 'metadata',
            date: new Date()
          });
        } else {
          archive.directory(metadataPath, 'metadata');
        }
      } else {
        console.warn('NFT Generator: Metadata directory not found:', metadataPath);
      }

      // Finalize the archive
      console.log('NFT Generator: Finalizing archive...');
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

// Clean image compression function - optimized for large images
async function compressImageSafely(inputPath, outputPath, targetSize = 1024) {
  try {
    console.log(`NFT Generator: Starting optimized compression of ${inputPath}`);
    
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }
    
    // Get file size to determine if compression is needed
    const stats = fs.statSync(inputPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    console.log(`NFT Generator: File size: ${fileSizeMB.toFixed(2)}MB`);
    
    // If file is already small enough (less than 1MB), skip compression
    if (fileSizeMB < 1) {
      fs.copyFileSync(inputPath, outputPath);
      console.log(`NFT Generator: File already small enough, copied as-is`);
      return;
    }
    
    // Load image and get dimensions
    const image = await loadImage(inputPath);
    const { width, height } = image;
    
    console.log(`NFT Generator: Image dimensions: ${width}x${height}`);
    
    // Only resize if image is larger than target size
    if (width <= targetSize && height <= targetSize) {
      // If image is already small enough, just copy it
      fs.copyFileSync(inputPath, outputPath);
      console.log(`NFT Generator: Image already small enough, copied as-is`);
      return;
    }
    
    // Calculate new dimensions maintaining aspect ratio
    let newWidth, newHeight;
    if (width > height) {
      newWidth = targetSize;
      newHeight = Math.round((height * targetSize) / width);
    } else {
      newHeight = targetSize;
      newWidth = Math.round((width * targetSize) / height);
    }
    
    console.log(`NFT Generator: Resizing to ${newWidth}x${newHeight}`);
    
    // Create canvas and resize image
    const canvas = createCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    
    // Use high-quality resizing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
    
    // Save compressed image with proper error handling and timeout
    return new Promise((resolve, reject) => {
      const out = fs.createWriteStream(outputPath);
      const stream = canvas.createPNGStream({ 
        compressionLevel: 3, // Faster compression for large images
        filters: canvas.PNG_FILTER_NONE
      });
      
      // Add timeout for compression
      const timeout = setTimeout(() => {
        console.error(`NFT Generator: Compression timeout for ${inputPath}`);
        out.destroy();
        stream.destroy();
        reject(new Error('Compression timeout'));
      }, 30000); // 30 second timeout
      
      stream.pipe(out);
      
      out.on('finish', () => {
        clearTimeout(timeout);
        console.log(`NFT Generator: Successfully compressed ${inputPath} from ${width}x${height} to ${newWidth}x${newHeight}`);
        resolve();
      });
      
      out.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`NFT Generator: Stream error compressing ${inputPath}:`, error);
        reject(error);
      });
      
      stream.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`NFT Generator: Canvas stream error for ${inputPath}:`, error);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error(`NFT Generator: Error compressing image ${inputPath}:`, error);
    // If compression fails, just copy the original
    fs.copyFileSync(inputPath, outputPath);
    console.log(`NFT Generator: Fallback: copied original ${inputPath}`);
  }
}

// Batch compress images in a layer directory
async function compressLayerImages(layerDir, targetSize = 1024) {
  try {
    console.log(`NFT Generator: Starting batch compression for layer: ${layerDir}`);
    
    // Get all PNG files in the layer directory
    const files = fs.readdirSync(layerDir)
      .filter(file => file.toLowerCase().endsWith('.png'))
      .map(file => path.join(layerDir, file));
    
    if (files.length === 0) {
      console.log(`NFT Generator: No PNG files found in ${layerDir}`);
      return;
    }
    
    console.log(`NFT Generator: Found ${files.length} PNG files to compress in ${layerDir}`);
    
    // Process files sequentially to avoid memory issues
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const fileName = path.basename(filePath);
      
      try {
        console.log(`NFT Generator: Compressing ${i + 1}/${files.length}: ${fileName}`);
        
        // Create temporary output path
        const tempPath = filePath + '.temp';
        
        // Compress to temporary file
        await compressImageSafely(filePath, tempPath, targetSize);
        
        // Replace original with compressed version
        fs.renameSync(tempPath, filePath);
        
        console.log(`NFT Generator: Successfully compressed ${fileName}`);
        
      } catch (error) {
        console.error(`NFT Generator: Failed to compress ${fileName}:`, error);
        // Continue with other files
      }
    }
    
    console.log(`NFT Generator: Completed batch compression for layer: ${layerDir}`);
    
  } catch (error) {
    console.error(`NFT Generator: Error in batch compression for ${layerDir}:`, error);
  }
}

// Smart trait detection and organization
function detectTraitCategories(files) {
  console.log(`NFT Generator: Detecting trait categories from ${files.length} files`);
  
  const traitCategories = new Map();
  
  // Group files by trait category
  files.forEach(file => {
    const webkitPath = file.webkitRelativePath || file.originalname;
    const pathParts = webkitPath.split('/');
    
    if (pathParts.length > 1) {
      const traitCategory = pathParts[0]; // First part is the trait category
      const fileName = pathParts[pathParts.length - 1]; // Last part is the filename
      
      // Check if folder name has numeric prefix for custom ordering (e.g., "01_Background", "02_Body")
      let order = 999; // Default order for folders without prefix
      const folderName = traitCategory;
      
      // Extract order from folder name if it has numeric prefix
      const orderMatch = folderName.match(/^(\d+)_(.+)$/);
      if (orderMatch) {
        order = parseInt(orderMatch[1]);
        const cleanName = orderMatch[2];
        
        if (!traitCategories.has(cleanName)) {
          traitCategories.set(cleanName, {
            order: order,
            files: [],
            name: cleanName,
            originalFolderName: folderName
          });
        }
        
        traitCategories.get(cleanName).files.push({
          ...file,
          traitCategory: cleanName,
          fileName
        });
      } else {
        // No numeric prefix, use alphabetical ordering
        if (!traitCategories.has(traitCategory)) {
          traitCategories.set(traitCategory, {
            order: order,
            files: [],
            name: traitCategory,
            originalFolderName: folderName
          });
        }
        
        traitCategories.get(traitCategory).files.push({
          ...file,
          traitCategory,
          fileName
        });
      }
    } else {
      // Handle files without folder structure
      const fileName = file.originalname;
      const traitCategory = 'Unknown';
      
      if (!traitCategories.has(traitCategory)) {
        traitCategories.set(traitCategory, {
          order: 999,
          files: [],
          name: traitCategory,
          originalFolderName: traitCategory
        });
      }
      
      traitCategories.get(traitCategory).files.push({
        ...file,
        traitCategory,
        fileName
      });
    }
  });
  
  // Sort categories by order, then alphabetically for same order
  const sortedCategories = Array.from(traitCategories.entries())
    .sort((a, b) => {
      if (a[1].order !== b[1].order) {
        return a[1].order - b[1].order;
      }
      return a[1].name.localeCompare(b[1].name);
    });
  
  // Reassign orders based on sorted position for categories without custom ordering
  sortedCategories.forEach((entry, index) => {
    const [category, traitData] = entry;
    if (traitData.order === 999) {
      traitData.order = index + 1;
    }
  });
  
  console.log(`NFT Generator: Detected ${traitCategories.size} trait categories:`);
  sortedCategories.forEach(([category, traitData]) => {
    console.log(`  - ${category}: ${traitData.files.length} files, order ${traitData.order}`);
  });
  
  return traitCategories;
}

// Organize uploaded files into proper trait structure
async function organizeTraits(files, layersDir) {
  try {
    console.log(`NFT Generator: Organizing ${files.length} files into trait structure...`);
    console.log(`NFT Generator: Layers directory: ${layersDir}`);
    
    // Detect trait categories
    const traitCategories = detectTraitCategories(files);
    
    // Convert to array and sort by order
    const sortedTraits = Array.from(traitCategories.values())
      .sort((a, b) => a.order - b.order);
    
    const layerStructure = [];
    
    // Create layer directories for each trait category
    for (const traitData of sortedTraits) {
      try {
        // Create folder with numeric prefix based on trait order
        const folderName = `${traitData.order.toString().padStart(2, '0')}_${traitData.name}`;
        const layerDir = path.join(layersDir, folderName);
        
        console.log(`NFT Generator: Creating trait directory: ${layerDir}`);
        fs.mkdirSync(layerDir, { recursive: true });

        // Copy all files for this trait category
        traitData.files.forEach((file, fileIndex) => {
          try {
            const destPath = path.join(layerDir, file.fileName);
            
            console.log(`NFT Generator: Processing file ${fileIndex + 1}/${traitData.files.length}: ${file.fileName}`);
            
            // Check if source file exists
            if (!fs.existsSync(file.path)) {
              console.error(`NFT Generator: Source file does not exist: ${file.path}`);
              throw new Error(`Source file does not exist: ${file.path}`);
            }
            
            // Simply copy the file without compression for now
            fs.copyFileSync(file.path, destPath);
            
            console.log(`NFT Generator: Successfully copied: ${file.fileName}`);
          } catch (error) {
            console.error(`NFT Generator: Error processing file ${file.fileName}:`, error);
            throw error;
          }
        });

        layerStructure.push({
          name: traitData.name,
          count: traitData.files.length,
          path: layerDir,
          folder: folderName,
          order: traitData.order
        });
        
        console.log(`NFT Generator: Completed trait ${traitData.name} with ${traitData.files.length} files`);
      } catch (error) {
        console.error(`NFT Generator: Error processing trait ${traitData.name}:`, error);
        throw error;
      }
    }

    console.log(`NFT Generator: Final trait structure:`);
    layerStructure.forEach(layer => {
      console.log(`  - ${layer.folder}: ${layer.count} files`);
    });
    
    return layerStructure;
  } catch (error) {
    console.error(`NFT Generator: Error in organizeTraits:`, error);
    throw error;
  }
}

// Cleanup old jobs periodically
setInterval(() => {
  cleanupAbandonedJobs();
}, 10 * 60 * 1000); // Check every 10 minutes

export default router; 