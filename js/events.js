// js/events.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon } from './state.js';
import { buildingsConfig, upgradesConfig } from './config.js';
import { getBuildingCost, getUpgradeCost, calculateDerivedStats, getCurrentRates } from './engine.js';
import { updateDisplay, updateButtonStates, showCredits, hideCredits, showStats, hideStats, showTutorial, hideTutorial, closeWinScreen, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals } from './ui.js';
import { playSoundEffect, togglePlayPause, setVolume, playNextTrack, toggleMute } from './audio.js';
import { saveGame, deleteSave } from './saveLoad.js';

// --- Purchase Functions ---
function buyBuilding(id) {
    if (isGamePaused || isGameWon) return;
    const cfg = buildingsConfig[id];
    const state = gameState.buildings[id]; // gameState should be initialized before listeners setup
    if (!cfg || !state) return;

    const cost = getBuildingCost(id);
    const curr = cfg.costCurrency;
    let afford = false;

    if (curr === 'both') {
        if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) {
            gameState.leads -= cost.leads;
            gameState.opportunities -= cost.opps;
            afford = true;
        }
    } else if (curr === 'leads') {
        if (gameState.leads >= cost.leads) {
            gameState.leads -= cost.leads;
            afford = true;
        }
    } else if (curr === 'opportunities') {
        if (gameState.opportunities >= cost.opps) {
            gameState.opportunities -= cost.opps;
            afford = true;
        }
    } else if (curr === 'money') {
         if (gameState.money >= cost.money) {
            gameState.money -= cost.money;
            afford = true;
        }
    }

    if (afford) {
        state.count++;
        playSoundEffect('sfx-purchase');
        calculateDerivedStats(); // Recalculate rates
        updateDisplay();       // Update numbers
        updateButtonStates();  // Update button enable/disable/cost
    }
}

function buyUpgrade(id) {
    if (isGamePaused || isGameWon) return;
    const cfg = upgradesConfig[id];
    const state = gameState.upgrades[id];
    if (!cfg || !state || state.purchased) return;

    const cost = getUpgradeCost(id);
    let afford = false;

    if (id === 'flexibleWorkflow') {
        if (gameState.money >= cost.money && gameState.customers >= cost.customers) {
            gameState.money -= cost.money;
            gameState.customers -= cost.customers;
            afford = true;
        }
    } else if (cfg.costCurrency === 'both') {
        if (gameState.leads >= cost.leads && gameState.opportunities >= cost.opps) {
            gameState.leads -= cost.leads;
            gameState.opportunities -= cost.opps;
            afford = true;
        }
    } else if (cfg.costCurrency === 'leads') {
        if (gameState.leads >= cost.leads) {
            gameState.leads -= cost.leads;
            afford = true;
        }
    } else if (cfg.costCurrency === 'opportunities') {
        if (gameState.opportunities >= cost.opps) {
            gameState.opportunities -= cost.opps;
            afford = true;
        }
    } else if (cfg.costCurrency === 'money') {
        if (gameState.money >= cost.money) {
            gameState.money -= cost.money;
            afford = true;
        }
    } else if (cfg.costCurrency === 'customers') {
        if (gameState.customers >= cost.customers) {
            gameState.customers -= cost.customers;
            afford = true;
        }
    }

    if (afford) {
        state.purchased = true;
        playSoundEffect('sfx-purchase');
        // Apply instant effect if defined
        if (typeof cfg.effect === 'function') {
            cfg.effect(gameState);
        }
        calculateDerivedStats(); // Recalculate rates (important for CVR/CAR boosts etc)
        updateDisplay();       // Update numbers
        updateButtonStates();  // Update button appearance (purchased state)
    }
}


// --- Action Toggles ---
function toggleAcquisitionPause() {
    if (isGameWon || isGamePaused) return;
    gameState.isAcquisitionPaused = !gameState.isAcquisitionPaused;
    updateAcquisitionButtonVisuals(); // Update button text/style
}

function toggleFlexibleWorkflow() {
    if (isGamePaused || isGameWon || !gameState.upgrades['flexibleWorkflow']?.purchased) return;
    gameState.flexibleWorkflowActive = !gameState.flexibleWorkflowActive;
    console.log(`Flexible Workflow manually ${gameState.flexibleWorkflowActive ? 'activated' : 'deactivated'}.`);
    // Recalculate derived stats immediately to reflect the change for the *next* tick
    calculateDerivedStats();
    updateDisplay();         // Update displayed rates based on immediate recalculation
    updateButtonStates();    // Update toggle button appearance
}

// --- Event Listener Setup ---
export function setupEventListeners() {
    console.log("--- Attaching Listeners ---");

    // Clickers
    domElements['click-lead-button']?.addEventListener('click', () => {
        if (isGamePaused || isGameWon) return;

        const rates = getCurrentRates(); // Get current rates for bonus calc
        const clickBoost = gameState.activeBoosts?.['clickBoost'];
        const clickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;

        let baseAmt = gameState.leadsPerClick;
        let currentLPS = rates.leadsPerSecond;
        let percentBonusVal = gameState.leadClickPercentBonus || 0;
        let percentBonusAmt = currentLPS * percentBonusVal;

        if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) percentBonusAmt = 0;

        let amt = (baseAmt + percentBonusAmt) * clickMultiplier;
        if (isNaN(amt) || !isFinite(amt)) amt = 0; // Safety check

        if (amt > 0) {
            gameState.leads += amt;
            gameState.totalLeadClicks++;
            gameState.totalManualLeads += amt;
            updateDisplay(); // Quick update for visual feedback
            // updateButtonStates(); // Optional: update buttons immediately if click affects affordability
        }
    });

    domElements['click-opp-button']?.addEventListener('click', () => {
        if (isGamePaused || isGameWon) return;

        const rates = getCurrentRates();
        const clickBoost = gameState.activeBoosts?.['clickBoost'];
        const clickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;

        let baseAmt = gameState.opportunitiesPerClick;
        let currentOPS = rates.opportunitiesPerSecond;
        let percentBonusVal = gameState.oppClickPercentBonus || 0;
        let percentBonusAmt = currentOPS * percentBonusVal;

        if (isNaN(percentBonusAmt) || !isFinite(percentBonusAmt)) percentBonusAmt = 0;

        let amt = (baseAmt + percentBonusAmt) * clickMultiplier;
        if (isNaN(amt) || !isFinite(amt)) amt = 0;

        if (amt > 0) {
            gameState.opportunities += amt;
            gameState.totalOppClicks++;
            gameState.totalManualOpps += amt;
            updateDisplay();
            // updateButtonStates();
        }
    });

    // Purchases
    for (const id in buildingsConfig) {
        domElements[`buy-${id}`]?.addEventListener('click', () => buyBuilding(id));
    }
    for (const id in upgradesConfig) {
        domElements[`upgrade-${id}`]?.addEventListener('click', () => buyUpgrade(id));
    }

    // Music Controls
    domElements['play-pause-button']?.addEventListener('click', togglePlayPause);
    domElements['volume-slider']?.addEventListener('input', () => setVolume()); // Pass no arg to read from slider
    domElements['next-track-button']?.addEventListener('click', playNextTrack);
    domElements['background-music']?.addEventListener('ended', playNextTrack); // Autoplay next
    domElements['mute-button']?.addEventListener('click', () => toggleMute());

    // Modals
    domElements['credits-button']?.addEventListener('click', showCredits);
    domElements['close-credits-button']?.addEventListener('click', hideCredits);
    domElements['credits-modal']?.addEventListener('click', (e) => { if (e.target === domElements['credits-modal']) hideCredits(); }); // Close on background click

    domElements['stats-button']?.addEventListener('click', showStats);
    domElements['close-stats-button']?.addEventListener('click', hideStats);
    domElements['stats-modal']?.addEventListener('click', (e) => { if (e.target === domElements['stats-modal']) hideStats(); });

    domElements['tutorial-button']?.addEventListener('click', showTutorial);
    domElements['close-tutorial-button']?.addEventListener('click', hideTutorial);
    domElements['tutorial-modal']?.addEventListener('click', (e) => { if (e.target === domElements['tutorial-modal']) hideTutorial(); });

    domElements['close-win-button']?.addEventListener('click', closeWinScreen);

    // Save/Delete/Toggles
    domElements['save-button']?.addEventListener('click', saveGame);
    domElements['delete-save-button']?.addEventListener('click', deleteSave);
    domElements['toggle-acquisition-button']?.addEventListener('click', toggleAcquisitionPause);
    domElements['settings-button']?.addEventListener('click', () => alert('Settings Not Implemented Yet.'));
    domElements['toggle-flexible-workflow']?.addEventListener('click', toggleFlexibleWorkflow);

    console.log("--- Listeners Attached ---");
}