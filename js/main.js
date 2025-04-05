// js/main.js - Main entry point
"use strict";

// Import config first
import { GAME_VERSION, FIRST_TIME_POPUP_KEY, TICK_INTERVAL_MS, DISPLAY_UPDATE_INTERVAL_MS, BUTTON_UPDATE_INTERVAL_MS, AUTO_SAVE_INTERVAL_MS, POWERUP_SPAWN_INTERVAL_MS, WIN_AMOUNT, playlist } from './config.js';
import { cacheDOMElements, domElements } from './dom.js';
import { gameState, isGameWon, isGamePaused, setGamePaused, setGameWon, getDefaultGameState, initializeStructureState } from './state.js';
import { loadGame, saveGame } from './saveLoad.js';
import { setVolume, loadTrack, updateMuteButtonVisuals, playCurrentTrack, pauseCurrentTrack, updatePlayPauseIcon } from './audio.js';
// Import UI functions - ADDED updateLanguageButtonVisuals
import { updateDisplay, updateButtonStates, triggerWin, hideSettings, displaySaveStatus, updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals, showFirstTimeModal, updateLanguageButtonVisuals } from './ui.js';
import { setupEventListeners } from './events.js';
import { gameLoop, calculateDerivedStats } from './engine.js';
import { trySpawnPowerup, startPowerupSpawning, stopPowerupSpawning, removeActivePowerupToken, restartBoostTimersOnLoad } from './powerups.js';
import { getString, populateElementByStringKey, populateElementByTitleKey } from './ui_strings.js'; // Import string functions

// --- Language Constants & Variables ---
const LANG_KEY = 'salesforcePipelineLang';
const DEFAULT_LANG = 'en';
const SUPPORTED_LANGS = ['en', 'it'];
export let currentLanguage = DEFAULT_LANG; // Export for ui.js to access
export let uiStrings = {}; // Will hold loaded strings

// --- Interval Management ---
let gameLoopIntervalId = null;
let displayUpdateIntervalId = null;
let buttonUpdateIntervalId = null;
let autoSaveIntervalId = null;
// powerupSpawnIntervalId is managed within powerups.js

// --- Function to Load UI Strings ---
// MODIFIED: Loads based on currentLanguage
async function loadUiStrings() {
    const langFile = currentLanguage === 'en' ? './ui_strings.json' : `./${currentLanguage}_strings.json`;
    console.log(`Loading UI strings from: ${langFile}`);
    try {
        const response = await fetch(langFile);
        if (!response.ok) {
            // Fallback to English if the language file is not found
            if (currentLanguage !== 'en') {
                console.warn(`Language file ${langFile} not found, falling back to English.`);
                currentLanguage = 'en'; // Reset language
                localStorage.setItem(LANG_KEY, currentLanguage); // Save fallback choice
                await loadUiStrings(); // Retry with English file
                return; // Exit this attempt
            } else {
                throw new Error(`HTTP error! status: ${response.status} for ${langFile}`);
            }
        }
        uiStrings = await response.json();
        console.log(`UI Strings for '${currentLanguage}' loaded successfully.`);
    } catch (error) {
        console.error("Failed to load UI strings:", error);
        alert("Fatal Error: Could not load game text configuration. The game cannot start.");
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
    const listEl = document.getElementById(ulElementId); // Get fresh element reference
    if (!listEl) { // Check if element exists in the DOM directly
        console.warn(`List element with ID "${ulElementId}" not found for population.`);
        return;
    }
        listEl.innerHTML = stringKeys
            .map(key => {
                const text = getString(key);
                // Make sure we don't insert 'undefined' or the key itself if not found
                return (text && text !== key) ? `<li>${text}</li>` : '';
            })
            .join('');
}


// --- Function to Apply Static UI Strings ---
// MODIFIED: Updated applyUiStrings to handle potential text node issues better
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
             } else if (el.tagName === 'BUTTON' && el.firstChild?.nodeType === Node.TEXT_NODE) {
                 // For buttons, only update the first text node if it exists
                 el.firstChild.textContent = text;
             } else if (el.tagName === 'SPAN' && el.parentElement?.matches('h4.group-title, p.stats-display span, p.money-display span')) {
                 // For specific spans (like labels in stats or category titles), update text
                 el.textContent = text;
             } else if (!el.querySelector('span')) {
                 // For simple elements without child spans (like basic paragraphs, h2), update text
                 el.textContent = text;
             }
        } else {
            // console.warn(`String key not found or invalid for textContent: ${key} on element`, el); // Can be noisy
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
            // console.warn(`String key not found or invalid for title: ${key} on element`, el); // Can be noisy
        }
    });

     // --- Populate Specific Elements by ID ---
     populateElementByStringKey('main-title', 'centerArea.mainTitle');
     populateElementByStringKey('upgrades-panel-title', 'panels.upgradesTitle');
     populateElementByStringKey('buildables-panel-title', 'panels.buildablesTitle');

     const trackInfoP = domElements['track-info-text'];
     if (trackInfoP && trackInfoP.firstChild?.nodeType === Node.TEXT_NODE) {
         const nowPlayingText = getString('topBar.nowPlaying');
         trackInfoP.firstChild.textContent = nowPlayingText + ' ';
     }

    // --- Populate Modals ---
    populateList('first-time-steps', [
        'modals.firstTime.step1', 'modals.firstTime.step2', 'modals.firstTime.step3',
        'modals.firstTime.step4', 'modals.firstTime.step5', 'modals.firstTime.step6'
    ], true);
    populateList('tutorial-core-resources', [
        'modals.tutorial.coreLeads', 'modals.tutorial.coreOpps', 'modals.tutorial.coreCust', 'modals.tutorial.coreMoney'
    ], true);
    populateList('tutorial-generating', [ 'modals.tutorial.genManual', 'modals.tutorial.genAuto' ], true);
    populateList('tutorial-acquisition', [
        'modals.tutorial.acqAttempt', 'modals.tutorial.acqCost', 'modals.tutorial.acqRate',
        'modals.tutorial.acqSuccess', 'modals.tutorial.acqPause'
    ], true);
     populateList('tutorial-generating-money', [ 'modals.tutorial.moneyGen', 'modals.tutorial.moneyIncrease' ], true);
     populateList('tutorial-upgrades-list', [
        'modals.tutorial.upgradeBoostClicks', 'modals.tutorial.upgradeBoostTeams', 'modals.tutorial.upgradeBoostEfficiency',
        'modals.tutorial.upgradeBoostAcq', 'modals.tutorial.upgradeBoostCVR', 'modals.tutorial.upgradeSpecial',
        'modals.tutorial.upgradeCustomerGrowth'
    ], true);
     populateList('tutorial-teams', [
        'modals.tutorial.teamsPurchase', 'modals.tutorial.teamsCS', 'modals.tutorial.teamsCollapse'
    ], true);
    populateList('tutorial-special-upgrades', [
        'modals.tutorial.specialFlexWorkflow', 'modals.tutorial.specialVPO', 'modals.tutorial.specialStratCost'
    ], true);
    populateList('tutorial-powerups', [
        'modals.tutorial.powerupsSpawn', 'modals.tutorial.powerupsClick', 'modals.tutorial.powerupsBoosts'
    ], true);
     populateList('tutorial-goal-saving', [ 'modals.tutorial.goal', 'modals.tutorial.saving' ], true);

    // Update language button visuals AFTER strings are applied
    updateLanguageButtonVisuals();

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

// --- Language Switching Function ---
export async function switchLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLanguage) {
        console.log(`Language ${lang} not supported or already active.`);
        return;
    }
    console.log(`Switching language to: ${lang}`);
    currentLanguage = lang;
    localStorage.setItem(LANG_KEY, currentLanguage); // Save preference

    try {
        // 1. Reload strings for the new language
        await loadUiStrings();

        // 2. Re-apply all static strings
        applyUiStrings();

        // 3. Force update of dynamic UI elements
        updateDisplay();
        updateButtonStates();
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();
        // No need to update audio or game state

        console.log(`Language switched successfully to ${lang}.`);

    } catch (error) {
        console.error(`Error switching language to ${lang}:`, error);
        // Optionally try to revert or show an error message
        // For simplicity, we might just leave it in a potentially broken state
    }
}


// --- Soft Refresh Function ---
export async function softRefreshGame() { // Make async
     // Use getString for confirm message
     if (confirm(getString('misc.confirmRefresh') || "Reload game from last save? Unsaved progress will be lost.")) {
        console.log("Performing soft refresh...");
        displaySaveStatus('misc.saveStatusRefreshing', 2000);

        // 1. Stop everything
        stopAllIntervals();
        pauseCurrentTrack();

        // 2. Reload game state (includes saved language preference if any)
        const loadSuccess = loadGame();
        // Re-determine language after load, in case save had a preference
        let savedLang = localStorage.getItem(LANG_KEY);
        currentLanguage = SUPPORTED_LANGS.includes(savedLang) ? savedLang : DEFAULT_LANG;

        // 3. Reload UI strings for the correct language
        await loadUiStrings(); // Await the string loading

        // 4. Re-apply static strings
        applyUiStrings();

        // 5. Re-apply audio state
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

        // 6. Update UI dynamically
        updateDisplay();
        updateButtonStates();
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

        // 7. Restart intervals based on loaded state
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

        // 8. Close settings modal
        hideSettings();
        displaySaveStatus('misc.saveStatusRefreshComplete', 2000);
        console.log("Soft refresh complete.");
     }
}


// --- Initialization ---
async function initializeGame() { // Make async
    console.log(`--- Initializing Game ---`);
    let isFirstTime = false;

    // Determine initial language BEFORE loading strings
    let savedLang = localStorage.getItem(LANG_KEY);
    currentLanguage = SUPPORTED_LANGS.includes(savedLang) ? savedLang : DEFAULT_LANG;
    console.log(`Current language set to: ${currentLanguage}`);

    try {
         // 1. Load UI Strings FIRST for the determined language
         await loadUiStrings(); // Wait for strings to be available

        // Check for first-time flag AFTER strings loaded (just in case)
        if (localStorage.getItem(FIRST_TIME_POPUP_KEY) !== 'shown') {
            isFirstTime = true;
            console.log("First time playing this version detected.");
        }

        // 2. Cache DOM Elements
        cacheDOMElements();

        // 3. Apply Static Strings to the DOM
        applyUiStrings();

        // 4. Set Game Version Display
        if (domElements['game-version']) {
            domElements['game-version'].textContent = `${getString('meta.gameVersionPrefix')}${GAME_VERSION}`;
        }

    } catch (e) {
        console.error("Fatal Error during initialization (Strings/DOM):", e);
        return; // Stop initialization
    }

    try {
        // 5. Load game data (or get defaults) - Language already determined
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
        updateButtonStates();
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

        // 8. Attach event listeners AFTER elements are ready
        setupEventListeners(); // Includes flag listeners

        // 9. Check win condition
        setGameWon(gameState.money >= WIN_AMOUNT);
        if (isGameWon) {
             console.log("Game loaded in a 'Won' state.");
             setGamePaused(true);
             triggerWin();
        }

        // 10. Start game loops only if not won
        if (!isGameWon) {
            setGamePaused(false);
            startGameIntervals();
        } else {
            updateAcquisitionButtonVisuals();
            updateFlexibleWorkflowToggleButtonVisuals();
        }

        // 11. Show first-time modal if needed
        if (isFirstTime) {
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