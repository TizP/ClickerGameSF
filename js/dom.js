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
    'toggle-acquisition-button', 'toggle-flexible-workflow' // Core interactive elements
];

export function cacheDOMElements() {
    console.log("Starting DOM Caching...");
    // Combine static IDs with dynamically generated ones needed for core updates
    const idsToCache = [
        // Core Display Spans
        'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
        'leads-per-click', 'opps-per-click', 'car', 'success-chance', 'cvr', 'cust-cost',
        'lead-click-base-p', 'opp-click-base-p', // Paragraphs for tooltips
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
        'win-modal', 'close-win-button',
        'stats-modal', 'close-stats-button',
        'tutorial-modal', 'close-tutorial-button',
        'settings-modal', 'close-settings-button', 'soft-refresh-button',
        // Stats Modal Content Spans
        'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps',
        'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed',
        'stat-total-money', 'stat-powerups-clicked',
        // Misc
        'powerup-spawn-area'
        // Note: Dynamic upgrade category containers and building/upgrade buttons inside them are NOT cached here.
    ];

    let foundCount = 0;
    let missingEssential = [];

    // Cache standard elements by ID
    idsToCache.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            domElements[id] = el;
            foundCount++;
        } else if (essentialIds.includes(id)) {
            // Log critical errors for essential elements
            console.error(`CRITICAL: Essential DOM Element not found: ${id}`);
            missingEssential.push(id);
        }
        // Optional: Log warnings for non-essential elements
        // else { console.warn(`DOM Element not found (non-essential): ${id}`); }
    });

    // Cache Building Button related elements (button, count, cost, effect spans)
    for (const id in buildingsConfig) {
        const buyButtonId = `buy-${id}`;
        const countSpanId = `${id}-count`;
        const costSpanId = `${id}-cost`;
        const effectSpanId = `${id}-effect`;

        const buyButton = document.getElementById(buyButtonId);
        const countSpan = document.getElementById(countSpanId);
        const costSpan = document.getElementById(costSpanId);
        const effectSpan = document.getElementById(effectSpanId);

        if (buyButton) { domElements[buyButtonId] = buyButton; foundCount++; }
        else { console.warn(`DOM Element not found for building button: ${buyButtonId}`); }

        if (countSpan) { domElements[countSpanId] = countSpan; foundCount++; }
        else { console.warn(`DOM Element not found for building info span: ${countSpanId}`); }

        if (costSpan) { domElements[costSpanId] = costSpan; foundCount++; }
        else { console.warn(`DOM Element not found for building info span: ${costSpanId}`); }

        if (effectSpan) { domElements[effectSpanId] = effectSpan; foundCount++; }
        else { console.warn(`DOM Element not found for building info span: ${effectSpanId}`); }
    }

    // Note: Special upgrade buttons were already included in idsToCache by their specific IDs

    console.log(`Finished DOM Caching. Found: ${foundCount} elements.`);
    if (missingEssential.length > 0) {
         // Alert and throw error only if ESSENTIAL elements are missing
         console.error("Missing essential elements:", missingEssential.join(', '));
         alert("Fatal Error: Essential UI elements are missing. The game cannot start correctly. Check the console (F12) for details.");
         throw new Error("Missing essential UI elements.");
    }
}