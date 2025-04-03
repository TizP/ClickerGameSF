// Ensure strict mode and better error handling
"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const SAVE_KEY = 'salesforcePipelineSaveData_v1.13'; // Incremented version for new upgrade logic
    const TICK_INTERVAL_MS = 100;
    const AUTO_SAVE_INTERVAL_MS = 30000;
    const STATS_UPDATE_INTERVAL_MS = 1000;
    const WIN_AMOUNT = 1_000_000_000;
    const BUILDING_COST_MULTIPLIER = 1.10;
    const LEADS_PER_CUSTOMER_BASE = 100;
    const CUSTOMER_COST_MULTIPLIER = 1.01;
    const MONEY_FORMAT_THRESHOLD = 10000;
    const FLEX_WORKFLOW_EQUALITY_THRESHOLD = 0.01; // How close LPS/OPS need to be to deactivate

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
        // --- Customer Driven Growth ---
        custGrowth1: { cost: 10, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.50; } },
        custGrowth2: { cost: 50, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.70; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.08); } },
        custGrowth3: { cost: 250, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 1.00; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 2.80; } },
        custGrowth4: { cost: 1000, costCurrency: 'customers', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 10.00; state.customerCostReductionMultiplier *= 0.95; } },
        custGrowth5: { cost: 5000, costCurrency: 'customers', effect: (state) => { state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.10; } },
        // --- Special Upgrades ---
        flexibleWorkflow: {
            costMoney: 10000,
            costCustomers: 100,
            // No 'effect' function here, purchasing it unlocks the toggle button.
            // The toggle's effect is handled in calculateDerivedStats based on gameState.flexibleWorkflowActive.
        },
     };

    // --- Game State ---
    let gameState = {}; // Populated by getDefaultGameState or loadGame

    // --- Derived State ---
    let leadsPerSecond = 0;
    let opportunitiesPerSecond = 0;
    let customerAcquisitionRate = 0;
    let customerValueRate = 0;
    let moneyPerSecond = 0;

    // --- Control Variables ---
    let gameLoopIntervalId = null;
    let autoSaveIntervalId = null;
    let statsUpdateIntervalId = null;
    let isGameWon = false;
    let isGamePaused = false;
    let acquisitionAttemptRemainder = 0.0;
    let saveStatusTimeoutId = null;
    // musicShouldBePlaying flag

    // --- DOM Element Cache ---
    const domElements = {};

    // --- Helper Functions ---
    function formatNumber(num) { if (num === Infinity) return 'Infinity'; if (num === null || num === undefined || isNaN(num)) return '0'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if (absNum < 1e3) return sign + absNum.toFixed(0); const tiers = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd']; const tierIndex = Math.max(0, Math.min(tiers.length - 1, Math.floor(Math.log10(absNum) / 3))); const scaledNum = absNum / Math.pow(1000, tierIndex); let precision = 0; if (tierIndex > 0) { if (scaledNum < 10) precision = 2; else if (scaledNum < 100) precision = 1; else precision = 0; } const formattedNum = scaledNum.toFixed(precision); const finalNumString = (precision > 0 && parseFloat(formattedNum) === Math.floor(scaledNum)) ? Math.floor(scaledNum).toString() : formattedNum; return sign + finalNumString + tiers[tierIndex]; }
    function formatPerSecond(num, unit = "Units") { if (num !== 0 && Math.abs(num) < 10 && Math.abs(num) >= 0.01) return num.toFixed(2) + ` ${unit}/Sec`; else if (num !== 0 && Math.abs(num) < 0.01 && num !== 0) return num.toExponential(2) + ` ${unit}/Sec`; else return formatNumber(num) + ` ${unit}/Sec`; }
    function formatMoney(num) { if (num === null || num === undefined || isNaN(num)) return '0.00'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if (absNum < MONEY_FORMAT_THRESHOLD) { return sign + absNum.toFixed(2); } return sign + formatNumber(num); }
    function formatRateMoney(num) { if (num === 0 || num === null || num === undefined || isNaN(num)) return '0.000'; if (Math.abs(num) < 1e-3 && num !== 0) return num.toExponential(2); if (Math.abs(num) < 1) return num.toFixed(3); if (Math.abs(num) < 1000) return num.toFixed(2); return formatNumber(num); }
    function formatCAR(num) { return formatRateMoney(num); }
    function formatPercent(num, decimals = 1) { if (num === null || num === undefined || isNaN(num)) return '0.0%'; return (num * 100).toFixed(decimals) + '%'; }
    function formatTime(milliseconds) { if (milliseconds < 0 || isNaN(milliseconds)) return "0s"; const totalSeconds = Math.floor(milliseconds / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; let parts = []; if (days > 0) parts.push(`${days}d`); if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}m`); if (seconds >= 0 || parts.length === 0) parts.push(`${seconds}s`); return parts.join(' ') || '0s'; }

    // --- DOM Caching Function ---
    function cacheDOMElements() {
        console.log("Starting DOM Caching...");
        if (typeof domElements === 'undefined') {
            console.error("CRITICAL: domElements object is not defined before caching!");
            return;
        }
        const ids = [
            'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
            'leads-per-click', 'opps-per-click',
            'lead-click-base-p', 'opp-click-base-p',
            'car', 'success-chance', 'cvr', 'cust-cost',
            'click-lead-button', 'click-opp-button', 'save-status',
            'background-music', 'current-track-name', 'play-pause-button', 'play-pause-icon',
            'next-track-button', 'volume-slider',
            'sfx-purchase',
            'credits-modal', 'close-credits-button', 'credits-button',
            'win-modal', 'close-win-button',
            'stats-modal', 'close-stats-button', 'stats-button',
            'tutorial-modal', 'close-tutorial-button', 'tutorial-button',
            'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads',
            'stat-manual-opps', 'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts',
            'stat-acq-success', 'stat-acq-failed', 'stat-total-money',
            'save-button', 'delete-save-button', 'toggle-acquisition-button',
            'settings-button',
            'toggle-flexible-workflow' // Toggle button remains
            // Add upgrade-flexibleWorkflow later in the loop
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                domElements[id] = el;
            } else {
                if (!id.startsWith('toggle-') && !id.startsWith('upgrade-') && !id.startsWith('buy-')) {
                    console.warn(`DOM Element not found during cache: ${id}`);
                }
            }
        });
        for (const id in buildingsConfig) {
             const buyEl = document.getElementById(`buy-${id}`);
             const countEl = document.getElementById(`${id}-count`);
             const costEl = document.getElementById(`${id}-cost`);
             const effectEl = document.getElementById(`${id}-effect`);
             if (buyEl) domElements[`buy-${id}`] = buyEl;
             if (countEl) domElements[`${id}-count`] = countEl;
             if (costEl) domElements[`${id}-cost`] = costEl;
             if (effectEl) domElements[`${id}-effect`] = effectEl;
        }
        for (const id in upgradesConfig) { // This loop now includes flexibleWorkflow
            const upgradeEl = document.getElementById(`upgrade-${id}`);
            if (upgradeEl) { domElements[`upgrade-${id}`] = upgradeEl; }
             else {
                 // Don't warn for the toggle button, only the purchase button if it's missing
                 if (id === 'flexibleWorkflow') {
                    console.warn(`Purchase button 'upgrade-flexibleWorkflow' not found in HTML.`);
                 } else {
                     // console.warn(`DOM Element not found during cache: upgrade-${id}`); // Optional warning for others
                 }
             }
        }
        // Check toggle button again explicitly
        if (!domElements['toggle-flexible-workflow']) {
            console.warn(`Toggle button 'toggle-flexible-workflow' not found in HTML.`);
        }
        console.log("Finished DOM Caching. Found:", Object.keys(domElements).length, "elements.");
    }

    // --- Dynamic Cost Calculation ---
    function getUpgradeCost(id) {
        const config = upgradesConfig[id];
        if (!config) return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity };

        // Special handling for flexibleWorkflow mixed cost
        if (id === 'flexibleWorkflow') {
            return {
                money: config.costMoney || 0,
                customers: config.costCustomers || 0,
                leads: 0,
                opps: 0
            };
        }

        // Handle standard cost types
        if (config.costCurrency === 'both') {
            return { leads: config.costLeads || 0, opps: config.costOpps || 0, money: 0, customers: 0 };
        } else if (config.costCurrency === 'leads') {
            return { leads: config.cost || 0, opps: 0, money: 0, customers: 0 };
        } else if (config.costCurrency === 'opportunities') {
            return { leads: 0, opps: config.cost || 0, money: 0, customers: 0 };
        } else if (config.costCurrency === 'money') {
            return { money: config.cost || 0, leads: 0, opps: 0, customers: 0 };
        } else if (config.costCurrency === 'customers') {
            return { customers: config.cost || 0, leads: 0, opps: 0, money: 0 };
        }

        // Default case if currency type is unknown
        return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity };
    }
    function getBuildingCost(id) { const config = buildingsConfig[id]; const state = gameState.buildings[id]; if (!config || !state) return { leads: Infinity, opps: Infinity }; const count = state.count || 0; if (config.costCurrency === 'both') { return { leads: Math.ceil((config.baseCostLeads || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), opps: Math.ceil((config.baseCostOpps || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)) }; } else if (config.costCurrency === 'leads') { return { leads: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), opps: 0 }; } else if (config.costCurrency === 'opportunities') { return { leads: 0, opps: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)) }; } else if (config.costCurrency === 'money') { return { money: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), leads: 0, opps: 0 }; } return { leads: Infinity, opps: Infinity }; }
    function getCurrentCustomerCost() { const cost = Math.ceil( LEADS_PER_CUSTOMER_BASE * Math.pow(CUSTOMER_COST_MULTIPLIER, gameState.customerCountForCostIncrease || 0) * (gameState.customerCostReductionMultiplier || 1.0) ); return Math.max(1, cost); }

    // --- Core Calculation Function ---
    function calculateDerivedStats() {
        let newBaseLPS = 0;
        let newBaseOPS = 0;
        let baseCAR = 0.1;
        let baseCVR = 1.0;
        const globalEfficiency = gameState.buildingEfficiencyMultiplier || 1.0;
        const customerGlobalMultiplier = gameState.custGlobalMultiplier || 1.0;

        // 1. Calculate base production from buildings and standard upgrades
        for (const buildingId in buildingsConfig) {
            const config = buildingsConfig[buildingId];
            const count = gameState.buildings[buildingId]?.count || 0;
            if (count > 0) {
                let baseLPSInstance = config.baseLPS || 0; let baseOPSInstance = config.baseOPS || 0;
                let totalFlatBonusLPS = 0, totalFlatBonusOPS = 0;
                let percentMultiplierLPS = 1.0, percentMultiplierOPS = 1.0;
                let multiplierLPS = 1.0, multiplierOPS = 1.0;

                for (const upgradeId in upgradesConfig) {
                    const upConfig = upgradesConfig[upgradeId];
                    if (gameState.upgrades[upgradeId]?.purchased && upConfig.targetBuilding === buildingId) {
                        if (upConfig.flatBonusLPS) totalFlatBonusLPS += upConfig.flatBonusLPS;
                        if (upConfig.flatBonusOPS) totalFlatBonusOPS += upConfig.flatBonusOPS;
                        if (upConfig.percentBonusLPS) percentMultiplierLPS += upConfig.percentBonusLPS;
                        if (upConfig.percentBonusOPS) percentMultiplierOPS += upConfig.percentBonusOPS;
                        if (upConfig.multiplierBonusLPS) multiplierLPS *= upConfig.multiplierBonusLPS;
                        if (upConfig.multiplierBonusOPS) multiplierOPS *= upConfig.multiplierBonusOPS;
                    }
                }
                let finalLPSInstance = (baseLPSInstance + totalFlatBonusLPS) * percentMultiplierLPS * multiplierLPS;
                let finalOPSInstance = (baseOPSInstance + totalFlatBonusOPS) * percentMultiplierOPS * multiplierOPS;
                newBaseLPS += finalLPSInstance * count * globalEfficiency * customerGlobalMultiplier;
                newBaseOPS += finalOPSInstance * count * globalEfficiency * customerGlobalMultiplier;
            }
        }

        // 2. Apply Flexible Workflow *balancing effect* if the toggle is active
        //    (Note: The ability to toggle requires the upgrade to be purchased, checked elsewhere)
        if (gameState.flexibleWorkflowActive) {
            // Check for near-equality to deactivate the *effect*
            if (Math.abs(newBaseLPS - newBaseOPS) < FLEX_WORKFLOW_EQUALITY_THRESHOLD && (newBaseLPS > 0 || newBaseOPS > 0) ) { // Avoid deactivation at 0=0
                console.log("Flexible Workflow: LPS and OPS reached equilibrium. Deactivating effect.");
                gameState.flexibleWorkflowActive = false; // Turn off the active balancing effect
                updateFlexibleWorkflowButtonVisuals(); // Update toggle button state immediately
            } else if (newBaseLPS !== newBaseOPS) { // Only apply if rates are different
                // Apply the transfer effect
                const isLPSHigher = newBaseLPS > newBaseOPS;
                const higherRate = isLPSHigher ? newBaseLPS : newBaseOPS;
                const transferAmount = higherRate * 0.50; // 50% reduction/increase

                if (isLPSHigher) {
                    newBaseLPS -= transferAmount;
                    newBaseOPS += transferAmount;
                } else {
                    newBaseOPS -= transferAmount;
                    newBaseLPS += transferAmount;
                }
                 newBaseLPS = Math.max(0, newBaseLPS);
                 newBaseOPS = Math.max(0, newBaseOPS);
            }
        }

        // 3. Calculate base rates (CAR, CVR) from upgrades
        for (const id in upgradesConfig) {
            // Skip flexibleWorkflow here, it doesn't directly add to CAR/CVR
            if (id === 'flexibleWorkflow') continue;

            const config = upgradesConfig[id];
            if (gameState.upgrades[id]?.purchased) {
                if (config.targetRate === 'car') baseCAR += config.effectValue;
                if (config.targetRate === 'cvr') baseCVR += config.effectValue;
            }
        }

        // Apply customer-driven bonuses
        baseCAR += gameState.custUpgradeBonusCAR || 0;
        baseCVR += gameState.custUpgradeBonusCVR || 0;
        baseCVR *= (gameState.cvrMultiplierBonus || 1.0);

        // 4. Assign final calculated values
        leadsPerSecond = Math.max(0, newBaseLPS);
        opportunitiesPerSecond = Math.max(0, newBaseOPS);
        customerAcquisitionRate = Math.max(0, baseCAR);
        customerValueRate = Math.max(0, baseCVR);
        moneyPerSecond = (gameState.customers || 0) * customerValueRate;
    }

    // --- Display Update Functions ---
    function updateDisplay() {
        try {
            if(!domElements.leads || !domElements.opportunities || !domElements.customers || !domElements.money ||
               !domElements.lps || !domElements.ops || !domElements.mps || !domElements['leads-per-click'] ||
               !domElements['opps-per-click'] || !domElements.car || !domElements['success-chance'] ||
               !domElements.cvr || !domElements['cust-cost']) {
                console.error("One or more core display elements not found. Aborting updateDisplay.");
                return;
            }
            domElements.leads.textContent = formatNumber(gameState.leads);
            domElements.opportunities.textContent = formatNumber(gameState.opportunities);
            domElements.customers.textContent = formatNumber(gameState.customers);
            domElements.money.textContent = formatMoney(gameState.money);
            domElements.lps.textContent = formatPerSecond(leadsPerSecond, "Leads");
            domElements.ops.textContent = formatPerSecond(opportunitiesPerSecond, "Opps");
            domElements.mps.textContent = "$" + formatMoney(moneyPerSecond); // Use formatMoney for Money/Sec
            domElements['leads-per-click'].textContent = formatNumber(gameState.leadsPerClick);
            domElements['opps-per-click'].textContent = formatNumber(gameState.opportunitiesPerClick);

            if (domElements['lead-click-base-p']) {
                 const bonusLPSClick = leadsPerSecond * (gameState.leadClickPercentBonus || 0);
                 domElements['lead-click-base-p'].title = `Base Lead generation per click. Current Bonus: +${formatPercent(gameState.leadClickPercentBonus, 1)} of Leads/Sec per click (${formatPerSecond(bonusLPSClick,'Leads')}).`; // Corrected formatting
            }
            if (domElements['opp-click-base-p']) {
                 const bonusOPSClick = opportunitiesPerSecond * (gameState.oppClickPercentBonus || 0);
                 domElements['opp-click-base-p'].title = `Base Opportunity generation per click. Current Bonus: +${formatPercent(gameState.oppClickPercentBonus, 1)} of Opps/Sec per click (${formatPerSecond(bonusOPSClick,'Opps')}).`; // Corrected formatting
            }

            domElements.car.textContent = formatCAR(customerAcquisitionRate) + "/s";
            domElements['success-chance'].textContent = formatPercent(gameState.acquisitionSuccessChance);
            domElements.cvr.textContent = "$" + formatRateMoney(customerValueRate);
            domElements['cust-cost'].textContent = formatNumber(getCurrentCustomerCost()) + " Leads & Opps";
        } catch (error) {
            console.error("Error in updateDisplay:", error);
        }
    }

    function updateButtonStates() {
        try {
            // Buildings
            for (const buildingId in buildingsConfig) {
                const bldCfg = buildingsConfig[buildingId];
                const state = gameState.buildings[buildingId] || { count: 0 };
                const button = domElements[`buy-${buildingId}`];
                const countDisplay = domElements[`${buildingId}-count`];
                const costDisplay = domElements[`${buildingId}-cost`];
                const effectDisplay = domElements[`${buildingId}-effect`];

                if (button && countDisplay && costDisplay) {
                    const cost = getBuildingCost(buildingId);
                    const currency = bldCfg.costCurrency;
                    let canAfford = false;

                    if (currency === 'both') { canAfford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; costDisplay.textContent = `Cost: ${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
                    else if (currency === 'leads') { canAfford = gameState.leads >= cost.leads; costDisplay.textContent = `Cost: ${formatNumber(cost.leads)} Leads`; }
                    else if (currency === 'opportunities') { canAfford = gameState.opportunities >= cost.opps; costDisplay.textContent = `Cost: ${formatNumber(cost.opps)} Opps`; }
                    else if (currency === 'money') { canAfford = gameState.money >= cost.money; costDisplay.textContent = `Cost: $${formatMoney(cost.money)}`; }

                    button.disabled = !canAfford || isGamePaused || isGameWon; // Disable if paused or won
                    countDisplay.textContent = state.count;

                    if (effectDisplay) {
                        // Calculate *current* effect per instance
                        let baseLPSInstance = bldCfg.baseLPS || 0; let baseOPSInstance = bldCfg.baseOPS || 0;
                        let totalFlatBonusLPS = 0, totalFlatBonusOPS = 0;
                        let percentMultiplierLPS = 1.0, percentMultiplierOPS = 1.0;
                        let multiplierLPS = 1.0, multiplierOPS = 1.0;
                        const globalEfficiency = gameState.buildingEfficiencyMultiplier || 1.0;
                        const customerGlobalMultiplier = gameState.custGlobalMultiplier || 1.0;

                        for (const upgradeId in upgradesConfig) { const upConfig = upgradesConfig[upgradeId]; if (gameState.upgrades[upgradeId]?.purchased && upConfig.targetBuilding === buildingId) { if (upConfig.flatBonusLPS) totalFlatBonusLPS += upConfig.flatBonusLPS; if (upConfig.flatBonusOPS) totalFlatBonusOPS += upConfig.flatBonusOPS; if (upConfig.percentBonusLPS) percentMultiplierLPS += upConfig.percentBonusLPS; if (upConfig.percentBonusOPS) percentMultiplierOPS += upConfig.percentBonusOPS; if (upConfig.multiplierBonusLPS) multiplierLPS *= upConfig.multiplierBonusLPS; if (upConfig.multiplierBonusOPS) multiplierOPS *= upConfig.multiplierBonusOPS; } }
                        let finalLPSInstance = (baseLPSInstance + totalFlatBonusLPS) * percentMultiplierLPS * multiplierLPS * globalEfficiency * customerGlobalMultiplier;
                        let finalOPSInstance = (baseOPSInstance + totalFlatBonusOPS) * percentMultiplierOPS * multiplierOPS * globalEfficiency * customerGlobalMultiplier;
                        const parts = [];
                        // Use formatPerSecond for consistency
                        if (finalLPSInstance > 0) parts.push(`+${formatPerSecond(finalLPSInstance, "L").replace('/Sec','')}`); // Remove /Sec for brevity
                        if (finalOPSInstance > 0) parts.push(`+${formatPerSecond(finalOPSInstance, "O").replace('/Sec','')}`); // Remove /Sec for brevity
                        effectDisplay.textContent = parts.length > 0 ? parts.join(', ') : "No Effect";
                    }
                }
            }

            // Upgrades (including flexibleWorkflow purchase button)
            for (const id in upgradesConfig) {
                const upCfg = upgradesConfig[id];
                const state = gameState.upgrades[id] || { purchased: false };
                const el = domElements[`upgrade-${id}`]; // Assumes button ID is upgrade-ID

                if (el) {
                    const cost = getUpgradeCost(id); // Handles mixed cost for flexibleWorkflow
                    let afford = false;
                    let costText = 'Cost: ???';

                    // Check affordability based on cost type
                    if (id === 'flexibleWorkflow') {
                        afford = gameState.money >= cost.money && gameState.customers >= cost.customers;
                        costText = `Cost: ${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`;
                    } else if (upCfg.costCurrency === 'both') {
                        afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps;
                        costText = `Cost: ${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`;
                    } else if (upCfg.costCurrency === 'leads') {
                        afford = gameState.leads >= cost.leads;
                        costText = `Cost: ${formatNumber(cost.leads)} Leads`;
                    } else if (upCfg.costCurrency === 'opportunities') {
                        afford = gameState.opportunities >= cost.opps;
                        costText = `Cost: ${formatNumber(cost.opps)} Opps`;
                    } else if (upCfg.costCurrency === 'money') {
                        afford = gameState.money >= cost.money;
                        costText = `Cost: $${formatMoney(cost.money)}`;
                    } else if (upCfg.costCurrency === 'customers') {
                        afford = gameState.customers >= cost.customers;
                        costText = `Cost: ${formatNumber(cost.customers)} Customers`;
                    }

                    const purchased = state.purchased === true;
                    el.disabled = !afford || purchased || isGamePaused || isGameWon; // Disable if paused or won

                    const cstSpn = el.querySelector('.cost');
                    const effSpn = el.querySelector('.effect'); // May not exist for flexibleWorkflow

                    if (purchased) {
                        el.classList.add('purchased');
                        // Hide cost/effect spans if they exist
                        if (cstSpn) cstSpn.style.display = 'none';
                        if (effSpn) effSpn.style.display = 'none';
                    } else {
                        el.classList.remove('purchased');
                        if (cstSpn) {
                            cstSpn.style.display = 'block';
                            cstSpn.textContent = costText;
                        }
                        if (effSpn) { // Show effect only if it exists
                            effSpn.style.display = 'block';
                        }
                    }
                }
            }

            // Update other stateful buttons
            updateAcquisitionButtonVisuals();
            updateFlexibleWorkflowToggleButtonVisuals(); // Update the *toggle* button's state

        } catch (error) {
            console.error("Error in updateButtonStates:", error);
        }
    }

    function updateAcquisitionButtonVisuals() {
        const btn = domElements['toggle-acquisition-button'];
        if (!btn) return;
        if (gameState.isAcquisitionPaused) {
            btn.textContent = 'Resume Acquisition';
            btn.title = 'Resume customer acquisition (Lead/Opportunity consumption)';
            btn.classList.add('paused');
        } else {
            btn.textContent = 'Pause Acquisition';
            btn.title = 'Pause customer acquisition (Lead/Opportunity consumption)';
            btn.classList.remove('paused');
        }
         btn.disabled = isGameWon || isGamePaused; // Disable if paused or won
    }

    // Updated function name for clarity
    function updateFlexibleWorkflowToggleButtonVisuals() {
        const toggleBtn = domElements['toggle-flexible-workflow'];
        if (!toggleBtn) return;

        const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true;

        // Always disable if not purchased, or if game paused/won
        toggleBtn.disabled = !isPurchased || isGamePaused || isGameWon;

        if (gameState.flexibleWorkflowActive && isPurchased) { // Only show active state if purchased
            toggleBtn.textContent = 'Deactivate Flex Workflow';
            toggleBtn.title = 'Stop balancing Lead/Opportunity generation. Effect Active: Reducing higher /Sec by 50%, increasing lower /Sec.';
            toggleBtn.classList.add('active');
        } else {
            toggleBtn.textContent = 'Activate Flex Workflow';
             if (!isPurchased) {
                 toggleBtn.title = 'Purchase the Flexible Workflow upgrade first to enable toggling.';
             } else {
                toggleBtn.title = 'Balance Lead/Opportunity generation. Reduces higher /Sec by 50%, increases lower /Sec. Deactivates automatically when rates equalize.';
            }
            toggleBtn.classList.remove('active');
        }
    }

    // --- Sound Effect Helper ---
    function playSoundEffect(audioElement) { if (audioElement && audioElement.readyState >= 2) { audioElement.currentTime = 0; audioElement.play().catch(error => { console.log("SFX play interrupted or failed:", error.message); }); } }

    // --- Purchase Functions ---
    function buyBuilding(id) {
        if (isGamePaused || isGameWon) return;
        const config = buildingsConfig[id];
        const state = gameState.buildings[id];
        if (!config || !state) return;

        const cost = getBuildingCost(id);
        const currency = config.costCurrency;
        let canAfford = false;

        if (currency === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; canAfford = true; } }
        else if (currency === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; canAfford = true; } }
        else if (currency === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; canAfford = true; } }
        else if (currency === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; canAfford = true; } }

        if (canAfford) {
            state.count++;
            playSoundEffect(domElements['sfx-purchase']);
            calculateDerivedStats(); // Recalculate after purchase
            updateDisplay();
            updateButtonStates();
        }
    }

    function buyUpgrade(id) {
        if (isGamePaused || isGameWon) return;
        const config = upgradesConfig[id];
        const state = gameState.upgrades[id];
        if (!config || !state || state.purchased) return; // Already purchased

        const cost = getUpgradeCost(id); // Handles mixed cost for flexibleWorkflow
        let canAfford = false;

        // Check affordability based on cost type
        if (id === 'flexibleWorkflow') {
            if (gameState.money >= cost.money && gameState.customers >= cost.customers) {
                gameState.money -= cost.money;
                gameState.customers -= cost.customers;
                canAfford = true;
            }
        } else if (config.costCurrency === 'both') {
            if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) {
                gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; canAfford = true;
            }
        } else if (config.costCurrency === 'leads') {
            if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; canAfford = true; }
        } else if (config.costCurrency === 'opportunities') {
            if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; canAfford = true; }
        } else if (config.costCurrency === 'money') {
            if (gameState.money >= cost.money) { gameState.money -= cost.money; canAfford = true; }
        } else if (config.costCurrency === 'customers') {
            if (gameState.customers >= cost.customers) { gameState.customers -= cost.customers; canAfford = true; }
        }

        // Process purchase if affordable
        if (canAfford) {
            state.purchased = true;
            playSoundEffect(domElements['sfx-purchase']);

            // Apply instant effects if any (flexibleWorkflow has no instant effect function)
            if (typeof config.effect === 'function') {
                config.effect(gameState);
            }

            // Recalculate, update display and buttons immediately
            calculateDerivedStats();
            updateDisplay();
            updateButtonStates(); // This will correctly update the purchased button and the toggle button state
        }
    }

    // --- Music Player Logic ---
    function loadTrack(index, playWhenReady = false) { const music = domElements['background-music']; const trackNameEl = domElements['current-track-name']; if (!music || !trackNameEl || playlist.length === 0) return; currentTrackIndex = (index + playlist.length) % playlist.length; const track = playlist[currentTrackIndex]; if (!track) return; console.log(`Loading track ${currentTrackIndex}: ${track.name}`); musicShouldBePlaying = playWhenReady; let sourceMP3 = music.querySelector('source[type="audio/mpeg"]'); if (!sourceMP3) { sourceMP3 = document.createElement('source'); sourceMP3.type = 'audio/mpeg'; music.appendChild(sourceMP3); } sourceMP3.src = `resources/audio/${track.filename}`; trackNameEl.textContent = track.name; music.load(); music.removeEventListener('canplay', handleCanPlay); music.addEventListener('canplay', handleCanPlay, { once: true }); updatePlayPauseIcon(); }
    function handleCanPlay() { const music = domElements['background-music']; console.log(`Track ${currentTrackIndex} can play. Should play: ${musicShouldBePlaying}`); if (musicShouldBePlaying) { playCurrentTrack(); } else { updatePlayPauseIcon(); } }
    function playCurrentTrack() { const music = domElements['background-music']; if (!music || !music.currentSrc) { console.warn("Attempted to play but no source loaded."); musicShouldBePlaying = false; updatePlayPauseIcon(); return; } const playPromise = music.play(); if (playPromise !== undefined) { playPromise.then(() => { console.log("Playback started."); musicShouldBePlaying = true; updatePlayPauseIcon(); }).catch(error => { if (error.name !== 'NotAllowedError') { console.warn("Playback failed:", error); } else { console.log("Autoplay prevented by browser."); } musicShouldBePlaying = false; updatePlayPauseIcon(); }); } else { musicShouldBePlaying = !music.paused; updatePlayPauseIcon(); } }
    function pauseCurrentTrack() { const music = domElements['background-music']; if (music) { music.pause(); musicShouldBePlaying = false; console.log("Playback paused."); updatePlayPauseIcon(); } }
    function updatePlayPauseIcon() { const playPauseIconEl = domElements['play-pause-icon']; const playPauseButtonEl = domElements['play-pause-button']; if (!playPauseIconEl || !playPauseButtonEl) return; if (musicShouldBePlaying) { playPauseIconEl.innerHTML = '❚❚'; playPauseButtonEl.title = "Pause Music"; } else { playPauseIconEl.innerHTML = '►'; playPauseButtonEl.title = "Play Music"; } }
    function playNextTrack() { const music = domElements['background-music']; if (!music) return; const shouldResume = musicShouldBePlaying; loadTrack(currentTrackIndex + 1, shouldResume); }
    function togglePlayPause() { const music = domElements['background-music']; if (!music) return; if (music.paused) { if (!music.currentSrc || music.currentSrc === '' || music.currentSrc === window.location.href) { loadTrack(0, true); } else { playCurrentTrack(); } } else { pauseCurrentTrack(); } }
    function setVolume(value = null) { const music = domElements['background-music']; const slider = domElements['volume-slider']; if (music && slider) { let newVol; if (value !== null && !isNaN(value) && value >= 0 && value <= 1) { slider.value = value; newVol = value; } else { newVol = parseFloat(slider.value); } music.volume = newVol; if(domElements['sfx-purchase']) domElements['sfx-purchase'].volume = Math.min(1, newVol * 1.5); } }

    // --- Modal Logic ---
    function showModal(modalElement) { if (modalElement) modalElement.classList.add('show'); }
    function hideModal(modalElement) { if (modalElement) modalElement.classList.remove('show'); }
    function showCredits() { showModal(domElements['credits-modal']); } function hideCredits() { hideModal(domElements['credits-modal']); }
    function showStats() { const statsModal = domElements['stats-modal']; if (!statsModal) return; updateStatsDisplay(); showModal(statsModal); if (statsUpdateIntervalId) clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = setInterval(updateStatsDisplay, STATS_UPDATE_INTERVAL_MS); }
    function hideStats() { const statsModal = domElements['stats-modal']; if (!statsModal) return; hideModal(statsModal); if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; } }
    function triggerWin() { if (isGameWon) return; console.log("WIN CONDITION MET!"); isGameWon = true; isGamePaused = true; updateButtonStates(); updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); saveGame(); showModal(domElements['win-modal']); }
    function closeWinScreen() { hideModal(domElements['win-modal']); isGamePaused = false; updateButtonStates(); updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); }
    function showTutorial() { showModal(domElements['tutorial-modal']); } function hideTutorial() { hideModal(domElements['tutorial-modal']); }

    // --- Stats Modal Update ---
    function updateStatsDisplay() { const modal = domElements['stats-modal']; if (!modal || !modal.classList.contains('show')) { if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; } return; } try { domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now())); domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks); domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks); domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads); domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps); domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads); domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps); domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts); domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions); domElements['stat-acq-failed'].textContent = formatNumber(gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions); domElements['stat-total-money'].textContent = formatMoney(gameState.totalMoneyEarned); } catch (error) { console.error("Error updating stats display:", error); hideStats(); } }

    // --- Acquisition Pause Logic ---
    function toggleAcquisitionPause() {
        if (isGameWon || isGamePaused) return; // Prevent toggle if paused or won
        gameState.isAcquisitionPaused = !gameState.isAcquisitionPaused;
        console.log(`Customer Acquisition ${gameState.isAcquisitionPaused ? 'Paused' : 'Resumed'}`);
        updateAcquisitionButtonVisuals();
    }

    // --- Flexible Workflow Toggle Logic ---
    function toggleFlexibleWorkflow() {
        // Prevent toggle if paused, won, OR if the upgrade hasn't been purchased yet
        if (isGamePaused || isGameWon || !gameState.upgrades['flexibleWorkflow']?.purchased) {
             console.log("Cannot toggle Flexible Workflow. Paused, Won, or Upgrade not purchased.");
             return;
         }

        gameState.flexibleWorkflowActive = !gameState.flexibleWorkflowActive;
        console.log(`Flexible Workflow Effect ${gameState.flexibleWorkflowActive ? 'Activated' : 'Deactivated'}`);

        // Immediately recalculate and update display/buttons
        calculateDerivedStats();
        updateDisplay();
        updateButtonStates(); // This calls updateFlexibleWorkflowToggleButtonVisuals
    }


    // --- Save/Load Functions ---
    function displaySaveStatus(message, duration = 3000) { const statusEl = domElements['save-status']; if (!statusEl) return; if (saveStatusTimeoutId) clearTimeout(saveStatusTimeoutId); statusEl.textContent = message; statusEl.classList.add('visible'); saveStatusTimeoutId = setTimeout(() => { statusEl.classList.remove('visible'); }, duration); }

    function getDefaultGameState() {
        const defaultState = {
            leads: 0, opportunities: 0, customers: 0, money: 0,
            leadsPerClick: 1, opportunitiesPerClick: 1,
            leadClickPercentBonus: 0, oppClickPercentBonus: 0,
            buildingEfficiencyMultiplier: 1.0,
            customerCostReductionMultiplier: 1.0,
            acquisitionSuccessChance: 0.25,
            cvrMultiplierBonus: 1.0, custGlobalMultiplier: 1.0,
            customerCountForCostIncrease: 0,
            isAcquisitionPaused: false,
            flexibleWorkflowActive: false, // Tracks if the *effect* is toggled on
            // flexibleWorkflowUnlocked is now implicitly tracked by upgrades['flexibleWorkflow'].purchased
            gameStartTime: Date.now(),
            totalLeadClicks: 0, totalOppClicks: 0,
            totalManualLeads: 0, totalManualOpps: 0,
            totalAutoLeads: 0, totalAutoOpps: 0,
            totalAcquisitionAttempts: 0, totalSuccessfulAcquisitions: 0,
            totalMoneyEarned: 0,
            custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0,
            buildings: {}, upgrades: {}
        };
        initializeStructureState(defaultState, true);
        return defaultState;
    }

    function initializeStructureState(state, isInitialSetup = false) {
        if (!state.buildings) state.buildings = {};
        if (!state.upgrades) state.upgrades = {};

        // Ensure all buildings from config exist
        for (const id in buildingsConfig) {
            if (!state.buildings[id]) { state.buildings[id] = { count: 0 }; }
            else { state.buildings[id].count = Math.max(0, Math.floor(state.buildings[id].count || 0)); }
        }
        // Ensure all upgrades from config exist (including flexibleWorkflow)
        for (const id in upgradesConfig) {
            if (!state.upgrades[id]) { state.upgrades[id] = { purchased: false }; }
            else { state.upgrades[id].purchased = state.upgrades[id].purchased === true; }
        }

        // Remove obsolete state ONLY if not initial setup
        if (!isInitialSetup) {
            for (const id in state.buildings) { if (!buildingsConfig[id]) { console.log(`Removing obsolete building: ${id}`); delete state.buildings[id]; } }
            for (const id in state.upgrades) { if (!upgradesConfig[id]) { console.log(`Removing obsolete upgrade: ${id}`); delete state.upgrades[id]; } }
        }

        // Sanitize core state properties
        state.leads = Number(state.leads) || 0;
        state.opportunities = Number(state.opportunities) || 0;
        state.customers = Math.max(0, Math.floor(Number(state.customers) || 0));
        state.money = Number(state.money) || 0;
        state.leadsPerClick = Number(state.leadsPerClick) || 1;
        state.opportunitiesPerClick = Number(state.opportunitiesPerClick) || 1;
        state.leadClickPercentBonus = Number(state.leadClickPercentBonus) || 0;
        state.oppClickPercentBonus = Number(state.oppClickPercentBonus) || 0;
        state.buildingEfficiencyMultiplier = Number(state.buildingEfficiencyMultiplier) || 1.0;
        state.customerCostReductionMultiplier = Number(state.customerCostReductionMultiplier) || 1.0;
        state.acquisitionSuccessChance = Math.max(0, Math.min(1.0, Number(state.acquisitionSuccessChance) || 0.25));
        state.cvrMultiplierBonus = Number(state.cvrMultiplierBonus) || 1.0;
        state.custGlobalMultiplier = Number(state.custGlobalMultiplier) || 1.0;
        state.customerCountForCostIncrease = Math.max(0, Math.floor(Number(state.customerCountForCostIncrease) || 0));
        state.isAcquisitionPaused = state.isAcquisitionPaused === true;
        state.flexibleWorkflowActive = state.flexibleWorkflowActive === true; // Sanitize toggle state
        // Removed flexibleWorkflowUnlocked - derived from purchased state now
        state.gameStartTime = Number(state.gameStartTime) || Date.now();
        state.totalLeadClicks = Number(state.totalLeadClicks) || 0;
        state.totalOppClicks = Number(state.totalOppClicks) || 0;
        state.totalManualLeads = Number(state.totalManualLeads) || 0;
        state.totalManualOpps = Number(state.totalManualOpps) || 0;
        state.totalAutoLeads = Number(state.totalAutoLeads) || 0;
        state.totalAutoOpps = Number(state.totalAutoOpps) || 0;
        state.totalAcquisitionAttempts = Number(state.totalAcquisitionAttempts) || 0;
        state.totalSuccessfulAcquisitions = Number(state.totalSuccessfulAcquisitions) || 0;
        state.totalMoneyEarned = Number(state.totalMoneyEarned) || 0;
        state.custUpgradeBonusCAR = Number(state.custUpgradeBonusCAR) || 0;
        state.custUpgradeBonusCVR = Number(state.custUpgradeBonusCVR) || 0;
    }

    function saveGame() {
        if (isGamePaused && !isGameWon) return;
        try {
            const stateToSave = JSON.parse(JSON.stringify(gameState));
            localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
            displaySaveStatus(`Saved: ${new Date().toLocaleTimeString()}`);
        } catch (error) { console.error("Error saving game:", error); displaySaveStatus("Error saving!", 5000); }
    }

    function loadGame() {
        const savedJson = localStorage.getItem(SAVE_KEY);
        let loadedSuccessfully = false;
        gameState = getDefaultGameState(); // Start with fresh default structure

        if (savedJson) {
            try {
                const loadedData = JSON.parse(savedJson);
                // Merge loaded data onto the default state
                for (const key in gameState) {
                    if (loadedData.hasOwnProperty(key)) {
                         if ((key === 'buildings' || key === 'upgrades') && typeof loadedData[key] === 'object' && loadedData[key] !== null) {
                             for (const id in loadedData[key]) {
                                 if ((key === 'buildings' && buildingsConfig[id]) || (key === 'upgrades' && upgradesConfig[id])) {
                                     if (!gameState[key][id]) gameState[key][id] = {};
                                     gameState[key][id] = { ...gameState[key][id], ...loadedData[key][id] }; // Merge sub-object
                                 } else { console.log(`Ignoring loaded data for obsolete ${key.slice(0, -1)}: ${id}`); }
                             }
                         } else if (typeof gameState[key] !== 'object' || gameState[key] === null) {
                            gameState[key] = loadedData[key]; // Overwrite simple types
                        }
                    }
                }
                initializeStructureState(gameState, false); // Sanitize the merged state
                if (typeof gameState.gameStartTime !== 'number' || isNaN(gameState.gameStartTime) || gameState.gameStartTime <= 0) { gameState.gameStartTime = Date.now(); }
                console.log("Game Loaded Successfully.");
                displaySaveStatus("Save loaded.");
                loadedSuccessfully = true;
            } catch (error) {
                console.error("Error loading saved game:", error);
                displaySaveStatus("Load error! Resetting game.", 5000);
                localStorage.removeItem(SAVE_KEY);
                gameState = getDefaultGameState(); // Full reset
                loadedSuccessfully = false;
            }
        } else {
            console.log("No save file found, starting new game.");
            // No need to set loadedSuccessfully = false, new game is technically loaded
        }
        calculateDerivedStats(); // Calculate stats after load/reset
        return loadedSuccessfully; // Indicates if a *saved* game was loaded
    }

    function deleteSave() {
        if (confirm("Are you sure you want to delete your save data? This cannot be undone.")) {
            localStorage.removeItem(SAVE_KEY);
            displaySaveStatus("Save deleted. Reloading...", 5000);
            if (gameLoopIntervalId) clearInterval(gameLoopIntervalId);
            if (autoSaveIntervalId) clearInterval(autoSaveIntervalId);
            if (statsUpdateIntervalId) clearInterval(statsUpdateIntervalId);
            setTimeout(() => location.reload(), 1500);
        }
    }

    // --- Event Listener Setup ---
    function setupEventListeners() {
        console.log("--- Attaching Event Listeners ---");

        // Clickers
        domElements['click-lead-button']?.addEventListener('click', () => { if (isGamePaused || isGameWon) return; const bonus = leadsPerSecond * (gameState.leadClickPercentBonus || 0); const total = gameState.leadsPerClick + bonus; gameState.leads += total; gameState.totalLeadClicks++; gameState.totalManualLeads += total; updateDisplay(); updateButtonStates(); });
        domElements['click-opp-button']?.addEventListener('click', () => { if (isGamePaused || isGameWon) return; const bonus = opportunitiesPerSecond * (gameState.oppClickPercentBonus || 0); const total = gameState.opportunitiesPerClick + bonus; gameState.opportunities += total; gameState.totalOppClicks++; gameState.totalManualOpps += total; updateDisplay(); updateButtonStates(); });

        // Buildings
        for (const id in buildingsConfig) { domElements[`buy-${id}`]?.addEventListener('click', () => buyBuilding(id)); }
        // Upgrades (includes flexibleWorkflow purchase button)
        for (const id in upgradesConfig) { domElements[`upgrade-${id}`]?.addEventListener('click', () => buyUpgrade(id)); }

        // Music
        domElements['play-pause-button']?.addEventListener('click', togglePlayPause);
        domElements['volume-slider']?.addEventListener('input', () => setVolume());
        domElements['next-track-button']?.addEventListener('click', playNextTrack);
        domElements['background-music']?.addEventListener('ended', playNextTrack);

        // Modals
        domElements['credits-button']?.addEventListener('click', showCredits);
        domElements['close-credits-button']?.addEventListener('click', hideCredits);
        domElements['credits-modal']?.addEventListener('click', (e) => { if (e.target === domElements['credits-modal']) hideCredits(); });
        domElements['stats-button']?.addEventListener('click', showStats);
        domElements['close-stats-button']?.addEventListener('click', hideStats);
        domElements['stats-modal']?.addEventListener('click', (e) => { if (e.target === domElements['stats-modal']) hideStats(); });
        domElements['tutorial-button']?.addEventListener('click', showTutorial);
        domElements['close-tutorial-button']?.addEventListener('click', hideTutorial);
        domElements['tutorial-modal']?.addEventListener('click', (e) => { if (e.target === domElements['tutorial-modal']) hideTutorial(); });
        domElements['close-win-button']?.addEventListener('click', closeWinScreen);

        // Top Bar Controls
        domElements['save-button']?.addEventListener('click', saveGame);
        domElements['delete-save-button']?.addEventListener('click', deleteSave);
        domElements['toggle-acquisition-button']?.addEventListener('click', toggleAcquisitionPause);
        domElements['settings-button']?.addEventListener('click', () => { alert('Settings panel not implemented yet.'); });

        // Special Upgrade Toggle Button
        domElements['toggle-flexible-workflow']?.addEventListener('click', toggleFlexibleWorkflow);

        console.log("--- Finished Attaching Event Listeners ---");
    }

    // --- Game Loop ---
    function gameLoop() {
        if (isGamePaused) return;
        const intervalSeconds = TICK_INTERVAL_MS / 1000.0;

        // 1. Passive Generation (rates already calculated, potentially adjusted by Flex Workflow)
        const leadsThisTick = leadsPerSecond * intervalSeconds;
        const oppsThisTick = opportunitiesPerSecond * intervalSeconds;
        gameState.leads += leadsThisTick;
        gameState.opportunities += oppsThisTick;
        gameState.totalAutoLeads += leadsThisTick;
        gameState.totalAutoOpps += oppsThisTick;

        // 2. Customer Acquisition
        if (!gameState.isAcquisitionPaused) {
            const currentCost = getCurrentCustomerCost();
            let attemptsPossible = (customerAcquisitionRate * intervalSeconds) + acquisitionAttemptRemainder;
            let attemptsToMake = Math.floor(attemptsPossible);
            acquisitionAttemptRemainder = attemptsPossible - attemptsToMake;

            if (attemptsToMake > 0) {
                for (let i = 0; i < attemptsToMake; i++) {
                    if (gameState.leads >= currentCost && gameState.opportunities >= currentCost) {
                        gameState.totalAcquisitionAttempts++;
                        gameState.leads -= currentCost;
                        gameState.opportunities -= currentCost;
                        if (Math.random() < gameState.acquisitionSuccessChance) {
                            gameState.totalSuccessfulAcquisitions++;
                            gameState.customerCountForCostIncrease++;
                            gameState.customers++;
                        }
                    } else {
                         acquisitionAttemptRemainder += (attemptsToMake - i); // Add back unpaid attempts fraction
                         break; // Stop trying this tick
                    }
                }
                if (gameState.leads < 0) gameState.leads = 0;
                if (gameState.opportunities < 0) gameState.opportunities = 0;
            }
        }

        // 3. Money Generation
        const moneyThisTick = gameState.customers * customerValueRate * intervalSeconds;
        gameState.money += moneyThisTick;
        gameState.totalMoneyEarned += moneyThisTick;

        // 4. Recalculate derived stats (needed for Flex Workflow self-deactivation check)
        calculateDerivedStats();

        // 5. Update display and buttons
        updateDisplay();
        updateButtonStates();

        // 6. Check Win Condition
        if (!isGameWon && gameState.money >= WIN_AMOUNT) {
            triggerWin();
        }
    }

    // --- Interval Management ---
    function startGameLoop() { if (gameLoopIntervalId) clearInterval(gameLoopIntervalId); gameLoopIntervalId = setInterval(gameLoop, TICK_INTERVAL_MS); console.log("Game loop started."); }
    function startAutoSave() { if (autoSaveIntervalId) clearInterval(autoSaveIntervalId); autoSaveIntervalId = setInterval(saveGame, AUTO_SAVE_INTERVAL_MS); console.log("Auto-save started."); }

    // --- Initialization ---
    function initializeGame() {
        console.log("--- Initializing Game ---");
        try { cacheDOMElements(); }
        catch (error) { console.error("CRITICAL Error during DOM caching:", error); alert("Fatal Error initializing UI. Check console."); return; }

        loadGame(); // Load or set defaults

        // Initial UI state based on loaded/default data
        updateDisplay();
        updateButtonStates(); // Sets initial state for *all* buttons

        setupEventListeners();

        // Music Init
        if (domElements['background-music'] && domElements['volume-slider']) { setVolume(0.1); loadTrack(0, true); }
        else { console.warn("Music player elements not found."); }

        startGameLoop();
        startAutoSave();

        // Handle loading a game already won
        if (!isGameWon && gameState.money >= WIN_AMOUNT) {
            console.log("Game loaded in a won state.");
            isGameWon = true; // Set internal flag
            isGamePaused = true; // Pause gameplay
            updateButtonStates(); // Update UI to reflect won/paused state
            updateAcquisitionButtonVisuals();
            updateFlexibleWorkflowToggleButtonVisuals();
            showModal(domElements['win-modal']); // Show win screen
        }

        console.log("--- Game Initialized and Running ---");
    }

    // --- Start the Game ---
    initializeGame();

}); // End DOMContentLoaded listener