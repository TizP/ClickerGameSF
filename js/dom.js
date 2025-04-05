// js/dom.js
"use strict";
import { buildingsConfig, upgradesConfig } from './config.js';

export const domElements = {};

// IDs considered essential for basic function, error thrown if missing
const essentialIds = [
    'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
    'leads-per-click', 'opps-per-click', 'car', 'success-chance', 'cvr', 'cust-cost',
    'click-lead-button', 'click-opp-button', 'background-music', 'volume-slider',
    'mute-button', 'powerup-spawn-area', 'active-powerup-display', 'save-status',
    'toggle-acquisition-button', 'toggle-flexible-workflow'
];

export function cacheDOMElements() {
    console.log("Starting DOM Caching...");
    const idsToCache = [
        // Core Display Spans
        'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
        'leads-per-click', 'opps-per-click', 'car', 'success-chance', 'cvr', 'cust-cost', // 'cust-cost' represents Acquisition Cost
        'lead-click-base-p', 'opp-click-base-p',
        // Clicker Buttons
        'click-lead-button', 'click-opp-button',
        // Top Bar Elements
        'save-status', 'active-powerup-display', 'game-version', 'current-track-name',
        'play-pause-button', 'play-pause-icon', 'next-track-button', 'volume-slider', 'mute-button',
        'toggle-acquisition-button', 'save-button', 'delete-save-button',
        'settings-button', 'stats-button', 'tutorial-button', 'credits-button',
        // Special Upgrade Buttons (Hardcoded IDs)
        'upgrade-costReductStrategic', 'upgrade-playtimeMPSBoost', 'upgrade-flexibleWorkflow',
        'toggle-flexible-workflow',
        // Audio Elements
        'background-music', 'sfx-purchase', 'sfx-powerup-click',
        // Modals & Controls
        'credits-modal', 'close-credits-button',
        'win-modal', 'close-win-button', 'close-win-modal-button',
        'stats-modal', 'close-stats-button',
        'tutorial-modal', 'close-tutorial-button',
        'settings-modal', 'close-settings-button', 'soft-refresh-button',
        'first-time-modal', 'close-first-time-button', 'ok-first-time-button', // TODO: Added first time modal elements
        // Stats Modal Content Spans
        'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps',
        'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed',
        'stat-total-money', 'stat-powerups-clicked',
        // Misc
        'powerup-spawn-area'
    ];

    let foundCount = 0;
    let missingEssential = [];

    // Cache standard elements by ID
    idsToCache.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            domElements[id] = el;
            foundCount++;
        } else {
            console.warn(`DOM Element not found: ${id}`);
            if (essentialIds.includes(id)) {
                console.error(`CRITICAL: Essential DOM Element not found: ${id}`);
                missingEssential.push(id);
            }
        }
    });

    // Cache Building Button related elements dynamically
    // console.log("Caching building elements..."); // Reduce noise
    for (const id in buildingsConfig) {
        const buyButtonId = `buy-${id}`;
        const countSpanId = `${id}-count`;
        const costSpanId = `${id}-cost`;
        const effectSpanId = `${id}-effect`;
        const ids = [buyButtonId, countSpanId, costSpanId, effectSpanId];

        ids.forEach(elId => {
            if (!domElements[elId]) { // Only cache if not already found by idsToCache
                const el = document.getElementById(elId);
                if (el) {
                    domElements[elId] = el;
                    foundCount++;
                }
                // No warning needed here, expected if buttons aren't rendered yet
            }
        });
    }

    console.log(`Finished DOM Caching. Found: ${foundCount} elements.`);
    if (missingEssential.length > 0) {
         console.error("Missing essential elements:", missingEssential.join(', '));
         alert("Fatal Error: Essential UI elements are missing. The game cannot start correctly. Check the console (F12) for details.");
         throw new Error("Missing essential UI elements.");
    }
}