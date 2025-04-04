// js/engine.js
"use strict";
import { gameState, isGamePaused, isGameWon, setGamePaused } from './state.js';
import { buildingsConfig, upgradesConfig, FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD, LEADS_PER_CUSTOMER_BASE, CUSTOMER_COST_MULTIPLIER, BUILDING_COST_MULTIPLIER, TICK_INTERVAL_MS, WIN_AMOUNT } from './config.js';
import { triggerWin, updateButtonStates } from './ui.js'; // Assuming updateButtonStates is needed elsewhere
import { formatPercent } from './utils.js'; // Import formatPercent for effect display or tooltips if needed later

// --- Derived State Variables (Module-Scoped) ---
let currentRates = {
    leadsPerSecond: 0,
    opportunitiesPerSecond: 0,
    customerAcquisitionRate: 0,
    customerValueRate: 0,
    moneyPerSecond: 0,
    // Add derived states for dynamic building effects to be read by UI
    currentAcctManagerCostReduction: 1.0,
    currentSuccessArchitectCVRBonus: 0,
    currentProcurementOptCostReduction: 1.0,
};
let accumulatedAcquisitionAttempts = 0.0;

// --- Helper Function to Find Upgrade Config by ID ---
// (Keep existing findUpgradeConfigById function - unchanged)
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
            // Add tier 3 check if needed in future
        }
    }
    return null; // Not found
}


// --- Dynamic Cost Calculation ---
// (Keep existing getBuildingCost function - unchanged)
export function getBuildingCost(id) {
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state) return { leads: Infinity, opps: Infinity, money: Infinity };

    const count = state.count || 0;
    let costMultiplier = BUILDING_COST_MULTIPLIER; // Default

    // --- Apply Special Cost Multiplier Override ---
    if (id === 'acctManager' && cfg.costMultiplierOverride) {
        costMultiplier = cfg.costMultiplierOverride; // Use the doubling multiplier (2.0)
    }

    let baseCostLeads = cfg.baseCostLeads || 0;
    let baseCostOpps = cfg.baseCostOpps || 0;
    let baseCostMoney = cfg.baseCost || 0; // Default for single currency cost

    let calculatedCostLeads = 0;
    let calculatedCostOpps = 0;
    let calculatedCostMoney = 0;

    // Calculate cost based on currency type
    if (cfg.costCurrency === 'both') {
        calculatedCostLeads = Math.ceil(baseCostLeads * Math.pow(costMultiplier, count));
        calculatedCostOpps = Math.ceil(baseCostOpps * Math.pow(costMultiplier, count));
    } else if (cfg.costCurrency === 'leads') {
        calculatedCostLeads = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count)); // baseCostMoney is used as baseCost here
    } else if (cfg.costCurrency === 'opportunities') {
        calculatedCostOpps = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count)); // baseCostMoney is used as baseCost here
    } else if (cfg.costCurrency === 'money') {
        calculatedCostMoney = Math.ceil(baseCostMoney * Math.pow(costMultiplier, count));
    } else {
        return { leads: Infinity, opps: Infinity, money: Infinity }; // Unknown currency
    }

    // --- Apply Global Building Cost Reduction (from Procurement Optimizer) ---
    // Don't apply the reduction to the Procurement Optimizer itself
    if (id !== 'procurementOpt') {
        const reductionMultiplier = gameState.otherBuildingCostMultiplier || 1.0;
        calculatedCostLeads = Math.ceil(calculatedCostLeads * reductionMultiplier);
        calculatedCostOpps = Math.ceil(calculatedCostOpps * reductionMultiplier);
        calculatedCostMoney = Math.ceil(calculatedCostMoney * reductionMultiplier);
    }


    return {
        leads: Math.max(1, calculatedCostLeads), // Ensure minimum cost of 1 if not 0 originally
        opps: Math.max(1, calculatedCostOpps),
        money: Math.max(1, calculatedCostMoney)
    };
}

// (Keep existing getUpgradeCost function - unchanged)
export function getUpgradeCost(id) {
    const found = findUpgradeConfigById(id);
    if (!found) return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity };

    const cfg = found.config;

    // Handle specific multi-currency cost structures first
    // Check for the general pattern needed by Flexible Workflow AND the new Playtime Boost
    if (cfg.costMoney && cfg.costCustomers) {
        return { money: cfg.costMoney || 0, customers: cfg.costCustomers || 0, leads: 0, opps: 0 };
    }

    // Handle standard single cost currencies
    if (cfg.costCurrency === 'both') {
        return { leads: cfg.costLeads || 0, opps: cfg.costOpps || 0, money: 0, customers: 0 };
    } else if (cfg.costCurrency === 'leads') {
        return { leads: cfg.cost || 0, opps: 0, money: 0, customers: 0 };
    } else if (cfg.costCurrency === 'opportunities') {
        return { leads: 0, opps: cfg.cost || 0, money: 0, customers: 0 };
    } else if (cfg.costCurrency === 'money') {
        return { money: cfg.cost || 0, leads: 0, opps: 0, customers: 0 };
    } else if (cfg.costCurrency === 'customers') {
        return { customers: cfg.cost || 0, leads: 0, opps: 0, money: 0 };
    }

    // Default fallback if cost structure is unexpected
    console.warn(`Could not determine cost structure for upgrade: ${id}`);
    return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity };
}

// (Keep existing getCurrentCustomerCost function - unchanged)
export function getCurrentCustomerCost() {
    const base = LEADS_PER_CUSTOMER_BASE;
    const count = gameState.customerCountForCostIncrease || 0;
    const costMult = CUSTOMER_COST_MULTIPLIER;

    // Combine reduction multipliers: base reduction + acctManager reduction
    const upgradeReductMult = gameState.customerCostReductionMultiplier || 1.0;
    const acctManagerReductMult = currentRates.currentAcctManagerCostReduction; // Read calculated value
    const finalReductMult = upgradeReductMult * acctManagerReductMult;

    const calculatedCost = base * Math.pow(costMult, count) * finalReductMult;
    return Math.max(1, Math.ceil(calculatedCost)); // Ensure minimum cost of 1
}

// --- Core Calculation Function ---
export function calculateDerivedStats() {
    // --- Calculate effects of Customer Success Buildings FIRST ---
    // (Keep this section unchanged)
    const acctManagerCount = gameState.buildings['acctManager']?.count || 0;
    const successArchitectCount = gameState.buildings['successArchitect']?.count || 0;
    const procurementOptCount = gameState.buildings['procurementOpt']?.count || 0;
    const procurementReduction = Math.pow(0.99, procurementOptCount);
    gameState.otherBuildingCostMultiplier = procurementReduction;
    currentRates.currentProcurementOptCostReduction = procurementReduction;
    const acctManagerReduction = Math.pow(0.95, acctManagerCount);
    currentRates.currentAcctManagerCostReduction = acctManagerReduction;
    let integratedBuildingCount = 0;
    const integratedBuildingIds = ['integration', 'platform', 'ecosystem', 'cloudsuite', 'hyperscaler', 'aidata'];
    integratedBuildingIds.forEach(id => {
        integratedBuildingCount += gameState.buildings[id]?.count || 0;
    });
    const successArchitectCVRBonusPercent = Math.floor(integratedBuildingCount / 10) * 0.02;
    currentRates.currentSuccessArchitectCVRBonus = successArchitectCVRBonusPercent;

    // --- Proceed with standard calculations ---
    let rawLPS = 0, rawOPS = 0;
    let currentCAR = gameState.baseCAR || 0.1;
    // Initialize currentCVR with base value
    let currentCVR = gameState.baseCVR || 1.0; // <<< Use let here

    // Apply Success Architect bonus to BASE CVR
    currentCVR *= (1 + successArchitectCVRBonusPercent);

    // (Keep Multiplier definitions unchanged)
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

    // (Keep Building production loop unchanged)
    for (const id in buildingsConfig) {
        if (['acctManager', 'successArchitect', 'procurementOpt'].includes(id)) continue; // Skip non-producing buildings
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
            if (['integration', 'platform', 'ecosystem', 'cloudsuite', 'hyperscaler', 'aidata'].includes(id)){ finLPS *= intM; finOPS *= intM; }
            rawLPS += finLPS * count;
            rawOPS += finOPS * count;
        }
    }

    // (Keep Flexible Workflow Logic unchanged)
    let finalLPS = rawLPS; let finalOPS = rawOPS;
    if (gameState.flexibleWorkflowActive) {
        const currentLeads = Math.floor(gameState.leads); const currentOpps = Math.floor(gameState.opportunities); const difference = Math.abs(currentLeads - currentOpps);
        if (difference > FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
            if (currentLeads < currentOpps) { const transfer = Math.max(0, rawOPS * 0.5); if (!isNaN(transfer) && isFinite(transfer)) { finalLPS = rawLPS + transfer; finalOPS = rawOPS - transfer; } }
            else { const transfer = Math.max(0, rawLPS * 0.5); if (!isNaN(transfer) && isFinite(transfer)) { finalLPS = rawLPS - transfer; finalOPS = rawOPS + transfer; } }
        }
    }
    finalLPS = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
    finalOPS = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;
    const prodBoost = gameState.activeBoosts?.['prodBoost'];
    if (prodBoost) { const mult = 1.0 + prodBoost.magnitude; finalLPS *= mult; finalOPS *= mult; }

    // Calculate CAR and CVR based on upgrades
    for (const upId in gameState.upgrades) {
        if (!gameState.upgrades[upId]?.purchased) continue;
        const found = findUpgradeConfigById(upId);
        if (found) {
            const uCfg = found.config;
            if (uCfg.targetRate === 'car' && uCfg.effectValue) { currentCAR += uCfg.effectValue; }
            if (uCfg.targetRate === 'cvr' && uCfg.effectValue) { currentCVR += uCfg.effectValue; }
        }
    }
    currentCAR += gameState.custUpgradeBonusCAR || 0;
    currentCVR += gameState.custUpgradeBonusCVR || 0;
    currentCVR *= (gameState.cvrMultiplierBonus || 1.0);
    currentCVR *= (gameState.cvrCustomerMultiplier || 1.0);
    const cvrBoost = gameState.activeBoosts?.['cvrBoost'];
    if (cvrBoost) { const mult = 1.0 + cvrBoost.magnitude; currentCVR *= mult; }

    // --- Calculate Money Per Second ---
    // ********** FIX HERE **********
    // Calculate base MPS using the *currentCVR* variable, which holds the value calculated so far.
    let baseMPS = (gameState.customers || 0) * currentCVR;
    // *******************************

    // (Keep Playtime MPS Boost logic unchanged)
    if (gameState.upgrades['playtimeMPSBoost']?.purchased) {
        const PLAYTIME_CAP_HOURS = 2.0;
        const MAX_BONUS_MULTIPLIER = 3.0;
        const elapsedMs = Date.now() - (gameState.gameStartTime || Date.now());
        const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));
        const progressToCap = Math.min(1.0, elapsedHours / PLAYTIME_CAP_HOURS);
        const currentMultiplier = 1.0 + ((MAX_BONUS_MULTIPLIER - 1.0) * progressToCap);
        baseMPS *= currentMultiplier;
    }

    // (Keep Money Boost Powerup logic unchanged)
    let finalMPS = baseMPS;
    const moneyBoost = gameState.activeBoosts?.['moneyBoost'];
    if (moneyBoost) { finalMPS *= (1.0 + moneyBoost.magnitude); }


    // Final Rate Assignment (Ensure non-negative and finite)
    const leadsPerSecond = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
    const opportunitiesPerSecond = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;
    const customerAcquisitionRate = (!isNaN(currentCAR) && isFinite(currentCAR)) ? Math.max(0, currentCAR) : 0;
    // Now declare the final customerValueRate constant using the calculated currentCVR
    const customerValueRate = (!isNaN(currentCVR) && isFinite(currentCVR)) ? Math.max(0, currentCVR) : 0;
    const moneyPerSecond = (!isNaN(finalMPS) && isFinite(finalMPS)) ? Math.max(0, finalMPS) : 0;


    // Update the module-scoped rates object
    currentRates = {
        ...currentRates, // Keep existing derived values like acctMgrReduction etc.
        leadsPerSecond, opportunitiesPerSecond,
        customerAcquisitionRate, customerValueRate, moneyPerSecond // Assign final calculated values
    };

    return currentRates; // Return a copy
}

// --- Game Loop ---
// (Keep gameLoop function unchanged)
export function gameLoop() {
    if (isGamePaused || isGameWon) return;

    const secs = TICK_INTERVAL_MS / 1000.0;
    calculateDerivedStats(); // Recalculate rates at start of loop
    const rates = currentRates; // Use the just-calculated rates

    // Generate resources
    const lTick = rates.leadsPerSecond * secs; const oTick = rates.opportunitiesPerSecond * secs;
    if (!isNaN(lTick) && isFinite(lTick) && lTick > 0) { gameState.leads += lTick; gameState.totalAutoLeads += lTick; }
    if (!isNaN(oTick) && isFinite(oTick) && oTick > 0) { gameState.opportunities += oTick; gameState.totalAutoOpps += oTick; }

    // Acquisition attempts
    if (!gameState.isAcquisitionPaused) {
        const cost = getCurrentCustomerCost();
        const currentCAR = rates.customerAcquisitionRate; // Use calculated CAR
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
                    } // Failed attempt still costs L&O
                } else {
                    // Not enough resources for this attempt, carry over remaining attempts
                    accumulatedAcquisitionAttempts += (attemptsToMake - i);
                    break; // Stop trying this tick
                }
            }
            // Clamp resources just in case of floating point issues
            if (gameState.leads < 0) gameState.leads = 0;
            if (gameState.opportunities < 0) gameState.opportunities = 0;
        }
    }

    // Money generation
    const mTick = rates.moneyPerSecond * secs; // Use calculated MPS (includes playtime boost if active)
    if (!isNaN(mTick) && isFinite(mTick) && mTick > 0) {
        gameState.money += mTick;
        gameState.totalMoneyEarned += mTick; // Track total lifetime earnings
    }

    // Check Flexible Workflow auto-deactivation
    if (gameState.flexibleWorkflowActive) {
        const currentLeads = Math.floor(gameState.leads); const currentOpps = Math.floor(gameState.opportunities);
        if (Math.abs(currentLeads - currentOpps) <= FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
            gameState.flexibleWorkflowActive = false;
            // Could add a notification here if desired
        }
    }

    // Check win condition
    if (!isGameWon && gameState.money >= WIN_AMOUNT) {
        triggerWin(); // Handles setting flags, pausing, etc.
    }
}

// --- Getter for current rates ---
// (Keep getCurrentRates function unchanged)
export function getCurrentRates() {
    // Return a shallow copy to prevent external modification
    return { ...currentRates };
}

// Export findUpgradeConfigById if needed by other modules (e.g., events.js)
// export { findUpgradeConfigById }; // Already exported at the top