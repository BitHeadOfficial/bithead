// Trait Analyzer Tool JavaScript
// Handles uploading, parsing, and analyzing NFT metadata JSON files for trait rarity

document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('uploadArea');
  const metadataInput = document.getElementById('metadataInput');
  const uploadedFilesContainer = document.getElementById('uploadedFiles');
  const resultsTableContainer = document.getElementById('resultsTableContainer');

  // Add search/filter and CSV export UI
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'trait-analyzer-controls';
  controlsDiv.innerHTML = `
    <input type="text" id="traitSearchInput" placeholder="Search trait type or value..." class="trait-search-input" />
    <button id="exportCsvBtn" class="export-csv-btn">Export CSV</button>
  `;
  resultsTableContainer.parentNode.insertBefore(controlsDiv, resultsTableContainer);
  const traitSearchInput = controlsDiv.querySelector('#traitSearchInput');
  const exportCsvBtn = controlsDiv.querySelector('#exportCsvBtn');

  let lastTableData = [];
  let lastTotalFiles = 0;

  traitSearchInput.addEventListener('input', () => {
    renderResultsTable(lastTableData, lastTotalFiles, lastTableData.errorCount, traitSearchInput.value);
  });

  exportCsvBtn.addEventListener('click', () => {
    if (!lastTableData || !lastTableData.rows) return;
    const csvRows = [
      ['Trait Type', 'Value', 'Count', 'Percent'],
      ...lastTableData.rows.map(row => [row.trait, row.value, row.count, row.percent])
    ];
    const csvContent = csvRows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trait-rarity.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  });

  // UI: Click upload area to open file dialog
  uploadArea.addEventListener('click', () => metadataInput.click());

  // UI: Drag & drop support
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  // File input change
  metadataInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.json'));
    if (files.length === 0) {
      showError('No JSON files found. Please upload valid metadata files.');
      return;
    }
    if (files.length > 10000) {
      showError('Please upload no more than 10,000 files at once.');
      return;
    }
    showFiles(files);
    analyzeTraits(files);
  }

  function showFiles(files) {
    uploadedFilesContainer.innerHTML = '';
    const info = document.createElement('div');
    info.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} uploaded.`;
    uploadedFilesContainer.appendChild(info);
  }

  async function analyzeTraits(files) {
    resultsTableContainer.innerHTML = '<p>Analyzing files, please wait...</p>';
    // Use a Map for trait counts: { trait_type: { value: count } }
    const traitCounts = new Map();
    let totalFiles = 0;
    let errorCount = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const text = await files[i].text();
        const data = JSON.parse(text);
        if (Array.isArray(data.attributes)) {
          data.attributes.forEach(attr => {
            if (!attr || typeof attr !== 'object') return;
            const trait = attr.trait_type || attr.type || 'Unknown';
            const value = attr.value || 'None';
            if (!traitCounts.has(trait)) traitCounts.set(trait, new Map());
            const valueMap = traitCounts.get(trait);
            valueMap.set(value, (valueMap.get(value) || 0) + 1);
          });
        }
        totalFiles++;
      } catch (err) {
        errorCount++;
      }
      // For large uploads, update progress every 1000 files
      if ((i+1) % 1000 === 0) {
        resultsTableContainer.innerHTML = `<p>Processed ${i+1} of ${files.length} files...</p>`;
      }
    }
    // Prepare flat table data for filtering and CSV
    const rows = [];
    Array.from(traitCounts.entries()).sort().forEach(([trait, valueMap]) => {
      Array.from(valueMap.entries()).sort((a, b) => b[1] - a[1]).forEach(([value, count]) => {
        const percent = ((count / totalFiles) * 100).toFixed(2);
        rows.push({ trait, value, count, percent: percent + '%' });
      });
    });
    lastTableData = { rows, errorCount };
    lastTotalFiles = totalFiles;
    renderResultsTable(lastTableData, totalFiles, errorCount, traitSearchInput.value);
  }

  function renderResultsTable(tableData, totalFiles, errorCount, filter = '') {
    if (!tableData || !tableData.rows || totalFiles === 0) {
      resultsTableContainer.innerHTML = '<p class="no-results">No valid metadata files processed.</p>';
      return;
    }
    let html = `<div class="rarity-summary">Processed <b>${totalFiles}</b> files.`;
    if (errorCount > 0) html += ` <span style="color:#dc3545">(${errorCount} errors)</span>`;
    html += '</div>';
    html += '<div class="rarity-table-scroll"><table class="rarity-table"><thead><tr><th>Trait Type</th><th>Value</th><th>Count</th><th>Percent</th></tr></thead><tbody>';
    const filterLower = (filter || '').toLowerCase();
    const filteredRows = tableData.rows.filter(row =>
      row.trait.toLowerCase().includes(filterLower) || row.value.toLowerCase().includes(filterLower)
    );
    filteredRows.forEach(row => {
      html += `<tr><td>${escapeHtml(row.trait)}</td><td>${escapeHtml(row.value)}</td><td>${row.count}</td><td>${row.percent}</td></tr>`;
    });
    html += '</tbody></table></div>';
    if (filteredRows.length === 0) {
      html += '<div class="no-results">No traits match your search.</div>';
    }
    resultsTableContainer.innerHTML = html;
  }

  function showError(msg) {
    resultsTableContainer.innerHTML = `<p class="no-results" style="color:#dc3545">${msg}</p>`;
  }

  // Simple HTML escape
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[m];
    });
  }
}); 