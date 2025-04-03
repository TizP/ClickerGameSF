// Ensure strict mode and better error handling
"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- Constants ---
    const SAVE_KEY = 'salesforcePipelineSaveData_v1.15'; // Incremented version for cust growth rebalance
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
    const FLEX_WORKFLOW_EQUALITY_THRESHOLD = 0.01;

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

        // --- **** Customer Driven Growth (REBALANCED) **** ---
        custGrowth1: { // Loyal Customer Referrals
            cost: 10, costCurrency: 'customers',
            effect: (state) => {
                state.custUpgradeBonusCAR += 0.10;
                state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.03);
            }
        },
        custGrowth2: { // Customer Advisory Board
            cost: 50, costCurrency: 'customers',
            effect: (state) => {
                state.custUpgradeBonusCAR += 0.30;
                state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05);
            }
        },
        custGrowth3: { // Voice of Customer Program
            cost: 250, costCurrency: 'customers',
            effect: (state) => {
                state.custUpgradeBonusCAR += 0.50;
                state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10);
                state.custUpgradeBonusCVR += 1.00; // Changed from 2.80
            }
        },
        custGrowth4: { // Strategic Account Management
            cost: 1000, costCurrency: 'customers',
            effect: (state) => {
                state.customerCostReductionMultiplier *= 0.90; // Changed from 0.95
                state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10);
                state.custUpgradeBonusCVR += 1.00; // Changed from 10.00
                // Removed Acq Rate bonus if it was implicitly there before
            }
        },
        custGrowth5: { // Community Champion Program
            cost: 5000, costCurrency: 'customers',
            effect: (state) => {
                state.custUpgradeBonusCAR += 1.00; // Added Acq Rate bonus
                state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.25; // Changed from 1.10
                state.cvrCustomerMultiplier = (state.cvrCustomerMultiplier || 1.0) * 1.15; // Added +15% CVR multiplier
            }
        },
        // --- Special Upgrades ---
        flexibleWorkflow: { costMoney: 10000, costCustomers: 100 },
     };

    // --- Game State ---
    let gameState = {};

    // --- Derived State ---
    let leadsPerSecond = 0, opportunitiesPerSecond = 0, customerAcquisitionRate = 0, customerValueRate = 0, moneyPerSecond = 0;

    // --- Control Variables ---
    let gameLoopIntervalId = null, displayUpdateIntervalId = null, buttonUpdateIntervalId = null, autoSaveIntervalId = null, statsUpdateIntervalId = null;
    let isGameWon = false, isGamePaused = false, acquisitionAttemptRemainder = 0.0, saveStatusTimeoutId = null;

    // --- DOM Element Cache ---
    const domElements = {};

    // --- Helper Functions ---
    function formatNumber(num) { if (num === Infinity) return 'Infinity'; if (num === null || num === undefined || isNaN(num)) return '0'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if (absNum < 1e3) return sign + absNum.toFixed(0); const tiers = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd']; const tierIndex = Math.max(0, Math.min(tiers.length - 1, Math.floor(Math.log10(absNum) / 3))); const scaledNum = absNum / Math.pow(1000, tierIndex); let precision = 0; if (tierIndex > 0) { if (scaledNum < 10) precision = 2; else if (scaledNum < 100) precision = 1; } const formattedNum = scaledNum.toFixed(precision); const finalNumString = (precision > 0 && parseFloat(formattedNum) === Math.floor(scaledNum)) ? Math.floor(scaledNum).toString() : formattedNum; return sign + finalNumString + tiers[tierIndex]; }
    function formatPerSecond(num, unit = "Units") { if (num !== 0 && Math.abs(num) < 10 && Math.abs(num) >= 0.01) return num.toFixed(2) + ` ${unit}/Sec`; else if (num !== 0 && Math.abs(num) < 0.01 && num !== 0) return num.toExponential(2) + ` ${unit}/Sec`; else return formatNumber(num) + ` ${unit}/Sec`; }
    function formatMoney(num) { if (num === null || num === undefined || isNaN(num)) return '0.00'; const absNum = Math.abs(num); const sign = num < 0 ? '-' : ''; if (absNum < MONEY_FORMAT_THRESHOLD) { return sign + absNum.toFixed(2); } return sign + formatNumber(num); }
    function formatRateMoney(num) { if (num === 0 || num === null || num === undefined || isNaN(num)) return '0.000'; if (Math.abs(num) < 1e-3 && num !== 0) return num.toExponential(2); if (Math.abs(num) < 1) return num.toFixed(3); if (Math.abs(num) < 1000) return num.toFixed(2); return formatNumber(num); }
    function formatCAR(num) { return formatRateMoney(num); }
    function formatPercent(num, decimals = 1) { if (num === null || num === undefined || isNaN(num)) return '0.0%'; return (num * 100).toFixed(decimals) + '%'; }
    function formatTime(milliseconds) { if (milliseconds < 0 || isNaN(milliseconds)) return "0s"; const totalSeconds = Math.floor(milliseconds / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; let parts = []; if (days > 0) parts.push(`${days}d`); if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}m`); if (seconds >= 0 || parts.length === 0) parts.push(`${seconds}s`); return parts.join(' ') || '0s'; }

    // --- DOM Caching Function ---
    function cacheDOMElements() {
        console.log("Starting DOM Caching...");
        if (typeof domElements === 'undefined') { console.error("CRITICAL: domElements object undefined!"); return; }
        const ids = [ 'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps', 'leads-per-click', 'opps-per-click', 'lead-click-base-p', 'opp-click-base-p', 'car', 'success-chance', 'cvr', 'cust-cost', 'click-lead-button', 'click-opp-button', 'save-status', 'background-music', 'current-track-name', 'play-pause-button', 'play-pause-icon', 'next-track-button', 'volume-slider', 'sfx-purchase', 'credits-modal', 'close-credits-button', 'credits-button', 'win-modal', 'close-win-button', 'stats-modal', 'close-stats-button', 'stats-button', 'tutorial-modal', 'close-tutorial-button', 'tutorial-button', 'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps', 'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed', 'stat-total-money', 'save-button', 'delete-save-button', 'toggle-acquisition-button', 'settings-button', 'toggle-flexible-workflow' ];
        ids.forEach(id => { const el = document.getElementById(id); if (el) { domElements[id] = el; } else if (!id.includes('-') || id.startsWith('stat-')) { console.warn(`Essential DOM Element not found: ${id}`); } });
        for (const id in buildingsConfig) { ['buy', 'count', 'cost', 'effect'].forEach(suffix => { const elId = suffix === 'buy' ? `buy-${id}` : `${id}-${suffix}`; const el = document.getElementById(elId); if (el) domElements[elId] = el; }); }
        for (const id in upgradesConfig) { const el = document.getElementById(`upgrade-${id}`); if (el) domElements[`upgrade-${id}`] = el; else if (id === 'flexibleWorkflow') { console.warn(`Purchase button 'upgrade-flexibleWorkflow' not found.`); } }
        if (!domElements['toggle-flexible-workflow']) { console.warn(`Toggle button 'toggle-flexible-workflow' not found.`); }
        console.log("Finished DOM Caching. Found:", Object.keys(domElements).length);
    }

    // --- Dynamic Cost Calculation ---
    function getUpgradeCost(id) { const config = upgradesConfig[id]; if (!config) return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity }; if (id === 'flexibleWorkflow') { return { money: config.costMoney || 0, customers: config.costCustomers || 0, leads: 0, opps: 0 }; } if (config.costCurrency === 'both') { return { leads: config.costLeads || 0, opps: config.costOpps || 0, money: 0, customers: 0 }; } else if (config.costCurrency === 'leads') { return { leads: config.cost || 0, opps: 0, money: 0, customers: 0 }; } else if (config.costCurrency === 'opportunities') { return { leads: 0, opps: config.cost || 0, money: 0, customers: 0 }; } else if (config.costCurrency === 'money') { return { money: config.cost || 0, leads: 0, opps: 0, customers: 0 }; } else if (config.costCurrency === 'customers') { return { customers: config.cost || 0, leads: 0, opps: 0, money: 0 }; } return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity }; }
    function getBuildingCost(id) { const config = buildingsConfig[id]; const state = gameState.buildings[id]; if (!config || !state) return { leads: Infinity, opps: Infinity }; const count = state.count || 0; if (config.costCurrency === 'both') { return { leads: Math.ceil((config.baseCostLeads || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), opps: Math.ceil((config.baseCostOpps || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)) }; } else if (config.costCurrency === 'leads') { return { leads: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), opps: 0 }; } else if (config.costCurrency === 'opportunities') { return { leads: 0, opps: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)) }; } else if (config.costCurrency === 'money') { return { money: Math.ceil((config.baseCost || 0) * Math.pow(BUILDING_COST_MULTIPLIER, count)), leads: 0, opps: 0 }; } return { leads: Infinity, opps: Infinity }; }
    function getCurrentCustomerCost() { const cost = Math.ceil( LEADS_PER_CUSTOMER_BASE * Math.pow(CUSTOMER_COST_MULTIPLIER, gameState.customerCountForCostIncrease || 0) * (gameState.customerCostReductionMultiplier || 1.0) ); return Math.max(1, cost); }

    // --- Core Calculation Function ---
    function calculateDerivedStats() {
        let newBaseLPS = 0, newBaseOPS = 0, baseCAR = 0.1, baseCVR = 1.0;
        const globalEfficiency = gameState.buildingEfficiencyMultiplier || 1.0;
        const customerGlobalMultiplier = gameState.custGlobalMultiplier || 1.0;

        // 1. Base production
        for (const buildingId in buildingsConfig) {
            const config = buildingsConfig[buildingId]; const count = gameState.buildings[buildingId]?.count || 0;
            if (count > 0) {
                let baseLPSInstance = config.baseLPS || 0, baseOPSInstance = config.baseOPS || 0;
                let totalFlatBonusLPS = 0, totalFlatBonusOPS = 0, percentMultiplierLPS = 1.0, percentMultiplierOPS = 1.0, multiplierLPS = 1.0, multiplierOPS = 1.0;
                for (const upgradeId in upgradesConfig) { const upConfig = upgradesConfig[upgradeId]; if (gameState.upgrades[upgradeId]?.purchased && upConfig.targetBuilding === buildingId) { if (upConfig.flatBonusLPS) totalFlatBonusLPS += upConfig.flatBonusLPS; if (upConfig.flatBonusOPS) totalFlatBonusOPS += upConfig.flatBonusOPS; if (upConfig.percentBonusLPS) percentMultiplierLPS += upConfig.percentBonusLPS; if (upConfig.percentBonusOPS) percentMultiplierOPS += upConfig.percentBonusOPS; if (upConfig.multiplierBonusLPS) multiplierLPS *= upConfig.multiplierBonusLPS; if (upConfig.multiplierBonusOPS) multiplierOPS *= upConfig.multiplierBonusOPS; } }
                let finalLPSInstance = (baseLPSInstance + totalFlatBonusLPS) * percentMultiplierLPS * multiplierLPS;
                let finalOPSInstance = (baseOPSInstance + totalFlatBonusOPS) * percentMultiplierOPS * multiplierOPS;
                newBaseLPS += finalLPSInstance * count * globalEfficiency * customerGlobalMultiplier;
                newBaseOPS += finalOPSInstance * count * globalEfficiency * customerGlobalMultiplier;
            }
        }

        // 2. Flexible Workflow Balancing
        if (gameState.flexibleWorkflowActive) {
            if (Math.abs(newBaseLPS - newBaseOPS) < FLEX_WORKFLOW_EQUALITY_THRESHOLD && (newBaseLPS > 0 || newBaseOPS > 0)) {
                gameState.flexibleWorkflowActive = false; // Deactivate effect
                // Visual update handled by interval or manual call
            } else if (newBaseLPS !== newBaseOPS) {
                const isLPSHigher = newBaseLPS > newBaseOPS; const higherRate = isLPSHigher ? newBaseLPS : newBaseOPS;
                const transferAmount = higherRate * 0.50;
                if (isLPSHigher) { newBaseLPS -= transferAmount; newBaseOPS += transferAmount; }
                else { newBaseOPS -= transferAmount; newBaseLPS += transferAmount; }
                newBaseLPS = Math.max(0, newBaseLPS); newBaseOPS = Math.max(0, newBaseOPS);
            }
        }

        // 3. Base rates (CAR, CVR) from regular upgrades
        for (const id in upgradesConfig) { if (id === 'flexibleWorkflow') continue; const config = upgradesConfig[id]; if (gameState.upgrades[id]?.purchased) { if (config.targetRate === 'car') baseCAR += config.effectValue; if (config.targetRate === 'cvr') baseCVR += config.effectValue; } }

        // 4. Apply customer-driven flat bonuses (CAR, CVR)
        baseCAR += gameState.custUpgradeBonusCAR || 0;
        baseCVR += gameState.custUpgradeBonusCVR || 0;

        // 5. Apply CVR multipliers (both general and customer-specific)
        baseCVR *= (gameState.cvrMultiplierBonus || 1.0);
        baseCVR *= (gameState.cvrCustomerMultiplier || 1.0); // <-- Apply new multiplier

        // 6. Assign final values
        leadsPerSecond = Math.max(0, newBaseLPS); opportunitiesPerSecond = Math.max(0, newBaseOPS);
        customerAcquisitionRate = Math.max(0, baseCAR); customerValueRate = Math.max(0, baseCVR);
        moneyPerSecond = (gameState.customers || 0) * customerValueRate;
    }

    // --- Display Update Functions ---
    function updateDisplay() { try { const core = [domElements.leads, domElements.opportunities, domElements.customers, domElements.money, domElements.lps, domElements.ops, domElements.mps, domElements['leads-per-click'], domElements['opps-per-click'], domElements.car, domElements['success-chance'], domElements.cvr, domElements['cust-cost']]; if (core.some(el => !el)) return; domElements.leads.textContent = formatNumber(gameState.leads); domElements.opportunities.textContent = formatNumber(gameState.opportunities); domElements.customers.textContent = formatNumber(gameState.customers); domElements.money.textContent = formatMoney(gameState.money); domElements.lps.textContent = formatPerSecond(leadsPerSecond, "Leads"); domElements.ops.textContent = formatPerSecond(opportunitiesPerSecond, "Opps"); domElements.mps.textContent = "$" + formatMoney(moneyPerSecond); domElements['leads-per-click'].textContent = formatNumber(gameState.leadsPerClick); domElements['opps-per-click'].textContent = formatNumber(gameState.opportunitiesPerClick); if (domElements['lead-click-base-p']) { const b = leadsPerSecond*(gameState.leadClickPercentBonus||0); domElements['lead-click-base-p'].title = `Base:${gameState.leadsPerClick}. Bonus:+${formatPercent(gameState.leadClickPercentBonus,1)} L/S (${formatPerSecond(b,'L')}).`; } if (domElements['opp-click-base-p']) { const b = opportunitiesPerSecond*(gameState.oppClickPercentBonus||0); domElements['opp-click-base-p'].title = `Base:${gameState.opportunitiesPerClick}. Bonus:+${formatPercent(gameState.oppClickPercentBonus,1)} O/S (${formatPerSecond(b,'O')}).`; } domElements.car.textContent = formatCAR(customerAcquisitionRate)+"/s"; domElements['success-chance'].textContent = formatPercent(gameState.acquisitionSuccessChance); domElements.cvr.textContent = "$"+formatRateMoney(customerValueRate); domElements['cust-cost'].textContent = formatNumber(getCurrentCustomerCost())+" L&O"; } catch (e) { console.error("Err updateDisplay:", e); } }
    function updateButtonStates() { const isDisabledGlobal = isGamePaused || isGameWon; try { for (const id in buildingsConfig) { const btn = domElements[`buy-${id}`], cnt = domElements[`${id}-count`], cst = domElements[`${id}-cost`], eff = domElements[`${id}-effect`]; if (!btn||!cnt||!cst) continue; const cfg = buildingsConfig[id], state = gameState.buildings[id]||{count:0}, cost=getBuildingCost(id); let afford=false, cTxt='?'; if (cfg.costCurrency==='both'){afford=gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`;} else if (cfg.costCurrency==='leads'){afford=gameState.leads>=cost.leads; cTxt=`${formatNumber(cost.leads)} L`;} else if (cfg.costCurrency==='opportunities'){afford=gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.opps)} O`;} else if (cfg.costCurrency==='money'){afford=gameState.money>=cost.money; cTxt=`$${formatMoney(cost.money)}`;} btn.disabled=!afford||isDisabledGlobal; cst.textContent=`Cost: ${cTxt}`; cnt.textContent=state.count; if(eff){let bLPS=cfg.baseLPS||0,bOPS=cfg.baseOPS||0,fLPS=0,fOPS=0,pLPS=1.0,pOPS=1.0,mLPS=1.0,mOPS=1.0; const gE=gameState.buildingEfficiencyMultiplier||1.0, cM=gameState.custGlobalMultiplier||1.0; for(const uId in upgradesConfig){const uCfg=upgradesConfig[uId];if(gameState.upgrades[uId]?.purchased&&uCfg.targetBuilding===id){if(uCfg.flatBonusLPS)fLPS+=uCfg.flatBonusLPS;if(uCfg.flatBonusOPS)fOPS+=uCfg.flatBonusOPS;if(uCfg.percentBonusLPS)pLPS+=uCfg.percentBonusLPS;if(uCfg.percentBonusOPS)pOPS+=uCfg.percentBonusOPS;if(uCfg.multiplierBonusLPS)mLPS*=uCfg.multiplierBonusLPS;if(uCfg.multiplierBonusOPS)mOPS*=uCfg.multiplierBonusOPS;}} let finLPS=(bLPS+fLPS)*pLPS*mLPS*gE*cM; let finOPS=(bOPS+fOPS)*pOPS*mOPS*gE*cM; const parts=[]; if(finLPS>0)parts.push(`+${formatPerSecond(finLPS,"L").replace('/Sec','')}`); if(finOPS>0)parts.push(`+${formatPerSecond(finOPS,"O").replace('/Sec','')}`); eff.textContent=parts.length>0?parts.join(', '):"No Effect";}} for (const id in upgradesConfig) { const el = domElements[`upgrade-${id}`]; if (!el) continue; const cfg = upgradesConfig[id], state = gameState.upgrades[id]||{purchased:false}, cost=getUpgradeCost(id); let afford=false, cTxt='?'; if(id==='flexibleWorkflow'){afford=gameState.money>=cost.money&&gameState.customers>=cost.customers; cTxt=`${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`;} else if(cfg.costCurrency==='both'){afford=gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`;} else if(cfg.costCurrency==='leads'){afford=gameState.leads>=cost.leads; cTxt=`${formatNumber(cost.leads)} L`;} else if(cfg.costCurrency==='opportunities'){afford=gameState.opportunities>=cost.opps; cTxt=`${formatNumber(cost.opps)} O`;} else if(cfg.costCurrency==='money'){afford=gameState.money>=cost.money; cTxt=`$${formatMoney(cost.money)}`;} else if(cfg.costCurrency==='customers'){afford=gameState.customers>=cost.customers; cTxt=`${formatNumber(cost.customers)} Cust`;} const purchased=state.purchased===true; el.disabled=!afford||purchased||isDisabledGlobal; const cstSpn=el.querySelector('.cost'), effSpn=el.querySelector('.effect'); if(purchased){el.classList.add('purchased'); if(cstSpn)cstSpn.style.display='none'; if(effSpn)effSpn.style.display='none';} else {el.classList.remove('purchased'); if(cstSpn){cstSpn.style.display='block'; cstSpn.textContent=`Cost: ${cTxt}`;} if(effSpn)effSpn.style.display='block';}} updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); } catch (e) { console.error("Err updateButtons:", e); } }
    function updateAcquisitionButtonVisuals() { const btn = domElements['toggle-acquisition-button']; if (!btn) return; const isPaused = gameState.isAcquisitionPaused; btn.textContent = isPaused ? 'Resume Acq' : 'Pause Acq'; btn.title = isPaused ? 'Resume consumption' : 'Pause consumption'; btn.classList.toggle('paused', isPaused); btn.disabled = isGameWon || isGamePaused; }
    function updateFlexibleWorkflowToggleButtonVisuals() { const btn = domElements['toggle-flexible-workflow']; if (!btn) return; const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true; const isActive = gameState.flexibleWorkflowActive; btn.disabled = !isPurchased || isGamePaused || isGameWon; btn.classList.toggle('active', isActive && isPurchased); if (isActive && isPurchased) { btn.textContent = 'Deactivate Flex'; btn.title = 'Stop balancing L/O gen.'; } else { btn.textContent = 'Activate Flex'; btn.title = isPurchased ? 'Balance L/O gen.' : 'Purchase Flex Workflow first.'; } }

    // --- Sound Effect Helper ---
    function playSoundEffect(el) { if (el && el.readyState >= 2) { el.currentTime = 0; el.play().catch(()=>{}); } }

    // --- Purchase Functions ---
    function buyBuilding(id) { if (isGamePaused || isGameWon) return; const cfg=buildingsConfig[id], state=gameState.buildings[id]; if (!cfg||!state) return; const cost=getBuildingCost(id), curr=cfg.costCurrency; let afford=false; if(curr==='both'){if(gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps){gameState.leads-=cost.leads;gameState.opportunities-=cost.opps;afford=true;}} else if(curr==='leads'){if(gameState.leads>=cost.leads){gameState.leads-=cost.leads;afford=true;}} else if(curr==='opportunities'){if(gameState.opportunities>=cost.opps){gameState.opportunities-=cost.opps;afford=true;}} else if(curr==='money'){if(gameState.money>=cost.money){gameState.money-=cost.money;afford=true;}} if(afford){state.count++; playSoundEffect(domElements['sfx-purchase']); calculateDerivedStats(); updateDisplay(); updateButtonStates();}}
    function buyUpgrade(id) { if (isGamePaused || isGameWon) return; const cfg=upgradesConfig[id], state=gameState.upgrades[id]; if (!cfg||!state||state.purchased) return; const cost=getUpgradeCost(id); let afford=false; if(id==='flexibleWorkflow'){if(gameState.money>=cost.money&&gameState.customers>=cost.customers){gameState.money-=cost.money;gameState.customers-=cost.customers;afford=true;}} else if(cfg.costCurrency==='both'){if(gameState.leads>=cost.leads&&gameState.opportunities>=cost.opps){gameState.leads-=cost.leads;gameState.opportunities-=cost.opps;afford=true;}} else if(cfg.costCurrency==='leads'){if(gameState.leads>=cost.leads){gameState.leads-=cost.leads;afford=true;}} else if(cfg.costCurrency==='opportunities'){if(gameState.opportunities>=cost.opps){gameState.opportunities-=cost.opps;afford=true;}} else if(cfg.costCurrency==='money'){if(gameState.money>=cost.money){gameState.money-=cost.money;afford=true;}} else if(cfg.costCurrency==='customers'){if(gameState.customers>=cost.customers){gameState.customers-=cost.customers;afford=true;}} if(afford){state.purchased=true; playSoundEffect(domElements['sfx-purchase']); if(typeof cfg.effect==='function')cfg.effect(gameState); calculateDerivedStats(); updateDisplay(); updateButtonStates();}}

    // --- Music Player Logic ---
    function loadTrack(idx, play) { const music=domElements['background-music'], nameEl=domElements['current-track-name']; if (!music||!nameEl||!playlist.length) return; currentTrackIndex=(idx+playlist.length)%playlist.length; const track=playlist[currentTrackIndex]; if (!track) return; musicShouldBePlaying=play; let src=music.querySelector('source[type="audio/mpeg"]')||document.createElement('source'); src.type='audio/mpeg'; src.src=`resources/audio/${track.filename}`; if (!src.parentNode) music.appendChild(src); nameEl.textContent=track.name; music.load(); music.removeEventListener('canplay',handleCanPlay); music.addEventListener('canplay',handleCanPlay,{once:true}); updatePlayPauseIcon(); }
    function handleCanPlay() { if (musicShouldBePlaying) playCurrentTrack(); else updatePlayPauseIcon(); }
    function playCurrentTrack() { const music=domElements['background-music']; if (!music||!music.currentSrc) { musicShouldBePlaying=false; updatePlayPauseIcon(); return; } music.play().then(() => { musicShouldBePlaying=true; updatePlayPauseIcon(); }).catch(e => { if(e.name !== 'NotAllowedError') console.warn("Playback fail:", e); musicShouldBePlaying=false; updatePlayPauseIcon(); }); }
    function pauseCurrentTrack() { const music=domElements['background-music']; if(music){ music.pause(); musicShouldBePlaying=false; updatePlayPauseIcon(); } }
    function updatePlayPauseIcon() { const icon=domElements['play-pause-icon'], btn=domElements['play-pause-button']; if (!icon||!btn) return; icon.innerHTML=musicShouldBePlaying?'❚❚':'►'; btn.title=musicShouldBePlaying?"Pause":"Play"; }
    function playNextTrack() { if (domElements['background-music']) loadTrack(currentTrackIndex+1, musicShouldBePlaying); }
    function togglePlayPause() { const music=domElements['background-music']; if (!music) return; if (music.paused) { if (!music.currentSrc||music.currentSrc===''||music.currentSrc===window.location.href) loadTrack(0, true); else playCurrentTrack(); } else pauseCurrentTrack(); }
    function setVolume(val=null) { const music=domElements['background-music'], slider=domElements['volume-slider'], sfx=domElements['sfx-purchase']; if(music&&slider){ let vol=val??parseFloat(slider.value); if(isNaN(vol))vol=0.1; slider.value=vol; music.volume=vol; if(sfx)sfx.volume=Math.min(1,vol*1.5); } }

    // --- Modal Logic ---
    function showModal(el) { if (el) el.classList.add('show'); }
    function hideModal(el) { if (el) el.classList.remove('show'); }
    function showCredits() { showModal(domElements['credits-modal']); } function hideCredits() { hideModal(domElements['credits-modal']); }
    function showStats() { const modal=domElements['stats-modal']; if (!modal) return; updateStatsDisplay(); showModal(modal); if (statsUpdateIntervalId) clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = setInterval(updateStatsDisplay, STATS_UPDATE_INTERVAL_MS); }
    function hideStats() { const modal=domElements['stats-modal']; if (!modal) return; hideModal(modal); if (statsUpdateIntervalId){clearInterval(statsUpdateIntervalId); statsUpdateIntervalId=null;} }
    function triggerWin() { if (isGameWon) return; console.log("WIN!"); isGameWon=true; isGamePaused=true; updateButtonStates(); updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); saveGame(); showModal(domElements['win-modal']); }
    function closeWinScreen() { hideModal(domElements['win-modal']); isGamePaused=false; updateButtonStates(); updateAcquisitionButtonVisuals(); updateFlexibleWorkflowToggleButtonVisuals(); }
    function showTutorial() { showModal(domElements['tutorial-modal']); } function hideTutorial() { hideModal(domElements['tutorial-modal']); }

    // --- Stats Modal Update ---
    function updateStatsDisplay() { const modal=domElements['stats-modal']; if(!modal||!modal.classList.contains('show')){if(statsUpdateIntervalId){clearInterval(statsUpdateIntervalId);statsUpdateIntervalId=null;}return;} try { domElements['stat-game-time'].textContent=formatTime(Date.now()-(gameState.gameStartTime||Date.now())); domElements['stat-lead-clicks'].textContent=formatNumber(gameState.totalLeadClicks); domElements['stat-opp-clicks'].textContent=formatNumber(gameState.totalOppClicks); domElements['stat-manual-leads'].textContent=formatNumber(gameState.totalManualLeads); domElements['stat-manual-opps'].textContent=formatNumber(gameState.totalManualOpps); domElements['stat-auto-leads'].textContent=formatNumber(gameState.totalAutoLeads); domElements['stat-auto-opps'].textContent=formatNumber(gameState.totalAutoOpps); domElements['stat-acq-attempts'].textContent=formatNumber(gameState.totalAcquisitionAttempts); domElements['stat-acq-success'].textContent=formatNumber(gameState.totalSuccessfulAcquisitions); domElements['stat-acq-failed'].textContent=formatNumber(gameState.totalAcquisitionAttempts-gameState.totalSuccessfulAcquisitions); domElements['stat-total-money'].textContent=formatMoney(gameState.totalMoneyEarned); } catch (e) { console.error("Err stats display:", e); hideStats(); } }

    // --- Action Toggles ---
    function toggleAcquisitionPause() { if (isGameWon||isGamePaused) return; gameState.isAcquisitionPaused=!gameState.isAcquisitionPaused; updateAcquisitionButtonVisuals(); }
    function toggleFlexibleWorkflow() { if (isGamePaused||isGameWon||!gameState.upgrades['flexibleWorkflow']?.purchased) return; gameState.flexibleWorkflowActive=!gameState.flexibleWorkflowActive; calculateDerivedStats(); updateDisplay(); updateButtonStates(); }

    // --- Save/Load Functions ---
    function displaySaveStatus(msg, dur=3000) { const el=domElements['save-status']; if(!el)return; if(saveStatusTimeoutId)clearTimeout(saveStatusTimeoutId); el.textContent=msg; el.classList.add('visible'); saveStatusTimeoutId=setTimeout(()=>el.classList.remove('visible'), dur); }
    function getDefaultGameState() { const state = { leads: 0, opportunities: 0, customers: 0, money: 0, leadsPerClick: 1, opportunitiesPerClick: 1, leadClickPercentBonus: 0, oppClickPercentBonus: 0, buildingEfficiencyMultiplier: 1.0, customerCostReductionMultiplier: 1.0, acquisitionSuccessChance: 0.25, cvrMultiplierBonus: 1.0, cvrCustomerMultiplier: 1.0, /* <-- New state */ custGlobalMultiplier: 1.0, customerCountForCostIncrease: 0, isAcquisitionPaused: false, flexibleWorkflowActive: false, gameStartTime: Date.now(), totalLeadClicks: 0, totalOppClicks: 0, totalManualLeads: 0, totalManualOpps: 0, totalAutoLeads: 0, totalAutoOpps: 0, totalAcquisitionAttempts: 0, totalSuccessfulAcquisitions: 0, totalMoneyEarned: 0, custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0, buildings: {}, upgrades: {} }; initializeStructureState(state, true); return state; }
    function initializeStructureState(state, isInitial) { if(!state.buildings)state.buildings={}; if(!state.upgrades)state.upgrades={}; for(const id in buildingsConfig) { if(!state.buildings[id])state.buildings[id]={count:0}; else state.buildings[id].count=Math.max(0,Math.floor(state.buildings[id].count||0)); } for(const id in upgradesConfig) { if(!state.upgrades[id])state.upgrades[id]={purchased:false}; else state.upgrades[id].purchased=state.upgrades[id].purchased===true; } if(!isInitial){ for(const id in state.buildings)if(!buildingsConfig[id])delete state.buildings[id]; for(const id in state.upgrades)if(!upgradesConfig[id])delete state.upgrades[id]; } state.leads=Number(state.leads)||0; state.opportunities=Number(state.opportunities)||0; state.customers=Math.max(0,Math.floor(Number(state.customers)||0)); state.money=Number(state.money)||0; state.leadsPerClick=Number(state.leadsPerClick)||1; state.opportunitiesPerClick=Number(state.opportunitiesPerClick)||1; state.leadClickPercentBonus=Number(state.leadClickPercentBonus)||0; state.oppClickPercentBonus=Number(state.oppClickPercentBonus)||0; state.buildingEfficiencyMultiplier=Number(state.buildingEfficiencyMultiplier)||1.0; state.customerCostReductionMultiplier=Number(state.customerCostReductionMultiplier)||1.0; state.acquisitionSuccessChance=Math.max(0,Math.min(1.0,Number(state.acquisitionSuccessChance)||0.25)); state.cvrMultiplierBonus=Number(state.cvrMultiplierBonus)||1.0; state.cvrCustomerMultiplier=Number(state.cvrCustomerMultiplier)||1.0; /* <-- Sanitize new state */ state.custGlobalMultiplier=Number(state.custGlobalMultiplier)||1.0; state.customerCountForCostIncrease=Math.max(0,Math.floor(Number(state.customerCountForCostIncrease)||0)); state.isAcquisitionPaused=state.isAcquisitionPaused===true; state.flexibleWorkflowActive=state.flexibleWorkflowActive===true; state.gameStartTime=Number(state.gameStartTime)||Date.now(); state.totalLeadClicks=Number(state.totalLeadClicks)||0; state.totalOppClicks=Number(state.totalOppClicks)||0; state.totalManualLeads=Number(state.totalManualLeads)||0; state.totalManualOpps=Number(state.totalManualOpps)||0; state.totalAutoLeads=Number(state.totalAutoLeads)||0; state.totalAutoOpps=Number(state.totalAutoOpps)||0; state.totalAcquisitionAttempts=Number(state.totalAcquisitionAttempts)||0; state.totalSuccessfulAcquisitions=Number(state.totalSuccessfulAcquisitions)||0; state.totalMoneyEarned=Number(state.totalMoneyEarned)||0; state.custUpgradeBonusCAR=Number(state.custUpgradeBonusCAR)||0; state.custUpgradeBonusCVR=Number(state.custUpgradeBonusCVR)||0; }
    function saveGame() { if (isGamePaused&&!isGameWon) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)); displaySaveStatus(`Saved: ${new Date().toLocaleTimeString()}`); } catch (e) { console.error("Save error:", e); displaySaveStatus("Save Error!", 5000); } }
    function loadGame() { const json=localStorage.getItem(SAVE_KEY); gameState=getDefaultGameState(); let ok=false; if(json){ try { const data=JSON.parse(json); for(const key in gameState){ if(data.hasOwnProperty(key)){ if((key==='buildings'||key==='upgrades')&&typeof data[key]==='object'&&data[key]!==null){ for(const id in data[key]){ if((key==='buildings'&&buildingsConfig[id])||(key==='upgrades'&&upgradesConfig[id])){ if(!gameState[key][id])gameState[key][id]={}; gameState[key][id]={...gameState[key][id], ...data[key][id]};}}} else if(typeof gameState[key]!=='object'||gameState[key]===null){ gameState[key]=data[key];}}} initializeStructureState(gameState, false); if(isNaN(gameState.gameStartTime)||gameState.gameStartTime<=0)gameState.gameStartTime=Date.now(); console.log("Save Loaded."); displaySaveStatus("Save loaded."); ok=true; } catch (e) { console.error("Load error:", e); displaySaveStatus("Load error! Resetting.", 5000); localStorage.removeItem(SAVE_KEY); gameState=getDefaultGameState(); } } else { console.log("No save found."); } calculateDerivedStats(); return ok; }
    function deleteSave() { if (confirm("Delete save? Cannot undo.")) { localStorage.removeItem(SAVE_KEY); displaySaveStatus("Save deleted. Reloading...", 3000); stopAllIntervals(); setTimeout(()=>location.reload(), 1500); } }

    // --- Event Listener Setup ---
    function setupEventListeners() { console.log("--- Attaching Listeners ---"); domElements['click-lead-button']?.addEventListener('click',()=>{if(isGamePaused||isGameWon)return; const b=leadsPerSecond*(gameState.leadClickPercentBonus||0), t=gameState.leadsPerClick+b; gameState.leads+=t; gameState.totalLeadClicks++; gameState.totalManualLeads+=t; updateDisplay();updateButtonStates();}); domElements['click-opp-button']?.addEventListener('click',()=>{if(isGamePaused||isGameWon)return; const b=opportunitiesPerSecond*(gameState.oppClickPercentBonus||0), t=gameState.opportunitiesPerClick+b; gameState.opportunities+=t; gameState.totalOppClicks++; gameState.totalManualOpps+=t; updateDisplay();updateButtonStates();}); for(const id in buildingsConfig)domElements[`buy-${id}`]?.addEventListener('click',()=>buyBuilding(id)); for(const id in upgradesConfig)domElements[`upgrade-${id}`]?.addEventListener('click',()=>buyUpgrade(id)); domElements['play-pause-button']?.addEventListener('click',togglePlayPause); domElements['volume-slider']?.addEventListener('input',()=>setVolume()); domElements['next-track-button']?.addEventListener('click',playNextTrack); domElements['background-music']?.addEventListener('ended',playNextTrack); domElements['credits-button']?.addEventListener('click',showCredits); domElements['close-credits-button']?.addEventListener('click',hideCredits); domElements['credits-modal']?.addEventListener('click',(e)=>{if(e.target===domElements['credits-modal'])hideCredits();}); domElements['stats-button']?.addEventListener('click',showStats); domElements['close-stats-button']?.addEventListener('click',hideStats); domElements['stats-modal']?.addEventListener('click',(e)=>{if(e.target===domElements['stats-modal'])hideStats();}); domElements['tutorial-button']?.addEventListener('click',showTutorial); domElements['close-tutorial-button']?.addEventListener('click',hideTutorial); domElements['tutorial-modal']?.addEventListener('click',(e)=>{if(e.target===domElements['tutorial-modal'])hideTutorial();}); domElements['close-win-button']?.addEventListener('click',closeWinScreen); domElements['save-button']?.addEventListener('click',saveGame); domElements['delete-save-button']?.addEventListener('click',deleteSave); domElements['toggle-acquisition-button']?.addEventListener('click',toggleAcquisitionPause); domElements['settings-button']?.addEventListener('click',()=>alert('Settings WIP.')); domElements['toggle-flexible-workflow']?.addEventListener('click',toggleFlexibleWorkflow); console.log("--- Listeners Attached ---"); }

    // --- Game Loop ---
    function gameLoop() { if(isGamePaused)return; const secs=TICK_INTERVAL_MS/1000.0; const lTick=leadsPerSecond*secs, oTick=opportunitiesPerSecond*secs; gameState.leads+=lTick; gameState.opportunities+=oTick; gameState.totalAutoLeads+=lTick; gameState.totalAutoOpps+=oTick; if(!gameState.isAcquisitionPaused){ const cost=getCurrentCustomerCost(); let attempts=(customerAcquisitionRate*secs)+acquisitionAttemptRemainder; let toMake=Math.floor(attempts); acquisitionAttemptRemainder=attempts-toMake; if(toMake>0){ for(let i=0; i<toMake; i++){ if(gameState.leads>=cost&&gameState.opportunities>=cost){ gameState.totalAcquisitionAttempts++; gameState.leads-=cost; gameState.opportunities-=cost; if(Math.random()<gameState.acquisitionSuccessChance){gameState.totalSuccessfulAcquisitions++;gameState.customerCountForCostIncrease++;gameState.customers++;}} else {acquisitionAttemptRemainder+=(toMake-i); break;}} if(gameState.leads<0)gameState.leads=0; if(gameState.opportunities<0)gameState.opportunities=0;}} const mTick=gameState.customers*customerValueRate*secs; gameState.money+=mTick; gameState.totalMoneyEarned+=mTick; calculateDerivedStats(); if(!isGameWon&&gameState.money>=WIN_AMOUNT)triggerWin(); }

    // --- Interval Management ---
    function stopAllIntervals() { [gameLoopIntervalId, displayUpdateIntervalId, buttonUpdateIntervalId, autoSaveIntervalId, statsUpdateIntervalId].forEach(clearInterval); gameLoopIntervalId=displayUpdateIntervalId=buttonUpdateIntervalId=autoSaveIntervalId=statsUpdateIntervalId=null; console.log("Intervals stopped."); }
    function startGameIntervals() { stopAllIntervals(); gameLoopIntervalId=setInterval(gameLoop,TICK_INTERVAL_MS); console.log(`Loop started (${TICK_INTERVAL_MS}ms).`); displayUpdateIntervalId=setInterval(updateDisplay,DISPLAY_UPDATE_INTERVAL_MS); console.log(`Display loop started (${DISPLAY_UPDATE_INTERVAL_MS}ms).`); buttonUpdateIntervalId=setInterval(updateButtonStates,BUTTON_UPDATE_INTERVAL_MS); console.log(`Button loop started (${BUTTON_UPDATE_INTERVAL_MS}ms).`); autoSaveIntervalId=setInterval(saveGame,AUTO_SAVE_INTERVAL_MS); console.log(`Autosave started (${AUTO_SAVE_INTERVAL_MS}ms).`); }

    // --- Initialization ---
    function initializeGame() { console.log("--- Initializing Game ---"); try { cacheDOMElements(); } catch (e) { console.error("DOM cache error:", e); alert("Fatal UI Init Error."); return; } loadGame(); updateDisplay(); updateButtonStates(); setupEventListeners(); if (domElements['background-music']&&domElements['volume-slider']){setVolume(0.1);loadTrack(0,false);} else {console.warn("Music elements missing.");} startGameIntervals(); if(!isGameWon&&gameState.money>=WIN_AMOUNT){console.log("Loaded won state.");isGameWon=true;isGamePaused=true;updateButtonStates();updateAcquisitionButtonVisuals();updateFlexibleWorkflowToggleButtonVisuals();showModal(domElements['win-modal']);} console.log("--- Game Initialized ---"); }

    // --- Start ---
    initializeGame();

}); // End DOMContentLoaded