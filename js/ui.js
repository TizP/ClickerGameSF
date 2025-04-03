// js/ui.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon, setGamePaused, setGameWon } from './state.js';
import { getCurrentRates, getBuildingCost, getUpgradeCost, getCurrentCustomerCost } from './engine.js';
import { formatNumber, formatMoney, formatPerSecond, formatRateMoney, formatCAR, formatPercent, formatTime } from './utils.js';
import { buildingsConfig, upgradesConfig } from './config.js';
import { stopPowerupSpawning, startPowerupSpawning, removeActivePowerupToken } from './powerups.js'; // Control powerups on win/close
import { saveGame } from './saveLoad.js'; // Save on win

let statsUpdateIntervalId = null;
let saveStatusTimeoutId = null;

// --- Display Update Functions ---
export function updateDisplay() {
    try {
        // Get the latest calculated rates
        const rates = getCurrentRates();

        // Check for essential elements first
        const coreElements = [
            domElements.leads, domElements.opportunities, domElements.customers, domElements.money,
            domElements.lps, domElements.ops, domElements.mps, domElements['leads-per-click'],
            domElements['opps-per-click'], domElements.car, domElements['success-chance'],
            domElements.cvr, domElements['cust-cost']
        ];
        if (coreElements.some(el => !el)) {
             console.error("Cannot update display: One or more core DOM elements missing.");
             return;
        }


        domElements.leads.textContent = formatNumber(gameState.leads);
        domElements.opportunities.textContent = formatNumber(gameState.opportunities);
        domElements.customers.textContent = formatNumber(gameState.customers);
        domElements.money.textContent = '$' + formatMoney(gameState.money);
        domElements.lps.textContent = formatNumber(rates.leadsPerSecond);
        domElements.ops.textContent = formatNumber(rates.opportunitiesPerSecond);
        domElements.mps.textContent = '$' + formatMoney(rates.moneyPerSecond);

        // --- Calculate and Display Effective Clicks ---
        const clickBoost = gameState.activeBoosts?.['clickBoost'];
        const clickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;

        const currentLPS = rates.leadsPerSecond;
        const currentOPS = rates.opportunitiesPerSecond;

        let effectiveLeadsPerClick = (gameState.leadsPerClick + (currentLPS * (gameState.leadClickPercentBonus || 0))) * clickMultiplier;
        let effectiveOppsPerClick = (gameState.opportunitiesPerClick + (currentOPS * (gameState.oppClickPercentBonus || 0))) * clickMultiplier;

        // Ensure values are numbers before formatting
        effectiveLeadsPerClick = (!isNaN(effectiveLeadsPerClick) && isFinite(effectiveLeadsPerClick)) ? effectiveLeadsPerClick : 0;
        effectiveOppsPerClick = (!isNaN(effectiveOppsPerClick) && isFinite(effectiveOppsPerClick)) ? effectiveOppsPerClick : 0;


        domElements['leads-per-click'].textContent = formatNumber(effectiveLeadsPerClick);
        domElements['opps-per-click'].textContent = formatNumber(effectiveOppsPerClick);

        // Update tooltips for click stats
        if (domElements['lead-click-base-p']) {
            const base = gameState.leadsPerClick;
            const bonusPercentAmt = currentLPS * (gameState.leadClickPercentBonus || 0);
            let title = `Effective: ${formatNumber(effectiveLeadsPerClick)}/Click\nBase: ${formatNumber(base)}\n% Bonus: +${formatPercent(gameState.leadClickPercentBonus, 1)} L/S (+${formatNumber(bonusPercentAmt)})`;
            if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
            domElements['lead-click-base-p'].title = title;
        }
        if (domElements['opp-click-base-p']) {
            const base = gameState.opportunitiesPerClick;
            const bonusPercentAmt = currentOPS * (gameState.oppClickPercentBonus || 0);
            let title = `Effective: ${formatNumber(effectiveOppsPerClick)}/Click\nBase: ${formatNumber(base)}\n% Bonus: +${formatPercent(gameState.oppClickPercentBonus, 1)} O/S (+${formatNumber(bonusPercentAmt)})`;
            if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
            domElements['opp-click-base-p'].title = title;
        }
        // --- End Effective Click Display ---

        domElements.car.textContent = formatCAR(rates.customerAcquisitionRate);
        domElements['success-chance'].textContent = (gameState.acquisitionSuccessChance * 100).toFixed(1);
        domElements.cvr.textContent = formatRateMoney(rates.customerValueRate);
        domElements['cust-cost'].textContent = formatNumber(getCurrentCustomerCost());

        updateActivePowerupDisplay(); // Update powerup display as part of main display update

    } catch (e) { console.error("Error in updateDisplay:", e); }
}

export function updateButtonStates() {
    const isDisabledGlobal = isGamePaused || isGameWon;
    try {
        // Buildings
        for (const id in buildingsConfig) {
            const btn = domElements[`buy-${id}`];
            const cnt = domElements[`${id}-count`];
            const cst = domElements[`${id}-cost`];
            const eff = domElements[`${id}-effect`];

            if (!btn || !cnt || !cst) continue; // Skip if elements missing

            const cfg = buildingsConfig[id];
            const state = gameState.buildings[id] || { count: 0 };
            const cost = getBuildingCost(id); // Uses function from engine.js
            let afford = false;
            let cTxt = '?';

            if (cfg.costCurrency === 'both') {
                afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps;
                cTxt = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`;
            } else if (cfg.costCurrency === 'leads') {
                afford = gameState.leads >= cost.leads;
                cTxt = `${formatNumber(cost.leads)} L`;
            } else if (cfg.costCurrency === 'opportunities') {
                afford = gameState.opportunities >= cost.opps;
                cTxt = `${formatNumber(cost.opps)} O`;
            } else if (cfg.costCurrency === 'money') {
                afford = gameState.money >= cost.money;
                cTxt = `$${formatMoney(cost.money)}`;
            }

            btn.disabled = !afford || isDisabledGlobal;
            cst.textContent = `Cost: ${cTxt}`;
            cnt.textContent = state.count;

            // Update effect text (requires recalculating individual building output)
            if (eff) {
                let bLPS = cfg.baseLPS || 0, bOPS = cfg.baseOPS || 0;
                let fLPS = 0, fOPS = 0, pLPS = 1.0, pOPS = 1.0, mLPS = 1.0, mOPS = 1.0;
                const gE = gameState.buildingEfficiencyMultiplier || 1.0;
                const cM = gameState.custGlobalMultiplier || 1.0;

                // Check relevant upgrades
                 for (const uId in upgradesConfig) {
                     const uCfg = upgradesConfig[uId];
                     if (gameState.upgrades[uId]?.purchased && uCfg.targetBuilding === id) {
                         if(uCfg.flatBonusLPS) fLPS += uCfg.flatBonusLPS;
                         if(uCfg.flatBonusOPS) fOPS += uCfg.flatBonusOPS;
                         if(uCfg.percentBonusLPS) pLPS += uCfg.percentBonusLPS;
                         if(uCfg.percentBonusOPS) pOPS += uCfg.percentBonusOPS;
                         if(uCfg.multiplierBonusLPS) mLPS *= uCfg.multiplierBonusLPS;
                         if(uCfg.multiplierBonusOPS) mOPS *= uCfg.multiplierBonusOPS;
                     }
                 }

                let finLPS = (bLPS + fLPS) * pLPS * mLPS * gE * cM;
                let finOPS = (bOPS + fOPS) * pOPS * mOPS * gE * cM;

                const parts = [];
                if (finLPS > 0) parts.push(`+${formatNumber(finLPS)} L`);
                if (finOPS > 0) parts.push(`+${formatNumber(finOPS)} O`);
                eff.textContent = parts.length > 0 ? parts.join(', ') : "Effect N/A"; // Or some placeholder
            }
        }

        // Upgrades
        for (const id in upgradesConfig) {
            const el = domElements[`upgrade-${id}`];
            if (!el) continue;

            const cfg = upgradesConfig[id];
            const state = gameState.upgrades[id] || { purchased: false };
            const cost = getUpgradeCost(id); // Uses function from engine.js
            let afford = false;
            let cTxt = '?';

            if (id === 'flexibleWorkflow') {
                afford = gameState.money >= cost.money && gameState.customers >= cost.customers;
                cTxt = `${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`;
            } else if (cfg.costCurrency === 'both') {
                afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps;
                cTxt = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`;
            } else if (cfg.costCurrency === 'leads') {
                afford = gameState.leads >= cost.leads;
                cTxt = `${formatNumber(cost.leads)} L`;
            } else if (cfg.costCurrency === 'opportunities') {
                afford = gameState.opportunities >= cost.opps;
                cTxt = `${formatNumber(cost.opps)} O`;
            } else if (cfg.costCurrency === 'money') {
                afford = gameState.money >= cost.money;
                cTxt = `$${formatMoney(cost.money)}`;
            } else if (cfg.costCurrency === 'customers') {
                afford = gameState.customers >= cost.customers;
                cTxt = `${formatNumber(cost.customers)} Cust`;
            }

            const purchased = state.purchased === true;
            el.disabled = !afford || purchased || isDisabledGlobal;

            const cstSpn = el.querySelector('.cost');
            const effSpn = el.querySelector('.effect'); // Assuming effect text is static in HTML

            if (purchased) {
                el.classList.add('purchased');
                if (cstSpn) cstSpn.style.display = 'none';
                if (effSpn) effSpn.style.display = 'none'; // Hide static effect text too? Or keep visible? Your choice.
            } else {
                el.classList.remove('purchased');
                if (cstSpn) {
                    cstSpn.style.display = 'block'; // Ensure visible
                    cstSpn.textContent = `Cost: ${cTxt}`;
                }
                 if (effSpn) effSpn.style.display = 'block'; // Ensure effect span is visible if not purchased
            }
        }

        // Update specific toggle buttons
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();
        // Mute button visuals updated in audio.js via setVolume/toggleMute

    } catch (e) { console.error("Error in updateButtonStates:", e); }
}


export function updateAcquisitionButtonVisuals() {
    const btn = domElements['toggle-acquisition-button'];
    if (!btn) return;
    const isPaused = gameState.isAcquisitionPaused;
    btn.textContent = isPaused ? 'Resume Acq' : 'Pause Acq';
    btn.title = isPaused ? 'Resume automatic spending of Leads/Opps on customer acquisition attempts' : 'Pause automatic spending of Leads/Opps on customer acquisition attempts';
    btn.classList.toggle('paused', isPaused);
    btn.disabled = isGameWon || isGamePaused; // Use imported state flags
}

export function updateFlexibleWorkflowToggleButtonVisuals() {
    const btn = domElements['toggle-flexible-workflow'];
    if (!btn) return;
    const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true;
    const isActive = gameState.flexibleWorkflowActive;

    btn.disabled = !isPurchased || isGamePaused || isGameWon;
    btn.classList.toggle('active', isActive && isPurchased);

    if (isActive && isPurchased) {
        btn.textContent = 'Deactivate Flex';
        btn.title = 'Stop balancing L/O generation focus.';
    } else {
        btn.textContent = 'Activate Flex';
        btn.title = isPurchased ? 'Balance L/O generation focus based on current amounts.' : 'Purchase the Flexible Workflow upgrade first to enable toggling.';
    }
}

// --- Modal Logic ---
export function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('show');
        // Potentially pause game when *any* modal shows? Optional.
        // setGamePaused(true);
    }
}

export function hideModal(modalElement) {
     if (modalElement) {
         modalElement.classList.remove('show');
         // Potentially resume game when *any* modal hides? Optional.
         // setGamePaused(false);
         // Stop stats updates if stats modal is hidden
         if (modalElement === domElements['stats-modal'] && statsUpdateIntervalId) {
             clearInterval(statsUpdateIntervalId);
             statsUpdateIntervalId = null;
         }
     }
}

export function showCredits() { showModal(domElements['credits-modal']); }
export function hideCredits() { hideModal(domElements['credits-modal']); }

export function showStats() {
    const modal = domElements['stats-modal'];
    if (!modal) return;
    updateStatsDisplay(); // Update once immediately on show
    showModal(modal);
    if (statsUpdateIntervalId) clearInterval(statsUpdateIntervalId); // Clear old interval
    statsUpdateIntervalId = setInterval(updateStatsDisplay, 1000); // Use STATS_UPDATE_INTERVAL_MS from config?
}
export function hideStats() { hideModal(domElements['stats-modal']); } // Interval cleared in hideModal

export function showTutorial() { showModal(domElements['tutorial-modal']); }
export function hideTutorial() { hideModal(domElements['tutorial-modal']); }

export function triggerWin() {
    if (isGameWon) return;
    console.log("WIN!");
    setGameWon(true); // Update state flag
    setGamePaused(true); // Pause the game
    stopPowerupSpawning(); // Stop powerups
    removeActivePowerupToken(); // Remove any falling token
    updateButtonStates(); // Disable buttons
    updateAcquisitionButtonVisuals(); // Update pause button state
    updateFlexibleWorkflowToggleButtonVisuals(); // Update flex button state
    saveGame(); // Save progress on win
    showModal(domElements['win-modal']);
}

export function closeWinScreen() {
    hideModal(domElements['win-modal']);
    // Game remains won, but we unpause if player wants to continue
    setGamePaused(false);
    startPowerupSpawning(); // Allow powerups again if they keep playing
    updateButtonStates();
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();
}


// --- Stats Modal Update ---
export function updateStatsDisplay() {
    const modal = domElements['stats-modal'];
    // Check if the modal exists and is actually visible
    if (!modal || !modal.classList.contains('show')) {
        // If modal isn't showing, clear the interval if it exists
        if (statsUpdateIntervalId) {
            clearInterval(statsUpdateIntervalId);
            statsUpdateIntervalId = null;
        }
        return; // Don't update if not visible
    }

    try {
        // Ensure stats elements exist before trying to update
        if(domElements['stat-game-time']) domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now()));
        if(domElements['stat-lead-clicks']) domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks);
        if(domElements['stat-opp-clicks']) domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks);
        if(domElements['stat-manual-leads']) domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads);
        if(domElements['stat-manual-opps']) domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps);
        if(domElements['stat-auto-leads']) domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads);
        if(domElements['stat-auto-opps']) domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps);
        if(domElements['stat-acq-attempts']) domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts);
        if(domElements['stat-acq-success']) domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions);
        if(domElements['stat-acq-failed']) domElements['stat-acq-failed'].textContent = formatNumber(gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions);
        if(domElements['stat-powerups-clicked']) domElements['stat-powerups-clicked'].textContent = formatNumber(gameState.totalPowerupsClicked);
        if(domElements['stat-total-money']) domElements['stat-total-money'].textContent = '$' + formatMoney(gameState.totalMoneyEarned);
    } catch (e) {
        console.error("Error updating stats display:", e);
        hideStats(); // Hide stats modal on error
    }
}


// --- Save Status Display ---
export function displaySaveStatus(msg, dur = 3000) {
    const el = domElements['save-status'];
    if (!el) return;
    if (saveStatusTimeoutId) clearTimeout(saveStatusTimeoutId);
    el.textContent = msg;
    el.classList.add('visible');
    saveStatusTimeoutId = setTimeout(() => el.classList.remove('visible'), dur);
}


// --- Active Powerup Display --- (Called by updateDisplay)
export function updateActivePowerupDisplay() {
    const displayEl = domElements['active-powerup-display'];
    if (!displayEl) return;

    const activeIds = Object.keys(gameState.activeBoosts);
    if (activeIds.length === 0) {
        displayEl.innerHTML = ''; // Clear if no boosts
        displayEl.title = "No active power-ups";
        return;
    }

    // Display the first active boost (could be extended to show multiple)
    const firstBoostId = activeIds[0];
    const boost = gameState.activeBoosts[firstBoostId];
    if (!boost) {
        displayEl.innerHTML = '';
         displayEl.title = "No active power-ups";
        return;
    }

    const remainingTimeMs = boost.endTime - Date.now();
    if (remainingTimeMs <= 0) {
        displayEl.innerHTML = ''; // Clear if expired (should be removed by timeout soon)
         displayEl.title = "No active power-ups";
    } else {
        const remainingSeconds = (remainingTimeMs / 1000).toFixed(1);
        // Use innerHTML carefully, ensure boost names/descriptions are safe
        displayEl.innerHTML = `${boost.name}: ${remainingSeconds}s<br><span style="font-size: 0.9em; font-weight: normal;">(${boost.description || 'Effect active'})</span>`;
        displayEl.title = `Active: ${boost.name} (${boost.description}). ${remainingSeconds}s remaining.`;
    }
}