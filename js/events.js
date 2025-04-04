// js/events.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon } from './state.js';
import { buildingsConfig, upgradesConfig } from './config.js';
// Import helpers needed for purchase logic and updates
import { getBuildingCost, getUpgradeCost, calculateDerivedStats, getCurrentRates, findUpgradeConfigById } from './engine.js';
import { updateDisplay, updateButtonStates, showCredits, hideCredits, showStats, hideStats, showTutorial, hideTutorial, showSettings, hideSettings, closeWinScreen, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals } from './ui.js';
import { playSoundEffect, togglePlayPause, setVolume, playNextTrack, toggleMute } from './audio.js';
import { saveGame, deleteSave } from './saveLoad.js';
import { softRefreshGame } from './main.js';


// --- Tier Completion Check ---
function checkTierCompletion(categoryId) {
    if (!categoryId || categoryId === 'special') return false;
    const categoryConfig = upgradesConfig[categoryId];
    if (!categoryConfig || !categoryConfig.tier1) return false; // Check only based on Tier 1

    // Iterate through all upgrades defined in Tier 1 of the category config
    for (const upgradeId in categoryConfig.tier1) {
        // Check if the upgrade exists in the game state and if it's marked as purchased
        if (!gameState.upgrades[upgradeId]?.purchased) {
            // If any T1 upgrade is not found or not purchased, the tier isn't complete
            return false;
        }
    }
    // If the loop completes without returning false, all T1 upgrades are purchased
    return true;
}

// --- Purchase Functions ---
function buyBuilding(id) {
    // (Keep existing buyBuilding function - unchanged)
    if (isGamePaused || isGameWon) return;
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state) { console.error(`Building config or state not found for ID: ${id}`); return; }

    const cost = getBuildingCost(id);
    const curr = cfg.costCurrency;
    let afford = false;

    if (curr === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; afford = true; } }
    else if (curr === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; afford = true; } }

    if (afford) {
        state.count++;
        playSoundEffect('sfx-purchase');
        calculateDerivedStats(); // Recalculate rates immediately
        updateDisplay(); // Update resource numbers
        updateButtonStates(); // Update button costs and availability
    }
}

function buyUpgrade(upgradeId) {
    // (Keep existing checks for paused/won/config/purchased - unchanged)
    if (isGamePaused || isGameWon) return;
    const found = findUpgradeConfigById(upgradeId);
    if (!found) { console.error(`Upgrade config not found for ID: ${upgradeId}`); return; }

    const cfg = found.config;
    const effectiveCategoryId = found.categoryId;
    const effectiveTier = found.tier;
    const state = gameState.upgrades[upgradeId];
    if (!state || state.purchased) return;

    const cost = getUpgradeCost(upgradeId);
    let afford = false;

    // (Keep affordability check logic - unchanged, covers new upgrade costs too)
    if (cfg.costMoney && cfg.costCustomers) {
        if (gameState.money >= cost.money && gameState.customers >= cost.customers) {
            gameState.money -= cost.money;
            gameState.customers -= cost.customers;
            afford = true;
        }
    }
    else if (cfg.costCurrency === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; afford = true; } }
    else if (cfg.costCurrency === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; afford = true; } }
    else if (cfg.costCurrency === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; afford = true; } }
    else if (cfg.costCurrency === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; afford = true; } }
    else if (cfg.costCurrency === 'customers') { if (gameState.customers >= cost.customers) { gameState.customers -= cost.customers; afford = true; } }

    if (afford) {
        state.purchased = true;
        playSoundEffect('sfx-purchase');

        // Apply immediate effects if defined in config
        // This directly modifies gameState properties like baseCAR, acquisitionSuccessChance, etc.
        if (typeof cfg.effect === 'function') {
            cfg.effect(gameState);
        }
        // Note: The old `targetRate` mechanism is removed as effects are now direct modifications.
        // The `effectValue` property is no longer used by engine.js for CAR/CVR calculations.

        // Check for Tier 1 completion to unlock Tier 2
        if (effectiveTier === 1 && effectiveCategoryId && effectiveCategoryId !== 'special') {
            if (checkTierCompletion(effectiveCategoryId)) {
                console.log(`Tier 1 completed for category: ${effectiveCategoryId}. Advancing to Tier 2.`);
                gameState.categoryTiers[effectiveCategoryId] = 2;
            }
        }

        calculateDerivedStats(); // Recalculate rates after applying effects
        updateDisplay(); // Update resource numbers
        updateButtonStates(); // Update button states/redraw category if tier changed
    }
}

// --- Action Toggles ---
// (Keep existing toggle functions - unchanged)
function toggleAcquisitionPause() { if (isGameWon || isGamePaused) return; gameState.isAcquisitionPaused = !gameState.isAcquisitionPaused; updateAcquisitionButtonVisuals(); }
function toggleFlexibleWorkflow() { if (isGamePaused || isGameWon || !gameState.upgrades['flexibleWorkflow']?.purchased) return; gameState.flexibleWorkflowActive = !gameState.flexibleWorkflowActive; console.log(`Flexible Workflow manually ${gameState.flexibleWorkflowActive ? 'activated' : 'deactivated'}.`); calculateDerivedStats(); updateDisplay(); updateFlexibleWorkflowToggleButtonVisuals(); }

// --- Category Collapse/Expand ---
// (Keep existing toggleCategoryCollapse function - unchanged)
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
// (Keep existing setupEventListeners function structure, including clickers, delegation, modals, etc. - unchanged)
export function setupEventListeners() {
    console.log("--- Attaching Listeners ---");

    // --- Clickers ---
    domElements['click-lead-button']?.addEventListener('click', () => { if (isGamePaused || isGameWon) return; const rates = getCurrentRates(); const clickBoost = gameState.activeBoosts?.['clickBoost']; const baseClickMultiplier = gameState.globalClickMultiplier || 1.0; const powerupClickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0; const totalClickMultiplier = baseClickMultiplier * powerupClickMultiplier; let baseAmt = gameState.leadsPerClick; let currentLPS = rates.leadsPerSecond; let percentBonusVal = gameState.leadClickPercentBonus || 0; let percentBonusAmt = currentLPS * percentBonusVal; if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) percentBonusAmt = 0; let amt = (baseAmt + percentBonusAmt) * totalClickMultiplier; if (isNaN(amt) || !isFinite(amt) || amt <=0) return; gameState.leads += amt; gameState.totalLeadClicks++; gameState.totalManualLeads += amt; updateDisplay(); });
    domElements['click-opp-button']?.addEventListener('click', () => { if (isGamePaused || isGameWon) return; const rates = getCurrentRates(); const clickBoost = gameState.activeBoosts?.['clickBoost']; const baseClickMultiplier = gameState.globalClickMultiplier || 1.0; const powerupClickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0; const totalClickMultiplier = baseClickMultiplier * powerupClickMultiplier; let baseAmt = gameState.opportunitiesPerClick; let currentOPS = rates.opportunitiesPerSecond; let percentBonusVal = gameState.oppClickPercentBonus || 0; let percentBonusAmt = currentOPS * percentBonusVal; if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) percentBonusAmt = 0; let amt = (baseAmt + percentBonusAmt) * totalClickMultiplier; if (isNaN(amt) || !isFinite(amt) || amt <=0) return; gameState.opportunities += amt; gameState.totalOppClicks++; gameState.totalManualOpps += amt; updateDisplay(); });

    // --- Building Purchases (Event Delegation on Buildables Panel) ---
    const buildPanel = document.querySelector('.buildables-panel');
    if (buildPanel) {
        buildPanel.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.build-button');
            if (targetButton && targetButton.id && targetButton.id.startsWith('buy-')) {
                const buildingId = targetButton.id.substring(4);
                if (buildingsConfig[buildingId]) {
                    buyBuilding(buildingId);
                } else {
                    console.warn(`Clicked build button with unrecognized ID: ${buildingId}`);
                }
            }
        });
    } else { console.error("Buildables panel not found for event delegation."); }

    // --- Upgrade Purchases (Event Delegation on Upgrades Panel) ---
    const upgradePanel = document.querySelector('.upgrades-panel');
    if (upgradePanel) {
        upgradePanel.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.upgrade-button');
            if (targetButton && targetButton.id) {
                const upgradeId = targetButton.dataset.upgradeId || targetButton.id.substring(8);
                if (findUpgradeConfigById(upgradeId)) {
                    buyUpgrade(upgradeId);
                } else {
                    console.warn(`Clicked upgrade button with unrecognized ID: ${upgradeId}`);
                }
            }
        });
    } else { console.error("Upgrades panel not found for event delegation."); }

    // --- Category Collapse/Expand (Event Delegation on both side panels) ---
    upgradePanel?.addEventListener('click', toggleCategoryCollapse);
    buildPanel?.addEventListener('click', toggleCategoryCollapse);

    // --- Music Controls ---
    domElements['play-pause-button']?.addEventListener('click', togglePlayPause);
    domElements['volume-slider']?.addEventListener('input', () => setVolume());
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
    domElements['close-win-button']?.addEventListener('click', closeWinScreen);

    // --- Settings Modal Content Buttons ---
    domElements['soft-refresh-button']?.addEventListener('click', softRefreshGame);

    // --- Other Top Bar/Special Buttons ---
    domElements['save-button']?.addEventListener('click', saveGame);
    domElements['delete-save-button']?.addEventListener('click', deleteSave);
    domElements['toggle-acquisition-button']?.addEventListener('click', toggleAcquisitionPause);
    domElements['toggle-flexible-workflow']?.addEventListener('click', toggleFlexibleWorkflow);

    console.log("--- Listeners Attached (including collapse toggle) ---");
}