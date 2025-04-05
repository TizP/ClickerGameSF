// js/ui_strings.js
"use strict";

import { uiStrings } from './main.js'; // Import the loaded strings object
import { domElements } from './dom.js';

/**
 * Retrieves a string from the loaded uiStrings object using a dot-notation key.
 * @param {string} key - The key for the string (e.g., "topBar.saveButtonTitle").
 * @param {object} [replacements={}] - An object containing key-value pairs for placeholder replacement (e.g., { TIME: '10:30' }).
 * @returns {string} The retrieved string, with replacements applied, or the key itself if not found.
 */
export function getString(key, replacements = {}) {
    if (!uiStrings || typeof uiStrings !== 'object') {
        console.error("uiStrings object not available.");
        return key; // Return key as fallback
    }

    const keys = key.split('.');
    let current = uiStrings;

    try {
        for (const k of keys) {
            current = current[k];
            if (current === undefined) {
                // console.warn(`String key not found: ${key}`);
                return key; // Return the full key if any part is missing
            }
        }

        if (typeof current !== 'string') {
            // console.warn(`Value for key "${key}" is not a string.`);
            return key; // Return key if the final value isn't a string
        }

        // Perform replacements
        let result = current;
        for (const placeholder in replacements) {
            // Use a regex for global replacement (replace all occurrences)
            const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
            result = result.replace(regex, replacements[placeholder]);
        }
        return result;

    } catch (error) {
        console.error(`Error accessing string key "${key}":`, error);
        return key; // Return key on error
    }
}

/**
 * Populates the textContent of a DOM element identified by its ID using a string key.
 * @param {string} elementId - The ID of the DOM element.
 * @param {string} stringKey - The key for the string in uiStrings.
 * @param {boolean} [allowHtml=false] - If true, sets innerHTML instead of textContent.
 * @param {object} [replacements={}] - Optional placeholder replacements.
 */
export function populateElementByStringKey(elementId, stringKey, allowHtml = false, replacements = {}) {
    const element = domElements[elementId];
    if (element) {
        const text = getString(stringKey, replacements);
        if (text !== stringKey) { // Only update if string was found
            if (allowHtml) {
                element.innerHTML = text;
            } else {
                element.textContent = text;
            }
        } else {
             console.warn(`String key "${stringKey}" not found for element ID "${elementId}"`);
        }
    } else {
        console.warn(`DOM element with ID "${elementId}" not found for string population.`);
    }
}

/**
 * Populates the title attribute of a DOM element identified by its ID using a string key.
 * @param {string} elementId - The ID of the DOM element.
 * @param {string} stringKey - The key for the string in uiStrings.
 * @param {object} [replacements={}] - Optional placeholder replacements.
 */
export function populateElementByTitleKey(elementId, stringKey, replacements = {}) {
    const element = domElements[elementId];
    if (element) {
        const title = getString(stringKey, replacements);
         if (title !== stringKey) { // Only update if string was found
            element.title = title;
         } else {
              console.warn(`String key "${stringKey}" not found for element title ID "${elementId}"`);
         }
    } else {
        console.warn(`DOM element with ID "${elementId}" not found for title population.`);
    }
}