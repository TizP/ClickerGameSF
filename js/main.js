// js/main.js - Main entry point
"use strict";

// Import config first to access constants like FIRST_TIME_POPUP_KEY
import { GAME_VERSION, FIRST_TIME_POPUP_KEY, TICK_INTERVAL_MS, DISPLAY_UPDATE_INTERVAL_MS, BUTTON_UPDATE_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS, POWERUP_SPAWN_INTERVAL_MS, WIN_AMOUNT, playlist } from './config.js';
import { cacheDOMElements, domElements } from './dom.js';
import { gameState, isGameWon, isGamePaused, setGamePaused, setGameWon, getDefaultGameState, initializeStructureState } from './state.js';
import { loadGame, saveGame } from './saveLoad.js';
import { setVolume, loadTrack, updateMuteButtonVisuals, playCurrentTrack, pauseCurrentTrack, updatePlayPauseIcon } from './audio.js';
import { updateDisplay, updateButtonStates, triggerWin, hideSettings, displaySaveStatus, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals, showFirstTimeModal } from './ui.js';
import { setupEventListeners } from './events.js';
import { gameLoop, calculateDerivedStats } from './engine.js';
import { trySpawnPowerup, startPowerupSpawning, stopPowerupSpawning, removeActivePowerupToken, restartBoostTimersOnLoad } from './powerups.js';
import { getString, populateElementByStringKey, populateElementByTitleKey } from './ui_strings.js'; // Import string functions

// --- Global UI Strings ---
export let uiStrings = {}; // Will hold loaded strings

// --- Interval Management ---
let gameLoopIntervalId = null;
let displayUpdateIntervalId = null;
let buttonUpdateIntervalId = null;
let autoSaveIntervalId = null;
// powerupSpawnIntervalId is managed within powerups.js

// --- Function to Load UI Strings ---
async function loadUiStrings() {
    try {
        const response = await fetch('./ui_strings.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        uiStrings = await response.json();
        console.log("UI Strings loaded successfully.");
    } catch (error) {
        console.error("Failed to load UI strings:", error);
        alert("Fatal Error: Could not load game text configuration. The game cannot start.");
        // In a real scenario, you might have fallback strings or stop execution.
        uiStrings = {}; // Ensure it's an empty object to prevent errors later
        throw error; // Re-throw to stop initialization
    }
}

/**
 * Helper function to populate a UL element with list items from string keys.
 * @param {string} ulElementId - The ID of the UL element.
 * @param {string[]} stringKeys - An array of keys from ui_strings.json.
 * @param {boolean} allowHtml - Whether the list items can contain HTML.
 */
function populateList(ulElementId, stringKeys, allowHtml = false) {
    const listEl = document.getElementById(ulElementId);
    if (listEl) {
        listEl.innerHTML = stringKeys
            .map(key => {
                const text = getString(key);
                return text !== key ? `<li>${text}</li>` : ''; // Only add if key found
            })
            .join('');
        // If allowing HTML, need to re-apply innerHTML to the list items if needed,
        // but simpler to just allow HTML in the main listEl.innerHTML setting.
        // If specific list items need HTML, mark them in ui_strings.json and handle here.
        if(allowHtml) {
            // Re-setting innerHTML handles the allowed HTML tags from ui_strings.json
        }

    } else {
        console.warn(`List element with ID "${ulElementId}" not found for population.`);
    }
}


// --- Function to Apply Static UI Strings ---
function applyUiStrings() {
    if (!uiStrings || Object.keys(uiStrings).length === 0) {
        console.error("Cannot apply UI strings: Strings not loaded.");
        return;
    }
    console.log("Applying static UI strings...");

    // Set Page Title
    document.title = getString('meta.gameTitle');

    // --- Apply Text Content using data-string-key ---
    const textElements = document.querySelectorAll('[data-string-key]');
    textElements.forEach(el => {
        const key = el.getAttribute('data-string-key');
        const text = getString(key);
        if (text !== key) { // Only set if string was found
            if (el.classList.contains('dynamic-html')) {
                el.innerHTML = text;
            } else {
                // Handle nested spans carefully
                const childSpans = el.querySelectorAll('span');
                if (childSpans.length > 0 && el.firstChild?.nodeType === Node.TEXT_NODE) {
                     // If the element has child spans and also direct text content,
                     // try to replace only the first text node to preserve spans.
                     el.firstChild.textContent = text + (el.firstChild.textContent.includes(':') ? ': ' : ''); // Preserve colon if exists
                 } else if (el.tagName === 'SPAN' && el.parentElement.tagName === 'P' && (el.parentElement.classList.contains('stats-display') || el.parentElement.classList.contains('money-display'))) {
                    el.textContent = text; // Update only the label span in stats/money
                 } else if(el.tagName === 'BUTTON' && el.querySelector('span')) {
                     // Don't overwrite button text if it likely contains an icon span
                 } else {
                    el.textContent = text; // Default case
                 }
             }
        } else {
            // console.warn(`String key not found or invalid for textContent: ${key}`); // Can be noisy
        }
    });

    // --- Apply Title Attributes using data-string-key-title ---
    const titleElements = document.querySelectorAll('[data-string-key-title]');
    titleElements.forEach(el => {
        const key = el.getAttribute('data-string-key-title');
        const title = getString(key);
        if (title !== key) { // Only set if string was found
            el.title = title;
        } else {
            // console.warn(`String key not found or invalid for title: ${key}`); // Can be noisy
        }
    });

     // --- Populate Specific Elements by ID ---
     populateElementByStringKey('main-title', 'centerArea.mainTitle');
     populateElementByStringKey('upgrades-panel-title', 'panels.upgradesTitle');
     populateElementByStringKey('buildables-panel-title', 'panels.buildablesTitle');
     // Need to handle the "Now Playing:" part potentially separately if needed
     const trackInfoP = domElements['track-info-text'];
     if (trackInfoP) {
         const nowPlayingText = getString('topBar.nowPlaying');
         const trackNameSpan = trackInfoP.querySelector('#current-track-name');
         trackInfoP.firstChild.textContent = nowPlayingText + ' '; // Update text node before span
         // Keep the span content as is, it's updated dynamically
     }


    // --- Populate Modals ---
    // First Time Modal Steps
    populateList('first-time-steps', [
        'modals.firstTime.step1',
        'modals.firstTime.step2',
        'modals.firstTime.step3',
        'modals.firstTime.step4',
        'modals.firstTime.step5',
        'modals.firstTime.step6'
    ], true); // Allow HTML in steps

    // Tutorial Modal Lists (MODIFIED TO ADD POPULATION)
    populateList('tutorial-core-resources', [
        'modals.tutorial.coreLeads',
        'modals.tutorial.coreOpps',
        'modals.tutorial.coreCust',
        'modals.tutorial.coreMoney'
    ], true);
    populateList('tutorial-generating', [
        'modals.tutorial.genManual',
        'modals.tutorial.genAuto'
    ], true);
    populateList('tutorial-acquisition', [
        'modals.tutorial.acqAttempt',
        'modals.tutorial.acqCost',
        'modals.tutorial.acqRate',
        'modals.tutorial.acqSuccess',
        'modals.tutorial.acqPause'
    ], true);
     populateList('tutorial-generating-money', [
        'modals.tutorial.moneyGen',
        'modals.tutorial.moneyIncrease'
    ], true);
     populateList('tutorial-upgrades-list', [ // Target the inner UL for the sub-points
        'modals.tutorial.upgradeBoostClicks',
        'modals.tutorial.upgradeBoostTeams',
        'modals.tutorial.upgradeBoostEfficiency',
        'modals.tutorial.upgradeBoostAcq',
        'modals.tutorial.upgradeBoostCVR',
        'modals.tutorial.upgradeSpecial',
        'modals.tutorial.upgradeCustomerGrowth'
    ], true); // Assume these might contain formatting
     populateList('tutorial-teams', [
        'modals.tutorial.teamsPurchase',
        'modals.tutorial.teamsCS',
        'modals.tutorial.teamsCollapse'
    ], true);
    populateList('tutorial-special-upgrades', [
        'modals.tutorial.specialFlexWorkflow',
        'modals.tutorial.specialVPO',
        'modals.tutorial.specialStratCost'
    ], true);
    populateList('tutorial-powerups', [
        'modals.tutorial.powerupsSpawn',
        'modals.tutorial.powerupsClick',
        'modals.tutorial.powerupsBoosts'
    ], true);
     populateList('tutorial-goal-saving', [
        'modals.tutorial.goal',
        'modals.tutorial.saving'
    ], true);


    console.log("Static UI strings applied.");
}


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
     // Use getString for confirm message
     if (confirm(getString('misc.confirmRefresh') || "Reload game from last save? Unsaved progress will be lost.")) {
        console.log("Performing soft refresh...");
        // Use getString for status message with key
        displaySaveStatus('misc.saveStatusRefreshing', 2000);

        // 1. Stop everything
        stopAllIntervals();
        pauseCurrentTrack();

        // 2. Reload game state
        const loadSuccess = loadGame();

        // 3. Re-apply static strings
        applyUiStrings(); // Re-apply all static strings

        // 4. Re-apply audio state
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

        // 5. Update UI dynamically
        updateDisplay();
        updateButtonStates();
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

        // 6. Restart intervals based on loaded state
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

        // 7. Close settings modal
        hideSettings();
        displaySaveStatus('misc.saveStatusRefreshComplete', 2000);
        console.log("Soft refresh complete.");
     }
}


// --- Initialization ---
async function initializeGame() { // Make async to await string loading
    console.log(`--- Initializing Game ---`);
    let isFirstTime = false; // Flag to track if this is the first launch

    try {
         // 1. Load UI Strings FIRST
         await loadUiStrings(); // Wait for strings to be available

        // Check for first-time flag BEFORE loading game data
        if (localStorage.getItem(FIRST_TIME_POPUP_KEY) !== 'shown') {
            isFirstTime = true;
            console.log("First time playing this version detected.");
            // Don't set the flag yet, set it when the modal is closed.
        }

        // 2. Cache DOM Elements
        cacheDOMElements(); // Cache static elements

        // 3. Apply Static Strings to the DOM
        applyUiStrings();

        // 4. Set Game Version Display (now using config value)
        if (domElements['game-version']) {
            domElements['game-version'].textContent = `${getString('meta.gameVersionPrefix')}${GAME_VERSION}`;
        }

    } catch (e) {
        console.error("Fatal Error during initialization:", e);
        // Error should have been alerted during loadUiStrings or cacheDOMElements
        return; // Stop initialization
    }

    try {
        // 5. Load game data (or get defaults)
        const loadedSuccessfully = loadGame();

        // 6. Initialize Audio Player State
        if (domElements['background-music'] && domElements['volume-slider']) {
             let initialVol = Number(gameState.lastVolume);
             if(isNaN(initialVol) || initialVol < 0 || initialVol > 1) initialVol = 0.1;
             domElements['volume-slider'].value = gameState.isMuted ? 0 : initialVol;
             setVolume();
             loadTrack(gameState.currentTrackIndex || 0, gameState.musicShouldBePlaying ?? false);
             updatePlayPauseIcon();
             updateMuteButtonVisuals();
        }

        // 7. Perform initial UI draw (dynamic parts)
        updateDisplay();
        updateButtonStates(); // Draw dynamic buttons
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

        // 8. Attach event listeners AFTER elements are ready
        setupEventListeners();

        // 9. Check win condition
        setGameWon(gameState.money >= WIN_AMOUNT);
        if (isGameWon) {
             console.log("Game loaded in a 'Won' state.");
             setGamePaused(true);
             triggerWin(); // Show win modal
        }

        // 10. Start game loops only if not won
        if (!isGameWon) {
            setGamePaused(false);
            startGameIntervals(); // Start loops (includes powerup start check)
        } else {
            // Ensure UI reflects paused state if won
            updateAcquisitionButtonVisuals();
            updateFlexibleWorkflowToggleButtonVisuals();
        }

        // 11. Show first-time modal if needed, AFTER game is initialized
        if (isFirstTime) {
            // Use a small delay to ensure the main UI is rendered
            setTimeout(showFirstTimeModal, 500);
        }

        console.log("--- Game Initialized ---");

    } catch(error) {
         console.error("Error during Game Initialization (Post-Strings):", error);
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