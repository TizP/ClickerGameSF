// js/config.js
"use strict";

// NOTE: Name, Flavour, and static effectDesc properties have been moved to ui_strings.json
//       Internal logic should rely on IDs. UI will fetch display text from the strings file.
//       Core mechanical properties (baseCost, costCurrency, baseLPS/OPS, multipliers, etc.) remain here.

export const GAME_VERSION = "v1.41-ui-strings"; // Version bump
export const SAVE_KEY = `salesforcePipelineSaveData_v${GAME_VERSION}`; // Updated key
export const FIRST_TIME_POPUP_KEY = `salesforcePipelineFirstTime_v${GAME_VERSION}`; // Key for first time popup flag
export const TICK_INTERVAL_MS = 100;
export const DISPLAY_UPDATE_INTERVAL_MS = 250;
export const BUTTON_UPDATE_INTERVAL_MS = 1000;
export const AUTO_SAVE_INTERVAL_MS = 30000;
export const STATS_UPDATE_INTERVAL_MS = 1000;
export const WIN_AMOUNT = 1_000_000_000;
export const BUILDING_COST_MULTIPLIER = 1.10; // Default multiplier
export const LEADS_PER_CUSTOMER_BASE = 100;
export const CUSTOMER_COST_MULTIPLIER = 1.005; // Lowered growth rate
export const MONEY_FORMAT_THRESHOLD = 10000;
export const FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD = 1;

// --- Powerup Constants ---
export const POWERUP_SPAWN_INTERVAL_MS = 10000;
export const POWERUP_CHANCE_PER_INTERVAL = 0.0333;
export const POWERUP_FALL_DURATION_MS = 8000;
export const POWERUP_SFX_CLICK_ID = 'sfx-powerup-click';
export const POWERUP_TOKEN_SIZE = 90;

// --- Powerup Configuration ---
// Names and descriptions moved to ui_strings.json
export const powerupTypes = [
    { id: 'prodBoost', duration: 30000, magnitude: 1.0, effectTarget: 'prod', image: 'pipelinePowerUp.jpg' },
    { id: 'clickBoost', duration: 30000, magnitude: 2.5, effectTarget: 'clicks', image: 'clickPowerUP.jpg' },
    { id: 'moneyBoost', duration: 30000, magnitude: 1.0, effectTarget: 'mps', image: 'revenuePowerUp.jpg' },
    { id: 'cvrBoost', duration: 30000, magnitude: 5.0, effectTarget: 'cvr', image: 'valuePowerUp.jpg' }
];

// --- Music Playlist ---
// Names moved to ui_strings.json? No, music name is displayed dynamically, keep here.
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
// NOTE: name, flavour, effectDesc (where purely static) properties removed.
//       UI will use the corresponding keys in ui_strings.json -> buildings -> [id] -> name/flavour/effectDescBase
export const buildingsConfig = {
    // Lead Gen
    sdr:            { baseCost: 10,     costCurrency: 'leads', baseLPS: 1 },
    webform:        { baseCost: 150,    costCurrency: 'leads', baseLPS: 10 },
    pardot:         { baseCost: 1500,   costCurrency: 'leads', baseLPS: 80 },
    nurture:        { baseCost: 10000,  costCurrency: 'leads', baseLPS: 400 },
    marketingcloud: { baseCost: 50000,  costCurrency: 'leads', baseLPS: 1500 },
    // Opp Gen
    bdr:            { baseCost: 10,     costCurrency: 'opportunities', baseOPS: 1 },
    qualbot:        { baseCost: 150,    costCurrency: 'opportunities', baseOPS: 10 },
    solutionengineer:{ baseCost: 1500,  costCurrency: 'opportunities', baseOPS: 80 },
    demospec:       { baseCost: 10000,  costCurrency: 'opportunities', baseOPS: 400 },
    proposaldesk:   { baseCost: 50000,  costCurrency: 'opportunities', baseOPS: 1500 },
    // Integrated Solutions
    integration:    { baseCostLeads: 50000,  baseCostOpps: 50000,  costCurrency: 'both', baseLPS: 1000, baseOPS: 1000 },
    platform:       { baseCostLeads: 250000, baseCostOpps: 250000, costCurrency: 'both', baseLPS: 4500, baseOPS: 4500 },
    ecosystem:      { baseCostLeads: 1000000,baseCostOpps: 1000000,costCurrency: 'both', baseLPS: 16500, baseOPS: 16500 },
    cloudsuite:     { baseCostLeads: 5000000,baseCostOpps: 5000000,costCurrency: 'both', baseLPS: 70000, baseOPS: 70000 },
    hyperscaler:    { baseCostLeads: 25000000,baseCostOpps: 25000000,costCurrency: 'both', baseLPS: 310000, baseOPS: 310000 },
    aidata:         { baseCostLeads: 150000000, baseCostOpps: 150000000, costCurrency: 'both', baseLPS: 1650000, baseOPS: 1650000 },
    // Customer Success (Keep core mechanics, static descriptions moved)
    acctManager: {
        baseCost: 1000000, costCurrency: 'money',
        // effectDesc: "-5% Acq. Cost", // Moved to ui_strings.json -> buildings -> acctManager -> effectDescBase
        costMultiplierOverride: 1.20
    },
    successArchitect: {
        baseCost: 1000000, costCurrency: 'money',
        // effectDesc: "+5% Base CVR per Arch. per 10 Int. Solns" // Moved to ui_strings.json -> buildings -> successArchitect -> effectDescBase
    },
    procurementOpt: {
        baseCost: 10000000, costCurrency: 'money',
        // effectDesc: "-5% Other Bldg Cost" // Moved to ui_strings.json -> buildings -> procurementOpt -> effectDescBase
    },
     successManager: {
         baseCost: 500000, costCurrency: 'money',
         // effectDesc: "+5% Base CVR", // Moved to ui_strings.json -> buildings -> successManager -> effectDescBase
         effectMultiplierCVR: 1.05 // Keep multiplier for calculation
     },
 };

// Tiered Upgrade Structure
// NOTE: name and description properties removed.
//       UI will use the corresponding keys in ui_strings.json -> upgrades -> [id] -> name/description
export const upgradesConfig = {
    manualGen: { // Category name handled by ui_strings.json -> panels -> manualGenCat
        tier1: {
            clickBoost1: { costLeads: 15, costOpps: 15, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 1; state.opportunitiesPerClick += 1; } },
            clickBoost2: { costLeads: 200, costOpps: 200, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 5; state.opportunitiesPerClick += 5; } },
            clickBoost3: { costLeads: 2500, costOpps: 2500, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 25; state.opportunitiesPerClick += 25; } },
            clickPercentBoost1: { costLeads: 1000, costOpps: 1000, costCurrency: 'both', effect: (state) => { state.leadClickPercentBonus += 0.01; state.oppClickPercentBonus += 0.01; } },
            clickPercentBoost2: { costLeads: 50000, costOpps: 50000, costCurrency: 'both', effect: (state) => { state.leadClickPercentBonus += 0.05; state.oppClickPercentBonus += 0.05; } },
        },
        tier2: {
            clickMastery: { costLeads: 500000, costOpps: 500000, costCurrency: 'both', effect: (state) => { state.globalClickMultiplier = (state.globalClickMultiplier || 1.0) * 2.0; } }
        }
    },
    leadTeamBoosts: {
        tier1: {
            sdrBoostMult:      { cost: 25000, costCurrency: 'leads', targetBuilding: 'sdr', multiplierBonusLPS: 3 },
            webformBoostMult:  { cost: 50000, costCurrency: 'leads', targetBuilding: 'webform', multiplierBonusLPS: 3 },
            pardotBoostMult:   { cost: 500000, costCurrency: 'leads', targetBuilding: 'pardot', multiplierBonusLPS: 3 },
            nurtureBoostMult:  { cost: 2000000, costCurrency: 'leads', targetBuilding: 'nurture', multiplierBonusLPS: 3 },
            mktCloudBoostMult: { cost: 5000000, costCurrency: 'leads', targetBuilding: 'marketingcloud', multiplierBonusLPS: 3 },
        },
        tier2: {
            leadGenSynergy: { cost: 50000000, costCurrency: 'leads', effect: (state) => { state.leadTeamMultiplier = (state.leadTeamMultiplier || 1.0) * 2.0; } },
            sdrSynergyBoost: { cost: 30000000, costCurrency: 'leads' } // Effect described in ui_strings, logic handled in engine
        }
    },
    oppTeamBoosts: {
        tier1: {
            bdrBoostMult:      { cost: 25000, costCurrency: 'opportunities', targetBuilding: 'bdr', multiplierBonusOPS: 3 },
            qualbotBoostMult:  { cost: 50000, costCurrency: 'opportunities', targetBuilding: 'qualbot', multiplierBonusOPS: 3 },
            solEngBoostMult:   { cost: 500000, costCurrency: 'opportunities', targetBuilding: 'solutionengineer', multiplierBonusOPS: 3 },
            demospecBoostMult: { cost: 2000000, costCurrency: 'opportunities', targetBuilding: 'demospec', multiplierBonusOPS: 3 },
            propDeskBoostMult: { cost: 5000000, costCurrency: 'opportunities', targetBuilding: 'proposaldesk', multiplierBonusOPS: 3 },
        },
        tier2: {
            oppGenSynergy: { cost: 50000000, costCurrency: 'opportunities', effect: (state) => { state.oppTeamMultiplier = (state.oppTeamMultiplier || 1.0) * 2.0; } },
            bdrSynergyBoost: { cost: 30000000, costCurrency: 'opportunities' } // Effect described in ui_strings, logic handled in engine
        }
    },
    integratedBoosts: {
        tier1: {
            integrationBoostPercent: { cost: 1000000, costCurrency: 'leads', targetBuilding: 'integration', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
            platformBoostPercent:    { cost: 5000000, costCurrency: 'opportunities', targetBuilding: 'platform', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
            ecosystemBoostPercent:   { cost: 15000000, costCurrency: 'leads', targetBuilding: 'ecosystem', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
            cloudsuiteBoostPercent:  { cost: 50000000, costCurrency: 'opportunities', targetBuilding: 'cloudsuite', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
            hyperscalerBoostPercent: { cost: 200000000, costCurrency: 'leads', targetBuilding: 'hyperscaler', percentBonusLPS: 0.20, percentBonusOPS: 0.20 },
        },
        tier2: {
            integratedMastery: { cost: 500000000, costCurrency: 'leads', effect: (state) => { state.integratedMultiplier = (state.integratedMultiplier || 1.0) * 1.75; } }
        }
    },
    pipelineEfficiency: {
        tier1: {
            efficiency1: { cost: 1000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.10; } },
            efficiency2: { cost: 10000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.15; } },
            efficiency3: { cost: 100000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.20; } },
            efficiency4: { cost: 1000000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.25; } },
            efficiency5: { cost: 5000000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.25; } },
        },
        tier2: {
            efficiencyMastery: { cost: 25000000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.50; } }
        }
    },
    acquisitionEnhancement: {
        tier1: {
            acqEnhance1: { costLeads: 10000, costOpps: 10000, costCurrency: 'both', effect: (state) => { state.baseCAR += 0.20; } },
            acqEnhance2: { costLeads: 50000, costOpps: 50000, costCurrency: 'both', effect: (state) => { state.baseCAR += 0.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); } },
            acqEnhance3: { costLeads: 250000, costOpps: 250000, costCurrency: 'both', effect: (state) => { state.baseCAR += 1.00; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.07); } },
        },
        tier2: {
            acqEnhanceMastery1: { cost: 5000000, costCurrency: 'opportunities', effect: (state) => { state.baseCAR += 2.00; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.15); } },
            acqEnhanceMastery2: { cost: 25000000, costCurrency: 'leads', effect: (state) => { state.baseCAR += 5.00; state.customerCostReductionMultiplier *= 0.67; } }
        }
    },
    acquisitionCost: { // Terminology
        tier1: {
            costReduct1: { cost: 5000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.90; } },
            costReduct2: { cost: 50000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.80; } },
            costReduct3: { cost: 300000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.70; } },
        },
        tier2: {
            costReductionMastery: { cost: 5000000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.50; } }
        }
    },
    customerValue: {
        tier1: {
            cvrBoost1:  { cost: 25000, costCurrency: 'leads', effect: (state) => { state.baseCVR += 1.00; } },
            cvrBoost2:  { cost: 300000, costCurrency: 'leads', effect: (state) => { state.baseCVR += 5.00; } },
            cvrBoost3:  { cost: 2000000, costCurrency: 'leads', effect: (state) => { state.baseCVR += 25.00; } },
            cvrBoostPercent: { cost: 15000000, costCurrency: 'leads', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 1.25; } },
            cvrBoostPercent2: { cost: 100000000, costCurrency: 'opportunities', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 1.50; } },
        },
        tier2: {
            cvrMastery: { cost: 500000000, costCurrency: 'leads', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 2.00; } }
        }
    },
     customerGrowth: {
        tier1: {
            custGrowth1: { requiresCustomers: 10, effect: (state) => { state.custUpgradeBonusCAR += 0.10; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.03); } },
            custGrowth2: { requiresCustomers: 50, effect: (state) => { state.custUpgradeBonusCAR += 0.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); } },
            custGrowth3: { requiresCustomers: 250, effect: (state) => { state.custUpgradeBonusCAR += 1.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 3.00; } },
            custGrowth4: { requiresCustomers: 1000, effect: (state) => { state.customerCostReductionMultiplier *= 0.85; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 7.00; } },
            custGrowth5: { requiresCustomers: 5000, effect: (state) => { state.customerCostReductionMultiplier *= 0.75; state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.25; state.cvrCustomerMultiplier = (state.cvrCustomerMultiplier || 1.0) * 1.25; } },
        },
        tier2: {
             custGrowthMastery: { requiresCustomers: 15000, effect: (state) => { state.custUpgradeBonusCAR += 2.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.customerCostReductionMultiplier *= 0.67; state.cvrCustomerMultiplier = (state.cvrCustomerMultiplier || 1.0) * 1.33; state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.33; } }
        }
    },
    special: { // Category name handled by ui_strings.json -> panels -> specialUpgradesCat
        costReductStrategic: {
            cost: 5000000, costCurrency: 'money',
            effect: (state) => { state.customerCostReductionMultiplier *= 0.25; }
        },
        playtimeMPSBoost: {
            costLeads: 100000000, costOpps: 100000000, costMoney: 10000000,
            costCurrency: 'all' // Effect described dynamically by UI using ui_strings data
        },
        flexibleWorkflow: {
             costMoney: 10000, costCustomers: 100 // Effect described by UI using ui_strings data
         },
    }
 };