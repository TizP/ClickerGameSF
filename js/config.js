// js/config.js
"use strict";

export const GAME_VERSION = "v1.40-arch-stack-nerf"; // Version bump
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
// Terminology Change: "Acq. Cost" used instead of "Customer Cost"
export const buildingsConfig = {
    // Lead Gen
    sdr:            { baseCost: 10,     costCurrency: 'leads', baseLPS: 1,    name: "SDR",                 flavour: "Sales Development Reps dial for dollars, finding initial interest."},
    webform:        { baseCost: 150,    costCurrency: 'leads', baseLPS: 10,   name: "Web Form",            flavour: "Automated web forms capture leads day and night."},
    pardot:         { baseCost: 1500,   costCurrency: 'leads', baseLPS: 80,   name: "Pardot Campaign",     flavour: "Pardot marketing automation nurtures prospects into leads."},
    nurture:        { baseCost: 10000,  costCurrency: 'leads', baseLPS: 400,  name: "Nurture Program",     flavour: "Automated Nurture Programs keep leads engaged and moving down the funnel."},
    marketingcloud: { baseCost: 50000,  costCurrency: 'leads', baseLPS: 1500, name: "Mkt Cloud Journey",   flavour: "Sophisticated Marketing Cloud Journeys guide potential customers."},
    // Opp Gen
    bdr:            { baseCost: 10,     costCurrency: 'opportunities', baseOPS: 1,    name: "BDR",                 flavour: "Business Development Reps qualify leads, turning interest into opportunities."},
    qualbot:        { baseCost: 150,    costCurrency: 'opportunities', baseOPS: 10,   name: "Qual Bot",            flavour: "AI-powered bots help qualify leads faster."},
    solutionengineer:{ baseCost: 1500,   costCurrency: 'opportunities', baseOPS: 80,   name: "Solution Engineer",   flavour: "Solution Engineers provide technical expertise, creating solid Opportunities."},
    demospec:       { baseCost: 10000,  costCurrency: 'opportunities', baseOPS: 400,  name: "Demo Specialist",     flavour: "Demo Specialists showcase product value, generating high-quality Opportunities."},
    proposaldesk:   { baseCost: 50000,  costCurrency: 'opportunities', baseOPS: 1500, name: "Proposal Desk",       flavour: "A dedicated team crafting winning proposals turns interest into Opportunities."},
    // Integrated Solutions
    integration:    { baseCostLeads: 50000,  baseCostOpps: 50000,  costCurrency: 'both', baseLPS: 1000,    baseOPS: 1000,    name: "Integration Hub",     flavour: "Connect systems seamlessly with MuleSoft, boosting pipeline flow."},
    platform:       { baseCostLeads: 250000, baseCostOpps: 250000, costCurrency: 'both', baseLPS: 4500,    baseOPS: 4500,    name: "Platform App",        flavour: "Develop custom apps on the platform, significantly increasing pipeline velocity."},
    ecosystem:      { baseCostLeads: 1000000,baseCostOpps: 1000000,costCurrency: 'both', baseLPS: 16500,   baseOPS: 16500,   name: "Partner Ecosystem",   flavour: "Leverage partners via Experience Cloud to vastly expand reach."},
    cloudsuite:     { baseCostLeads: 5000000,baseCostOpps: 5000000,costCurrency: 'both', baseLPS: 70000,   baseOPS: 70000,   name: "Cloud Suite",         flavour: "Offer a full suite of cloud products, attracting major pipeline volume."},
    hyperscaler:    { baseCostLeads: 25000000,baseCostOpps: 25000000,costCurrency: 'both', baseLPS: 310000,  baseOPS: 310000,  name: "Hyperscaler",         flavour: "Run on a global hyperscaler infrastructure for ultimate pipeline scalability."},
    aidata:         { baseCostLeads: 150000000, baseCostOpps: 150000000, costCurrency: 'both', baseLPS: 1650000, baseOPS: 1650000, name: "AI Data Cloud",     flavour: "Leverage AI across your data landscape for unprecedented pipeline insights."},
    // Customer Success
    acctManager: {
        baseCost: 1000000,
        costCurrency: 'money', name: "Acct Manager",
        flavour: "Account Managers improve retention and build relationships.",
        effectDesc: "-5% Acq. Cost", // Nerfed effect desc
        costMultiplierOverride: 1.20 // Added increased cost multiplier
    },
    successArchitect: { // MODIFIED HERE
        baseCost: 1000000, costCurrency: 'money', name: "Success Architect",
        flavour: "Success Architects ensure customers achieve their goals by leveraging integrations.",
        effectDesc: "+5% Base CVR per Arch. per 10 Int. Solns" // Updated effect description
    },
    procurementOpt: {
        baseCost: 10000000, costCurrency: 'money', name: "Procurement Opt.",
        flavour: "Optimizes internal spending, reducing operational overhead.",
        effectDesc: "-5% Other Bldg Cost" // Buffed effect desc
    },
     successManager: {
         baseCost: 500000, costCurrency: 'money', name: "Success Manager",
         flavour: "Dedicated managers focusing on customer health and value realization.",
         effectDesc: "+5% Base CVR", // Changed effect description
         effectMultiplierCVR: 1.05 // Store as multiplier for easier calculation
     },
 };

// Tiered Upgrade Structure
export const upgradesConfig = {
    manualGen: {
        name: "Manual Generation",
        tier1: {
            clickBoost1: { name: "Fundamental Clicking", costLeads: 15, costOpps: 15, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 1; state.opportunitiesPerClick += 1; }, description: "+1 L/Click, +1 O/Click" },
            clickBoost2: { name: "Certified Clicking", costLeads: 200, costOpps: 200, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 5; state.opportunitiesPerClick += 5; }, description: "+5 L/Click, +5 O/Click" },
            clickBoost3: { name: "Advanced Clicking Cert", costLeads: 2500, costOpps: 2500, costCurrency: 'both', effect: (state) => { state.leadsPerClick += 25; state.opportunitiesPerClick += 25; }, description: "+25 L/Click, +25 O/Click" },
            clickPercentBoost1: { name: "Pipeline Synergy Click", costLeads: 1000, costOpps: 1000, costCurrency: 'both', effect: (state) => { state.leadClickPercentBonus += 0.01; state.oppClickPercentBonus += 0.01; }, description: "+1% L/S & O/S per Click" },
            clickPercentBoost2: { name: "Automation-Linked Clicking", costLeads: 50000, costOpps: 50000, costCurrency: 'both', effect: (state) => { state.leadClickPercentBonus += 0.05; state.oppClickPercentBonus += 0.05; }, description: "+5% L/S & O/S per Click" },
        },
        tier2: {
            clickMastery: { name: "Click Mastery", costLeads: 500000, costOpps: 500000, costCurrency: 'both', effect: (state) => { state.globalClickMultiplier = (state.globalClickMultiplier || 1.0) * 2.0; }, description: "x2 Manual Click Effectiveness" }
        }
    },
    leadTeamBoosts: {
        name: "Lead Team Boosts",
        tier1: {
            sdrBoostMult:      { name: "SDR Motivation Program", cost: 25000, costCurrency: 'leads', targetBuilding: 'sdr', multiplierBonusLPS: 3, description: "x3 Output per SDR" },
            webformBoostMult:  { name: "Optimized Web Forms", cost: 50000, costCurrency: 'leads', targetBuilding: 'webform', multiplierBonusLPS: 3, description: "x3 Output per Web Form" },
            pardotBoostMult:   { name: "Engagement Studio Mastery", cost: 500000, costCurrency: 'leads', targetBuilding: 'pardot', multiplierBonusLPS: 3, description: "x3 Output per Pardot Campaign" },
            nurtureBoostMult:  { name: "Hyper-Personalization", cost: 2000000, costCurrency: 'leads', targetBuilding: 'nurture', multiplierBonusLPS: 3, description: "x3 Output per Nurture Program" },
            mktCloudBoostMult: { name: "Journey Builder AI", cost: 5000000, costCurrency: 'leads', targetBuilding: 'marketingcloud', multiplierBonusLPS: 3, description: "x3 Output per Mkt Cloud Journey" },
        },
        tier2: {
            leadGenSynergy: { name: "Lead Generation Synergy", cost: 50000000, costCurrency: 'leads', effect: (state) => { state.leadTeamMultiplier = (state.leadTeamMultiplier || 1.0) * 2.0; }, description: "x2 Output for ALL Lead Teams" },
            sdrSynergyBoost: { name: "SDR Team Leadership", cost: 30000000, costCurrency: 'leads', description: "+1% Output to other Lead buildings per 10 SDRs" }
        }
    },
    oppTeamBoosts: {
        name: "Opportunity Team Boosts",
        tier1: {
            bdrBoostMult:      { name: "Advanced Prospecting Tools", cost: 25000, costCurrency: 'opportunities', targetBuilding: 'bdr', multiplierBonusOPS: 3, description: "x3 Output per BDR" },
            qualbotBoostMult:  { name: "Einstein Next Best Action", cost: 50000, costCurrency: 'opportunities', targetBuilding: 'qualbot', multiplierBonusOPS: 3, description: "x3 Output per Qual Bot" },
            solEngBoostMult:   { name: "Custom Demo Environments", cost: 500000, costCurrency: 'opportunities', targetBuilding: 'solutionengineer', multiplierBonusOPS: 3, description: "x3 Output per Solution Engineer" },
            demospecBoostMult: { name: "Interactive Demo Platform", cost: 2000000, costCurrency: 'opportunities', targetBuilding: 'demospec', multiplierBonusOPS: 3, description: "x3 Output per Demo Specialist" },
            propDeskBoostMult: { name: "AI Proposal Generation", cost: 5000000, costCurrency: 'opportunities', targetBuilding: 'proposaldesk', multiplierBonusOPS: 3, description: "x3 Output per Proposal Desk" },
        },
        tier2: {
            oppGenSynergy: { name: "Opportunity Generation Synergy", cost: 50000000, costCurrency: 'opportunities', effect: (state) => { state.oppTeamMultiplier = (state.oppTeamMultiplier || 1.0) * 2.0; }, description: "x2 Output for ALL Opportunity Teams" },
            bdrSynergyBoost: { name: "BDR Team Mentorship", cost: 30000000, costCurrency: 'opportunities', description: "+1% Output to other Opportunity buildings per 10 BDRs" }
        }
    },
    integratedBoosts: {
        name: "Integrated Solution Boosts",
        tier1: {
            integrationBoostPercent: { name: "MuleSoft Synergy", cost: 1000000, costCurrency: 'leads', targetBuilding: 'integration', percentBonusLPS: 0.20, percentBonusOPS: 0.20, description: "+20% Output per Integration Hub" },
            platformBoostPercent:    { name: "LWC Performance Tuning", cost: 5000000, costCurrency: 'opportunities', targetBuilding: 'platform', percentBonusLPS: 0.20, percentBonusOPS: 0.20, description: "+20% Output per Platform App" },
            ecosystemBoostPercent:   { name: "Partner Portal Optimization", cost: 15000000, costCurrency: 'leads', targetBuilding: 'ecosystem', percentBonusLPS: 0.20, percentBonusOPS: 0.20, description: "+20% Output per Ecosystem" },
            cloudsuiteBoostPercent:  { name: "Cross-Cloud Integration", cost: 50000000, costCurrency: 'opportunities', targetBuilding: 'cloudsuite', percentBonusLPS: 0.20, percentBonusOPS: 0.20, description: "+20% Output per Cloud Suite" },
            hyperscalerBoostPercent: { name: "Global Infrastructure Scaling", cost: 200000000, costCurrency: 'leads', targetBuilding: 'hyperscaler', percentBonusLPS: 0.20, percentBonusOPS: 0.20, description: "+20% Output per Hyperscaler Instance" },
        },
        tier2: {
            integratedMastery: { name: "Integrated Solution Mastery", cost: 500000000, costCurrency: 'leads', effect: (state) => { state.integratedMultiplier = (state.integratedMultiplier || 1.0) * 1.75; }, description: "x1.75 Output for ALL Integrated Solutions" }
        }
    },
    pipelineEfficiency: {
        name: "Pipeline Efficiency",
        tier1: {
            efficiency1: { name: "Team Huddle", cost: 1000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.10; }, description: "+10% Team/Feature Output" },
            efficiency2: { name: "Cross-Functional Synergy", cost: 10000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.15; }, description: "+15% Team/Feature Output" },
            efficiency3: { name: "AI-Powered Insights", cost: 100000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.20; }, description: "+20% Team/Feature Output" },
            efficiency4: { name: "Global Process Optimization", cost: 1000000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.25; }, description: "+25% Team/Feature Output" },
            efficiency5: { name: "Hyperforce Scaling", cost: 5000000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.25; }, description: "+25% Team/Feature Output" },
        },
        tier2: {
            efficiencyMastery: { name: "Efficiency Mastery", cost: 25000000, costCurrency: 'money', effect: (state) => { state.buildingEfficiencyMultiplier += 0.50; }, description: "+50% Team/Feature Output" }
        }
    },
    acquisitionEnhancement: {
        name: "Acquisition Enhancement",
        tier1: {
            acqEnhance1: { name: "Basic Closing Tactics", costLeads: 10000, costOpps: 10000, costCurrency: 'both', effect: (state) => { state.baseCAR += 0.20; }, description: "+0.20 Acq. Rate/s" },
            acqEnhance2: { name: "Advanced Sales Cadence", costLeads: 50000, costOpps: 50000, costCurrency: 'both', effect: (state) => { state.baseCAR += 0.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); }, description: "+0.50 Acq. Rate/s, +5% Success" },
            acqEnhance3: { name: "Optimized Sales Playbook", costLeads: 250000, costOpps: 250000, costCurrency: 'both', effect: (state) => { state.baseCAR += 1.00; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.07); }, description: "+1.00 Acq. Rate/s, +7% Success" },
        },
        tier2: {
            acqEnhanceMastery1: { name: "Master Closer Program", cost: 5000000, costCurrency: 'opportunities', effect: (state) => { state.baseCAR += 2.00; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.15); }, description: "+2.00 Acq. Rate/s, +15% Acq. Success" },
            acqEnhanceMastery2: { name: "Deal Velocity Engine", cost: 25000000, costCurrency: 'leads', effect: (state) => { state.baseCAR += 5.00; state.customerCostReductionMultiplier *= 0.67; }, description: "+5.00 Acq. Rate/s, -33% Acquisition Cost" } // Terminology
        }
    },
    acquisitionCost: { // Terminology
        name: "Acquisition Cost Reduction",
        tier1: {
            costReduct1: { name: "Lead Qual. Refinement", cost: 5000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.90; }, description: "-10% Acquisition Cost" }, // Terminology
            costReduct2: { name: "ICP Tuning", cost: 50000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.80; }, description: "-20% Acquisition Cost" }, // Terminology
            costReduct3: { name: "Targeted Marketing Segments", cost: 300000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.70; }, description: "-30% Acquisition Cost" }, // Terminology
        },
        tier2: {
            costReductionMastery: { name: "Acquisition Cost Mastery", cost: 5000000, costCurrency: 'leads', effect: (state) => { state.customerCostReductionMultiplier *= 0.50; }, description: "-50% Acquisition Cost" } // Terminology
        }
    },
    customerValue: {
        name: "Customer Value Rate",
        tier1: {
            cvrBoost1:  { name: "Customer Onboarding", cost: 25000, costCurrency: 'leads', effect: (state) => { state.baseCVR += 1.00; }, description: "+$1.00 Value Rate" },
            cvrBoost2:  { name: "Enhanced Support Tier", cost: 300000, costCurrency: 'leads', effect: (state) => { state.baseCVR += 5.00; }, description: "+$5.00 Value Rate" },
            cvrBoost3:  { name: "Dedicated CSM Program", cost: 2000000, costCurrency: 'leads', effect: (state) => { state.baseCVR += 25.00; }, description: "+$25.00 Value Rate" },
            cvrBoostPercent: { name: "Premier Success Plan", cost: 15000000, costCurrency: 'leads', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 1.25; }, description: "+25% Value Rate" },
            cvrBoostPercent2: { name: "Signature Success Plan", cost: 100000000, costCurrency: 'opportunities', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 1.50; }, description: "+50% Value Rate"},
        },
        tier2: {
            cvrMastery: { name: "Customer Value Mastery", cost: 500000000, costCurrency: 'leads', effect: (state) => { state.cvrMultiplierBonus = (state.cvrMultiplierBonus || 1.0) * 2.00; }, description: "x2 Value Rate" }
        }
    },
     customerGrowth: {
        name: "Customer Driven Growth",
        tier1: {
            custGrowth1: { name: "Loyal Customer Referrals", requiresCustomers: 10, effect: (state) => { state.custUpgradeBonusCAR += 0.10; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.03); }, description: "+0.1 Acq Rate/s, +3% Success" },
            custGrowth2: { name: "Customer Advisory Board", requiresCustomers: 50, effect: (state) => { state.custUpgradeBonusCAR += 0.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.05); }, description: "+0.5 Acq Rate/s, +5% Success" },
            custGrowth3: { name: "Voice of Customer Program", requiresCustomers: 250, effect: (state) => { state.custUpgradeBonusCAR += 1.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 3.00; }, description: "+1.5 Acq Rate/s, +10% Success, +$3 CVR" },
            custGrowth4: { name: "Strategic Account Management", requiresCustomers: 1000, effect: (state) => { state.customerCostReductionMultiplier *= 0.85; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.custUpgradeBonusCVR += 7.00; }, description: "-15% Acq Cost, +10% Success, +$7 CVR" }, // Terminology
            custGrowth5: { name: "Community Champion Program", requiresCustomers: 5000, effect: (state) => { state.customerCostReductionMultiplier *= 0.75; state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.25; state.cvrCustomerMultiplier = (state.cvrCustomerMultiplier || 1.0) * 1.25; }, description: "-25% Acq Cost, +25% Output, +25% CVR" }, // Terminology
        },
        tier2: {
             custGrowthMastery: { name: "Customer Growth Mastery", requiresCustomers: 15000, effect: (state) => { state.custUpgradeBonusCAR += 2.50; state.acquisitionSuccessChance = Math.min(1.0, state.acquisitionSuccessChance + 0.10); state.customerCostReductionMultiplier *= 0.67; state.cvrCustomerMultiplier = (state.cvrCustomerMultiplier || 1.0) * 1.33; state.custGlobalMultiplier = (state.custGlobalMultiplier || 1.0) * 1.33; }, description: "+2.5 CAR, +10% Success, -33% Cost, +33% CVR, +33% Output" } // Cost terminology ok here? Assume yes.
        }
    },
    special: {
        name: "Special Upgrades",
        costReductStrategic: {
            name: "Strategic Cost Optimization",
            cost: 5000000, costCurrency: 'money',
            effect: (state) => { state.customerCostReductionMultiplier *= 0.25; }, // Buffed effect (1 - 0.75 = 0.25)
            description: "-75% Acq. Cost" // Buffed description & Terminology
        },
        playtimeMPSBoost: {
            name: "Veteran Pipeline Operator",
            costLeads: 100000000, // New cost
            costOpps: 100000000, // New cost
            costMoney: 10000000, // New cost
            costCurrency: 'all', // Custom flag to indicate all 3 are needed
            description: "Increases MPS by +100% per hour played (capped at +200% after 2 hours)."
        },
        flexibleWorkflow: {
             name: "Flexible Workflow",
             costMoney: 10000,
             costCustomers: 100, // Use requiresCustomers instead? Keep as cost for now.
             description: "Enables Workflow Toggle"
         },
    }
 };