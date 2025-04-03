// js/state.js
"use strict";
import { buildingsConfig, upgradesConfig } from './config.js';

// The single source of truth for dynamic game data
export let gameState = {};

// Control variables (scoped here or managed within their respective modules)
// Note: Interval IDs are best managed in main.js or the module that starts them
export let isGameWon = false;
export let isGamePaused = false;
export let acquisitionAttemptRemainder = 0.0;
export let saveStatusTimeoutId = null;
export let currentPowerupToken = null; // Managed in powerups.js? Better there.
export let lastVolumeBeforeMute = 0.1; // Managed in audio.js
export let currentTrackIndex = 0;      // Managed in audio.js
export let musicShouldBePlaying = false;// Managed in audio.js

// --- Derived State (Calculated in engine.js) ---
// These are placeholders; engine.js will calculate the actual values.
// export let leadsPerSecond = 0, opportunitiesPerSecond = 0, customerAcquisitionRate = 0, customerValueRate = 0, moneyPerSecond = 0;


export function getDefaultGameState() {
    const state = {
        leads: 0, opportunities: 0, customers: 0, money: 0,
        leadsPerClick: 1, opportunitiesPerClick: 1, leadClickPercentBonus: 0, oppClickPercentBonus: 0,
        buildingEfficiencyMultiplier: 1.0, customerCostReductionMultiplier: 1.0,
        acquisitionSuccessChance: 0.25, cvrMultiplierBonus: 1.0, cvrCustomerMultiplier: 1.0, custGlobalMultiplier: 1.0,
        customerCountForCostIncrease: 0,
        isAcquisitionPaused: false, flexibleWorkflowActive: false, isMuted: false,
        gameStartTime: Date.now(),
        totalLeadClicks: 0, totalOppClicks: 0, totalManualLeads: 0, totalManualOpps: 0,
        totalAutoLeads: 0, totalAutoOpps: 0, totalAcquisitionAttempts: 0, totalSuccessfulAcquisitions: 0,
        totalMoneyEarned: 0, totalPowerupsClicked: 0,
        custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0,
        buildings: {}, upgrades: {}, activeBoosts: {},
        powerupTimeouts: {} // Always transient
    };
    initializeStructureState(state, true); // Pass isInitial=true
    return state;
}

export function initializeStructureState(state, isInitial) {
    if (!state.buildings) state.buildings = {};
    if (!state.upgrades) state.upgrades = {};
    for (const id in buildingsConfig) { if (!state.buildings[id]) state.buildings[id] = { count: 0 }; else state.buildings[id].count = Math.max(0, Math.floor(state.buildings[id].count || 0)); }
    for (const id in upgradesConfig) { if (!state.upgrades[id]) state.upgrades[id] = { purchased: false }; else state.upgrades[id].purchased = state.upgrades[id].purchased === true; }
    if (!isInitial) { for (const id in state.buildings) if (!buildingsConfig[id]) delete state.buildings[id]; for (const id in state.upgrades) if (!upgradesConfig[id]) delete state.upgrades[id]; }
    state.leads = Number(state.leads) || 0; state.opportunities = Number(state.opportunities) || 0; state.customers = Math.max(0, Math.floor(Number(state.customers) || 0)); state.money = Number(state.money) || 0;
    state.leadsPerClick = Number(state.leadsPerClick) || 1; state.opportunitiesPerClick = Number(state.opportunitiesPerClick) || 1; state.leadClickPercentBonus = Number(state.leadClickPercentBonus) || 0; state.oppClickPercentBonus = Number(state.oppClickPercentBonus) || 0;
    state.buildingEfficiencyMultiplier = Number(state.buildingEfficiencyMultiplier) || 1.0; state.customerCostReductionMultiplier = Number(state.customerCostReductionMultiplier) || 1.0;
    state.acquisitionSuccessChance = Math.max(0, Math.min(1.0, Number(state.acquisitionSuccessChance) || 0.25)); state.cvrMultiplierBonus = Number(state.cvrMultiplierBonus) || 1.0; state.cvrCustomerMultiplier = Number(state.cvrCustomerMultiplier) || 1.0; state.custGlobalMultiplier = Number(state.custGlobalMultiplier) || 1.0;
    state.customerCountForCostIncrease = Math.max(0, Math.floor(Number(state.customerCountForCostIncrease) || 0));
    state.isAcquisitionPaused = state.isAcquisitionPaused === true; state.flexibleWorkflowActive = state.flexibleWorkflowActive === true;
    state.isMuted = state.isMuted === true; // Sanitize isMuted
    state.gameStartTime = Number(state.gameStartTime) || Date.now();
    state.totalLeadClicks = Number(state.totalLeadClicks) || 0; state.totalOppClicks = Number(state.totalOppClicks) || 0; state.totalManualLeads = Number(state.totalManualLeads) || 0; state.totalManualOpps = Number(state.totalManualOpps) || 0;
    state.totalAutoLeads = Number(state.totalAutoLeads) || 0; state.totalAutoOpps = Number(state.totalAutoOpps) || 0; state.totalAcquisitionAttempts = Number(state.totalAcquisitionAttempts) || 0; state.totalSuccessfulAcquisitions = Number(state.totalSuccessfulAcquisitions) || 0; state.totalMoneyEarned = Number(state.totalMoneyEarned) || 0; state.totalPowerupsClicked = Number(state.totalPowerupsClicked) || 0;
    state.custUpgradeBonusCAR = Number(state.custUpgradeBonusCAR) || 0; state.custUpgradeBonusCVR = Number(state.custUpgradeBonusCVR) || 0;
    state.activeBoosts = (typeof state.activeBoosts === 'object' && state.activeBoosts !== null) ? state.activeBoosts : {};
    state.powerupTimeouts = {}; // Always reset this on load
}

// Functions to modify global control flags (example)
export function setGameWon(value) {
    isGameWon = value;
}
export function setGamePaused(value) {
    isGamePaused = value;
}
// Add setters for other control flags if needed outside state.js