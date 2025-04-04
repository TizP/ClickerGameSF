// js/ui.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon, setGamePaused, setGameWon } from './state.js';
import { getCurrentRates, getBuildingCost, getUpgradeCost, getCurrentCustomerCost, findUpgradeConfigById } from './engine.js';
import { formatNumber, formatMoney, formatPerSecond, formatRateMoney, formatCAR, formatPercent, formatTime } from './utils.js';
import { buildingsConfig, upgradesConfig, STATS_UPDATE_INTERVAL_MS } from './config.js';
import { stopPowerupSpawning, startPowerupSpawning, removeActivePowerupToken } from './powerups.js';
import { saveGame } from './saveLoad.js'; // Used for win screen auto-save

let statsUpdateIntervalId = null;
let saveStatusTimeoutId = null;

// --- Helper to create an Upgrade Button Element ---
// (Keep existing createUpgradeButtonElement function - unchanged)
function createUpgradeButtonElement(upgradeId, config, categoryId = null) {
    const button = document.createElement('button');
    button.id = `upgrade-${upgradeId}`;
    button.classList.add('upgrade-button');
    button.disabled = true; // Start disabled, enable later based on cost/state
    const nameSpan = document.createElement('span');
    nameSpan.textContent = config.name || upgradeId;
    const costSpan = document.createElement('span');
    costSpan.classList.add('cost');
    costSpan.textContent = 'Cost: Loading...';
    const effectSpan = document.createElement('span');
    effectSpan.classList.add('effect');
    if (upgradeId === 'playtimeMPSBoost') {
        effectSpan.textContent = "+MPS based on Playtime";
    } else {
        effectSpan.textContent = config.description || ''; // Use full desc for effect span now
    }
    // Use description for tooltip
    button.title = config.description || config.name || '';
    button.appendChild(nameSpan);
    button.appendChild(costSpan);
    button.appendChild(effectSpan);
    button.dataset.upgradeId = upgradeId;
    if (categoryId) { button.dataset.categoryId = categoryId; }
    return button;
}


// --- Display Update Functions ---
// (Keep existing updateDisplay function - unchanged)
export function updateDisplay() {
    try {
        const rates = getCurrentRates();
        const coreElements = [
            domElements.leads, domElements.opportunities, domElements.customers, domElements.money,
            domElements.lps, domElements.ops, domElements.mps,
            domElements['leads-per-click'], domElements['opps-per-click'],
            domElements.car, domElements['success-chance'], domElements.cvr, domElements['cust-cost']
        ];
        if (coreElements.some(el => !el)) {
            console.error("Cannot update display: Core DOM elements missing.");
            return;
        }

        domElements.leads.textContent = formatNumber(gameState.leads);
        domElements.opportunities.textContent = formatNumber(gameState.opportunities);
        domElements.customers.textContent = formatNumber(gameState.customers);
        domElements.money.textContent = '$' + formatMoney(gameState.money);
        domElements.lps.textContent = formatNumber(rates.leadsPerSecond);
        domElements.ops.textContent = formatNumber(rates.opportunitiesPerSecond);
        domElements.mps.textContent = '$' + formatMoney(rates.moneyPerSecond);
        domElements.car.textContent = formatCAR(rates.customerAcquisitionRate);
        domElements['success-chance'].textContent = (gameState.acquisitionSuccessChance * 100).toFixed(1); // Get directly from state
        domElements.cvr.textContent = formatRateMoney(rates.customerValueRate);
        domElements['cust-cost'].textContent = formatNumber(getCurrentCustomerCost());

        const clickBoost = gameState.activeBoosts?.['clickBoost'];
        const baseClickMultiplier = gameState.globalClickMultiplier || 1.0;
        const powerupClickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;
        const totalClickMultiplier = baseClickMultiplier * powerupClickMultiplier;
        const currentLPS = rates.leadsPerSecond;
        const currentOPS = rates.opportunitiesPerSecond;
        let effectiveLeadsPerClick = (gameState.leadsPerClick + (currentLPS * (gameState.leadClickPercentBonus || 0))) * totalClickMultiplier;
        let effectiveOppsPerClick = (gameState.opportunitiesPerClick + (currentOPS * (gameState.oppClickPercentBonus || 0))) * totalClickMultiplier;
        effectiveLeadsPerClick = (!isNaN(effectiveLeadsPerClick) && isFinite(effectiveLeadsPerClick)) ? effectiveLeadsPerClick : 0;
        effectiveOppsPerClick = (!isNaN(effectiveOppsPerClick) && isFinite(effectiveOppsPerClick)) ? effectiveOppsPerClick : 0;
        domElements['leads-per-click'].textContent = formatNumber(effectiveLeadsPerClick);
        domElements['opps-per-click'].textContent = formatNumber(effectiveOppsPerClick);

        if (domElements['lead-click-base-p']) {
            const base = gameState.leadsPerClick;
            const bonusPercentAmt = currentLPS * (gameState.leadClickPercentBonus || 0);
            let title = `Effective: ${formatNumber(effectiveLeadsPerClick)}/Click\nBase: ${formatNumber(base)}`;
            if(bonusPercentAmt > 0) title += `\n% Bonus: +${formatPercent(gameState.leadClickPercentBonus, 1)} L/S (+${formatNumber(bonusPercentAmt)})`;
            if(baseClickMultiplier !== 1.0) title += `\nUpgrade Mult: x${baseClickMultiplier.toFixed(2)}`;
            if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
            domElements['lead-click-base-p'].title = title;
        }
        if (domElements['opp-click-base-p']) {
            const base = gameState.opportunitiesPerClick;
            const bonusPercentAmt = currentOPS * (gameState.oppClickPercentBonus || 0);
            let title = `Effective: ${formatNumber(effectiveOppsPerClick)}/Click\nBase: ${formatNumber(base)}`;
            if(bonusPercentAmt > 0) title += `\n% Bonus: +${formatPercent(gameState.oppClickPercentBonus, 1)} O/S (+${formatNumber(bonusPercentAmt)})`;
            if(baseClickMultiplier !== 1.0) title += `\nUpgrade Mult: x${baseClickMultiplier.toFixed(2)}`;
            if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
            domElements['opp-click-base-p'].title = title;
        }
        updateActivePowerupDisplay();
    } catch (e) { console.error("Error in updateDisplay:", e); }
}


export function updateButtonStates() {
    const isDisabledGlobal = isGamePaused || isGameWon;
    const rates = getCurrentRates();

    try {
        // --- Update Building Buttons ---
        // (Keep existing Building Button update logic - unchanged)
        for (const id in buildingsConfig) {
            const btn = domElements[`buy-${id}`]; const cnt = domElements[`${id}-count`];
            const cst = domElements[`${id}-cost`]; const eff = domElements[`${id}-effect`];
            if (!btn || !cnt || !cst || !eff) continue;

            const cfg = buildingsConfig[id]; const state = gameState.buildings[id] || { count: 0 };
            const cost = getBuildingCost(id);
            let afford = false; let cTxt = '?';

            if (cfg.costCurrency === 'both') { afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
            else if (cfg.costCurrency === 'leads') { afford = gameState.leads >= cost.leads; cTxt = `${formatNumber(cost.leads)} L`; }
            else if (cfg.costCurrency === 'opportunities') { afford = gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.opps)} O`; }
            else if (cfg.costCurrency === 'money') { afford = gameState.money >= cost.money; cTxt = `$${formatMoney(cost.money)}`; }

            btn.disabled = !afford || isDisabledGlobal;
            cst.textContent = `Cost: ${cTxt}`;
            cnt.textContent = state.count;

            let effectText = "Effect N/A"; let tooltipText = cfg.flavour || cfg.name;

            if (cfg.baseLPS || cfg.baseOPS) {
                 let bLPS = cfg.baseLPS || 0, bOPS = cfg.baseOPS || 0; let fLPS = 0, fOPS = 0, pLPS = 1.0, pOPS = 1.0, mLPS = 1.0, mOPS = 1.0;
                 const gE = gameState.buildingEfficiencyMultiplier || 1.0; const cM = gameState.custGlobalMultiplier || 1.0;
                 const leadTM = gameState.leadTeamMultiplier || 1.0; const oppTM = gameState.oppTeamMultiplier || 1.0; const intM = gameState.integratedMultiplier || 1.0;
                 const isSdrSyn = gameState.upgrades['sdrSynergyBoost']?.purchased; const isBdrSyn = gameState.upgrades['bdrSynergyBoost']?.purchased;
                 const sdrC = gameState.buildings['sdr']?.count || 0; const bdrC = gameState.buildings['bdr']?.count || 0;
                 const leadSynBonus = isSdrSyn ? Math.floor(sdrC / 10) * 0.01 : 0; const oppSynBonus = isBdrSyn ? Math.floor(bdrC / 10) * 0.01 : 0;

                 for (const upId in gameState.upgrades) { if(!gameState.upgrades[upId]?.purchased) continue; let uCfgFound = findUpgradeConfigById(upId); if (uCfgFound && uCfgFound.config.targetBuilding === id) { let uCfg = uCfgFound.config; if(uCfg.flatBonusLPS) fLPS += uCfg.flatBonusLPS; if(uCfg.flatBonusOPS) fOPS += uCfg.flatBonusOPS; if(uCfg.percentBonusLPS) pLPS += uCfg.percentBonusLPS; if(uCfg.percentBonusOPS) pOPS += uCfg.percentBonusOPS; if(uCfg.multiplierBonusLPS) mLPS *= uCfg.multiplierBonusLPS; if(uCfg.multiplierBonusOPS) mOPS *= uCfg.multiplierBonusOPS; }}

                 let finLPS = (bLPS + fLPS) * pLPS * mLPS; let finOPS = (bOPS + fOPS) * pOPS * mOPS;
                 if (leadSynBonus > 0 && id !== 'sdr' && ['webform', 'pardot', 'nurture', 'marketingcloud'].includes(id)) finLPS *= (1 + leadSynBonus);
                 if (oppSynBonus > 0 && id !== 'bdr' && ['qualbot', 'solutionengineer', 'demospec', 'proposaldesk'].includes(id)) finOPS *= (1 + oppSynBonus);
                 finLPS *= gE * cM; finOPS *= gE * cM;
                 if (['sdr', 'webform', 'pardot', 'nurture', 'marketingcloud'].includes(id)) finLPS *= leadTM;
                 if (['bdr', 'qualbot', 'solutionengineer', 'demospec', 'proposaldesk'].includes(id)) finOPS *= oppTM;
                 if (['integration', 'platform', 'ecosystem', 'cloudsuite', 'hyperscaler', 'aidata'].includes(id)){ finLPS *= intM; finOPS *= intM; }

                 const parts = [];
                 if (finLPS > 0) parts.push(`+${formatNumber(finLPS)} L/s`);
                 if (finOPS > 0) parts.push(`+${formatNumber(finOPS)} O/s`);
                 if (parts.length > 0) effectText = parts.join(', ');
                 tooltipText += `\nEffect per item: ${effectText}`;

            } else if (id === 'acctManager') { const currentReduction = 1.0 - (rates.currentAcctManagerCostReduction || 1.0); effectText = `${cfg.effectDesc} (Now: ${formatPercent(currentReduction, 1)})`; tooltipText += `\nReduces the L&O cost per customer acquisition attempt by 5% multiplicatively per manager. (Current total effect: ${formatPercent(currentReduction, 1)})`; }
            else if (id === 'successArchitect') { const currentBonus = rates.currentSuccessArchitectCVRBonus || 0; effectText = `${cfg.effectDesc} (Now: +${formatPercent(currentBonus, 1)})`; tooltipText += `\nIncreases the base Customer Value Rate (CVR) by 2% for every 10 buildings owned in the 'Integrated Solutions' category. (Current bonus: +${formatPercent(currentBonus, 1)})`; }
            else if (id === 'procurementOpt') { const currentReduction = 1.0 - (rates.currentProcurementOptCostReduction || 1.0); effectText = `${cfg.effectDesc} (Now: ${formatPercent(currentReduction, 1)})`; tooltipText += `\nReduces the purchase cost of all other buildings by 1% multiplicatively per optimizer. (Current total effect: ${formatPercent(currentReduction, 1)})`; }
            else if (cfg.effectDesc) { effectText = cfg.effectDesc; tooltipText += `\nEffect: ${cfg.effectDesc}`; }

            eff.textContent = effectText; btn.title = tooltipText;
        }

        // --- Update Tiered Upgrade Buttons ---
        // Iterate through categories defined in upgradesConfig
        for (const categoryId in upgradesConfig) {
            if (categoryId === 'special') continue; // Skip special upgrades section

            const categoryConfig = upgradesConfig[categoryId];
            const containerId = `upgrade-category-${categoryId}`; // Construct container ID
            const containerEl = document.getElementById(containerId); // Get container element

            // --- IMPORTANT: Check if the container exists in the HTML ---
            // This handles the removal of old categories ('acquisitionRate', 'acquisitionSuccess')
            if (!containerEl) {
                // If the container for a category in the config doesn't exist in the HTML,
                // it means the HTML has been updated to remove it. Log a warning if unexpected.
                // console.warn(`Upgrade container element not found for category ID: ${containerId}. Skipping update for this category.`);
                continue; // Skip processing this category
            }
            // --- End Check ---

            containerEl.innerHTML = ''; // Clear existing buttons
            const currentTierNum = gameState.categoryTiers[categoryId] || 1; // Get current tier
            const tierKey = `tier${currentTierNum}`;
            const upgradesInTier = categoryConfig[tierKey];
            if (!upgradesInTier) continue; // Skip if no upgrades for this tier

            // Generate buttons for the current tier
            for (const upgradeId in upgradesInTier) {
                const upgradeConfig = upgradesInTier[upgradeId];
                const upgradeState = gameState.upgrades[upgradeId] || { purchased: false };
                const buttonEl = createUpgradeButtonElement(upgradeId, upgradeConfig, categoryId);
                const cost = getUpgradeCost(upgradeId);
                let afford = false; let cTxt = '?';

                // Check affordability
                if (upgradeConfig.costMoney && upgradeConfig.costCustomers) { afford = gameState.money >= cost.money && gameState.customers >= cost.customers; cTxt = `${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`; }
                else if (upgradeConfig.costCurrency === 'both') { afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
                else if (upgradeConfig.costCurrency === 'leads') { afford = gameState.leads >= cost.leads; cTxt = `${formatNumber(cost.leads)} L`; }
                else if (upgradeConfig.costCurrency === 'opportunities') { afford = gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.opps)} O`; }
                else if (upgradeConfig.costCurrency === 'money') { afford = gameState.money >= cost.money; cTxt = `$${formatMoney(cost.money)}`; }
                else if (upgradeConfig.costCurrency === 'customers') { afford = gameState.customers >= cost.customers; cTxt = `${formatNumber(cost.customers)} Cust`; }


                const costSpan = buttonEl.querySelector('.cost'); if (costSpan) costSpan.textContent = `Cost: ${cTxt}`;
                const purchased = upgradeState.purchased === true; buttonEl.disabled = !afford || purchased || isDisabledGlobal;
                if (purchased) { buttonEl.classList.add('purchased'); const effectSpan = buttonEl.querySelector('.effect'); if (costSpan) costSpan.style.display = 'none'; if (effectSpan) effectSpan.style.display = 'none'; }
                else { buttonEl.classList.remove('purchased'); const effectSpan = buttonEl.querySelector('.effect'); if (costSpan) costSpan.style.display = 'block'; if (effectSpan) effectSpan.style.display = 'block'; }
                containerEl.appendChild(buttonEl);
            }
        }

        // --- Update Special Upgrade Buttons ---
        // (Keep existing Special Upgrade Button update logic - unchanged)
        for (const upgradeId in upgradesConfig.special) {
             if (upgradeId === 'name') continue;
             const el = domElements[`upgrade-${upgradeId}`];
             if (!el) continue; // Skip if the element wasn't found/cached (e.g., removed from HTML)

             const cfg = upgradesConfig.special[upgradeId];
             const state = gameState.upgrades[upgradeId] || { purchased: false };
             const cost = getUpgradeCost(upgradeId);
             let afford = false; let cTxt = '?';

             if (cfg.costCurrency === 'money') {
                 afford = gameState.money >= cost.money;
                 cTxt = `$${formatMoney(cost.money)}`;
             }
             else if (cfg.costMoney && cfg.costCustomers) {
                 afford = gameState.money >= cost.money && gameState.customers >= cost.customers;
                 cTxt = `${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`;
             }

             const purchased = state.purchased === true;
             el.disabled = !afford || purchased || isDisabledGlobal;

             const cstSpn = el.querySelector('.cost');
             const effSpn = el.querySelector('.effect');

             if (purchased) {
                 el.classList.add('purchased');
                 if (cstSpn) cstSpn.style.display = 'none';
                 if (effSpn) effSpn.style.display = 'none';
             } else {
                 el.classList.remove('purchased');
                 if (cstSpn) { cstSpn.style.display = 'block'; cstSpn.textContent = `Cost: ${cTxt}`; }
                 if (effSpn) effSpn.style.display = 'block';
             }
             el.title = cfg.description || cfg.name;
        }

        // (Keep toggle button updates unchanged)
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

    } catch (e) { console.error("Error in updateButtonStates:", e); }
}

// --- Modal Logic ---
// (Keep existing modal functions unchanged)
function showModal(modalElement) { if (modalElement) modalElement.classList.add('show'); }
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('show');
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
    updateStatsDisplay();
    showModal(modal);
    if (!statsUpdateIntervalId) {
        statsUpdateIntervalId = setInterval(updateStatsDisplay, STATS_UPDATE_INTERVAL_MS);
    }
}
export function hideStats() { hideModal(domElements['stats-modal']); }
export function showTutorial() { showModal(domElements['tutorial-modal']); }
export function hideTutorial() { hideModal(domElements['tutorial-modal']); }
export function showSettings() { showModal(domElements['settings-modal']); }
export function hideSettings() { hideModal(domElements['settings-modal']); }
export function triggerWin() {
    if (isGameWon) return;
    console.log("WIN CONDITION MET!");
    setGameWon(true);
    setGamePaused(true);
    stopPowerupSpawning();
    removeActivePowerupToken();
    updateButtonStates();
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();
    saveGame();
    showModal(domElements['win-modal']);
}
export function closeWinScreen() {
    hideModal(domElements['win-modal']);
    updateButtonStates();
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();
}

// --- Other UI Updates ---
// (Keep existing updateStatsDisplay, displaySaveStatus, updateActivePowerupDisplay,
// updateAcquisitionButtonVisuals, updateFlexibleWorkflowToggleButtonVisuals functions unchanged)
export function updateStatsDisplay() { const modal = domElements['stats-modal']; if (!modal || !modal.classList.contains('show')) { if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; } return; } try { if(domElements['stat-game-time']) domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now())); if(domElements['stat-lead-clicks']) domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks); if(domElements['stat-opp-clicks']) domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks); if(domElements['stat-manual-leads']) domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads); if(domElements['stat-manual-opps']) domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps); if(domElements['stat-auto-leads']) domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads); if(domElements['stat-auto-opps']) domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps); if(domElements['stat-acq-attempts']) domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts); if(domElements['stat-acq-success']) domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions); const failedAcq = Math.max(0, gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions); if(domElements['stat-acq-failed']) domElements['stat-acq-failed'].textContent = formatNumber(failedAcq); if(domElements['stat-powerups-clicked']) domElements['stat-powerups-clicked'].textContent = formatNumber(gameState.totalPowerupsClicked); if(domElements['stat-total-money']) domElements['stat-total-money'].textContent = '$' + formatMoney(gameState.totalMoneyEarned); } catch (e) { console.error("Error updating stats display:", e); hideStats(); } }
export function displaySaveStatus(msg, dur = 3000) { const el = domElements['save-status']; if (!el) return; if (saveStatusTimeoutId) clearTimeout(saveStatusTimeoutId); el.textContent = msg; el.classList.add('visible'); saveStatusTimeoutId = setTimeout(() => { el.classList.remove('visible'); saveStatusTimeoutId = null; }, dur); }
export function updateActivePowerupDisplay() { const displayEl = domElements['active-powerup-display']; if (!displayEl) return; const activeIds = Object.keys(gameState.activeBoosts); if (activeIds.length === 0) { displayEl.innerHTML = ''; displayEl.title = "No active power-ups"; return; } const firstBoostId = activeIds[0]; const boost = gameState.activeBoosts[firstBoostId]; if (!boost || !boost.endTime) { displayEl.innerHTML = ''; displayEl.title = "No active power-ups"; return; } const remainingTimeMs = boost.endTime - Date.now(); if (remainingTimeMs <= 0) { displayEl.innerHTML = ''; displayEl.title = "No active power-ups"; } else { const remainingSeconds = (remainingTimeMs / 1000).toFixed(1); displayEl.innerHTML = `${boost.name}: ${remainingSeconds}s<br><span style="font-size: 0.9em; font-weight: normal;">(${boost.description || 'Effect active'})</span>`; displayEl.title = `Active: ${boost.name} (${boost.description || 'Effect active'}). ${remainingSeconds}s remaining.`; } }
export function updateAcquisitionButtonVisuals() { const btn = domElements['toggle-acquisition-button']; if (!btn) return; const isPaused = gameState.isAcquisitionPaused; btn.textContent = isPaused ? 'Resume Acq' : 'Pause Acq'; btn.title = isPaused ? 'Resume automatic spending of Leads/Opps on customer acquisition attempts' : 'Pause automatic spending of Leads/Opps on customer acquisition attempts'; btn.classList.toggle('paused', isPaused); btn.disabled = isGameWon || isGamePaused; }
export function updateFlexibleWorkflowToggleButtonVisuals() { const btn = domElements['toggle-flexible-workflow']; if (!btn) return; const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true; const isActive = gameState.flexibleWorkflowActive; btn.disabled = !isPurchased || isGamePaused || isGameWon; btn.classList.toggle('active', isActive && isPurchased); if (isActive && isPurchased) { btn.textContent = 'Deactivate Flex'; btn.title = 'Stop balancing L/O generation focus.'; } else { btn.textContent = 'Activate Flex'; btn.title = isPurchased ? 'Balance L/O generation focus based on current amounts.' : 'Purchase the Flexible Workflow upgrade first to enable toggling.'; } }