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
    if (num === null || num === undefined || isNaN(num)) return '0';

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    // Use fixed-point for small numbers (no suffix needed)
    if (absNum < 1e3) {
        // Show decimals only if the number actually has them
        // Using toFixed(0) for small numbers that might have negligible floating point artifacts
        return sign + (absNum % 1 !== 0 ? absNum.toFixed(0) : absNum.toString());
    }

    // Metric suffixes
    const tiers = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd']; // Add more if needed
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
    const formattedNum = scaledNum.toFixed(precision);

    // Avoid showing trailing .0 or .00 (e.g., display 1k instead of 1.0k)
    // Check if formattedNum ends with .0 or .00 after toFixed
    const finalNumString = (precision > 0 && formattedNum.endsWith('0'.repeat(precision)) && formattedNum.includes('.'))
        ? formattedNum.substring(0, formattedNum.indexOf('.')) // Get integer part if trailing zeros exist
        : formattedNum;


    return sign + finalNumString + tiers[tierIndex];
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
     if (isNaN(num)) return `0 ${unit}/s`;

     if (num !== 0 && Math.abs(num) < 0.01) { // Use exponential for very small non-zero numbers
         return num.toExponential(2) + ` ${unit}/s`;
     }
      // Use formatNumber for the numeric part and append unit/s
      // Ensure formatNumber doesn't return just '0' for small numbers that aren't *exactly* zero
     const formattedValue = formatNumber(num);
     return (formattedValue === '0' && num !== 0 ? num.toFixed(2) : formattedValue) + ` ${unit}/s`; // Show decimals if formatNumber rounds to 0
 }


/**
 * Formats a number as currency ($). Uses standard decimal format below a threshold,
 * and compact format (formatNumber) for larger values.
 * @param {number | string} num - The currency value.
 * @returns {string} Formatted currency string (e.g., "$123.45", "$1.23M").
 */
export function formatMoney(num) {
    num = Number(num);
    if (num === null || num === undefined || isNaN(num)) return '0.00';

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
    if (num === 0 || num === null || num === undefined || isNaN(num)) return '0.000';

    const absNum = Math.abs(num);

    // Exponential for very small non-zero values
    if (absNum < 1e-3 && num !== 0) return num.toExponential(2);
    // Higher precision for values between 0.001 and 1
    if (absNum < 1) return num.toFixed(3);
    // Standard 2 decimals for values between 1 and 1000
    if (absNum < 1000) return num.toFixed(2);
    // Compact format for larger values
    return formatNumber(num);
}

/** Alias for formatRateMoney, specifically for CAR display if needed */
export function formatCAR(num) {
    return formatRateMoney(num);
}


/**
 * Formats a number (typically 0-1) as a percentage string.
 * @param {number | string} num - The number to format (e.g., 0.25).
 * @param {number} [decimals=1] - The number of decimal places to show.
 * @returns {string} Formatted percentage string (e.g., "25.0%").
 */
export function formatPercent(num, decimals = 1) {
    num = Number(num);
    if (num === null || num === undefined || isNaN(num)) return '0.0%';
    return (num * 100).toFixed(decimals) + '%';
}

/**
 * Formats a duration in milliseconds into a human-readable string (Xd Yh Zm Ws).
 * @param {number} milliseconds - The duration in milliseconds.
 * @returns {string} Formatted time string.
 */
export function formatTime(milliseconds) {
    if (milliseconds < 0 || isNaN(milliseconds)) return "0s";

    const totalSeconds = Math.floor(milliseconds / 1000);
    if (totalSeconds === 0) return "0s"; // Handle zero duration explicitly

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