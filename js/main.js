// js/main.js - Main entry point
"use strict";

import { GAME_VERSION, TICK_INTERVAL_MS, DISPLAY_UPDATE_INTERVAL_MS, BUTTON_UPDATE_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS, POWERUP_SPAWN_INTERVAL_MS, WIN_AMOUNT } from './config.js';
import { cacheDOMElements, domElements } from './dom.js';
import { gameState, isGameWon, isGamePaused, setGamePaused, setGameWon } from './state.js';
import { loadGame, saveGame } from './saveLoad.js';
import { toggleMute, setVolume, loadTrack, updateMuteButtonVisuals } from './audio.js';
import { updateDisplay, updateButtonStates, triggerWin } from './ui.js';
import { setupEventListeners } from './events.js';
import { gameLoop, calculateDerivedStats } from './engine.js';
import { trySpawnPowerup, startPowerupSpawning, stopPowerupSpawning } from './powerups.js';

// --- Interval Management ---
let gameLoopIntervalId = null;
let displayUpdateIntervalId = null;
let buttonUpdateIntervalId = null;
let autoSaveIntervalId = null;
// Powerup interval managed in powerups.js
// Stats interval managed in ui.js

export function stopAllIntervals() {
    [gameLoopIntervalId, displayUpdateIntervalId, buttonUpdateIntervalId, autoSaveIntervalId].forEach(id => {
        if (id) clearInterval(id);
    });
    gameLoopIntervalId = displayUpdateIntervalId = buttonUpdateIntervalId = autoSaveIntervalId = null;
    stopPowerupSpawning(); // Also stop powerup spawning interval
    // Note: Stats interval is stopped when the modal closes in ui.js
    console.log("All primary intervals stopped.");
}

function startGameIntervals() {
    stopAllIntervals(); // Ensure no duplicates

    // Core game logic tick
    gameLoopIntervalId = setInterval(gameLoop, TICK_INTERVAL_MS);
    console.log(`Game loop started (${TICK_INTERVAL_MS}ms).`);

    // UI update ticks (less frequent)
    displayUpdateIntervalId = setInterval(updateDisplay, DISPLAY_UPDATE_INTERVAL_MS);
    console.log(`Display update loop started (${DISPLAY_UPDATE_INTERVAL_MS}ms).`);
    buttonUpdateIntervalId = setInterval(updateButtonStates, BUTTON_UPDATE_INTERVAL_MS);
    console.log(`Button update loop started (${BUTTON_UPDATE_INTERVAL_MS}ms).`);

    // Autosave
    autoSaveIntervalId = setInterval(saveGame, AUTO_SAVE_INTERVAL_MS);
    console.log(`Autosave started (${AUTO_SAVE_INTERVAL_MS}ms).`);

    // Start powerup spawning check loop
    startPowerupSpawning();
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
        // Error during caching is fatal
        console.error("DOM Caching Error:", e);
        alert("Fatal Error Initializing UI. Game cannot start. Check console.");
        return; // Stop initialization
    }

    // Load saved state or set defaults (updates gameState)
    loadGame();

    // Initial setup based on loaded/default state
    calculateDerivedStats(); // Calculate initial rates

    // Apply initial audio state AFTER loading gameState
    if (domElements['background-music'] && domElements['volume-slider']) {
        if (gameState.isMuted) {
            toggleMute(true); // Force mute state if loaded as muted
        } else {
            // Set initial volume from slider (or default), respecting mute state
            setVolume(); // Reads slider value, handles mute interaction
        }
        loadTrack(0, false); // Load first track, don't auto-play yet
        updateMuteButtonVisuals(); // Ensure button reflects initial state
    } else {
        console.warn("Audio elements missing, cannot initialize music player.");
    }


    updateDisplay(); // Initial UI render based on loaded state & calculated rates
    updateButtonStates(); // Set initial button enabled/disabled states
    setupEventListeners(); // Attach event listeners AFTER elements are cached and state is loaded

    // Check win condition immediately after loading
    if (!isGameWon && gameState.money >= WIN_AMOUNT) {
        triggerWin(); // Handle already-won state from save
    }

    // Start game loops only if not already won
    if (!isGameWon) {
        startGameIntervals();
    } else {
        // If game is loaded in a won state, ensure it's paused visually/logically
        setGamePaused(true); // Make sure pause flag is set
        updateButtonStates(); // Ensure buttons are disabled
        console.log("Game loaded in a 'Won' state.");
    }


    console.log("--- Game Initialized ---");
}

// --- Global Error Handling ---
window.addEventListener('error', (event) => {
    console.error('Unhandled global error:', event.message, event.filename, event.lineno, event.colno, event.error);
    // Maybe try to save game or display a message?
    // alert("An unexpected error occurred. Please check the console.");
});

window.addEventListener('unhandledrejection', (event) => {
     console.error('Unhandled promise rejection:', event.reason);
     // alert("An unexpected promise error occurred. Please check the console.");
});


// --- Start the game ---
// Wait for the DOM to be fully ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // DOMContentLoaded has already fired
    initializeGame();
}