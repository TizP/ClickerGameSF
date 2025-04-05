// js/events.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon } from './state.js';
import { buildingsConfig, upgradesConfig, FIRST_TIME_POPUP_KEY } from './config.js'; // Import FIRST_TIME_POPUP_KEY
// Import helpers needed for purchase logic and updates
import { getBuildingCost, getUpgradeCost, calculateDerivedStats, getCurrentRates, findUpgradeConfigById, getCumulativeBuildingCost } from './engine.js';
// Import hideFirstTimeModal
import { updateDisplay, updateButtonStates, showCredits, hideCredits, showStats, hideStats, showTutorial, hideTutorial, showSettings, hideSettings, closeWinScreen, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals, hideFirstTimeModal } from './ui.js';
import { playSoundEffect, togglePlayPause, setVolume, playNextTrack, toggleMute } from './audio.js';
import { saveGame, deleteSave } from './saveLoad.js';
import { softRefreshGame } from './main.js';
import * as config from './config.js'; // Import config for setting flag


// --- Tier Completion Check ---
function checkTierCompletion(categoryId) {
    if (!categoryId || categoryId === 'special') return false;
    const categoryConfig = upgradesConfig[categoryId];
    if (!categoryConfig || !categoryConfig.tier1) {
        return false;
    }
    for (const upgradeId in categoryConfig.tier1) {
        if (!gameState.upgrades[upgradeId]?.purchased) {
            return false;
        }
    }
    return true;
}

// --- Purchase Functions ---
function buyBuilding(id, shiftHeld = false) {
    if (isGamePaused || isGameWon) return;
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state) { console.error(`Building config or state not found for ID: ${id}`); return; }

    const quantityToBuy = shiftHeld ? 10 : 1;
    const cost = shiftHeld ? getCumulativeBuildingCost(id, quantityToBuy) : getBuildingCost(id);
    const curr = cfg.costCurrency;
    let afford = false;

    // Check affordability
    if (curr === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; afford = true; } }
    else if (curr === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; afford = true; } }

    // Process purchase
    if (afford) {
        state.count += quantityToBuy;
        playSoundEffect('sfx-purchase');
        calculateDerivedStats();
        updateDisplay();
        updateButtonStates();
    } else {
        if (shiftHeld) { console.log(`Cannot afford to buy 10 ${cfg.name}.`); }
    }
}

function buyUpgrade(upgradeId) {
    if (isGamePaused || isGameWon) return;
    const found = findUpgradeConfigById(upgradeId);
    if (!found) { console.error(`Upgrade config not found for ID: ${upgradeId}`); return; }

    const cfg = found.config;
    const effectiveCategoryId = found.categoryId;
    const effectiveTier = found.tier;
    const state = gameState.upgrades[upgradeId];

    if (!state || state.purchased) return; // Already purchased or state missing

    const cost = getUpgradeCost(upgradeId); // Handles requirements vs costs
    let afford = false;

    // 1. Check Customer Requirement FIRST
    if (cost.requiresCustomers && cost.requiresCustomers > 0) {
        if (gameState.customers >= cost.requiresCustomers) {
            afford = true; // Requirement met, no cost deducted
        }
    }
    // 2. Check Veteran Pipeline Operator special cost
    else if (upgradeId === 'playtimeMPSBoost' && cfg.costCurrency === 'all') {
         if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps && gameState.money >= cost.money) {
             gameState.leads -= cost.leads;
             gameState.opportunities -= cost.opps;
             gameState.money -= cost.money;
             afford = true;
         }
    }
    // 3. Check Flexible Workflow special cost (Money + Customers)
    else if (upgradeId === 'flexibleWorkflow' && cfg.costMoney && cfg.costCustomers) {
         if (gameState.money >= cost.money && gameState.customers >= cost.customers) {
             gameState.money -= cost.money;
             gameState.customers -= cost.customers; // This one *does* cost customers
             afford = true;
         }
    }
    // 4. Check standard costs
    else if (cfg.costCurrency === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; afford = true; } }
    else if (cfg.costCurrency === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; afford = true; } }
    else if (cfg.costCurrency === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; afford = true; } }
    else if (cfg.costCurrency === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; afford = true; } }
    // Note: Deprecated 'costCurrency: customers' is intentionally not handled here now

    // Process purchase if affordable
    if (afford) {
        state.purchased = true;
        playSoundEffect('sfx-purchase');

        if (typeof cfg.effect === 'function') {
            cfg.effect(gameState); // Apply direct effects
        }

        // Check tier completion
        if (effectiveTier === 1 && effectiveCategoryId && effectiveCategoryId !== 'special') {
            if (checkTierCompletion(effectiveCategoryId)) {
                console.log(`Tier 1 completed for category: ${effectiveCategoryId}. Advancing to Tier 2.`);
                gameState.categoryTiers[effectiveCategoryId] = 2;
            }
        }

        calculateDerivedStats(); // Recalculate rates
        updateDisplay();
        updateButtonStates(); // Update buttons (cost, state, maybe redraw tier)
    }
}

// --- Action Toggles ---
function toggleAcquisitionPause() { if (isGameWon || isGamePaused) return; gameState.isAcquisitionPaused = !gameState.isAcquisitionPaused; updateAcquisitionButtonVisuals(); }
function toggleFlexibleWorkflow() { if (isGamePaused || isGameWon || !gameState.upgrades['flexibleWorkflow']?.purchased) return; gameState.flexibleWorkflowActive = !gameState.flexibleWorkflowActive; console.log(`Flexible Workflow manually ${gameState.flexibleWorkflowActive ? 'activated' : 'deactivated'}.`); calculateDerivedStats(); updateDisplay(); updateFlexibleWorkflowToggleButtonVisuals(); }

// --- Category Collapse/Expand ---
function toggleCategoryCollapse(event) {
    const titleElement = event.target.closest('h4.group-title');
    if (!titleElement) return;
    const contentElement = titleElement.nextElementSibling;
    if (contentElement && (contentElement.classList.contains('upgrade-category-container') || contentElement.classList.contains('build-category-container'))) {
        titleElement.classList.toggle('collapsed');
        contentElement.classList.toggle('content-collapsed');
    } else {
        console.warn("Could not find collapsible content for title:", titleElement.textContent);
    }
}


// --- Event Listener Setup ---
export function setupEventListeners() {
    console.log("--- Attaching Listeners ---");

    // --- Clickers ---
    domElements['click-lead-button']?.addEventListener('click', () => {
        if (isGamePaused || isGameWon) return;
        const rates = getCurrentRates();
        const clickBoost = gameState.activeBoosts?.['clickBoost'];
        const baseClickMultiplier = gameState.globalClickMultiplier || 1.0;
        const powerupClickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;
        const totalClickMultiplier = baseClickMultiplier * powerupClickMultiplier;
        let baseAmt = gameState.leadsPerClick;
        let currentLPS = rates.leadsPerSecond;
        let percentBonusVal = gameState.leadClickPercentBonus || 0;
        let percentBonusAmt = currentLPS * percentBonusVal;
        if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) percentBonusAmt = 0;
        let amt = (baseAmt + percentBonusAmt) * totalClickMultiplier;
        if (isNaN(amt) || !isFinite(amt) || amt <=0) amt = (amt <= 0 ? 0 : baseAmt * totalClickMultiplier);
        if (amt > 0) {
            gameState.leads += amt;
            gameState.totalLeadClicks++;
            gameState.totalManualLeads += amt;
            updateDisplay();
        }
    });
    domElements['click-opp-button']?.addEventListener('click', () => {
        if (isGamePaused || isGameWon) return;
        const rates = getCurrentRates();
        const clickBoost = gameState.activeBoosts?.['clickBoost'];
        const baseClickMultiplier = gameState.globalClickMultiplier || 1.0;
        const powerupClickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;
        const totalClickMultiplier = baseClickMultiplier * powerupClickMultiplier;
        let baseAmt = gameState.opportunitiesPerClick;
        let currentOPS = rates.opportunitiesPerSecond;
        let percentBonusVal = gameState.oppClickPercentBonus || 0;
        let percentBonusAmt = currentOPS * percentBonusVal;
        if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) percentBonusAmt = 0;
        let amt = (baseAmt + percentBonusAmt) * totalClickMultiplier;
        if (isNaN(amt) || !isFinite(amt) || amt <=0) amt = (amt <= 0 ? 0 : baseAmt * totalClickMultiplier);
        if (amt > 0) {
            gameState.opportunities += amt;
            gameState.totalOppClicks++;
            gameState.totalManualOpps += amt;
            updateDisplay();
        }
    });

    // --- Building Purchases (Event Delegation) ---
    const buildPanel = document.querySelector('.buildables-panel');
    if (buildPanel) {
        buildPanel.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.build-button');
            if (targetButton && !targetButton.disabled && targetButton.id && targetButton.id.startsWith('buy-')) {
                const buildingId = targetButton.id.substring(4);
                if (buildingsConfig[buildingId]) {
                    const shiftHeld = event.shiftKey;
                    buyBuilding(buildingId, shiftHeld);
                } else {
                    console.warn(`Clicked build button with unrecognized ID: ${buildingId}`);
                }
            }
        });
    } else { console.error("Buildables panel not found for event delegation."); }

    // --- Upgrade Purchases (Event Delegation) ---
    const upgradePanel = document.querySelector('.upgrades-panel');
    if (upgradePanel) {
        upgradePanel.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.upgrade-button');
            if (targetButton && !targetButton.disabled && targetButton.id) {
                const upgradeId = targetButton.dataset.upgradeId || targetButton.id.substring(8);
                if (findUpgradeConfigById(upgradeId)) {
                    buyUpgrade(upgradeId); // Handles requirements/costs internally
                } else {
                    console.warn(`Clicked upgrade button with unrecognized ID: ${upgradeId}`);
                }
            }
        });
    } else { console.error("Upgrades panel not found for event delegation."); }

    // --- Category Collapse/Expand (Delegation) ---
    upgradePanel?.addEventListener('click', toggleCategoryCollapse);
    buildPanel?.addEventListener('click', toggleCategoryCollapse);

    // --- Music Controls ---
    domElements['play-pause-button']?.addEventListener('click', togglePlayPause);
    domElements['volume-slider']?.addEventListener('input', () => setVolume());
    domElements['volume-slider']?.addEventListener('change', () => setVolume());
    domElements['next-track-button']?.addEventListener('click', playNextTrack);
    domElements['background-music']?.addEventListener('ended', playNextTrack);
    domElements['mute-button']?.addEventListener('click', () => toggleMute());

    // --- Modal Open/Close ---
    const setupModal = (buttonId, modalId, showFn, hideFn) => {
        const openBtn = domElements[buttonId];
        const modal = domElements[modalId];
        const closeBtn = domElements[`close-${buttonId.replace('-button', '')}-button`];
        openBtn?.addEventListener('click', showFn);
        closeBtn?.addEventListener('click', hideFn);
        modal?.addEventListener('click', (e) => { if (e.target === modal) hideFn(); });
    };
    setupModal('credits-button', 'credits-modal', showCredits, hideCredits);
    setupModal('stats-button', 'stats-modal', showStats, hideStats);
    setupModal('tutorial-button', 'tutorial-modal', showTutorial, hideTutorial);
    setupModal('settings-button', 'settings-modal', showSettings, hideSettings);
    domElements['close-win-modal-button']?.addEventListener('click', closeWinScreen); // Listener for win modal button

    // TODO: Add listeners for First Time Modal
    domElements['close-first-time-button']?.addEventListener('click', hideFirstTimeModal);
    domElements['ok-first-time-button']?.addEventListener('click', hideFirstTimeModal);
    // Also hide if clicking outside the content
    domElements['first-time-modal']?.addEventListener('click', (e) => {
         if (e.target === domElements['first-time-modal']) hideFirstTimeModal();
     });

    // --- Settings Modal Content Buttons ---
    domElements['soft-refresh-button']?.addEventListener('click', softRefreshGame);

    // --- Other Top Bar/Special Buttons ---
    domElements['save-button']?.addEventListener('click', saveGame);
    domElements['delete-save-button']?.addEventListener('click', deleteSave);
    domElements['toggle-acquisition-button']?.addEventListener('click', toggleAcquisitionPause);
    domElements['toggle-flexible-workflow']?.addEventListener('click', toggleFlexibleWorkflow);

    console.log("--- Listeners Attached ---");
}