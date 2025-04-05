// js/main.js - Main entry point
"use strict";

// Import config first to access constants like FIRST_TIME_POPUP_KEY
import { GAME_VERSION, FIRST_TIME_POPUP_KEY, TICK_INTERVAL_MS, DISPLAY_UPDATE_INTERVAL_MS, BUTTON_UPDATE_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS, POWERUP_SPAWN_INTERVAL_MS, WIN_AMOUNT, playlist } from './config.js';
import { cacheDOMElements, domElements } from './dom.js';
import { gameState, isGameWon, isGamePaused, setGamePaused, setGameWon, getDefaultGameState, initializeStructureState } from './state.js';
import { loadGame, saveGame } from './saveLoad.js';
import { setVolume, loadTrack, updateMuteButtonVisuals, playCurrentTrack, pauseCurrentTrack, updatePlayPauseIcon } from './audio.js';
// Import new modal functions
import { updateDisplay, updateButtonStates, triggerWin, hideSettings, displaySaveStatus, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals, showFirstTimeModal } from './ui.js';
import { setupEventListeners } from './events.js';
import { gameLoop, calculateDerivedStats } from './engine.js';
import { trySpawnPowerup, startPowerupSpawning, stopPowerupSpawning, removeActivePowerupToken, restartBoostTimersOnLoad } from './powerups.js';

// --- Interval Management ---
let gameLoopIntervalId = null;
let displayUpdateIntervalId = null;
let buttonUpdateIntervalId = null;
let autoSaveIntervalId = null;
// powerupSpawnIntervalId is managed within powerups.js

// Exported for use in saveLoad.js and softRefreshGame
export function stopAllIntervals() {
    if (gameLoopIntervalId) { clearInterval(gameLoopIntervalId); gameLoopIntervalId = null; }
    if (displayUpdateIntervalId) { clearInterval(displayUpdateIntervalId); displayUpdateIntervalId = null; }
    if (buttonUpdateIntervalId) { clearInterval(buttonUpdateIntervalId); buttonUpdateIntervalId = null; }
    if (autoSaveIntervalId) { clearInterval(autoSaveIntervalId); autoSaveIntervalId = null; }
    stopPowerupSpawning();
    console.log("All primary intervals and powerup spawning stopped.");
}

// Exported for use in softRefreshGame and initializeGame
export function startGameIntervals() {
    stopAllIntervals(); // Ensure clean state

    // Start core game logic loop
    gameLoopIntervalId = setInterval(gameLoop, TICK_INTERVAL_MS);
    console.log(`Game loop started (${TICK_INTERVAL_MS}ms).`);

    // Start UI update loops
    displayUpdateIntervalId = setInterval(updateDisplay, DISPLAY_UPDATE_INTERVAL_MS);
    console.log(`Display update loop started (${DISPLAY_UPDATE_INTERVAL_MS}ms).`);
    buttonUpdateIntervalId = setInterval(updateButtonStates, BUTTON_UPDATE_INTERVAL_MS);
    console.log(`Button update loop started (${BUTTON_UPDATE_INTERVAL_MS}ms).`);

    // Start autosave
    autoSaveIntervalId = setInterval(() => { saveGame(); }, AUTO_SAVE_INTERVAL_MS);
    console.log(`Autosave started (${AUTO_SAVE_INTERVAL_MS}ms).`);

    // Start powerup spawning only if game is active
    if (!isGamePaused && !isGameWon) {
        startPowerupSpawning();
    } else {
        console.log("Powerup spawning not started (game paused or won).");
    }
}

// --- Soft Refresh Function ---
export function softRefreshGame() {
     if (confirm("Reload game from last save?\n\nThis will restart game loops and reload UI elements based on your last saved progress. Any unsaved progress since the last auto-save or manual save will be lost.")) {
        console.log("Performing soft refresh...");
        displaySaveStatus("Refreshing from save...", 2000);

        // 1. Stop everything
        stopAllIntervals();
        pauseCurrentTrack();

        // 2. Reload game state
        const loadSuccess = loadGame();

        // 3. Re-apply audio state
        if (domElements['volume-slider']) {
             let savedVol = Number(gameState.lastVolume);
             if (isNaN(savedVol) || savedVol < 0 || savedVol > 1) savedVol = 0.1;
             domElements['volume-slider'].value = gameState.isMuted ? 0 : savedVol;
             setVolume(domElements['volume-slider'].value);
        }
        updateMuteButtonVisuals();
        if (domElements['background-music'] && playlist && playlist.length > 0) {
             const trackIndexToLoad = gameState.currentTrackIndex || 0;
             loadTrack(trackIndexToLoad, gameState.musicShouldBePlaying ?? false);
             updatePlayPauseIcon();
        }

        // 4. Update UI
        updateDisplay();
        updateButtonStates();
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

        // 5. Restart intervals based on loaded state
        setGameWon(gameState.money >= WIN_AMOUNT);
        if (isGameWon) {
             setGamePaused(true);
             console.log("Game is won after refresh, intervals not restarted.");
             updateAcquisitionButtonVisuals();
             updateFlexibleWorkflowToggleButtonVisuals();
        } else {
             setGamePaused(false);
             startGameIntervals();
             console.log("Game intervals restarted after refresh.");
        }

        // 6. Close settings modal
        hideSettings();
        displaySaveStatus("Refresh complete.", 2000);
        console.log("Soft refresh complete.");
     }
}


// --- Initialization ---
function initializeGame() {
    console.log(`--- Initializing Game ${GAME_VERSION} ---`);
    let isFirstTime = false; // Flag to track if this is the first launch

    try {
        // Check for first-time flag BEFORE loading game data
        if (localStorage.getItem(FIRST_TIME_POPUP_KEY) !== 'shown') {
            isFirstTime = true;
            console.log("First time playing this version detected.");
            // Don't set the flag yet, set it when the modal is closed.
        }

        cacheDOMElements(); // Cache static elements first
        if (domElements['game-version']) {
            domElements['game-version'].textContent = `${GAME_VERSION}`;
        }
    } catch (e) {
        console.error("DOM Caching Error:", e);
        alert("Fatal Error during initialization (DOM Caching). Check console.");
        return;
    }

    try {
        // Load game data (or get defaults)
        const loadedSuccessfully = loadGame();

        // Initialize Audio Player State
        if (domElements['background-music'] && domElements['volume-slider']) {
             let initialVol = Number(gameState.lastVolume);
             if(isNaN(initialVol) || initialVol < 0 || initialVol > 1) initialVol = 0.1;
             domElements['volume-slider'].value = gameState.isMuted ? 0 : initialVol;
             setVolume();
             loadTrack(gameState.currentTrackIndex || 0, gameState.musicShouldBePlaying ?? false);
             updatePlayPauseIcon();
             updateMuteButtonVisuals();
        }

        // Perform initial UI draw
        updateDisplay();
        updateButtonStates(); // Draw dynamic buttons
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

        // Attach event listeners AFTER elements are ready
        setupEventListeners();

        // Check win condition
        setGameWon(gameState.money >= WIN_AMOUNT);
        if (isGameWon) {
             console.log("Game loaded in a 'Won' state.");
             setGamePaused(true);
             triggerWin(); // Show win modal
        }

        // Start game loops only if not won
        if (!isGameWon) {
            setGamePaused(false);
            startGameIntervals(); // Start loops (includes powerup start check)
        } else {
            // Ensure UI reflects paused state if won
            updateAcquisitionButtonVisuals();
            updateFlexibleWorkflowToggleButtonVisuals();
        }

        // TODO: Show first-time modal if needed, AFTER game is initialized
        if (isFirstTime) {
            // Use a small delay to ensure the main UI is rendered
            setTimeout(showFirstTimeModal, 500);
        }

        console.log("--- Game Initialized ---");

    } catch(error) {
         console.error("Error during Game Initialization:", error);
         alert("A critical error occurred during game initialization. Please check the console (F12) for details. The game may not function correctly.");
         stopAllIntervals();
    }
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