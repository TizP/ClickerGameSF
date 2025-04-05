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
    currentSuccessArchitectCVRBonus: 0,
    currentProcurementOptCostReduction: 1.0,
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
    const costMultiplier = BUILDING_COST_MULTIPLIER; // TODO: Removed Acct Manager override check
    // if (id === 'acctManager' && cfg.costMultiplierOverride) {
    //     costMultiplier = cfg.costMultiplierOverride;
    // }
    let baseCostLeads = cfg.baseCostLeads || 0;
    let baseCostOpps = cfg.baseCostOpps || 0;
    let baseCostMoney = cfg.baseCost || 0;
    let calculatedCostLeads = 0;
    let calculatedCostOpps = 0;
    let calculatedCostMoney = 0;
    if (cfg.costCurrency === 'both') {
        calculatedCostLeads = Math.ceil(baseCostLeads * Math.pow(costMultiplier, count));
        calculatedCostOpps = Math.ceil(baseCostOpps * Math.pow(costMultiplier, count));
    } else if (cfg.costCurrency === 'leads') {
        calculatedCostLeads = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count));
    } else if (cfg.costCurrency === 'opportunities') {
        calculatedCostOpps = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count));
    } else if (cfg.costCurrency === 'money') {
        calculatedCostMoney = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count));
    } else {
        return { leads: Infinity, opps: Infinity, money: Infinity };
    }
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
// Used for Shift+Click buy x10
export function getCumulativeBuildingCost(id, quantity) {
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state || quantity <= 0) return { leads: Infinity, opps: Infinity, money: Infinity };

    const currentCount = state.count || 0;
    const costMultiplier = BUILDING_COST_MULTIPLIER;
    const reductionMultiplier = (id !== 'procurementOpt') ? (gameState.otherBuildingCostMultiplier || 1.0) : 1.0;

    let totalCostLeads = 0;
    let totalCostOpps = 0;
    let totalCostMoney = 0;

    for (let i = 0; i < quantity; i++) {
        const countForThisPurchase = currentCount + i;
        let baseCostLeads = cfg.baseCostLeads || 0;
        let baseCostOpps = cfg.baseCostOpps || 0;
        let baseCostMoney = cfg.baseCost || 0;

        let costLeads = 0;
        let costOpps = 0;
        let costMoney = 0;

        if (cfg.costCurrency === 'both') {
            costLeads = Math.ceil(baseCostLeads * Math.pow(costMultiplier, countForThisPurchase));
            costOpps = Math.ceil(baseCostOpps * Math.pow(costMultiplier, countForThisPurchase));
        } else if (cfg.costCurrency === 'leads') {
            costLeads = Math.ceil(baseCostMoney * Math.pow(costMultiplier, countForThisPurchase));
        } else if (cfg.costCurrency === 'opportunities') {
            costOpps = Math.ceil(baseCostMoney * Math.pow(costMultiplier, countForThisPurchase));
        } else if (cfg.costCurrency === 'money') {
            costMoney = Math.ceil(baseCostMoney * Math.pow(costMultiplier, countForThisPurchase));
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
    if (!found) return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity };
    const cfg = found.config;

    // TODO: Check for requiresCustomers first
    if (cfg.requiresCustomers) {
        return { requiresCustomers: cfg.requiresCustomers || 0, leads: 0, opps: 0, money: 0, customers: 0 }; // Return requirement separately
    }

    // Existing cost logic
    if (cfg.costMoney && cfg.costCustomers) {
        return { money: cfg.costMoney || 0, customers: cfg.costCustomers || 0, leads: 0, opps: 0 };
    }
    if (cfg.costCurrency === 'both') {
        return { leads: cfg.costLeads || 0, opps: cfg.costOpps || 0, money: 0, customers: 0 };
    }
    if (cfg.costCurrency === 'leads') {
        return { leads: cfg.cost || 0, opps: 0, money: 0, customers: 0 };
    } else if (cfg.costCurrency === 'opportunities') {
        return { leads: 0, opps: cfg.cost || 0, money: 0, customers: 0 };
    } else if (cfg.costCurrency === 'money') {
        return { money: cfg.cost || 0, leads: 0, opps: 0, customers: 0 };
    } else if (cfg.costCurrency === 'customers') { // This might become deprecated if all cust upgrades use requiresCustomers
        return { customers: cfg.cost || 0, leads: 0, opps: 0, money: 0 };
    }
    console.warn(`Could not determine cost structure for upgrade: ${id}`);
    return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity, requiresCustomers: Infinity };
}

export function getCurrentCustomerCost() {
    const base = LEADS_PER_CUSTOMER_BASE;
    const count = gameState.customerCountForCostIncrease || 0;
    const costMult = CUSTOMER_COST_MULTIPLIER;
    const upgradeReductMult = gameState.customerCostReductionMultiplier || 1.0;
    const acctManagerReductMult = currentRates.currentAcctManagerCostReduction;
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
    const successManagerCount = gameState.buildings['successManager']?.count || 0; // TODO: Added Success Manager

    const procurementReduction = Math.pow(0.99, procurementOptCount);
    gameState.otherBuildingCostMultiplier = procurementReduction;
    currentRates.currentProcurementOptCostReduction = procurementReduction;

    const acctManagerReduction = Math.pow(0.90, acctManagerCount); // TODO: Changed Acct Manager reduction to 0.90
    currentRates.currentAcctManagerCostReduction = acctManagerReduction;

    let integratedBuildingCount = 0;
    const integratedBuildingIds = ['integration', 'platform', 'ecosystem', 'cloudsuite', 'hyperscaler', 'aidata'];
    integratedBuildingIds.forEach(id => {
        integratedBuildingCount += gameState.buildings[id]?.count || 0;
    });
    const successArchitectCVRBonusPercent = Math.floor(integratedBuildingCount / 10) * 0.10; // TODO: Changed Success Architect bonus to 0.10
    currentRates.currentSuccessArchitectCVRBonus = successArchitectCVRBonusPercent;

    // Standard calculations
    let rawLPS = 0, rawOPS = 0;
    let workingCAR = gameState.baseCAR || 0.1;
    let workingCVR = gameState.baseCVR || 1.0;
    workingCVR *= (1 + successArchitectCVRBonusPercent);

    // TODO: Add Success Manager base CVR bonus
    if (buildingsConfig.successManager && buildingsConfig.successManager.baseCVRBonus) {
        workingCVR += successManagerCount * buildingsConfig.successManager.baseCVRBonus;
    }

    // Multipliers
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
        // Exclude all non-producing Customer Success buildings from this loop
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
        if (currentLeads < currentOpps) {
            const transfer = Math.max(0, rawOPS * 0.5);
            if (!isNaN(transfer) && isFinite(transfer)) {
                finalLPS = rawLPS + transfer;
                finalOPS = rawOPS - transfer;
            }
        } else {
            const transfer = Math.max(0, rawLPS * 0.5);
            if (!isNaN(transfer) && isFinite(transfer)) {
                finalLPS = rawLPS - transfer;
                finalOPS = rawOPS + transfer;
            }
        }
    }
    finalLPS = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
    finalOPS = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;

    // Production Boost Powerup
    const prodBoost = gameState.activeBoosts?.['prodBoost'];
    if (prodBoost) { const mult = 1.0 + prodBoost.magnitude; finalLPS *= mult; finalOPS *= mult; }

    // Apply Customer Growth flat bonuses
    workingCAR += gameState.custUpgradeBonusCAR || 0;
    workingCVR += gameState.custUpgradeBonusCVR || 0;

    // Apply CVR Multipliers
    workingCVR *= (gameState.cvrMultiplierBonus || 1.0);
    workingCVR *= (gameState.cvrCustomerMultiplier || 1.0);

    // CVR Powerup
    const cvrBoost = gameState.activeBoosts?.['cvrBoost'];
    if (cvrBoost) { const mult = 1.0 + cvrBoost.magnitude; workingCVR *= mult; }

    // Money Per Second calculation
    let baseMPS = (gameState.customers || 0) * workingCVR;
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
    const moneyBoost = gameState.activeBoosts?.['moneyBoost'];
    if (moneyBoost) { finalMPS *= (1.0 + moneyBoost.magnitude); }

    // Final Rate Assignment
    const leadsPerSecond = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
    const opportunitiesPerSecond = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;
    const customerAcquisitionRate = (!isNaN(workingCAR) && isFinite(workingCAR)) ? Math.max(0, workingCAR) : 0;
    const customerValueRate = (!isNaN(workingCVR) && isFinite(workingCVR)) ? Math.max(0, workingCVR) : 0;
    const moneyPerSecond = (!isNaN(finalMPS) && isFinite(finalMPS)) ? Math.max(0, finalMPS) : 0;

    currentRates = {
        ...currentRates,
        leadsPerSecond, opportunitiesPerSecond,
        customerAcquisitionRate, customerValueRate, moneyPerSecond
    };
}

// Game Loop
export function gameLoop() {
    if (isGamePaused || isGameWon) return;
    const secs = TICK_INTERVAL_MS / 1000.0;
    calculateDerivedStats();
    const lTick = currentRates.leadsPerSecond * secs;
    const oTick = currentRates.opportunitiesPerSecond * secs;
    if (!isNaN(lTick) && isFinite(lTick) && lTick > 0) { gameState.leads += lTick; gameState.totalAutoLeads += lTick; }
    if (!isNaN(oTick) && isFinite(oTick) && oTick > 0) { gameState.opportunities += oTick; gameState.totalAutoOpps += oTick; }
    if (!gameState.isAcquisitionPaused) {
        const cost = getCurrentCustomerCost();
        const currentCAR = currentRates.customerAcquisitionRate;
        let attemptsThisTick = (currentCAR * secs) + accumulatedAcquisitionAttempts;
        let attemptsToMake = Math.floor(attemptsThisTick);
        accumulatedAcquisitionAttempts = attemptsThisTick - attemptsToMake;
        if (!isNaN(attemptsToMake) && attemptsToMake > 0) {
            for (let i = 0; i < attemptsToMake; i++) {
                if (gameState.leads >= cost && gameState.opportunities >= cost) {
                    gameState.totalAcquisitionAttempts++;
                    gameState.leads -= cost; gameState.opportunities -= cost;
                    if (Math.random() < gameState.acquisitionSuccessChance) {
                        gameState.totalSuccessfulAcquisitions++; gameState.customerCountForCostIncrease++; gameState.customers++;
                    } else {
                        // Track failures if needed, but state already has attempts and success
                    }
                } else {
                    accumulatedAcquisitionAttempts += (attemptsToMake - i); // Add back attempts that couldn't be made
                    break;
                }
            }
            // Ensure resources don't go negative due to floating point issues
            if (gameState.leads < 0) gameState.leads = 0;
            if (gameState.opportunities < 0) gameState.opportunities = 0;
        }
    }
    const mTick = currentRates.moneyPerSecond * secs;
    if (!isNaN(mTick) && isFinite(mTick) && mTick > 0) {
        gameState.money += mTick;
        gameState.totalMoneyEarned += mTick;
    }
    if (gameState.flexibleWorkflowActive) {
        const currentLeads = Math.floor(gameState.leads);
        const currentOpps = Math.floor(gameState.opportunities);
        if (Math.abs(currentLeads - currentOpps) <= FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
            gameState.flexibleWorkflowActive = false;
            console.log("Flexible Workflow automatically deactivated.");
            updateFlexibleWorkflowToggleButtonVisuals(); // Update button state
        }
    }
    if (!isGameWon && gameState.money >= WIN_AMOUNT) {
        triggerWin();
    }
}

// Getter for current rates
export function getCurrentRates() {
    // Return a shallow copy to prevent direct modification of internal state
    return { ...currentRates };
}