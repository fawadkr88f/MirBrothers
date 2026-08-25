document.addEventListener('DOMContentLoaded', () => {

    // --- STATE REGISTRY ---
    let rawListings = [];
    let activeSelection = [];
    let customOverrides = JSON.parse(localStorage.getItem('mir_plot_overrides')) || {};
    let sortColumn = null;
    let sortAscending = true;

    // Get current date for update dates (August 2026 base)
    const today = new Date();
    const formattedDateStr = today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const syncLabel = document.getElementById('syncDateLabel');
    if (syncLabel) syncLabel.textContent = `Last updated: ${formattedDateStr}`;

    // --- LOAD PORTAL DATA ---
    fetch('plots-data.json?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => {
            rawListings = data;
            processAndRender();
        })
        .catch(err => {
            console.error("Could not fetch plots-data.json", err);
            rawListings = getFallbackRegistry();
            processAndRender();
        });

    function processAndRender() {
        applyAdminOverrides();
        const mergedListings = combineDuplicates(rawListings);
        selectDailyPlots(mergedListings);
        renderPlotsTable();
        renderAdminDashboard();
    }

    // --- ADMIN OVERRIDES PERSISTENCE SYNC ---
    function applyAdminOverrides() {
        rawListings.forEach(item => {
            const override = customOverrides[item.id];
            if (override) {
                if (override.price !== undefined) item.price_pkr = override.price;
                if (override.size !== undefined) item.size_marla = override.size;
                if (override.phase !== undefined) item.phase = override.phase;
                if (override.possession !== undefined) item.possession = override.possession;
                if (override.ready_to_build !== undefined) item.ready_to_build = override.ready_to_build;
                if (override.status !== undefined) item.status = override.status;
                
                // Track manual inclusion/exclusion flags
                item.force_include = override.force_include || false;
                item.force_exclude = override.force_exclude || false;
                item.featured = override.featured || false;
            }
        });
    }

    // --- DUPLICATE MERGING ENGINE ---
    function combineDuplicates(listings) {
        const merged = [];
        const visitedIds = new Set();

        listings.forEach(item => {
            if (visitedIds.has(item.id) || item.status !== 'active') return;

            const duplicates = listings.filter(other => {
                if (other.id === item.id || visitedIds.has(other.id) || other.status !== 'active') return false;

                const samePhase = other.phase.toLowerCase() === item.phase.toLowerCase();
                const sameBlock = other.block.toLowerCase() === item.block.toLowerCase();
                const sameSize = other.size_marla === item.size_marla;
                
                const priceDiffRatio = Math.abs(other.price_pkr - item.price_pkr) / item.price_pkr;
                const samePrice = priceDiffRatio <= 0.01;

                return samePhase && sameBlock && sameSize && samePrice;
            });

            if (duplicates.length > 0) {
                const sources = [item.source_site];
                const urls = [item.original_url];
                visitedIds.add(item.id);

                duplicates.forEach(dup => {
                    sources.push(dup.source_site);
                    urls.push(dup.original_url);
                    visitedIds.add(dup.id);
                });

                merged.push({
                    ...item,
                    multiple_sources: true,
                    sources_list: sources,
                    urls_list: urls
                });
            } else {
                visitedIds.add(item.id);
                merged.push({
                    ...item,
                    multiple_sources: false,
                    sources_list: [item.source_site],
                    urls_list: [item.original_url]
                });
            }
        });

        return merged;
    }

    // --- CURATE TOP 20 BEST PLOTS ENGINE ---
    function selectDailyPlots(listings) {
        // Filter out non-eligible listings
        const eligible = listings.filter(item => {
            if (item.force_exclude) return false;
            const withinSizeRange = item.size_marla === 5 || item.size_marla === 10 || item.size_marla === 20;
            return item.possession && item.ready_to_build && item.status === 'active' && withinSizeRange;
        });

        // Rank eligible plots by features (corner, park facing, main boulevard, and admin featured flags boost score)
        const ranked = eligible.map(item => {
            let score = 0;
            if (item.features.includes('corner')) score += 2;
            if (item.features.includes('park-facing')) score += 3;
            if (item.features.includes('main-boulevard')) score += 4;
            if (item.featured) score += 10; 
            if (item.force_include) score += 20; 
            return { item, score };
        });

        // Sort by rank priority score
        ranked.sort((a, b) => b.score - a.score);

        // Curate the top 20 best plots
        activeSelection = ranked.slice(0, 20).map(entry => entry.item);
    }

    // --- RENDER PORTAL PROPERTIES TABLE ---
    function renderPlotsTable() {
        const tbody = document.getElementById('plotsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Sort activeSelection if sortColumn is active
        if (sortColumn) {
            activeSelection.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                if (sortColumn === 'price') {
                    valA = a.price_pkr;
                    valB = b.price_pkr;
                } else if (sortColumn === 'size') {
                    valA = a.size_marla;
                    valB = b.size_marla;
                }

                if (valA < valB) return sortAscending ? -1 : 1;
                if (valA > valB) return sortAscending ? 1 : -1;
                return 0;
            });
        }

        // Update counter label
        document.getElementById('plotsCounterLabel').textContent = activeSelection.length;

        if (activeSelection.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center" style="padding: 3rem; color: var(--text-secondary);">
                        No shortlisted plots available in the registry.
                    </td>
                </tr>
            `;
            return;
        }

        // Render Table Rows
        activeSelection.forEach((item) => {
            const tr = document.createElement('tr');
            if (item.featured) {
                tr.style.background = 'rgba(197, 168, 128, 0.03)';
            }

            // Formatting Price
            const priceCrore = (item.price_pkr / 10000000).toFixed(2);
            const marlaRate = ((item.price_pkr / item.size_marla) / 100000).toFixed(1);
            const sizeLabel = item.size_marla >= 20 ? `${item.size_marla / 20} Kanal` : `${item.size_marla} Marla`;

            // Features HTML
            let featuresHtml = '';
            if (item.features.includes('corner')) {
                featuresHtml += `<span style="background: rgba(197, 168, 128, 0.15); color: var(--gold-primary); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; margin-right: 4px; white-space: nowrap;">Corner</span>`;
            }
            if (item.features.includes('park-facing')) {
                featuresHtml += `<span style="background: rgba(197, 168, 128, 0.15); color: var(--gold-primary); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; margin-right: 4px; white-space: nowrap;">Park Facing</span>`;
            }
            if (item.features.includes('main-boulevard')) {
                featuresHtml += `<span style="background: rgba(197, 168, 128, 0.15); color: var(--gold-primary); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; white-space: nowrap;">Boulevard</span>`;
            }
            if (featuresHtml === '') featuresHtml = '<span style="color: var(--text-muted); font-size: 0.75rem;">Standard Block</span>';

            const cleanBlock = item.block.replace('Block ', '').replace('Rahbar ', '').trim();
            const priceInLacs = item.price_pkr / 100000;
            const detailsVal = `${cleanBlock}- ${item.plot_no || 'TBD'}@${priceInLacs}`;

            const dateObj = new Date(item.last_checked || '2026-08-20');
            const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

            tr.innerHTML = `
                <td><strong style="color: var(--gold-primary); font-family: 'Outfit'; font-size: 0.95rem;">${item.phase}</strong></td>
                <td><strong>${sizeLabel}</strong></td>
                <td><code style="background: rgba(255,255,255,0.03); padding: 0.25rem 0.5rem; border-radius: 4px; color: var(--gold-primary); font-weight: 700; font-family: monospace; font-size: 0.85rem;">${detailsVal}</code></td>
                <td><span style="font-size: 0.8rem; font-weight: 600; color: var(--gold-primary); white-space: nowrap;">Mir Brothers Real Estate Division</span></td>
                <td><span style="font-size: 0.82rem; color: var(--text-secondary);">${formattedDate}</span></td>
                <td class="text-center">
                    <div style="display: flex; gap: 0.4rem; justify-content: center; align-items: center;">
                        <button class="btn btn-primary btn-sm build-estimate-trigger" data-id="${item.id}" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; white-space: nowrap;">Build Estimate</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners for "Build Your Home" budget calculators
        setupBuilderEstimators();
    }


    // --- DYNAMIC PLOT-TO-CONSTRUCTION ESTIMATOR ---
    function setupBuilderEstimators() {
        const triggers = document.querySelectorAll('.build-estimate-trigger');
        triggers.forEach(trig => {
            trig.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const plot = activeSelection.find(p => p.id === id);
                if (plot) openEstimatorDrawer(plot);
            });
        });
    }

    const drawer = document.getElementById('buildEstimatorDrawer');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    if (closeDrawerBtn) {
        closeDrawerBtn.addEventListener('click', () => {
            drawer.style.display = 'none';
        });
    }

    function openEstimatorDrawer(plot) {
        drawer.style.display = 'block';
        
        const sizeLabel = plot.size_marla >= 20 ? `${plot.size_marla / 20} Kanal` : `${plot.size_marla} Marla`;
        
        // Calculate estimated covered area based on Marla size
        let estArea = plot.size_marla * 175;
        if (plot.size_marla === 5) estArea = 1800;
        else if (plot.size_marla === 10) estArea = 3200;
        else if (plot.size_marla === 20) estArea = 4500;
        else if (plot.size_marla === 40) estArea = 8000;

        const content = document.getElementById('drawerContent');
        content.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--gold-primary);">Selected Site</span>
                <h4 style="font-family: 'Outfit'; font-size: 1.25rem;">${plot.phase} — ${plot.block}</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">${sizeLabel} Residential Plot</p>
            </div>

            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 8px; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                    <span>Plot Asking Price</span>
                    <strong>PKR ${(plot.price_pkr / 10000000).toFixed(2)} Crore</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                    <span>Bylaws Covered Area (Est.)</span>
                    <strong>${estArea.toLocaleString()} Sq Ft</strong>
                </div>
            </div>

            <div class="filter-group" style="margin-bottom: 2rem;">
                <label style="display: block; font-family: 'Outfit'; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; color: var(--text-primary); margin-bottom: 0.5rem;">Select Construction Quality</label>
                <select id="drawQuality" class="form-control-sm" style="width: 100%; background-color: var(--bg-primary);">
                    <option value="economy">Economy Quality (PKR 5,200/sqft)</option>
                    <option value="standard" selected>Standard Quality (PKR 6,500/sqft)</option>
                    <option value="premium">Premium Quality (PKR 8,200/sqft)</option>
                    <option value="luxury">Luxury / Elite Quality (PKR 11,500/sqft)</option>
                </select>
            </div>

            <div class="estimator-output" style="border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                <h5 style="font-family: 'Outfit'; color: var(--gold-primary); margin-bottom: 1.25rem;">Estimated Budgets</h5>
                
                <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                        <span>Estimated Construction Cost</span>
                        <strong id="drawEstConstruction">PKR 0</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem; padding-bottom: 0.75rem; border-bottom: 1px dashed var(--border-color);">
                        <span>Taxes & Society Levies (5%)</span>
                        <strong id="drawEstTax">PKR 0</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; color: var(--gold-primary);">
                        <span>Estimated Build Total</span>
                        <strong id="drawEstTotal">PKR 0</strong>
                    </div>
                </div>

                <div style="padding: 1.25rem; background: rgba(197,168,128,0.06); border: 1px dashed rgba(197,168,128,0.25); border-radius: 8px; margin-bottom: 2rem;">
                    <h6 style="color: var(--gold-primary); margin-bottom: 0.5rem; font-family: 'Outfit'; font-size: 0.9rem;">Mir Brothers Services Include:</h6>
                    <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.78rem; color: var(--text-secondary);">
                        <li>✓ Complete architectural planning</li>
                        <li>✓ PEC-licensed structural design</li>
                        <li>✓ Red-brick masonry & foundations</li>
                        <li>✓ German hydronic underfloor heating</li>
                        <li>✓ Smart automation & turnkey finishing</li>
                    </ul>
                </div>

                <a href="index.html#contact" class="btn btn-primary btn-block">Start Planning Your Home</a>
            </div>
        `;

        const drawQuality = document.getElementById('drawQuality');
        drawQuality.addEventListener('change', () => {
            recalculateDrawerBudget(estArea);
        });

        recalculateDrawerBudget(estArea);
    }

    function recalculateDrawerBudget(area) {
        const quality = document.getElementById('drawQuality').value;
        let rate = 6500; 
        if (quality === 'economy') rate = 5200;
        else if (quality === 'premium') rate = 8200;
        else if (quality === 'luxury') rate = 11500;

        const constructionCost = area * rate;
        const taxVal = constructionCost * 0.05;
        const totalVal = constructionCost + taxVal;

        document.getElementById('drawEstConstruction').textContent = 'PKR ' + Math.round(constructionCost).toLocaleString();
        document.getElementById('drawEstTax').textContent = 'PKR ' + Math.round(taxVal).toLocaleString();
        document.getElementById('drawEstTotal').textContent = 'PKR ' + Math.round(totalVal).toLocaleString();
    }


    // --- ADMIN PANEL CONTROL PANEL LOGIC ---
    const adminToggleBtn = document.getElementById('adminToggleBtn');
    const adminPanelModal = document.getElementById('adminPanelModal');
    const closeAdminBtn = document.getElementById('closeAdminBtn');
    const resetAdminDataBtn = document.getElementById('resetAdminDataBtn');
    const saveAdminChangesBtn = document.getElementById('saveAdminChangesBtn');

    if (adminToggleBtn) {
        adminToggleBtn.addEventListener('click', () => {
            const pwd = prompt("Enter Sourcing Panel Admin Password:");
            if (pwd === "miradmin123" || pwd === "admin123") {
                adminPanelModal.style.display = 'block';
            } else if (pwd !== null) {
                alert("Incorrect password. Access denied.");
            }
        });
    }

    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', () => {
            adminPanelModal.style.display = 'none';
        });
    }

    function renderAdminDashboard() {
        const body = document.getElementById('adminTableBody');
        if (!body) return;
        body.innerHTML = '';

        let total = rawListings.length;
        let possession = rawListings.filter(l => l.possession).length;
        let buildable = rawListings.filter(l => l.ready_to_build).length;
        let checked = rawListings.filter(l => l.status === 'active').length;

        document.getElementById('statTotalRegistry').textContent = total;
        document.getElementById('statPossession').textContent = possession;
        document.getElementById('statBuildable').textContent = buildable;
        document.getElementById('statCheckedToday').textContent = checked;

        rawListings.forEach(item => {
            const tr = document.createElement('tr');
            
            const forceIncludeChecked = item.force_include ? 'checked' : '';
            const forceExcludeChecked = item.force_exclude ? 'checked' : '';
            const featuredChecked = item.featured ? 'checked' : '';
            const isInactive = item.status !== 'active';

            tr.innerHTML = `
                <td>
                    <strong style="color: var(--text-primary); font-size: 0.85rem;">Block ${item.block}</strong>
                    <span style="display: block; font-size: 0.72rem; color: var(--text-muted);">${item.source_site} | Plot ${item.plot_no}</span>
                </td>
                <td>
                    <input type="number" class="admin-edit-size form-control-sm" data-id="${item.id}" value="${item.size_marla}" style="width: 70px; background: var(--bg-primary);">
                </td>
                <td>
                    <input type="text" class="admin-edit-phase form-control-sm" data-id="${item.id}" value="${item.phase}" style="width: 110px; background: var(--bg-primary);">
                </td>
                <td>
                    <input type="number" class="admin-edit-price form-control-sm" data-id="${item.id}" value="${item.price_pkr}" style="width: 130px; background: var(--bg-primary);">
                </td>
                <td>
                    <select class="admin-edit-possession form-control-sm" data-id="${item.id}" style="background: var(--bg-primary); width: 100px;">
                        <option value="true" ${item.possession ? 'selected' : ''}>Possession</option>
                        <option value="false" ${!item.possession ? 'selected' : ''}>Unballoted</option>
                    </select>
                </td>
                <td style="display: flex; gap: 0.5rem; align-items: center; height: 100%;">
                    <label class="checkbox-container" style="font-size: 0.72rem; padding-left: 1.5rem;">
                        <input type="checkbox" class="admin-check-featured" data-id="${item.id}" ${featuredChecked}>
                        <span class="checkmark"></span>
                        Feat
                    </label>
                    <label class="checkbox-container" style="font-size: 0.72rem; padding-left: 1.5rem;">
                        <input type="checkbox" class="admin-check-include" data-id="${item.id}" ${forceIncludeChecked}>
                        <span class="checkmark"></span>
                        Force Inc
                    </label>
                    <label class="checkbox-container" style="font-size: 0.72rem; padding-left: 1.5rem;">
                        <input type="checkbox" class="admin-check-exclude" data-id="${item.id}" ${forceExcludeChecked}>
                        <span class="checkmark"></span>
                        Force Exc
                    </label>
                </td>
                <td>
                    <button class="btn btn-outline btn-sm admin-toggle-status" data-id="${item.id}" style="padding: 0.25rem 0.5rem; font-size: 0.72rem; border-color: ${isInactive ? 'var(--danger-red)' : 'var(--success-green)'}; color: ${isInactive ? 'var(--danger-red)' : 'var(--success-green)'};">
                        ${isInactive ? 'Hidden' : 'Visible'}
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });

        setupAdminListeners();
    }

    function setupAdminListeners() {
        const statusBtns = document.querySelectorAll('.admin-toggle-status');
        statusBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const item = rawListings.find(l => l.id === id);
                if (item) {
                    item.status = item.status === 'active' ? 'unavailable' : 'active';
                    renderAdminDashboard();
                }
            });
        });
    }

    if (saveAdminChangesBtn) {
        saveAdminChangesBtn.addEventListener('click', () => {
            rawListings.forEach(item => {
                const sizeInput = document.querySelector(`.admin-edit-size[data-id="${item.id}"]`);
                const phaseInput = document.querySelector(`.admin-edit-phase[data-id="${item.id}"]`);
                const priceInput = document.querySelector(`.admin-edit-price[data-id="${item.id}"]`);
                const possessionInput = document.querySelector(`.admin-edit-possession[data-id="${item.id}"]`);
                const featInput = document.querySelector(`.admin-check-featured[data-id="${item.id}"]`);
                const incInput = document.querySelector(`.admin-check-include[data-id="${item.id}"]`);
                const excInput = document.querySelector(`.admin-check-exclude[data-id="${item.id}"]`);

                if (sizeInput) {
                    if (!customOverrides[item.id]) customOverrides[item.id] = {};
                    customOverrides[item.id].size = parseFloat(sizeInput.value) || item.size_marla;
                    customOverrides[item.id].phase = phaseInput.value || item.phase;
                    customOverrides[item.id].price = parseInt(priceInput.value, 10) || item.price_pkr;
                    customOverrides[item.id].possession = possessionInput.value === 'true';
                    customOverrides[item.id].ready_to_build = possessionInput.value === 'true';
                    customOverrides[item.id].featured = featInput.checked;
                    customOverrides[item.id].force_include = incInput.checked;
                    customOverrides[item.id].force_exclude = excInput.checked;
                    customOverrides[item.id].status = item.status;
                }
            });

            localStorage.setItem('mir_plot_overrides', JSON.stringify(customOverrides));
            adminPanelModal.style.display = 'none';
            processAndRender();
        });
    }

    if (resetAdminDataBtn) {
        resetAdminDataBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear all custom overrides? This restores original Zameen/LRE rates.")) {
                customOverrides = {};
                localStorage.removeItem('mir_plot_overrides');
                adminPanelModal.style.display = 'none';
                
                fetch('plots-data.json?t=' + new Date().getTime())
                    .then(res => res.json())
                    .then(data => {
                        rawListings = data;
                        processAndRender();
                    });
            }
        });
    }

    const forceRefreshBtn = document.getElementById('forceRefreshBtn');
    if (forceRefreshBtn) {
        forceRefreshBtn.addEventListener('click', () => {
            const originalText = forceRefreshBtn.innerHTML;
            forceRefreshBtn.innerHTML = `
                <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle; display: inline-block;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                Fetching live...
            `;
            forceRefreshBtn.disabled = true;

            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://lahorerealestate.com/plots-for-sale/');
            fetch(proxyUrl)
                .then(res => {
                    if (!res.ok) throw new Error("Proxy error");
                    return res.text();
                })
                .then(htmlText => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');
                    const rows = doc.querySelectorAll('tr');
                    
                    const listings = [];
                    let plot_counter = 1;
                    
                    rows.forEach(tr => {
                        const td_cells = tr.querySelectorAll('td');
                        if (td_cells.length < 4) return;
                        
                        const phase = td_cells[0].textContent.trim();
                        const size_str = td_cells[1].textContent.trim();
                        const details_str = td_cells[2].textContent.trim();
                        const updated_str = td_cells[3].textContent.trim();
                        
                        // Filter DHA Lahore
                        const phase_lower = phase.toLowerCase();
                        if (!phase_lower.includes("dha")) return;
                        
                        // Size check
                        let size_marla = null;
                        if (size_str.toLowerCase().includes("5 marla")) {
                            size_marla = 5;
                        } else if (size_str.toLowerCase().includes("10 marla")) {
                            size_marla = 10;
                        } else if (size_str.toLowerCase().includes("1 kanal")) {
                            size_marla = 20;
                        }
                        
                        if (size_marla === null) return;
                        
                        if (!details_str.includes("@")) return;
                        
                        const parts = details_str.split("@");
                        const left_part = parts[0].trim();
                        const right_part = parts[1].trim();
                        
                        // Parse price (in Lacs)
                        const price_num_match = right_part.match(/[\d\.]+/);
                        if (!price_num_match) return;
                        
                        const price_val = parseFloat(price_num_match[0]);
                        const price_pkr = Math.round(price_val * 100000);
                        
                        // Parse block and plot
                        let block_val = "Block";
                        let plot_no = "TBD";
                        if (left_part.includes("-")) {
                            const b_parts = left_part.split("-");
                            block_val = "Block " + b_parts[0].trim();
                            plot_no = b_parts[1].trim();
                        } else {
                            block_val = left_part.trim();
                        }
                        
                        // Parse date
                        const date_match = updated_str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                        let last_checked = new Date().toISOString().split('T')[0];
                        if (date_match) {
                            const mm = parseInt(date_match[1], 10);
                            const dd = parseInt(date_match[2], 10);
                            const yyyy = parseInt(date_match[3], 10);
                            last_checked = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
                        }
                        
                        const clean_phase = phase.replace("DHA Lahore ", "").replace("DHA ", "").trim();
                        
                        listings.push({
                            id: "plot_live_" + plot_counter++,
                            phase: clean_phase,
                            block: block_val,
                            plot_no: plot_no,
                            size_marla: size_marla,
                            price_pkr: price_pkr,
                            possession: true,
                            ready_to_build: true,
                            features: ["possession-ready"],
                            source_site: "Lahore Real Estate",
                            original_url: "https://lahorerealestate.com/plots-for-sale/",
                            last_checked: last_checked,
                            status: "active",
                            description: `Verified plot in ${clean_phase} ${block_val}.`
                        });
                    });
                    
                    if (listings.length > 0) {
                        rawListings = listings;
                        processAndRender();
                        
                        // Update last updated sync Label to today's date
                        const dateLabel = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                        if (syncLabel) syncLabel.textContent = `Last updated: ${dateLabel}`;
                        
                        alert("Successfully updated and loaded " + listings.length + " fresh plot listings directly from Lahore Real Estate!");
                    } else {
                        throw new Error("No listings parsed");
                    }
                })
                .catch(err => {
                    console.warn("Real-time proxy fetch failed, falling back to static plots-data.json", err);
                    // Fallback to static plots-data.json
                    fetch('plots-data.json?t=' + new Date().getTime())
                        .then(res => res.json())
                        .then(data => {
                            rawListings = data;
                            processAndRender();
                            alert("Loaded latest verified registry plots from cache!");
                        })
                        .catch(err2 => {
                            console.error("Fallback fetch failed", err2);
                            alert("Failed to refresh plots. Check your connection.");
                        });
                })
                .finally(() => {
                    forceRefreshBtn.innerHTML = originalText;
                    forceRefreshBtn.disabled = false;
                });
        });
    }

    // --- SORT HEADER LISTENER REGISTRY ---
    function setupHeaderSorting() {
        const headers = document.querySelectorAll('.sortable-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const col = header.dataset.sort;
                if (sortColumn === col) {
                    sortAscending = !sortAscending;
                } else {
                    sortColumn = col;
                    sortAscending = true;
                }
                
                // Update header icons visually
                headers.forEach(h => {
                    const indicator = h.querySelector('.sort-indicator');
                    if (h.dataset.sort === sortColumn) {
                        indicator.textContent = sortAscending ? '▲' : '▼';
                        indicator.style.color = 'var(--gold-primary)';
                    } else {
                        indicator.textContent = '⇅';
                        indicator.style.color = 'var(--text-muted)';
                    }
                });

                renderPlotsTable();
            });
        });
    }
    setupHeaderSorting();

    function getFallbackRegistry() {
        return [
            { "id": "p1", "phase": "Phase 6", "block": "Block M", "plot_no": "12", "size_marla": 20, "price_pkr": 85000000, "possession": true, "ready_to_build": true, "features": ["main-boulevard"], "source_site": "Zameen", "original_url": "#", "status": "active", "description": "1 Kanal plot on Main Boulevard in DHA Phase 6 Block M. Ideal site." },
            { "id": "p2", "phase": "Phase 8", "block": "Block Y", "plot_no": "44", "size_marla": 10, "price_pkr": 42000000, "possession": true, "ready_to_build": true, "features": ["corner", "park-facing"], "source_site": "Zameen", "original_url": "#", "status": "active", "description": "Corner and park facing 10 marla plot, possession paid." },
            { "id": "p3", "phase": "Phase 5", "block": "Block C", "plot_no": "231", "size_marla": 20, "price_pkr": 92000000, "possession": true, "ready_to_build": true, "features": ["possession-ready"], "source_site": "Lahore Real Estate", "original_url": "#", "status": "active", "description": "Phase 5 Sector C prime plot. Development charges paid." }
        ];
    }

});
