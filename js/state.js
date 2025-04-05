// js/state.js
"use strict";
import { buildingsConfig, upgradesConfig } from './config.js';

// The single source of truth for dynamic game data
export let gameState = {};

// Control variables (scoped here or managed within their respective modules)
export let isGameWon = false;
export let isGamePaused = false;

export function getDefaultGameState() {
    const state = {
        leads: 0, opportunities: 0, customers: 0, money: 0,
        leadsPerClick: 1, opportunitiesPerClick: 1, leadClickPercentBonus: 0, oppClickPercentBonus: 0,
        globalClickMultiplier: 1.0,
        leadTeamMultiplier: 1.0,
        oppTeamMultiplier: 1.0,
        integratedMultiplier: 1.0,
        buildingEfficiencyMultiplier: 1.0,
        customerCostReductionMultiplier: 1.0,
        otherBuildingCostMultiplier: 1.0, // Set by Procurement Opt.
        acquisitionSuccessChance: 0.25,
        baseCAR: 0.1,
        baseCVR: 1.0,
        cvrMultiplierBonus: 1.0, cvrCustomerMultiplier: 1.0, custGlobalMultiplier: 1.0,
        customerCountForCostIncrease: 0,
        isAcquisitionPaused: false, flexibleWorkflowActive: false,
        isMuted: false,
        lastVolume: 0.1,
        currentTrackIndex: 0,
        musicShouldBePlaying: false,
        gameStartTime: Date.now(),
        totalLeadClicks: 0, totalOppClicks: 0, totalManualLeads: 0, totalManualOpps: 0,
        totalAutoLeads: 0, totalAutoOpps: 0, totalAcquisitionAttempts: 0, totalSuccessfulAcquisitions: 0,
        totalMoneyEarned: 0, totalPowerupsClicked: 0,
        custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0, // Bonuses from 'Customer Growth' upgrades
        buildings: {}, // Stores { count: number } for each building ID
        upgrades: {}, // Stores { purchased: boolean } for each upgrade ID
        categoryTiers: {}, // Stores current tier (1 or 2) for each upgrade category ID
        activeBoosts: {}, // Stores active powerup info { endTime, magnitude, name, description }
        powerupTimeouts: {} // Transient: Stores setTimeout IDs for powerups
    };
    initializeStructureState(state, true); // Initialize/Sanitize structures
    return state;
}

// Initializes/Sanitizes buildings, upgrades, categoryTiers based on config
// Ensures loaded state matches current game version's structures
export function initializeStructureState(state, isInitial) {
    // Buildings
    if (!state.buildings) state.buildings = {};
    for (const id in buildingsConfig) {
        if (!state.buildings[id]) {
            // If new game or building missing from save, initialize it
            state.buildings[id] = { count: 0 };
            if (!isInitial) console.log(`Initializing newly added building state: ${id}`);
        } else {
            // If loading, sanitize existing count
            state.buildings[id].count = Math.max(0, Math.floor(Number(state.buildings[id].count) || 0));
        }
    }
    // Clean up buildings in save that are no longer in config
    if (!isInitial) {
        for (const id in state.buildings) {
            if (!buildingsConfig[id]) {
                console.warn(`Removing deprecated building state: ${id}`);
                delete state.buildings[id];
            }
        }
    }

    // Upgrades
    if (!state.upgrades) state.upgrades = {};
    const allValidUpgradeIds = new Set(); // Keep track of all current upgrades

    // Helper to process a tier of upgrades
    const processTier = (tierObj, catId, tierNum) => {
        if (!tierObj) return;
        for (const upId in tierObj) {
            allValidUpgradeIds.add(upId); // Add ID to valid set
            if (state.upgrades[upId]) {
                // Sanitize loaded state: ensure 'purchased' is boolean
                state.upgrades[upId] = { purchased: state.upgrades[upId].purchased === true };
            } else if (!state.upgrades[upId]) {
                // If missing from save (newly added upgrade?), initialize as not purchased
                 state.upgrades[upId] = { purchased: false };
                 if (!isInitial) console.log(`Initializing newly added upgrade state: ${upId} in ${catId} T${tierNum}`);
            }
            // No 'else if (isInitial)' needed, as missing upgrades are initialized above
        }
    };

    // Process Tiered Upgrades
    for (const catId in upgradesConfig) {
        if (catId === 'special') continue; // Skip special section here
        const category = upgradesConfig[catId];
        processTier(category.tier1, catId, 1);
        processTier(category.tier2, catId, 2);
    }

    // Process Special Upgrades
    if (upgradesConfig.special) {
        for (const upId in upgradesConfig.special) {
            if (upId === 'name') continue; // Skip the name property
            allValidUpgradeIds.add(upId);
            if (state.upgrades[upId]) {
                state.upgrades[upId] = { purchased: state.upgrades[upId].purchased === true };
            } else if (!state.upgrades[upId]) {
                 state.upgrades[upId] = { purchased: false };
                 if (!isInitial) console.log(`Initializing newly added special upgrade state: ${upId}`);
            }
        }
    }

    // Clean up upgrades in save that are no longer in config
    if (!isInitial) {
        for (const id in state.upgrades) {
            if (!allValidUpgradeIds.has(id)) {
                console.warn(`Removing deprecated upgrade state: ${id}`);
                delete state.upgrades[id];
            }
        }
    }

    // Category Tiers
    if (!state.categoryTiers) state.categoryTiers = {};
    for (const catId in upgradesConfig) {
        if (catId === 'special') continue; // Special upgrades don't have tiers
        if (!state.categoryTiers[catId]) {
            // Initialize if missing
            state.categoryTiers[catId] = 1;
             if (!isInitial) console.log(`Initializing newly added category tier state: ${catId}`);
        } else {
            // Sanitize loaded tier: ensure it's 1 or 2
            state.categoryTiers[catId] = [1, 2].includes(Math.floor(Number(state.categoryTiers[catId]))) ? Math.floor(Number(state.categoryTiers[catId])) : 1;
        }
    }
    // Clean up tier states for categories no longer in config
    if (!isInitial) {
        for (const catId in state.categoryTiers) {
            if (catId !== 'special' && !upgradesConfig[catId]) {
                console.warn(`Removing deprecated category tier state: ${catId}`);
                delete state.categoryTiers[catId];
            }
        }
    }

    // Sanitize Other State Properties (ensure correct types and bounds)
    state.leads = Math.max(0, Number(state.leads) || 0);
    state.opportunities = Math.max(0, Number(state.opportunities) || 0);
    state.customers = Math.max(0, Math.floor(Number(state.customers) || 0));
    state.money = Math.max(0, Number(state.money) || 0);
    state.leadsPerClick = Math.max(1, Number(state.leadsPerClick) || 1);
    state.opportunitiesPerClick = Math.max(1, Number(state.opportunitiesPerClick) || 1);
    state.leadClickPercentBonus = Math.max(0, Number(state.leadClickPercentBonus) || 0);
    state.oppClickPercentBonus = Math.max(0, Number(state.oppClickPercentBonus) || 0);
    state.globalClickMultiplier = Math.max(1.0, Number(state.globalClickMultiplier) || 1.0);
    state.leadTeamMultiplier = Math.max(1.0, Number(state.leadTeamMultiplier) || 1.0);
    state.oppTeamMultiplier = Math.max(1.0, Number(state.oppTeamMultiplier) || 1.0);
    state.integratedMultiplier = Math.max(1.0, Number(state.integratedMultiplier) || 1.0);
    state.buildingEfficiencyMultiplier = Math.max(1.0, Number(state.buildingEfficiencyMultiplier) || 1.0);
    state.customerCostReductionMultiplier = Math.max(0.01, Math.min(1.0, Number(state.customerCostReductionMultiplier) || 1.0)); // Ensure it doesn't go <= 0
    state.otherBuildingCostMultiplier = Math.max(0.01, Math.min(1.0, Number(state.otherBuildingCostMultiplier) || 1.0)); // Ensure it doesn't go <= 0
    state.acquisitionSuccessChance = Math.max(0, Math.min(1.0, Number(state.acquisitionSuccessChance) || 0.25));
    state.baseCAR = Math.max(0, Number(state.baseCAR) || 0.1);
    state.baseCVR = Math.max(0, Number(state.baseCVR) || 1.0);
    state.cvrMultiplierBonus = Math.max(1.0, Number(state.cvrMultiplierBonus) || 1.0);
    state.cvrCustomerMultiplier = Math.max(1.0, Number(state.cvrCustomerMultiplier) || 1.0);
    state.custGlobalMultiplier = Math.max(1.0, Number(state.custGlobalMultiplier) || 1.0);
    state.customerCountForCostIncrease = Math.max(0, Math.floor(Number(state.customerCountForCostIncrease) || 0));
    state.isAcquisitionPaused = state.isAcquisitionPaused === true;
    state.flexibleWorkflowActive = state.flexibleWorkflowActive === true;
    state.isMuted = state.isMuted === true;
    state.lastVolume = Math.max(0, Math.min(1, Number(state.lastVolume) || 0.1));
    state.currentTrackIndex = Math.max(0, Math.floor(Number(state.currentTrackIndex) || 0));
    state.musicShouldBePlaying = state.musicShouldBePlaying === true;
    state.gameStartTime = Number(state.gameStartTime) || Date.now();
    state.totalLeadClicks = Math.max(0, Math.floor(Number(state.totalLeadClicks) || 0));
    state.totalOppClicks = Math.max(0, Math.floor(Number(state.totalOppClicks) || 0));
    state.totalManualLeads = Math.max(0, Number(state.totalManualLeads) || 0);
    state.totalManualOpps = Math.max(0, Number(state.totalManualOpps) || 0);
    state.totalAutoLeads = Math.max(0, Number(state.totalAutoLeads) || 0);
    state.totalAutoOpps = Math.max(0, Number(state.totalAutoOpps) || 0);
    state.totalAcquisitionAttempts = Math.max(0, Math.floor(Number(state.totalAcquisitionAttempts) || 0));
    state.totalSuccessfulAcquisitions = Math.max(0, Math.floor(Number(state.totalSuccessfulAcquisitions) || 0));
    state.totalMoneyEarned = Math.max(0, Number(state.totalMoneyEarned) || 0);
    state.totalPowerupsClicked = Math.max(0, Math.floor(Number(state.totalPowerupsClicked) || 0));
    state.custUpgradeBonusCAR = Math.max(0, Number(state.custUpgradeBonusCAR) || 0);
    state.custUpgradeBonusCVR = Math.max(0, Number(state.custUpgradeBonusCVR) || 0);

    // Sanitize Active Boosts (ensure structure and endTime)
    state.activeBoosts = (typeof state.activeBoosts === 'object' && state.activeBoosts !== null) ? state.activeBoosts : {};
    for (const boostId in state.activeBoosts) {
         const boost = state.activeBoosts[boostId];
         if (!boost || typeof boost !== 'object' || !boost.endTime || typeof boost.endTime !== 'number') {
             console.warn(`Removing invalid active boost data for ID: ${boostId}`);
             delete state.activeBoosts[boostId];
         }
     }
    // Always clear transient powerup timeouts on load/init
    state.powerupTimeouts = {};
}

// --- Setters for Game State Flags ---
export function setGameWon(value) {
    isGameWon = value;
}
export function setGamePaused(value) {
    isGamePaused = value;
}