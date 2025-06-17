// BitHeadzArtEngine Tool JavaScript
class BitHeadzArtEngine {
  constructor() {
    this.uploadedLayers = new Map();
    this.layerStructure = [];
    this.generationId = null;
    this.isGenerating = false;
    this.originalFileData = new Map(); // Store original file data with webkitRelativePath
    this.hasRealProgress = false;
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupPageUnloadHandler();
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
    this.activeLayersContainer = document.getElementById('activeLayers');
    
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
    
    // Modal elements
    this.progressModal = document.getElementById('progressModal');
    this.modalProgressPercentage = document.getElementById('modalProgressPercentage');
    this.modalProgressCounter = document.getElementById('modalProgressCounter');
    this.modalProgressMessage = document.getElementById('modalProgressMessage');
    this.modalProgressDetails = document.getElementById('modalProgressDetails');
    this.cancelGenerationBtn = document.getElementById('cancelGenerationBtn');
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
    
    // Cancel button
    this.cancelGenerationBtn.addEventListener('click', this.cancelGeneration.bind(this));
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
    this.activeLayersContainer.innerHTML = '';
    
    if (this.uploadedLayers.size === 0) {
      return;
    }

    // Make ALL layers optional
    this.uploadedLayers.forEach((files, layerName) => {
      const optionalItem = this.createOptionalLayerItem(layerName, files);
      this.activeLayersContainer.appendChild(optionalItem);
    });
  }

  createOptionalLayerItem(layerName, files) {
    const item = document.createElement('div');
    item.className = 'active-layer-item';
    
    const layerHeader = document.createElement('div');
    layerHeader.className = 'active-layer-header';
    
    const layerNameEl = document.createElement('div');
    layerNameEl.className = 'active-layer-name';
    layerNameEl.textContent = layerName;
    
    const layerToggle = document.createElement('div');
    layerToggle.className = 'active-layer-toggle';
    
    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'toggle-switch active';
    toggleSwitch.dataset.layer = layerName;
    toggleSwitch.addEventListener('click', () => this.toggleActiveLayer(toggleSwitch));
    
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Active';
    toggleLabel.style.color = '#4296d2';
    toggleLabel.style.fontSize = '0.875rem';
    
    layerToggle.appendChild(toggleSwitch);
    layerToggle.appendChild(toggleLabel);
    
    layerHeader.appendChild(layerNameEl);
    layerHeader.appendChild(layerToggle);
    
    const layerProbability = document.createElement('div');
    layerProbability.className = 'active-layer-probability';
    
    const probabilityLabel = document.createElement('span');
    probabilityLabel.className = 'probability-label';
    probabilityLabel.textContent = 'Probability:';
    
    const probabilityInput = document.createElement('input');
    probabilityInput.type = 'number';
    probabilityInput.className = 'probability-input';
    probabilityInput.min = '0';
    probabilityInput.max = '100';
    probabilityInput.value = '100';
    probabilityInput.dataset.layer = layerName;
    probabilityInput.addEventListener('change', () => this.updateLayerProbability(layerName, probabilityInput.value));
    
    const probabilitySuffix = document.createElement('span');
    probabilitySuffix.className = 'probability-label';
    probabilitySuffix.textContent = '%';
    
    layerProbability.appendChild(probabilityLabel);
    layerProbability.appendChild(probabilityInput);
    layerProbability.appendChild(probabilitySuffix);
    
    const layerDescription = document.createElement('div');
    layerDescription.style.fontSize = '0.875rem';
    layerDescription.style.color = '#6b7280';
    layerDescription.style.marginTop = '0.5rem';
    layerDescription.textContent = `${files.length} variants available`;
    
    item.appendChild(layerHeader);
    item.appendChild(layerProbability);
    item.appendChild(layerDescription);
    
    return item;
  }

  toggleActiveLayer(toggleSwitch) {
    toggleSwitch.classList.toggle('active');
    const layerName = toggleSwitch.dataset.layer;
    const isActive = toggleSwitch.classList.contains('active');
    
    // Update the label
    const label = toggleSwitch.nextElementSibling;
    label.textContent = isActive ? 'Active' : 'Inactive';
    label.style.color = isActive ? '#4296d2' : '#6b7280';
    
    // Update probability input state
    const probabilityInput = document.querySelector(`input[data-layer="${layerName}"]`);
    if (probabilityInput) {
      probabilityInput.disabled = !isActive;
      probabilityInput.style.opacity = isActive ? '1' : '0.5';
    }
  }

  updateLayerProbability(layerName, probability) {
    console.log(`Layer ${layerName} probability updated to ${probability}%`);
  }

  // Calculate maximum possible unique combinations
  calculateMaxCombinations() {
    let total = 1;
    this.uploadedLayers.forEach((files, layerName) => {
      const toggle = document.querySelector(`.toggle-switch[data-layer="${layerName}"]`);
      const isActive = toggle && toggle.classList.contains('active');
      
      if (!isActive) return;
      
      const probabilityInput = document.querySelector(`input[data-layer="${layerName}"]`);
      const probability = probabilityInput ? parseInt(probabilityInput.value) : 100;
      
      if (probability === 0) return;
      
      total *= files.length;
    });
    return total;
  }

  // Show uniqueness warning modal
  showUniquenessWarning(maxCombinations, requestedSize) {
    return new Promise((resolve) => {
      // Create modal HTML
      const modalHTML = `
        <div class="modal" id="uniquenessWarningModal">
          <div class="modal-content">
            <div class="modal-header">
              <h3>⚠️ Uniqueness Warning</h3>
            </div>
            <div class="modal-body">
              <p>You're requesting <strong>${requestedSize} NFTs</strong>, but your uploaded layers can only generate <strong>${maxCombinations} unique combinations</strong>.</p>
              <p>This means some NFTs will be duplicates, which may not be desirable for your collection.</p>
              <div class="warning-options">
                <p><strong>Options:</strong></p>
                <ul>
                  <li>📁 Upload more trait variations to increase unique combinations</li>
                  <li>📊 Reduce your collection size to ${maxCombinations} or fewer</li>
                  <li>⚙️ Adjust layer probabilities to include more variations</li>
                </ul>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" id="cancelGeneration">Cancel</button>
              <button class="btn btn-warning" id="generateAnyway">Generate Anyway</button>
            </div>
          </div>
        </div>
      `;
      
      // Add modal to page
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      const modal = document.getElementById('uniquenessWarningModal');
      const cancelBtn = document.getElementById('cancelGeneration');
      const generateBtn = document.getElementById('generateAnyway');
      
      // Handle button clicks
      cancelBtn.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });
      
      generateBtn.addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });
      
      // Show modal
      modal.style.display = 'flex';
    });
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

    // Check for uniqueness before generation
    const maxCombinations = this.calculateMaxCombinations();
    let allowDuplicates = false;
    if (collectionSize > maxCombinations) {
      const proceed = await this.showUniquenessWarning(maxCombinations, collectionSize);
      if (!proceed) {
        return;
      }
      allowDuplicates = true;
    }

    this.isGenerating = true;
    this.generateBtn.disabled = true;
    this.generateBtn.innerHTML = '<span class="button-text">Generating...</span><span class="button-icon">⏳</span>';

    // Show progress modal
    this.showProgressModal();

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('collectionName', this.collectionName.value);
      formData.append('collectionSize', collectionSize);
      formData.append('collectionDescription', this.collectionDescription.value);
      formData.append('customCID', this.customCID.value.trim());
      formData.append('rarityMode', this.rarityMode.value);
      
      // Add all files with their original paths
      const allFiles = [];
      this.uploadedLayers.forEach((files, layerName) => {
        files.forEach(file => {
          const originalFileData = this.findOriginalFileData(file);
          if (originalFileData) {
            allFiles.push(originalFileData);
          } else {
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
      
      // Add active layer settings with probabilities
      const activeLayers = {};
      document.querySelectorAll('.toggle-switch').forEach(toggle => {
        const layerName = toggle.dataset.layer;
        const isActive = toggle.classList.contains('active');
        const probabilityInput = document.querySelector(`input[data-layer="${layerName}"]`);
        const probability = probabilityInput ? parseInt(probabilityInput.value) : 100;
        
        activeLayers[layerName] = {
          active: isActive,
          probability: probability
        };
      });
      formData.append('activeLayers', JSON.stringify(activeLayers));

      // Add flag to allow duplicates if user chose to proceed anyway
      formData.append('allowDuplicates', allowDuplicates.toString());

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
      this.hideProgressModal();
      this.isGenerating = false;
      this.generateBtn.disabled = false;
      this.generateBtn.innerHTML = '<span class="button-text">Generate Collection</span><span class="button-icon">🚀</span>';
    }
  }

  showProgressModal() {
    this.progressModal.style.display = 'flex';
    this.updateModalProgress(0, 0, parseInt(this.collectionSize.value), 'Preparing layers...');
    
    // Start showing initial progress immediately
    this.startModalProgressAnimation();
  }

  startModalProgressAnimation() {
    let currentProgress = 0;
    const targetProgress = parseInt(this.collectionSize.value);
    
    const animateProgress = () => {
      if (!this.isGenerating) return;
      
      // Only show initial animation if we don't have real progress yet
      if (currentProgress < 5 && !this.hasRealProgress) {
        currentProgress += 0.1;
        this.updateModalProgress(0, currentProgress, targetProgress, 'Preparing layers...', 'Organizing uploaded files');
      } else if (currentProgress < 10 && !this.hasRealProgress) {
        currentProgress += 0.05;
        this.updateModalProgress(0, currentProgress, targetProgress, 'Validating layer structure...', 'Checking layer compatibility');
      } else if (currentProgress < 15 && !this.hasRealProgress) {
        currentProgress += 0.03;
        this.updateModalProgress(0, currentProgress, targetProgress, 'Initializing generation...', 'Setting up generation engine');
      }
      
      requestAnimationFrame(animateProgress);
    };
    
    animateProgress();
  }

  hideProgressModal() {
    this.progressModal.style.display = 'none';
    this.hasRealProgress = false;
  }

  updateModalProgress(current, total, target, message, details = '') {
    // Calculate percentage based on actual NFT count, not the backend progress
    const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
    
    // Update modal elements
    this.modalProgressPercentage.textContent = `${percentage}%`;
    this.modalProgressCounter.textContent = `${current} / ${target}`;
    this.modalProgressMessage.textContent = message;
    this.modalProgressDetails.textContent = details;
    
    // Update progress circle
    const progressCircle = document.querySelector('.progress-circle');
    if (progressCircle) {
      const degrees = (percentage / 100) * 360;
      progressCircle.style.background = `conic-gradient(#4296d2 ${degrees}deg, #2a2a2a ${degrees}deg)`;
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
        const pollInterval = collectionSize > 5000 ? 1000 : collectionSize > 1000 ? 1500 : 1000;
        setTimeout(() => this.pollGenerationProgress(), pollInterval);
      }
      
    } catch (error) {
      console.error('Progress polling error:', error);
      
      // Don't immediately fail on network errors, continue polling
      if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
        console.log('Network error, retrying in 3 seconds...');
        setTimeout(() => this.pollGenerationProgress(), 3000);
        return;
      }
      
      // For other errors, show a warning but continue polling
      console.log('Polling error, continuing to poll...');
      const collectionSize = parseInt(this.collectionSize.value);
      const pollInterval = collectionSize > 5000 ? 1000 : collectionSize > 1000 ? 1500 : 1000;
      setTimeout(() => this.pollGenerationProgress(), pollInterval);
    }
  }

  updateProgress(status) {
    // Calculate actual percentage based on NFT count
    const collectionSize = parseInt(this.collectionSize.value);
    const current = status.totalGenerated || 0;
    const actualPercentage = collectionSize > 0 ? Math.round((current / collectionSize) * 100) : 0;
    
    this.progressBar.style.display = 'block';
    this.progressFill.style.width = `${actualPercentage}%`;
    
    // Enhanced progress message
    let progressMessage = status.message || 'Generating...';
    
    // Add NFT count if available
    if (status.totalGenerated !== undefined && collectionSize) {
      progressMessage = `${status.totalGenerated} of ${collectionSize} NFTs generated`;
    }
    
    this.statusText.textContent = progressMessage;
    this.statusDetails.textContent = status.details || '';
    
    // Update modal progress with real backend data
    const target = collectionSize;
    const percentage = status.progress || 0;
    
    // Mark that we have real progress now
    this.hasRealProgress = true;
    
    // Provide more detailed progress messages based on real progress
    let modalMessage = progressMessage;
    let modalDetails = status.details || '';
    
    if (actualPercentage < 10) {
      modalMessage = 'Preparing generation...';
      modalDetails = 'Organizing layers and validating structure';
    } else if (actualPercentage < 25) {
      modalMessage = 'Starting generation...';
      modalDetails = 'Initializing NFT creation process';
    } else if (actualPercentage < 50) {
      modalMessage = 'Generating NFTs...';
      modalDetails = `Processing batch - ${current} NFTs created`;
    } else if (actualPercentage < 75) {
      modalMessage = 'Continuing generation...';
      modalDetails = `Generated ${current} NFTs so far`;
    } else if (actualPercentage < 95) {
      modalMessage = 'Finalizing collection...';
      modalDetails = `Almost done! ${current} NFTs generated`;
    } else {
      modalMessage = 'Creating download package...';
      modalDetails = 'Preparing files for download';
    }
    
    // Update modal with real progress - use actual NFT count for percentage
    this.updateModalProgress(current, actualPercentage, target, modalMessage, modalDetails);
    
    // Add visual indicator for large collections
    if (collectionSize > 500) {
      this.statusDetails.textContent = `${actualPercentage}% complete - ${status.details || ''}`;
    }
  }

  generationCompleted(status) {
    this.statusText.textContent = 'Generation completed!';
    this.statusDetails.textContent = `Generated ${status.totalGenerated} NFTs successfully`;
    
    // Hide progress modal
    this.hideProgressModal();
    
    // Show download section
    this.downloadSection.style.display = 'block';
    
    // Show success message with special warning for large collections
    const collectionSize = parseInt(this.collectionSize.value);
    if (collectionSize > 5000) {
      this.showSuccess(`Generation completed! ⚠️ Large collection detected - files will be automatically cleaned up in 60 minutes. Please download now.`);
    } else if (collectionSize > 1000) {
      this.showSuccess(`Generation completed! ⚠️ Large collection detected - files will be automatically cleaned up in 60 minutes.`);
    } else {
      this.showSuccess('Generation completed successfully!');
    }
    
    this.resetGenerationState();
  }

  generationFailed(error) {
    this.statusText.textContent = 'Generation failed';
    this.statusDetails.textContent = error;
    this.showError(error);
    
    // Update modal with error
    this.updateModalProgress(0, 0, parseInt(this.collectionSize.value), 'Generation failed', error);
    
    // Hide modal after a short delay
    setTimeout(() => {
      this.hideProgressModal();
    }, 3000);
    
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

    // Disable download button to prevent multiple clicks
    this.downloadBtn.disabled = true;
    this.downloadBtn.innerHTML = '<span class="button-text">Preparing Download...</span><span class="button-icon">⏳</span>';

    try {
      console.log('Starting download for generation:', this.generationId);
      
      // First check if the job is still available
      const statusResponse = await fetch(`/api/nft-generator/status/${this.generationId}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error('Generation job not found. The files may have been cleaned up due to timeout.');
      }
      
      const status = await statusResponse.json();
      
      if (status.status !== 'completed') {
        throw new Error('Generation not completed. Please wait for generation to finish.');
      }
      
      // Show download starting message
      this.downloadBtn.innerHTML = '<span class="button-text">Starting Download...</span><span class="button-icon">📥</span>';
      
      // Start download with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
      const response = await fetch(`/api/nft-generator/download/${this.generationId}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
              throw new Error('Download file not found. The files may have been cleaned up.');
        } else if (response.status === 500) {
              throw new Error('Server error during download. Please try again.');
        } else {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }
      }

          // Check if response is actually a file
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/zip')) {
            throw new Error('Invalid response format. Expected zip file.');
          }

          // Get file size for progress tracking
          const contentLength = response.headers.get('content-length');
          const fileSize = contentLength ? parseInt(contentLength) : 0;
          
          if (fileSize > 0) {
            console.log(`Downloading file: ${Math.round(fileSize / 1024 / 1024)}MB`);
      }

          // Create blob from response
      const blob = await response.blob();
      
      if (blob.size === 0) {
            throw new Error('Downloaded file is empty.');
      }

          // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
          a.href = url;
          a.download = `${status.collectionName || 'collection'}_collection.zip`;
      
          // Trigger download
      document.body.appendChild(a);
      a.click();
          
          // Cleanup
          window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
          // Success!
          this.downloadBtn.innerHTML = '<span class="button-text">Download Complete!</span><span class="button-icon">✅</span>';
          this.showSuccess('Download completed successfully!');
          
          // Reset button after a delay
      setTimeout(() => {
            this.downloadBtn.disabled = false;
            this.downloadBtn.innerHTML = '<span class="button-text">Download Collection</span><span class="button-icon">📥</span>';
          }, 3000);
          
          return; // Success, exit retry loop
          
        } catch (downloadError) {
          retryCount++;
          console.error(`Download attempt ${retryCount} failed:`, downloadError);
          
          if (retryCount >= maxRetries) {
            throw downloadError; // Re-throw on final attempt
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
          this.downloadBtn.innerHTML = `<span class="button-text">Retrying... (${retryCount}/${maxRetries})</span><span class="button-icon">🔄</span>`;
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
    } catch (error) {
      console.error('Download error:', error);
      
      // Reset button
      this.downloadBtn.disabled = false;
      this.downloadBtn.innerHTML = '<span class="button-text">Download Collection</span><span class="button-icon">📥</span>';
      
      // Show specific error messages
      let errorMessage = 'Download failed';
      if (error.message.includes('not found') || error.message.includes('cleaned up')) {
        errorMessage = 'Download failed: Files have been cleaned up. Please regenerate your collection.';
      } else if (error.message.includes('timeout') || error.message.includes('fetch')) {
        errorMessage = 'Download failed: Connection timeout. Please check your internet connection and try again.';
      } else if (error.message.includes('empty')) {
        errorMessage = 'Download failed: Generated file is corrupted. Please regenerate your collection.';
      } else {
        errorMessage = `Download failed: ${error.message}`;
      }
      
      this.showError(errorMessage);
    }
  }

  showSuccess(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: rgba(40, 167, 69, 0.9);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      font-weight: 600;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 5000);
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

  setupPageUnloadHandler() {
    // Clean up when user leaves the page
    window.addEventListener('beforeunload', () => {
      if (this.isGenerating && this.generationId) {
        // Send a beacon to cancel the generation
        navigator.sendBeacon(`/api/nft-generator/cancel/${this.generationId}`);
      }
    });

    // Also handle page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.isGenerating && this.generationId) {
        // User switched tabs or minimized - we could cancel here too if needed
        console.log('User left the page during generation');
      }
    });
  }

  async cancelGeneration() {
    if (!this.generationId) {
      this.showError('No generation to cancel.');
      return;
    }

    try {
      const response = await fetch(`/api/nft-generator/cancel/${this.generationId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Cancellation failed: ${response.statusText}`);
      }

      this.generationId = null;
      this.isGenerating = false;
      this.generateBtn.disabled = false;
      this.generateBtn.innerHTML = '<span class="button-text">Generate Collection</span><span class="button-icon">🚀</span>';
      this.hideProgressModal();
      this.showSuccess('Generation cancelled successfully!');
      
    } catch (error) {
      console.error('Cancellation error:', error);
      this.showError(`Cancellation failed: ${error.message}`);
    }
  }
}

// Initialize the art engine when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BitHeadzArtEngine();
  document.querySelectorAll('.collapse-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.dataset.target);
      if (target) {
        target.classList.toggle('active');
        const arrow = btn.querySelector('.arrow');
        const label = btn.querySelector('span');
        if (target.classList.contains('active')) {
          arrow.textContent = '▼';
          label.textContent = label.textContent.replace('Show', 'Hide');
        } else {
          arrow.textContent = '▶';
          label.textContent = label.textContent.replace('Hide', 'Show');
        }
      }
    });
  });

  // Initialize Advanced Details in How To Use as collapsed by default
  const advancedDetailsToggle = document.querySelector('.advanced-details-section .collapse-toggle');
  const advancedDetailsContent = document.getElementById('advancedDetailsContent');
  const advancedDetailsArrow = advancedDetailsToggle ? advancedDetailsToggle.querySelector('.arrow') : null;

  if (advancedDetailsContent && advancedDetailsToggle && advancedDetailsArrow) {
    advancedDetailsContent.classList.remove('active'); // Ensure it starts collapsed
    advancedDetailsArrow.textContent = '▶';
    advancedDetailsToggle.querySelector('span').textContent = advancedDetailsToggle.querySelector('span').textContent.replace('Hide', 'Show');
  }
});

// Global function for copying donation address
window.copyDonationAddress = async function() {
  const address = '5Zd2EiC7S2DaT5mQyC1etYmusNPyEQtHDgojdf5oLHLE';
  
  try {
    await navigator.clipboard.writeText(address);
    
    // Show success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: rgba(40, 167, 69, 0.9);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      font-weight: 600;
    `;
    successDiv.textContent = 'Address copied to clipboard!';
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
    
  } catch (error) {
    console.error('Failed to copy address:', error);
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = address;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Show success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: rgba(40, 167, 69, 0.9);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      font-weight: 600;
    `;
    successDiv.textContent = 'Address copied to clipboard!';
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }
}; 