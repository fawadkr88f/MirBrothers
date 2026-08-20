document.addEventListener('DOMContentLoaded', () => {

    // --- STATE REGISTRY ---
    let rawListings = [];
    let activeSelection = [];
    let customOverrides = JSON.parse(localStorage.getItem('mir_plot_overrides')) || {};

    // Get current date for update dates (August 2026 base)
    const today = new Date();
    const formattedDateStr = today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const syncLabel = document.getElementById('syncDateLabel');
    if (syncLabel) syncLabel.textContent = `Last updated: ${formattedDateStr}`;

    // --- LOAD PORTAL DATA ---
    fetch('plots-data.json')
        .then(res => res.json())
        .then(data => {
            rawListings = data;
            processAndRender();
        })
        .catch(err => {
            console.error("Could not fetch plots-data.json", err);
            // Fallback mock items if fetch fails (e.g. running on file protocol without CORS)
            rawListings = getFallbackRegistry();
            processAndRender();
        });

    function processAndRender() {
        applyAdminOverrides();
        const mergedListings = combineDuplicates(rawListings);
        selectDailyPlots(mergedListings);
        renderPlotsGrid();
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
    // Merges listings sharing DHA Phase, Block, Size, and Price (within 1% range)
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
                
                // Allow 1% price tolerance for duplicate detection
                const priceDiffRatio = Math.abs(other.price_pkr - item.price_pkr) / item.price_pkr;
                const samePrice = priceDiffRatio <= 0.01;

                return samePhase && sameBlock && sameSize && samePrice;
            });

            if (duplicates.length > 0) {
                // Combine details
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

    // --- SEEDED DAILY RANDOMIZER ENGINE ---
    // Chooses 10-15 plots that stay constant for the calendar date
    function selectDailyPlots(listings) {
        // Filter out non-eligible listings (must be possession, ready to build, not excluded)
        const eligible = listings.filter(item => {
            if (item.force_exclude) return false;
            
            // Inclusion rules: Must be possession and ready to build
            return item.possession && item.ready_to_build;
        });

        // Forced inclusions override checks
        const forced = listings.filter(item => item.force_include && item.status === 'active');
        
        // Seed based on Year/Month/Day
        const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        
        // Custom Seeded LCG Random function
        let seed = dateSeed;
        function random() {
            let x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        }

        // Rank eligible plots by features (corner, park facing, main boulevard boost priority scores)
        const ranked = eligible.map(item => {
            let score = 0;
            if (item.features.includes('corner')) score += 2;
            if (item.features.includes('park-facing')) score += 3;
            if (item.features.includes('main-boulevard')) score += 4;
            if (item.featured) score += 5; // Admin featured boost
            return { item, score };
        });

        // Sort by priority rank
        ranked.sort((a, b) => b.score - a.score);

        // Deduplicate selection pool & maintain Phase Diversity
        const selected = [...forced];
        const phaseCounts = {};

        // Track already selected IDs
        const selectedIds = new Set(selected.map(s => s.id));

        // Group by phase
        const phaseBuckets = {};
        ranked.forEach(entry => {
            const phase = entry.item.phase;
            if (!phaseBuckets[phase]) phaseBuckets[phase] = [];
            phaseBuckets[phase].push(entry.item);
        });

        // Round robin pick across phases using date seed to ensure diversity
        const targetCount = Math.min(15, Math.max(10, eligible.length));
        const phases = Object.keys(phaseBuckets);

        if (phases.length > 0) {
            let iteration = 0;
            while (selected.length < targetCount && iteration < 30) {
                phases.forEach(phase => {
                    if (selected.length >= targetCount) return;

                    const bucket = phaseBuckets[phase];
                    if (bucket && bucket.length > 0) {
                        // Pick pseudo-randomly from this phase bucket
                        const index = Math.floor(random() * bucket.length);
                        const picked = bucket[index];

                        if (!selectedIds.has(picked.id)) {
                            selected.push(picked);
                            selectedIds.add(picked.id);
                            // Remove picked to avoid immediate repeats
                            bucket.splice(index, 1);
                        }
                    }
                });
                iteration++;
            }
        }

        // Randomize ordering of selected elements
        selected.sort(() => random() - 0.5);
        activeSelection = selected;
    }

    // --- RENDER PORTAL PROPERTIES ---
    function renderPlotsGrid() {
        const grid = document.getElementById('plotsListGrid');
        if (!grid) return;
        grid.innerHTML = '';

        // Apply visual filters
        const phaseFilter = document.getElementById('filterPhase').value;
        const sizeFilter = document.getElementById('filterSize').value;
        const priceMin = parseFloat(document.getElementById('filterPriceMin').value) || 0;
        const priceMax = parseFloat(document.getElementById('filterPriceMax').value) || Infinity;
        
        const chkCorner = document.getElementById('chkFilterCorner').checked;
        const chkPark = document.getElementById('chkFilterPark').checked;
        const chkBoulevard = document.getElementById('chkFilterBoulevard').checked;

        const filtered = activeSelection.filter(item => {
            // Phase Match
            if (phaseFilter !== 'all' && item.phase !== phaseFilter) return false;
            
            // Size Match
            if (sizeFilter !== 'all') {
                if (sizeFilter === 'other') {
                    if ([5, 8, 10, 20, 40].includes(item.size_marla)) return false;
                } else {
                    const sizeVal = parseInt(sizeFilter, 10);
                    if (item.size_marla !== sizeVal) return false;
                }
            }

            // Price Match (converting to Crore units)
            const priceCrore = item.price_pkr / 10000000;
            if (priceCrore < priceMin || priceCrore > priceMax) return false;

            // Features Checks
            if (chkCorner && !item.features.includes('corner')) return false;
            if (chkPark && !item.features.includes('park-facing')) return false;
            if (chkBoulevard && !item.features.includes('main-boulevard')) return false;

            return true;
        });

        // Update counter label
        document.getElementById('plotsCounterLabel').textContent = filtered.length;

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="glass-card text-center" style="padding: 4rem 2rem;">
                    <p style="color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 1rem;">No shortlisted plots match your filters.</p>
                    <button class="btn btn-primary btn-sm" id="resetFiltersLink">Reset All Filters</button>
                </div>
            `;
            const resetBtn = document.getElementById('resetFiltersLink');
            if (resetBtn) {
                resetBtn.addEventListener('click', clearAllFilters);
            }
            return;
        }

        // Render Property Cards
        filtered.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'glass-card property-card';
            card.style.padding = '0';
            card.style.overflow = 'hidden';
            card.style.display = 'grid';
            card.style.gridTemplateColumns = '320px 1fr';
            card.style.border = item.featured ? '2px solid var(--gold-primary)' : '1px solid var(--border-color)';

            // Formatting Price
            const priceCrore = (item.price_pkr / 10000000).toFixed(2);
            const marlaRate = ((item.price_pkr / item.size_marla) / 100000).toFixed(1);
            const sizeLabel = item.size_marla >= 20 ? `${item.size_marla / 20} Kanal` : `${item.size_marla} Marla`;

            // Build features checklist string
            const featLabels = item.features.map(f => {
                if (f === 'corner') return 'Corner Plot';
                if (f === 'park-facing') return 'Park Facing';
                if (f === 'main-boulevard') return 'Main Boulevard';
                return f.replace(/-/g, ' ');
            }).join(' • ');

            // Sources block
            let sourceHtml = `Source: ${item.source_site}`;
            let sourceUrl = item.original_url;
            if (item.multiple_sources) {
                sourceHtml = `Sources: ${item.sources_list.join(', ')} (Merged duplicate listings)`;
                // Prefer Zameen or the first source URL
                sourceUrl = item.urls_list[0];
            }

            card.innerHTML = `
                <div class="property-img-pane" style="background-image: linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.5)), url('assets/dha_5marla_house.jpg'); background-size: cover; background-position: center; position: relative;">
                    ${item.featured ? '<span style="position: absolute; top: 1rem; left: 1rem; background: var(--gold-gradient); color: #0A0A0B; padding: 0.25rem 0.75rem; border-radius: 4px; font-weight: 800; font-size: 0.7rem; text-transform: uppercase;">Featured Selection</span>' : ''}
                    <div style="position: absolute; bottom: 1rem; left: 1rem; right: 1rem; background: rgba(0,0,0,0.6); padding: 0.5rem; border-radius: 4px; text-align: center; font-size: 0.75rem;">
                        Possession & Buildable Vetted
                    </div>
                </div>
                <div class="property-info-pane" style="padding: 2.25rem; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                            <div>
                                <span style="color: var(--gold-primary); font-family: 'Outfit'; font-weight: 700; font-size: 1.25rem;">${item.phase} — ${item.block}</span>
                                <h3 style="font-size: 1.6rem; margin-top: 0.25rem;">${sizeLabel} Residential Plot</h3>
                            </div>
                            <div class="text-right">
                                <h4 style="color: var(--gold-primary); font-size: 1.6rem; font-weight: 800;">PKR ${priceCrore} Crore</h4>
                                <span style="font-size: 0.8rem; color: var(--text-secondary);">Approx. PKR ${marlaRate} Lac / Marla</span>
                            </div>
                        </div>

                        <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem;">${item.description}</p>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;">
                            <span style="background: rgba(52,211,153,0.08); color: var(--success-green); padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.78rem; font-weight: 700;">✓ Possession Available</span>
                            <span style="background: rgba(52,211,153,0.08); color: var(--success-green); padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.78rem; font-weight: 700;">✓ Ready to Build</span>
                            ${item.features.includes('corner') ? '<span style="background: rgba(197,168,128,0.1); color: var(--gold-primary); padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.78rem; font-weight: 700;">Corner Plot</span>' : ''}
                            ${item.features.includes('park-facing') ? '<span style="background: rgba(197,168,128,0.1); color: var(--gold-primary); padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.78rem; font-weight: 700;">Park Facing</span>' : ''}
                            ${item.features.includes('main-boulevard') ? '<span style="background: rgba(197,168,128,0.1); color: var(--gold-primary); padding: 0.35rem 0.75rem; border-radius: 4px; font-size: 0.78rem; font-weight: 700;">Main Boulevard</span>' : ''}
                        </div>
                    </div>

                    <div style="border-top: 1px solid var(--border-color); padding-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">
                            ${sourceHtml}
                        </span>
                        <div style="display: flex; gap: 0.75rem;">
                            <a href="${sourceUrl}" target="_blank" class="btn btn-gold-outline btn-sm" style="padding: 0.5rem 1rem;">View Original Listing</a>
                            <button class="btn btn-primary btn-sm build-estimate-trigger" data-id="${item.id}" style="padding: 0.5rem 1rem;">Build Your Home</button>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);

            // Insert commercial CTA cards after index 2 and index 6
            if (index === 2 || index === 6) {
                const ctaCard = document.createElement('div');
                ctaCard.className = 'glass-card text-center';
                ctaCard.style.padding = '3rem 2rem';
                ctaCard.style.border = '1px dashed var(--gold-primary)';
                ctaCard.style.background = 'linear-gradient(135deg, rgba(197,168,128,0.03) 0%, rgba(10,10,11,0.2) 100%)';
                ctaCard.innerHTML = `
                    <span class="section-subtitle">FOUND YOUR PLOT?</span>
                    <h3 style="font-size: 1.75rem; margin-bottom: 1rem;">Let's turn it into your dream home.</h3>
                    <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto 2rem auto; font-size: 0.95rem;">
                        Whether you buy this plot or another, Mir Brothers provides award-winning architectural planning, structural design, Grey structure, and complete Turnkey construction.
                    </p>
                    <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                        <a href="index.html#calculator" class="btn btn-primary btn-sm">Get Construction Estimate</a>
                        <a href="index.html#contact" class="btn btn-outline btn-sm">Talk to Mir Brothers Builders</a>
                    </div>
                `;
                grid.appendChild(ctaCard);
            }
        });

        // Add event listeners for "Build Your Home" budget calculators
        setupBuilderEstimators();
    }

    function clearAllFilters() {
        document.getElementById('filterPhase').value = 'all';
        document.getElementById('filterSize').value = 'all';
        document.getElementById('filterPriceMin').value = '';
        document.getElementById('filterPriceMax').value = '';
        document.getElementById('chkFilterCorner').checked = false;
        document.getElementById('chkFilterPark').checked = false;
        document.getElementById('chkFilterBoulevard').checked = false;
        renderPlotsGrid();
    }

    // Bind event listeners to filters sidebar
    const filterControls = [
        document.getElementById('filterPhase'),
        document.getElementById('filterSize'),
        document.getElementById('filterPriceMin'),
        document.getElementById('filterPriceMax'),
        document.getElementById('chkFilterCorner'),
        document.getElementById('chkFilterPark'),
        document.getElementById('chkFilterBoulevard')
    ];

    filterControls.forEach(ctrl => {
        if (ctrl) ctrl.addEventListener('change', renderPlotsGrid);
        if (ctrl && ctrl.tagName === 'INPUT') ctrl.addEventListener('input', renderPlotsGrid);
    });

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllFilters);


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
        
        // Calculate estimated covered area based on Marla size (standard double-story limits)
        let estArea = plot.size_marla * 175; // standard average ratio in covered bylaws
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
        let rate = 6500; // standard
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
            adminPanelModal.style.display = 'block';
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

        // Calculate analytics numbers
        let total = rawListings.length;
        let possession = rawListings.filter(l => l.possession).length;
        let buildable = rawListings.filter(l => l.ready_to_build).length;
        let checked = rawListings.filter(l => l.status === 'active').length;

        document.getElementById('statTotalRegistry').textContent = total;
        document.getElementById('statPossession').textContent = possession;
        document.getElementById('statBuildable').textContent = buildable;
        document.getElementById('statCheckedToday').textContent = checked;

        // Render rows
        rawListings.forEach(item => {
            const tr = document.createElement('tr');
            
            // Build checks
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
        // Toggle visibility status
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
            // Read all fields from DOM and write back to customOverrides
            rawListings.forEach(item => {
                const trs = document.querySelectorAll('#adminTableBody tr');
                // Loop to locate inputs matching the ID
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
                    customOverrides[item.id].ready_to_build = possessionInput.value === 'true'; // dynamic links
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
                
                // Refresh registry values
                fetch('plots-data.json')
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
            // Seeding depends on the date; to simulate daily selection changes, we advance/shuffle seed slightly
            today.setDate(today.getDate() + 1);
            const dateLabel = today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            if (syncLabel) syncLabel.textContent = `Last updated: ${dateLabel}`;
            processAndRender();
            alert("Daily selection rotated successfully! Displaying tomorrow's pre-screened plots.");
        });
    }

    // --- FALLBACK MOCK DATA REGISTRY ---
    function getFallbackRegistry() {
        return [
            { "id": "p1", "phase": "Phase 6", "block": "Block M", "plot_no": "12", "size_marla": 20, "price_pkr": 85000000, "possession": true, "ready_to_build": true, "features": ["main-boulevard"], "source_site": "Zameen", "original_url": "#", "status": "active", "description": "1 Kanal plot on Main Boulevard in DHA Phase 6 Block M. Ideal site." },
            { "id": "p2", "phase": "Phase 8", "block": "Block Y", "plot_no": "44", "size_marla": 10, "price_pkr": 42000000, "possession": true, "ready_to_build": true, "features": ["corner", "park-facing"], "source_site": "Zameen", "original_url": "#", "status": "active", "description": "Corner and park facing 10 marla plot, possession paid." },
            { "id": "p3", "phase": "Phase 5", "block": "Block C", "plot_no": "231", "size_marla": 20, "price_pkr": 92000000, "possession": true, "ready_to_build": true, "features": ["possession-ready"], "source_site": "Lahore Real Estate", "original_url": "#", "status": "active", "description": "Phase 5 Sector C prime plot. Development charges paid." }
        ];
    }

});
