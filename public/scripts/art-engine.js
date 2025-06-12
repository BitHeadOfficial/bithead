// BitHeadzArtEngine Tool JavaScript
class BitHeadzArtEngine {
  constructor() {
    this.uploadedLayers = new Map();
    this.layerStructure = [];
    this.generationId = null;
    this.isGenerating = false;
    this.originalFileData = new Map(); // Store original file data with webkitRelativePath
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    // Upload elements
    this.uploadArea = document.getElementById('uploadArea');
    this.layerInput = document.getElementById('layerInput');
    this.uploadedLayersContainer = document.getElementById('uploadedLayers');
    this.layerPreview = document.getElementById('layerPreview');
    
    // Configuration elements
    this.collectionName = document.getElementById('collectionName');
    this.collectionSize = document.getElementById('collectionSize');
    this.collectionDescription = document.getElementById('collectionDescription');
    this.customCID = document.getElementById('customCID');
    this.rarityMode = document.getElementById('rarityMode');
    this.optionalLayersContainer = document.getElementById('optionalLayers');
    
    // Generation elements
    this.generateBtn = document.getElementById('generateBtn');
    this.generationStatus = document.getElementById('generationStatus');
    this.statusText = document.querySelector('.status-text');
    this.progressBar = document.getElementById('progressBar');
    this.progressFill = document.getElementById('progressFill');
    this.statusDetails = document.getElementById('statusDetails');
    
    // Download elements
    this.downloadSection = document.getElementById('downloadSection');
    this.downloadBtn = document.getElementById('downloadBtn');
  }

  setupEventListeners() {
    // Upload area events
    this.uploadArea.addEventListener('click', () => this.layerInput.click());
    this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
    this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
    
    // File input events
    this.layerInput.addEventListener('change', this.handleFileSelect.bind(this));
    
    // Ensure webkitdirectory is set properly (for browser compatibility)
    this.layerInput.setAttribute('webkitdirectory', '');
    this.layerInput.setAttribute('directory', '');
    
    // Generate button
    this.generateBtn.addEventListener('click', this.startGeneration.bind(this));
    
    // Download button
    this.downloadBtn.addEventListener('click', this.downloadCollection.bind(this));
  }

  handleDragOver(e) {
    e.preventDefault();
    this.uploadArea.classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
    
    // Use DataTransferItemList interface to access the file(s)
    const items = e.dataTransfer.items;
    if (items) {
      this.processDroppedItems(items);
    }
  }

  async processDroppedItems(items) {
    const files = [];
    const queue = [];

    // Enqueue all dropped items for processing
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          queue.push(this.readEntry(entry));
        }
      }
    }

    // Process the queue concurrently
    const results = await Promise.all(queue);
    results.forEach(result => files.push(...result));

    this.processFiles(files);
  }

  async readEntry(entry) {
    if (entry.isFile) {
      return [await this.readFileEntry(entry)];
    } else if (entry.isDirectory) {
      return await this.readDirectoryEntry(entry);
    }
    return [];
  }

  async readFileEntry(fileEntry) {
    return new Promise((resolve, reject) => {
      fileEntry.file(
        (file) => {
          // Return a simple object containing the file and its relative path
          resolve({ file: file, webkitRelativePath: fileEntry.fullPath.substring(1) });
        },
        (error) => reject(error)
      );
    });
  }

  async readDirectoryEntry(directoryEntry) {
    return new Promise((resolve) => {
      directoryEntry.createReader().readEntries(async (entries) => {
        const files = [];
        const queue = [];
        for (let i = 0; i < entries.length; i++) {
          queue.push(this.readEntry(entries[i]));
        }
        const results = await Promise.all(queue);
        results.forEach(result => files.push(...result));
        resolve(files);
      });
    });
  }

  handleFileSelect(e) {
    // For file input with webkitdirectory, files already have webkitRelativePath
    // We should preserve the original webkitRelativePath, not override it
    const files = Array.from(e.target.files).map(file => ({ 
      file: file, 
      webkitRelativePath: file.webkitRelativePath || file.name // Use original path or fallback to filename
    }));
    this.processFiles(files);
  }

  processFiles(filesData) {
    // First, let's see what files we received
    const allFilesWithPaths = Array.from(filesData);
    
    // Debug: Log what we received
    console.log('Files received:', allFilesWithPaths.length);
    console.log('File input attributes:', {
      multiple: this.layerInput.multiple,
      webkitdirectory: this.layerInput.webkitdirectory,
      directory: this.layerInput.directory
    });
    
    // Debug: Check first few files in detail
    console.log('=== DETAILED FILE DEBUG ===');
    allFilesWithPaths.slice(0, 5).forEach((item, index) => {
      const file = item.file;
      console.log(`File ${index} DETAIL:`, {
        name: file.name,
        type: file.type,
        size: file.size,
        webkitRelativePath: item.webkitRelativePath || 'N/A',
        originalWebkitRelativePath: file.webkitRelativePath || 'N/A',
        lastModified: file.lastModified,
        fullPath: item.webkitRelativePath,
        hasPath: !!item.webkitRelativePath,
        pathIncludesSlash: item.webkitRelativePath ? item.webkitRelativePath.includes('/') : false
      });
    });
    
    // Debug: Check if any files have webkitRelativePath
    const filesWithPath = allFilesWithPaths.filter(item => item.webkitRelativePath && item.webkitRelativePath.includes('/'));
    console.log(`Files with webkitRelativePath containing '/': ${filesWithPath.length}`);
    if (filesWithPath.length > 0) {
      console.log('Sample paths:', filesWithPath.slice(0, 3).map(item => item.webkitRelativePath));
      console.log('First 5 actual paths:');
      filesWithPath.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index}: "${item.webkitRelativePath}"`);
      });
    }

    // Filter for PNG files only
    const pngFilesWithPaths = allFilesWithPaths.filter(item => {
      const file = item.file;
      const isPNG = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      if (!isPNG) {
        console.log(`Skipping non-PNG file: ${file.name} (${file.type})`);
      }
      return isPNG;
    });

    if (pngFilesWithPaths.length === 0) {
      this.showError('No PNG files found. Please upload PNG files only.');
      return;
    }

    console.log(`Found ${pngFilesWithPaths.length} PNG files`);

    // Store original file data for later use
    this.originalFileData.clear();
    pngFilesWithPaths.forEach(item => {
      const file = item.file;
      const key = `${file.name}_${file.size}_${file.lastModified}`; // Create unique key
      this.originalFileData.set(key, {
        file: file,
        webkitRelativePath: item.webkitRelativePath
      });
    });

    // Group files by folder structure
    // This part should now correctly receive files with webkitRelativePath for both drag-and-drop and select
    const layerGroups = this.groupFilesByLayer(pngFilesWithPaths);
    
    // Debug: Log the layer groups
    console.log('=== LAYER GROUPS DEBUG ===');
    layerGroups.forEach((files, layerName) => {
      console.log(`Layer "${layerName}": ${files.length} files`);
    });
    
    // Add to uploaded layers
    layerGroups.forEach((files, layerName) => {
      this.uploadedLayers.set(layerName, files);
    });

    this.updateLayerDisplay();
    this.updateLayerPreview();
    this.updateOptionalLayers();
  }

  groupFilesByLayer(filesWithPaths) {
    const groups = new Map();
    
    console.log('=== GROUPFILESBYLAYER DEBUG ===');
    console.log(`Processing ${filesWithPaths.length} files`);
    
    filesWithPaths.forEach((item, index) => {
      const file = item.file;
      const webkitRelativePath = item.webkitRelativePath;
      
      console.log(`File ${index}: "${webkitRelativePath}"`);
      
      let layerName;
      if (webkitRelativePath && webkitRelativePath.includes('/')) {
        const pathParts = webkitRelativePath.split('/');
        console.log(`  Path parts: [${pathParts.join(', ')}]`);
        
        // The first part is the folder name, which represents the layer
        const folderNameWithPrefix = pathParts[0];
        console.log(`  Folder name with prefix: "${folderNameWithPrefix}"`);
        
        const folderMatch = folderNameWithPrefix.match(/^\d+_(.+)$/);
        console.log(`  Folder match:`, folderMatch);
        
        layerName = folderMatch ? folderMatch[1] : folderNameWithPrefix; // Extract name without prefix if available
        console.log(`  Extracted layer name: "${layerName}"`);
      } else {
        // Fallback for files without webkitRelativePath (unlikely if folder upload works, but safe)
        layerName = file.name.replace(/\.png$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
        const prefixMatch = layerName.match(/^(\d+)_(.+?)$/);
        if (prefixMatch) {
          layerName = prefixMatch[2];
        }
        console.log(`  Fallback layer name: "${layerName}"`);
      }
      
      if (!groups.has(layerName)) {
        groups.set(layerName, []);
        console.log(`  Created new group: "${layerName}"`);
      }
      
      groups.get(layerName).push(file);
      console.log(`  Added file to group "${layerName}"`);
    });

    console.log('=== FINAL GROUPS ===');
    groups.forEach((files, layerName) => {
      console.log(`Group "${layerName}": ${files.length} files`);
    });

    return groups;
  }

  extractLayerName(file) {
    // This function is now fully redundant as groupFilesByLayer handles path extraction
    return "UnknownLayer"; // Should not be called
  }

  getLayerOrder(layerName) {
    const layerOrderMap = {
      'Background': 0,
      'Body': 1,
      'Head': 2,
      'Eyes': 3,
      'Mouth': 4,
      'Accessories': 5,
      'Clothing': 6,
      'Hair': 7,
      'Hat': 8,
      'Glasses': 9,
      'Jewelry': 10
    };
    
    if (layerOrderMap[layerName] !== undefined) {
      return layerOrderMap[layerName];
    }
    
    // Extract numeric prefix if it exists (e.g., from '00_Background')
    const match = layerName.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 999;
  }

  updateLayerDisplay() {
    this.uploadedLayersContainer.innerHTML = '';
    
    if (this.uploadedLayers.size === 0) {
      return;
    }

    // Sort layers by their order
    const sortedLayers = Array.from(this.uploadedLayers.entries())
      .sort(([a], [b]) => {
        const aOrder = this.getLayerOrder(a);
        const bOrder = this.getLayerOrder(b);
        return aOrder - bOrder;
      });

    sortedLayers.forEach(([layerName, files]) => {
      const layerItem = this.createLayerItem(layerName, files);
      this.uploadedLayersContainer.appendChild(layerItem);
    });
  }

  createLayerItem(layerName, files) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    
    const layerInfo = document.createElement('div');
    layerInfo.className = 'layer-info';
    
    const layerNameEl = document.createElement('div');
    layerNameEl.className = 'layer-name';
    layerNameEl.textContent = layerName;
    
    const layerDetails = document.createElement('div');
    layerDetails.className = 'layer-details';
    layerDetails.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    
    layerInfo.appendChild(layerNameEl);
    layerInfo.appendChild(layerDetails);
    
    const layerActions = document.createElement('div');
    layerActions.className = 'layer-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'layer-action-btn delete';
    deleteBtn.textContent = 'Remove';
    deleteBtn.addEventListener('click', () => this.removeLayer(layerName));
    
    layerActions.appendChild(deleteBtn);
    
    item.appendChild(layerInfo);
    item.appendChild(layerActions);
    
    return item;
  }

  removeLayer(layerName) {
    this.uploadedLayers.delete(layerName);
    this.updateLayerDisplay();
    this.updateLayerPreview();
    this.updateOptionalLayers();
  }

  updateLayerPreview() {
    if (this.uploadedLayers.size === 0) {
      this.layerPreview.innerHTML = '<p class="no-layers">Upload layers to see preview</p>';
      return;
    }

    const layerStructure = document.createElement('div');
    layerStructure.className = 'layer-structure';
    
    // Sort layers by order
    const sortedLayers = Array.from(this.uploadedLayers.entries())
      .sort(([a], [b]) => {
        const aOrder = this.getLayerOrder(a);
        const bOrder = this.getLayerOrder(b);
        return aOrder - bOrder;
      });

    sortedLayers.forEach(([layerName, files], index) => {
      const layerItem = document.createElement('div');
      layerItem.className = 'layer-structure-item';
      
      const layerOrder = document.createElement('div');
      layerOrder.className = 'layer-order';
      layerOrder.textContent = index + 1;
      
      const layerNameEl = document.createElement('div');
      layerNameEl.className = 'layer-name';
      layerNameEl.textContent = layerName;
      
      const layerCount = document.createElement('div');
      layerCount.className = 'layer-count';
      layerCount.textContent = `${files.length} variants`;
      
      layerItem.appendChild(layerOrder);
      layerItem.appendChild(layerNameEl);
      layerItem.appendChild(layerCount);
      
      layerStructure.appendChild(layerItem);
    });
    
    this.layerPreview.innerHTML = '';
    this.layerPreview.appendChild(layerStructure);
  }

  updateOptionalLayers() {
    this.optionalLayersContainer.innerHTML = '';
    
    if (this.uploadedLayers.size === 0) {
      return;
    }

    // Make ALL layers optional
    this.uploadedLayers.forEach((files, layerName) => {
      const optionalItem = this.createOptionalLayerItem(layerName, files);
      this.optionalLayersContainer.appendChild(optionalItem);
    });
  }

  createOptionalLayerItem(layerName, files) {
    const item = document.createElement('div');
    item.className = 'optional-layer-item';
    
    const layerInfo = document.createElement('div');
    layerInfo.className = 'optional-layer-info';
    
    const layerNameEl = document.createElement('div');
    layerNameEl.className = 'optional-layer-name';
    layerNameEl.textContent = layerName;
    
    const layerDescription = document.createElement('div');
    layerDescription.className = 'optional-layer-description';
    layerDescription.textContent = `${files.length} variants - Optional layer`;
    
    layerInfo.appendChild(layerNameEl);
    layerInfo.appendChild(layerDescription);
    
    const layerToggle = document.createElement('div');
    layerToggle.className = 'optional-layer-toggle';
    
    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'toggle-switch active';
    toggleSwitch.dataset.layer = layerName;
    toggleSwitch.addEventListener('click', () => this.toggleOptionalLayer(toggleSwitch));
    
    layerToggle.appendChild(toggleSwitch);
    
    item.appendChild(layerInfo);
    item.appendChild(layerToggle);
    
    return item;
  }

  toggleOptionalLayer(toggleSwitch) {
    toggleSwitch.classList.toggle('active');
  }

  async startGeneration() {
    if (this.isGenerating) {
      return;
    }

    if (this.uploadedLayers.size === 0) {
      this.showError('Please upload at least one layer before generating.');
      return;
    }

    const collectionSize = parseInt(this.collectionSize.value);
    if (collectionSize < 1 || collectionSize > 10000) {
      this.showError('Collection size must be between 1 and 10,000.');
      return;
    }

    // Show warning for large collections
    if (collectionSize > 500) {
      const confirmed = confirm(`You're generating a large collection of ${collectionSize} NFTs. This may take several minutes and use significant memory. Continue?`);
      if (!confirmed) {
        return;
      }
    }

    this.isGenerating = true;
    this.generateBtn.disabled = true;
    this.generateBtn.innerHTML = '<span class="button-text">Generating...</span><span class="button-icon">⏳</span>';

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('collectionName', this.collectionName.value);
      formData.append('collectionSize', collectionSize);
      formData.append('collectionDescription', this.collectionDescription.value);
      formData.append('customCID', this.customCID.value.trim());
      formData.append('rarityMode', this.rarityMode.value);
      
      // Add all files with their original paths
      // We need to reconstruct the original file list with webkitRelativePath
      const allFiles = [];
      this.uploadedLayers.forEach((files, layerName) => {
        files.forEach(file => {
          // Find the original file data that contains webkitRelativePath
          // We need to search through our original file data to find the matching file
          const originalFileData = this.findOriginalFileData(file);
          if (originalFileData) {
            allFiles.push(originalFileData);
          } else {
            // Fallback: create a path based on layer name
            const fallbackPath = `${this.getLayerOrder(layerName).toString().padStart(2, '0')}_${layerName}/${file.name}`;
            allFiles.push({
              file: file,
              webkitRelativePath: fallbackPath
            });
          }
        });
      });
      
      // Add files to FormData with their paths
      allFiles.forEach((fileData, index) => {
        formData.append(`files`, fileData.file);
        formData.append(`filePaths`, fileData.webkitRelativePath);
      });
      
      // Add optional layer settings
      const optionalLayers = {};
      document.querySelectorAll('.toggle-switch').forEach(toggle => {
        const layerName = toggle.dataset.layer;
        optionalLayers[layerName] = toggle.classList.contains('active');
      });
      formData.append('optionalLayers', JSON.stringify(optionalLayers));

      // Start generation
      const response = await fetch('/api/nft-generator/generate', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.generationId = result.generationId;
      
      // Start polling for progress
      this.pollGenerationProgress();
      
    } catch (error) {
      console.error('Generation error:', error);
      this.showError(`Generation failed: ${error.message}`);
      this.isGenerating = false;
      this.generateBtn.disabled = false;
      this.generateBtn.innerHTML = '<span class="button-text">Generate Collection</span><span class="button-icon">🚀</span>';
    }
  }

  // Helper method to find original file data with webkitRelativePath
  findOriginalFileData(file) {
    // Create the same unique key used when storing the data
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    return this.originalFileData.get(key) || null;
  }

  async pollGenerationProgress() {
    if (!this.generationId) {
      return;
    }

    try {
      const response = await fetch(`/api/nft-generator/status/${this.generationId}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        if (response.status === 504) {
          // Gateway timeout - continue polling
          console.log('Gateway timeout, continuing to poll...');
          const collectionSize = parseInt(this.collectionSize.value);
          const pollInterval = collectionSize > 1000 ? 5000 : collectionSize > 500 ? 4000 : 3000;
          setTimeout(() => this.pollGenerationProgress(), pollInterval);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const status = await response.json();
      
      this.updateProgress(status);
      
      if (status.status === 'completed') {
        this.generationCompleted(status);
      } else if (status.status === 'failed') {
        this.generationFailed(status.error || status.details || 'Generation failed');
      } else {
        // Continue polling with adaptive interval based on collection size
        const collectionSize = parseInt(this.collectionSize.value);
        const pollInterval = collectionSize > 1000 ? 5000 : collectionSize > 500 ? 4000 : 3000;
        setTimeout(() => this.pollGenerationProgress(), pollInterval);
      }
      
    } catch (error) {
      console.error('Progress polling error:', error);
      
      // Don't immediately fail on network errors, continue polling
      if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
        console.log('Network error, retrying in 5 seconds...');
        setTimeout(() => this.pollGenerationProgress(), 5000);
        return;
      }
      
      // For other errors, show a warning but continue polling
      console.log('Polling error, continuing to poll...');
      const collectionSize = parseInt(this.collectionSize.value);
      const pollInterval = collectionSize > 1000 ? 5000 : collectionSize > 500 ? 4000 : 3000;
      setTimeout(() => this.pollGenerationProgress(), pollInterval);
    }
  }

  updateProgress(status) {
    this.progressBar.style.display = 'block';
    this.progressFill.style.width = `${status.progress || 0}%`;
    
    // Enhanced progress message
    const collectionSize = parseInt(this.collectionSize.value);
    let progressMessage = status.message || 'Generating...';
    
    // Add NFT count if available
    if (status.totalGenerated && collectionSize) {
      progressMessage = `${status.totalGenerated} of ${collectionSize} NFTs generated`;
    }
    
    this.statusText.textContent = progressMessage;
    this.statusDetails.textContent = status.details || '';
    
    // Add visual indicator for large collections
    if (collectionSize > 500) {
      const percentage = Math.round((status.progress || 0));
      this.statusDetails.textContent = `${percentage}% complete - ${status.details || ''}`;
    }
  }

  generationCompleted(status) {
    this.statusText.textContent = 'Generation completed!';
    this.progressFill.style.width = '100%';
    this.statusDetails.textContent = `Generated ${status.totalGenerated} NFTs`;
    this.downloadSection.style.display = 'block';
    this.resetGenerationState();
  }

  generationFailed(error) {
    this.statusText.textContent = 'Generation failed';
    this.statusDetails.textContent = error;
    this.showError(error);
    this.resetGenerationState();
  }

  resetGenerationState() {
    this.isGenerating = false;
    this.generateBtn.disabled = false;
    this.generateBtn.innerHTML = '<span class="button-text">Generate Collection</span><span class="button-icon">🚀</span>';
  }

  async downloadCollection() {
    if (!this.generationId) {
      this.showError('No collection to download.');
      return;
    }

    try {
      const response = await fetch(`/api/nft-generator/download/${this.generationId}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.collectionName.value}_collection.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Download error:', error);
      this.showError('Download failed. Please try again.');
    }
  }

  showError(message) {
    // Create a temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: rgba(220, 53, 69, 0.9);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      font-weight: 600;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }

  showErrorWithFallback(message) {
    // Since individual file upload is not desired, we'll revert this to a standard error
    this.showError(message);
  }
}

// Initialize the art engine when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BitHeadzArtEngine();
}); 