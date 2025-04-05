// js/events.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon } from './state.js';
import { buildingsConfig, upgradesConfig } from './config.js';
// Import helpers needed for purchase logic and updates
import { getBuildingCost, getUpgradeCost, calculateDerivedStats, getCurrentRates, findUpgradeConfigById, getCumulativeBuildingCost } from './engine.js';
import { updateDisplay, updateButtonStates, showCredits, hideCredits, showStats, hideStats, showTutorial, hideTutorial, showSettings, hideSettings, closeWinScreen, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals } from './ui.js';
import { playSoundEffect, togglePlayPause, setVolume, playNextTrack, toggleMute } from './audio.js';
import { saveGame, deleteSave } from './saveLoad.js';
import { softRefreshGame } from './main.js';


// --- Tier Completion Check ---
function checkTierCompletion(categoryId) {
    if (!categoryId || categoryId === 'special') return false;
    const categoryConfig = upgradesConfig[categoryId];
    // Ensure Tier 1 exists in the config for this category
    if (!categoryConfig || !categoryConfig.tier1) {
        // console.warn(`Tier 1 config not found for category: ${categoryId}`);
        return false;
    }

    // Iterate through all upgrades defined in Tier 1 of the category config
    for (const upgradeId in categoryConfig.tier1) {
        // Check if the upgrade exists in the game state and if it's marked as purchased
        if (!gameState.upgrades[upgradeId]?.purchased) {
            // If any T1 upgrade is not found or not purchased, the tier isn't complete
            return false;
        }
    }
    // If the loop completes without returning false, all T1 upgrades are purchased
    // console.log(`Tier 1 check passed for ${categoryId}`);
    return true;
}

// --- Purchase Functions ---
// TODO: Updated buyBuilding to handle Shift+Click for x10 purchase
function buyBuilding(id, shiftHeld = false) {
    // Prevent actions if game inactive
    if (isGamePaused || isGameWon) return;
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id];
    if (!cfg || !state) { console.error(`Building config or state not found for ID: ${id}`); return; }

    const quantityToBuy = shiftHeld ? 10 : 1;
    const cost = shiftHeld ? getCumulativeBuildingCost(id, quantityToBuy) : getBuildingCost(id); // Get cost for 1 or 10
    const curr = cfg.costCurrency;
    let afford = false;

    // Check affordability based on currency type and quantity
    if (curr === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; afford = true; } }
    else if (curr === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; afford = true; } }
    else if (curr === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; afford = true; } }

    // If affordable, process the purchase
    if (afford) {
        state.count += quantityToBuy; // Increment building count by quantity purchased
        playSoundEffect('sfx-purchase'); // Play sound
        calculateDerivedStats(); // Recalculate rates immediately
        updateDisplay(); // Update resource numbers
        updateButtonStates(); // Update button costs and availability
    } else {
        // Optional: Provide feedback if trying Shift+Click and cannot afford
        if (shiftHeld) {
             console.log(`Cannot afford to buy 10 ${cfg.name}.`);
             // Maybe flash the button red briefly? (Requires CSS and timeout)
        }
    }
}

// TODO: Updated buyUpgrade to handle Customer Requirements
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

    const cost = getUpgradeCost(upgradeId); // Calculates cost or requirement
    let afford = false;
    let meetsRequirement = false;

    // 1. Check Customer Requirement FIRST
    if (cost.requiresCustomers && cost.requiresCustomers > 0) {
        if (gameState.customers >= cost.requiresCustomers) {
            meetsRequirement = true; // Mark requirement as met
            afford = true; // Considered 'affordable' if requirement met, no cost deduction needed
        }
    } else {
        // 2. If no customer requirement, check standard costs
        if (cfg.costMoney && cfg.costCustomers) { // Handles special upgrades like Flexible Workflow, Playtime Boost
            if (gameState.money >= cost.money && gameState.customers >= cost.customers) {
                gameState.money -= cost.money;
                gameState.customers -= cost.customers; // Deduct cost
                afford = true;
            }
        }
        else if (cfg.costCurrency === 'both') { if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) { gameState.leads -= cost.leads; gameState.opportunities -= cost.opps; afford = true; } }
        else if (cfg.costCurrency === 'leads') { if (gameState.leads >= cost.leads) { gameState.leads -= cost.leads; afford = true; } }
        else if (cfg.costCurrency === 'opportunities') { if (gameState.opportunities >= cost.opps) { gameState.opportunities -= cost.opps; afford = true; } }
        else if (cfg.costCurrency === 'money') { if (gameState.money >= cost.money) { gameState.money -= cost.money; afford = true; } }
        else if (cfg.costCurrency === 'customers') { // Deprecated? Only use requiresCustomers now
            console.warn(`Upgrade ${upgradeId} uses 'costCurrency: customers'. Consider using 'requiresCustomers'.`);
            if (gameState.customers >= cost.customers) { gameState.customers -= cost.customers; afford = true; }
        }
    }


    // If affordable (met cost OR requirement), process the purchase
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
function toggleFlexibleWorkflow() { if (isGamePaused || isGameWon || !gameState.upgrades['flexibleWorkflow']?.purchased) return; gameState.flexibleWorkflowActive = !gameState.flexibleWorkflowActive; console.log(`Flexible Workflow manually ${gameState.flexibleWorkflowActive ? 'activated' : 'deactivated'}.`); calculateDerivedStats(); /* Recalc needed */ updateDisplay(); updateFlexibleWorkflowToggleButtonVisuals(); }

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
    domElements['click-lead-button']?.addEventListener('click', () => {
        if (isGamePaused || isGameWon) return;
        const rates = getCurrentRates(); // Get current rates for bonus calc
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
        if (isNaN(amt) || !isFinite(amt) || amt <=0) amt = (amt <= 0 ? 0 : baseAmt * totalClickMultiplier); // Fallback if bonus calc fails
        if (amt > 0) {
            gameState.leads += amt;
            gameState.totalLeadClicks++;
            gameState.totalManualLeads += amt;
            updateDisplay(); // Update display only if something changed
        }
    });
    domElements['click-opp-button']?.addEventListener('click', () => {
        if (isGamePaused || isGameWon) return;
        const rates = getCurrentRates(); // Get current rates for bonus calc
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
        if (isNaN(amt) || !isFinite(amt) || amt <=0) amt = (amt <= 0 ? 0 : baseAmt * totalClickMultiplier); // Fallback if bonus calc fails
        if (amt > 0) {
            gameState.opportunities += amt;
            gameState.totalOppClicks++;
            gameState.totalManualOpps += amt;
            updateDisplay(); // Update display only if something changed
        }
    });

    // --- Building Purchases (Event Delegation on Buildables Panel) ---
    const buildPanel = document.querySelector('.buildables-panel');
    if (buildPanel) {
        buildPanel.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.build-button');
            if (targetButton && !targetButton.disabled && targetButton.id && targetButton.id.startsWith('buy-')) { // Check !disabled
                const buildingId = targetButton.id.substring(4);
                if (buildingsConfig[buildingId]) {
                    const shiftHeld = event.shiftKey; // Check if Shift key is pressed
                    buyBuilding(buildingId, shiftHeld); // Pass shift key status
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
            if (targetButton && !targetButton.disabled && targetButton.id) { // Check !disabled
                // Use dataset if available (for tiered), fallback to ID parsing (for special)
                const upgradeId = targetButton.dataset.upgradeId || targetButton.id.substring(8);
                if (findUpgradeConfigById(upgradeId)) { // Check if it's a valid upgrade ID
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
    domElements['volume-slider']?.addEventListener('input', () => setVolume()); // Use input for smoother updates
    domElements['volume-slider']?.addEventListener('change', () => setVolume()); // Ensure final value is set
    domElements['next-track-button']?.addEventListener('click', playNextTrack);
    domElements['background-music']?.addEventListener('ended', playNextTrack);
    domElements['mute-button']?.addEventListener('click', () => toggleMute());

    // --- Modal Open/Close ---
    const setupModal = (buttonId, modalId, showFn, hideFn) => {
        const openBtn = domElements[buttonId];
        const modal = domElements[modalId];
        const closeBtn = domElements[`close-${buttonId.replace('-button', '')}-button`]; // Auto-find close button ID
        openBtn?.addEventListener('click', showFn);
        closeBtn?.addEventListener('click', hideFn);
        // Close modal if clicking outside the content area
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

    console.log("--- Listeners Attached ---");
}