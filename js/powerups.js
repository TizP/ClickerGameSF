// js/powerups.js
"use strict";
import { gameState, isGamePaused, isGameWon } from './state.js';
import { domElements } from './dom.js';
import { calculateDerivedStats } from './engine.js'; // Recalculate after boost
import { updateDisplay, updateButtonStates } from './ui.js'; // Update UI after boost
import { playSoundEffect } from './audio.js';
import {
    POWERUP_CHANCE_PER_INTERVAL, powerupTypes, POWERUP_SFX_CLICK_ID,
    POWERUP_FALL_DURATION_MS, POWERUP_TOKEN_SIZE, POWERUP_SPAWN_INTERVAL_MS // Added here
} from './config.js';

let powerupSpawnIntervalId = null;
let currentPowerupToken = null; // Module-scoped token reference

export function trySpawnPowerup() {
    if (isGamePaused || isGameWon || !domElements['powerup-spawn-area'] || currentPowerupToken) {
        return;
    }
    if (Math.random() < POWERUP_CHANCE_PER_INTERVAL) {
        const idx = Math.floor(Math.random() * powerupTypes.length);
        createPowerupToken(powerupTypes[idx]);
    }
}

export function createPowerupToken(data) {
    const area = domElements['powerup-spawn-area'];
    if (!area || currentPowerupToken) return; // Check again to prevent race condition

    const token = document.createElement('div');
    currentPowerupToken = token; // Store reference
    token.classList.add('powerup-token');
    token.style.backgroundImage = `url('resources/img/${data.image}')`;
    token.title = `${data.name} (${data.description}) - Click Me!`;
    token.powerupData = data; // Store data directly on the element

    const areaW = area.offsetWidth;
    token.style.left = `${Math.random() * (areaW - POWERUP_TOKEN_SIZE)}px`;
    token.style.top = '-100px'; // Start above screen

    const clickHandler = (e) => {
        e.stopPropagation();
        if (!token.parentNode) return; // Check if already removed

        gameState.totalPowerupsClicked++;
        applyBoost(token.powerupData);
        playSoundEffect(POWERUP_SFX_CLICK_ID);
        removeActivePowerupToken(token); // Pass the clicked token
    };

    const animEndHandler = () => {
        // Only remove if it hasn't been clicked and removed already
        if (token === currentPowerupToken) {
            removeActivePowerupToken(token);
        }
    };

    token.addEventListener('click', clickHandler);
    token.addEventListener('animationend', animEndHandler, { once: true });

    // Ensure fall duration is applied correctly
    token.style.animation = `fallAnimation ${POWERUP_FALL_DURATION_MS}ms linear`;

    area.appendChild(token);
}

export function removeActivePowerupToken(tokenElement = null) {
    const tokenToRemove = tokenElement || currentPowerupToken; // Use provided or current
    if (tokenToRemove && tokenToRemove.parentNode) {
        tokenToRemove.remove(); // Remove from DOM
    }
    // Clear the reference only if the removed token *was* the current one
    if (tokenToRemove === currentPowerupToken) {
        currentPowerupToken = null;
    }
}


export function applyBoost(data) {
    const id = data.id;
    const dur = data.duration;
    const mag = data.magnitude;

    // Clear any existing timeout for the same boost type
    if (gameState.powerupTimeouts[id]) {
        clearTimeout(gameState.powerupTimeouts[id]);
    }

    const powerupConfig = powerupTypes.find(p => p.id === id);
    const description = powerupConfig ? powerupConfig.description : '';

    // Store boost info in gameState
    gameState.activeBoosts[id] = {
        endTime: Date.now() + dur,
        magnitude: mag,
        name: data.name,
        description: description
    };

    // Set a new timeout to remove the boost
    gameState.powerupTimeouts[id] = setTimeout(() => removeBoost(id), dur);

    // Recalculate stats and update UI immediately
    calculateDerivedStats();
    updateDisplay();
    updateButtonStates();
    // updateActivePowerupDisplay(); // This is called within updateDisplay generally
}

export function removeBoost(id) {
    if (gameState.activeBoosts[id]) {
        delete gameState.activeBoosts[id];
        if (gameState.powerupTimeouts[id]) {
            clearTimeout(gameState.powerupTimeouts[id]); // Clear timeout just in case
            delete gameState.powerupTimeouts[id];
        }
        console.log(`Boost expired: ${id}`);
        // Recalculate stats and update UI after removal
        calculateDerivedStats();
        updateDisplay();
        updateButtonStates();
        // updateActivePowerupDisplay(); // Called by updateDisplay
    }
}


export function restartBoostTimersOnLoad() {
    const now = Date.now();
    gameState.powerupTimeouts = {}; // Clear any old timeout IDs

    for (const id in gameState.activeBoosts) {
        const boost = gameState.activeBoosts[id];
        const remaining = boost.endTime - now;

        // Ensure description is present (might be missing from older saves)
        if (!boost.description) {
            const powerupConfig = powerupTypes.find(p => p.id === id);
            boost.description = powerupConfig ? powerupConfig.description : '';
        }

        if (remaining > 0) {
            // Restart timeout for the remaining duration
            gameState.powerupTimeouts[id] = setTimeout(() => removeBoost(id), remaining);
        } else {
            // Remove expired boost immediately on load
            delete gameState.activeBoosts[id];
        }
    }
    // Recalculate stats after potentially removing expired boosts
    calculateDerivedStats();
}

// Interval control for spawning
export function stopPowerupSpawning() {
    if (powerupSpawnIntervalId) {
        clearInterval(powerupSpawnIntervalId);
        powerupSpawnIntervalId = null;
        console.log("Powerup spawning stopped.");
    }
     // Also remove any token currently falling when stopping entirely
    // removeActivePowerupToken(); // Consider if this is desired on game pause/win
}

export function startPowerupSpawning() {
    if (powerupSpawnIntervalId || isGamePaused || isGameWon) return; // Don't start if already running or game paused/won
    powerupSpawnIntervalId = setInterval(trySpawnPowerup, POWERUP_SPAWN_INTERVAL_MS);
    console.log(`Powerup spawn check started (${POWERUP_SPAWN_INTERVAL_MS}ms interval).`);
}