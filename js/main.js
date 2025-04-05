// js/main.js - Main entry point
"use strict";

import { GAME_VERSION, TICK_INTERVAL_MS, DISPLAY_UPDATE_INTERVAL_MS, BUTTON_UPDATE_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS, POWERUP_SPAWN_INTERVAL_MS, WIN_AMOUNT, playlist } from './config.js';
import { cacheDOMElements, domElements } from './dom.js';
import { gameState, isGameWon, isGamePaused, setGamePaused, setGameWon, getDefaultGameState, initializeStructureState } from './state.js';
import { loadGame, saveGame } from './saveLoad.js';
import { setVolume, loadTrack, updateMuteButtonVisuals, playCurrentTrack, pauseCurrentTrack, updatePlayPauseIcon } from './audio.js';
import { updateDisplay, updateButtonStates, triggerWin, hideSettings, displaySaveStatus, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals } from './ui.js';
import { setupEventListeners } from './events.js';
import { gameLoop, calculateDerivedStats } from './engine.js';
import { trySpawnPowerup, startPowerupSpawning, stopPowerupSpawning, removeActivePowerupToken, restartBoostTimersOnLoad } from './powerups.js'; // Ensure powerup imports are correct

// --- Interval Management ---
let gameLoopIntervalId = null;
let displayUpdateIntervalId = null;
let buttonUpdateIntervalId = null;
let autoSaveIntervalId = null;
// powerupSpawnIntervalId is managed within powerups.js

// Exported for use in saveLoad.js and softRefreshGame
export function stopAllIntervals() {
    // Clear primary game loops
    if (gameLoopIntervalId) { clearInterval(gameLoopIntervalId); gameLoopIntervalId = null; }
    if (displayUpdateIntervalId) { clearInterval(displayUpdateIntervalId); displayUpdateIntervalId = null; }
    if (buttonUpdateIntervalId) { clearInterval(buttonUpdateIntervalId); buttonUpdateIntervalId = null; }
    if (autoSaveIntervalId) { clearInterval(autoSaveIntervalId); autoSaveIntervalId = null; }

    // Stop powerup spawning via its dedicated function
    stopPowerupSpawning(); // Calls the function from powerups.js

    console.log("All primary intervals and powerup spawning stopped.");
}

// Exported for use in softRefreshGame and initializeGame
export function startGameIntervals() {
    // Ensure no duplicates if called again, also ensures powerups are stopped before restart
    stopAllIntervals();

    // Start core game logic loop
    gameLoopIntervalId = setInterval(gameLoop, TICK_INTERVAL_MS);
    console.log(`Game loop started (${TICK_INTERVAL_MS}ms).`);

    // Start UI update loops
    displayUpdateIntervalId = setInterval(updateDisplay, DISPLAY_UPDATE_INTERVAL_MS);
    console.log(`Display update loop started (${DISPLAY_UPDATE_INTERVAL_MS}ms).`);
    buttonUpdateIntervalId = setInterval(updateButtonStates, BUTTON_UPDATE_INTERVAL_MS);
    console.log(`Button update loop started (${BUTTON_UPDATE_INTERVAL_MS}ms).`);

    // Start autosave
    autoSaveIntervalId = setInterval(() => {
        // Don't save if paused by win condition? Or allow saving always? Current: Allow saving.
        saveGame();
    }, AUTO_SAVE_INTERVAL_MS);
    console.log(`Autosave started (${AUTO_SAVE_INTERVAL_MS}ms).`);

    // Start powerup spawning (will self-check if paused/won internally)
    // This should only start if the game is NOT paused and NOT won after initialization/refresh
    if (!isGamePaused && !isGameWon) {
        startPowerupSpawning(); // Calls the function from powerups.js
    } else {
        console.log("Powerup spawning not started (game paused or won).");
    }
}

// --- Soft Refresh Function ---
export function softRefreshGame() {
     if (confirm("Reload game from last save?\n\nThis will restart game loops and reload UI elements based on your last saved progress. Any unsaved progress since the last auto-save or manual save will be lost.")) {
        console.log("Performing soft refresh...");
        displaySaveStatus("Refreshing from save...", 2000);

        // 1. Stop everything (including powerups)
        stopAllIntervals();
        pauseCurrentTrack(); // Ensure music stops during reload

        // 2. Reload game state from localStorage
        // loadGame updates global gameState, calls calculateDerivedStats & restartBoostTimersOnLoad
        const loadSuccess = loadGame();

        // 3. Re-apply audio state based on loaded gameState
        if (domElements['volume-slider']) {
             let savedVol = Number(gameState.lastVolume);
             if (isNaN(savedVol) || savedVol < 0 || savedVol > 1) savedVol = 0.1;
             // Set slider value based on mute state FIRST
             domElements['volume-slider'].value = gameState.isMuted ? 0 : savedVol;
             // Then call setVolume to apply volume/mute state correctly to elements
             setVolume(domElements['volume-slider'].value);
        } else {
            console.warn("Volume slider not found, cannot restore volume state.");
        }
        updateMuteButtonVisuals(); // Ensure mute button reflects potentially loaded mute state

        if (domElements['background-music'] && playlist && playlist.length > 0) {
             const trackIndexToLoad = gameState.currentTrackIndex || 0;
             // Determine if music should play based on loaded state and NOT being muted
             const shouldResumePlay = (loadSuccess && gameState.musicShouldBePlaying === true && !gameState.isMuted);

             loadTrack(trackIndexToLoad, gameState.musicShouldBePlaying ?? false); // Load track, set intent based on loaded state
             // handleCanPlay (triggered by loadTrack) will attempt playback if intent is true and NOT muted
             updatePlayPauseIcon(); // Update icon based on loaded intent/state
        } else {
             console.warn("Music player or playlist missing, cannot restore music state.");
        }


        // 4. Update UI completely based on reloaded state
        updateDisplay();
        updateButtonStates(); // Regenerates dynamic buttons
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

        // 5. Restart intervals based on game state AFTER loading
         setGameWon(gameState.money >= WIN_AMOUNT); // Re-check win condition after load
         if (isGameWon) {
             // If game is won after load, ensure it stays paused
             setGamePaused(true);
             console.log("Game is won after refresh, intervals not restarted.");
             // Ensure UI reflects paused state
             updateAcquisitionButtonVisuals();
             updateFlexibleWorkflowToggleButtonVisuals();
         } else {
             // If not won, unpause and restart intervals
             setGamePaused(false);
             startGameIntervals(); // Starts all loops, including powerups if conditions met
             console.log("Game intervals restarted after refresh.");
         }

        // 6. Close settings modal if open
        hideSettings();
        displaySaveStatus("Refresh complete.", 2000);
        console.log("Soft refresh complete.");
     }
}


// --- Initialization ---
function initializeGame() {
    console.log(`--- Initializing Game ${GAME_VERSION} ---`);
    try {
        cacheDOMElements(); // Cache static elements first
        if (domElements['game-version']) {
            domElements['game-version'].textContent = `${GAME_VERSION}`;
        }
    } catch (e) {
        console.error("DOM Caching Error:", e);
        alert("Fatal Error during initialization (DOM Caching). Check console.");
        return; // Stop initialization if essential elements are missing
    }

    try {
        // Load game data (handles defaults/resetting if necessary)
        // This calls initializeStructureState, calculateDerivedStats, restartBoostTimersOnLoad
        const loadedSuccessfully = loadGame(); // Returns true if loaded from save, false otherwise

        // Initialize Audio Player State based on loaded gameState
        if (domElements['background-music'] && domElements['volume-slider']) {
             let initialVol = Number(gameState.lastVolume);
             if(isNaN(initialVol) || initialVol < 0 || initialVol > 1) initialVol = 0.1;
             domElements['volume-slider'].value = gameState.isMuted ? 0 : initialVol;
             setVolume(); // Applies volume and handles mute state visuals/audio elements

             // Load initial track, set play intent from loaded state
             loadTrack(gameState.currentTrackIndex || 0, gameState.musicShouldBePlaying ?? false);
             updatePlayPauseIcon(); // Set initial icon state
             updateMuteButtonVisuals(); // Set initial mute button state

        } else {
            console.warn("Audio elements missing, cannot initialize music player state.");
        }

        // Perform initial UI draw based on loaded/default state
        updateDisplay(); // Update numbers/rates
        updateButtonStates(); // CRITICAL: Draw dynamic buttons *after* load/state init
        updateAcquisitionButtonVisuals(); // Update toggle state
        updateFlexibleWorkflowToggleButtonVisuals(); // Update toggle state

        // Attach event listeners AFTER elements are potentially created by updateButtonStates
        setupEventListeners();

        // Check win condition immediately after load
        setGameWon(gameState.money >= WIN_AMOUNT); // Set the flag based on loaded money
        if (isGameWon) {
             console.log("Game loaded in a 'Won' state.");
             setGamePaused(true); // Ensure game starts paused if won
             triggerWin(); // Show the win modal immediately if loaded in won state
        }

        // Start game loops only if not won
        if (!isGameWon) {
            setGamePaused(false); // Ensure game is not paused on initial load unless won
            startGameIntervals(); // Starts game loop, UI updates, autosave, and powerups
        } else {
            // Ensure UI reflects paused state even if loops aren't running (already done by triggerWin)
            updateAcquisitionButtonVisuals();
            updateFlexibleWorkflowToggleButtonVisuals();
        }

        console.log("--- Game Initialized ---");

    } catch(error) {
         console.error("Error during Game Initialization:", error);
         alert("A critical error occurred during game initialization. Please check the console (F12) for details. The game may not function correctly.");
         // Optionally try to stop intervals if they somehow started
         stopAllIntervals();
    }
}

// --- Global Error Handling ---
window.addEventListener('error', (event) => {
    console.error('Unhandled global error:', event.message, event.filename, event.lineno, event.colno, event.error);
    // Display a user-friendly message? Stop intervals?
    // alert('An unexpected error occurred. Please check the console (F12) and consider refreshing.');
    // stopAllIntervals(); // Maybe stop the game to prevent further errors
});
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
     // alert('An unexpected promise error occurred. Please check the console (F12).');
});

// --- Start the game ---
// Use DOMContentLoaded to ensure HTML is fully parsed before running JS
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // DOMContentLoaded has already fired
    initializeGame();
}