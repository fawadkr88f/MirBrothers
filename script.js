document.addEventListener('DOMContentLoaded', () => {
    
    // --- HERO BACKGROUND CAROUSEL ---
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-carousel-dots .dot');
    let currentSlide = 0;
    let slideInterval;

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
        currentSlide = index;
    }

    function nextSlide() {
        let next = (currentSlide + 1) % slides.length;
        showSlide(next);
    }

    function startSlideShow() {
        if (slides.length > 0) {
            slideInterval = setInterval(nextSlide, 6000);
        }
    }

    function resetSlideShow() {
        clearInterval(slideInterval);
        startSlideShow();
    }

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showSlide(index);
            resetSlideShow();
        });
    });

    startSlideShow();


    // --- MOBILE MENU TOGGLE ---
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        mobileToggle.classList.toggle('active');
        const bars = mobileToggle.querySelectorAll('.bar');
        if(navMenu.classList.contains('active')) {
            bars[0].style.transform = 'rotate(45deg) translate(5px, 6px)';
            bars[1].style.opacity = '0';
            bars[2].style.transform = 'rotate(-45deg) translate(5px, -6px)';
        } else {
            bars[0].style.transform = 'none';
            bars[1].style.opacity = '1';
            bars[2].style.transform = 'none';
        }
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            const bars = mobileToggle.querySelectorAll('.bar');
            bars[0].style.transform = 'none';
            bars[1].style.opacity = '1';
            bars[2].style.transform = 'none';
        });
    });


    // --- GALLERY CATEGORY FILTERING ---
    const filterButtons = document.querySelectorAll('.gallery-filters button');
    const portfolioItems = document.querySelectorAll('.portfolio-item');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            portfolioItems.forEach(item => {
                const cat = item.dataset.category;
                if (filter === 'all' || cat === filter) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });


    // --- STYLE DIRECTORY TAB SELECTORS ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetPanel = document.getElementById(target);
            if (targetPanel) targetPanel.classList.add('active');
        });
    });


    // --- PLATFORM STATE DATA LOAD & SETUP ---
    let platformData = null;

    // Hardcoded Fallback Registry
    const fallbackData = {
        "cities": {
            "lahore": { "label": "Lahore", "factor": 1.0, "desc": "Standard central Pakistan pricing index." },
            "islamabad": { "label": "Islamabad", "factor": 1.05, "desc": "Includes capital territory logistics and regulatory surcharges." },
            "karachi": { "label": "Karachi", "factor": 1.02, "desc": "Adjusted for coastal region transport and port-handling duties." },
            "rawalpindi": { "label": "Rawalpindi", "factor": 1.04, "desc": "Northern zone materials freight index." },
            "faisalabad": { "label": "Faisalabad", "factor": 0.98, "desc": "Proximity to central brick kilns and sand sourcing sites." }
        },
        "material_index": {
            "steel": { "label": "Steel (60 Grade Rebar)", "unit": "Ton", "rate": 295000, "prev_rate": 305000, "category": "Steel" },
            "cement": { "label": "Cement (A-Grade Portland)", "unit": "Bag", "rate": 1450, "prev_rate": 1410, "category": "Cement" },
            "bricks": { "label": "Bricks (First-Class)", "unit": "1000 Pcs", "rate": 18000, "prev_rate": 19000, "category": "Bricks" },
            "sand": { "label": "Ravi Sand (Fine Coarse)", "unit": "CFT", "rate": 140, "prev_rate": 135, "category": "Sand" },
            "crusher": { "label": "Crush (Margalla Coarse)", "unit": "CFT", "rate": 170, "prev_rate": 175, "category": "Crush" },
            "tile": { "label": "Tiles (Porcelain)", "unit": "Sq Ft", "rate": 450, "prev_rate": 420, "category": "Tiles" },
            "paint": { "label": "Premium Exterior Paint", "unit": "Litre", "rate": 820, "prev_rate": 850, "category": "Paint" },
            "electrical": { "label": "Wiring & DB Panels", "unit": "Sq Ft", "rate": 350, "prev_rate": 340, "category": "Electrical" },
            "plumbing": { "label": "PPRC/PVC Piping", "unit": "Sq Ft", "rate": 400, "prev_rate": 395, "category": "Plumbing" }
        },
        "quality_coefs": {
            "economy": {
                "rates_multiplier": 0.85,
                "grey_structure": {
                    "steel_ton_per_sqft": 0.0038, "cement_bag_per_sqft": 0.42, "bricks_pcs_per_sqft": 32, "sand_cft_per_sqft": 1.2, "crush_cft_per_sqft": 0.8,
                    "labour_rate_per_sqft": 480, "equipment_rate_per_sqft": 90, "waterproofing_rate_per_sqft": 20, "misc_rate_per_sqft": 50
                },
                "finishing": {
                    "tile_sqft_per_sqft": 1.0, "paint_litre_per_sqft": 0.08, "electrical_rate_per_sqft": 220, "plumbing_rate_per_sqft": 250,
                    "woodwork_rate_per_sqft": 280, "kitchen_rate_per_sqft": 180, "bathroom_rate_per_sqft": 200, "finishing_labour_rate_per_sqft": 450
                }
            },
            "standard": {
                "rates_multiplier": 1.0,
                "grey_structure": {
                    "steel_ton_per_sqft": 0.0042, "cement_bag_per_sqft": 0.45, "bricks_pcs_per_sqft": 35, "sand_cft_per_sqft": 1.4, "crush_cft_per_sqft": 0.9,
                    "labour_rate_per_sqft": 550, "equipment_rate_per_sqft": 120, "waterproofing_rate_per_sqft": 30, "misc_rate_per_sqft": 80
                },
                "finishing": {
                    "tile_sqft_per_sqft": 1.2, "paint_litre_per_sqft": 0.10, "electrical_rate_per_sqft": 350, "plumbing_rate_per_sqft": 400,
                    "woodwork_rate_per_sqft": 450, "kitchen_rate_per_sqft": 300, "bathroom_rate_per_sqft": 350, "finishing_labour_rate_per_sqft": 650
                }
            },
            "premium": {
                "rates_multiplier": 1.2,
                "grey_structure": {
                    "steel_ton_per_sqft": 0.0045, "cement_bag_per_sqft": 0.48, "bricks_pcs_per_sqft": 37, "sand_cft_per_sqft": 1.5, "crush_cft_per_sqft": 1.0,
                    "labour_rate_per_sqft": 620, "equipment_rate_per_sqft": 150, "waterproofing_rate_per_sqft": 45, "misc_rate_per_sqft": 110
                },
                "finishing": {
                    "tile_sqft_per_sqft": 1.3, "paint_litre_per_sqft": 0.12, "electrical_rate_per_sqft": 500, "plumbing_rate_per_sqft": 550,
                    "woodwork_rate_per_sqft": 650, "kitchen_rate_per_sqft": 450, "bathroom_rate_per_sqft": 500, "finishing_labour_rate_per_sqft": 800
                }
            },
            "luxury": {
                "rates_multiplier": 1.5,
                "grey_structure": {
                    "steel_ton_per_sqft": 0.0048, "cement_bag_per_sqft": 0.52, "bricks_pcs_per_sqft": 40, "sand_cft_per_sqft": 1.6, "crush_cft_per_sqft": 1.1,
                    "labour_rate_per_sqft": 750, "equipment_rate_per_sqft": 200, "waterproofing_rate_per_sqft": 70, "misc_rate_per_sqft": 160
                },
                "finishing": {
                    "tile_sqft_per_sqft": 1.4, "paint_litre_per_sqft": 0.15, "electrical_rate_per_sqft": 750, "plumbing_rate_per_sqft": 800,
                    "woodwork_rate_per_sqft": 950, "kitchen_rate_per_sqft": 700, "bathroom_rate_per_sqft": 800, "finishing_labour_rate_per_sqft": 1100
                }
            }
        }
    };

    // Load data from JSON
    fetch('materials.json')
        .then(res => res.json())
        .then(data => {
            platformData = data;
            initializePlatform();
        })
        .catch(err => {
            console.warn("Could not load materials.json dynamically, fallback applied.", err);
            platformData = fallbackData;
            initializePlatform();
        });

    function initializePlatform() {
        renderPriceIndexDashboard();
        calculateCoveredArea(); // Run area pre-fill checks
    }


    // --- MATERIAL PRICE INDEX DASHBOARD RENDERER ---
    function renderPriceIndexDashboard() {
        const grid = document.getElementById('priceIndexGrid');
        if (!grid || !platformData) return;
        grid.innerHTML = '';

        const index = platformData.material_index;
        for (const key in index) {
            const item = index[key];
            const diff = item.rate - item.prev_rate;
            const isUp = diff >= 0;
            const diffPct = ((Math.abs(diff) / item.prev_rate) * 100).toFixed(1);

            const card = document.createElement('div');
            card.className = 'price-card';
            card.innerHTML = `
                <div class="price-card-header">
                    <span class="price-card-label">${item.label}</span>
                    <span class="price-unit-tag">Per ${item.unit}</span>
                </div>
                <div class="price-values-box">
                    <div>
                        <span class="prev-price-val">Previous: PKR ${item.prev_rate.toLocaleString()}</span>
                        <span class="current-price-val">PKR ${item.rate.toLocaleString()}</span>
                    </div>
                    <span class="price-diff-tag ${isUp ? 'price-up' : 'price-down'}">
                        ${isUp ? '▲' : '▼'} ${diffPct}% (${isUp ? 'Up' : 'Down'})
                    </span>
                </div>
            `;
            grid.appendChild(card);
        }
    }


    // --- STEP-BY-STEP CALCULATION WIZARD FLOW ---
    let currentStep = 1;
    const totalSteps = 5;

    const wizardNextBtn = document.getElementById('wizardNext');
    const wizardPrevBtn = document.getElementById('wizardPrev');
    const wizardGenBtn = document.getElementById('wizardGenerate');
    const indicators = document.querySelectorAll('.step-indicator');
    const stepPanels = document.querySelectorAll('.wizard-step-panel');

    function updateWizardUI() {
        // Update indicators
        indicators.forEach(ind => {
            const stepNum = parseInt(ind.dataset.step, 10);
            ind.classList.remove('active', 'completed');
            if (stepNum === currentStep) {
                ind.classList.add('active');
            } else if (stepNum < currentStep) {
                ind.classList.add('completed');
            }
        });

        // Update step panels
        stepPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `stepPanel-${currentStep}`) {
                panel.classList.add('active');
            }
        });

        // Update controls
        wizardPrevBtn.disabled = currentStep === 1;
        if (currentStep === totalSteps) {
            wizardNextBtn.style.display = 'none';
            wizardGenBtn.style.display = 'inline-flex';
        } else {
            wizardNextBtn.style.display = 'inline-flex';
            wizardGenBtn.style.display = 'none';
        }
    }

    wizardNextBtn.addEventListener('click', () => {
        if (currentStep < totalSteps) {
            currentStep++;
            updateWizardUI();
        }
    });

    wizardPrevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateWizardUI();
        }
    });

    // Stepper indicators header click triggers
    indicators.forEach(ind => {
        ind.addEventListener('click', () => {
            const stepNum = parseInt(ind.dataset.step, 10);
            if (stepNum < currentStep || ind.classList.contains('completed')) {
                currentStep = stepNum;
                updateWizardUI();
            }
        });
    });


    // --- WIZARD FORM INPUT INTERACTION LOGIC ---
    const wizardPlotSize = document.getElementById('wizardPlotSize');
    
    // Checkboxes
    const chkGround = document.getElementById('chkGround');
    const chkFirst = document.getElementById('chkFirst');
    const chkSecond = document.getElementById('chkSecond');
    const chkBasement = document.getElementById('chkBasement');
    const chkMumty = document.getElementById('chkMumty');
    const chkGarage = document.getElementById('chkGarage');

    // Values inputs
    const areaGround = document.getElementById('areaGround');
    const areaFirst = document.getElementById('areaFirst');
    const areaSecond = document.getElementById('areaSecond');
    const areaBasement = document.getElementById('areaBasement');
    const areaMumty = document.getElementById('areaMumty');
    const areaGarage = document.getElementById('areaGarage');
    const wizardTotalArea = document.getElementById('wizardTotalArea');

    // Plot pre-fill areas config
    const plotAreasConfig = {
        '5_marla': { ground: 1100, first: 700, second: 0, mumty: 150, garage: 150, firstChecked: true, secondChecked: false },
        '8_marla': { ground: 1300, first: 1000, second: 0, mumty: 180, garage: 180, firstChecked: true, secondChecked: false },
        '10_marla': { ground: 1500, first: 1300, second: 0, mumty: 200, garage: 200, firstChecked: true, secondChecked: false },
        '1_kanal': { ground: 2800, first: 2200, second: 0, mumty: 300, garage: 400, firstChecked: true, secondChecked: false },
        '2_kanal': { ground: 4500, first: 4000, second: 0, mumty: 500, garage: 600, firstChecked: true, secondChecked: false }
    };

    function applyPlotSizeTemplate() {
        const size = wizardPlotSize.value;
        if (size === 'custom') return;

        const template = plotAreasConfig[size];
        if (!template) return;

        // Ground Floor
        chkGround.checked = true;
        areaGround.disabled = false;
        areaGround.value = template.ground;

        // First Floor
        chkFirst.checked = template.firstChecked;
        areaFirst.disabled = !template.firstChecked;
        areaFirst.value = template.firstChecked ? template.first : 0;

        // Second Floor
        chkSecond.checked = template.secondChecked;
        areaSecond.disabled = !template.secondChecked;
        areaSecond.value = template.secondChecked ? template.second : 0;

        // Basement
        chkBasement.checked = false;
        areaBasement.disabled = true;
        areaBasement.value = 0;

        // Mumty
        chkMumty.checked = true;
        areaMumty.disabled = false;
        areaMumty.value = template.mumty;

        // Garage
        chkGarage.checked = true;
        areaGarage.disabled = false;
        areaGarage.value = template.garage;

        calculateCoveredArea();
    }

    function calculateCoveredArea() {
        let total = 0;
        
        if (chkGround.checked) total += parseInt(areaGround.value || 0, 10);
        if (chkFirst.checked) total += parseInt(areaFirst.value || 0, 10);
        if (chkSecond.checked) total += parseInt(areaSecond.value || 0, 10);
        if (chkBasement.checked) total += parseInt(areaBasement.value || 0, 10);
        if (chkMumty.checked) total += parseInt(areaMumty.value || 0, 10);
        if (chkGarage.checked) total += parseInt(areaGarage.value || 0, 10);

        wizardTotalArea.textContent = total.toLocaleString();
    }

    // Toggle disabled inputs based on checkboxes
    function setupFloorToggle(checkbox, inputField) {
        checkbox.addEventListener('change', () => {
            inputField.disabled = !checkbox.checked;
            if (!checkbox.checked) {
                inputField.value = 0;
            } else {
                // Restore standard default based on plot template
                const template = plotAreasConfig[wizardPlotSize.value];
                if (template) {
                    if (inputField === areaGround) inputField.value = template.ground;
                    if (inputField === areaFirst) inputField.value = template.first;
                    if (inputField === areaSecond) inputField.value = 800; // default standard guess
                    if (inputField === areaBasement) inputField.value = 1200; // guess
                    if (inputField === areaMumty) inputField.value = template.mumty;
                    if (inputField === areaGarage) inputField.value = template.garage;
                } else {
                    inputField.value = 1000; // general fallback
                }
            }
            calculateCoveredArea();
        });
        inputField.addEventListener('input', calculateCoveredArea);
    }

    setupFloorToggle(chkGround, areaGround);
    setupFloorToggle(chkFirst, areaFirst);
    setupFloorToggle(chkSecond, areaSecond);
    setupFloorToggle(chkBasement, areaBasement);
    setupFloorToggle(chkMumty, areaMumty);
    setupFloorToggle(chkGarage, areaGarage);

    wizardPlotSize.addEventListener('change', applyPlotSizeTemplate);


    // --- CORE CALCULATION ROW BUILDERS ---
    let activeSpreadsheetItems = [];

    // Formats numbers as PKR
    function formatPKR(val) {
        return 'PKR ' + Math.round(val).toLocaleString('en-US');
    }

    function getSelectedWizardState() {
        const cityKey = document.getElementById('wizardCity').value;
        const qualityKey = document.querySelector('input[name="wizardQuality"]:checked').value;
        const typeKey = document.querySelector('input[name="wizardType"]:checked').value;
        const totalAreaVal = parseInt(wizardTotalArea.textContent.replace(/,/g, ''), 10);

        return {
            cityKey,
            qualityKey,
            typeKey,
            totalArea: totalAreaVal
        };
    }

    wizardGenBtn.addEventListener('click', () => {
        generateDetailedEstimate();
        
        // Show estimate result sheet & scroll to it
        const resSheet = document.getElementById('costResultContainer');
        resSheet.style.display = 'block';
        resSheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    function generateDetailedEstimate() {
        if (!platformData) return;

        const state = getSelectedWizardState();
        const cityData = platformData.cities[state.cityKey];
        const qualityData = platformData.quality_coefs[state.qualityKey];
        const index = platformData.material_index;
        
        // Update estimate metadata display
        document.getElementById('metaScope').textContent = getScopeLabel(state.typeKey);
        document.getElementById('metaQuality').textContent = qualityData.label || state.qualityKey.toUpperCase();
        document.getElementById('metaCoveredArea').textContent = state.totalArea.toLocaleString() + ' Sq Ft';
        document.getElementById('metaLocation').textContent = cityData.label;
        document.getElementById('printReportDate').textContent = new Date().toISOString().split('T')[0];

        // Prepare calculations coefficients
        const greyCoefs = qualityData.grey_structure;
        const finishCoefs = qualityData.finishing;
        const area = state.totalArea;

        // Reset active items registry
        activeSpreadsheetItems = [];

        // Build list of calculator item calculations
        const includeGrey = state.typeKey === 'grey' || state.typeKey === 'turnkey';
        const includeFinish = state.typeKey === 'finishing' || state.typeKey === 'turnkey';

        if (includeGrey) {
            // Foundation
            pushItem('Foundation', 'Excavation & clearing works', area * 0.45, 'CFT', 60, 'labour');
            pushItem('Foundation', 'Sand filling & consolidation', area * 0.25, 'CFT', index.sand.rate, 'materials');
            pushItem('Foundation', 'Soil compaction machinery', area * 0.05, 'Hours', 800, 'equipment');
            pushItem('Foundation', 'Foundation Steel structure cage', area * greyCoefs.steel_ton_per_sqft * 0.2, 'Ton', index.steel.rate, 'materials');
            pushItem('Foundation', 'Concrete pour (1:2:4 base mix)', area * greyCoefs.cement_bag_per_sqft * 0.2, 'Bag', index.cement.rate, 'materials');
            pushItem('Foundation', 'Excavator & compaction labour', area, 'Sq Ft', greyCoefs.labour_rate_per_sqft * 0.25, 'labour');

            // Brick Work
            pushItem('Brick Work', 'Bricks (First-Class Gutka clay)', area * greyCoefs.bricks_pcs_per_sqft * 0.75 / 1000, '1000 Pcs', index.bricks.rate, 'materials');
            pushItem('Brick Work', 'Cement for masonry mortar mix', area * greyCoefs.cement_bag_per_sqft * 0.35, 'Bag', index.cement.rate, 'materials');
            pushItem('Brick Work', 'Sand for mortar mix', area * greyCoefs.sand_cft_per_sqft * 0.4, 'CFT', index.sand.rate, 'materials');
            pushItem('Brick Work', 'Mason & Helpers brick laying labour', area, 'Sq Ft', greyCoefs.labour_rate_per_sqft * 0.35, 'labour');

            // RCC Structural Frame
            pushItem('RCC Structure', 'Grade 60 Deformed steel bars', area * greyCoefs.steel_ton_per_sqft * 0.75, 'Ton', index.steel.rate, 'materials');
            pushItem('RCC Structure', 'Cement bags for structural casting', area * greyCoefs.cement_bag_per_sqft * 0.45, 'Bag', index.cement.rate, 'materials');
            pushItem('RCC Structure', 'Crush aggregate (Margalla/Sargodha)', area * greyCoefs.crush_cft_per_sqft, 'CFT', index.crusher.rate, 'materials');
            pushItem('RCC Structure', 'Concrete mixer & hoisting lifts', area, 'Sq Ft', greyCoefs.equipment_rate_per_sqft * 0.6, 'equipment');
            pushItem('RCC Structure', 'RCC casting labour crew', area, 'Sq Ft', greyCoefs.labour_rate_per_sqft * 0.4, 'labour');
            pushItem('RCC Structure', 'Metal/Wood shuttering rentals', area, 'Sq Ft', greyCoefs.equipment_rate_per_sqft * 0.4, 'equipment');

            // Roof Slab
            pushItem('Roof & Slabs', 'Roof steel binding mesh', area * greyCoefs.steel_ton_per_sqft * 0.05, 'Ton', index.steel.rate, 'materials');
            pushItem('Roof & Slabs', 'Waterproofing coatings & bitumen', area, 'Sq Ft', greyCoefs.waterproofing_rate_per_sqft, 'misc');
        }

        if (includeFinish) {
            // Flooring
            pushItem('Flooring', 'Premium floor tiling (Porcelain/Ceramic)', area * finishCoefs.tile_sqft_per_sqft, 'Sq Ft', index.tile.rate, 'materials');
            pushItem('Flooring', 'Tile bond adhesive bags', area * 0.08, 'Bag', 950, 'materials');
            pushItem('Flooring', 'Tile laying & grout helper labour', area, 'Sq Ft', finishCoefs.finishing_labour_rate_per_sqft * 0.3, 'labour');

            // Plumbing & Sanitary
            pushItem('Plumbing', 'Piping distribution network (PPRC)', area, 'Sq Ft', index.plumbing.rate * 0.4, 'materials');
            pushItem('Plumbing', 'Overhead water tank & supply pump', 1, 'Unit', 85000, 'materials');
            pushItem('Plumbing', 'Sanitary plumbing installation labour', area, 'Sq Ft', finishCoefs.finishing_labour_rate_per_sqft * 0.25, 'labour');

            // Electrical
            pushItem('Electrical', 'Wiring cables & distribution DB panels', area, 'Sq Ft', index.electrical.rate * 0.7, 'materials');
            pushItem('Electrical', 'Busch-Jaeger switches/sockets (On Demand)', area * 0.15, 'Pcs', 2800, 'materials');
            pushItem('Electrical', 'Lighting fixtures & fan integrations', area, 'Sq Ft', index.electrical.rate * 0.3, 'materials');
            pushItem('Electrical', 'Electrical fitting labour crew', area, 'Sq Ft', finishCoefs.finishing_labour_rate_per_sqft * 0.2, 'labour');

            // Paint Works
            pushItem('Paint & Wall Putty', 'Wall putty & primer base preparation', area * 2.5, 'Sq Ft', 45, 'materials');
            pushItem('Paint & Wall Putty', 'Weather shield exterior/interior paints', area * finishCoefs.paint_litre_per_sqft, 'Litre', index.paint.rate, 'materials');
            pushItem('Paint & Wall Putty', 'Painters brushes & rollers', area, 'Sq Ft', 15, 'equipment');
            pushItem('Paint & Wall Putty', 'Premium painting labour crew', area * 2.5, 'Sq Ft', 60, 'labour');

            // Kitchen details
            pushItem('Kitchen Fitouts', 'Custom kitchen laminate cabinets', area * 0.05, 'Running Ft', 4500, 'materials');
            pushItem('Kitchen Fitouts', 'Countertops (Granite slabs)', area * 0.02, 'Sq Ft', 1400, 'materials');
            pushItem('Kitchen Fitouts', 'Kitchen fitters labour', 1, 'Lumpsum', 45000, 'labour');

            // Bathroom details
            pushItem('Bathroom Fitouts', 'Grohe Faucets & hansgrohe Showers', 2, 'Sets', 65000, 'materials');
            pushItem('Bathroom Fitouts', 'Bathroom vanities & ceramic sinks', 2, 'Sets', 25000, 'materials');
            pushItem('Bathroom Fitouts', 'Sanitary installation labour', 2, 'Sets', 8000, 'labour');
        }

        renderDetailedSpreadsheet();
    }

    function pushItem(category, label, qty, unit, rate, type) {
        activeSpreadsheetItems.push({
            id: activeSpreadsheetItems.length + 1,
            category,
            label,
            qty: parseFloat(qty.toFixed(2)),
            unit,
            rate: Math.round(rate),
            type // materials, labour, equipment, misc
        });
    }

    function getScopeLabel(key) {
        if (key === 'grey') return "Grey Structure Only";
        if (key === 'finishing') return "Finishing Only";
        return "Complete Turnkey";
    }

    // Render calculations spreadsheet rows
    function renderDetailedSpreadsheet() {
        const body = document.getElementById('estimateTableBody');
        if (!body) return;
        body.innerHTML = '';

        let lastCategory = '';
        
        activeSpreadsheetItems.forEach(item => {
            // Render category separator row if category changes
            if (item.category !== lastCategory) {
                lastCategory = item.category;
                const sepRow = document.createElement('tr');
                sepRow.className = 'category-header-row';
                sepRow.innerHTML = `
                    <td colspan="6">${item.category}</td>
                `;
                body.appendChild(sepRow);
            }

            const tr = document.createElement('tr');
            const subtotal = item.qty * item.rate;

            tr.innerHTML = `
                <td></td>
                <td>${item.label}</td>
                <td class="text-right">
                    <input type="number" step="any" class="qty-input form-control-sm" data-id="${item.id}" value="${item.qty}">
                </td>
                <td>${item.unit}</td>
                <td class="text-right">
                    <input type="number" class="rate-input form-control-sm" data-id="${item.id}" value="${item.rate}">
                </td>
                <td class="text-right row-subtotal" id="rowSubtotal-${item.id}">
                    ${formatPKR(subtotal)}
                </td>
            `;
            body.appendChild(tr);
        });

        // Add event listeners on input changes to trigger real-time updates
        setupInputListeners();
        recalculateTotals();
    }

    function setupInputListeners() {
        const qtyInputs = document.querySelectorAll('.qty-input');
        const rateInputs = document.querySelectorAll('.rate-input');

        qtyInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                const val = parseFloat(e.target.value) || 0;
                
                const item = activeSpreadsheetItems.find(i => i.id === id);
                if (item) {
                    item.qty = val;
                    updateRowSubtotal(item);
                    recalculateTotals();
                }
            });
        });

        rateInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                const val = parseInt(e.target.value, 10) || 0;

                const item = activeSpreadsheetItems.find(i => i.id === id);
                if (item) {
                    item.rate = val;
                    updateRowSubtotal(item);
                    recalculateTotals();
                }
            });
        });
    }

    function updateRowSubtotal(item) {
        const cell = document.getElementById(`rowSubtotal-${item.id}`);
        if (cell) {
            const sub = item.qty * item.rate;
            cell.textContent = formatPKR(sub);
        }
    }

    // Calculate final itemized cost grid summaries
    function recalculateTotals() {
        if (!platformData) return;

        let matCost = 0;
        let labCost = 0;
        let eqCost = 0;
        let miscCost = 0;

        activeSpreadsheetItems.forEach(item => {
            const sub = item.qty * item.rate;
            if (item.type === 'materials') matCost += sub;
            else if (item.type === 'labour') labCost += sub;
            else if (item.type === 'equipment') eqCost += sub;
            else miscCost += sub;
        });

        // Apply city logistics multiplier surcharge to standard base items
        const state = getSelectedWizardState();
        const cityData = platformData.cities[state.cityKey];
        const cityFactor = cityData ? cityData.factor : 1.0;

        matCost *= cityFactor;
        labCost *= cityFactor;
        eqCost *= cityFactor;
        miscCost *= cityFactor;

        // Apply margins & taxes
        const contractorMargin = (matCost + labCost + eqCost + miscCost) * 0.10;
        const taxes = (matCost + labCost + eqCost + miscCost) * 0.05;
        const grandTotal = matCost + labCost + eqCost + miscCost + contractorMargin + taxes;

        // Update displays
        document.getElementById('sumMaterialCost').textContent = formatPKR(matCost);
        document.getElementById('sumLabourCost').textContent = formatPKR(labCost);
        document.getElementById('sumEquipmentCost').textContent = formatPKR(eqCost);
        document.getElementById('sumMiscCost').textContent = formatPKR(miscCost);
        document.getElementById('sumMargin').textContent = formatPKR(contractorMargin);
        document.getElementById('sumTaxes').textContent = formatPKR(taxes);
        document.getElementById('sumGrandTotal').textContent = formatPKR(grandTotal);
    }


    // --- PLOT SOURCING FORM LEAD GEN ---
    const plotSearchForm = document.getElementById('plotSearchForm');
    const plotSearchSuccess = document.getElementById('plotSearchSuccess');

    if (plotSearchForm) {
        plotSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = plotSearchForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Searching...';
            submitBtn.disabled = true;

            setTimeout(() => {
                submitBtn.style.display = 'none';
                plotSearchSuccess.style.display = 'block';
            }, 1200);
        });
    }


    // --- MAIN CONTACT FORM SUBMIT ACTION ---
    const contactForm = document.getElementById('contactForm');
    const contactSuccessMsg = document.getElementById('contactSuccessMsg');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;

            setTimeout(() => {
                submitBtn.style.display = 'none';
                contactForm.reset();
                contactSuccessMsg.style.display = 'block';
                contactSuccessMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 1500);
        });
    }


    // --- COST RESULTS MINI LEAD GEN FORM ---
    const calcLeadForm = document.getElementById('calcLeadForm');
    const calcSuccessMsg = document.getElementById('calcSuccessMsg');

    if (calcLeadForm) {
        calcLeadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            calcLeadForm.style.display = 'none';
            calcSuccessMsg.style.display = 'block';
        });
    }


    // --- DYNAMIC SCROLL ACTIVE NAV LINK HIGHLIGHT ---
    const sections = document.querySelectorAll('section');
    
    window.addEventListener('scroll', () => {
        let currentSection = '';
        const scrollPosition = window.scrollY + 120; // offset header height

        sections.forEach(sec => {
            const secTop = sec.offsetTop;
            const secHeight = sec.clientHeight;
            if (scrollPosition >= secTop && scrollPosition < (secTop + secHeight)) {
                currentSection = sec.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    });

});
