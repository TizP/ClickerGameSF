// Ensure strict mode and better error handling
"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const GAME_VERSION = "1.22"; // Debugging Flex Workflow / Freeze
    const SAVE_KEY = `salesforcePipelineSaveData_v${GAME_VERSION}`;
    const TICK_INTERVAL_MS = 100;
    const DISPLAY_UPDATE_INTERVAL_MS = 250;
    const BUTTON_UPDATE_INTERVAL_MS = 1000;
    const AUTO_SAVE_INTERVAL_MS = 30000;
    const STATS_UPDATE_INTERVAL_MS = 1000;
    const WIN_AMOUNT = 1_000_000_000;
    const BUILDING_COST_MULTIPLIER = 1.10;
    const LEADS_PER_CUSTOMER_BASE = 100;
    const CUSTOMER_COST_MULTIPLIER = 1.01;
    const MONEY_FORMAT_THRESHOLD = 10000;
    const FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD = 1; // Deactivate if amounts differ by 1 or less

    // --- Powerup Constants ---
    const POWERUP_SPAWN_INTERVAL_MS = 10000;
    const POWERUP_CHANCE_PER_INTERVAL = 0.0333; // Approx 1 spawn every 300s (5 minutes)
    const POWERUP_FALL_DURATION_MS = 8000;
    const POWERUP_SFX_CLICK_ID = 'sfx-powerup-click';
    const POWERUP_TOKEN_SIZE = 90;

    // --- Powerup Configuration ---
    const powerupTypes = [
        { id: 'prodBoost', name: 'Pipeline Frenzy', duration: 30000, magnitude: 1.0, effectTarget: 'prod', image: 'powerup_prod.png', description: '+100% L/S & O/S' },
        { id: 'clickBoost', name: 'Click Power', duration: 30000, magnitude: 2.5, effectTarget: 'clicks', image: 'powerup_click.png', description: '+250% Click Value' },
        { id: 'moneyBoost', name: 'Revenue Surge', duration: 30000, magnitude: 1.0, effectTarget: 'mps', image: 'powerup_money.png', description: '+100% M/S' },
        { id: 'cvrBoost', name: 'Value Boost', duration: 30000, magnitude: 5.0, effectTarget: 'cvr', image: 'powerup_cvr.png', description: '+500% CVR' }
    ];

    // --- Music Playlist ---
    const playlist = [
        { name: "Batty McFaddin - Slower", filename: "Batty McFaddin - Slower.mp3" },
        { name: "Pixelland", filename: "Pixelland.mp3" },
        { name: "Disco con Tutti", filename: "Disco con Tutti.mp3" },
        { name: "Fox Tale Waltz Part 1 Instrumental", filename: "Fox Tale Waltz Part 1 Instrumental.mp3" },
        { name: "Mining by Moonlight", filename: "Mining by Moonlight.mp3" },
        { name: "Space Jazz", filename: "Space Jazz.mp3" },
        { name: "Surf Shimmy", filename: "Surf Shimmy.mp3" }
    ];
    let currentTrackIndex = 0;
    let musicShouldBePlaying = false;

    // --- Building & Upgrade Configurations ---
    const buildingsConfig = {
        sdr:            { baseCost: 10,     costCurrency: 'leads', baseLPS: 1,    name: "Sales Development Rep" },
        webform:        { baseCost: 400,    costCurrency: 'leads', baseLPS: 8,    name: "Web Form Handler" },
        pardot:         { baseCost: 5000,   costCurrency: 'leads', baseLPS: 50,   name: "Pardot Campaign" },
        nurture:        { baseCost: 20000,  costCurrency: 'leads', baseLPS: 150,  name: "Nurture Program" },
        marketingcloud: { baseCost: 50000,  costCurrency: 'leads', baseLPS: 300,  name: "Marketing Cloud Journey" },
        bdr:            { baseCost: 10,     costCurrency: 'opportunities', baseOPS: 1, name: "Business Development Rep" },
        qualbot:        { baseCost: 400,    costCurrency: 'opportunities', baseOPS: 8, name: "Qualification Bot" },
        solutionengineer:{ baseCost: 5000,   costCurrency: 'opportunities', baseOPS: 50, name: "Solution Engineer" },
        demospec:       { baseCost: 20000,  costCurrency: 'opportunities', baseOPS: 150,name: "Demo Specialist" },
        proposaldesk:   { baseCost: 50000,  costCurrency: 'opportunities', baseOPS: 300,name: "Proposal Desk" },
        integration:    { baseCostLeads: 50000,  baseCostOpps: 50000,  costCurrency: 'both', baseLPS: 200,  baseOPS: 200,  name: "Integration Hub" },
        platform:       { baseCostLeads: 250000, baseCostOpps: 250000, costCurrency: 'both', baseLPS: 1000, baseOPS: 1000, name: "Platform App" },
        ecosystem:      { baseCostLeads: 1000000,baseCostOpps: 1000000,costCurrency: 'both', baseLPS: 4000, baseOPS: 4000, name: "Partner Ecosystem" },
        cloudsuite:     { baseCostLeads: 5000000,baseCostOpps: 5000000,costCurrency: 'both', baseLPS: 15000,baseOPS: 15000,name: "Cloud Suite" },
        hyperscaler:    { baseCostLeads: 25000000,baseCostOpps: 25000000,costCurrency: 'both', baseLPS: 50000,baseOPS: 50000,name: "Hyperscaler Instance" },
     };
    const upgradesConfig = {
        // --- Manual Generation ---
        clickBoost1: { costLeads: 15, costOpps: 15, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 1; state.opportunitiesPerClick += 1; } },
        clickBoost2: { costLeads: 200, costOpps: 200, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 5; state.opportunitiesPerClick += 5; } },
        clickBoost3: { costLeads: 2500, costOpps: 2500, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 25; state.opportunitiesPerClick += 25; } },
        clickPercentBoost1: { costLeads: 1000, costOpps: 1000, costCurrency: 'both', effect: (state) => { state.leadClickPercentBonus += 0.01; state.oppClickPercentBonus += 0.01; } },
        clickPercentBoost2: { costLeads: 50000, costOpps: 50000, costCurrency: 'both', effect: (state) => { state.leadClickPercentBonus += 0.05; state.oppClickPercentBonus += 0.05; } },
        // --- Lead Team Boosts ---
        sdrBoostMult:      { cost: 25000,    costCurrency: 'leads', targetBuilding: 'sdr',     multiplierBonusLPS: 3 },
        webformBoostMult:  { cost: 50000,   costCurrency: 'leads', targetBuilding: 'webform', multiplierBonusLPS: 3 },
        pardotBoostMult:   { cost: 500000,  costCurrency: 'leads', targetBuilding: 'pardot',  multiplierBonusLPS: 3 },
        nurtureBoostMult:  { cost: 2000000, costCurrency: 'leads', targetBuilding: 'nurture', multiplierBonusLPS: 3 },
        mktCloudBoostMult: { cost: 5000000, costCurrency: 'leads', targetBuilding: 'marketingcloud', multiplierBonusLPS: 3 },
        // --- Opportunity Team Boosts ---
        bdrBoostMult:      { cost: 25000,    costCurrency: 'opportunities', targetBuilding: 'bdr',     multiplierBonusOPS: 3 },
        qualbotBoostMult:  { cost: 50000,   costCurrency: 'opportunities', targetBuilding: 'qualbot', multiplierBonusOPS: 3 },
        solEngBoostMult:   { cost: 500000,  costCurrency: 'opportunities', targetBuilding: 'solutionengineer', multiplierBonusOPS: 3 },
        demospecBoostMult: { cost: 2000000, costCurrency: 'opportunities', targetBuilding: 'demospec', multiplierBonusOPS: 3 },
        propDeskBoostMult: { cost: 5000000, costCurrency: 'opportunities', targetBuilding: 'proposaldesk', multiplierBonusOPS: 3 },
        // --- Integrated Solution Boosts ---
        integrationBoostPercent: { cost: 1000000,   costCurrency: 'leads', targetBuilding: 'integration', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
        platformBoostPercent:    { cost: 5000000,   costCurrency: 'opportunities', targetBuilding: 'platform', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
        ecosystemBoostPercent:   { cost: 15000000,  costCurrency: 'leads', targetBuilding: 'ecosystem', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
        cloudsuiteBoostPercent:  { cost: 50000000, costCurrency: 'opportunities', targetBuilding: 'cloudsuite', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
        hyperscalerBoostPercent: { cost: 200000000, costCurrency: 'leads', targetBuilding: 'hyperscaler', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
        // --- Pipeline Efficiency ---
        efficiency1:{ cost: 1000,   costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.10; } },
        efficiency2:{ cost: 10000,  costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.15; } },
        efficiency3:{ cost: 100000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.20; } },
        // --- Acquisition Rate ---
        car1:       { cost: 15000,  costCurrency: 'opportunities', effectValue: 0.20, targetRate: 'car' },
        car2:       { cost: 100000, costCurrency: 'opportunities', effectValue: 0.50, targetRate: 'car' },
        car3:       { cost: 500000, costCurrency: 'opportunities', effectValue: 1.00, targetRate: 'car' },
        // --- Acquisition Success Rate ---
        success1:   { cost: 1500,   costCurrency: 'opportunities', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); } },
        success2:   { cost: 10000,  costCurrency: 'opportunities', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.07); } },
        success3:   { cost: 50000,  costCurrency: 'opportunities', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); } },
        // --- Acquisition Cost Reduction ---
        costReduct1:{ cost: 5000,   costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.95; } },
        costReduct2:{ cost: 50000,  costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.90; } },
        costReduct3:{ cost: 300000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.85; } },
        // --- Customer Value Rate ---
        cvrBoost1:  { cost: 25000,    costCurrency: 'leads', effectValue: 0.50, targetRate: 'cvr' },
        cvrBoost2:  { cost: 300000,   costCurrency: 'leads', effectValue: 1.00, targetRate: 'cvr' },
        cvrBoost3:  { cost: 2000000,  costCurrency: 'leads', effectValue: 5.00, targetRate: 'cvr' },
        cvrBoostPercent: { cost: 15000000, costCurrency: 'leads', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 1.25; } },
        // --- Customer Driven Growth (REBALANCED v1.15) ---
        custGrowth1: { cost: 10, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.10; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.03); } },
        custGrowth2: { cost: 50, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.30; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); } },
        custGrowth3: { cost: 250, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 1.00; } },
        custGrowth4: { cost: 1000, costCurrency: 'customers', effect: (state) => { state.customerCostReductionMultiplier *= 0.90; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 1.00; } },
        custGrowth5: { cost: 5000, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 1.00; state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.25; state.cvrCustomerMultiplier = (state.cvrCustomerMultiplier || 1.0) * 1.15; } },
        // --- Special Upgrades ---
        flexibleWorkflow: { costMoney: 10000, costCustomers: 100 },
     };

    // --- Game State ---
    let gameState = {};

    // --- Derived State ---
    let leadsPerSecond = 0, opportunitiesPerSecond = 0, customerAcquisitionRate = 0, customerValueRate = 0, moneyPerSecond = 0;

    // --- Control Variables ---
    let gameLoopIntervalId = null, displayUpdateIntervalId = null, buttonUpdateIntervalId = null, autoSaveIntervalId = null, statsUpdateIntervalId = null;
    let powerupSpawnIntervalId = null;
    let isGameWon = false, isGamePaused = false, acquisitionAttemptRemainder = 0.0, saveStatusTimeoutId = null;
    let currentPowerupToken = null;
    let lastVolumeBeforeMute = 0.1;

    // --- DOM Element Cache ---
    const domElements = {};

    // --- Helper Functions ---
    function formatNumber(num) { if(num === Infinity) return 'Infinity'; if(num === null || num === undefined || isNaN(num)) return '0'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if(absNum < 1e3) return sign + absNum.toFixed(0); const tiers = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd']; const tierIndex = Math.max(0, Math.min(tiers.length - 1, Math.floor(Math.log10(absNum) / 3))); const scaledNum = absNum / Math.pow(1000, tierIndex); let precision = 0; if(tierIndex > 0) { if(scaledNum < 10) precision = 2; else if(scaledNum < 100) precision = 1; } const formattedNum = scaledNum.toFixed(precision); const finalNumString = (precision > 0 && parseFloat(formattedNum) === Math.floor(scaledNum)) ? Math.floor(scaledNum).toString() : formattedNum; return sign + finalNumString + tiers[tierIndex]; }
    function formatPerSecond(num, unit = "Units") { if(num !== 0 && Math.abs(num) < 10 && Math.abs(num) >= 0.01) return num.toFixed(2) + ` ${unit}/Sec`; else if(num !== 0 && Math.abs(num) < 0.01 && num !== 0) return num.toExponential(2) + ` ${unit}/Sec`; else return formatNumber(num) + ` ${unit}/Sec`; }
    function formatMoney(num) { if(num === null || num === undefined || isNaN(num)) return '0.00'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if(absNum < MONEY_FORMAT_THRESHOLD) return sign + absNum.toFixed(2); return sign + formatNumber(num); }
    function formatRateMoney(num) { if(num === 0 || num === null || num === undefined || isNaN(num)) return '0.000'; if(Math.abs(num) < 1e-3 && num !== 0) return num.toExponential(2); if(Math.abs(num) < 1) return num.toFixed(3); if(Math.abs(num) < 1000) return num.toFixed(2); return formatNumber(num); }
    function formatCAR(num) { return formatRateMoney(num); }
    function formatPercent(num, decimals = 1) { if(num === null || num === undefined || isNaN(num)) return '0.0%'; return (num * 100).toFixed(decimals) + '%'; }
    function formatTime(milliseconds) { if(milliseconds < 0 || isNaN(milliseconds)) return "0s"; const totalSeconds = Math.floor(milliseconds / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; let parts = []; if(days > 0) parts.push(`${days}d`); if(hours > 0) parts.push(`${hours}h`); if(minutes > 0) parts.push(`${minutes}m`); if(seconds >= 0 || parts.length === 0) parts.push(`${seconds}s`); return parts.join(' ') || '0s'; }

    // --- DOM Caching Function ---
    function cacheDOMElements() {
        console.log("Starting DOM Caching...");
        if (typeof domElements === 'undefined') { console.error("CRITICAL: domElements object undefined!"); return; }
        const ids = [
            'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
            'leads-per-click', 'opps-per-click', 'lead-click-base-p', 'opp-click-base-p',
            'car', 'success-chance', 'cvr', 'cust-cost',
            'click-lead-button', 'click-opp-button',
            'save-status',
            'background-music', 'current-track-name', 'play-pause-button', 'play-pause-icon',
            'next-track-button', 'volume-slider', 'mute-button', // Added mute-button
            'sfx-purchase', 'sfx-powerup-click',
            'credits-modal', 'close-credits-button', 'credits-button',
            'win-modal', 'close-win-button',
            'stats-modal', 'close-stats-button', 'stats-button',
            'tutorial-modal', 'close-tutorial-button', 'tutorial-button',
            'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps',
            'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed',
            'stat-total-money', 'stat-powerups-clicked',
            'save-button', 'delete-save-button', 'toggle-acquisition-button',
            'settings-button', 'toggle-flexible-workflow', 'game-version',
            'powerup-spawn-area', 'active-powerup-display'
        ];
        ids.forEach(id => { const el = document.getElementById(id); if (el) { domElements[id] = el; } else if (id === 'mute-button') { console.error(`CRITICAL: Mute Button element not found: ${id}`); } else if (!id.includes('-') || id.startsWith('stat-') || id.startsWith('sfx-')) { /* console.warn(`Potentially essential DOM Element not found: ${id}`); */ } });
        for (const id in buildingsConfig) { ['buy', 'count', 'cost', 'effect'].forEach(suffix => { const elId = suffix === 'buy' ? `buy-${id}` : `${id}-${suffix}`; const el = document.getElementById(elId); if (el) domElements[elId] = el; }); }
        for (const id in upgradesConfig) { const el = document.getElementById(`upgrade-${id}`); if (el) domElements[`upgrade-${id}`] = el; else if (id === 'flexibleWorkflow') { /* console.warn(`Purchase button 'upgrade-flexibleWorkflow' not found.`); */ } }
        if (!domElements['powerup-spawn-area']) { console.error("CRITICAL: Powerup Spawn Area not found!"); }
        console.log("Finished DOM Caching. Found:", Object.keys(domElements).length);
    }

    // --- Dynamic Cost Calculation ---
    function getUpgradeCost(id) { const cfg = upgradesConfig[id]; if (!cfg) return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity }; if (id === 'flexibleWorkflow') return { money: cfg.costMoney || 0, customers: cfg.costCustomers || 0, leads: 0, opps: 0 }; if (cfg.costCurrency === 'both') return { leads: cfg.costLeads || 0, opps: cfg.costOpps || 0, money: 0, customers: 0 }; else if (cfg.costCurrency === 'leads') return { leads: cfg.cost || 0, opps: 0, money: 0, customers: 0 }; else if (cfg.costCurrency === 'opportunities') return { leads: 0, opps: cfg.cost || 0, money: 0, customers: 0 }; else if (cfg.costCurrency === 'money') return { money: cfg.cost || 0, leads: 0, opps: 0, customers: 0 }; else if (cfg.costCurrency === 'customers') return { customers: cfg.cost || 0, leads: 0, opps: 0, money: 0 }; return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity }; }
    function getBuildingCost(id) { const cfg = buildingsConfig[id], state = gameState.buildings[id]; if (!cfg || !state) return { leads: Infinity, opps: Infinity }; const count = state.count || 0, mult = BUILDING_COST_MULTIPLIER; if (cfg.costCurrency === 'both') return { leads: Math.ceil((cfg.baseCostLeads || 0) * Math.pow(mult, count)), opps: Math.ceil((cfg.baseCostOpps || 0) * Math.pow(mult, count)) }; else if (cfg.costCurrency === 'leads') return { leads: Math.ceil((cfg.baseCost || 0) * Math.pow(mult, count)), opps: 0 }; else if (cfg.costCurrency === 'opportunities') return { leads: 0, opps: Math.ceil((cfg.baseCost || 0) * Math.pow(mult, count)) }; else if (cfg.costCurrency === 'money') return { money: Math.ceil((cfg.baseCost || 0) * Math.pow(mult, count)), leads: 0, opps: 0 }; return { leads: Infinity, opps: Infinity }; }
    function getCurrentCustomerCost() { return Math.max(1, Math.ceil(LEADS_PER_CUSTOMER_BASE * Math.pow(CUSTOMER_COST_MULTIPLIER, gameState.customerCountForCostIncrease || 0) * (gameState.customerCostReductionMultiplier || 1.0))); }

    // --- Core Calculation Function ---
    function calculateDerivedStats() {
        let rawLPS = 0, rawOPS = 0;
        let baseCAR = 0.1, baseCVR = 1.0;
        const globalEff = gameState.buildingEfficiencyMultiplier || 1.0;
        const custGlobalMult = gameState.custGlobalMultiplier || 1.0;

        // 1. Base production
        for (const id in buildingsConfig) {
             const cfg = buildingsConfig[id], count = gameState.buildings[id]?.count || 0;
             if (count > 0) {
                 let bLPS = cfg.baseLPS || 0, bOPS = cfg.baseOPS || 0,
                     fLPS = 0, fOPS = 0, pLPS = 1.0, pOPS = 1.0, mLPS = 1.0, mOPS = 1.0;
                 for (const upId in upgradesConfig) {
                     const uCfg = upgradesConfig[upId];
                     if (gameState.upgrades[upId]?.purchased && uCfg.targetBuilding === id) {
                         if (uCfg.flatBonusLPS) fLPS += uCfg.flatBonusLPS;
                         if (uCfg.flatBonusOPS) fOPS += uCfg.flatBonusOPS;
                         if (uCfg.percentBonusLPS) pLPS += uCfg.percentBonusLPS;
                         if (uCfg.percentBonusOPS) pOPS += uCfg.percentBonusOPS;
                         if (uCfg.multiplierBonusLPS) mLPS *= uCfg.multiplierBonusLPS;
                         if (uCfg.multiplierBonusOPS) mOPS *= uCfg.multiplierBonusOPS;
                     }
                 }
                 let finLPS = (bLPS + fLPS) * pLPS * mLPS;
                 let finOPS = (bOPS + fOPS) * pOPS * mOPS;
                 rawLPS += finLPS * count * globalEff * custGlobalMult;
                 rawOPS += finOPS * count * globalEff * custGlobalMult;
             }
         }

        // --- Flexible Workflow Logic ---
        let finalLPS = rawLPS;
        let finalOPS = rawOPS;

        if (gameState.flexibleWorkflowActive) {
            const currentLeads = Math.floor(gameState.leads);
            const currentOpps = Math.floor(gameState.opportunities);
            const difference = Math.abs(currentLeads - currentOpps);

            // console.log(`Flex Check - Leads: ${currentLeads}, Opps: ${currentOpps}, Diff: ${difference}, Threshold: ${FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD}`); // Debug log

            if (difference > FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
                if (currentLeads < currentOpps) {
                    // Leads are lower, boost LPS
                    const transfer = Math.max(0, rawOPS * 0.5);
                    if (!isNaN(transfer) && isFinite(transfer)) {
                        finalLPS = rawLPS + transfer;
                        finalOPS = rawOPS - transfer;
                        // console.log(`Flex: Transferring ${transfer.toFixed(2)} from OPS to LPS. Raw LPS: ${rawLPS.toFixed(2)}, Raw OPS: ${rawOPS.toFixed(2)}`);
                    } else {
                         console.error("Flex Workflow: Invalid transfer value calculated (OPS -> LPS). Transfer:", transfer, "RawOPS:", rawOPS);
                    }
                } else { // currentOpps < currentLeads
                    // Opportunities are lower, boost OPS
                    const transfer = Math.max(0, rawLPS * 0.5);
                     if (!isNaN(transfer) && isFinite(transfer)) {
                        finalLPS = rawLPS - transfer;
                        finalOPS = rawOPS + transfer;
                        // console.log(`Flex: Transferring ${transfer.toFixed(2)} from LPS to OPS. Raw LPS: ${rawLPS.toFixed(2)}, Raw OPS: ${rawOPS.toFixed(2)}`);
                    } else {
                        console.error("Flex Workflow: Invalid transfer value calculated (LPS -> OPS). Transfer:", transfer, "RawLPS:", rawLPS);
                    }
                }
            } else {
                 // console.log("Flex: Amounts too close, no transfer.");
            }
        }
        // --- End Flexible Workflow Logic ---

        // Ensure rates are not negative and are valid numbers
        finalLPS = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
        finalOPS = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;

        // 3. Apply Production Boost (Powerup)
        const prodBoost = gameState.activeBoosts?.['prodBoost'];
        if (prodBoost) {
            const mult = 1.0 + prodBoost.magnitude;
            finalLPS *= mult;
            finalOPS *= mult;
         }

        // 4. Base rates (CAR, CVR)
        for (const id in upgradesConfig) { if (id === 'flexibleWorkflow') continue; const cfg = upgradesConfig[id]; if (gameState.upgrades[id]?.purchased) { if (cfg.targetRate === 'car') baseCAR += cfg.effectValue; if (cfg.targetRate === 'cvr') baseCVR += cfg.effectValue; } }
        baseCAR += gameState.custUpgradeBonusCAR || 0; baseCVR += gameState.custUpgradeBonusCVR || 0; baseCVR *= (gameState.cvrMultiplierBonus || 1.0); baseCVR *= (gameState.cvrCustomerMultiplier || 1.0);

        // 5. Apply CVR Boost (Powerup)
        const cvrBoost = gameState.activeBoosts?.['cvrBoost']; if (cvrBoost) { const mult = 1.0 + cvrBoost.magnitude; baseCVR *= mult; }

        // 6. Assign final rate values - ensure they are valid numbers
        leadsPerSecond = (!isNaN(finalLPS) && isFinite(finalLPS)) ? finalLPS : 0;
        opportunitiesPerSecond = (!isNaN(finalOPS) && isFinite(finalOPS)) ? finalOPS : 0;
        customerAcquisitionRate = (!isNaN(baseCAR) && isFinite(baseCAR)) ? Math.max(0, baseCAR) : 0;
        customerValueRate = (!isNaN(baseCVR) && isFinite(baseCVR)) ? Math.max(0, baseCVR) : 0;

        // 7. Calculate Money/Second
        let finalMPS = (gameState.customers || 0) * customerValueRate;
        const moneyBoost = gameState.activeBoosts?.['moneyBoost'];
        if (moneyBoost) { finalMPS *= (1.0 + moneyBoost.magnitude); }
        moneyPerSecond = (!isNaN(finalMPS) && isFinite(finalMPS)) ? finalMPS : 0;

         // console.log(`Derived Stats - LPS: ${leadsPerSecond.toFixed(2)}, OPS: ${opportunitiesPerSecond.toFixed(2)}, MPS: ${moneyPerSecond.toFixed(2)}`); // Debug Log
    }

    // --- Display Update Functions ---
    function updateDisplay() {
        try {
            const core = [domElements.leads, domElements.opportunities, domElements.customers, domElements.money, domElements.lps, domElements.ops, domElements.mps, domElements['leads-per-click'], domElements['opps-per-click'], domElements.car, domElements['success-chance'], domElements.cvr, domElements['cust-cost']];
            if (core.some(el => !el)) return;

            domElements.leads.textContent = formatNumber(gameState.leads);
            domElements.opportunities.textContent = formatNumber(gameState.opportunities);
            domElements.customers.textContent = formatNumber(gameState.customers);
            domElements.money.textContent = '$' + formatMoney(gameState.money);
            domElements.lps.textContent = formatNumber(leadsPerSecond);
            domElements.ops.textContent = formatNumber(opportunitiesPerSecond);
            domElements.mps.textContent = '$' + formatMoney(moneyPerSecond);

            // --- Calculate and Display Effective Clicks ---
            const clickBoost = gameState.activeBoosts?.['clickBoost'];
            const clickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;

             // Use derived rates, ensuring they are numbers
            const currentLPS = (typeof leadsPerSecond === 'number' && isFinite(leadsPerSecond)) ? leadsPerSecond : 0;
            const currentOPS = (typeof opportunitiesPerSecond === 'number' && isFinite(opportunitiesPerSecond)) ? opportunitiesPerSecond : 0;

            let effectiveLeadsPerClick = (gameState.leadsPerClick + (currentLPS * (gameState.leadClickPercentBonus || 0))) * clickMultiplier;
            let effectiveOppsPerClick = (gameState.opportunitiesPerClick + (currentOPS * (gameState.oppClickPercentBonus || 0))) * clickMultiplier;

            domElements['leads-per-click'].textContent = formatNumber(effectiveLeadsPerClick);
            domElements['opps-per-click'].textContent = formatNumber(effectiveOppsPerClick);

            // Update tooltips
            if (domElements['lead-click-base-p']) {
                const base = gameState.leadsPerClick;
                const bonusPercentAmt = currentLPS * (gameState.leadClickPercentBonus || 0);
                let title = `Effective: ${formatNumber(effectiveLeadsPerClick)}/Click\nBase: ${formatNumber(base)}\n% Bonus: +${formatPercent(gameState.leadClickPercentBonus, 1)} L/S (+${formatNumber(bonusPercentAmt)})`;
                if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
                domElements['lead-click-base-p'].title = title;
            }
            if (domElements['opp-click-base-p']) {
                const base = gameState.opportunitiesPerClick;
                const bonusPercentAmt = currentOPS * (gameState.oppClickPercentBonus || 0);
                 let title = `Effective: ${formatNumber(effectiveOppsPerClick)}/Click\nBase: ${formatNumber(base)}\n% Bonus: +${formatPercent(gameState.oppClickPercentBonus, 1)} O/S (+${formatNumber(bonusPercentAmt)})`;
                if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
                domElements['opp-click-base-p'].title = title;
            }
            // --- End Effective Click Display ---

            domElements.car.textContent = formatCAR(customerAcquisitionRate);
            domElements['success-chance'].textContent = (gameState.acquisitionSuccessChance * 100).toFixed(1);
            domElements.cvr.textContent = formatRateMoney(customerValueRate);
            domElements['cust-cost'].textContent = formatNumber(getCurrentCustomerCost());

            updateActivePowerupDisplay();

        } catch (e) { console.error("Err updateDisplay:", e); }
    }
    function updateButtonStates() {
        const isDisabledGlobal = isGamePaused || isGameWon; try { for (const id in buildingsConfig) { const btn=domElements[`buy-${id}`], cnt=domElements[`${id}-count`], cst=domElements[`${id}-cost`], eff=domElements[`${id}-effect`]; if(!btn||!cnt||!cst) continue; const cfg=buildingsConfig[id], state=gameState.buildings[id]||{count:0}, cost=getBuildingCost(id); let afford=false, cTxt='?'; if(cfg.costCurrency==='both'){afford=gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`;} else if(cfg.costCurrency==='leads'){afford=gameState.leads>=cost.leads; cTxt=`${formatNumber(cost.leads)} L`;} else if(cfg.costCurrency==='opportunities'){afford=gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.opps)} O`;} else if(cfg.costCurrency==='money'){afford=gameState.money>=cost.money; cTxt=`$${formatMoney(cost.money)}`;} btn.disabled=!afford||isDisabledGlobal; cst.textContent=`Cost: ${cTxt}`; cnt.textContent=state.count; if(eff){let bLPS=cfg.baseLPS||0,bOPS=cfg.baseOPS||0,fLPS=0,fOPS=0,pLPS=1.0,pOPS=1.0,mLPS=1.0,mOPS=1.0; const gE=gameState.buildingEfficiencyMultiplier||1.0, cM=gameState.custGlobalMultiplier||1.0; for(const uId in upgradesConfig){const uCfg=upgradesConfig[uId];if(gameState.upgrades[uId]?.purchased&&uCfg.targetBuilding===id){if(uCfg.flatBonusLPS)fLPS+=uCfg.flatBonusLPS;if(uCfg.flatBonusOPS)fOPS+=uCfg.flatBonusOPS;if(uCfg.percentBonusLPS)pLPS+=uCfg.percentBonusLPS;if(uCfg.percentBonusOPS)pOPS+=uCfg.percentBonusOPS;if(uCfg.multiplierBonusLPS)mLPS*=uCfg.multiplierBonusLPS;if(uCfg.multiplierBonusOPS)mOPS*=uCfg.multiplierBonusOPS;}} let finLPS=(bLPS+fLPS)*pLPS*mLPS*gE*cM, finOPS=(bOPS+fOPS)*pOPS*mOPS*gE*cM; const parts=[]; if(finLPS>0)parts.push(`+${formatNumber(finLPS)} L`); if(finOPS>0)parts.push(`+${formatNumber(finOPS)} O`); eff.textContent=parts.length>0?parts.join(', '):"No Effect";}} for (const id in upgradesConfig) { const el=domElements[`upgrade-${id}`]; if(!el) continue; const cfg=upgradesConfig[id], state=gameState.upgrades[id]||{purchased:false}, cost=getUpgradeCost(id); let afford=false, cTxt='?'; if(id==='flexibleWorkflow'){afford=gameState.money>=cost.money&&gameState.customers>=cost.customers; cTxt=`${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`;} else if(cfg.costCurrency==='both'){afford=gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`;} else if(cfg.costCurrency==='leads'){afford=gameState.leads>=cost.leads; cTxt=`${formatNumber(cost.leads)} L`;} else if(cfg.costCurrency==='opportunities'){afford=gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.opps)} O`;} else if(cfg.costCurrency==='money'){afford=gameState.money>=cost.money; cTxt=`$${formatMoney(cost.money)}`;} else if(cfg.costCurrency==='customers'){afford=gameState.customers>=cost.customers; cTxt=`${formatNumber(cost.customers)} Cust`;} const purchased=state.purchased===true; el.disabled=!afford||purchased||isDisabledGlobal; const cstSpn=el.querySelector('.cost'), effSpn=el.querySelector('.effect'); if(purchased){el.classList.add('purchased'); if(cstSpn)cstSpn.style.display='none'; if(effSpn)effSpn.style.display='none';} else {el.classList.remove('purchased'); if(cstSpn){cstSpn.style.display='block'; cstSpn.textContent=`Cost: ${cTxt}`;} if(effSpn)effSpn.style.display='block';}} updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); updateMuteButtonVisuals(); // Also update mute button visuals here
        } catch (e) { console.error("Err updateButtons:", e); } }
    function updateAcquisitionButtonVisuals() { const btn = domElements['toggle-acquisition-button']; if (!btn) return; const isPaused = gameState.isAcquisitionPaused; btn.textContent = isPaused ? 'Resume Acq' : 'Pause Acq'; btn.title = isPaused ? 'Resume consumption' : 'Pause consumption'; btn.classList.toggle('paused', isPaused); btn.disabled = isGameWon || isGamePaused; }
    function updateFlexibleWorkflowToggleButtonVisuals() { const btn = domElements['toggle-flexible-workflow']; if (!btn) return; const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true; const isActive = gameState.flexibleWorkflowActive; btn.disabled = !isPurchased || isGamePaused || isGameWon; btn.classList.toggle('active', isActive && isPurchased); if (isActive && isPurchased) { btn.textContent = 'Deactivate Flex'; btn.title = 'Stop balancing L/O gen.'; } else { btn.textContent = 'Activate Flex'; btn.title = isPurchased ? 'Balance L/O gen.' : 'Purchase Flex Workflow first.'; } }

    // --- Sound Effect Helper ---
    function playSoundEffect(audioElement) {
        if (!audioElement || gameState.isMuted) return;
        if (audioElement.readyState >= 2) {
            audioElement.currentTime = 0;
            audioElement.play().catch(()=>{});
        }
    }

    // --- Purchase Functions ---
    function buyBuilding(id) { if(isGamePaused||isGameWon)return; const cfg=buildingsConfig[id], state=gameState.buildings[id]; if(!cfg||!state)return; const cost=getBuildingCost(id), curr=cfg.costCurrency; let afford=false; if(curr==='both'){if(gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps){gameState.leads-=cost.leads;gameState.opportunities-=cost.opps;afford=true;}} else if(curr==='leads'){if(gameState.leads>=cost.leads){gameState.leads-=cost.leads;afford=true;}} else if(curr==='opportunities'){if(gameState.opportunities>=cost.opps){gameState.opportunities-=cost.opps;afford=true;}} else if(curr==='money'){if(gameState.money>=cost.money){gameState.money-=cost.money;afford=true;}} if(afford){state.count++; playSoundEffect(domElements['sfx-purchase']); calculateDerivedStats(); updateDisplay(); updateButtonStates();}}
    function buyUpgrade(id) { if(isGamePaused||isGameWon)return; const cfg=upgradesConfig[id], state=gameState.upgrades[id]; if(!cfg||!state||state.purchased)return; const cost=getUpgradeCost(id); let afford=false; if(id==='flexibleWorkflow'){if(gameState.money>=cost.money&&gameState.customers>=cost.customers){gameState.money-=cost.money;gameState.customers-=cost.customers;afford=true;}} else if(cfg.costCurrency==='both'){if(gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps){gameState.leads-=cost.leads;gameState.opportunities-=cost.opps;afford=true;}} else if(cfg.costCurrency==='leads'){if(gameState.leads>=cost.leads){gameState.leads-=cost.leads;afford=true;}} else if(cfg.costCurrency==='opportunities'){if(gameState.opportunities>=cost.opps){gameState.opportunities-=cost.opps;afford=true;}} else if(cfg.costCurrency==='money'){if(gameState.money>=cost.money){gameState.money-=cost.money;afford=true;}} else if(cfg.costCurrency==='customers'){if(gameState.customers>=cost.customers){gameState.customers-=cost.customers;afford=true;}} if(afford){state.purchased=true; playSoundEffect(domElements['sfx-purchase']); if(typeof cfg.effect==='function')cfg.effect(gameState); calculateDerivedStats(); updateDisplay(); updateButtonStates();}}

    // --- Music Player Logic ---
    function loadTrack(idx, play) { const music=domElements['background-music'], nameEl=domElements['current-track-name']; if(!music||!nameEl||!playlist.length)return; currentTrackIndex=(idx+playlist.length)%playlist.length; const track=playlist[currentTrackIndex]; if(!track)return; musicShouldBePlaying=play; let src=music.querySelector('source[type="audio/mpeg"]')||document.createElement('source'); src.type='audio/mpeg'; src.src=`resources/audio/${track.filename}`; if(!src.parentNode)music.appendChild(src); nameEl.textContent=track.name; music.load(); music.removeEventListener('canplay',handleCanPlay); music.addEventListener('canplay',handleCanPlay,{once:true}); updatePlayPauseIcon();}
    function handleCanPlay() { if(musicShouldBePlaying)playCurrentTrack(); else updatePlayPauseIcon();}
    function playCurrentTrack() {
        const music=domElements['background-music'];
        if(!music || !music.currentSrc || gameState.isMuted){
            musicShouldBePlaying=false;
            updatePlayPauseIcon();
            return;
        }
        music.play().then(()=>{
            musicShouldBePlaying=true;
            updatePlayPauseIcon();
        }).catch(e=>{
            if(e.name!=='NotAllowedError')console.warn("Playback fail:",e);
            musicShouldBePlaying=false;
            updatePlayPauseIcon();
        });
    }
    function pauseCurrentTrack() { const music=domElements['background-music']; if(music){music.pause(); musicShouldBePlaying=false; updatePlayPauseIcon();}}
    function updatePlayPauseIcon() { const icon=domElements['play-pause-icon'], btn=domElements['play-pause-button']; if(!icon||!btn)return; icon.innerHTML=musicShouldBePlaying?'❚❚':'►'; btn.title=musicShouldBePlaying?"Pause":"Play";}
    function playNextTrack() { if(domElements['background-music'])loadTrack(currentTrackIndex+1, musicShouldBePlaying);}
    function togglePlayPause() { const music=domElements['background-music']; if(!music)return; if(music.paused){if(!music.currentSrc||music.currentSrc===''||music.currentSrc===window.location.href)loadTrack(0,true); else playCurrentTrack();} else pauseCurrentTrack();}
    function setVolume(val = null) {
        const music = domElements['background-music'];
        const slider = domElements['volume-slider'];
        const sfxPurchase = domElements['sfx-purchase'];
        const sfxPowerup = domElements[POWERUP_SFX_CLICK_ID];

        if (!music || !slider) return;

        let vol = val !== null ? parseFloat(val) : parseFloat(slider.value);
        if (isNaN(vol)) vol = 0.1;
        vol = Math.max(0, Math.min(1, vol));

        if (gameState.isMuted && vol > 0) {
             console.log("Unmuting due to volume change");
             toggleMute(false); // Explicitly unmute
             // After unmuting, the volume will be set below
        }

        slider.value = vol;

        // Store volume if user changes it while unmuted OR if they change it to non-zero while muted
        if (!gameState.isMuted || vol > 0) {
             if (vol > 0) lastVolumeBeforeMute = vol;
        }


        if (!gameState.isMuted) {
            music.volume = vol;
            const sfxVol = Math.min(1, vol * 1.5);
            if(sfxPurchase) sfxPurchase.volume = sfxVol;
            if(sfxPowerup) sfxPowerup.volume = sfxVol;
        } else {
             // If muted, keep elements technically muted (done in toggleMute)
             // The slider value is already updated above
        }

        // If volume is set to 0 via slider, mute
        if (vol === 0 && !gameState.isMuted) {
            toggleMute(true);
        }

         updateMuteButtonVisuals();
    }
    function toggleMute(forceMuteState = null) {
        const music = domElements['background-music'];
        const sfxPurchase = domElements['sfx-purchase'];
        const sfxPowerup = domElements[POWERUP_SFX_CLICK_ID];
        const slider = domElements['volume-slider'];

        const shouldBeMuted = forceMuteState !== null ? forceMuteState : !gameState.isMuted;

        gameState.isMuted = shouldBeMuted;
        console.log(`Audio ${gameState.isMuted ? 'muted' : 'unmuted'}.`);

        if (gameState.isMuted) {
            if(music) music.muted = true;
            if(sfxPurchase) sfxPurchase.muted = true;
            if(sfxPowerup) sfxPowerup.muted = true;
            if(slider) {
                 // Only store volume if it was > 0 before setting slider to 0
                 if (parseFloat(slider.value) > 0) {
                     lastVolumeBeforeMute = parseFloat(slider.value);
                 }
                 slider.value = 0;
            }

            if (musicShouldBePlaying) {
                 pauseCurrentTrack();
                 musicShouldBePlaying = true; // Remember to resume later
            }

        } else {
            if(music) music.muted = false;
            if(sfxPurchase) sfxPurchase.muted = false;
            if(sfxPowerup) sfxPowerup.muted = false;

            const restoreVol = (lastVolumeBeforeMute > 0) ? lastVolumeBeforeMute : 0.1;
            if(slider) slider.value = restoreVol;
            // Apply volume to elements using setVolume - this handles element volume updates
            setVolume(restoreVol);

            if (musicShouldBePlaying && music && music.paused) {
                 playCurrentTrack();
            }
        }
        updateMuteButtonVisuals();
    }
    function updateMuteButtonVisuals() {
        const btn = domElements['mute-button'];
        const slider = domElements['volume-slider'];
        if (!btn || !slider) return;
        // Consider muted if explicitly muted OR if slider is exactly 0
        const isEffectivelyMuted = gameState.isMuted || parseFloat(slider.value) === 0;

        btn.textContent = isEffectivelyMuted ? '🔇' : '🔊';
        btn.classList.toggle('muted', isEffectivelyMuted);
        btn.title = isEffectivelyMuted ? "Unmute All Audio" : "Mute All Audio";
    }

    // --- Modal Logic ---
    function showModal(el) { if (el) el.classList.add('show'); }
    function hideModal(el) { if (el) el.classList.remove('show'); }
    function showCredits() { showModal(domElements['credits-modal']); } function hideCredits() { hideModal(domElements['credits-modal']); }
    function showStats() { const modal=domElements['stats-modal']; if (!modal) return; updateStatsDisplay(); showModal(modal); if (statsUpdateIntervalId) clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = setInterval(updateStatsDisplay, STATS_UPDATE_INTERVAL_MS); }
    function hideStats() { const modal=domElements['stats-modal']; if (!modal) return; hideModal(modal); if (statsUpdateIntervalId){clearInterval(statsUpdateIntervalId); statsUpdateIntervalId=null;} }
    function triggerWin() { if (isGameWon) return; console.log("WIN!"); isGameWon=true; isGamePaused=true; stopPowerupSpawning(); updateButtonStates(); updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); saveGame(); removeActivePowerupToken(); showModal(domElements['win-modal']); }
    function closeWinScreen() { hideModal(domElements['win-modal']); isGamePaused=false; startPowerupSpawning(); updateButtonStates(); updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); }
    function showTutorial() { showModal(domElements['tutorial-modal']); } function hideTutorial() { hideModal(domElements['tutorial-modal']); }

    // --- Stats Modal Update ---
    function updateStatsDisplay() {
        const modal = domElements['stats-modal'];
        if (!modal || !modal.classList.contains('show')) {
            if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; }
            return;
        }
        try {
            domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now()));
            domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks);
            domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks);
            domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads);
            domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps);
            domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads);
            domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps);
            domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts);
            domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions);
            domElements['stat-acq-failed'].textContent = formatNumber(gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions);
            if (domElements['stat-powerups-clicked']) { // Check if element exists
                 domElements['stat-powerups-clicked'].textContent = formatNumber(gameState.totalPowerupsClicked);
            }
            domElements['stat-total-money'].textContent = '$' + formatMoney(gameState.totalMoneyEarned);
        } catch (e) { console.error("Err stats display:", e); hideStats(); }
    }

    // --- Action Toggles ---
    function toggleAcquisitionPause() { if(isGameWon||isGamePaused)return; gameState.isAcquisitionPaused=!gameState.isAcquisitionPaused; updateAcquisitionButtonVisuals(); }
    function toggleFlexibleWorkflow() {
        if(isGamePaused||isGameWon||!gameState.upgrades['flexibleWorkflow']?.purchased)return;
        gameState.flexibleWorkflowActive=!gameState.flexibleWorkflowActive;
        console.log(`Flexible Workflow manually ${gameState.flexibleWorkflowActive ? 'activated' : 'deactivated'}.`);
        // Recalculate derived stats immediately to reflect the change for the *next* tick
        calculateDerivedStats();
        updateDisplay();         // Update displayed rates based on immediate recalculation
        updateButtonStates();    // Update toggle button appearance
    }

    // --- Powerup Logic ---
    function trySpawnPowerup() { if (isGamePaused||isGameWon||!domElements['powerup-spawn-area']||currentPowerupToken) return; if (Math.random() < POWERUP_CHANCE_PER_INTERVAL) { const idx = Math.floor(Math.random() * powerupTypes.length); createPowerupToken(powerupTypes[idx]); } }
    function createPowerupToken(data) { const area = domElements['powerup-spawn-area']; if (!area || currentPowerupToken) return; const token = document.createElement('div'); currentPowerupToken = token; token.classList.add('powerup-token'); token.style.backgroundImage = `url('resources/img/${data.image}')`; token.title = `${data.name} (${data.description}) - Click Me!`; token.powerupData = data; const areaW = area.offsetWidth; token.style.left = `${Math.random() * (areaW - POWERUP_TOKEN_SIZE)}px`; token.style.top = '-100px'; const clickHandler = (e) => { e.stopPropagation(); if (!token.parentNode) return; gameState.totalPowerupsClicked++; applyBoost(token.powerupData); playSoundEffect(domElements[POWERUP_SFX_CLICK_ID]); removeActivePowerupToken(token); }; const animEndHandler = () => removeActivePowerupToken(token); token.addEventListener('click', clickHandler); token.addEventListener('animationend', animEndHandler, { once: true }); token.style.animation = `fallAnimation ${POWERUP_FALL_DURATION_MS}ms linear`; area.appendChild(token); }
    function removeActivePowerupToken(tokenElement = null) { const tokenToRemove = tokenElement || currentPowerupToken; if (tokenToRemove && tokenToRemove.parentNode) { tokenToRemove.remove(); } if (tokenToRemove === currentPowerupToken) { currentPowerupToken = null; } }
    function applyBoost(data) { const id = data.id, dur = data.duration, mag = data.magnitude; if (gameState.powerupTimeouts[id]) clearTimeout(gameState.powerupTimeouts[id]); const powerupConfig = powerupTypes.find(p => p.id === id); const description = powerupConfig ? powerupConfig.description : ''; gameState.activeBoosts[id] = { endTime: Date.now() + dur, magnitude: mag, name: data.name, description: description }; gameState.powerupTimeouts[id] = setTimeout(() => removeBoost(id), dur); calculateDerivedStats(); updateDisplay(); updateButtonStates(); }
    function removeBoost(id) { if (gameState.activeBoosts[id]) { delete gameState.activeBoosts[id]; delete gameState.powerupTimeouts[id]; calculateDerivedStats(); updateDisplay(); updateButtonStates(); } }
    function updateActivePowerupDisplay() {
        const displayEl = domElements['active-powerup-display'];
        if (!displayEl) return;
        const activeIds = Object.keys(gameState.activeBoosts);
        if (activeIds.length === 0) { displayEl.innerHTML = ''; return; }
        const firstBoostId = activeIds[0];
        const boost = gameState.activeBoosts[firstBoostId];
        if (!boost) { displayEl.innerHTML = ''; return; }
        const remainingTimeMs = boost.endTime - Date.now();
        if (remainingTimeMs <= 0) { displayEl.innerHTML = ''; }
        else { const remainingSeconds = (remainingTimeMs / 1000).toFixed(1); displayEl.innerHTML = `${boost.name}: ${remainingSeconds}s<br><span style="font-size: 0.9em; font-weight: normal;">(${boost.description || 'Effect active'})</span>`; }
    }
    function restartBoostTimersOnLoad() { const now = Date.now(); gameState.powerupTimeouts = {}; for (const id in gameState.activeBoosts) { const boost = gameState.activeBoosts[id]; const remaining = boost.endTime - now; if (!boost.description) { const powerupConfig = powerupTypes.find(p => p.id === id); boost.description = powerupConfig ? powerupConfig.description : ''; } if (remaining > 0) { gameState.powerupTimeouts[id] = setTimeout(() => removeBoost(id), remaining); } else { delete gameState.activeBoosts[id]; } } calculateDerivedStats(); }

    // --- Save/Load Functions ---
    function displaySaveStatus(msg, dur=3000) { const el=domElements['save-status']; if(!el)return; if(saveStatusTimeoutId)clearTimeout(saveStatusTimeoutId); el.textContent=msg; el.classList.add('visible'); saveStatusTimeoutId=setTimeout(()=>el.classList.remove('visible'), dur); }
    function getDefaultGameState() {
        const state = {
            leads: 0, opportunities: 0, customers: 0, money: 0,
            leadsPerClick: 1, opportunitiesPerClick: 1, leadClickPercentBonus: 0, oppClickPercentBonus: 0,
            buildingEfficiencyMultiplier: 1.0, customerCostReductionMultiplier: 1.0,
            acquisitionSuccessChance: 0.25, cvrMultiplierBonus: 1.0, cvrCustomerMultiplier: 1.0, custGlobalMultiplier: 1.0,
            customerCountForCostIncrease: 0,
            isAcquisitionPaused: false, flexibleWorkflowActive: false, isMuted: false, // Added isMuted
            gameStartTime: Date.now(),
            totalLeadClicks: 0, totalOppClicks: 0, totalManualLeads: 0, totalManualOpps: 0,
            totalAutoLeads: 0, totalAutoOpps: 0, totalAcquisitionAttempts: 0, totalSuccessfulAcquisitions: 0,
            totalMoneyEarned: 0, totalPowerupsClicked: 0,
            custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0,
            buildings: {}, upgrades: {}, activeBoosts: {},
            powerupTimeouts: {} // Always transient
        };
        initializeStructureState(state, true); // Pass isInitial=true
        return state;
    }
    function initializeStructureState(state, isInitial) {
        if (!state.buildings) state.buildings = {};
        if (!state.upgrades) state.upgrades = {};
        for (const id in buildingsConfig) { if (!state.buildings[id]) state.buildings[id] = { count: 0 }; else state.buildings[id].count = Math.max(0, Math.floor(state.buildings[id].count || 0)); }
        for (const id in upgradesConfig) { if (!state.upgrades[id]) state.upgrades[id] = { purchased: false }; else state.upgrades[id].purchased = state.upgrades[id].purchased === true; }
        if (!isInitial) { for (const id in state.buildings) if (!buildingsConfig[id]) delete state.buildings[id]; for (const id in state.upgrades) if (!upgradesConfig[id]) delete state.upgrades[id]; }
        state.leads = Number(state.leads) || 0; state.opportunities = Number(state.opportunities) || 0; state.customers = Math.max(0, Math.floor(Number(state.customers) || 0)); state.money = Number(state.money) || 0;
        state.leadsPerClick = Number(state.leadsPerClick) || 1; state.opportunitiesPerClick = Number(state.opportunitiesPerClick) || 1; state.leadClickPercentBonus = Number(state.leadClickPercentBonus) || 0; state.oppClickPercentBonus = Number(state.oppClickPercentBonus) || 0;
        state.buildingEfficiencyMultiplier = Number(state.buildingEfficiencyMultiplier) || 1.0; state.customerCostReductionMultiplier = Number(state.customerCostReductionMultiplier) || 1.0;
        state.acquisitionSuccessChance = Math.max(0, Math.min(1.0, Number(state.acquisitionSuccessChance) || 0.25)); state.cvrMultiplierBonus = Number(state.cvrMultiplierBonus) || 1.0; state.cvrCustomerMultiplier = Number(state.cvrCustomerMultiplier) || 1.0; state.custGlobalMultiplier = Number(state.custGlobalMultiplier) || 1.0;
        state.customerCountForCostIncrease = Math.max(0, Math.floor(Number(state.customerCountForCostIncrease) || 0));
        state.isAcquisitionPaused = state.isAcquisitionPaused === true; state.flexibleWorkflowActive = state.flexibleWorkflowActive === true;
        state.isMuted = state.isMuted === true; // Sanitize isMuted
        state.gameStartTime = Number(state.gameStartTime) || Date.now();
        state.totalLeadClicks = Number(state.totalLeadClicks) || 0; state.totalOppClicks = Number(state.totalOppClicks) || 0; state.totalManualLeads = Number(state.totalManualLeads) || 0; state.totalManualOpps = Number(state.totalManualOpps) || 0;
        state.totalAutoLeads = Number(state.totalAutoLeads) || 0; state.totalAutoOpps = Number(state.totalAutoOpps) || 0; state.totalAcquisitionAttempts = Number(state.totalAcquisitionAttempts) || 0; state.totalSuccessfulAcquisitions = Number(state.totalSuccessfulAcquisitions) || 0; state.totalMoneyEarned = Number(state.totalMoneyEarned) || 0; state.totalPowerupsClicked = Number(state.totalPowerupsClicked) || 0;
        state.custUpgradeBonusCAR = Number(state.custUpgradeBonusCAR) || 0; state.custUpgradeBonusCVR = Number(state.custUpgradeBonusCVR) || 0;
        state.activeBoosts = (typeof state.activeBoosts === 'object' && state.activeBoosts !== null) ? state.activeBoosts : {};
        state.powerupTimeouts = {}; // Always reset this on load
    }
    function saveGame() { if(isGamePaused&&!isGameWon)return; try{ const stateToSave={...gameState}; delete stateToSave.powerupTimeouts; localStorage.setItem(SAVE_KEY,JSON.stringify(stateToSave)); displaySaveStatus(`Saved: ${new Date().toLocaleTimeString()}`); } catch(e){console.error("Save error:",e);displaySaveStatus("Save Error!",5000);}}
    function loadGame() {
        const json = localStorage.getItem(SAVE_KEY);
        gameState = getDefaultGameState();
        let ok = false;
        if (json) {
            try {
                const data = JSON.parse(json);
                 for (const key in gameState) {
                     if (key === 'powerupTimeouts') continue;
                     if (data.hasOwnProperty(key)) {
                         if (key === 'activeBoosts') { gameState.activeBoosts = (typeof data.activeBoosts === 'object' && data.activeBoosts !== null) ? data.activeBoosts : {}; }
                         else if ((key === 'buildings' || key === 'upgrades') && typeof data[key] === 'object' && data[key] !== null) {
                             for (const id in data[key]) {
                                 if ((key === 'buildings' && buildingsConfig[id]) || (key === 'upgrades' && upgradesConfig[id])) {
                                     if (!gameState[key][id]) gameState[key][id] = {};
                                     gameState[key][id] = { ...gameState[key][id], ...data[key][id] };
                                } } }
                         else if (typeof gameState[key] !== 'object' || gameState[key] === null) { gameState[key] = data[key]; }
                         else { console.warn(`Unhandled object type during load: ${key}`); gameState[key] = data[key]; }
                     }
                 }
                initializeStructureState(gameState, false);
                restartBoostTimersOnLoad();
                console.log("Save Loaded.");
                displaySaveStatus("Save loaded.");
                ok = true;
            } catch (e) { console.error("Load error:", e); displaySaveStatus("Load error! Resetting.", 5000); localStorage.removeItem(SAVE_KEY); gameState = getDefaultGameState(); }
        } else { console.log("No save found."); }
        calculateDerivedStats(); // Calculate initial stats after load or default setup
        // Mute state application moved to initializeGame after this function runs
        return ok;
    }
    function deleteSave() { if (confirm("Delete save? Cannot undo.")) { localStorage.removeItem(SAVE_KEY); displaySaveStatus("Save deleted. Reloading...", 3000); stopAllIntervals(); setTimeout(()=>location.reload(), 1500); } }

    // --- Event Listener Setup ---
    function setupEventListeners() {
        console.log("--- Attaching Listeners ---");
        // Clickers
        domElements['click-lead-button']?.addEventListener('click',()=>{
            console.log("Lead button clicked!"); // Debug log
            console.log(`Click State - isPaused: ${isGamePaused}, isWon: ${isGameWon}`); // Debug log
            if(isGamePaused || isGameWon) { console.log("Lead click blocked by game state."); return; }

            const clickBoost=gameState.activeBoosts?.['clickBoost'];
            const clickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;
            let baseAmt = gameState.leadsPerClick;
            let currentLPS = (typeof leadsPerSecond === 'number' && isFinite(leadsPerSecond)) ? leadsPerSecond : 0; // Ensure valid number
            let percentBonusVal = gameState.leadClickPercentBonus || 0;
            let percentBonusAmt = currentLPS * percentBonusVal;

            if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) { console.error("Invalid percentBonusAmt for leads:", percentBonusAmt, "LPS:", currentLPS, "Bonus%:", percentBonusVal); percentBonusAmt = 0; }

            let amt = (baseAmt + percentBonusAmt) * clickMultiplier;

             if (isNaN(amt) || !isFinite(amt)) { console.error("Final lead click amount is invalid:", amt, "Base:", baseAmt, "PercentAmt:", percentBonusAmt, "Multiplier:", clickMultiplier); return; }
            console.log(`Adding ${amt.toFixed(0)} leads from click.`); // Debug log

            gameState.leads += amt;
            gameState.totalLeadClicks++;
            gameState.totalManualLeads += amt;
            updateDisplay();
            updateButtonStates();
        });
        domElements['click-opp-button']?.addEventListener('click',()=>{
            console.log("Opp button clicked!"); // Debug log
             console.log(`Click State - isPaused: ${isGamePaused}, isWon: ${isGameWon}`); // Debug log
             if(isGamePaused || isGameWon) { console.log("Opp click blocked by game state."); return; }

            const clickBoost=gameState.activeBoosts?.['clickBoost'];
            const clickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;
            let baseAmt = gameState.opportunitiesPerClick;
            let currentOPS = (typeof opportunitiesPerSecond === 'number' && isFinite(opportunitiesPerSecond)) ? opportunitiesPerSecond : 0; // Ensure valid number
            let percentBonusVal = gameState.oppClickPercentBonus || 0;
            let percentBonusAmt = currentOPS * percentBonusVal;

             if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) { console.error("Invalid percentBonusAmt for opps:", percentBonusAmt, "OPS:", currentOPS, "Bonus%:", percentBonusVal); percentBonusAmt = 0; }

            let amt = (baseAmt + percentBonusAmt) * clickMultiplier;

             if (isNaN(amt) || !isFinite(amt)) { console.error("Final opp click amount is invalid:", amt, "Base:", baseAmt, "PercentAmt:", percentBonusAmt, "Multiplier:", clickMultiplier); return; }
             console.log(`Adding ${amt.toFixed(0)} opps from click.`); // Debug log

            gameState.opportunities += amt;
            gameState.totalOppClicks++;
            gameState.totalManualOpps += amt;
            updateDisplay();
            updateButtonStates();
        });
        // Purchases
        for(const id in buildingsConfig)domElements[`buy-${id}`]?.addEventListener('click',()=>buyBuilding(id));
        for(const id in upgradesConfig)domElements[`upgrade-${id}`]?.addEventListener('click',()=>buyUpgrade(id));
        // Music Controls
        domElements['play-pause-button']?.addEventListener('click',togglePlayPause);
        domElements['volume-slider']?.addEventListener('input',()=>setVolume());
        domElements['next-track-button']?.addEventListener('click',playNextTrack);
        domElements['background-music']?.addEventListener('ended',playNextTrack);
        domElements['mute-button']?.addEventListener('click', () => toggleMute()); // Mute Listener
        // Modals
        domElements['credits-button']?.addEventListener('click',showCredits);
        domElements['close-credits-button']?.addEventListener('click',hideCredits);
        domElements['credits-modal']?.addEventListener('click',(e)=>{if(e.target===domElements['credits-modal'])hideCredits();});
        domElements['stats-button']?.addEventListener('click',showStats);
        domElements['close-stats-button']?.addEventListener('click',hideStats);
        domElements['stats-modal']?.addEventListener('click',(e)=>{if(e.target===domElements['stats-modal'])hideStats();});
        domElements['tutorial-button']?.addEventListener('click',showTutorial);
        domElements['close-tutorial-button']?.addEventListener('click',hideTutorial);
        domElements['tutorial-modal']?.addEventListener('click',(e)=>{if(e.target===domElements['tutorial-modal'])hideTutorial();});
        domElements['close-win-button']?.addEventListener('click',closeWinScreen);
        // Save/Delete/Toggles
        domElements['save-button']?.addEventListener('click',saveGame);
        domElements['delete-save-button']?.addEventListener('click',deleteSave);
        domElements['toggle-acquisition-button']?.addEventListener('click',toggleAcquisitionPause);
        domElements['settings-button']?.addEventListener('click',()=>alert('Settings WIP.'));
        domElements['toggle-flexible-workflow']?.addEventListener('click',toggleFlexibleWorkflow);
        console.log("--- Listeners Attached ---");
    }

    // --- Game Loop ---
    function gameLoop() {
        if(isGamePaused) return;

        const secs = TICK_INTERVAL_MS / 1000.0;

        // Generate resources based on rates calculated in the *previous* loop iteration
        const lTick = leadsPerSecond * secs;
        const oTick = opportunitiesPerSecond * secs;

        // NaN/Infinity check before adding
        if (!isNaN(lTick) && isFinite(lTick)) {
             gameState.leads += lTick;
             gameState.totalAutoLeads += lTick;
        } else { console.warn(`Invalid lTick calculated: ${lTick}. LPS: ${leadsPerSecond}`); }
        if (!isNaN(oTick) && isFinite(oTick)) {
            gameState.opportunities += oTick;
            gameState.totalAutoOpps += oTick;
        } else { console.warn(`Invalid oTick calculated: ${oTick}. OPS: ${opportunitiesPerSecond}`); }

        // Acquisition attempts
        if(!gameState.isAcquisitionPaused){
             const cost=getCurrentCustomerCost();
             // Ensure CAR is valid before calculating attempts
             const currentCAR = (!isNaN(customerAcquisitionRate) && isFinite(customerAcquisitionRate)) ? customerAcquisitionRate : 0;
             let attempts = (currentCAR * secs) + acquisitionAttemptRemainder;
             let toMake = Math.floor(attempts);
             acquisitionAttemptRemainder = attempts - toMake;

             if(isNaN(toMake)){ // Extra paranoia check
                  console.error(`Invalid 'toMake' calculated in acquisition: ${toMake}`);
                  toMake = 0;
                  acquisitionAttemptRemainder = 0;
             }

             if(toMake > 0){
                 for(let i=0; i<toMake; i++){
                     if(gameState.leads>=cost && gameState.opportunities>=cost){
                         gameState.totalAcquisitionAttempts++;
                         gameState.leads-=cost;
                         gameState.opportunities-=cost;
                         if(Math.random()<gameState.acquisitionSuccessChance){
                             gameState.totalSuccessfulAcquisitions++;
                             gameState.customerCountForCostIncrease++;
                             gameState.customers++;
                         }
                     } else {
                         acquisitionAttemptRemainder += (toMake - i);
                         break;
                     }
                 }
                 if(gameState.leads < 0) gameState.leads = 0;
                 if(gameState.opportunities < 0) gameState.opportunities = 0;
             }
        }

        // Money generation
        const currentMPS = (!isNaN(moneyPerSecond) && isFinite(moneyPerSecond)) ? moneyPerSecond : 0;
        const mTick = currentMPS * secs;
        if (!isNaN(mTick) && isFinite(mTick)) {
             gameState.money += mTick;
             gameState.totalMoneyEarned += mTick;
        } else { console.warn(`Invalid mTick calculated: ${mTick}. MPS: ${currentMPS}`); }

        // Check for Flexible Workflow auto-deactivation AFTER resources are updated
        if (gameState.flexibleWorkflowActive) {
             const currentLeads = Math.floor(gameState.leads);
             const currentOpps = Math.floor(gameState.opportunities);
            if (Math.abs(currentLeads - currentOpps) <= FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
                console.log("Flexible Workflow auto-deactivated due to resource amount equality.");
                gameState.flexibleWorkflowActive = false;
                updateButtonStates(); // Update button visuals immediately
            }
        }

        // Check win condition
        if(!isGameWon && gameState.money >= WIN_AMOUNT) {
            triggerWin();
        }

        // Recalculate derived stats for the *next* tick AFTER all updates this tick
        calculateDerivedStats();
    }

    // --- Interval Management ---
    function stopAllIntervals() { [gameLoopIntervalId, displayUpdateIntervalId, buttonUpdateIntervalId, autoSaveIntervalId, statsUpdateIntervalId, powerupSpawnIntervalId].forEach(id => { if (id) clearInterval(id); }); gameLoopIntervalId=displayUpdateIntervalId=buttonUpdateIntervalId=autoSaveIntervalId=statsUpdateIntervalId=powerupSpawnIntervalId=null; console.log("Intervals stopped."); }
    function stopPowerupSpawning() { if (powerupSpawnIntervalId) clearInterval(powerupSpawnIntervalId); powerupSpawnIntervalId = null; console.log("Powerup spawning stopped."); }
    function startPowerupSpawning() { if (powerupSpawnIntervalId) return; powerupSpawnIntervalId = setInterval(trySpawnPowerup, POWERUP_SPAWN_INTERVAL_MS); console.log(`Powerup spawn check started (${POWERUP_SPAWN_INTERVAL_MS}ms interval, ~${(1 / POWERUP_CHANCE_PER_INTERVAL * POWERUP_SPAWN_INTERVAL_MS / 1000).toFixed(0)}s average spawn).`); }
    function startGameIntervals() { stopAllIntervals(); gameLoopIntervalId=setInterval(gameLoop,TICK_INTERVAL_MS); console.log(`Loop started (${TICK_INTERVAL_MS}ms).`); displayUpdateIntervalId=setInterval(updateDisplay,DISPLAY_UPDATE_INTERVAL_MS); console.log(`Display loop started (${DISPLAY_UPDATE_INTERVAL_MS}ms).`); buttonUpdateIntervalId=setInterval(updateButtonStates,BUTTON_UPDATE_INTERVAL_MS); console.log(`Button loop started (${BUTTON_UPDATE_INTERVAL_MS}ms).`); autoSaveIntervalId=setInterval(saveGame,AUTO_SAVE_INTERVAL_MS); console.log(`Autosave started (${AUTO_SAVE_INTERVAL_MS}ms).`); startPowerupSpawning(); }

    // --- Initialization ---
    function initializeGame() {
        console.log(`--- Initializing Game v${GAME_VERSION} ---`);
        try {
            cacheDOMElements();
            if (domElements['game-version']) { domElements['game-version'].textContent = `v${GAME_VERSION}`; }
        } catch (e) { console.error("DOM cache error:", e); alert("Fatal UI Init Error."); return; }

        loadGame(); // Loads state, calculates initial stats

        // Set initial volume/mute state AFTER loading & initial stat calc
        if (domElements['background-music'] && domElements['volume-slider']) {
             if (gameState.isMuted) { toggleMute(true); } // Force mute state if loaded
             else { setVolume(0.1); } // Set a default starting volume if not muted
            loadTrack(0, false);
        } else { console.warn("Music elements missing."); }

        updateDisplay(); // Initial display update
        updateButtonStates(); // Initial button state update
        setupEventListeners(); // Attach listeners LAST

        startGameIntervals(); // Start game loops

        // Check for already won state after loading
        if (!isGameWon && gameState.money >= WIN_AMOUNT) { /* ... win state handling ... */ }
        console.log("--- Game Initialized ---");
    }

    // --- Start ---
    initializeGame();

}); // End DOMContentLoaded