// BitHeadzArtEngine Tool JavaScript
class BitHeadzArtEngine {
  constructor() {
    this.uploadedLayers = new Map();
    this.layerStructure = [];
    this.generationId = null;
    this.isGenerating = false;
    
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
    
    const files = Array.from(e.dataTransfer.files);
    this.processFiles(files);
  }

  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    this.processFiles(files);
  }

  processFiles(files) {
    // First, let's see what files we received
    const allFiles = Array.from(files);
    
    // Debug: Log what we received
    console.log('Files received:', allFiles.length);
    allFiles.forEach((file, index) => {
      console.log(`File ${index}:`, {
        name: file.name,
        type: file.type,
        size: file.size,
        webkitRelativePath: file.webkitRelativePath || 'N/A'
      });
    });
    
    // Filter for PNG files - check both MIME type and file extension
    const pngFiles = allFiles.filter(file => {
      const isPngType = file.type === 'image/png';
      const isPngExtension = file.name.toLowerCase().endsWith('.png');
      return isPngType || isPngExtension;
    });
    
    const nonPngFiles = allFiles.filter(file => {
      const isPngType = file.type === 'image/png';
      const isPngExtension = file.name.toLowerCase().endsWith('.png');
      return !(isPngType || isPngExtension);
    });
    
    // If no PNG files found, provide helpful error message
    if (pngFiles.length === 0) {
      if (allFiles.length > 0) {
        // We have files but no PNGs
        if (nonPngFiles.length > 0) {
          this.showError(`No PNG files found. Found ${nonPngFiles.length} non-PNG file(s). Please ensure your folders contain PNG images only.`);
        } else {
          this.showError('No PNG files found in the uploaded folders. Please check that your folders contain PNG images.');
        }
      } else {
        this.showError('Please select PNG files or folders containing PNG files.');
      }
      return;
    }

    // If we have some non-PNG files, show a warning but continue
    if (nonPngFiles.length > 0) {
      console.warn(`Found ${nonPngFiles.length} non-PNG files that will be ignored:`, nonPngFiles.map(f => f.name));
    }

    console.log(`Found ${pngFiles.length} PNG files:`, pngFiles.map(f => f.name));

    // Group files by folder structure
    const layerGroups = this.groupFilesByLayer(pngFiles);
    
    // Add to uploaded layers
    layerGroups.forEach((files, layerName) => {
      this.uploadedLayers.set(layerName, files);
    });

    this.updateLayerDisplay();
    this.updateLayerPreview();
    this.updateOptionalLayers();
  }

  groupFilesByLayer(files) {
    const groups = new Map();
    
    files.forEach(file => {
      // Extract layer name from file path or name
      let layerName = this.extractLayerName(file);
      
      if (!groups.has(layerName)) {
        groups.set(layerName, []);
      }
      
      groups.get(layerName).push(file);
    });

    return groups;
  }

  extractLayerName(file) {
    // Check if file has a path (folder upload)
    if (file.webkitRelativePath) {
      // Extract folder name from path (e.g., "00_Background/blue.png" -> "Background")
      const pathParts = file.webkitRelativePath.split('/');
      if (pathParts.length > 1) {
        const folderName = pathParts[0]; // Get the folder name
        // Extract layer name from folder name (e.g., "00_Background" -> "Background")
        const folderMatch = folderName.match(/^(\d+)_(.+)$/);
        if (folderMatch) {
          return folderMatch[2]; // Return the descriptive part
        }
        return folderName; // Fallback to full folder name
      }
    }
    
    // Fallback for individual file uploads
    const fileName = file.name;
    // Try to extract layer name from prefix (00_, 01_, etc.)
    const prefixMatch = fileName.match(/^(\d+)_(.+?)(?:\.png)?$/i);
    if (prefixMatch) {
      return prefixMatch[2].replace(/[^a-zA-Z0-9]/g, '_');
    }
    
    // Fallback: use filename without extension
    return fileName.replace(/\.png$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
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

  getLayerOrder(layerName) {
    // For folder uploads, we need to check the original folder structure
    // This will be handled by the sorting in updateLayerDisplay
    // For now, return a default order based on common layer names
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
    
    // Check if we have a predefined order
    if (layerOrderMap[layerName] !== undefined) {
      return layerOrderMap[layerName];
    }
    
    // Extract numeric prefix if it exists (for backward compatibility)
    const match = layerName.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 999;
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

    // Create optional layer toggles for layers that might be optional
    const optionalLayerNames = ['Gear', 'Accessories', 'Background', 'Effects'];
    
    this.uploadedLayers.forEach((files, layerName) => {
      const isOptional = optionalLayerNames.some(name => 
        layerName.toLowerCase().includes(name.toLowerCase())
      );
      
      if (isOptional) {
        const optionalItem = this.createOptionalLayerItem(layerName, files);
        this.optionalLayersContainer.appendChild(optionalItem);
      }
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

    this.isGenerating = true;
    this.generateBtn.disabled = true;
    this.generateBtn.innerHTML = '<span class="button-text">Generating...</span><span class="button-icon">⏳</span>';

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('collectionName', this.collectionName.value);
      formData.append('collectionSize', collectionSize);
      formData.append('collectionDescription', this.collectionDescription.value);
      formData.append('rarityMode', this.rarityMode.value);
      
      // Add layers
      this.uploadedLayers.forEach((files, layerName) => {
        files.forEach((file, index) => {
          formData.append(`layers[${layerName}][${index}]`, file);
        });
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
      this.showError('Generation failed. Please try again.');
      this.resetGenerationState();
    }
  }

  async pollGenerationProgress() {
    if (!this.generationId) {
      return;
    }

    try {
      const response = await fetch(`/api/nft-generator/status/${this.generationId}`);
      const status = await response.json();
      
      this.updateProgress(status);
      
      if (status.status === 'completed') {
        this.generationCompleted(status);
      } else if (status.status === 'failed') {
        this.generationFailed(status.error);
      } else {
        // Continue polling
        setTimeout(() => this.pollGenerationProgress(), 2000);
      }
      
    } catch (error) {
      console.error('Progress polling error:', error);
      this.generationFailed('Failed to check generation progress');
    }
  }

  updateProgress(status) {
    this.progressBar.style.display = 'block';
    this.progressFill.style.width = `${status.progress || 0}%`;
    this.statusText.textContent = status.message || 'Generating...';
    this.statusDetails.textContent = status.details || '';
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
}

// Initialize the art engine when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BitHeadzArtEngine();
}); 