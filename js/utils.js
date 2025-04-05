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
    num = Number(num);
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0';

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum < 1e3) {
        return sign + Math.round(absNum).toString();
    }

    const tiers = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'N', 'd', 'U', 'D', '!', '@', '#', '$', '%', '^', '&', '*', 'A', 'a'];
    const tierIndex = Math.max(0, Math.min(tiers.length - 1, Math.floor(Math.log10(absNum) / 3)));
    const scaledNum = absNum / Math.pow(1000, tierIndex);

    let precision = 0;
    if (tierIndex > 0) {
        if (scaledNum < 10) precision = 2;
        else if (scaledNum < 100) precision = 1;
    }

    let formattedNum = scaledNum.toFixed(precision);
    if (precision > 0 && formattedNum.includes('.')) {
        formattedNum = formattedNum.replace(/0+$/, '');
        if (formattedNum.endsWith('.')) {
             formattedNum = formattedNum.slice(0, -1);
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
     if (isNaN(num) || !isFinite(num)) return `0 ${unit}/s`;

     if (num === 0) return `0 ${unit}/s`;

     if (Math.abs(num) < 0.01) {
         return num.toExponential(2) + ` ${unit}/s`;
     }
     const formattedValue = formatNumber(num);
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
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0.00';

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum < MONEY_FORMAT_THRESHOLD) {
        return sign + absNum.toFixed(2);
    }
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
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0.000';

    if (num === 0) return '0.000';

    const absNum = Math.abs(num);

    if (absNum < 1e-3) return num.toExponential(2);
    if (absNum < 1) return num.toFixed(3);
    if (absNum < 1000) return num.toFixed(2);
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
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '0.0%';
    return (num * 100).toFixed(decimals) + '%';
}

/**
 * Formats a duration in milliseconds into a human-readable string (Xd Yh Zm Ws).
 * @param {number} milliseconds - The duration in milliseconds.
 * @returns {string} Formatted time string.
 */
export function formatTime(milliseconds) {
    if (milliseconds === null || milliseconds === undefined || isNaN(milliseconds) || milliseconds < 0 || !isFinite(milliseconds)) return "0s";

    const totalSeconds = Math.floor(milliseconds / 1000);
    if (totalSeconds === 0 && milliseconds < 1000 && milliseconds >= 0) return "<1s"; // Handle sub-second positive duration
    if (totalSeconds === 0) return "0s";

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) {
         parts.push(`${seconds}s`);
    }

    return parts.join(' ');
}