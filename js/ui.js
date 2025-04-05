// js/ui.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon, setGamePaused, setGameWon } from './state.js';
// Terminology Change: Renamed getCurrentCustomerCost import
import { getCurrentRates, getBuildingCost, getUpgradeCost, getCurrentAcquisitionCost, findUpgradeConfigById, getCumulativeBuildingCost } from './engine.js';
import { formatNumber, formatMoney, formatPerSecond, formatRateMoney, formatCAR, formatPercent, formatTime } from './utils.js';
import { buildingsConfig, upgradesConfig, STATS_UPDATE_INTERVAL_MS } from './config.js';
import { stopPowerupSpawning, startPowerupSpawning, removeActivePowerupToken } from './powerups.js';
import { saveGame } from './saveLoad.js';

let statsUpdateIntervalId = null;
let saveStatusTimeoutId = null;

// --- Helper to create an Upgrade Button Element ---
function createUpgradeButtonElement(upgradeId, config, categoryId = null) {
    const button = document.createElement('button');
    button.id = `upgrade-${upgradeId}`;
    button.classList.add('upgrade-button');
    button.disabled = true;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = config.name || upgradeId;
    const costSpan = document.createElement('span');
    costSpan.classList.add('cost'); // Will contain cost OR requirement text
    costSpan.textContent = 'Cost: Loading...';
    const effectSpan = document.createElement('span');
    effectSpan.classList.add('effect');

    let baseTitle = config.description || config.name || ''; // Base tooltip

    if (upgradeId === 'playtimeMPSBoost') {
        // Special case for dynamic effect description
         const elapsedMs = Date.now() - (gameState.gameStartTime || Date.now());
         const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));
         const PLAYTIME_CAP_HOURS = 2.0;
         const MAX_BONUS_PERCENT = 200.0; // Max bonus is +200%
         const progressToCap = Math.min(1.0, elapsedHours / PLAYTIME_CAP_HOURS);
         const currentBonusPercent = MAX_BONUS_PERCENT * progressToCap;
         effectSpan.textContent = `+${currentBonusPercent.toFixed(0)}% MPS (Playtime)`;
         baseTitle = config.description + ` (Currently: +${currentBonusPercent.toFixed(1)}%)`;
    } else {
        effectSpan.textContent = config.description || '';
    }
    button.title = baseTitle; // Set initial title

    button.appendChild(nameSpan);
    button.appendChild(costSpan);
    button.appendChild(effectSpan);
    button.dataset.upgradeId = upgradeId;
    if (categoryId) { button.dataset.categoryId = categoryId; }
    return button;
}


// --- Display Update Functions ---
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

        // Update core stats
        domElements.leads.textContent = formatNumber(gameState.leads);
        domElements.opportunities.textContent = formatNumber(gameState.opportunities);
        domElements.customers.textContent = formatNumber(gameState.customers);
        domElements.money.textContent = '$' + formatMoney(gameState.money);
        domElements.lps.textContent = formatPerSecond(rates.leadsPerSecond, 'L');
        domElements.ops.textContent = formatPerSecond(rates.opportunitiesPerSecond, 'O');
        domElements.mps.textContent = '$' + formatMoney(rates.moneyPerSecond) + '/s';
        domElements.car.textContent = formatCAR(rates.customerAcquisitionRate);
        domElements['success-chance'].textContent = formatPercent(gameState.acquisitionSuccessChance, 1);
        domElements.cvr.textContent = formatRateMoney(rates.customerValueRate);
        // Terminology Change: Use renamed function
        domElements['cust-cost'].textContent = formatNumber(getCurrentAcquisitionCost());

        // Update click amounts
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

        // Update tooltips for click amounts
        if (domElements['lead-click-base-p']) {
            const base = gameState.leadsPerClick;
            const bonusPercentAmt = currentLPS * (gameState.leadClickPercentBonus || 0);
            let title = `Effective: ${formatNumber(effectiveLeadsPerClick)} L/Click\nBase: ${formatNumber(base)}`;
            if(bonusPercentAmt > 0) title += `\n% Bonus: +${formatPercent(gameState.leadClickPercentBonus, 1)} L/S (+${formatNumber(bonusPercentAmt)})`;
            if(baseClickMultiplier !== 1.0) title += `\nUpgrade Mult: x${baseClickMultiplier.toFixed(2)}`;
            if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
            domElements['lead-click-base-p'].title = title;
        }
        if (domElements['opp-click-base-p']) {
            const base = gameState.opportunitiesPerClick;
            const bonusPercentAmt = currentOPS * (gameState.oppClickPercentBonus || 0);
            let title = `Effective: ${formatNumber(effectiveOppsPerClick)} O/Click\nBase: ${formatNumber(base)}`;
            if(bonusPercentAmt > 0) title += `\n% Bonus: +${formatPercent(gameState.oppClickPercentBonus, 1)} O/S (+${formatNumber(bonusPercentAmt)})`;
            if(baseClickMultiplier !== 1.0) title += `\nUpgrade Mult: x${baseClickMultiplier.toFixed(2)}`;
            if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
            domElements['opp-click-base-p'].title = title;
        }

        // Update active powerup display
        updateActivePowerupDisplay();

    } catch (e) { console.error("Error in updateDisplay:", e); }
}

export function updateButtonStates() {
    const isDisabledGlobal = isGamePaused || isGameWon;
    const rates = getCurrentRates(); // Get latest rates

    try {
        // --- Update Building Buttons ---
        for (const id in buildingsConfig) {
            const btn = domElements[`buy-${id}`]; const cnt = domElements[`${id}-count`];
            const cst = domElements[`${id}-cost`]; const eff = domElements[`${id}-effect`];
            if (!btn || !cnt || !cst || !eff) {
                continue; // Skip if elements missing
            }

            const cfg = buildingsConfig[id]; const state = gameState.buildings[id] || { count: 0 };
            const cost = getBuildingCost(id); // Cost for 1
            const cost10 = getCumulativeBuildingCost(id, 10); // Cost for 10
            let afford1 = false; let afford10 = false;
            let cTxt1 = '?'; let cTxt10 = '?';

            // Check affordability for 1
            if (cfg.costCurrency === 'both') { afford1 = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; cTxt1 = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
            else if (cfg.costCurrency === 'leads') { afford1 = gameState.leads >= cost.leads; cTxt1 = `${formatNumber(cost.leads)} L`; }
            else if (cfg.costCurrency === 'opportunities') { afford1 = gameState.opportunities >= cost.opps; cTxt1 = `${formatNumber(cost.opps)} O`; }
            else if (cfg.costCurrency === 'money') { afford1 = gameState.money >= cost.money; cTxt1 = `$${formatMoney(cost.money)}`; }

             // Check affordability for 10
             if (cfg.costCurrency === 'both') { afford10 = gameState.leads >= cost10.leads && gameState.opportunities >= cost10.opps; cTxt10 = `${formatNumber(cost10.leads)} L & ${formatNumber(cost10.opps)} O`; }
             else if (cfg.costCurrency === 'leads') { afford10 = gameState.leads >= cost10.leads; cTxt10 = `${formatNumber(cost10.leads)} L`; }
             else if (cfg.costCurrency === 'opportunities') { afford10 = gameState.opportunities >= cost10.opps; cTxt10 = `${formatNumber(cost10.opps)} O`; }
             else if (cfg.costCurrency === 'money') { afford10 = gameState.money >= cost10.money; cTxt10 = `$${formatMoney(cost10.money)}`; }

            btn.disabled = !afford1 || isDisabledGlobal;
            cst.textContent = `Cost: ${cTxt1}`;
            cnt.textContent = state.count;

            let effectText = "Effect N/A";
            let perBuildingEffectText = "N/A";
            let tooltipText = cfg.flavour || cfg.name;
            tooltipText += `\n\nCost: ${cTxt1}`;
            tooltipText += `\nCost x10: ${cTxt10}${afford10 ? '' : ' (Insufficient)'}`; // Show x10 cost clearly
            tooltipText += `\n(Shift+Click to buy 10)`;

            // --- Calculate Per Building & Total Production ---
            if (cfg.baseLPS || cfg.baseOPS) {
                 // Calculation logic remains the same as before...
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

                 // Format per-building string
                 const parts = [];
                 if (finLPS > 0) parts.push(`+${formatNumber(finLPS)} L/s`);
                 if (finOPS > 0) parts.push(`+${formatNumber(finOPS)} O/s`);
                 perBuildingEffectText = parts.length > 0 ? parts.join(', ') : 'N/A';

                 // Calculate and format total production string
                 const totalLPS = finLPS * state.count;
                 const totalOPS = finOPS * state.count;
                 const totalParts = [];
                 if (totalLPS > 0) totalParts.push(`+${formatNumber(totalLPS)} L/s`);
                 if (totalOPS > 0) totalParts.push(`+${formatNumber(totalOPS)} O/s`);

                 // Combine per-building and total (if applicable)
                 effectText = perBuildingEffectText;
                 if (totalParts.length > 0 && state.count > 0) {
                     effectText += ` (Total: ${totalParts.join(', ')})`;
                 }
                 tooltipText += `\nEffect (Per): ${perBuildingEffectText}`;
                 if (totalParts.length > 0 && state.count > 0) {
                      tooltipText += `\nEffect (Total): ${totalParts.join(', ')}`;
                 }

            // Handle non-L/O producing buildings
            } else if (id === 'acctManager') {
                const currentReduction = 1.0 - rates.currentAcctManagerCostReduction;
                // Terminology Change
                effectText = `${cfg.effectDesc} (Now: ${formatPercent(currentReduction, 1)})`;
                tooltipText += `\nReduces the Acquisition Cost per attempt by 5% multiplicatively per manager. (Current total effect: ${formatPercent(currentReduction, 1)})`;
            } else if (id === 'successArchitect') {
                const currentBonus = rates.currentSuccessArchitectCVRBonus;
                effectText = `${cfg.effectDesc} (Now: +${formatPercent(currentBonus, 1)})`;
                tooltipText += `\nIncreases the base Customer Value Rate (CVR) by 10% for every 10 buildings owned in the 'Integrated Solutions' category. (Current bonus: +${formatPercent(currentBonus, 1)})`;
            } else if (id === 'procurementOpt') { // TODO: Updated Proc Opt effect display
                const currentReduction = 1.0 - rates.currentProcurementOptCostReduction;
                effectText = `${cfg.effectDesc} (Now: ${formatPercent(currentReduction, 1)})`;
                tooltipText += `\nReduces the purchase cost of all other buildings by 5% multiplicatively per optimizer. (Current total effect: ${formatPercent(currentReduction, 1)})`;
            } else if (id === 'successManager') { // TODO: Updated Success Manager display
                 const currentMultiplier = rates.currentSuccessManagerCVRMultiplier;
                 const currentBonusPercent = (currentMultiplier - 1.0) * 100;
                 effectText = `${cfg.effectDesc} (Now: x${currentMultiplier.toFixed(2)})`; // Show multiplier
                 tooltipText += `\nIncreases the base Customer Value Rate (CVR) by 5% multiplicatively per manager. (Current total effect: +${currentBonusPercent.toFixed(1)}%)`;
            } else if (cfg.effectDesc) {
                effectText = cfg.effectDesc;
                tooltipText += `\nEffect: ${cfg.effectDesc}`;
            }

            // Update the button's effect text and title (tooltip)
            eff.textContent = effectText;
            btn.title = tooltipText;
        }

        // --- Update Tiered Upgrade Buttons ---
        for (const categoryId in upgradesConfig) {
            if (categoryId === 'special') continue;
            const categoryConfig = upgradesConfig[categoryId];
            const containerId = `upgrade-category-${categoryId}`;
            const containerEl = document.getElementById(containerId);
            if (!containerEl) continue;
            containerEl.innerHTML = '';

            const currentTierNum = gameState.categoryTiers[categoryId] || 1;
            const tierKey = `tier${currentTierNum}`;
            const upgradesInTier = categoryConfig[tierKey];
            if (!upgradesInTier || Object.keys(upgradesInTier).length === 0) continue;

            for (const upgradeId in upgradesInTier) {
                const upgradeConfig = upgradesInTier[upgradeId];
                const upgradeState = gameState.upgrades[upgradeId] || { purchased: false };
                const buttonEl = createUpgradeButtonElement(upgradeId, upgradeConfig, categoryId);
                const cost = getUpgradeCost(upgradeId);
                let afford = false;
                let cTxt = '?';
                const costSpan = buttonEl.querySelector('.cost');
                costSpan.classList.remove('requirement'); // Reset class

                // Handle Customer Requirement vs. Cost
                if (cost.requiresCustomers && cost.requiresCustomers > 0) {
                    afford = gameState.customers >= cost.requiresCustomers;
                    cTxt = `Req: ${formatNumber(cost.requiresCustomers)} Cust`;
                    costSpan.classList.add('requirement'); // Add class for styling
                } else { // Handle standard costs
                    if (upgradeConfig.costCurrency === 'both') { afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
                    else if (upgradeConfig.costCurrency === 'leads') { afford = gameState.leads >= cost.leads; cTxt = `${formatNumber(cost.leads)} L`; }
                    else if (upgradeConfig.costCurrency === 'opportunities') { afford = gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.opps)} O`; }
                    else if (upgradeConfig.costCurrency === 'money') { afford = gameState.money >= cost.money; cTxt = `$${formatMoney(cost.money)}`; }
                    else if (upgradeConfig.costCurrency === 'customers') { afford = gameState.customers >= cost.customers; cTxt = `${formatNumber(cost.customers)} Cust`; }
                }

                if (costSpan) costSpan.textContent = cTxt;

                const purchased = upgradeState.purchased === true;
                buttonEl.disabled = !afford || purchased || isDisabledGlobal;

                if (purchased) {
                    buttonEl.classList.add('purchased');
                    const effectSpan = buttonEl.querySelector('.effect');
                    if (costSpan) costSpan.style.display = 'none';
                    if (effectSpan) effectSpan.style.display = 'none';
                } else {
                    buttonEl.classList.remove('purchased');
                    const effectSpan = buttonEl.querySelector('.effect');
                    if (costSpan) costSpan.style.display = 'block';
                    if (effectSpan) effectSpan.style.display = 'block';
                }
                containerEl.appendChild(buttonEl);
            }
        }

        // --- Update Special Upgrade Buttons ---
        for (const upgradeId in upgradesConfig.special) {
             if (upgradeId === 'name') continue;
             const el = domElements[`upgrade-${upgradeId}`];
             if (!el) continue;

             const cfg = upgradesConfig.special[upgradeId];
             const state = gameState.upgrades[upgradeId] || { purchased: false };
             const cost = getUpgradeCost(upgradeId);
             let afford = false; let cTxt = '?';
             const costSpan = el.querySelector('.cost');
             costSpan.classList.remove('requirement'); // Reset class

             // TODO: Handle Veteran Pipeline Operator cost display
             if (upgradeId === 'playtimeMPSBoost' && cfg.costCurrency === 'all') {
                 afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps && gameState.money >= cost.money;
                 cTxt = `Cost: ${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O & $${formatMoney(cost.money)}`;
             }
             // Handle Flexible Workflow cost display (Req/Cost logic might need review)
             else if (upgradeId === 'flexibleWorkflow' && cfg.costMoney && cfg.costCustomers) {
                 // Assuming this is still a requirement check based on HTML text
                 afford = gameState.money >= cost.money && gameState.customers >= cost.customers;
                 cTxt = `Req: ${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`; // Keep "Req:" based on HTML
                 costSpan.classList.add('requirement'); // Style as requirement
             }
             // Handle Strategic Cost Optimization (Money cost)
             else if (cfg.costCurrency === 'money') {
                 afford = gameState.money >= cost.money;
                 cTxt = `Cost: $${formatMoney(cost.money)}`;
             }
             else {
                 console.warn(`Unhandled cost type for special upgrade: ${upgradeId}`);
                 cTxt = 'Cost: ?';
             }

             const purchased = state.purchased === true;
             el.disabled = !afford || purchased || isDisabledGlobal;
             const effSpn = el.querySelector('.effect');

             if (purchased) {
                 el.classList.add('purchased');
                 if (costSpan) costSpan.style.display = 'none';
                 if (effSpn) effSpn.style.display = 'none';
             } else {
                 el.classList.remove('purchased');
                 if (costSpan) {
                     costSpan.style.display = 'block';
                     costSpan.textContent = cTxt; // Set combined cost/req text
                 }
                 if (effSpn) {
                    effSpn.style.display = 'block';
                    if (upgradeId === 'playtimeMPSBoost') { // Keep dynamic update
                         const elapsedMs = Date.now() - (gameState.gameStartTime || Date.now());
                         const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));
                         const PLAYTIME_CAP_HOURS = 2.0;
                         const MAX_BONUS_PERCENT = 200.0;
                         const progressToCap = Math.min(1.0, elapsedHours / PLAYTIME_CAP_HOURS);
                         const currentBonusPercent = MAX_BONUS_PERCENT * progressToCap;
                         effSpn.textContent = `+${currentBonusPercent.toFixed(0)}% MPS (Playtime)`;
                         el.title = cfg.description + ` (Currently: +${currentBonusPercent.toFixed(1)}%)`;
                    }
                 }
             }
        }

        // Update toggle button visuals
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

    } catch (e) { console.error("Error in updateButtonStates:", e); }
}

// --- Modal Logic ---
// Existing modal functions (showModal, hideModal, show/hide Credits/Stats/Tutorial/Settings/Win) remain the same...
function showModal(modalElement) { if (modalElement) modalElement.classList.add('show'); }
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('show');
        if (modalElement === domElements['stats-modal'] && statsUpdateIntervalId) {
            clearInterval(statsUpdateIntervalId);
            statsUpdateIntervalId = null;
        }
        // TODO: Also hide first-time modal if clicking outside or close button
         if (modalElement === domElements['first-time-modal']) {
             // Maybe set the flag here too? Or only on OK button?
             // localStorage.setItem(FIRST_TIME_POPUP_KEY, 'shown');
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
    // Game remains paused and won
    updateButtonStates();
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();
}

// TODO: Add functions for first-time modal
export function showFirstTimeModal() {
    const modal = domElements['first-time-modal'];
    showModal(modal);
}
export function hideFirstTimeModal() {
    const modal = domElements['first-time-modal'];
    hideModal(modal);
    // Set the flag when the modal is dismissed (by OK or close)
    localStorage.setItem(config.FIRST_TIME_POPUP_KEY, 'shown');
    console.log("First time popup flag set.");
}


// --- Other UI Updates ---
export function updateStatsDisplay() { const modal = domElements['stats-modal']; if (!modal || !modal.classList.contains('show')) { if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; } return; } try { if(domElements['stat-game-time']) domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now())); if(domElements['stat-lead-clicks']) domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks); if(domElements['stat-opp-clicks']) domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks); if(domElements['stat-manual-leads']) domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads); if(domElements['stat-manual-opps']) domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps); if(domElements['stat-auto-leads']) domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads); if(domElements['stat-auto-opps']) domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps); if(domElements['stat-acq-attempts']) domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts); if(domElements['stat-acq-success']) domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions); const failedAcq = Math.max(0, gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions); if(domElements['stat-acq-failed']) domElements['stat-acq-failed'].textContent = formatNumber(failedAcq); if(domElements['stat-powerups-clicked']) domElements['stat-powerups-clicked'].textContent = formatNumber(gameState.totalPowerupsClicked); if(domElements['stat-total-money']) domElements['stat-total-money'].textContent = '$' + formatMoney(gameState.totalMoneyEarned); } catch (e) { console.error("Error updating stats display:", e); hideStats(); } }
export function displaySaveStatus(msg, dur = 3000) { const el = domElements['save-status']; if (!el) return; if (saveStatusTimeoutId) clearTimeout(saveStatusTimeoutId); el.textContent = msg; el.classList.add('visible'); saveStatusTimeoutId = setTimeout(() => { el.classList.remove('visible'); saveStatusTimeoutId = null; }, dur); }
export function updateActivePowerupDisplay() { const displayEl = domElements['active-powerup-display']; if (!displayEl) return; const activeIds = Object.keys(gameState.activeBoosts); if (activeIds.length === 0) { displayEl.innerHTML = ''; displayEl.title = "No active power-ups"; return; } const firstBoostId = activeIds[0]; const boost = gameState.activeBoosts[firstBoostId]; if (!boost || !boost.endTime) { displayEl.innerHTML = ''; displayEl.title = "No active power-ups"; return; } const remainingTimeMs = boost.endTime - Date.now(); if (remainingTimeMs <= 0) { displayEl.innerHTML = ''; displayEl.title = "No active power-ups"; } else { const remainingSeconds = (remainingTimeMs / 1000).toFixed(1); displayEl.innerHTML = `${boost.name}: ${remainingSeconds}s<br><span style="font-size: 0.9em; font-weight: normal; color: #555;">(${boost.description || 'Effect active'})</span>`; displayEl.title = `Active: ${boost.name} (${boost.description || 'Effect active'}). ${remainingSeconds}s remaining.`; } }
export function updateAcquisitionButtonVisuals() { const btn = domElements['toggle-acquisition-button']; if (!btn) return; const isPausedByUser = gameState.isAcquisitionPaused; const isDisabled = isGameWon || isGamePaused; btn.textContent = isPausedByUser ? 'Resume Acq' : 'Pause Acq'; btn.title = isPausedByUser ? 'Resume automatic spending of Leads/Opps on customer acquisition attempts' : 'Pause automatic spending of Leads/Opps on customer acquisition attempts'; btn.classList.toggle('paused', isPausedByUser); btn.disabled = isDisabled; }
export function updateFlexibleWorkflowToggleButtonVisuals() { const btn = domElements['toggle-flexible-workflow']; if (!btn) return; const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true; const isActive = gameState.flexibleWorkflowActive; const isDisabled = !isPurchased || isGamePaused || isGameWon; btn.disabled = isDisabled; btn.classList.toggle('active', isActive && isPurchased); if (isActive && isPurchased) { btn.textContent = 'Deactivate Flex'; btn.title = 'Stop balancing L/O generation focus.'; } else { btn.textContent = 'Activate Flex'; btn.title = isPurchased ? 'Balance L/O generation focus based on current amounts.' : 'Purchase the Flexible Workflow upgrade first to enable toggling.'; } }

// Need to import config for FIRST_TIME_POPUP_KEY
import * as config from './config.js';