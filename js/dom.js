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
        'leads', 'opportunities', 'customers', 'money', 'lps', 'ops', 'mps',
        'leads-per-click', 'opps-per-click', 'lead-click-base-p', 'opp-click-base-p',
        'car', 'success-chance', 'cvr', 'cust-cost',
        'click-lead-button', 'click-opp-button',
        'save-status',
        'background-music', 'current-track-name', 'play-pause-button', 'play-pause-icon',
        'next-track-button', 'volume-slider', 'mute-button',
        'sfx-purchase', 'sfx-powerup-click',
        'credits-modal', 'close-credits-button', 'credits-button',
        'win-modal', 'close-win-button',
        'stats-modal', 'close-stats-button', 'stats-button',
        'tutorial-modal', 'close-tutorial-button', 'tutorial-button',
        'stat-game-time', 'stat-lead-clicks', 'stat-opp-clicks', 'stat-manual-leads', 'stat-manual-opps',
        'stat-auto-leads', 'stat-auto-opps', 'stat-acq-attempts', 'stat-acq-success', 'stat-acq-failed',
        'stat-total-money', 'stat-powerups-clicked',
        'save-button', 'delete-save-button', 'toggle-acquisition-button',
        'settings-button', 'toggle-flexible-workflow', 'game-version',
        'powerup-spawn-area', 'active-powerup-display'
    ];

    let foundCount = 0;
    let missingEssential = [];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            domElements[id] = el;
            foundCount++;
        } else if (essentialIds.includes(id)) {
            console.error(`CRITICAL: Essential DOM Element not found: ${id}`);
            missingEssential.push(id);
        } else {
           // console.warn(`DOM Element not found: ${id}`); // Optional: Less verbose logging
        }
    });

    for (const id in buildingsConfig) {
        ['buy', 'count', 'cost', 'effect'].forEach(suffix => {
            const elId = suffix === 'buy' ? `buy-${id}` : `${id}-${suffix}`;
            const el = document.getElementById(elId);
            if (el) {
                 domElements[elId] = el;
                 foundCount++;
            } else {
                 // console.warn(`Building DOM Element not found: ${elId}`);
            }
        });
    }
    for (const id in upgradesConfig) {
        const el = document.getElementById(`upgrade-${id}`);
        if (el) {
            domElements[`upgrade-${id}`] = el;
            foundCount++;
        } else {
            // console.warn(`Upgrade DOM Element not found: upgrade-${id}`);
        }
    }

    console.log(`Finished DOM Caching. Found: ${foundCount}`);
    if (missingEssential.length > 0) {
         console.error("Missing essential elements:", missingEssential.join(', '));
         alert("Fatal Error: Essential UI elements are missing. Check console.");
         throw new Error("Missing essential UI elements."); // Stop execution
    }
}