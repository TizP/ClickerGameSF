// js/main.js - Main entry point
"use strict";

import { GAME_VERSION, TICK_INTERVAL_MS, DISPLAY_UPDATE_INTERVAL_MS, BUTTON_UPDATE_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS, POWERUP_SPAWN_INTERVAL_MS, WIN_AMOUNT, playlist } from './config.js'; // Added playlist
import { cacheDOMElements, domElements } from './dom.js';
import { gameState, isGameWon, isGamePaused, setGamePaused, setGameWon, getDefaultGameState, initializeStructureState } from './state.js'; // Added getDefaultGameState, initializeStructureState for potential reset use
import { loadGame, saveGame } from './saveLoad.js';
// Import audio functions needed for refresh
import { setVolume, loadTrack, updateMuteButtonVisuals, playCurrentTrack, pauseCurrentTrack, updatePlayPauseIcon } from './audio.js'; // Added pause/update icons
// Import UI functions needed for refresh
import { updateDisplay, updateButtonStates, triggerWin, hideSettings, displaySaveStatus, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals } from './ui.js'; // Added toggle button updates
import { setupEventListeners } from './events.js';
import { gameLoop, calculateDerivedStats } from './engine.js';
import { trySpawnPowerup, startPowerupSpawning, stopPowerupSpawning, removeActivePowerupToken, restartBoostTimersOnLoad } from './powerups.js'; // Added removeActivePowerupToken, restartBoostTimersOnLoad

// --- Interval Management ---
let gameLoopIntervalId = null;
let displayUpdateIntervalId = null;
let buttonUpdateIntervalId = null;
let autoSaveIntervalId = null;
// powerupSpawnIntervalId is managed within powerups.js

// Exported for use in saveLoad.js and softRefreshGame
export function stopAllIntervals() {
    // Clear primary game loops
    [gameLoopIntervalId, displayUpdateIntervalId, buttonUpdateIntervalId, autoSaveIntervalId].forEach(id => {
        if (id) clearInterval(id);
    });
    gameLoopIntervalId = displayUpdateIntervalId = buttonUpdateIntervalId = autoSaveIntervalId = null;

    // Stop powerup spawning via its dedicated function
    stopPowerupSpawning();

    console.log("All primary intervals stopped.");
}

// Exported for use in softRefreshGame and initializeGame
export function startGameIntervals() {
    stopAllIntervals(); // Ensure no duplicates if called again

    // Start core game logic loop
    gameLoopIntervalId = setInterval(gameLoop, TICK_INTERVAL_MS);
    console.log(`Game loop started (${TICK_INTERVAL_MS}ms).`);

    // Start UI update loops
    displayUpdateIntervalId = setInterval(updateDisplay, DISPLAY_UPDATE_INTERVAL_MS);
    console.log(`Display update loop started (${DISPLAY_UPDATE_INTERVAL_MS}ms).`);
    buttonUpdateIntervalId = setInterval(updateButtonStates, BUTTON_UPDATE_INTERVAL_MS);
    console.log(`Button update loop started (${BUTTON_UPDATE_INTERVAL_MS}ms).`);

    // Start autosave
    autoSaveIntervalId = setInterval(() => { saveGame(); }, AUTO_SAVE_INTERVAL_MS); // Wrap saveGame to ensure no arguments passed unintentionally
    console.log(`Autosave started (${AUTO_SAVE_INTERVAL_MS}ms).`);

    // Start powerup spawning (will self-check if paused/won)
    startPowerupSpawning();
}

// --- Soft Refresh Function ---
export function softRefreshGame() {
     if (confirm("Reload game from last save?\n\nThis will restart game loops and reload UI elements based on your last saved progress. Any unsaved progress since the last auto-save or manual save will be lost.")) {
        console.log("Performing soft refresh...");
        displaySaveStatus("Refreshing from save...", 2000);

        // 1. Stop everything (including audio playback potentially)
        const wasMusicPlaying = gameState.musicShouldBePlaying; // Check state before stopping
        stopAllIntervals();
        pauseCurrentTrack(); // Ensure music stops during reload

        // 2. Reload game state from localStorage
        const loadSuccess = loadGame(); // Updates global gameState and calls calculateDerivedStats + restartBoostTimersOnLoad

        // 3. Re-apply audio state based on loaded gameState
        if (domElements['volume-slider']) {
             let savedVol = Number(gameState.lastVolume);
             if (isNaN(savedVol) || savedVol < 0 || savedVol > 1) savedVol = 0.1; // Validate saved volume
             domElements['volume-slider'].value = gameState.isMuted ? 0 : savedVol;
             setVolume(); // Apply the volume (handles mute state internally)
        } else {
            console.warn("Volume slider not found, cannot restore volume state.");
        }

        if (domElements['background-music'] && playlist.length > 0) {
             const trackIndexToLoad = gameState.currentTrackIndex || 0;
             const shouldResumePlay = (loadSuccess && gameState.musicShouldBePlaying === true);

             loadTrack(trackIndexToLoad, shouldResumePlay); // Load track, set intent based on loaded state
             // handleCanPlay will attempt playback if shouldResumePlay is true and not muted
             if (!shouldResumePlay) {
                updatePlayPauseIcon(); // Ensure icon is correct if not meant to play
             }
        } else {
             console.warn("Music player or playlist missing, cannot restore music state.");
        }
        updateMuteButtonVisuals(); // Ensure mute button reflects loaded state

        // 4. Update UI completely based on reloaded state
        updateDisplay();        // Update resource displays etc.
        updateButtonStates();   // Redraw buttons, check tiers, enable/disable
        updateAcquisitionButtonVisuals(); // Ensure toggle buttons are correct
        updateFlexibleWorkflowToggleButtonVisuals();

        // 5. Restart intervals (only if game not won after load)
         setGameWon(gameState.money >= WIN_AMOUNT); // Re-check win condition after load
         if (!isGameWon) {
             // Always unpause on refresh unless game is won
             setGamePaused(false);
             startGameIntervals(); // Start all loops including powerups
             console.log("Game intervals restarted after refresh.");
         } else {
             console.log("Game is won, intervals not restarted after refresh.");
             setGamePaused(true); // Ensure game stays paused if won
             // UI updates already handled above
         }

        // 6. Close settings modal if open
        hideSettings();
        displaySaveStatus("Refresh complete.", 2000);
        console.log("Soft refresh complete.");
     }
}


// --- Initialization ---
function initializeGame() {
    console.log(`--- Initializing Game v${GAME_VERSION} ---`);
    try {
        cacheDOMElements();
        if (domElements['game-version']) {
            domElements['game-version'].textContent = `v${GAME_VERSION}`;
        }
    } catch (e) {
        console.error("DOM Caching Error:", e);
        return; // Stop initialization
    }

    // Load game data (handles defaults/resetting if necessary)
    // This calls initializeStructureState, calculateDerivedStats, restartBoostTimersOnLoad
    loadGame();

    // Initialize Audio Player State based on loaded gameState
    if (domElements['background-music'] && domElements['volume-slider']) {
         let initialVol = Number(gameState.lastVolume);
         if(isNaN(initialVol) || initialVol < 0 || initialVol > 1) initialVol = 0.1; // Validate
         domElements['volume-slider'].value = gameState.isMuted ? 0 : initialVol;
         setVolume(); // Applies volume and handles mute state visuals

        // Load initial track, set play intent from loaded state
        loadTrack(gameState.currentTrackIndex || 0, gameState.musicShouldBePlaying ?? false);
        // Don't automatically call playCurrentTrack here, rely on handleCanPlay or user interaction
        updatePlayPauseIcon(); // Set initial icon state
        updateMuteButtonVisuals(); // Set initial mute button state

    } else {
        console.warn("Audio elements missing, cannot initialize music player state.");
    }


    // Perform initial UI draw based on loaded/default state
    updateDisplay();
    updateButtonStates(); // Draws dynamic buttons
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();

    // Attach event listeners
    setupEventListeners();

    // Check win condition immediately after load
    if (gameState.money >= WIN_AMOUNT && !isGameWon) { // Ensure triggerWin only called if not already won
        triggerWin(); // Handles setting flags, pausing etc.
    }

    // Start game loops only if not won
    if (!isGameWon) {
        setGamePaused(false); // Ensure game is not paused on initial load unless won
        startGameIntervals();
    } else {
        setGamePaused(true); // Ensure game stays paused if loaded in a won state
        console.log("Game loaded in a 'Won' state. Intervals not started.");
        // Ensure UI reflects paused state even if loops aren't running
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();
    }

    console.log("--- Game Initialized ---");
}

// --- Global Error Handling ---
window.addEventListener('error', (event) => {
    console.error('Unhandled global error:', event.message, event.filename, event.lineno, event.colno, event.error);
});
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// --- Start the game ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}