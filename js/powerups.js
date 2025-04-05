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
let diagnosticSpawnCounter = 0; // Counter for logging

// Tries to spawn a powerup based on chance
export function trySpawnPowerup() {
    // TODO: Added detailed logging for spawn conditions
    // console.log("trySpawnPowerup called.");
    if (isGamePaused) { /* console.log("Spawn check skipped: Game is paused."); */ return; }
    if (isGameWon) { /* console.log("Spawn check skipped: Game is won."); */ return; }
    if (!domElements['powerup-spawn-area']) { console.error("Spawn check failed: Missing powerup-spawn-area."); return; }
    if (currentPowerupToken) { /* console.log("Spawn check skipped: Powerup already active/falling."); */ return; }

    const chance = POWERUP_CHANCE_PER_INTERVAL;
    const roll = Math.random();
    // console.log(`Spawn Check: Roll ${roll.toFixed(4)} vs Chance ${chance.toFixed(4)}`);

    if (roll < chance) {
        diagnosticSpawnCounter++;
        console.log(`%cSuccessful spawn roll #${diagnosticSpawnCounter}! (Roll: ${roll.toFixed(4)}, Chance: ${chance.toFixed(4)})`, "color: green; font-weight: bold;");
        const idx = Math.floor(Math.random() * powerupTypes.length);
        if (powerupTypes[idx]) {
            createPowerupToken(powerupTypes[idx]);
        } else {
            console.error(`Failed to spawn: Invalid powerup type index ${idx}`);
        }
    } else {
        // console.log("Spawn roll failed.");
    }
}

// Creates and animates a powerup token element
export function createPowerupToken(data) {
    const area = domElements['powerup-spawn-area'];
    // Double check area exists and no token is currently active
    if (!area) { console.error("Cannot create token: Spawn area missing."); return; }
    if (currentPowerupToken) { console.warn("Cannot create token: Another token seems to be active."); return; }

    console.log(`%cCreating powerup token: ${data.name}`, "color: blue;");

    try {
        // Create the outer rotating token div
        const token = document.createElement('div');
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
        if (areaW <= POWERUP_TOKEN_SIZE) {
             console.warn("Spawn area width is too small for token.");
             token.style.left = '0px';
        } else {
            token.style.left = `${Math.random() * (areaW - POWERUP_TOKEN_SIZE)}px`;
        }
        token.style.top = '-100px'; // Start above screen

        // Add Listeners *before* adding to DOM might be slightly safer
        const clickHandler = (e) => {
            e.stopPropagation(); // Prevent potential clicks on elements behind
            // Check if token still exists in DOM before processing
            if (!token.parentNode) {
                 console.log("Clicked token already removed, ignoring click.");
                 return;
            }
            console.log(`%cPowerup clicked: ${token.powerupData.name}`, "color: magenta; font-weight: bold;");
            gameState.totalPowerupsClicked++;
            applyBoost(token.powerupData);
            playSoundEffect(POWERUP_SFX_CLICK_ID);
            removeActivePowerupToken(token); // Remove this specific token immediately on click
        };

        const animEndHandler = (e) => {
            // Only act if the FALL animation ended specifically on this token
            if (e.target === token && e.animationName === 'fallAnimation') {
                 console.log(`Powerup fall animation ended for: ${data.name}`);
                 // Only remove if it's still the 'current' token (i.e., wasn't clicked and removed earlier)
                 // and if it's still in the DOM
                 if (token === currentPowerupToken && token.parentNode) {
                     console.log("Removing token because fall animation ended.");
                     removeActivePowerupToken(token);
                 } else {
                      console.log("Fall animation ended, but token was already removed or replaced.");
                 }
            }
        };

        token.addEventListener('click', clickHandler);
        token.addEventListener('animationend', animEndHandler);

        // Set the global reference *just before* adding to DOM
        currentPowerupToken = token;
        area.appendChild(token);
        console.log("Token added to DOM and currentPowerupToken set.");

    } catch (error) {
        console.error("Error during createPowerupToken:", error);
        // Attempt to clear the reference if creation failed mid-way
        if (currentPowerupToken) {
            console.error("Clearing currentPowerupToken due to creation error.");
            currentPowerupToken = null;
        }
    }
}

// Removes the specified token (or the current one if null) from the DOM and clears the reference
export function removeActivePowerupToken(tokenElement = null) {
    const tokenToRemove = tokenElement || currentPowerupToken;

    if (tokenToRemove) {
         if (tokenToRemove.parentNode) {
            tokenToRemove.remove(); // Remove from DOM
             console.log("Removed powerup token from DOM.");
         } else {
             // console.log("Token already removed from DOM.");
         }

         // Clear the global reference *only* if the token being removed *is* the current one
         if (tokenToRemove === currentPowerupToken) {
            currentPowerupToken = null;
             console.log("Cleared current powerup token reference.");
         } else {
             // This case might happen if a new token spawns *just* as an old one's animation ends,
             // or if the click handler tries to remove a token that was already replaced.
             console.log("Token removed was not the currently referenced token (currentPowerupToken).");
         }
    } else {
        // console.log("removeActivePowerupToken called, but no token reference to remove.");
    }
}


// Applies the boost effect to the game state
export function applyBoost(data) {
    const id = data.id;
    const dur = data.duration;
    const mag = data.magnitude;

    // Ensure gameState structures exist
    if (!gameState.activeBoosts) gameState.activeBoosts = {};
    if (!gameState.powerupTimeouts) gameState.powerupTimeouts = {};

    // Clear any existing timeout for the *same* boost type to reset duration
    if (gameState.powerupTimeouts[id]) {
        clearTimeout(gameState.powerupTimeouts[id]);
        console.log(`Cleared existing timeout for boost: ${id}`);
    }

    // Ensure description is available (use from config as source of truth)
    const powerupConfig = powerupTypes.find(p => p.id === id);
    const description = powerupConfig ? powerupConfig.description : 'Effect active';
    const name = powerupConfig ? powerupConfig.name : 'Unknown Boost';

    console.log(`Applying boost: ${name} for ${dur}ms`);

    // Store boost info in gameState
    gameState.activeBoosts[id] = {
        endTime: Date.now() + dur,
        magnitude: mag,
        name: name,
        description: description // Store description for UI
    };

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
        const boostName = gameState.activeBoosts[id].name || id; // Get name for logging
        console.log(`%cBoost expired / removed: ${boostName}`, "color: orange;");
        delete gameState.activeBoosts[id]; // Remove from active boosts

        // Clear the associated timeout reference if it exists
        if (gameState.powerupTimeouts && gameState.powerupTimeouts[id]) {
            // No need to clearTimeout here as this function IS the timeout callback
            delete gameState.powerupTimeouts[id];
        }

        // Recalculate stats and update UI after removal
        calculateDerivedStats();
        updateDisplay();
        updateButtonStates();
    } else {
        // console.log(`Attempted to remove boost ${id}, but it wasn't active.`);
    }
}


// Restarts boost timers on game load based on remaining duration
export function restartBoostTimersOnLoad() {
    const now = Date.now();
    // Ensure activeBoosts exists on gameState, initialize powerupTimeouts
    if (!gameState.activeBoosts) gameState.activeBoosts = {};
    gameState.powerupTimeouts = {}; // Always clear old timeout IDs on load

    console.log("Restarting boost timers on load...");

    // Iterate over a copy of keys in case boosts are removed during iteration
    const boostIds = Object.keys(gameState.activeBoosts);
    let timersRestarted = 0;
    let boostsRemoved = 0;

    boostIds.forEach(id => {
        const boost = gameState.activeBoosts[id];
        // Validate boost data structure
        if (!boost || typeof boost !== 'object' || typeof boost.endTime !== 'number' || typeof boost.magnitude !== 'number') {
             console.warn(`Invalid boost data found for ID: ${id}. Removing.`);
             delete gameState.activeBoosts[id];
             boostsRemoved++;
             return; // Skip to next boost
        }

        const remaining = boost.endTime - now;

        // Ensure description and name are present (might be missing from older saves)
        if (!boost.description || !boost.name) {
            const powerupConfig = powerupTypes.find(p => p.id === id);
            boost.description = powerupConfig ? powerupConfig.description : 'Effect active';
            boost.name = powerupConfig ? powerupConfig.name : 'Unknown Boost';
        }

        if (remaining > 0) {
            // Restart timeout for the remaining duration
            // console.log(`Restarting timer for ${boost.name || id} (${(remaining / 1000).toFixed(1)}s remaining).`);
            gameState.powerupTimeouts[id] = setTimeout(() => removeBoost(id), remaining);
            timersRestarted++;
        } else {
            // Remove expired boost immediately on load
            console.log(`Boost ${boost.name || id} already expired on load. Removing.`);
            delete gameState.activeBoosts[id];
            boostsRemoved++;
        }
    });

    console.log(`Boost timer restart complete. Timers restarted: ${timersRestarted}, Expired boosts removed: ${boostsRemoved}.`);

    // Recalculate stats once after processing all loaded boosts
    // This accounts for any boosts that were immediately removed.
    calculateDerivedStats();
}

// Interval control for spawning
export function stopPowerupSpawning() {
    if (powerupSpawnIntervalId) {
        clearInterval(powerupSpawnIntervalId);
        powerupSpawnIntervalId = null;
        console.log("Powerup spawning interval stopped.");
    } else {
        // console.log("Attempted to stop powerup spawning, but interval was not active.");
    }
    // Also remove any token currently falling when stopping spawning (e.g., game pause/win)
    removeActivePowerupToken();
}

export function startPowerupSpawning() {
    // Prevent starting if already running
    if (powerupSpawnIntervalId) {
         console.log("Powerup spawning interval already running.");
         return;
    }
    // Prevent starting if game is paused or won
    if (isGamePaused || isGameWon) {
        console.log("Powerup spawning prevented (game paused or won).");
        return;
    }
    // Clear any lingering token reference just in case
    removeActivePowerupToken();
    // Reset diagnostic counter
    diagnosticSpawnCounter = 0;

    powerupSpawnIntervalId = setInterval(trySpawnPowerup, POWERUP_SPAWN_INTERVAL_MS);
    console.log(`%cPowerup spawn check interval started (${POWERUP_SPAWN_INTERVAL_MS}ms).`, "color: green;");
}