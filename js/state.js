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
        otherBuildingCostMultiplier: 1.0,
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
        custUpgradeBonusCAR: 0, custUpgradeBonusCVR: 0,
        buildings: {},
        upgrades: {},
        categoryTiers: {},
        activeBoosts: {},
        powerupTimeouts: {}
    };
    initializeStructureState(state, true);
    return state;
}

export function initializeStructureState(state, isInitial) {
    // Buildings
    if (!state.buildings) state.buildings = {};
    for (const id in buildingsConfig) {
        if (!state.buildings[id]) {
            state.buildings[id] = { count: 0 };
        } else {
            state.buildings[id].count = Math.max(0, Math.floor(Number(state.buildings[id].count) || 0));
        }
    }
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
    const allValidUpgradeIds = new Set();
    for (const catId in upgradesConfig) {
        const category = upgradesConfig[catId];
        const processTier = (tierObj) => {
            if (!tierObj) return;
            for (const upId in tierObj) {
                allValidUpgradeIds.add(upId);
                if (state.upgrades[upId]) {
                    state.upgrades[upId] = { purchased: state.upgrades[upId].purchased === true };
                } else if (isInitial) {
                    state.upgrades[upId] = { purchased: false };
                } else if (!isInitial && !state.upgrades[upId]) {
                     state.upgrades[upId] = { purchased: false };
                     console.log(`Initializing newly added upgrade state: ${upId}`);
                }
            }
        };

        if (catId === 'special') {
            for (const upId in category) {
                if (upId === 'name') continue;
                allValidUpgradeIds.add(upId);
                if (state.upgrades[upId]) {
                    state.upgrades[upId] = { purchased: state.upgrades[upId].purchased === true };
                } else if (isInitial) {
                    state.upgrades[upId] = { purchased: false };
                } else if (!isInitial && !state.upgrades[upId]) {
                     state.upgrades[upId] = { purchased: false };
                     console.log(`Initializing newly added special upgrade state: ${upId}`);
                }
            }
        } else {
            processTier(category.tier1);
            processTier(category.tier2);
        }
    }
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
        if (catId === 'special') continue;
        if (!state.categoryTiers[catId]) {
            state.categoryTiers[catId] = 1;
        } else {
            state.categoryTiers[catId] = Math.max(1, Math.floor(Number(state.categoryTiers[catId]) || 1));
        }
    }
    if (!isInitial) {
        for (const catId in state.categoryTiers) {
            if (catId !== 'special' && !upgradesConfig[catId]) {
                console.warn(`Removing deprecated category tier state: ${catId}`);
                delete state.categoryTiers[catId];
            }
        }
    }

    // Sanitize Other State Properties
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
    state.custUpgradeBonusCAR = Number(state.custUpgradeBonusCAR) || 0;
    state.custUpgradeBonusCVR = Number(state.custUpgradeBonusCVR) || 0;
    state.activeBoosts = (typeof state.activeBoosts === 'object' && state.activeBoosts !== null) ? state.activeBoosts : {};
    state.powerupTimeouts = {};
}

export function setGameWon(value) {
    isGameWon = value;
}
export function setGamePaused(value) {
    isGamePaused = value;
}