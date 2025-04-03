// js/saveLoad.js
"use strict";
import { gameState, initializeStructureState, getDefaultGameState } from './state.js';
import { SAVE_KEY, buildingsConfig, upgradesConfig } from './config.js';
import { restartBoostTimersOnLoad } from './powerups.js';
import { calculateDerivedStats } from './engine.js';
import { displaySaveStatus } from './ui.js';
import { stopAllIntervals } from './main.js'; // Import interval control

export function saveGame() {
    // Allow saving even if paused, but maybe not if won? Or allow always?
    // if (isGamePaused && !isGameWon) return; // Original logic
    try {
        // Create a shallow copy to avoid modifying the original gameState object directly
        const stateToSave = { ...gameState };
        // Remove transient data that shouldn't be saved
        delete stateToSave.powerupTimeouts;

        localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
        displaySaveStatus(`Saved: ${new Date().toLocaleTimeString()}`);
    } catch (e) {
        console.error("Save error:", e);
        displaySaveStatus("Save Error!", 5000);
        // Consider more robust error handling, e.g., trying to save a backup
    }
}

export function loadGame() {
    const json = localStorage.getItem(SAVE_KEY);
    let loadedState = getDefaultGameState(); // Start with default
    let loadSuccessful = false;

    if (json) {
        try {
            const data = JSON.parse(json);
            // Carefully merge loaded data into the default state structure
            // This prevents issues if the save format is slightly outdated
            for (const key in loadedState) {
                if (key === 'powerupTimeouts') continue; // Skip transient

                if (data.hasOwnProperty(key)) {
                    if (key === 'activeBoosts' && typeof data.activeBoosts === 'object' && data.activeBoosts !== null) {
                        loadedState.activeBoosts = data.activeBoosts; // Overwrite boosts entirely
                    } else if ((key === 'buildings' || key === 'upgrades') && typeof data[key] === 'object' && data[key] !== null) {
                       // Merge buildings/upgrades carefully
                       for(const id in data[key]) {
                            // Only load data for buildings/upgrades that still exist in config
                           if ((key === 'buildings' && buildingsConfig[id]) || (key === 'upgrades' && upgradesConfig[id])) {
                               if (!loadedState[key][id]) loadedState[key][id] = {}; // Ensure sub-object exists
                               // Merge known properties (e.g., count, purchased)
                               if (data[key][id].hasOwnProperty('count')) loadedState[key][id].count = data[key][id].count;
                               if (data[key][id].hasOwnProperty('purchased')) loadedState[key][id].purchased = data[key][id].purchased;
                           }
                       }
                    } else if (typeof loadedState[key] !== 'object' || loadedState[key] === null) {
                        // Overwrite simple values (numbers, strings, booleans)
                        loadedState[key] = data[key];
                    } else {
                         // Potentially log unhandled object types during load
                         console.warn(`Unhandled object type during load merge: ${key}`);
                        // loadedState[key] = data[key]; // Or avoid overwriting complex objects unless explicitly handled
                    }
                }
            }

            // Once merged, sanitize and validate the structure
            initializeStructureState(loadedState, false); // isInitial = false
            loadSuccessful = true;

        } catch (e) {
            console.error("Load error - save corrupted or incompatible:", e);
            displaySaveStatus("Load Error! Resetting.", 5000);
            localStorage.removeItem(SAVE_KEY); // Delete bad save
            loadedState = getDefaultGameState(); // Reset to default
        }
    } else {
        console.log("No save found, starting new game.");
        // No need to do anything, loadedState is already default
    }

     // Assign the potentially loaded (or default) state to the global gameState
     Object.assign(gameState, loadedState);


    // Restart timers AFTER gameState is fully updated
    if (loadSuccessful) {
        restartBoostTimersOnLoad();
        console.log("Save Loaded.");
        displaySaveStatus("Save loaded.");
    }

    // Initial calculation after load/default setup
    calculateDerivedStats();

    return loadSuccessful;
}

export function deleteSave() {
    if (confirm("Are you sure you want to delete your save data? This cannot be undone.")) {
        localStorage.removeItem(SAVE_KEY);
        displaySaveStatus("Save deleted. Reloading...", 3000);
        stopAllIntervals(); // Stop game loops before reloading
        // Reload the page to start fresh
        setTimeout(() => window.location.reload(), 1500);
    }
}