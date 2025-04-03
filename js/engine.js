// js/engine.js
"use strict";
import { gameState, isGamePaused, isGameWon, acquisitionAttemptRemainder, setGamePaused } from './state.js';
import { buildingsConfig, upgradesConfig, FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD, LEADS_PER_CUSTOMER_BASE, CUSTOMER_COST_MULTIPLIER, BUILDING_COST_MULTIPLIER, TICK_INTERVAL_MS, WIN_AMOUNT, powerupTypes } from './config.js';
import { triggerWin, updateButtonStates } from './ui.js'; // Import triggerWin

// --- Derived State Variables (Module-Scoped) ---
// These will be updated by calculateDerivedStats
let currentRates = {
    leadsPerSecond: 0,
    opportunitiesPerSecond: 0,
    customerAcquisitionRate: 0,
    customerValueRate: 0,
    moneyPerSecond: 0
};


// --- Dynamic Cost Calculation ---
export function getBuildingCost(id) {
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state) return { leads: Infinity, opps: Infinity, money: Infinity }; // Added money possibility

    const count = state.count || 0;
    const mult = BUILDING_COST_MULTIPLIER;

    if (cfg.costCurrency === 'both') {
        return {
            leads: Math.ceil((cfg.baseCostLeads || 0) * Math.pow(mult, count)),
            opps: Math.ceil((cfg.baseCostOpps || 0) * Math.pow(mult, count)),
            money: 0
        };
    } else if (cfg.costCurrency === 'leads') {
        return {
            leads: Math.ceil((cfg.baseCost || 0) * Math.pow(mult, count)),
            opps: 0,
            money: 0
        };
    } else if (cfg.costCurrency === 'opportunities') {
        return {
            leads: 0,
            opps: Math.ceil((cfg.baseCost || 0) * Math.pow(mult, count)),
            money: 0
        };
    } else if (cfg.costCurrency === 'money') {
         return {
            leads: 0,
            opps: 0,
            money: Math.ceil((cfg.baseCost || 0) * Math.pow(mult, count))
        };
    }
    return { leads: Infinity, opps: Infinity, money: Infinity };
}

export function getUpgradeCost(id) {
    const cfg = upgradesConfig[id];
    if (!cfg) return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity };

    if (id === 'flexibleWorkflow') {
        return { money: cfg.costMoney || 0, customers: cfg.costCustomers || 0, leads: 0, opps: 0 };
    }
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
    return { leads: Infinity, opps: Infinity, money: Infinity, customers: Infinity };
}

export function getCurrentCustomerCost() {
    const base = LEADS_PER_CUSTOMER_BASE;
    const count = gameState.customerCountForCostIncrease || 0;
    const costMult = CUSTOMER_COST_MULTIPLIER; // e.g., 1.008
    const reductMult = gameState.customerCostReductionMultiplier || 1.0; // e.g., 0.95

    // Cost = Base * (CostMult ^ Count) * ReductMult
    const calculatedCost = base * Math.pow(costMult, count) * reductMult;

    // Ensure cost is at least 1 and an integer
    return Math.max(1, Math.ceil(calculatedCost));
}

// --- Core Calculation Function ---
// Now returns the calculated rates
export function calculateDerivedStats() {
    let rawLPS = 0, rawOPS = 0;
    let baseCAR = 0.1, baseCVR = 1.0;
    const globalEff = gameState.buildingEfficiencyMultiplier || 1.0;
    const custGlobalMult = gameState.custGlobalMultiplier || 1.0;

    // 1. Base production from buildings
    for (const id in buildingsConfig) {
        const cfg = buildingsConfig[id];
        const count = gameState.buildings[id]?.count || 0;
        if (count > 0) {
            let bLPS = cfg.baseLPS || 0, bOPS = cfg.baseOPS || 0;
            let fLPS = 0, fOPS = 0, pLPS = 1.0, pOPS = 1.0, mLPS = 1.0, mOPS = 1.0;

            // Apply upgrades specific to this building
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

        if (difference > FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
            if (currentLeads < currentOpps) { // Boost Leads
                const transfer = Math.max(0, rawOPS * 0.5);
                if (!isNaN(transfer) && isFinite(transfer)) {
                    finalLPS = rawLPS + transfer;
                    finalOPS = rawOPS - transfer;
                } else { console.error("Flex Workflow: Invalid transfer value (OPS -> LPS)"); }
            } else { // Boost Opps
                const transfer = Math.max(0, rawLPS * 0.5);
                if (!isNaN(transfer) && isFinite(transfer)) {
                    finalLPS = rawLPS - transfer;
                    finalOPS = rawOPS + transfer;
                } else { console.error("Flex Workflow: Invalid transfer value (LPS -> OPS)"); }
            }
        }
    }
    // --- End Flexible Workflow Logic ---

    // Ensure rates are non-negative and valid numbers
    finalLPS = (!isNaN(finalLPS) && isFinite(finalLPS)) ? Math.max(0, finalLPS) : 0;
    finalOPS = (!isNaN(finalOPS) && isFinite(finalOPS)) ? Math.max(0, finalOPS) : 0;

    // 3. Apply Production Boost (Powerup)
    const prodBoost = gameState.activeBoosts?.['prodBoost'];
    if (prodBoost) {
        const mult = 1.0 + prodBoost.magnitude;
        finalLPS *= mult;
        finalOPS *= mult;
    }

    // 4. Base rates (CAR, CVR) from upgrades
    for (const id in upgradesConfig) {
        if (id === 'flexibleWorkflow') continue; // Skip special upgrade
        const cfg = upgradesConfig[id];
        if (gameState.upgrades[id]?.purchased) {
            if (cfg.targetRate === 'car') baseCAR += cfg.effectValue || 0;
            if (cfg.targetRate === 'cvr') baseCVR += cfg.effectValue || 0;
            // Effects directly modifying state are handled when purchased
        }
    }
    // Add customer-driven bonuses
    baseCAR += gameState.custUpgradeBonusCAR || 0;
    baseCVR += gameState.custUpgradeBonusCVR || 0;
    // Apply CVR multipliers
    baseCVR *= (gameState.cvrMultiplierBonus || 1.0);
    baseCVR *= (gameState.cvrCustomerMultiplier || 1.0);


    // 5. Apply CVR Boost (Powerup)
    const cvrBoost = gameState.activeBoosts?.['cvrBoost'];
    if (cvrBoost) {
        const mult = 1.0 + cvrBoost.magnitude;
        baseCVR *= mult;
    }

    // 6. Final rate assignment - ensure validity
    const leadsPerSecond = (!isNaN(finalLPS) && isFinite(finalLPS)) ? finalLPS : 0;
    const opportunitiesPerSecond = (!isNaN(finalOPS) && isFinite(finalOPS)) ? finalOPS : 0;
    const customerAcquisitionRate = (!isNaN(baseCAR) && isFinite(baseCAR)) ? Math.max(0, baseCAR) : 0;
    const customerValueRate = (!isNaN(baseCVR) && isFinite(baseCVR)) ? Math.max(0, baseCVR) : 0;


    // 7. Calculate Money/Second
    let finalMPS = (gameState.customers || 0) * customerValueRate;
    const moneyBoost = gameState.activeBoosts?.['moneyBoost'];
    if (moneyBoost) {
        finalMPS *= (1.0 + moneyBoost.magnitude);
    }
    const moneyPerSecond = (!isNaN(finalMPS) && isFinite(finalMPS)) ? finalMPS : 0;

     // Update the module-scoped rates object
    currentRates = {
        leadsPerSecond,
        opportunitiesPerSecond,
        customerAcquisitionRate,
        customerValueRate,
        moneyPerSecond
    };

    return currentRates; // Return the calculated rates
}

// --- Game Loop ---
let accumulatedAcquisitionAttempts = 0; // Persist remainder across ticks

export function gameLoop() {
    if (isGamePaused || isGameWon) return; // Use imported state flags

    const secs = TICK_INTERVAL_MS / 1000.0;

    // Use rates calculated in the *previous* tick's calculateDerivedStats call
    const lTick = currentRates.leadsPerSecond * secs;
    const oTick = currentRates.opportunitiesPerSecond * secs;

    if (!isNaN(lTick) && isFinite(lTick)) { gameState.leads += lTick; gameState.totalAutoLeads += lTick; }
    if (!isNaN(oTick) && isFinite(oTick)) { gameState.opportunities += oTick; gameState.totalAutoOpps += oTick; }

    // Acquisition attempts
    if (!gameState.isAcquisitionPaused) {
        const cost = getCurrentCustomerCost();
        const currentCAR = currentRates.customerAcquisitionRate;
        let attemptsThisTick = (currentCAR * secs) + accumulatedAcquisitionAttempts;
        let attemptsToMake = Math.floor(attemptsThisTick);
        accumulatedAcquisitionAttempts = attemptsThisTick - attemptsToMake; // Update remainder

        if (!isNaN(attemptsToMake) && attemptsToMake > 0) {
            for (let i = 0; i < attemptsToMake; i++) {
                if (gameState.leads >= cost && gameState.opportunities >= cost) {
                    gameState.totalAcquisitionAttempts++;
                    gameState.leads -= cost;
                    gameState.opportunities -= cost;
                    if (Math.random() < gameState.acquisitionSuccessChance) {
                        gameState.totalSuccessfulAcquisitions++;
                        gameState.customerCountForCostIncrease++;
                        gameState.customers++;
                    }
                } else {
                    // Not enough resources, add remaining attempts back to accumulator
                    accumulatedAcquisitionAttempts += (attemptsToMake - i);
                    break; // Stop trying for this tick
                }
            }
            // Floor resources just in case of floating point issues
            if (gameState.leads < 0) gameState.leads = 0;
            if (gameState.opportunities < 0) gameState.opportunities = 0;
        }
    }

    // Money generation
    const mTick = currentRates.moneyPerSecond * secs;
    if (!isNaN(mTick) && isFinite(mTick)) { gameState.money += mTick; gameState.totalMoneyEarned += mTick; }

    // Check for Flexible Workflow auto-deactivation AFTER resources are updated
    if (gameState.flexibleWorkflowActive) {
        const currentLeads = Math.floor(gameState.leads);
        const currentOpps = Math.floor(gameState.opportunities);
        if (Math.abs(currentLeads - currentOpps) <= FLEX_WORKFLOW_AMOUNT_EQUALITY_THRESHOLD) {
            console.log("Flexible Workflow auto-deactivated.");
            gameState.flexibleWorkflowActive = false;
            updateButtonStates(); // Update toggle button visual immediately
        }
    }

    // Check win condition
    if (!isGameWon && gameState.money >= WIN_AMOUNT) {
        triggerWin(); // Call the imported triggerWin function
    }

    // Recalculate derived stats for the *next* tick
    // This updates the module-scoped currentRates object
    calculateDerivedStats();
}

// Export getter for current rates if needed by other modules (e.g., UI)
export function getCurrentRates() {
    return { ...currentRates }; // Return a copy
}