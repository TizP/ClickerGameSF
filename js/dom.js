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
        'first-time-modal', 'close-first-time-button', 'ok-first-time-button',
        // Stats Modal Content Spans
        'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps',
        'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed',
        'stat-total-money', 'stat-powerups-clicked',
        // Misc
        'powerup-spawn-area',
        // IDs added for String Population
        'main-title', 'upgrades-panel-title', 'buildables-panel-title', 'track-info-text',
        // Language Flags (ADDED)
        'lang-en-button', 'lang-it-button'
    ];

    let foundCount = 0;
    let missingEssential = [];
    let missingWarnings = []; // Track non-essential missing elements

    // Cache standard elements by ID
    idsToCache.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            domElements[id] = el;
            foundCount++;
        } else {
            // Distinguish between essential errors and warnings
            if (essentialIds.includes(id)) {
                console.error(`CRITICAL: Essential DOM Element not found: ${id}`);
                missingEssential.push(id);
            } else {
                 console.warn(`DOM Element not found: ${id}`);
                 missingWarnings.push(id);
            }
        }
    });

    // Cache Building Button related elements dynamically
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
            }
        });
    }

    console.log(`Finished DOM Caching. Found: ${foundCount} elements.`);
    if (missingWarnings.length > 0) {
        console.warn(`Missing non-essential elements (may affect UI text): ${missingWarnings.join(', ')}`);
    }
    if (missingEssential.length > 0) {
         console.error("Missing essential elements:", missingEssential.join(', '));
         alert("Fatal Error: Essential UI elements are missing. The game cannot start correctly. Check the console (F12) for details.");
         throw new Error("Missing essential UI elements.");
    }
}