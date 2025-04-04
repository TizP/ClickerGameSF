// js/dom.js
"use strict";
import { buildingsConfig, upgradesConfig } from './config.js';

export const domElements = {};

const essentialIds = [ // IDs considered critical for basic function
    'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
    'leads-per-click', 'opps-per-click', 'car', 'success-chance', 'cvr', 'cust-cost',
    'click-lead-button', 'click-opp-button', 'background-music', 'volume-slider',
    'mute-button', 'powerup-spawn-area', 'active-powerup-display', 'save-status',
    'toggle-acquisition-button', 'toggle-flexible-workflow'
];

export function cacheDOMElements() {
    console.log("Starting DOM Caching...");
    const ids = [
        // Core Display
        'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
        'leads-per-click', 'opps-per-click', 'lead-click-base-p', 'opp-click-base-p',
        'car', 'success-chance', 'cvr', 'cust-cost',
        // Clickers
        'click-lead-button', 'click-opp-button',
        // Top Bar Misc
        'save-status', 'active-powerup-display', 'game-version',
        // Audio
        'background-music', 'current-track-name', 'play-pause-button', 'play-pause-icon',
        'next-track-button', 'volume-slider', 'mute-button',
        'sfx-purchase', 'sfx-powerup-click',
        // Modals & Controls
        'credits-modal', 'close-credits-button', 'credits-button',
        'win-modal', 'close-win-button',
        'stats-modal', 'close-stats-button', 'stats-button',
        'tutorial-modal', 'close-tutorial-button', 'tutorial-button',
        'settings-modal', 'close-settings-button', 'settings-button', 'soft-refresh-button',
        // Stats Modal Content
        'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps',
        'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed',
        'stat-total-money', 'stat-powerups-clicked',
        // Top Bar Buttons
        'save-button', 'delete-save-button', 'toggle-acquisition-button',
        'toggle-flexible-workflow',
        // Misc
        'powerup-spawn-area'
        // Note: Dynamic elements like upgrade buttons or category containers are NOT cached here.
    ];

    let foundCount = 0;
    let missingEssential = [];

    // Cache standard elements by ID
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            domElements[id] = el;
            foundCount++;
        } else if (essentialIds.includes(id)) {
            // Log critical errors for essential elements
            console.error(`CRITICAL: Essential DOM Element not found: ${id}`);
            missingEssential.push(id);
        } else {
            // Log warnings for non-essential elements (can help debugging)
            // Optional: Comment this out if console gets too noisy during development
            // console.warn(`DOM Element not found (non-essential): ${id}`);
        }
    });

    // Cache Building Buttons and their info spans
    for (const id in buildingsConfig) {
        // Use a consistent naming scheme: buy-ID, ID-count, ID-cost, ID-effect
        const suffixes = ['count', 'cost', 'effect'];
        const buyElId = `buy-${id}`;
        const buyEl = document.getElementById(buyElId);
        if (buyEl) {
             domElements[buyElId] = buyEl;
             foundCount++;
        } else {
             // Warn if the main button is missing
             console.warn(`DOM Element not found for building button: ${buyElId}`);
        }

        // Cache the associated spans, warning if they are missing
        suffixes.forEach(suffix => {
            const elId = `${id}-${suffix}`;
            const el = document.getElementById(elId);
            if (el) {
                 domElements[elId] = el;
                 foundCount++;
            } else {
                 // Warn if info spans are missing, as UI updates might fail
                 console.warn(`DOM Element not found for building info span: ${elId}`);
            }
        });
    }

    // Cache Special (Hardcoded) Upgrade Buttons
    for (const id in upgradesConfig.special) {
        if (id === 'name') continue; // Skip the 'name' property used for grouping
        const elId = `upgrade-${id}`;
        const el = document.getElementById(elId);
        if (el) {
             domElements[elId] = el;
             foundCount++;
        } else {
             console.warn(`DOM Element not found for special upgrade: ${elId}`);
        }
    }

    console.log(`Finished DOM Caching. Found: ${foundCount}`);
    if (missingEssential.length > 0) {
         // Alert and throw error only if ESSENTIAL elements are missing
         console.error("Missing essential elements:", missingEssential.join(', '));
         alert("Fatal Error: Essential UI elements are missing. The game cannot start correctly. Check the console (F12) for details.");
         throw new Error("Missing essential UI elements.");
    }
}