// js/powerups.js
"use strict";
import { gameState, isGamePaused, isGameWon } from './state.js';
import { domElements } from './dom.js';
import { calculateDerivedStats } from './engine.js'; // Recalculate after boost
import { updateDisplay, updateButtonStates } from './ui.js'; // Update UI after boost
import { playSoundEffect } from './audio.js';
import {
    POWERUP_CHANCE_PER_INTERVAL, powerupTypes, POWERUP_SFX_CLICK_ID,
    POWERUP_FALL_DURATION_MS, POWERUP_TOKEN_SIZE, POWERUP_SPAWN_INTERVAL_MS
} from './config.js';

let powerupSpawnIntervalId = null;
let currentPowerupToken = null; // Module-scoped token reference

// Tries to spawn a powerup based on chance
export function trySpawnPowerup() {
    // Conditions preventing spawn: game paused/won, no area, already a token falling
    if (isGamePaused || isGameWon || !domElements['powerup-spawn-area'] || currentPowerupToken) {
        return;
    }
    // Random chance check
    if (Math.random() < POWERUP_CHANCE_PER_INTERVAL) {
        const idx = Math.floor(Math.random() * powerupTypes.length);
        createPowerupToken(powerupTypes[idx]);
    }
}

// Creates and animates a powerup token element
export function createPowerupToken(data) {
    const area = domElements['powerup-spawn-area'];
    if (!area || currentPowerupToken) return; // Double check

    console.log(`Spawning powerup: ${data.name}`);

    // Create the outer rotating token div
    const token = document.createElement('div');
    currentPowerupToken = token;
    token.classList.add('powerup-token');
    token.title = `${data.name} (${data.description}) - Click Me!`;
    token.powerupData = data; // Store config data

    // Create the inner image element
    const img = document.createElement('img');
    img.src = `resources/img/${data.image}`;
    img.alt = data.name; // Alt text for accessibility
    img.classList.add('powerup-token-image'); // Add class for styling
    img.draggable = false; // Prevent dragging the image
    token.appendChild(img); // Add image inside the token div

    // Calculate random horizontal position for the outer div
    const areaW = area.offsetWidth;
    token.style.left = `${Math.random() * (areaW - POWERUP_TOKEN_SIZE)}px`;
    token.style.top = '-100px'; // Start above screen

    // Event Handlers (attached to outer div)
    const clickHandler = (e) => {
        e.stopPropagation();
        if (!token.parentNode) return;
        console.log(`Powerup clicked: ${token.powerupData.name}`);
        gameState.totalPowerupsClicked++;
        applyBoost(token.powerupData);
        playSoundEffect(POWERUP_SFX_CLICK_ID);
        removeActivePowerupToken(token); // Remove this specific token
    };

    const animEndHandler = (e) => {
        // Only remove if the FALL animation ended
        if (e.animationName === 'fallAnimation') {
             console.log(`Powerup fall animation ended for: ${data.name}`);
            // Only remove if it's still the 'current' token (wasn't clicked)
             if (token === currentPowerupToken) {
                 removeActivePowerupToken(token);
             }
        }
    };

    token.addEventListener('click', clickHandler);
    token.addEventListener('animationend', animEndHandler);

    // Animations are handled by CSS using the .powerup-token class

    area.appendChild(token);
}

// Removes the specified token (or the current one if null) from the DOM and clears the reference
export function removeActivePowerupToken(tokenElement = null) {
    const tokenToRemove = tokenElement || currentPowerupToken;
    if (tokenToRemove) {
         if (tokenToRemove.parentNode) {
            tokenToRemove.remove();
             console.log("Removed powerup token from DOM.");
         }
         // Clear the global reference *only* if the token being removed *is* the current one
         if (tokenToRemove === currentPowerupToken) {
            currentPowerupToken = null;
             console.log("Cleared current powerup token reference.");
         }
    }
}


// Applies the boost effect to the game state
export function applyBoost(data) {
    const id = data.id;
    const dur = data.duration;
    const mag = data.magnitude;

    // Clear any existing timeout for the *same* boost type to reset duration
    if (gameState.powerupTimeouts && gameState.powerupTimeouts[id]) {
        clearTimeout(gameState.powerupTimeouts[id]);
        console.log(`Cleared existing timeout for boost: ${id}`);
    }

    // Ensure description is available (use from config as source of truth)
    const powerupConfig = powerupTypes.find(p => p.id === id);
    const description = powerupConfig ? powerupConfig.description : 'Effect active';

    console.log(`Applying boost: ${data.name} for ${dur}ms`);

    // Store boost info in gameState
    gameState.activeBoosts[id] = {
        endTime: Date.now() + dur,
        magnitude: mag,
        name: data.name,
        description: description // Store description for UI
    };

    // Ensure the timeouts object exists
    if (!gameState.powerupTimeouts) {
        gameState.powerupTimeouts = {};
    }

    // Set a new timeout to remove the boost after its duration
    gameState.powerupTimeouts[id] = setTimeout(() => removeBoost(id), dur);

    // Recalculate stats and update UI immediately to reflect the boost
    calculateDerivedStats();
    updateDisplay();
    updateButtonStates();
}

// Removes an expired or cleared boost
export function removeBoost(id) {
    if (gameState.activeBoosts && gameState.activeBoosts[id]) {
        console.log(`Boost expired / removed: ${id}`);
        delete gameState.activeBoosts[id]; // Remove from active boosts

        // Clear the associated timeout if it exists
        if (gameState.powerupTimeouts && gameState.powerupTimeouts[id]) {
            clearTimeout(gameState.powerupTimeouts[id]);
            delete gameState.powerupTimeouts[id];
        }

        // Recalculate stats and update UI after removal
        calculateDerivedStats();
        updateDisplay();
        updateButtonStates();
    }
}


// Restarts boost timers on game load based on remaining duration
export function restartBoostTimersOnLoad() {
    const now = Date.now();
    // Ensure activeBoosts and powerupTimeouts exist on gameState
    if (!gameState.activeBoosts) gameState.activeBoosts = {};
    gameState.powerupTimeouts = {}; // Always clear old timeout IDs on load

    console.log("Restarting boost timers on load...");

    // Iterate over a copy of keys in case boosts are removed during iteration
    const boostIds = Object.keys(gameState.activeBoosts);

    boostIds.forEach(id => {
        const boost = gameState.activeBoosts[id];
        if (!boost || !boost.endTime) {
             console.warn(`Invalid boost data found for ID: ${id}. Removing.`);
             delete gameState.activeBoosts[id];
             return; // Skip to next boost
        }

        const remaining = boost.endTime - now;

        // Ensure description is present (might be missing from older saves)
        if (!boost.description) {
            const powerupConfig = powerupTypes.find(p => p.id === id);
            boost.description = powerupConfig ? powerupConfig.description : 'Effect active';
        }

        if (remaining > 0) {
            // Restart timeout for the remaining duration
            console.log(`Restarting timer for ${id} (${(remaining / 1000).toFixed(1)}s remaining).`);
            gameState.powerupTimeouts[id] = setTimeout(() => removeBoost(id), remaining);
        } else {
            // Remove expired boost immediately on load
            console.log(`Boost ${id} already expired on load. Removing.`);
            delete gameState.activeBoosts[id];
        }
    });

    // Recalculate stats once after processing all loaded boosts
    calculateDerivedStats(); // Calculate stats reflecting any immediately removed boosts
    console.log("Boost timer restart process complete.");
}

// Interval control for spawning
export function stopPowerupSpawning() {
    if (powerupSpawnIntervalId) {
        clearInterval(powerupSpawnIntervalId);
        powerupSpawnIntervalId = null;
        console.log("Powerup spawning stopped.");
    }
    // Also remove any token currently falling when stopping spawning
    removeActivePowerupToken();
}

export function startPowerupSpawning() {
    // Prevent starting if already running or game is paused/won
    if (powerupSpawnIntervalId || isGamePaused || isGameWon) return;
    powerupSpawnIntervalId = setInterval(trySpawnPowerup, POWERUP_SPAWN_INTERVAL_MS);
    console.log(`Powerup spawn check started (${POWERUP_SPAWN_INTERVAL_MS}ms interval).`);
}