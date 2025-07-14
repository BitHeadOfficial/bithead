// Trait Analyzer Tool JavaScript
// Handles uploading, parsing, and analyzing NFT metadata JSON files for trait rarity

document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('uploadArea');
  const metadataInput = document.getElementById('metadataInput');
  const uploadedFilesContainer = document.getElementById('uploadedFiles');
  const resultsTableContainer = document.getElementById('resultsTableContainer');
  const chartSection = document.getElementById('chartSection');
  const traitChartSelect = document.getElementById('traitChartSelect');
  const traitChartCanvas = document.getElementById('traitChart');
  let chartInstance = null;
  // Multi-trait heatmap elements
  const multiHeatmapSection = document.getElementById('multiHeatmapSection');
  const multiTraitSelectors = document.getElementById('multiTraitSelectors');
  const multiTraitHeatmap = document.getElementById('multiTraitHeatmap');
  let multiHeatmapInstance = null;

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
    let allAttributes = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const text = await files[i].text();
        const data = JSON.parse(text);
        if (Array.isArray(data.attributes)) {
          allAttributes.push(data.attributes);
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
    lastTableData = { rows, errorCount, traitCounts, allFiles: files, allAttributes: allAttributes };
    lastTotalFiles = totalFiles;
    renderResultsTable(lastTableData, totalFiles, errorCount, traitSearchInput.value);
    renderTraitChartDropdown(traitCounts);
    renderMultiTraitHeatmapUI(traitCounts, allAttributes);
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

  function renderTraitChartDropdown(traitCounts) {
    // Clear previous
    traitChartSelect.innerHTML = '';
    if (!traitCounts || traitCounts.size === 0) {
      chartSection.style.display = 'none';
      return;
    }
    // Populate dropdown
    Array.from(traitCounts.keys()).forEach(trait => {
      const opt = document.createElement('option');
      opt.value = trait;
      opt.textContent = trait;
      traitChartSelect.appendChild(opt);
    });
    chartSection.style.display = '';
    // Draw chart for first trait by default
    renderTraitChart(traitChartSelect.value);
  }

  traitChartSelect.addEventListener('change', () => {
    renderTraitChart(traitChartSelect.value);
  });

  function renderTraitChart(traitType) {
    if (!lastTableData || !lastTableData.traitCounts || !traitType) {
      chartSection.style.display = 'none';
      return;
    }
    const valueMap = lastTableData.traitCounts.get(traitType);
    if (!valueMap) {
      chartSection.style.display = 'none';
      return;
    }
    const labels = Array.from(valueMap.keys());
    const data = Array.from(valueMap.values());
    // Destroy previous chart if exists
    if (chartInstance) {
      chartInstance.destroy();
    }
    chartInstance = new Chart(traitChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: `Count of "${traitType}" values`,
          data,
          backgroundColor: '#4296d2',
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#fff', font: { weight: 600 } },
            grid: { color: '#2a2a2a' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#fff' },
            grid: { color: '#2a2a2a' }
          }
        }
      }
    });
  }

  // Multi-trait heatmap logic
  // Utility: get most common traits
  function getMostCommonTraits(traitCounts) {
    if (!traitCounts) return [];
    return Array.from(traitCounts.entries())
      .sort((a, b) => Array.from(b[1].values()).reduce((x, y) => x + y, 0) - Array.from(a[1].values()).reduce((x, y) => x + y, 0))
      .map(([trait]) => trait);
  }

  function renderMultiTraitHeatmapUI(traitCounts, allAttributes) {
    multiTraitSelectors.innerHTML = '';
    if (!traitCounts || traitCounts.size < 2) {
      multiHeatmapSection.style.display = 'none';
      return;
    }
    // Build selectors for all traits
    const traitNames = Array.from(traitCounts.keys());
    const mostCommon = getMostCommonTraits(traitCounts);
    // Axis selectors
    const rowTraitSel = document.createElement('select');
    rowTraitSel.id = 'rowTraitSel';
    traitNames.forEach(trait => {
      const opt = document.createElement('option');
      opt.value = trait;
      opt.textContent = trait;
      rowTraitSel.appendChild(opt);
    });
    const colTraitSel = document.createElement('select');
    colTraitSel.id = 'colTraitSel';
    traitNames.forEach(trait => {
      const opt = document.createElement('option');
      opt.value = trait;
      opt.textContent = trait;
      colTraitSel.appendChild(opt);
    });
    // Default: most common and second most common trait
    if (mostCommon.length > 1) {
      rowTraitSel.value = mostCommon[0];
      colTraitSel.value = mostCommon[1];
    } else {
      colTraitSel.selectedIndex = 1;
    }
    // Filter selectors for all other traits
    const filterSelectors = {};
    traitNames.forEach(trait => {
      if (trait === rowTraitSel.value || trait === colTraitSel.value) return;
      const sel = document.createElement('select');
      sel.id = 'filter_' + trait;
      sel.multiple = true;
      sel.size = 3;
      sel.style.minWidth = '120px';
      sel.style.maxWidth = '180px';
      sel.style.background = '#1a1a1a';
      sel.style.color = '#fff';
      sel.style.border = '1px solid #4296d2';
      sel.style.borderRadius = '6px';
      sel.style.padding = '0.2rem 0.5rem';
      const label = document.createElement('label');
      label.textContent = trait;
      label.style.color = '#4296d2';
      label.style.fontWeight = '600';
      label.style.display = 'block';
      // Populate options
      Array.from(traitCounts.get(trait).keys()).forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        sel.appendChild(opt);
      });
      filterSelectors[trait] = sel;
      const wrapper = document.createElement('div');
      wrapper.appendChild(label);
      wrapper.appendChild(sel);
      multiTraitSelectors.appendChild(wrapper);
    });
    // Axis selectors UI
    const rowLabel = document.createElement('label');
    rowLabel.textContent = 'Row Trait:';
    rowLabel.style.color = '#4296d2';
    rowLabel.style.fontWeight = '600';
    rowLabel.style.marginRight = '0.5rem';
    const colLabel = document.createElement('label');
    colLabel.textContent = 'Column Trait:';
    colLabel.style.color = '#4296d2';
    colLabel.style.fontWeight = '600';
    colLabel.style.marginRight = '0.5rem';
    multiTraitSelectors.prepend(colLabel, colTraitSel);
    multiTraitSelectors.prepend(rowLabel, rowTraitSel);
    // Show section
    multiHeatmapSection.style.display = '';
    // Redraw on change
    function updateHeatmap() {
      renderMultiTraitHeatmap(rowTraitSel.value, colTraitSel.value, filterSelectors, allAttributes);
    }
    rowTraitSel.addEventListener('change', updateHeatmap);
    colTraitSel.addEventListener('change', updateHeatmap);
    Object.values(filterSelectors).forEach(sel => sel.addEventListener('change', updateHeatmap));
    updateHeatmap();
  }

  function renderMultiTraitHeatmap(rowTrait, colTrait, filterSelectors, allAttributes) {
    if (!rowTrait || !colTrait || rowTrait === colTrait) return;
    // Get selected filter values
    const filters = {};
    Object.entries(filterSelectors).forEach(([trait, sel]) => {
      const vals = Array.from(sel.selectedOptions).map(opt => opt.value);
      if (vals.length > 0) filters[trait] = vals;
    });
    // Build matrix: rows = rowTrait values, cols = colTrait values
    const rowVals = Array.from(new Set(allAttributes.flatMap(attrs => attrs.filter(a => a.trait_type === rowTrait).map(a => a.value))));
    const colVals = Array.from(new Set(allAttributes.flatMap(attrs => attrs.filter(a => a.trait_type === colTrait).map(a => a.value))));
    // Count occurrences for each (row, col) pair, filtered
    const matrix = [];
    let maxCount = 1;
    rowVals.forEach((rowVal, i) => {
      colVals.forEach((colVal, j) => {
        // Count NFTs with rowTrait=rowVal, colTrait=colVal, and all filters
        let count = 0;
        allAttributes.forEach(attrs => {
          const hasRow = attrs.some(a => a.trait_type === rowTrait && a.value === rowVal);
          const hasCol = attrs.some(a => a.trait_type === colTrait && a.value === colVal);
          if (!hasRow || !hasCol) return;
          // Check all filters
          let pass = true;
          for (const [fTrait, fVals] of Object.entries(filters)) {
            if (!attrs.some(a => a.trait_type === fTrait && fVals.includes(a.value))) {
              pass = false;
              break;
            }
          }
          if (pass) count++;
        });
        if (count > maxCount) maxCount = count;
        matrix.push({x: j, y: i, v: count});
      });
    });
    // Draw heatmap
    if (multiHeatmapInstance) multiHeatmapInstance.destroy();
    // Show/hide no data message
    const noDataDiv = document.getElementById('multiHeatmapNoData');
    if (matrix.every(cell => cell.v === 0)) {
      noDataDiv.style.display = '';
    } else {
      noDataDiv.style.display = 'none';
    }
    // Color legend
    const legendDiv = document.getElementById('multiHeatmapLegend');
    legendDiv.innerHTML = '';
    const legendBar = document.createElement('div');
    legendBar.className = 'heatmap-legend-bar';
    legendBar.style.background = 'linear-gradient(90deg, #23272f 0%, #4296d2 100%)';
    legendDiv.appendChild(legendBar);
    const minLabel = document.createElement('span');
    minLabel.className = 'heatmap-legend-label';
    minLabel.textContent = '0';
    legendDiv.appendChild(minLabel);
    const maxLabel = document.createElement('span');
    maxLabel.className = 'heatmap-legend-label';
    maxLabel.textContent = maxCount;
    legendDiv.appendChild(maxLabel);
    multiHeatmapInstance = new Chart(multiTraitHeatmap, {
      type: 'matrix',
      data: {
        datasets: [{
          label: 'Trait Combination Count',
          data: matrix,
          backgroundColor: ctx => {
            const v = ctx.raw.v;
            if (v === 0) return '#23272f';
            // Blue scale
            const alpha = Math.min(0.9, 0.2 + (maxCount ? v / maxCount : 0));
            return `rgba(66,150,210,${alpha})`;
          },
          borderWidth: 1,
          borderColor: '#181c22',
          width: ({chart}) => (chart.chartArea || {}).width / (colVals.length || 1) - 2,
          height: ({chart}) => (chart.chartArea || {}).height / (rowVals.length || 1) - 2,
          // Show count in each cell
          datalabels: {
            display: true,
            color: '#fff',
            font: { weight: 'bold', size: 13 },
            align: 'center',
            anchor: 'center',
            formatter: v => v.v > 0 ? v.v : ''
          }
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => {
                const d = ctx[0].raw;
                return `${rowTrait}: ${rowVals[d.y]}, ${colTrait}: ${colVals[d.x]}`;
              },
              label: ctx => `Count: ${ctx.raw.v}`
            }
          },
          datalabels: {
            display: true,
            color: '#fff',
            font: { weight: 'bold', size: 13 },
            align: 'center',
            anchor: 'center',
            formatter: v => v.v > 0 ? v.v : ''
          }
        },
        scales: {
          x: {
            type: 'category',
            labels: colVals,
            title: { display: true, text: colTrait, color: '#4296d2', font: { weight: 700, size: 16 } },
            ticks: { color: '#fff', font: { weight: 600, size: 13 }, autoSkip: false, maxRotation: 45, minRotation: 20 },
            grid: { color: '#2a2a2a' }
          },
          y: {
            type: 'category',
            labels: rowVals,
            title: { display: true, text: rowTrait, color: '#4296d2', font: { weight: 700, size: 16 } },
            ticks: { color: '#fff', font: { weight: 600, size: 13 }, autoSkip: false, maxRotation: 0 },
            grid: { color: '#2a2a2a' }
          }
        }
      }
    });
  }

  // Simple HTML escape
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[m];
    });
  }
}); 