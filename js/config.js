// js/config.js
"use strict";

export const GAME_VERSION = "1.23"; // Increment version for split file structure
export const SAVE_KEY = `salesforcePipelineSaveData_v${GAME_VERSION}`; // Updated key
export const TICK_INTERVAL_MS = 100;
export const DISPLAY_UPDATE_INTERVAL_MS = 250;
export const BUTTON_UPDATE_INTERVAL_MS = 1000;
export const AUTO_SAVE_INTERVAL_MS = 30000;
export const STATS_UPDATE_INTERVAL_MS = 1000;
export const WIN_AMOUNT = 1_000_000_000;
export const BUILDING_COST_MULTIPLIER = 1.10;
export const LEADS_PER_CUSTOMER_BASE = 100;
export const CUSTOMER_COST_MULTIPLIER = 1.008; // Adjusted as per previous request
export const MONEY_FORMAT_THRESHOLD = 10000;
export const FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD = 1;

// --- Powerup Constants ---
export const POWERUP_SPAWN_INTERVAL_MS = 10000;
export const POWERUP_CHANCE_PER_INTERVAL = 0.0333;
export const POWERUP_FALL_DURATION_MS = 8000;
export const POWERUP_SFX_CLICK_ID = 'sfx-powerup-click';
export const POWERUP_TOKEN_SIZE = 90;

// --- Powerup Configuration ---
export const powerupTypes = [
    { id: 'prodBoost', name: 'Pipeline Frenzy', duration: 30000, magnitude: 1.0, effectTarget: 'prod', image: 'pipelinePowerUp.jpg', description: '+100% L/S & O/S' },
    { id: 'clickBoost', name: 'Click Power', duration: 30000, magnitude: 2.5, effectTarget: 'clicks', image: 'clickPowerUP.jpg', description: '+250% Click Value' },
    { id: 'moneyBoost', name: 'Revenue Surge', duration: 30000, magnitude: 1.0, effectTarget: 'mps', image: 'revenuePowerUp.jpg', description: '+100% M/S' },
    { id: 'cvrBoost', name: 'Value Boost', duration: 30000, magnitude: 5.0, effectTarget: 'cvr', image: 'valuePowerUp.jpg', description: '+500% CVR' }
];

// --- Music Playlist ---
export const playlist = [
    { name: "Batty McFaddin - Slower", filename: "Batty McFaddin - Slower.mp3" },
    { name: "Pixelland", filename: "Pixelland.mp3" },
    { name: "Disco con Tutti", filename: "Disco con Tutti.mp3" },
    { name: "Fox Tale Waltz Part 1 Instrumental", filename: "Fox Tale Waltz Part 1 Instrumental.mp3" },
    { name: "Mining by Moonlight", filename: "Mining by Moonlight.mp3" },
    { name: "Space Jazz", filename: "Space Jazz.mp3" },
    { name: "Surf Shimmy", filename: "Surf Shimmy.mp3" }
];

// --- Building & Upgrade Configurations ---
export const buildingsConfig = {
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
    aidata:         { baseCostLeads: 150000000, baseCostOpps: 150000000, costCurrency: 'both', baseLPS: 250000, baseOPS: 250000, name: "AI Data Cloud Fabric" }, // NEW
 };
export const upgradesConfig = {
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
    cvrBoostPercent2: { cost: 100000000, costCurrency: 'opportunities', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 1.50; }, description: "+50% CVR Multiplier"}, // NEW
    // --- Customer Driven Growth (REBALANCED v1.15) ---
    custGrowth1: { cost: 10, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.10; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.03); } },
    custGrowth2: { cost: 50, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.30; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); } },
    custGrowth3: { cost: 250, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 0.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 1.00; } },
    custGrowth4: { cost: 1000, costCurrency: 'customers', effect: (state) => { state.customerCostReductionMultiplier *= 0.90; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 1.00; } },
    custGrowth5: { cost: 5000, costCurrency: 'customers', effect: (state) => { state.custUpgradeBonusCAR += 1.00; state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.25; state.cvrCustomerMultiplier = (state.cvrCustomerMultiplier || 1.0) * 1.15; } },
    // --- Special Upgrades ---
    flexibleWorkflow: { costMoney: 10000, costCustomers: 100 },
 };