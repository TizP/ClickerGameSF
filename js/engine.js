// js/engine.js
"use strict";
import { gameState, isGamePaused, isGameWon, setGamePaused } from './state.js';
import { buildingsConfig, upgradesConfig, FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD, LEADS_PER_CUSTOMER_BASE, CUSTOMER_COST_MULTIPLIER, BUILDING_COST_MULTIPLIER, TICK_INTERVAL_MS, WIN_AMOUNT } from './config.js';
import { triggerWin, updateButtonStates, updateFlexibleWorkflowToggleButtonVisuals } from './ui.js';
import { formatPercent } from './utils.js';

// --- Derived State Variables (Module-Scoped) ---
let currentRates = {
    leadsPerSecond: 0,
    opportunitiesPerSecond: 0,
    customerAcquisitionRate: 0,
    customerValueRate: 0,
    moneyPerSecond: 0,
    currentAcctManagerCostReduction: 1.0,
    currentSuccessArchitectCVRBonus: 0, // This will now store the total % bonus (e.g., 0.15 for +15%)
    currentProcurementOptCostReduction: 1.0,
    currentSuccessManagerCVRMultiplier: 1.0, // Add multiplier for Success Manager
};
let accumulatedAcquisitionAttempts = 0.0;

// --- Helper Function to Find Upgrade Config by ID ---
export function findUpgradeConfigById(upgradeId) {
    for (const categoryId in upgradesConfig) {
        const category = upgradesConfig[categoryId];
        if (categoryId === 'special') {
            if (category[upgradeId]) {
                return { config: category[upgradeId], categoryId: categoryId, tier: null };
            }
        } else {
            if (category.tier1 && category.tier1[upgradeId]) {
                return { config: category.tier1[upgradeId], categoryId: categoryId, tier: 1 };
            }
            if (category.tier2 && category.tier2[upgradeId]) {
                return { config: category.tier2[upgradeId], categoryId: categoryId, tier: 2 };
            }
        }
    }
    return null;
}

// --- Dynamic Cost Calculation ---
export function getBuildingCost(id) {
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state) return { leads: Infinity, opps: Infinity, money: Infinity };
    const count = state.count || 0;
    const costMultiplier = (id === 'acctManager' && cfg.costMultiplierOverride)
        ? cfg.costMultiplierOverride
        : BUILDING_COST_MULTIPLIER;

    let baseCostLeads = cfg.baseCostLeads || 0;
    let baseCostOpps = cfg.baseCostOpps || 0;
    let baseCostMoney = cfg.baseCost || 0; // Use baseCost for single currency buildings

    let calculatedCostLeads = 0;
    let calculatedCostOpps = 0;
    let calculatedCostMoney = 0;

    if (cfg.costCurrency === 'both') {
        calculatedCostLeads = Math.ceil(baseCostLeads * Math.pow(costMultiplier, count));
        calculatedCostOpps = Math.ceil(baseCostOpps * Math.pow(costMultiplier, count));
    } else if (cfg.costCurrency === 'leads') {
        calculatedCostLeads = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count)); // Use baseCost here
    } else if (cfg.costCurrency === 'opportunities') {
        calculatedCostOpps = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count)); // Use baseCost here
    } else if (cfg.costCurrency === 'money') {
        calculatedCostMoney = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count)); // Use baseCost here
    } else {
        console.error(`Unknown costCurrency '${cfg.costCurrency}' for building ${id}`);
        return { leads: Infinity, opps: Infinity, money: Infinity };
    }
    // Apply Procurement Opt reduction (if applicable)
    if (id !== 'procurementOpt') {
        const reductionMultiplier = gameState.otherBuildingCostMultiplier || 1.0;
        calculatedCostLeads = Math.ceil(calculatedCostLeads * reductionMultiplier);
        calculatedCostOpps = Math.ceil(calculatedCostOpps * reductionMultiplier);
        calculatedCostMoney = Math.ceil(calculatedCostMoney * reductionMultiplier);
    }
    return {
        leads: Math.max(1, calculatedCostLeads),
        opps: Math.max(1, calculatedCostOpps),
        money: Math.max(1, calculatedCostMoney)
    };
}

// Calculate the cumulative cost for buying multiple buildings
export function getCumulativeBuildingCost(id, quantity) {
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state || quantity <= 0) return { leads: Infinity, opps: Infinity, money: Infinity };

    const currentCount = state.count || 0;
    const costMultiplier = (id === 'acctManager' && cfg.costMultiplierOverride)
        ? cfg.costMultiplierOverride
        : BUILDING_COST_MULTIPLIER; // Use override here too
    const reductionMultiplier = (id !== 'procurementOpt') ? (gameState.otherBuildingCostMultiplier || 1.0) : 1.0;

    let totalCostLeads = 0;
    let totalCostOpps = 0;
    let totalCostMoney = 0;

    for (let i = 0; i < quantity; i++) {
        const countForThisPurchase = currentCount + i;
        let baseCostLeads = cfg.baseCostLeads || 0;
        let baseCostOpps = cfg.baseCostOpps || 0;
        let baseCostMoney = cfg.baseCost || 0; // Use baseCost for single currency

        let costLeads = 0;
        let costOpps = 0;
        let costMoney = 0;

        if (cfg.costCurrency === 'both') {
            costLeads = Math.ceil(baseCostLeads * Math.pow(costMultiplier, countForThisPurchase));
            costOpps = Math.ceil(baseCostOpps * Math.pow(costMultiplier, countForThisPurchase));
        } else if (cfg.costCurrency === 'leads') {
            costLeads = Math.ceil(baseCostMoney * Math.pow(costMultiplier, countForThisPurchase)); // Use baseCost
        } else if (cfg.costCurrency === 'opportunities') {
            costOpps = Math.ceil(baseCostMoney * Math.pow(costMultiplier, countForThisPurchase)); // Use baseCost
        } else if (cfg.costCurrency === 'money') {
            costMoney = Math.ceil(baseCostMoney * Math.pow(costMultiplier, countForThisPurchase)); // Use baseCost
        }

        costLeads = Math.ceil(costLeads * reductionMultiplier);
        costOpps = Math.ceil(costOpps * reductionMultiplier);
        costMoney = Math.ceil(costMoney * reductionMultiplier);

        totalCostLeads += Math.max(1, costLeads);
        totalCostOpps += Math.max(1, costOpps);
        totalCostMoney += Math.max(1, costMoney);
    }

    return {
        leads: totalCostLeads,
        opps: totalCostOpps,
        money: totalCostMoney
    };
}


export function getUpgradeCost(id) {
    const found = findUpgradeConfigById(id);
    if (!found) return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity, requiresCustomers: Infinity };
    const cfg = found.config;

    // Check for requiresCustomers first (for Customer Growth upgrades)
    if (cfg.requiresCustomers) {
        return { requiresCustomers: cfg.requiresCustomers || 0, leads: 0, opps: 0, money: 0, customers: 0 };
    }
    // Handle Veteran Pipeline Operator special cost
    if (id === 'playtimeMPSBoost' && cfg.costCurrency === 'all') {
         return {
             leads: cfg.costLeads || 0,
             opps: cfg.costOpps || 0,
             money: cfg.costMoney || 0,
             customers: 0, // No customer cost/req
         }
    }

    // Handle Flexible Workflow special cost (Money + Customers)
    if (id === 'flexibleWorkflow' && cfg.costMoney && cfg.costCustomers) {
         return { money: cfg.costMoney || 0, customers: cfg.costCustomers || 0, leads: 0, opps: 0 };
    }

    // Standard cost logic
    if (cfg.costCurrency === 'both') {
        return { leads: cfg.costLeads || 0, opps: cfg.costOpps || 0, money: 0, customers: 0 };
    }
    if (cfg.costCurrency === 'leads') {
        return { leads: cfg.cost || 0, opps: 0, money: 0, customers: 0 };
    } else if (cfg.costCurrency === 'opportunities') {
        return { leads: 0, opps: cfg.cost || 0, money: 0, customers: 0 };
    } else if (cfg.costCurrency === 'money') {
        // Applies to Strategic Cost Opt
        return { money: cfg.cost || 0, leads: 0, opps: 0, customers: 0 };
    } else if (cfg.costCurrency === 'customers') { // Likely deprecated
        console.warn(`Upgrade ${id} uses deprecated 'costCurrency: customers'.`);
        return { customers: cfg.cost || 0, leads: 0, opps: 0, money: 0 };
    }

    console.warn(`Could not determine cost structure for upgrade: ${id}`);
    return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity, requiresCustomers: Infinity };
}


// Terminology Change: Renamed function & used "Acquisition"
export function getCurrentAcquisitionCost() {
    const base = LEADS_PER_CUSTOMER_BASE;
    const count = gameState.customerCountForCostIncrease || 0;
    const costMult = CUSTOMER_COST_MULTIPLIER;
    const upgradeReductMult = gameState.customerCostReductionMultiplier || 1.0; // Affected by Strategic Cost Opt & others
    const acctManagerReductMult = currentRates.currentAcctManagerCostReduction; // Affected by Acct Managers
    const finalReductMult = upgradeReductMult * acctManagerReductMult;
    const calculatedCost = base * Math.pow(costMult, count) * finalReductMult;
    return Math.max(1, Math.ceil(calculatedCost));
}

// --- Core Calculation Function ---
export function calculateDerivedStats() {
    // Calculate effects of Customer Success Buildings FIRST
    const acctManagerCount = gameState.buildings['acctManager']?.count || 0;
    const successArchitectCount = gameState.buildings['successArchitect']?.count || 0;
    const procurementOptCount = gameState.buildings['procurementOpt']?.count || 0;
    const successManagerCount = gameState.buildings['successManager']?.count || 0;

    // Procurement Opt calculation (-5%)
    const procurementReduction = Math.pow(0.95, procurementOptCount);
    gameState.otherBuildingCostMultiplier = procurementReduction;
    currentRates.currentProcurementOptCostReduction = procurementReduction;

    // Acct Manager calculation (-5%)
    const acctManagerReduction = Math.pow(0.95, acctManagerCount);
    currentRates.currentAcctManagerCostReduction = acctManagerReduction;

    // Success Architect calculation (+5% per Arch per 10) - MODIFIED HERE
    let integratedBuildingCount = 0;
    const integratedBuildingIds = ['integration', 'platform', 'ecosystem', 'cloudsuite', 'hyperscaler', 'aidata'];
    integratedBuildingIds.forEach(id => {
        integratedBuildingCount += gameState.buildings[id]?.count || 0;
    });
    const integratedBlocks = Math.floor(integratedBuildingCount / 10);
    const successArchitectCVRBonusPercent = successArchitectCount * integratedBlocks * 0.05; // Nerfed to 5% and now includes Architect count
    currentRates.currentSuccessArchitectCVRBonus = successArchitectCVRBonusPercent; // Store the total bonus percentage

    // Calculate Success Manager CVR Multiplier (+5% each)
    const successManagerMultiplier = buildingsConfig.successManager?.effectMultiplierCVR
        ? Math.pow(buildingsConfig.successManager.effectMultiplierCVR, successManagerCount)
        : 1.0;
    currentRates.currentSuccessManagerCVRMultiplier = successManagerMultiplier;

    // Standard calculations
    let rawLPS = 0, rawOPS = 0;
    let workingCAR = gameState.baseCAR || 0.1;
    let workingCVR = gameState.baseCVR || 1.0;

    // Apply BASE CVR bonuses BEFORE multipliers
    // MODIFIED HERE: Apply the calculated TOTAL bonus percentage
    workingCVR *= (1 + successArchitectCVRBonusPercent);

    // Apply Multipliers
    const globalEff = gameState.buildingEfficiencyMultiplier || 1.0;
    const custGlobalMult = gameState.custGlobalMultiplier || 1.0;
    const leadTeamMult = gameState.leadTeamMultiplier || 1.0;
    const oppTeamMult = gameState.oppTeamMultiplier || 1.0;
    const integratedMult = gameState.integratedMultiplier || 1.0;
    const isSdrSynergyActive = gameState.upgrades['sdrSynergyBoost']?.purchased;
    const isBdrSynergyActive = gameState.upgrades['bdrSynergyBoost']?.purchased;
    const sdrCount = gameState.buildings['sdr']?.count || 0;
    const bdrCount = gameState.buildings['bdr']?.count || 0;
    const leadSynergyBonusPercent = isSdrSynergyActive ? Math.floor(sdrCount / 10) * 0.01 : 0;
    const oppSynergyBonusPercent = isBdrSynergyActive ? Math.floor(bdrCount / 10) * 0.01 : 0;

    // Building production loop
    for (const id in buildingsConfig) {
        // Exclude all non-producing Customer Success buildings
        if (['acctManager', 'successArchitect', 'procurementOpt', 'successManager'].includes(id)) continue;
        const cfg = buildingsConfig[id];
        const count = gameState.buildings[id]?.count || 0;
        if (count > 0) {
            let bLPS = cfg.baseLPS || 0, bOPS = cfg.baseOPS || 0;
            let fLPS = 0, fOPS = 0, pLPS = 1.0, pOPS = 1.0, mLPS = 1.0, mOPS = 1.0;
             for (const upId in gameState.upgrades) {
                 if (!gameState.upgrades[upId]?.purchased) continue;
                 const found = findUpgradeConfigById(upId);
                 if (found && found.config.targetBuilding === id) {
                     const uCfg = found.config;
                     if(uCfg.flatBonusLPS) fLPS += uCfg.flatBonusLPS; if(uCfg.flatBonusOPS) fOPS += uCfg.flatBonusOPS;
                     if(uCfg.percentBonusLPS) pLPS += uCfg.percentBonusLPS; if(uCfg.percentBonusOPS) pOPS += uCfg.percentBonusOPS;
                     if(uCfg.multiplierBonusLPS) mLPS *= uCfg.multiplierBonusLPS; if(uCfg.multiplierBonusOPS) mOPS *= uCfg.multiplierBonusOPS;
                 }
             }
            let finLPS = (bLPS + fLPS) * pLPS * mLPS;
            let finOPS = (bOPS + fOPS) * pOPS * mOPS;
            if (leadSynergyBonusPercent > 0 && id !== 'sdr' && ['webform', 'pardot', 'nurture', 'marketingcloud'].includes(id)) finLPS *= (1 + leadSynergyBonusPercent);
            if (oppSynergyBonusPercent > 0 && id !== 'bdr' && ['qualbot', 'solutionengineer', 'demospec', 'proposaldesk'].includes(id)) finOPS *= (1 + oppSynergyBonusPercent);
            finLPS *= globalEff * custGlobalMult;
            finOPS *= globalEff * custGlobalMult;
            if (['sdr', 'webform', 'pardot', 'nurture', 'marketingcloud'].includes(id)) finLPS *= leadTeamMult;
            if (['bdr', 'qualbot', 'solutionengineer', 'demospec', 'proposaldesk'].includes(id)) finOPS *= oppTeamMult;
            if (['integration', 'platform', 'ecosystem', 'cloudsuite', 'hyperscaler', 'aidata'].includes(id)){
                finLPS *= integratedMult;
                finOPS *= integratedMult;
             }
            rawLPS += finLPS * count;
            rawOPS += finOPS * count;
        }
    }

    // Flexible Workflow Logic
    let finalLPS = rawLPS; let finalOPS = rawOPS;
    if (gameState.flexibleWorkflowActive) {
        const currentLeads = Math.floor(gameState.leads);
        const currentOpps = Math.floor(gameState.opportunities);
        const diff = currentLeads - currentOpps;
        // Only activate if difference is significant enough (relative to threshold)
        if (Math.abs(diff) > FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
            if (diff < 0) { // Less Leads than Opps
                const transfer = Math.max(0, rawOPS * 0.5);
                if (!isNaN(transfer) && isFinite(transfer)) {
                    finalLPS = rawLPS + transfer;
                    finalOPS = rawOPS - transfer;
                }
            } else { // More Leads than Opps (or equal, but we checked threshold)
                const transfer = Math.max(0, rawLPS * 0.5);
                if (!isNaN(transfer) && isFinite(transfer)) {
                    finalLPS = rawLPS - transfer;
                    finalOPS = rawOPS + transfer;
                }
            }
        } else {
            // If difference is too small, deactivate workflow
             gameState.flexibleWorkflowActive = false;
             console.log("Flexible Workflow automatically deactivated (amounts near equal).");
             updateFlexibleWorkflowToggleButtonVisuals(); // Update button state
        }
    }
    finalLPS = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
    finalOPS = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;

    // Production Boost Powerup
    const prodBoost = gameState.activeBoosts?.['prodBoost'];
    if (prodBoost) { const mult = 1.0 + prodBoost.magnitude; finalLPS *= mult; finalOPS *= mult; }

    // Apply Customer Growth flat bonuses AFTER initial calculations
    workingCAR += gameState.custUpgradeBonusCAR || 0;
    workingCVR += gameState.custUpgradeBonusCVR || 0; // Apply flat CVR bonus from Cust Growth

    // Apply ALL CVR Multipliers at the end
    workingCVR *= (gameState.cvrMultiplierBonus || 1.0); // From CVR upgrades
    workingCVR *= (gameState.cvrCustomerMultiplier || 1.0); // From Cust Growth multiplier upgrades
    workingCVR *= currentRates.currentSuccessManagerCVRMultiplier; // Apply Success Manager Multiplier

    // CVR Powerup (applied last multiplier)
    const cvrBoost = gameState.activeBoosts?.['cvrBoost'];
    if (cvrBoost) { const mult = 1.0 + cvrBoost.magnitude; workingCVR *= mult; }

    // Money Per Second calculation
    let baseMPS = (gameState.customers || 0) * workingCVR;
    // Apply Playtime Boost if purchased
    if (gameState.upgrades['playtimeMPSBoost']?.purchased) {
        const PLAYTIME_CAP_HOURS = 2.0;
        const MAX_BONUS_MULTIPLIER = 3.0; // 1.0 base + 200% bonus = 3.0 multiplier
        const elapsedMs = Date.now() - (gameState.gameStartTime || Date.now());
        const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));
        const progressToCap = Math.min(1.0, elapsedHours / PLAYTIME_CAP_HOURS);
        const currentMultiplier = 1.0 + ((MAX_BONUS_MULTIPLIER - 1.0) * progressToCap);
        baseMPS *= currentMultiplier;
    }
    let finalMPS = baseMPS;
    // Apply Money Boost powerup
    const moneyBoost = gameState.activeBoosts?.['moneyBoost'];
    if (moneyBoost) { finalMPS *= (1.0 + moneyBoost.magnitude); }

    // Final Rate Assignment
    const leadsPerSecond = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
    const opportunitiesPerSecond = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;
    const customerAcquisitionRate = (!isNaN(workingCAR) && isFinite(workingCAR)) ? Math.max(0, workingCAR) : 0;
    const customerValueRate = (!isNaN(workingCVR) && isFinite(workingCVR)) ? Math.max(0, workingCVR) : 0;
    const moneyPerSecond = (!isNaN(finalMPS) && isFinite(finalMPS)) ? Math.max(0, finalMPS) : 0;

    // Update the globally accessible rates object
    currentRates = {
        ...currentRates, // Keep existing CS building effects like cost reductions
        leadsPerSecond, opportunitiesPerSecond,
        customerAcquisitionRate, customerValueRate, moneyPerSecond
    };
}

// Game Loop
export function gameLoop() {
    if (isGamePaused || isGameWon) return;
    const secs = TICK_INTERVAL_MS / 1000.0;
    calculateDerivedStats(); // Recalculate rates each tick

    // Generate resources
    const lTick = currentRates.leadsPerSecond * secs;
    const oTick = currentRates.opportunitiesPerSecond * secs;
    if (!isNaN(lTick) && isFinite(lTick) && lTick > 0) { gameState.leads += lTick; gameState.totalAutoLeads += lTick; }
    if (!isNaN(oTick) && isFinite(oTick) && oTick > 0) { gameState.opportunities += oTick; gameState.totalAutoOpps += oTick; }

    // Attempt Acquisition if not paused
    if (!gameState.isAcquisitionPaused) {
        const cost = getCurrentAcquisitionCost(); // Use renamed function
        const currentCAR = currentRates.customerAcquisitionRate;
        let attemptsThisTick = (currentCAR * secs) + accumulatedAcquisitionAttempts;
        let attemptsToMake = Math.floor(attemptsThisTick);
        accumulatedAcquisitionAttempts = attemptsThisTick - attemptsToMake; // Store leftover fraction

        if (!isNaN(attemptsToMake) && attemptsToMake > 0) {
            for (let i = 0; i < attemptsToMake; i++) {
                if (gameState.leads >= cost && gameState.opportunities >= cost) {
                    gameState.totalAcquisitionAttempts++;
                    gameState.leads -= cost;
                    gameState.opportunities -= cost;
                    if (Math.random() < gameState.acquisitionSuccessChance) {
                        gameState.totalSuccessfulAcquisitions++;
                        gameState.customerCountForCostIncrease++; // Increment counter that drives cost up
                        gameState.customers++;
                    } else {
                        // Failed attempt - resources already spent
                    }
                } else {
                    accumulatedAcquisitionAttempts += (attemptsToMake - i); // Add back attempts that couldn't be made due to insufficient resources
                    break; // Stop trying this tick
                }
            }
            // Ensure resources don't go negative due to floating point issues
            if (gameState.leads < 0) gameState.leads = 0;
            if (gameState.opportunities < 0) gameState.opportunities = 0;
        }
    }

    // Generate Money
    const mTick = currentRates.moneyPerSecond * secs;
    if (!isNaN(mTick) && isFinite(mTick) && mTick > 0) {
        gameState.money += mTick;
        gameState.totalMoneyEarned += mTick;
    }

    // Check Flexible Workflow auto-deactivation
    if (gameState.flexibleWorkflowActive) {
        const currentLeads = Math.floor(gameState.leads);
        const currentOpps = Math.floor(gameState.opportunities);
        // Deactivate if difference becomes small enough
        if (Math.abs(currentLeads - currentOpps) <= FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
            gameState.flexibleWorkflowActive = false;
            console.log("Flexible Workflow automatically deactivated (amounts near equal).");
            updateFlexibleWorkflowToggleButtonVisuals(); // Update button state
        }
    }

    // Check Win Condition
    if (!isGameWon && gameState.money >= WIN_AMOUNT) {
        triggerWin();
    }
}

// Getter for current rates
export function getCurrentRates() {
    // Return a shallow copy to prevent direct modification of internal state
    return { ...currentRates };
}