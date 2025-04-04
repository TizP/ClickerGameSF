// js/utils.js
"use strict";
import { MONEY_FORMAT_THRESHOLD } from './config.js';

// --- Number Formatting ---

/**
 * Formats a number into a compact representation using metric suffixes (k, M, B, T, etc.).
 * Handles large numbers, decimals appropriately for scaled values, and edge cases like Infinity/NaN.
 * @param {number | string} num - The number to format.
 * @returns {string} The formatted number string.
 */
export function formatNumber(num) {
    if (num === Infinity) return 'Infinity';
    // Ensure num is treated as a number, default to 0 if invalid
    num = Number(num);
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0'; // Added isFinite check

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    // Use fixed-point for small numbers (no suffix needed)
    // Using Math.round for small numbers to avoid potential floating point artifacts showing as decimals
    if (absNum < 1e3) {
        return sign + Math.round(absNum).toString();
    }

    // Metric suffixes
    const tiers = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd', 'U', 'D', '!', '@', '#', '$', '%', '^', '&', '*', 'A', 'a']; // Extended tiers
    // Determine the correct tier index based on magnitude
    const tierIndex = Math.max(0, Math.min(tiers.length - 1, Math.floor(Math.log10(absNum) / 3)));

    // Scale the number to the appropriate tier (e.g., 1500 becomes 1.5, 1,500,000 becomes 1.5)
    const scaledNum = absNum / Math.pow(1000, tierIndex);

    // Determine precision based on scaled value and tier
    let precision = 0;
    if (tierIndex > 0) { // Only add decimals if using a suffix (k, M, etc.)
        if (scaledNum < 10) precision = 2;       // e.g., 1.23k
        else if (scaledNum < 100) precision = 1;  // e.g., 12.3M
        // else precision = 0;                    // e.g., 123B (no decimals)
    }

    // Format the scaled number with determined precision
    let formattedNum = scaledNum.toFixed(precision);

    // Remove trailing zeros and potentially the decimal point
    if (precision > 0 && formattedNum.includes('.')) {
        formattedNum = formattedNum.replace(/0+$/, ''); // Remove trailing zeros
        if (formattedNum.endsWith('.')) {
             formattedNum = formattedNum.slice(0, -1); // Remove trailing decimal point
        }
    }

    return sign + formattedNum + tiers[tierIndex];
}

/**
 * Formats a rate (per second) using formatNumber for the value.
 * Handles very small numbers using exponential notation.
 * @param {number} num - The rate value.
 * @param {string} [unit="Units"] - The unit name (e.g., "L", "O").
 * @returns {string} Formatted rate string (e.g., "1.23k L/s").
 */
export function formatPerSecond(num, unit = "Units") {
     num = Number(num);
     if (isNaN(num) || !isFinite(num)) return `0 ${unit}/s`; // Added isFinite check

     if (num === 0) return `0 ${unit}/s`; // Handle exact zero

     if (Math.abs(num) < 0.01) { // Use exponential for very small non-zero numbers
         return num.toExponential(2) + ` ${unit}/s`;
     }
      // Use formatNumber for the numeric part and append unit/s
     const formattedValue = formatNumber(num);
     // If formatNumber rounds to '0' but the number isn't truly zero, show decimals
     return (formattedValue === '0' ? num.toFixed(2) : formattedValue) + ` ${unit}/s`;
 }


/**
 * Formats a number as currency ($). Uses standard decimal format below a threshold,
 * and compact format (formatNumber) for larger values.
 * @param {number | string} num - The currency value.
 * @returns {string} Formatted currency string (e.g., "$123.45", "$1.23M").
 */
export function formatMoney(num) {
    num = Number(num);
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0.00'; // Added isFinite check

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    // Use standard decimal format for smaller amounts
    if (absNum < MONEY_FORMAT_THRESHOLD) {
        return sign + absNum.toFixed(2);
    }
    // Use compact format for large amounts
    return sign + formatNumber(num);
}

/**
 * Formats a rate that represents money per unit time (like CVR).
 * Aims for more precision for small rates.
 * @param {number | string} num - The rate value.
 * @returns {string} Formatted rate string.
 */
export function formatRateMoney(num) {
    num = Number(num);
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0.000'; // Added isFinite check

    if (num === 0) return '0.000';

    const absNum = Math.abs(num);

    // Exponential for very small non-zero values
    if (absNum < 1e-3) return num.toExponential(2);
    // Higher precision for values between 0.001 and 1
    if (absNum < 1) return num.toFixed(3);
    // Standard 2 decimals for values between 1 and 1000
    if (absNum < 1000) return num.toFixed(2);
    // Compact format for larger values
    return formatNumber(num);
}

/** Alias for formatRateMoney, specifically for CAR display if needed */
export function formatCAR(num) {
    return formatRateMoney(num); // Use the same logic as CVR formatting
}


/**
 * Formats a number (typically 0-1) as a percentage string.
 * @param {number | string} num - The number to format (e.g., 0.25).
 * @param {number} [decimals=1] - The number of decimal places to show.
 * @returns {string} Formatted percentage string (e.g., "25.0%").
 */
export function formatPercent(num, decimals = 1) {
    num = Number(num);
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0.0%'; // Added isFinite check
    return (num * 100).toFixed(decimals) + '%';
}

/**
 * Formats a duration in milliseconds into a human-readable string (Xd Yh Zm Ws).
 * @param {number} milliseconds - The duration in milliseconds.
 * @returns {string} Formatted time string.
 */
export function formatTime(milliseconds) {
    if (milliseconds === null || milliseconds === undefined || isNaN(milliseconds) || milliseconds < 0 || !isFinite(milliseconds)) return "0s"; // Added isFinite check

    const totalSeconds = Math.floor(milliseconds / 1000);
    if (totalSeconds === 0 && milliseconds < 1000) return "<1s"; // Show something for very short durations
    if (totalSeconds === 0) return "0s"; // Handle zero seconds explicitly

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    // Show seconds only if they are non-zero OR if it's the only unit
    if (seconds > 0 || parts.length === 0) {
         parts.push(`${seconds}s`);
    }

    return parts.join(' ');
}