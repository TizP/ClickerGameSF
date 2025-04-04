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
    // Prevent actions if game inactive
    if (isGamePaused || isGameWon) return;
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state) { console.error(`Building config or state not found for ID: ${id}`); return; }

    const cost = getBuildingCost(id); // Calculates current cost based on count & multipliers
    const curr = cfg.costCurrency;
    let afford = false;

    // Check affordability based on currency type
    if (curr === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; afford = true; } }
    else if (curr === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; afford = true; } }

    // If affordable, process the purchase
    if (afford) {
        state.count++; // Increment building count
        playSoundEffect('sfx-purchase'); // Play sound
        calculateDerivedStats(); // Recalculate rates immediately
        updateDisplay(); // Update resource numbers
        updateButtonStates(); // Update button costs and availability
    }
}

function buyUpgrade(upgradeId) {
    // Prevent actions if game inactive
    if (isGamePaused || isGameWon) return;
    const found = findUpgradeConfigById(upgradeId);
    if (!found) { console.error(`Upgrade config not found for ID: ${upgradeId}`); return; }

    const cfg = found.config;
    const effectiveCategoryId = found.categoryId; // e.g., 'manualGen'
    const effectiveTier = found.tier; // e.g., 1 or null for special
    const state = gameState.upgrades[upgradeId];

    // Prevent purchase if already bought or state is missing
    if (!state || state.purchased) return;

    const cost = getUpgradeCost(upgradeId); // Calculates cost based on config
    let afford = false;

    // Check affordability based on various cost types
    if (cfg.costMoney && cfg.costCustomers) { // Handles Flexible Workflow & Playtime Boost
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

    // If affordable, process the purchase
    if (afford) {
        state.purchased = true; // Mark as purchased
        playSoundEffect('sfx-purchase'); // Play sound

        // Apply immediate effects if defined in config
        // This directly modifies gameState properties like baseCAR, acquisitionSuccessChance, multipliers etc.
        if (typeof cfg.effect === 'function') {
            cfg.effect(gameState);
        }

        // Check for Tier 1 completion to unlock Tier 2 for that category
        if (effectiveTier === 1 && effectiveCategoryId && effectiveCategoryId !== 'special') {
            if (checkTierCompletion(effectiveCategoryId)) {
                console.log(`Tier 1 completed for category: ${effectiveCategoryId}. Advancing to Tier 2.`);
                gameState.categoryTiers[effectiveCategoryId] = 2; // Update category tier
            }
        }

        calculateDerivedStats(); // Recalculate rates immediately
        updateDisplay(); // Update resource numbers
        updateButtonStates(); // Update button states/redraw category if tier changed
    }
}

// --- Action Toggles ---
function toggleAcquisitionPause() { if (isGameWon || isGamePaused) return; gameState.isAcquisitionPaused = !gameState.isAcquisitionPaused; updateAcquisitionButtonVisuals(); }
function toggleFlexibleWorkflow() { if (isGamePaused || isGameWon || !gameState.upgrades['flexibleWorkflow']?.purchased) return; gameState.flexibleWorkflowActive = !gameState.flexibleWorkflowActive; console.log(`Flexible Workflow manually ${gameState.flexibleWorkflowActive ? 'activated' : 'deactivated'}.`); calculateDerivedStats(); updateDisplay(); updateFlexibleWorkflowToggleButtonVisuals(); }

// --- Category Collapse/Expand ---
function toggleCategoryCollapse(event) {
    // Find the H4 title element that was clicked or contains the clicked icon
    const titleElement = event.target.closest('h4.group-title');
    if (!titleElement) return; // Click wasn't on a title or its child icon

    // Find the next sibling element, which should be the content container
    const contentElement = titleElement.nextElementSibling;

    // Check if the next sibling is indeed one of the collapsible containers
    if (contentElement && (contentElement.classList.contains('upgrade-category-container') || contentElement.classList.contains('build-category-container'))) {
        titleElement.classList.toggle('collapsed'); // Toggle state class on the title
        contentElement.classList.toggle('content-collapsed'); // Toggle visibility class on the content
    } else {
        console.warn("Could not find collapsible content for title:", titleElement.textContent);
    }
}


// --- Event Listener Setup ---
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