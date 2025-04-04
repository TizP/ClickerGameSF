// js/saveLoad.js
"use strict";
// Imports gameState to allow modification during load
import { gameState, initializeStructureState, getDefaultGameState } from './state.js';
import { SAVE_KEY, buildingsConfig, upgradesConfig } from './config.js'; // upgradesConfig needed for sanitization check
import { restartBoostTimersOnLoad } from './powerups.js';
import { calculateDerivedStats } from './engine.js';
import { displaySaveStatus } from './ui.js';
import { stopAllIntervals } from './main.js'; // Import interval control

export function saveGame() {
    // Allow saving even if paused or won
    try {
        const stateToSave = { ...gameState };
        // Don't save transient data like interval IDs or timeout IDs
        delete stateToSave.powerupTimeouts;

        // --- Add potentially missing states if needed before saving ---
        // Ensure audio related states are present if they exist in the running game
        const musicEl = document.getElementById('background-music'); // Check directly if needed
        if (musicEl) {
             stateToSave.currentTrackIndex = stateToSave.currentTrackIndex ?? 0;
             stateToSave.musicShouldBePlaying = stateToSave.musicShouldBePlaying ?? false;
             stateToSave.lastVolume = stateToSave.lastVolume ?? 0.1;
        }
        // -----------------------------------------------------------

        localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
        displaySaveStatus(`Saved: ${new Date().toLocaleTimeString()}`);
    } catch (e) {
        console.error("Save error:", e);
        // Provide more specific feedback if possible (e.g., storage full)
        if (e.name === 'QuotaExceededError') {
            displaySaveStatus("Save Error: Storage Full!", 5000);
        } else {
            displaySaveStatus("Save Error!", 5000);
        }
    }
}

export function loadGame() {
    const json = localStorage.getItem(SAVE_KEY);
    let loadedState = null; // Start with null to clearly distinguish between load success/fail/no save
    let loadSuccessful = false;

    if (json) {
        try {
            loadedState = JSON.parse(json); // Attempt to parse saved data

            // IMPORTANT: Sanitize the loaded state AFTER parsing but BEFORE assigning to global state
            // This applies defaults, removes deprecated items, checks types based on current config
            initializeStructureState(loadedState, false); // isInitial = false
            loadSuccessful = true;
            console.log("Save data parsed successfully.");

        } catch (e) {
            console.error("Load error - save corrupted or incompatible:", e);
            displaySaveStatus("Load Error! Resetting.", 5000);
            localStorage.removeItem(SAVE_KEY); // Delete bad save
            // Get a fresh default state
            loadedState = getDefaultGameState(); // This already calls initializeStructureState(..., true)
            loadSuccessful = false; // Indicate load failed, using defaults now
        }
    } else {
        console.log("No save found, starting new game.");
        // Get a fresh default state
        loadedState = getDefaultGameState(); // This already calls initializeStructureState(..., true)
        loadSuccessful = false; // Not really a 'success' but indicates we're using defaults
    }

    // Assign the loaded (or default/reset) state to the global gameState
    // Overwrite existing properties instead of reassigning the reference
    Object.keys(loadedState).forEach(key => {
        gameState[key] = loadedState[key];
    });
     // Remove keys from gameState that are no longer in the loaded/default state (e.g., after a reset or config change)
     Object.keys(gameState).forEach(key => {
         if (!loadedState.hasOwnProperty(key)) {
             delete gameState[key];
         }
     });


    // Restart timers AFTER gameState is fully updated from loadedState
    if (loadSuccessful && gameState.activeBoosts) { // Check if activeBoosts exists
        restartBoostTimersOnLoad(); // Handles activeBoosts and clears old timeouts
        console.log("Save Loaded and boost timers restarted.");
        displaySaveStatus("Save loaded.");
    } else if (!loadSuccessful && !json) {
        displaySaveStatus("New game started.");
    }

    // Initial calculation after load/default setup is applied to gameState
    calculateDerivedStats();

    // Return value could indicate if a *saved game* was successfully loaded vs starting fresh/reset
    return loadSuccessful;
}

export function deleteSave() {
    if (confirm("Are you sure you want to delete your save data? This cannot be undone.")) {
        stopAllIntervals(); // Stop game loops before deleting/reloading
        localStorage.removeItem(SAVE_KEY);
        displaySaveStatus("Save deleted. Reloading...", 3000);
        // Use a slightly longer timeout to ensure the message is seen before reload
        setTimeout(() => window.location.reload(), 1500);
    }
}