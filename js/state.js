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
        otherBuildingCostMultiplier: 1.0, // For Procurement Optimizer effect
        acquisitionSuccessChance: 0.25,
        baseCAR: 0.1,
        baseCVR: 1.0,
        cvrMultiplierBonus: 1.0, cvrCustomerMultiplier: 1.0, custGlobalMultiplier: 1.0,
        customerCountForCostIncrease: 0,
        isAcquisitionPaused: false, flexibleWorkflowActive: false,
        // Audio State
        isMuted: false,
        lastVolume: 0.1, // Store last non-zero volume before mute
        currentTrackIndex: 0,
        musicShouldBePlaying: false, // User's intent to play music
        // Game Time & Stats
        gameStartTime: Date.now(), // Set on first load/new game
        totalLeadClicks: 0, totalOppClicks: 0, totalManualLeads: 0, totalManualOpps: 0,
        totalAutoLeads: 0, totalAutoOpps: 0, totalAcquisitionAttempts: 0, totalSuccessfulAcquisitions: 0,
        totalMoneyEarned: 0, totalPowerupsClicked: 0,
        // Upgrade Bonuses
        custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0,
        // Structures
        buildings: {},
        upgrades: {}, // Will be populated by initializeStructureState
        categoryTiers: {},
        activeBoosts: {},
        powerupTimeouts: {} // Transient: Not saved/loaded directly
    };
    initializeStructureState(state, true); // Pass isInitial=true
    return state;
}

export function initializeStructureState(state, isInitial) {
    // Buildings
    if (!state.buildings) state.buildings = {};
    for (const id in buildingsConfig) {
        if (!state.buildings[id]) state.buildings[id] = { count: 0 };
        else state.buildings[id].count = Math.max(0, Math.floor(Number(state.buildings[id].count) || 0));
    }
    // Remove building state for buildings no longer in config (only if not initial setup)
    if (!isInitial) { for (const id in state.buildings) if (!buildingsConfig[id]) delete state.buildings[id]; }

    // Upgrades (Initialize from config)
    if (!state.upgrades) state.upgrades = {};
     for (const catId in upgradesConfig) {
         const category = upgradesConfig[catId];
         // Handle tiered categories
         if (category.tier1) { for (const upId in category.tier1) { if (state.upgrades[upId]) { state.upgrades[upId] = { purchased: state.upgrades[upId].purchased === true }; } else if(isInitial) { state.upgrades[upId] = { purchased: false }; } } }
         if (category.tier2) { for (const upId in category.tier2) { if (state.upgrades[upId]) { state.upgrades[upId] = { purchased: state.upgrades[upId].purchased === true }; } else if(isInitial) { state.upgrades[upId] = { purchased: false }; } } }
         // Handle special category (includes new playtimeMPSBoost)
         if(catId === 'special') { for (const upId in category) { if(upId === 'name') continue; if (state.upgrades[upId]) { state.upgrades[upId] = { purchased: state.upgrades[upId].purchased === true }; } else if(isInitial) { state.upgrades[upId] = { purchased: false }; } } }
     }
     // Remove upgrade state for upgrades no longer in config (only if not initial setup)
    if (!isInitial) {
        const allValidUpgradeIds = new Set();
        // Gather all valid upgrade IDs from the current config
        for (const catId in upgradesConfig) {
            const category = upgradesConfig[catId];
            if(catId === 'special'){ Object.keys(category).forEach(id => { if(id !== 'name') allValidUpgradeIds.add(id)}); }
            else {
                if(category.tier1) Object.keys(category.tier1).forEach(id => allValidUpgradeIds.add(id));
                if(category.tier2) Object.keys(category.tier2).forEach(id => allValidUpgradeIds.add(id));
                // Add future tiers here if needed (e.g., tier3)
            }
        }
        // Remove any IDs in the state that aren't in the valid set
        for (const id in state.upgrades) { if (!allValidUpgradeIds.has(id)) { console.warn(`Removing deprecated upgrade state: ${id}`); delete state.upgrades[id]; } }
    }

    // Category Tiers
    if (!state.categoryTiers) state.categoryTiers = {};
    for (const catId in upgradesConfig) { if (catId === 'special') continue; if (!state.categoryTiers[catId]) { state.categoryTiers[catId] = 1; } else { state.categoryTiers[catId] = Math.max(1, Math.floor(Number(state.categoryTiers[catId]) || 1)); } }
    if (!isInitial) { for (const catId in state.categoryTiers) { if (catId !== 'special' && !upgradesConfig[catId]) { delete state.categoryTiers[catId]; } } }

    // Sanitize other state properties (Ensure types and ranges)
    state.leads = Number(state.leads) || 0;
    state.opportunities = Number(state.opportunities) || 0;
    state.customers = Math.max(0, Math.floor(Number(state.customers) || 0));
    state.money = Number(state.money) || 0;
    state.leadsPerClick = Number(state.leadsPerClick) || 1;
    state.opportunitiesPerClick = Number(state.opportunitiesPerClick) || 1;
    state.leadClickPercentBonus = Number(state.leadClickPercentBonus) || 0;
    state.oppClickPercentBonus = Number(state.oppClickPercentBonus) || 0;
    state.globalClickMultiplier = Number(state.globalClickMultiplier) || 1.0;
    state.leadTeamMultiplier = Number(state.leadTeamMultiplier) || 1.0;
    state.oppTeamMultiplier = Number(state.oppTeamMultiplier) || 1.0;
    state.integratedMultiplier = Number(state.integratedMultiplier) || 1.0;
    state.buildingEfficiencyMultiplier = Number(state.buildingEfficiencyMultiplier) || 1.0;
    state.customerCostReductionMultiplier = Number(state.customerCostReductionMultiplier) || 1.0;
    state.otherBuildingCostMultiplier = Number(state.otherBuildingCostMultiplier) || 1.0;
    state.acquisitionSuccessChance = Math.max(0, Math.min(1.0, Number(state.acquisitionSuccessChance) || 0.25));
    state.baseCAR = Number(state.baseCAR) || 0.1;
    state.baseCVR = Number(state.baseCVR) || 1.0;
    state.cvrMultiplierBonus = Number(state.cvrMultiplierBonus) || 1.0;
    state.cvrCustomerMultiplier = Number(state.cvrCustomerMultiplier) || 1.0;
    state.custGlobalMultiplier = Number(state.custGlobalMultiplier) || 1.0;
    state.customerCountForCostIncrease = Math.max(0, Math.floor(Number(state.customerCountForCostIncrease) || 0));
    state.isAcquisitionPaused = state.isAcquisitionPaused === true;
    state.flexibleWorkflowActive = state.flexibleWorkflowActive === true;
    // Audio State Sanitization
    state.isMuted = state.isMuted === true;
    state.lastVolume = Math.max(0, Math.min(1, Number(state.lastVolume) || 0.1));
    state.currentTrackIndex = Math.max(0, Math.floor(Number(state.currentTrackIndex) || 0));
    state.musicShouldBePlaying = state.musicShouldBePlaying === true;
    // Stats Sanitization
    // Ensure gameStartTime is set correctly on initial load or reset
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
    // Upgrade Bonus Sanitization
    state.custUpgradeBonusCAR = Number(state.custUpgradeBonusCAR) || 0;
    state.custUpgradeBonusCVR = Number(state.custUpgradeBonusCVR) || 0;
    // Active Boosts
    state.activeBoosts = (typeof state.activeBoosts === 'object' && state.activeBoosts !== null) ? state.activeBoosts : {};
    // Ensure powerupTimeouts is always an empty object after initialization/load
    state.powerupTimeouts = {};
}

// Functions to modify global control flags
export function setGameWon(value) {
    isGameWon = value;
}
export function setGamePaused(value) {
    isGamePaused = value;
}