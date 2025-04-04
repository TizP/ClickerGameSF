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
function createUpgradeButtonElement(upgradeId, config, categoryId = null) {
    const button = document.createElement('button');
    button.id = `upgrade-${upgradeId}`;
    button.classList.add('upgrade-button');
    button.disabled = true; // Start disabled, enable later based on cost/state

    // Create spans for content
    const nameSpan = document.createElement('span');
    nameSpan.textContent = config.name || upgradeId; // Use name from config or fallback to ID

    const costSpan = document.createElement('span');
    costSpan.classList.add('cost');
    costSpan.textContent = 'Cost: Loading...'; // Placeholder text

    const effectSpan = document.createElement('span');
    effectSpan.classList.add('effect');
    // Provide a default or config-based effect description
    // Special handling for playtime boost description might be needed if dynamic
    if (upgradeId === 'playtimeMPSBoost') {
        effectSpan.textContent = "+MPS based on Playtime"; // Concise effect for button face
    } else {
        effectSpan.textContent = config.description || ''; // Use description from config
    }


    // Set tooltip using the full description from config
    button.title = config.description || config.name || '';

    // Append spans to button
    button.appendChild(nameSpan);
    button.appendChild(costSpan);
    button.appendChild(effectSpan);

    // Store IDs for easier access in event listeners/updates
    button.dataset.upgradeId = upgradeId;
    if (categoryId) { button.dataset.categoryId = categoryId; }

    return button;
}


// --- Display Update Functions ---
// (Keep existing updateDisplay function - unchanged)
export function updateDisplay() {
    try {
        const rates = getCurrentRates();
        // Check if essential DOM elements are cached
        const coreElements = [
            domElements.leads, domElements.opportunities, domElements.customers, domElements.money,
            domElements.lps, domElements.ops, domElements.mps,
            domElements['leads-per-click'], domElements['opps-per-click'],
            domElements.car, domElements['success-chance'], domElements.cvr, domElements['cust-cost']
        ];
        if (coreElements.some(el => !el)) {
            console.error("Cannot update display: Core DOM elements missing.");
            // Consider stopping the interval or showing an error message to the user
            return;
        }

        // Update core resource displays
        domElements.leads.textContent = formatNumber(gameState.leads);
        domElements.opportunities.textContent = formatNumber(gameState.opportunities);
        domElements.customers.textContent = formatNumber(gameState.customers);
        domElements.money.textContent = '$' + formatMoney(gameState.money);

        // Update rates displays
        domElements.lps.textContent = formatNumber(rates.leadsPerSecond);
        domElements.ops.textContent = formatNumber(rates.opportunitiesPerSecond);
        domElements.mps.textContent = '$' + formatMoney(rates.moneyPerSecond);
        domElements.car.textContent = formatCAR(rates.customerAcquisitionRate);
        domElements['success-chance'].textContent = (gameState.acquisitionSuccessChance * 100).toFixed(1);
        domElements.cvr.textContent = formatRateMoney(rates.customerValueRate);
        domElements['cust-cost'].textContent = formatNumber(getCurrentCustomerCost());

        // Update clicks per second (including power-ups and bonuses)
        const clickBoost = gameState.activeBoosts?.['clickBoost'];
        const baseClickMultiplier = gameState.globalClickMultiplier || 1.0;
        const powerupClickMultiplier = clickBoost ? (1.0 + clickBoost.magnitude) : 1.0;
        const totalClickMultiplier = baseClickMultiplier * powerupClickMultiplier;
        const currentLPS = rates.leadsPerSecond; // Get current rate for bonus calculation
        const currentOPS = rates.opportunitiesPerSecond;

        // Calculate effective click values
        let effectiveLeadsPerClick = (gameState.leadsPerClick + (currentLPS * (gameState.leadClickPercentBonus || 0))) * totalClickMultiplier;
        let effectiveOppsPerClick = (gameState.opportunitiesPerClick + (currentOPS * (gameState.oppClickPercentBonus || 0))) * totalClickMultiplier;

        // Ensure results are valid numbers
        effectiveLeadsPerClick = (!isNaN(effectiveLeadsPerClick) && isFinite(effectiveLeadsPerClick)) ? effectiveLeadsPerClick : 0;
        effectiveOppsPerClick = (!isNaN(effectiveOppsPerClick) && isFinite(effectiveOppsPerClick)) ? effectiveOppsPerClick : 0;

        // Update display and tooltips
        domElements['leads-per-click'].textContent = formatNumber(effectiveLeadsPerClick);
        domElements['opps-per-click'].textContent = formatNumber(effectiveOppsPerClick);

        // Update tooltips for click values
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

        // Update active powerup display (function defined below)
        updateActivePowerupDisplay();

    } catch (e) {
        console.error("Error in updateDisplay:", e);
        // Potentially stop the interval if errors persist
        // clearInterval(displayUpdateIntervalId); displayUpdateIntervalId = null;
    }
}


export function updateButtonStates() {
    // Determine global disabled state (game paused or won)
    const isDisabledGlobal = isGamePaused || isGameWon;
    const rates = getCurrentRates(); // Get current rates for effect display

    try {
        // --- Update Building Buttons ---
        for (const id in buildingsConfig) {
            // Get cached DOM elements for this building
            const btn = domElements[`buy-${id}`];
            const cnt = domElements[`${id}-count`];
            const cst = domElements[`${id}-cost`];
            const eff = domElements[`${id}-effect`];

            // Skip if any element is missing for this building
            if (!btn || !cnt || !cst || !eff) continue;

            const cfg = buildingsConfig[id]; // Building configuration
            const state = gameState.buildings[id] || { count: 0 }; // Building state (count)
            const cost = getBuildingCost(id); // Get current calculated cost
            let afford = false;
            let cTxt = '?'; // Cost text placeholder

            // Check affordability based on cost currency
            if (cfg.costCurrency === 'both') { afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
            else if (cfg.costCurrency === 'leads') { afford = gameState.leads >= cost.leads; cTxt = `${formatNumber(cost.leads)} L`; }
            else if (cfg.costCurrency === 'opportunities') { afford = gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.opps)} O`; }
            else if (cfg.costCurrency === 'money') { afford = gameState.money >= cost.money; cTxt = `$${formatMoney(cost.money)}`; }

            // Set button disabled state (can't afford OR game inactive)
            btn.disabled = !afford || isDisabledGlobal;
            // Update cost text and count display
            cst.textContent = `Cost: ${cTxt}`;
            cnt.textContent = state.count;

            // --- Calculate and Display Building Effect ---
            let effectText = "Effect N/A"; // Default effect text
            let tooltipText = cfg.flavour || cfg.name; // Start tooltip with flavour text or name

            if (cfg.baseLPS || cfg.baseOPS) { // Handle L/S or O/S generating buildings
                 let bLPS = cfg.baseLPS || 0, bOPS = cfg.baseOPS || 0; let fLPS = 0, fOPS = 0, pLPS = 1.0, pOPS = 1.0, mLPS = 1.0, mOPS = 1.0;
                 // Get relevant global multipliers from gameState
                 const gE = gameState.buildingEfficiencyMultiplier || 1.0; const cM = gameState.custGlobalMultiplier || 1.0;
                 const leadTM = gameState.leadTeamMultiplier || 1.0; const oppTM = gameState.oppTeamMultiplier || 1.0; const intM = gameState.integratedMultiplier || 1.0;
                 // Check if synergy upgrades are purchased
                 const isSdrSyn = gameState.upgrades['sdrSynergyBoost']?.purchased; const isBdrSyn = gameState.upgrades['bdrSynergyBoost']?.purchased;
                 const sdrC = gameState.buildings['sdr']?.count || 0; const bdrC = gameState.buildings['bdr']?.count || 0;
                 // Calculate synergy bonus percentages
                 const leadSynBonus = isSdrSyn ? Math.floor(sdrC / 10) * 0.01 : 0; const oppSynBonus = isBdrSyn ? Math.floor(bdrC / 10) * 0.01 : 0;

                 // Apply building-specific upgrade bonuses
                 for (const upId in gameState.upgrades) { if(!gameState.upgrades[upId]?.purchased) continue; let uCfgFound = findUpgradeConfigById(upId); if (uCfgFound && uCfgFound.config.targetBuilding === id) { let uCfg = uCfgFound.config; if(uCfg.flatBonusLPS) fLPS += uCfg.flatBonusLPS; if(uCfg.flatBonusOPS) fOPS += uCfg.flatBonusOPS; if(uCfg.percentBonusLPS) pLPS += uCfg.percentBonusLPS; if(uCfg.percentBonusOPS) pOPS += uCfg.percentBonusOPS; if(uCfg.multiplierBonusLPS) mLPS *= uCfg.multiplierBonusLPS; if(uCfg.multiplierBonusOPS) mOPS *= uCfg.multiplierBonusOPS; }}

                 // Calculate final output per building after upgrades
                 let finLPS = (bLPS + fLPS) * pLPS * mLPS; let finOPS = (bOPS + fOPS) * pOPS * mOPS;
                 // Apply Synergy bonuses (if applicable to this building type)
                 if (leadSynBonus > 0 && id !== 'sdr' && ['webform', 'pardot', 'nurture', 'marketingcloud'].includes(id)) finLPS *= (1 + leadSynBonus);
                 if (oppSynBonus > 0 && id !== 'bdr' && ['qualbot', 'solutionengineer', 'demospec', 'proposaldesk'].includes(id)) finOPS *= (1 + oppSynBonus);
                 // Apply global multipliers
                 finLPS *= gE * cM; finOPS *= gE * cM;
                 // Apply team/integrated multipliers based on building type
                 if (['sdr', 'webform', 'pardot', 'nurture', 'marketingcloud'].includes(id)) finLPS *= leadTM;
                 if (['bdr', 'qualbot', 'solutionengineer', 'demospec', 'proposaldesk'].includes(id)) finOPS *= oppTM;
                 if (['integration', 'platform', 'ecosystem', 'cloudsuite', 'hyperscaler', 'aidata'].includes(id)){ finLPS *= intM; finOPS *= intM; }

                 // Format the effect text
                 const parts = [];
                 if (finLPS > 0) parts.push(`+${formatNumber(finLPS)} L/s`);
                 if (finOPS > 0) parts.push(`+${formatNumber(finOPS)} O/s`);
                 if (parts.length > 0) effectText = parts.join(', ');
                 tooltipText += `\nEffect per item: ${effectText}`; // Add effect to tooltip

            } else if (id === 'acctManager') { // Handle Account Manager effect display
                const currentReduction = 1.0 - (rates.currentAcctManagerCostReduction || 1.0); // Calculate % reduction
                effectText = `${cfg.effectDesc} (Now: ${formatPercent(currentReduction, 1)})`; // Show base effect and current total
                tooltipText += `\nReduces the L&O cost per customer acquisition attempt by 5% multiplicatively per manager. (Current total effect: ${formatPercent(currentReduction, 1)})`;
            } else if (id === 'successArchitect') { // Handle Success Architect effect display
                const currentBonus = rates.currentSuccessArchitectCVRBonus || 0; // Get calculated bonus %
                effectText = `${cfg.effectDesc} (Now: +${formatPercent(currentBonus, 1)})`;
                tooltipText += `\nIncreases the base Customer Value Rate (CVR) by 2% for every 10 buildings owned in the 'Integrated Solutions' category. (Current bonus: +${formatPercent(currentBonus, 1)})`;
            } else if (id === 'procurementOpt') { // Handle Procurement Optimizer effect display
                const currentReduction = 1.0 - (rates.currentProcurementOptCostReduction || 1.0); // Calculate % reduction
                effectText = `${cfg.effectDesc} (Now: ${formatPercent(currentReduction, 1)})`;
                tooltipText += `\nReduces the purchase cost of all other buildings by 1% multiplicatively per optimizer. (Current total effect: ${formatPercent(currentReduction, 1)})`;
            } else if (cfg.effectDesc) { // Handle other buildings with simple effect descriptions
                effectText = cfg.effectDesc;
                tooltipText += `\nEffect: ${cfg.effectDesc}`;
            }

            // Update the effect span text and button tooltip
            eff.textContent = effectText;
            btn.title = tooltipText;
        }

        // --- Update Tiered Upgrade Buttons ---
        for (const categoryId in upgradesConfig) {
            if (categoryId === 'special') continue; // Skip special upgrades, handled below
            const categoryConfig = upgradesConfig[categoryId];
            const containerId = `upgrade-category-${categoryId}`; // ID of the container div
            const containerEl = document.getElementById(containerId);
            if (!containerEl) continue; // Skip if container not found

            containerEl.innerHTML = ''; // Clear existing buttons in the category
            const currentTierNum = gameState.categoryTiers[categoryId] || 1; // Get current tier for category
            const tierKey = `tier${currentTierNum}`; // Key for accessing tier in config (e.g., 'tier1')
            const upgradesInTier = categoryConfig[tierKey]; // Get upgrades for the current tier
            if (!upgradesInTier) continue; // Skip if no upgrades defined for this tier

            // Create and add buttons for each upgrade in the current tier
            for (const upgradeId in upgradesInTier) {
                const upgradeConfig = upgradesInTier[upgradeId];
                const upgradeState = gameState.upgrades[upgradeId] || { purchased: false }; // Get purchase state
                // Create the button element using the helper function
                const buttonEl = createUpgradeButtonElement(upgradeId, upgradeConfig, categoryId);
                const cost = getUpgradeCost(upgradeId); // Get current cost
                let afford = false; let cTxt = '?'; // Affordability flag and cost text

                // Check affordability based on currency type
                if (upgradeConfig.costCurrency === 'both') { afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
                else if (upgradeConfig.costCurrency === 'leads') { afford = gameState.leads >= cost.leads; cTxt = `${formatNumber(cost.leads)} L`; }
                else if (upgradeConfig.costCurrency === 'opportunities') { afford = gameState.opportunities >= cost.opps; cTxt = `${formatNumber(cost.opps)} O`; }
                else if (upgradeConfig.costCurrency === 'money') { afford = gameState.money >= cost.money; cTxt = `$${formatMoney(cost.money)}`; }
                else if (upgradeConfig.costCurrency === 'customers') { afford = gameState.customers >= cost.customers; cTxt = `${formatNumber(cost.customers)} Cust`; }
                // Handle multi-currency cost (e.g., for Flex Workflow, Playtime Boost)
                else if (upgradeConfig.costMoney && upgradeConfig.costCustomers) { afford = gameState.money >= cost.money && gameState.customers >= cost.customers; cTxt = `${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`; }

                // Update cost text and button disabled state
                const costSpan = buttonEl.querySelector('.cost');
                if (costSpan) costSpan.textContent = `Cost: ${cTxt}`;
                const purchased = upgradeState.purchased === true;
                buttonEl.disabled = !afford || purchased || isDisabledGlobal; // Disable if can't afford, already purchased, or game inactive

                // Apply 'purchased' style and hide cost/effect if bought
                if (purchased) {
                    buttonEl.classList.add('purchased');
                    const effectSpan = buttonEl.querySelector('.effect');
                    if (costSpan) costSpan.style.display = 'none';
                    if (effectSpan) effectSpan.style.display = 'none';
                } else { // Ensure styles are correct if not purchased
                    buttonEl.classList.remove('purchased');
                    const effectSpan = buttonEl.querySelector('.effect');
                    if (costSpan) costSpan.style.display = 'block';
                    if (effectSpan) effectSpan.style.display = 'block';
                }
                containerEl.appendChild(buttonEl); // Add the configured button to the DOM
            }
        }

        // --- Update Special Upgrade Buttons ---
        for (const upgradeId in upgradesConfig.special) {
             if (upgradeId === 'name') continue; // Skip the category name property
             const el = domElements[`upgrade-${upgradeId}`]; // Get cached element
             if (!el) continue; // Skip if element not found

             const cfg = upgradesConfig.special[upgradeId];
             const state = gameState.upgrades[upgradeId] || { purchased: false }; // Get purchase state
             const cost = getUpgradeCost(upgradeId); // Get cost
             let afford = false; let cTxt = '?'; // Affordability flag and cost text

             // Check affordability based on special upgrade cost types
             if (cfg.costCurrency === 'money') { // Handles costReductStrategic
                 afford = gameState.money >= cost.money;
                 cTxt = `$${formatMoney(cost.money)}`;
             }
             else if (cfg.costMoney && cfg.costCustomers) { // Handles Flex Workflow & Playtime Boost
                 afford = gameState.money >= cost.money && gameState.customers >= cost.customers;
                 cTxt = `${formatNumber(cost.customers)} Cust & $${formatMoney(cost.money)}`;
             }

             const purchased = state.purchased === true;
             el.disabled = !afford || purchased || isDisabledGlobal; // Set disabled state

             const cstSpn = el.querySelector('.cost'); // Get cost span inside button
             const effSpn = el.querySelector('.effect'); // Get effect span inside button

             // Apply purchased styling or update cost/effect text
             if (purchased) {
                 el.classList.add('purchased');
                 if (cstSpn) cstSpn.style.display = 'none';
                 if (effSpn) effSpn.style.display = 'none';
             } else {
                 el.classList.remove('purchased');
                 if (cstSpn) { cstSpn.style.display = 'block'; cstSpn.textContent = `Cost: ${cTxt}`; } // Update cost text
                 if (effSpn) effSpn.style.display = 'block'; // Ensure effect span is visible
             }
             // Ensure tooltip is up-to-date (uses description from config)
             el.title = cfg.description || cfg.name;
        }

        // Update visuals for toggle buttons (Acquisition Pause, Flexible Workflow)
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

    } catch (e) {
        console.error("Error in updateButtonStates:", e);
        // Potentially stop the interval if errors persist
        // clearInterval(buttonUpdateIntervalId); buttonUpdateIntervalId = null;
    }
}

// --- Modal Logic ---
// Helper to show/hide modals
function showModal(modalElement) { if (modalElement) modalElement.classList.add('show'); }
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('show');
        // Stop stats update interval when stats modal is closed
        if (modalElement === domElements['stats-modal'] && statsUpdateIntervalId) {
            clearInterval(statsUpdateIntervalId);
            statsUpdateIntervalId = null;
        }
    }
}
// Exported functions to show/hide specific modals
export function showCredits() { showModal(domElements['credits-modal']); }
export function hideCredits() { hideModal(domElements['credits-modal']); }
export function showStats() {
    const modal = domElements['stats-modal'];
    if (!modal) return;
    updateStatsDisplay(); // Update stats content immediately on show
    showModal(modal);
    // Start interval only if not already running
    if (!statsUpdateIntervalId) {
        statsUpdateIntervalId = setInterval(updateStatsDisplay, STATS_UPDATE_INTERVAL_MS);
    }
}
export function hideStats() { hideModal(domElements['stats-modal']); } // Interval cleared in hideModal
export function showTutorial() { showModal(domElements['tutorial-modal']); }
export function hideTutorial() { hideModal(domElements['tutorial-modal']); }
export function showSettings() { showModal(domElements['settings-modal']); }
export function hideSettings() { hideModal(domElements['settings-modal']); }

// --- Win Condition Trigger ---
export function triggerWin() {
    if (isGameWon) return; // Prevent multiple triggers
    console.log("WIN CONDITION MET!");
    setGameWon(true); // Set global flag
    setGamePaused(true); // Pause game logic
    stopPowerupSpawning(); // Stop new powerups
    removeActivePowerupToken(); // Remove any currently falling powerup
    // Update UI to reflect paused/won state
    updateButtonStates();
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();
    saveGame(); // Autosave on win
    showModal(domElements['win-modal']); // Show the win modal
}
// Function to close win screen (called by button click)
export function closeWinScreen() {
    hideModal(domElements['win-modal']);
    // Buttons/toggles remain disabled due to isGameWon flag, but update visuals just in case
    updateButtonStates();
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();
}

// --- Other UI Updates ---

// Updates the content of the Statistics Modal
export function updateStatsDisplay() {
    const modal = domElements['stats-modal'];
    // Stop if modal doesn't exist or isn't currently shown
    if (!modal || !modal.classList.contains('show')) {
        if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; }
        return;
    }
    try {
        // Update each statistic element if it exists
        if(domElements['stat-game-time']) domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now()));
        if(domElements['stat-lead-clicks']) domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks);
        if(domElements['stat-opp-clicks']) domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks);
        if(domElements['stat-manual-leads']) domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads);
        if(domElements['stat-manual-opps']) domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps);
        if(domElements['stat-auto-leads']) domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads);
        if(domElements['stat-auto-opps']) domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps);
        if(domElements['stat-acq-attempts']) domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts);
        if(domElements['stat-acq-success']) domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions);
        // Calculate failed attempts
        const failedAcq = Math.max(0, gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions);
        if(domElements['stat-acq-failed']) domElements['stat-acq-failed'].textContent = formatNumber(failedAcq);
        if(domElements['stat-powerups-clicked']) domElements['stat-powerups-clicked'].textContent = formatNumber(gameState.totalPowerupsClicked);
        if(domElements['stat-total-money']) domElements['stat-total-money'].textContent = '$' + formatMoney(gameState.totalMoneyEarned);
    } catch (e) {
        console.error("Error updating stats display:", e);
        hideStats(); // Close modal on error
    }
}

// Displays a temporary message in the save status area
export function displaySaveStatus(msg, dur = 3000) {
    const el = domElements['save-status'];
    if (!el) return;
    // Clear any existing timeout to prevent overlapping messages
    if (saveStatusTimeoutId) clearTimeout(saveStatusTimeoutId);
    el.textContent = msg; // Set message text
    el.classList.add('visible'); // Make it visible
    // Set timeout to hide the message after duration
    saveStatusTimeoutId = setTimeout(() => {
        el.classList.remove('visible');
        saveStatusTimeoutId = null; // Clear timeout ID
    }, dur);
}

// Updates the display for the currently active powerup
export function updateActivePowerupDisplay() {
    const displayEl = domElements['active-powerup-display'];
    if (!displayEl) return;

    const activeIds = Object.keys(gameState.activeBoosts);
    if (activeIds.length === 0) { // No active boosts
        displayEl.innerHTML = '';
        displayEl.title = "No active power-ups";
        return;
    }

    // Display info for the *first* active boost found (simplification)
    const firstBoostId = activeIds[0];
    const boost = gameState.activeBoosts[firstBoostId];
    if (!boost || !boost.endTime) { // Invalid boost data
        displayEl.innerHTML = '';
        displayEl.title = "No active power-ups";
        return;
    }

    const remainingTimeMs = boost.endTime - Date.now();
    if (remainingTimeMs <= 0) { // Boost expired
        displayEl.innerHTML = '';
        displayEl.title = "No active power-ups";
        // Note: Actual removal is handled by the timeout in powerups.js
    } else { // Boost active, display info
        const remainingSeconds = (remainingTimeMs / 1000).toFixed(1);
        // Display name, time left, and description in separate lines/styles
        displayEl.innerHTML = `${boost.name}: ${remainingSeconds}s<br><span style="font-size: 0.9em; font-weight: normal;">(${boost.description || 'Effect active'})</span>`;
        // Update tooltip
        displayEl.title = `Active: ${boost.name} (${boost.description || 'Effect active'}). ${remainingSeconds}s remaining.`;
    }
    // If multiple boosts are needed, this logic would need expansion
}

// Updates the text and style of the Acquisition Pause button
export function updateAcquisitionButtonVisuals() {
    const btn = domElements['toggle-acquisition-button'];
    if (!btn) return;
    const isPaused = gameState.isAcquisitionPaused;
    // Update button text based on state
    btn.textContent = isPaused ? 'Resume Acq' : 'Pause Acq';
    // Update tooltip based on state
    btn.title = isPaused ? 'Resume automatic spending of Leads/Opps on customer acquisition attempts' : 'Pause automatic spending of Leads/Opps on customer acquisition attempts';
    // Add/remove 'paused' class for styling
    btn.classList.toggle('paused', isPaused);
    // Disable button if game is won or globally paused
    btn.disabled = isGameWon || isGamePaused;
}

// Updates the text and style of the Flexible Workflow toggle button
export function updateFlexibleWorkflowToggleButtonVisuals() {
    const btn = domElements['toggle-flexible-workflow'];
    if (!btn) return;
    // Check if the prerequisite upgrade is purchased
    const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true;
    const isActive = gameState.flexibleWorkflowActive; // Check current active state

    // Disable button if prerequisite not met OR game inactive
    btn.disabled = !isPurchased || isGamePaused || isGameWon;
    // Add/remove 'active' class for styling when active AND purchased
    btn.classList.toggle('active', isActive && isPurchased);

    // Update button text and tooltip based on state
    if (isActive && isPurchased) {
        btn.textContent = 'Deactivate Flex';
        btn.title = 'Stop balancing L/O generation focus.';
    } else {
        btn.textContent = 'Activate Flex';
        // Tooltip depends on whether it's purchased or not
        btn.title = isPurchased ? 'Balance L/O generation focus based on current amounts.' : 'Purchase the Flexible Workflow upgrade first to enable toggling.';
    }
}