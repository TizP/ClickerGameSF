// Ensure strict mode and better error handling
"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const SAVE_KEY = 'salesforcePipelineSaveData_v1.10'; // Keep same version unless structure changes
    const TICK_INTERVAL_MS = 100;
    const AUTO_SAVE_INTERVAL_MS = 30000;
    const STATS_UPDATE_INTERVAL_MS = 1000;
    const WIN_AMOUNT = 1_000_000_000;
    const BUILDING_COST_MULTIPLIER = 1.15;
    const LEADS_PER_CUSTOMER_BASE = 100;
    const CUSTOMER_COST_MULTIPLIER = 1.015;
    const MONEY_FORMAT_THRESHOLD = 10000;

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
        leadClick1: { cost: 15,   costCurrency: 'leads',         effect: (state) => { state.leadsPerClick += 1; } },
        oppClick1:  { cost: 15,   costCurrency: 'opportunities', effect: (state) => { state.opportunitiesPerClick += 1; } },
        leadClick2: { cost: 200,  costCurrency: 'leads',         effect: (state) => { state.leadsPerClick += 5; } },
        oppClick2:  { cost: 200,  costCurrency: 'opportunities', effect: (state) => { state.opportunitiesPerClick += 5; } },
        leadClick3: { cost: 2500, costCurrency: 'leads',         effect: (state) => { state.leadsPerClick += 25; } },
        oppClick3:  { cost: 2500, costCurrency: 'opportunities', effect: (state) => { state.opportunitiesPerClick += 25; } },
        leadClickPercent1: { cost: 1000, costCurrency: 'leads', effect: (state) => { state.leadClickPercentBonus += 0.01; } },
        oppClickPercent1: { cost: 1000, costCurrency: 'opportunities', effect: (state) => { state.oppClickPercentBonus += 0.01; } },
        leadClickPercent2: { cost: 50000, costCurrency: 'leads', effect: (state) => { state.leadClickPercentBonus += 0.05; } },
        oppClickPercent2: { cost: 50000, costCurrency: 'opportunities', effect: (state) => { state.oppClickPercentBonus += 0.05; } },
        sdrBoostFlat1:      { cost: 250,    costCurrency: 'leads', targetBuilding: 'sdr',     flatBonusLPS: 2 },
        webformBoostFlat2:  { cost: 5000,   costCurrency: 'leads', targetBuilding: 'webform', flatBonusLPS: 20 },
        pardotBoostFlat3:   { cost: 60000,  costCurrency: 'leads', targetBuilding: 'pardot',  flatBonusLPS: 100 },
        nurtureBoostPercent:{ cost: 300000, costCurrency: 'leads', targetBuilding: 'nurture', percentBonusLPS: 0.05 },
        mktCloudBoostMult:  { cost: 1000000,costCurrency: 'leads', targetBuilding: 'marketingcloud', multiplierBonusLPS: 2 },
        bdrBoostFlat1:      { cost: 250,    costCurrency: 'opportunities', targetBuilding: 'bdr',     flatBonusOPS: 2 },
        qualbotBoostFlat2:  { cost: 5000,   costCurrency: 'opportunities', targetBuilding: 'qualbot', flatBonusOPS: 20 },
        solEngBoostFlat3:   { cost: 60000,  costCurrency: 'opportunities', targetBuilding: 'solutionengineer', flatBonusOPS: 100 },
        demospecBoostPercent:{ cost: 300000, costCurrency: 'opportunities', targetBuilding: 'demospec', percentBonusOPS: 0.05 },
        propDeskBoostMult:  { cost: 1000000,costCurrency: 'opportunities', targetBuilding: 'proposaldesk', multiplierBonusOPS: 2 },
        integrationBoostFlat1: { cost: 100000,   costCurrency: 'leads', targetBuilding: 'integration', flatBonusLPS: 5, flatBonusOPS: 5 },
        platformBoostFlat2:    { cost: 500000,   costCurrency: 'opportunities', targetBuilding: 'platform', flatBonusLPS: 50, flatBonusOPS: 50 },
        ecosystemBoostFlat3:   { cost: 3000000,  costCurrency: 'leads', targetBuilding: 'ecosystem', flatBonusLPS: 250, flatBonusOPS: 250 },
        cloudsuiteBoostPercent:{ cost: 15000000, costCurrency: 'opportunities', targetBuilding: 'cloudsuite', percentBonusLPS: 0.05, percentBonusOPS: 0.05 },
        hyperscalerBoostMult:  { cost: 75000000, costCurrency: 'leads', targetBuilding: 'hyperscaler', multiplierBonusLPS: 2, multiplierBonusOPS: 2 },
        efficiency1:{ cost: 1000,   costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.10; } },
        efficiency2:{ cost: 10000,  costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.15; } },
        efficiency3:{ cost: 100000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.20; } },
        car1:       { cost: 15000,  costCurrency: 'opportunities', effectValue: 0.20, targetRate: 'car' },
        car2:       { cost: 100000, costCurrency: 'opportunities', effectValue: 0.50, targetRate: 'car' },
        car3:       { cost: 500000, costCurrency: 'opportunities', effectValue: 1.00, targetRate: 'car' },
        success1:   { cost: 1500,   costCurrency: 'opportunities', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); } },
        success2:   { cost: 10000,  costCurrency: 'opportunities', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.07); } },
        success3:   { cost: 50000,  costCurrency: 'opportunities', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); } },
        costReduct1:{ cost: 5000,   costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.95; } },
        costReduct2:{ cost: 30000,  costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.93; } },
        costReduct3:{ cost: 200000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.90; } },
        cvr1:       { cost: 25000,  costCurrency: 'leads', effectValue: 0.10, targetRate: 'cvr' },
        cvr2:       { cost: 300000, costCurrency: 'leads', effectValue: 0.50, targetRate: 'cvr' },
        cvr3:       { cost: 2000000,costCurrency: 'leads', effectValue: 1.50, targetRate: 'cvr' },
        cvr4:       { cost: 10000000,costCurrency: 'leads', effectValue: 5.00, targetRate: 'cvr' },
        custUpgradeCar1: { cost: 10, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.50; } },
        custUpgradeMix1: { cost: 50, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.70; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.08); } },
        custUpgradeMix2: { cost: 250, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 1.00; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 2.80; } },
        custUpgradeMix3: { cost: 1000, costCurrency: 'customers', effect: (state) => { state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 10.00; } },
        custUpgradeCar2: { cost: 5000, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 1.00; } },
     };

    // --- Game State ---
    let gameState = {};

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
    function formatNumber(num) { /* ... same ... */ if (num === Infinity) return 'Infinity'; if (num === null || num === undefined || isNaN(num)) return '0'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if (absNum < 1e3) return sign + absNum.toFixed(0); const tiers = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd']; const tierIndex = Math.max(0, Math.min(tiers.length - 1, Math.floor(Math.log10(absNum) / 3))); const scaledNum = absNum / Math.pow(1000, tierIndex); let precision = 0; if (tierIndex > 0) { if (scaledNum < 10) precision = 2; else if (scaledNum < 100) precision = 1; else precision = 0; } const formattedNum = scaledNum.toFixed(precision); const finalNumString = (precision > 0 && parseFloat(formattedNum) === Math.floor(scaledNum)) ? Math.floor(scaledNum).toString() : formattedNum; return sign + finalNumString + tiers[tierIndex]; }
    function formatPerSecond(num, unit = "Units") { if (num !== 0 && Math.abs(num) < 10 && Math.abs(num) >= 0.01) return num.toFixed(2) + ` ${unit}/Sec`; else if (num !== 0 && Math.abs(num) < 0.01) return num.toFixed(3) + ` ${unit}/Sec`; else return formatNumber(num) + ` ${unit}/Sec`; }
    function formatMoney(num) { /* ... same ... */ if (num === null || num === undefined || isNaN(num)) return '0.00'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if (absNum < MONEY_FORMAT_THRESHOLD) { return sign + absNum.toFixed(2); } return sign + formatNumber(num); }
    function formatRateMoney(num) { /* ... same ... */ if (num === 0 || num === null || num === undefined || isNaN(num)) return '0.000'; if (Math.abs(num) < 1e-3 && num !== 0) return num.toExponential(2); if (Math.abs(num) < 1) return num.toFixed(3); if (Math.abs(num) < 1000) return num.toFixed(2); return formatNumber(num); }
    function formatCAR(num) { return formatRateMoney(num); }
    function formatPercent(num, decimals = 1) { /* ... same ... */ if (num === null || num === undefined || isNaN(num)) return '0.0%'; return (num * 100).toFixed(decimals) + '%'; }
    function formatTime(milliseconds) { /* ... same ... */ if (milliseconds < 0 || isNaN(milliseconds)) return "0s"; const totalSeconds = Math.floor(milliseconds / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; let parts = []; if (days > 0) parts.push(`${days}d`); if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}m`); if (seconds >= 0 || parts.length === 0) parts.push(`${seconds}s`); return parts.join(' ') || '0s'; }

    // --- DOM Caching Function ---
    function cacheDOMElements() { /* ... same ... */ if (typeof domElements === 'undefined') { console.error("CRITICAL: domElements object is not defined before caching!"); return; } const ids = [ 'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps', 'leads-per-click', 'opps-per-click', 'lead-click-base-p', 'opp-click-base-p', 'car', 'success-chance', 'cvr', 'cust-cost', 'click-lead-button', 'click-opp-button', 'save-status', 'background-music', 'current-track-name', 'play-pause-button', 'play-pause-icon', 'next-track-button', 'volume-slider', 'sfx-purchase', 'credits-modal', 'close-credits-button', 'credits-button', 'win-modal', 'close-win-button', 'stats-modal', 'close-stats-button', 'stats-button', 'tutorial-modal', 'close-tutorial-button', 'tutorial-button', 'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps', 'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed', 'stat-total-money', 'save-button', 'delete-save-button', 'toggle-acquisition-button', 'settings-button']; ids.forEach(id => { const el = document.getElementById(id); if (el) { domElements[id] = el; } else { console.warn(`DOM Element not found during cache: ${id}`); } }); for (const id in buildingsConfig) { const buyEl = document.getElementById(`buy-${id}`); const countEl = document.getElementById(`${id}-count`); const costEl = document.getElementById(`${id}-cost`); const effectEl = document.getElementById(`${id}-effect`); if (buyEl) domElements[`buy-${id}`] = buyEl; else console.warn(`DOM Element not found during cache: buy-${id}`); if (countEl) domElements[`${id}-count`] = countEl; else console.warn(`DOM Element not found during cache: ${id}-count`); if (costEl) domElements[`${id}-cost`] = costEl; else console.warn(`DOM Element not found during cache: ${id}-cost`); if (effectEl) domElements[`${id}-effect`] = effectEl; else console.warn(`DOM Element not found during cache: ${id}-effect`); } for (const id in upgradesConfig) { const upgradeEl = document.getElementById(`upgrade-${id}`); if (upgradeEl) { domElements[`upgrade-${id}`] = upgradeEl; } else { console.warn(`DOM Element not found during cache: upgrade-${id}`); } } console.log("DOM elements cached."); }

    // --- Dynamic Cost Calculation ---
    function getBuildingCost(id) { /* ... same ... */ const config = buildingsConfig[id]; const state = gameState.buildings[id]; if (!config || !state) return { leads: Infinity, opps: Infinity }; const count = state.count || 0; if (config.costCurrency === 'both') { return { leads: Math.ceil((config.baseCostLeads || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), opps: Math.ceil((config.baseCostOpps || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)) }; } else if (config.costCurrency === 'leads') { return { leads: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), opps: 0 }; } else if (config.costCurrency === 'opportunities') { return { leads: 0, opps: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)) }; } else if (config.costCurrency === 'money') { return { money: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), leads: 0, opps: 0 }; } return { leads: Infinity, opps: Infinity }; }
    function getCurrentCustomerCost() { /* ... same ... */ const cost = Math.ceil( LEADS_PER_CUSTOMER_BASE * Math.pow(CUSTOMER_COST_MULTIPLIER, gameState.customerCountForCostIncrease || 0) * (gameState.customerCostReductionMultiplier || 1.0) ); return Math.max(1, cost); }

    // --- Core Calculation Function ---
    function calculateDerivedStats() { /* ... same ... */ let newBaseLPS = 0; let newBaseOPS = 0; let baseCAR = 0.1; let baseCVR = 0.1; const globalEfficiency = gameState.buildingEfficiencyMultiplier || 1.0; for (const buildingId in buildingsConfig) { const config = buildingsConfig[buildingId]; const count = gameState.buildings[buildingId]?.count || 0; if (count > 0) { let baseLPSInstance = config.baseLPS || 0; let baseOPSInstance = config.baseOPS || 0; let totalFlatBonusLPS = 0; let totalFlatBonusOPS = 0; let percentMultiplierLPS = 1.0; let percentMultiplierOPS = 1.0; let multiplierLPS = 1.0; let multiplierOPS = 1.0; for (const upgradeId in upgradesConfig) { const upConfig = upgradesConfig[upgradeId]; if (gameState.upgrades[upgradeId]?.purchased && upConfig.targetBuilding === buildingId) { if (upConfig.flatBonusLPS) totalFlatBonusLPS += upConfig.flatBonusLPS; if (upConfig.flatBonusOPS) totalFlatBonusOPS += upConfig.flatBonusOPS; if (upConfig.percentBonusLPS) percentMultiplierLPS += upConfig.percentBonusLPS; if (upConfig.percentBonusOPS) percentMultiplierOPS += upConfig.percentBonusOPS; if (upConfig.multiplierBonusLPS) multiplierLPS *= upConfig.multiplierBonusLPS; if (upConfig.multiplierBonusOPS) multiplierOPS *= upConfig.multiplierBonusOPS; } } let finalLPSInstance = (baseLPSInstance + totalFlatBonusLPS) * percentMultiplierLPS * multiplierLPS; let finalOPSInstance = (baseOPSInstance + totalFlatBonusOPS) * percentMultiplierOPS * multiplierOPS; newBaseLPS += finalLPSInstance * count * globalEfficiency; newBaseOPS += finalOPSInstance * count * globalEfficiency; } } for (const id in upgradesConfig) { const config = upgradesConfig[id]; if (gameState.upgrades[id]?.purchased && config.targetRate) { if (config.targetRate === 'car') baseCAR += config.effectValue; if (config.targetRate === 'cvr') baseCVR += config.effectValue; } } baseCAR += gameState.custUpgradeBonusCAR || 0; baseCVR += gameState.custUpgradeBonusCVR || 0; leadsPerSecond = Math.max(0, newBaseLPS); opportunitiesPerSecond = Math.max(0, newBaseOPS); customerAcquisitionRate = Math.max(0, baseCAR); customerValueRate = Math.max(0, baseCVR); moneyPerSecond = (gameState.customers || 0) * customerValueRate; }

    // --- Display Update Functions ---
    function updateDisplay() { /* ... same ... */ try { domElements.leads.textContent = formatNumber(gameState.leads); domElements.opportunities.textContent = formatNumber(gameState.opportunities); domElements.customers.textContent = formatNumber(gameState.customers); domElements.money.textContent = formatMoney(gameState.money); domElements.lps.textContent = formatPerSecond(leadsPerSecond, "Leads"); domElements.ops.textContent = formatPerSecond(opportunitiesPerSecond, "Opps"); domElements.mps.textContent = formatMoney(moneyPerSecond); domElements['leads-per-click'].textContent = formatNumber(gameState.leadsPerClick); domElements['opps-per-click'].textContent = formatNumber(gameState.opportunitiesPerClick); if (domElements['lead-click-base-p']) { domElements['lead-click-base-p'].title = `Base Lead generation per click. Current Bonus: +${formatPercent(gameState.leadClickPercentBonus, 1)} of Leads/Sec per click (${formatNumber(leadsPerSecond * (gameState.leadClickPercentBonus || 0))}/click).`; } if (domElements['opp-click-base-p']) { domElements['opp-click-base-p'].title = `Base Opportunity generation per click. Current Bonus: +${formatPercent(gameState.oppClickPercentBonus, 1)} of Opps/Sec per click (${formatNumber(opportunitiesPerSecond * (gameState.oppClickPercentBonus || 0))}/click).`; } domElements.car.textContent = formatCAR(customerAcquisitionRate) + "/s"; domElements['success-chance'].textContent = formatPercent(gameState.acquisitionSuccessChance); domElements.cvr.textContent = "$" + formatRateMoney(customerValueRate); domElements['cust-cost'].textContent = formatNumber(getCurrentCustomerCost()) + " Leads & Opps"; } catch (error) { console.error("Error in updateDisplay:", error); } }
    function updateButtonStates() { // CORRECTED VERSION
        try {
            // Buildings
            for (const buildingId in buildingsConfig) {
                const bldCfg = buildingsConfig[buildingId];
                const state = gameState.buildings[buildingId] || { count: 0 };
                const button = domElements[`buy-${buildingId}`];
                const countDisplay = domElements[`${buildingId}-count`];
                const costDisplay = domElements[`${buildingId}-cost`];
                const effectDisplay = domElements[`${buildingId}-effect`]; // Get effect span

                if (button && countDisplay && costDisplay) {
                    const cost = getBuildingCost(buildingId);
                    const currency = bldCfg.costCurrency;
                    let canAfford = false;

                    // Set cost text and check affordability
                    if (currency === 'both') { canAfford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; costDisplay.textContent = `Cost: ${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
                    else if (currency === 'leads') { canAfford = gameState.leads >= cost.leads; costDisplay.textContent = `Cost: ${formatNumber(cost.leads)} Leads`; }
                    else if (currency === 'opportunities') { canAfford = gameState.opportunities >= cost.opps; costDisplay.textContent = `Cost: ${formatNumber(cost.opps)} Opps`; }
                    else if (currency === 'money') { canAfford = gameState.money >= cost.money; costDisplay.textContent = `Cost: $${formatMoney(cost.money)}`; }

                    button.disabled = !canAfford; // Removed stray parenthesis here
                    countDisplay.textContent = state.count;

                    // Calculate and update effect text dynamically
                    if (effectDisplay) {
                        let baseLPSInstance = bldCfg.baseLPS || 0;
                        let baseOPSInstance = bldCfg.baseOPS || 0;
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

                        const parts = [];
                        if (finalLPSInstance > 0) parts.push(`+${formatNumber(finalLPSInstance)} L/S`);
                        if (finalOPSInstance > 0) parts.push(`+${formatNumber(finalOPSInstance)} O/S`);

                        effectDisplay.textContent = parts.length > 0 ? parts.join(', ') : "No Effect";
                    }
                }
            }

            // Upgrades
            for (const id in upgradesConfig) {
                const upCfg = upgradesConfig[id];
                const state = gameState.upgrades[id] || { purchased: false };
                const el = domElements[`upgrade-${id}`];
                if (el) {
                    const cost = upCfg.cost;
                    const curr = upCfg.costCurrency;
                    let afford = (curr === 'leads' && gameState.leads >= cost) ||
                                 (curr === 'opportunities' && gameState.opportunities >= cost) ||
                                 (curr === 'money' && gameState.money >= cost) ||
                                 (curr === 'customers' && gameState.customers >= cost);
                    const purchased = state.purchased === true;
                    el.disabled = !afford || purchased;

                    const cstSpn = el.querySelector('.cost');
                    const effSpn = el.querySelector('.effect');

                    if (purchased) {
                        el.classList.add('purchased');
                    } else {
                        el.classList.remove('purchased');
                        if (cstSpn) {
                            cstSpn.style.display = 'block';
                            cstSpn.textContent = `Cost: ${
                                curr === 'leads' ? formatNumber(cost) + ' Leads' :
                                curr === 'opportunities' ? formatNumber(cost) + ' Opportunities' :
                                curr === 'money' ? '$' + formatMoney(cost) :
                                curr === 'customers' ? formatNumber(cost) + ' Customers' :
                                formatNumber(cost)
                            }`;
                        }
                        if (effSpn) {
                            effSpn.style.display = 'block';
                            // Update effect text specifically for new boost types if needed (though HTML might cover it)
                            // Example (adjust based on actual HTML effect text):
                            let effectText = effSpn.textContent; // Get default from HTML
                            if (upCfg.percentBonusLPS && !upCfg.multiplierBonusLPS) { // Basic percent boost
                                effectText = `+${formatPercent(upCfg.percentBonusLPS,0)} Output per ${buildingsConfig[upCfg.targetBuilding]?.name || 'Target'}`;
                            } else if (upCfg.multiplierBonusLPS && !upCfg.percentBonusLPS) { // Basic multiplier boost
                                effectText = `x${upCfg.multiplierBonusLPS} Output per ${buildingsConfig[upCfg.targetBuilding]?.name || 'Target'}`;
                            }
                            // Add similar logic for OPS or dual boosts if the HTML text isn't sufficient
                             effSpn.textContent = effectText;
                        }
                    }
                }
            }
            updateAcquisitionButtonVisuals();
        } catch (error) {
            console.error("Error in updateButtonStates:", error);
        }
    }
    function updateAcquisitionButtonVisuals() { /* ... same ... */ const btn = domElements['toggle-acquisition-button']; if (!btn) return; if (gameState.isAcquisitionPaused) { btn.textContent = 'Resume Acquisition'; btn.title = 'Resume customer acquisition (Lead/Opportunity consumption)'; btn.classList.add('paused'); } else { btn.textContent = 'Pause Acquisition'; btn.title = 'Pause customer acquisition (Lead/Opportunity consumption)'; btn.classList.remove('paused'); } }

    // --- Sound Effect Helper ---
    function playSoundEffect(audioElement) { /* ... same ... */ if (audioElement && audioElement.readyState >= 2) { audioElement.currentTime = 0; audioElement.play().catch(error => { }); } }

    // --- Purchase Functions ---
    function buyBuilding(id) { /* ... same ... */ const config = buildingsConfig[id]; const state = gameState.buildings[id]; if (!config || !state || isGamePaused) return; const cost = getBuildingCost(id); const currency = config.costCurrency; let canAfford = false; if (currency === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; canAfford = true; } } else if (currency === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; canAfford = true; } } else if (currency === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; canAfford = true; } } else if (currency === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; canAfford = true; } } if (canAfford) { state.count++; playSoundEffect(domElements['sfx-purchase']); calculateDerivedStats(); updateDisplay(); updateButtonStates(); } }
    function buyUpgrade(id) { /* ... same ... */ const config = upgradesConfig[id]; const state = gameState.upgrades[id]; if (!config || !state || state.purchased || isGamePaused) return; const cost = config.cost; const currency = config.costCurrency; let canAfford = false; if (currency === 'leads' && gameState.leads >= cost) { gameState.leads -= cost; canAfford = true; } else if (currency === 'opportunities' && gameState.opportunities >= cost) { gameState.opportunities -= cost; canAfford = true; } else if (currency === 'money' && gameState.money >= cost) { gameState.money -= cost; canAfford = true; } else if (currency === 'customers' && gameState.customers >= cost) { gameState.customers -= cost; canAfford = true; } if (canAfford) { state.purchased = true; playSoundEffect(domElements['sfx-purchase']); if (typeof config.effect === 'function') { config.effect(gameState); } calculateDerivedStats(); updateDisplay(); updateButtonStates(); } }

    // --- Music Player Logic ---
    function loadTrack(index, playWhenReady = false) { /* ... same ... */ const music = domElements['background-music']; const trackNameEl = domElements['current-track-name']; if (!music || !trackNameEl || playlist.length === 0) return; currentTrackIndex = (index + playlist.length) % playlist.length; const track = playlist[currentTrackIndex]; if (!track) return; console.log(`Loading track ${currentTrackIndex}: ${track.name}`); musicShouldBePlaying = playWhenReady; let sourceMP3 = music.querySelector('source[type="audio/mpeg"]'); if (!sourceMP3) { sourceMP3 = document.createElement('source'); sourceMP3.type = 'audio/mpeg'; music.appendChild(sourceMP3); } sourceMP3.src = `resources/audio/${track.filename}`; trackNameEl.textContent = track.name; music.load(); music.removeEventListener('canplay', handleCanPlay); music.addEventListener('canplay', handleCanPlay, { once: true }); updatePlayPauseIcon(); }
    function handleCanPlay() { /* ... same ... */ const music = domElements['background-music']; console.log(`Track ${currentTrackIndex} can play. Should play: ${musicShouldBePlaying}`); if (musicShouldBePlaying) { playCurrentTrack(); } else { updatePlayPauseIcon(); } }
    function playCurrentTrack() { /* ... same ... */ const music = domElements['background-music']; if (!music || !music.currentSrc) { console.warn("Attempted to play but no source loaded."); musicShouldBePlaying = false; updatePlayPauseIcon(); return; } console.log("Attempting to play..."); const playPromise = music.play(); if (playPromise !== undefined) { playPromise.then(() => { console.log("Playback started."); musicShouldBePlaying = true; updatePlayPauseIcon(); }).catch(error => { console.warn("Playback failed:", error); musicShouldBePlaying = false; updatePlayPauseIcon(); }); } else { if (!music.paused) { musicShouldBePlaying = true; } else { musicShouldBePlaying = false; } updatePlayPauseIcon(); } }
    function pauseCurrentTrack() { /* ... same ... */ const music = domElements['background-music']; if (music) { music.pause(); musicShouldBePlaying = false; console.log("Playback paused."); updatePlayPauseIcon(); } }
    function updatePlayPauseIcon() { /* ... same ... */ const playPauseIconEl = domElements['play-pause-icon']; const playPauseButtonEl = domElements['play-pause-button']; if (!playPauseIconEl || !playPauseButtonEl) return; if (musicShouldBePlaying) { playPauseIconEl.innerHTML = '❚❚'; playPauseButtonEl.title = "Pause Music"; } else { playPauseIconEl.innerHTML = '►'; playPauseButtonEl.title = "Play Music"; } }
    function playNextTrack() { /* ... same ... */ const music = domElements['background-music']; if (!music) return; const shouldResume = !music.paused; loadTrack(currentTrackIndex + 1, shouldResume); }
    function togglePlayPause() { /* ... same ... */ const music = domElements['background-music']; if (!music) return; if (music.paused) { if (!music.currentSrc || music.currentSrc === '' || music.currentSrc === window.location.href) { console.log("No valid track loaded, loading first track."); loadTrack(0, true); } else { playCurrentTrack(); } } else { pauseCurrentTrack(); } }
    function setVolume(value = null) { /* ... same ... */ const music = domElements['background-music']; const slider = domElements['volume-slider']; if (music && slider) { if (value !== null && !isNaN(value) && value >= 0 && value <= 1) { slider.value = value; music.volume = value; if(domElements['sfx-purchase']) domElements['sfx-purchase'].volume = Math.min(1, value * 2); } else { music.volume = parseFloat(slider.value); if(domElements['sfx-purchase']) domElements['sfx-purchase'].volume = Math.min(1, parseFloat(slider.value) * 2); } } }

    // --- Modal Logic ---
    function showModal(modalElement) { /* ... same ... */ if (modalElement) modalElement.classList.add('show'); }
    function hideModal(modalElement) { /* ... same ... */ if (modalElement) modalElement.classList.remove('show'); }
    function showCredits() { showModal(domElements['credits-modal']); } function hideCredits() { hideModal(domElements['credits-modal']); }
    function showStats() { /* ... same ... */ const statsModal = domElements['stats-modal']; updateStatsDisplay(); showModal(statsModal); if (statsUpdateIntervalId) clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = setInterval(updateStatsDisplay, STATS_UPDATE_INTERVAL_MS); }
    function hideStats() { /* ... same ... */ const statsModal = domElements['stats-modal']; hideModal(statsModal); if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; } }
    function triggerWin() { /* ... same ... */ if (isGameWon) return; console.log("WIN CONDITION MET!"); isGameWon = true; isGamePaused = true; saveGame(); showModal(domElements['win-modal']); }
    function closeWinScreen() { /* ... same ... */ hideModal(domElements['win-modal']); isGamePaused = false; }
    function showTutorial() { showModal(domElements['tutorial-modal']); } function hideTutorial() { hideModal(domElements['tutorial-modal']); }

    // --- Stats Modal Update ---
    function updateStatsDisplay() { /* ... same ... */ if (!domElements['stats-modal'] || !domElements['stats-modal'].classList.contains('show')) { if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; } return; } try { domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now())); domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks); domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks); domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads); domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps); domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads); domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps); domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts); domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions); domElements['stat-acq-failed'].textContent = formatNumber(gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions); domElements['stat-total-money'].textContent = formatMoney(gameState.totalMoneyEarned); } catch (error) { console.error("Error updating stats display:", error); hideStats(); } }

    // --- Acquisition Pause Logic ---
    function toggleAcquisitionPause() { /* ... same ... */ gameState.isAcquisitionPaused = !gameState.isAcquisitionPaused; console.log(`Customer Acquisition ${gameState.isAcquisitionPaused ? 'Paused' : 'Resumed'}`); updateAcquisitionButtonVisuals(); }

    // --- Save/Load Functions ---
    function displaySaveStatus(message, duration = 3000) { /* ... same ... */ const statusEl = domElements['save-status']; if (!statusEl) return; if (saveStatusTimeoutId) clearTimeout(saveStatusTimeoutId); statusEl.textContent = message; statusEl.classList.add('visible'); saveStatusTimeoutId = setTimeout(() => { statusEl.classList.remove('visible'); }, duration); }
    function getDefaultGameState() { /* ... same ... */ const defaultState = { leads: 0, opportunities: 0, customers: 0, money: 0, leadsPerClick: 1, opportunitiesPerClick: 1, leadClickPercentBonus: 0, oppClickPercentBonus: 0, buildingEfficiencyMultiplier: 1.0, customerCostReductionMultiplier: 1.0, acquisitionSuccessChance: 0.25, customerCountForCostIncrease: 0, isAcquisitionPaused: false, gameStartTime: Date.now(), totalLeadClicks: 0, totalOppClicks: 0, totalManualLeads: 0, totalManualOpps: 0, totalAutoLeads: 0, totalAutoOpps: 0, totalAcquisitionAttempts: 0, totalSuccessfulAcquisitions: 0, totalMoneyEarned: 0, custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0, buildings: {}, upgrades: {} }; initializeStructureState(defaultState, true); return defaultState; }
    function initializeStructureState(state, isInitialSetup = false) { /* ... same ... */ if (!state.buildings) state.buildings = {}; if (!state.upgrades) state.upgrades = {}; for (const id in buildingsConfig) { if (!state.buildings[id]) { state.buildings[id] = { count: 0 }; } else { state.buildings[id].count = Math.max(0, Math.floor(state.buildings[id].count || 0)); } } for (const id in upgradesConfig) { if (!state.upgrades[id]) { state.upgrades[id] = { purchased: false }; } else { state.upgrades[id].purchased = state.upgrades[id].purchased === true; } } if (!isInitialSetup) { for (const id in state.buildings) { if (!buildingsConfig[id]) { console.log(`Removing obsolete building state for: ${id}`); delete state.buildings[id]; } } for (const id in state.upgrades) { if (!upgradesConfig[id]) { console.log(`Removing obsolete upgrade state for: ${id}`); delete state.upgrades[id]; } } } state.leads = Number(state.leads) || 0; state.opportunities = Number(state.opportunities) || 0; state.customers = Math.max(0, Math.floor(Number(state.customers) || 0)); state.money = Number(state.money) || 0; state.leadsPerClick = Number(state.leadsPerClick) || 1; state.opportunitiesPerClick = Number(state.opportunitiesPerClick) || 1; state.leadClickPercentBonus = Number(state.leadClickPercentBonus) || 0; state.oppClickPercentBonus = Number(state.oppClickPercentBonus) || 0; state.buildingEfficiencyMultiplier = Number(state.buildingEfficiencyMultiplier) || 1.0; state.customerCostReductionMultiplier = Number(state.customerCostReductionMultiplier) || 1.0; state.acquisitionSuccessChance = Math.max(0, Math.min(1.0, Number(state.acquisitionSuccessChance) || 0.25)); state.customerCountForCostIncrease = Math.max(0, Math.floor(Number(state.customerCountForCostIncrease) || 0)); state.isAcquisitionPaused = state.isAcquisitionPaused === true; state.gameStartTime = Number(state.gameStartTime) || Date.now(); state.totalLeadClicks = Number(state.totalLeadClicks) || 0; state.totalOppClicks = Number(state.totalOppClicks) || 0; state.totalManualLeads = Number(state.totalManualLeads) || 0; state.totalManualOpps = Number(state.totalManualOpps) || 0; state.totalAutoLeads = Number(state.totalAutoLeads) || 0; state.totalAutoOpps = Number(state.totalAutoOpps) || 0; state.totalAcquisitionAttempts = Number(state.totalAcquisitionAttempts) || 0; state.totalSuccessfulAcquisitions = Number(state.totalSuccessfulAcquisitions) || 0; state.totalMoneyEarned = Number(state.totalMoneyEarned) || 0; state.custUpgradeBonusCAR = Number(state.custUpgradeBonusCAR) || 0; state.custUpgradeBonusCVR = Number(state.custUpgradeBonusCVR) || 0; }
    function saveGame() { /* ... same ... */ if (isGamePaused && !isGameWon) return; try { const stateToSave = JSON.parse(JSON.stringify(gameState)); localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave)); displaySaveStatus(`Saved: ${new Date().toLocaleTimeString()}`); } catch (error) { console.error("Error saving game:", error); displaySaveStatus("Error saving!", 5000); } }
    function loadGame() { /* ... same ... */ const savedJson = localStorage.getItem(SAVE_KEY); let loadedSuccessfully = false; gameState = getDefaultGameState(); if (savedJson) { try { const loadedData = JSON.parse(savedJson); for (const key in gameState) { if (loadedData.hasOwnProperty(key)) { if (key === 'buildings' || key === 'upgrades') { if (loadedData[key] && typeof loadedData[key] === 'object'){ for (const id in loadedData[key]) { if ((key === 'buildings' && buildingsConfig[id]) || (key === 'upgrades' && upgradesConfig[id])) { if (!gameState[key][id]) gameState[key][id] = {}; gameState[key][id] = { ...gameState[key][id], ...loadedData[key][id] }; } else { console.log(`Ignoring loaded data for obsolete ${key.slice(0, -1)}: ${id}`); } } } } else if (typeof gameState[key] !== 'object' || gameState[key] === null) { gameState[key] = loadedData[key]; } } } initializeStructureState(gameState, false); if (typeof gameState.gameStartTime !== 'number' || isNaN(gameState.gameStartTime) || gameState.gameStartTime <= 0) { gameState.gameStartTime = Date.now(); } console.log("Game Loaded Successfully."); displaySaveStatus("Save loaded."); loadedSuccessfully = true; } catch (error) { console.error("Error loading saved game:", error); displaySaveStatus("Load error! Resetting game.", 5000); localStorage.removeItem(SAVE_KEY); gameState = getDefaultGameState(); loadedSuccessfully = false; } } else { console.log("No save file found, starting new game."); loadedSuccessfully = false; } calculateDerivedStats(); return loadedSuccessfully; }
    function deleteSave() { /* ... same ... */ if (confirm("Are you sure you want to delete your save data? This cannot be undone.")) { localStorage.removeItem(SAVE_KEY); displaySaveStatus("Save deleted. Reloading...", 5000); setTimeout(() => location.reload(), 1500); } }

    // --- Event Listener Setup ---
    function setupEventListeners() { /* ... same ... */ console.log("--- Attaching Event Listeners ---"); domElements['click-lead-button']?.addEventListener('click', () => { if (isGamePaused) return; const baseAmount = gameState.leadsPerClick; const bonusAmount = leadsPerSecond * (gameState.leadClickPercentBonus || 0); const totalAmount = baseAmount + bonusAmount; gameState.leads += totalAmount; gameState.totalLeadClicks++; gameState.totalManualLeads += totalAmount; updateButtonStates(); }); domElements['click-opp-button']?.addEventListener('click', () => { if (isGamePaused) return; const baseAmount = gameState.opportunitiesPerClick; const bonusAmount = opportunitiesPerSecond * (gameState.oppClickPercentBonus || 0); const totalAmount = baseAmount + bonusAmount; gameState.opportunities += totalAmount; gameState.totalOppClicks++; gameState.totalManualOpps += totalAmount; updateButtonStates(); }); for (const id in buildingsConfig) { domElements[`buy-${id}`]?.addEventListener('click', () => buyBuilding(id)); } for (const id in upgradesConfig) { domElements[`upgrade-${id}`]?.addEventListener('click', () => buyUpgrade(id)); } domElements['play-pause-button']?.addEventListener('click', togglePlayPause); domElements['volume-slider']?.addEventListener('input', () => setVolume()); domElements['next-track-button']?.addEventListener('click', playNextTrack); domElements['background-music']?.addEventListener('ended', () => { console.log(`Track ${currentTrackIndex} ended.`); playNextTrack(); }); domElements['credits-button']?.addEventListener('click', showCredits); domElements['close-credits-button']?.addEventListener('click', hideCredits); domElements['credits-modal']?.addEventListener('click', (event) => { if (event.target === domElements['credits-modal']) hideCredits(); }); domElements['stats-button']?.addEventListener('click', showStats); domElements['close-stats-button']?.addEventListener('click', hideStats); domElements['stats-modal']?.addEventListener('click', (event) => { if (event.target === domElements['stats-modal']) hideStats(); }); domElements['tutorial-button']?.addEventListener('click', showTutorial); domElements['close-tutorial-button']?.addEventListener('click', hideTutorial); domElements['tutorial-modal']?.addEventListener('click', (event) => { if (event.target === domElements['tutorial-modal']) hideTutorial(); }); domElements['close-win-button']?.addEventListener('click', closeWinScreen); domElements['save-button']?.addEventListener('click', saveGame); domElements['delete-save-button']?.addEventListener('click', deleteSave); domElements['toggle-acquisition-button']?.addEventListener('click', toggleAcquisitionPause); domElements['settings-button']?.addEventListener('click', () => { alert('Settings panel not implemented yet.'); console.log('Settings button clicked'); }); console.log("--- Finished Attaching Event Listeners ---"); }

    // --- Game Loop ---
    function gameLoop() { /* ... same ... */ if (isGamePaused) return; const intervalSeconds = TICK_INTERVAL_MS / 1000.0; const leadsThisTick = leadsPerSecond * intervalSeconds; const oppsThisTick = opportunitiesPerSecond * intervalSeconds; gameState.leads += leadsThisTick; gameState.opportunities += oppsThisTick; gameState.totalAutoLeads += leadsThisTick; gameState.totalAutoOpps += oppsThisTick; if (!gameState.isAcquisitionPaused) { const currentCost = getCurrentCustomerCost(); let attemptsPossible = (customerAcquisitionRate * intervalSeconds) + acquisitionAttemptRemainder; let attemptsToMake = Math.floor(attemptsPossible); acquisitionAttemptRemainder = attemptsPossible - attemptsToMake; let successfulAcquisitionsThisTick = 0; if (attemptsToMake > 0) { for (let i = 0; i < attemptsToMake; i++) { if (gameState.leads >= currentCost && gameState.opportunities >= currentCost) { gameState.totalAcquisitionAttempts++; gameState.leads -= currentCost; gameState.opportunities -= currentCost; if (Math.random() < gameState.acquisitionSuccessChance) { successfulAcquisitionsThisTick++; gameState.totalSuccessfulAcquisitions++; gameState.customerCountForCostIncrease++; gameState.customers++; } } else { break; } } if (gameState.leads < 0) gameState.leads = 0; if (gameState.opportunities < 0) gameState.opportunities = 0; } } const moneyThisTick = gameState.customers * customerValueRate * intervalSeconds; gameState.money += moneyThisTick; gameState.totalMoneyEarned += moneyThisTick; calculateDerivedStats(); updateDisplay(); updateButtonStates(); if (!isGameWon && gameState.money >= WIN_AMOUNT) { triggerWin(); } }

    // --- Interval Management ---
    function startGameLoop() { /* ... same ... */ if (gameLoopIntervalId) clearInterval(gameLoopIntervalId); gameLoopIntervalId = setInterval(gameLoop, TICK_INTERVAL_MS); console.log("Game loop started."); }
    function startAutoSave() { /* ... same ... */ if (autoSaveIntervalId) clearInterval(autoSaveIntervalId); autoSaveIntervalId = setInterval(saveGame, AUTO_SAVE_INTERVAL_MS); console.log("Auto-save started."); }

    // --- Initialization ---
    function initializeGame() { /* ... same ... */ console.log("--- Initializing Game ---"); try { cacheDOMElements(); } catch (error) { console.error("Error during initial DOM caching:", error); return; } loadGame(); updateDisplay(); updateButtonStates(); setupEventListeners(); if (domElements['background-music'] && domElements['volume-slider']) { setVolume(0.1); loadTrack(0, true); } else { console.warn("Music player elements not found during initialization."); } startGameLoop(); startAutoSave(); console.log("--- Game Initialized and Running ---"); }

    // --- Start the Game ---
    initializeGame();

}); // End DOMContentLoaded listener