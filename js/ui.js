// js/ui.js
"use strict";
import { domElements } from './dom.js';
import { gameState, isGamePaused, isGameWon, setGamePaused, setGameWon } from './state.js';
import { getCurrentRates, getBuildingCost, getUpgradeCost, getCurrentAcquisitionCost, findUpgradeConfigById, getCumulativeBuildingCost } from './engine.js';
import { formatNumber, formatMoney, formatPerSecond, formatRateMoney, formatCAR, formatPercent, formatTime } from './utils.js';
import { buildingsConfig, upgradesConfig, STATS_UPDATE_INTERVAL_MS, FIRST_TIME_POPUP_KEY, POWERUP_SPAWN_INTERVAL_MS, POWERUP_CHANCE_PER_INTERVAL } from './config.js'; // Import FIRST_TIME_POPUP_KEY
import { stopPowerupSpawning, startPowerupSpawning, removeActivePowerupToken } from './powerups.js';
import { saveGame } from './saveLoad.js';
import { getString } from './ui_strings.js'; // Import the string helper

let statsUpdateIntervalId = null;
let saveStatusTimeoutId = null;

// --- Helper to create an Upgrade Button Element ---
// Now fetches name/description from uiStrings
function createUpgradeButtonElement(upgradeId, config, categoryId = null) {
    const button = document.createElement('button');
    button.id = `upgrade-${upgradeId}`;
    button.classList.add('upgrade-button');
    button.disabled = true;

    // Fetch name from uiStrings
    const nameSpan = document.createElement('span');
    nameSpan.textContent = getString(`upgrades.${upgradeId}.name`, {fallback: upgradeId}); // Use ID as fallback
    // Store data attributes for easier updates if needed, though name is static
    nameSpan.dataset.upgradeId = upgradeId;
    nameSpan.dataset.type = 'name';

    const costSpan = document.createElement('span');
    costSpan.classList.add('cost');
    costSpan.textContent = `${getString('buttons.costPrefix')} ${getString('buttons.loading')}`;

    const effectSpan = document.createElement('span');
    effectSpan.classList.add('effect');
    // Store data attributes for easier updates if needed, though description is static
    effectSpan.dataset.upgradeId = upgradeId;
    effectSpan.dataset.type = 'description';

    let baseTitle = getString(`upgrades.${upgradeId}.title`); // Fetch tooltip/title if defined
    let baseDesc = getString(`upgrades.${upgradeId}.description`); // Fetch description

    // Handle dynamic descriptions/titles separately in updateButtonStates
    if (upgradeId === 'playtimeMPSBoost') {
        // Set initial placeholder text, updateButtonStates will handle dynamic part
        effectSpan.textContent = getString('upgrades.playtimeMPSBoost.descriptionDynamic', { PERCENT: '0' });
        baseTitle = getString('upgrades.playtimeMPSBoost.titleBase') || baseDesc || ''; // Use specific title base if available
        // Title will be updated dynamically too
    } else {
        effectSpan.textContent = baseDesc || ''; // Use fetched description
        if (!baseTitle || baseTitle === `upgrades.${upgradeId}.title`) { // If specific title key missing, use description
            baseTitle = baseDesc;
        }
    }
    button.title = baseTitle || ''; // Set initial title

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

        // Update core stats (numeric values, labels/titles handled by HTML/applyUiStrings)
        domElements.leads.textContent = formatNumber(gameState.leads);
        domElements.opportunities.textContent = formatNumber(gameState.opportunities);
        domElements.customers.textContent = formatNumber(gameState.customers);
        domElements.money.textContent = getString('misc.currency.money') + formatMoney(gameState.money);
        domElements.lps.textContent = formatPerSecond(rates.leadsPerSecond, getString('misc.currency.lead'));
        domElements.ops.textContent = formatPerSecond(rates.opportunitiesPerSecond, getString('misc.currency.opp'));
        domElements.mps.textContent = getString('misc.currency.money') + formatMoney(rates.moneyPerSecond) + getString('misc.perSecondSuffix');
        domElements.car.textContent = formatCAR(rates.customerAcquisitionRate);
        domElements['success-chance'].textContent = formatPercent(gameState.acquisitionSuccessChance, 1);
        domElements.cvr.textContent = formatRateMoney(rates.customerValueRate);
        domElements['cust-cost'].textContent = formatNumber(getCurrentAcquisitionCost());

        // Update click amounts (numeric)
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

        // Update tooltips for click amounts dynamically (combining base string + dynamic parts)
        const leadClickTitleBase = getString('centerArea.leadsClickTitleBase');
        if (domElements['lead-click-base-p']) {
            const base = gameState.leadsPerClick;
            const bonusPercentAmt = currentLPS * (gameState.leadClickPercentBonus || 0);
            let title = `${leadClickTitleBase}\n${getString('buttons.effectPrefix')} ${formatNumber(effectiveLeadsPerClick)} L/Click\nBase: ${formatNumber(base)}`;
            if(bonusPercentAmt > 0) title += `\n% Bonus: +${formatPercent(gameState.leadClickPercentBonus, 1)} L/S (+${formatNumber(bonusPercentAmt)})`;
            if(baseClickMultiplier !== 1.0) title += `\nUpgrade Mult: x${baseClickMultiplier.toFixed(2)}`;
            if (clickBoost) { title += `\nPower-up: x${(1.0 + clickBoost.magnitude).toFixed(2)}`; }
            domElements['lead-click-base-p'].title = title;
        }
         const oppClickTitleBase = getString('centerArea.oppsClickTitleBase');
        if (domElements['opp-click-base-p']) {
            const base = gameState.opportunitiesPerClick;
            const bonusPercentAmt = currentOPS * (gameState.oppClickPercentBonus || 0);
            let title = `${oppClickTitleBase}\n${getString('buttons.effectPrefix')} ${formatNumber(effectiveOppsPerClick)} O/Click\nBase: ${formatNumber(base)}`;
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
            const btn = domElements[`buy-${id}`];
            const cnt = domElements[`${id}-count`];
            const cstEl = domElements[`${id}-cost`]; // Renamed to avoid conflict
            const effEl = domElements[`${id}-effect`]; // Renamed to avoid conflict

            // Check if elements related to this building exist
            if (!btn || !cnt || !cstEl || !effEl) {
                // console.warn(`Missing elements for building button: ${id}`); // Can be noisy
                continue;
            }

            const cfg = buildingsConfig[id];
            const state = gameState.buildings[id] || { count: 0 };
            const cost = getBuildingCost(id); // Cost for 1
            const cost10 = getCumulativeBuildingCost(id, 10); // Cost for 10
            let afford1 = false; let afford10 = false;
            let cTxt1 = '?'; let cTxt10 = '?';
            const costPrefix = getString('buttons.costPrefix');
            const buyTenHint = getString('buttons.buyTenHint');
            const insufficientHint = getString('buttons.insufficient');

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
            cstEl.textContent = `${costPrefix} ${cTxt1}`;
            cnt.textContent = state.count;

            // Fetch base text from strings file
            const buildingName = getString(`buildings.${id}.name`, {fallback: id});
            const flavourText = getString(`buildings.${id}.flavour`);
            let effectText = getString('buttons.effectPrefix') + " N/A"; // Default effect text
            let perBuildingEffectText = "N/A";
            let tooltipText = flavourText || buildingName; // Start tooltip with flavour or name

            // --- Calculate Per Building & Total Production (Logic remains similar) ---
            if (cfg.baseLPS || cfg.baseOPS) {
                 // Calculation logic... (as before, no changes needed here)
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
                 const totalPrefix = getString('misc.totalProduction');
                 if (totalLPS > 0) totalParts.push(`+${formatNumber(totalLPS)} L/s`);
                 if (totalOPS > 0) totalParts.push(`+${formatNumber(totalOPS)} O/s`);

                 // Combine per-building and total (if applicable)
                 effectText = perBuildingEffectText;
                 if (totalParts.length > 0 && state.count > 0) {
                     effectText += ` (${totalPrefix} ${totalParts.join(', ')})`;
                 }
                 tooltipText += `\n\n${costPrefix} ${cTxt1}`;
                 tooltipText += `\n${costPrefix} x10: ${cTxt10}${afford10 ? '' : ` ${insufficientHint}`}`;
                 tooltipText += `\n${buyTenHint}`;
                 tooltipText += `\n${getString('buttons.effectPrefix')} (Per): ${perBuildingEffectText}`;
                 if (totalParts.length > 0 && state.count > 0) {
                      tooltipText += `\n${getString('buttons.effectPrefix')} (Total): ${totalParts.join(', ')}`;
                 }

            // Handle non-L/O producing buildings using base strings + dynamic values
            } else {
                const effectDescBase = getString(`buildings.${id}.effectDescBase`);
                const tooltipBase = getString(`buildings.${id}.tooltipBase`);
                let dynamicPart = "";
                let currentEffectValFormatted = "";

                if (id === 'acctManager') {
                    const currentReduction = 1.0 - rates.currentAcctManagerCostReduction;
                    currentEffectValFormatted = formatPercent(currentReduction, 1);
                    dynamicPart = ` (Now: ${currentEffectValFormatted})`;
                } else if (id === 'successArchitect') {
                    const currentBonus = rates.currentSuccessArchitectCVRBonus;
                    currentEffectValFormatted = `+${formatPercent(currentBonus, 1)}`;
                    dynamicPart = ` (Now: ${currentEffectValFormatted})`;
                } else if (id === 'procurementOpt') {
                    const currentReduction = 1.0 - rates.currentProcurementOptCostReduction;
                    currentEffectValFormatted = formatPercent(currentReduction, 1);
                    dynamicPart = ` (Now: ${currentEffectValFormatted})`;
                } else if (id === 'successManager') {
                     const currentMultiplier = rates.currentSuccessManagerCVRMultiplier;
                     currentEffectValFormatted = `x${currentMultiplier.toFixed(2)}`; // Or format percentage bonus
                     dynamicPart = ` (Now: ${currentEffectValFormatted})`;
                }

                effectText = (effectDescBase !== `buildings.${id}.effectDescBase` ? effectDescBase : '') + dynamicPart;
                tooltipText += `\n\n${costPrefix} ${cTxt1}`;
                tooltipText += `\n${costPrefix} x10: ${cTxt10}${afford10 ? '' : ` ${insufficientHint}`}`;
                tooltipText += `\n${buyTenHint}`;
                tooltipText += `\n${(tooltipBase !== `buildings.${id}.tooltipBase` ? tooltipBase : '')}`
                // Append current dynamic effect to tooltip if available
                if (dynamicPart) {
                    tooltipText += ` (Current total effect: ${currentEffectValFormatted})`;
                }
            }

            // Update the button's effect text and title (tooltip)
            effEl.textContent = effectText;
            btn.title = tooltipText;

            // Update Building Name Span (using data-attribute)
            const nameSpan = btn.querySelector(`span[data-building-id="${id}"][data-type="name"]`);
            if (nameSpan && nameSpan.textContent !== buildingName) {
                nameSpan.textContent = buildingName;
            }
        }


        // --- Update Tiered Upgrade Buttons ---
        for (const categoryId in upgradesConfig) {
            if (categoryId === 'special') continue;
            const categoryConfig = upgradesConfig[categoryId];
            const containerId = `upgrade-category-${categoryId}`;
            const containerEl = document.getElementById(containerId);
            if (!containerEl) continue;
            containerEl.innerHTML = ''; // Clear previous buttons

            const currentTierNum = gameState.categoryTiers[categoryId] || 1;
            const tierKey = `tier${currentTierNum}`;
            const upgradesInTier = categoryConfig[tierKey];
            if (!upgradesInTier || Object.keys(upgradesInTier).length === 0) continue;

            for (const upgradeId in upgradesInTier) {
                const upgradeConfig = categoryConfig[tierKey][upgradeId]; // Get config from correct tier
                const upgradeState = gameState.upgrades[upgradeId] || { purchased: false };

                // Create button using helper (fetches static name/desc from uiStrings)
                const buttonEl = createUpgradeButtonElement(upgradeId, upgradeConfig, categoryId);

                const cost = getUpgradeCost(upgradeId);
                let afford = false;
                let cTxt = '?';
                const costSpan = buttonEl.querySelector('.cost');
                costSpan.classList.remove('requirement'); // Reset class
                const costPrefix = getString('buttons.costPrefix');
                const reqPrefix = getString('buttons.reqPrefix');

                // Handle Customer Requirement vs. Cost
                if (cost.requiresCustomers && cost.requiresCustomers > 0) {
                    afford = gameState.customers >= cost.requiresCustomers;
                    cTxt = `${reqPrefix} ${formatNumber(cost.requiresCustomers)} ${getString('misc.currency.cust')}`;
                    costSpan.classList.add('requirement');
                } else { // Handle standard costs
                    if (upgradeConfig.costCurrency === 'both') { afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps; cTxt = `${costPrefix} ${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O`; }
                    else if (upgradeConfig.costCurrency === 'leads') { afford = gameState.leads >= cost.leads; cTxt = `${costPrefix} ${formatNumber(cost.leads)} L`; }
                    else if (upgradeConfig.costCurrency === 'opportunities') { afford = gameState.opportunities >= cost.opps; cTxt = `${costPrefix} ${formatNumber(cost.opps)} O`; }
                    else if (upgradeConfig.costCurrency === 'money') { afford = gameState.money >= cost.money; cTxt = `${costPrefix} $${formatMoney(cost.money)}`; }
                    else if (upgradeConfig.costCurrency === 'customers') { afford = gameState.customers >= cost.customers; cTxt = `${costPrefix} ${formatNumber(cost.customers)} ${getString('misc.currency.cust')}`; }
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
             if (upgradeId === 'name') continue; // Skip the 'name' property if used in config
             const el = domElements[`upgrade-${upgradeId}`];
             if (!el) continue;

             const cfg = upgradesConfig.special[upgradeId];
             const state = gameState.upgrades[upgradeId] || { purchased: false };
             const cost = getUpgradeCost(upgradeId);
             let afford = false; let cTxt = '?';
             const costSpan = el.querySelector('.cost');
             const nameSpan = el.querySelector(`span[data-upgrade-id="${upgradeId}"][data-type="name"]`);
             const effSpan = el.querySelector(`span[data-upgrade-id="${upgradeId}"][data-type="description"]`); // Target effect span by data attr

             costSpan.classList.remove('requirement'); // Reset class
             const costPrefix = getString('buttons.costPrefix');
             const reqPrefix = getString('buttons.reqPrefix');

            // Update static text content if needed (might have been placeholder initially)
            if (nameSpan && nameSpan.textContent !== getString(`upgrades.${upgradeId}.name`)){
                nameSpan.textContent = getString(`upgrades.${upgradeId}.name`);
            }
             if (effSpan && upgradeId !== 'playtimeMPSBoost' && effSpan.textContent !== getString(`upgrades.${upgradeId}.description`)){
                 effSpan.textContent = getString(`upgrades.${upgradeId}.description`);
             }
             // Update base title if needed
             let baseTitle = getString(`upgrades.${upgradeId}.title`);
             if (!baseTitle || baseTitle === `upgrades.${upgradeId}.title`) {
                 baseTitle = getString(`upgrades.${upgradeId}.description`); // Fallback to desc for title
             }
             if (upgradeId !== 'playtimeMPSBoost' && el.title !== baseTitle) {
                 el.title = baseTitle || '';
             }


             // Handle Veteran Pipeline Operator cost display
             if (upgradeId === 'playtimeMPSBoost' && cfg.costCurrency === 'all') {
                 afford = gameState.leads >= cost.leads && gameState.opportunities >= cost.opps && gameState.money >= cost.money;
                 cTxt = `${costPrefix} ${formatNumber(cost.leads)} L & ${formatNumber(cost.opps)} O & $${formatMoney(cost.money)}`;
             }
             // Handle Flexible Workflow cost display
             else if (upgradeId === 'flexibleWorkflow' && cfg.costMoney && cfg.costCustomers) {
                 afford = gameState.money >= cost.money && gameState.customers >= cost.customers;
                 cTxt = `${reqPrefix} ${formatNumber(cost.customers)} ${getString('misc.currency.cust')} & $${formatMoney(cost.money)}`;
                 costSpan.classList.add('requirement');
             }
             // Handle Strategic Cost Optimization (Money cost)
             else if (cfg.costCurrency === 'money') {
                 afford = gameState.money >= cost.money;
                 cTxt = `${costPrefix} $${formatMoney(cost.money)}`;
             }
             else {
                 console.warn(`Unhandled cost type for special upgrade: ${upgradeId}`);
                 cTxt = `${costPrefix} ?`;
             }

             const purchased = state.purchased === true;
             el.disabled = !afford || purchased || isDisabledGlobal;

             if (purchased) {
                 el.classList.add('purchased');
                 if (costSpan) costSpan.style.display = 'none';
                 if (effSpan) effSpan.style.display = 'none';
             } else {
                 el.classList.remove('purchased');
                 if (costSpan) {
                     costSpan.style.display = 'block';
                     costSpan.textContent = cTxt; // Set combined cost/req text
                 }
                 if (effSpan) {
                    effSpan.style.display = 'block';
                    // --- Dynamic Update for VPO ---
                    if (upgradeId === 'playtimeMPSBoost') {
                         const elapsedMs = Date.now() - (gameState.gameStartTime || Date.now());
                         const elapsedHours = Math.max(0, elapsedMs / (1000 * 60 * 60));
                         const PLAYTIME_CAP_HOURS = 2.0;
                         const MAX_BONUS_PERCENT = 200.0;
                         const progressToCap = Math.min(1.0, elapsedHours / PLAYTIME_CAP_HOURS);
                         const currentBonusPercent = MAX_BONUS_PERCENT * progressToCap;
                         // Use string replacement
                         effSpan.textContent = getString('upgrades.playtimeMPSBoost.descriptionDynamic', { PERCENT: currentBonusPercent.toFixed(0) });
                         // Update title dynamically too
                         const titleBase = getString('upgrades.playtimeMPSBoost.titleBase');
                         el.title = titleBase + ` (Currently: +${currentBonusPercent.toFixed(1)}%)`;
                    }
                    // --- End Dynamic Update ---
                 }
             }
        }

        // Update toggle button visuals using strings
        updateAcquisitionButtonVisuals();
        updateFlexibleWorkflowToggleButtonVisuals();

    } catch (e) { console.error("Error in updateButtonStates:", e); }
}

// --- Modal Logic ---
function showModal(modalElement) { if (modalElement) modalElement.classList.add('show'); }
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('show');
        if (modalElement === domElements['stats-modal'] && statsUpdateIntervalId) {
            clearInterval(statsUpdateIntervalId);
            statsUpdateIntervalId = null;
        }
        // Set first-time flag when modal is dismissed
        if (modalElement === domElements['first-time-modal'] && localStorage.getItem(FIRST_TIME_POPUP_KEY) !== 'shown') {
             localStorage.setItem(FIRST_TIME_POPUP_KEY, 'shown');
             console.log("First time popup flag set via hideModal.");
        }
    }
}
export function showCredits() { showModal(domElements['credits-modal']); }
export function hideCredits() { hideModal(domElements['credits-modal']); }
export function showStats() {
    const modal = domElements['stats-modal'];
    if (!modal) return;
    updateStatsDisplay(); // Update stats before showing
    showModal(modal);
    if (!statsUpdateIntervalId) {
        statsUpdateIntervalId = setInterval(updateStatsDisplay, STATS_UPDATE_INTERVAL_MS);
    }
}
export function hideStats() { hideModal(domElements['stats-modal']); }
export function showTutorial() { showModal(domElements['tutorial-modal']); /* TODO: Populate list items */ }
export function hideTutorial() { hideModal(domElements['tutorial-modal']); }
export function showSettings() { showModal(domElements['settings-modal']); }
export function hideSettings() { hideModal(domElements['settings-modal']); }

// Use strings for win modal
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
    // Optionally update win modal text here if needed, though static keys handle it now
    showModal(domElements['win-modal']);
}
export function closeWinScreen() {
    hideModal(domElements['win-modal']);
    // Game remains paused and won
    updateButtonStates();
    updateAcquisitionButtonVisuals();
    updateFlexibleWorkflowToggleButtonVisuals();
}

// Use strings for first time modal
export function showFirstTimeModal() {
    // Optionally update text here if needed, though static keys handle it now
    showModal(domElements['first-time-modal']);
}
export function hideFirstTimeModal() {
    hideModal(domElements['first-time-modal']); // Will also set the flag via hideModal
}


// --- Other UI Updates ---
export function updateStatsDisplay() {
    const modal = domElements['stats-modal'];
    if (!modal || !modal.classList.contains('show')) {
        if (statsUpdateIntervalId) { clearInterval(statsUpdateIntervalId); statsUpdateIntervalId = null; }
        return;
    }
    try {
        // Numeric updates - labels handled by applyUiStrings
        if(domElements['stat-game-time']) domElements['stat-game-time'].textContent = formatTime(Date.now() - (gameState.gameStartTime || Date.now()));
        if(domElements['stat-lead-clicks']) domElements['stat-lead-clicks'].textContent = formatNumber(gameState.totalLeadClicks);
        if(domElements['stat-opp-clicks']) domElements['stat-opp-clicks'].textContent = formatNumber(gameState.totalOppClicks);
        if(domElements['stat-manual-leads']) domElements['stat-manual-leads'].textContent = formatNumber(gameState.totalManualLeads);
        if(domElements['stat-manual-opps']) domElements['stat-manual-opps'].textContent = formatNumber(gameState.totalManualOpps);
        if(domElements['stat-auto-leads']) domElements['stat-auto-leads'].textContent = formatNumber(gameState.totalAutoLeads);
        if(domElements['stat-auto-opps']) domElements['stat-auto-opps'].textContent = formatNumber(gameState.totalAutoOpps);
        if(domElements['stat-acq-attempts']) domElements['stat-acq-attempts'].textContent = formatNumber(gameState.totalAcquisitionAttempts);
        if(domElements['stat-acq-success']) domElements['stat-acq-success'].textContent = formatNumber(gameState.totalSuccessfulAcquisitions);
        const failedAcq = Math.max(0, gameState.totalAcquisitionAttempts - gameState.totalSuccessfulAcquisitions);
        if(domElements['stat-acq-failed']) domElements['stat-acq-failed'].textContent = formatNumber(failedAcq);
        if(domElements['stat-powerups-clicked']) domElements['stat-powerups-clicked'].textContent = formatNumber(gameState.totalPowerupsClicked);
        // Use currency prefix from strings
        const currencyPrefix = getString('modals.stats.currencyPrefix');
        if(domElements['stat-total-money']) domElements['stat-total-money'].textContent = currencyPrefix + formatMoney(gameState.totalMoneyEarned);
    } catch (e) { console.error("Error updating stats display:", e); hideStats(); }
}

// Use string keys for status messages
export function displaySaveStatus(msgKey, dur = 3000, replacements = {}) {
    const el = domElements['save-status'];
    if (!el) return;
    if (saveStatusTimeoutId) clearTimeout(saveStatusTimeoutId);
    const msg = getString(msgKey, replacements); // Get string using the key
    el.textContent = msg;
    el.classList.add('visible');
    saveStatusTimeoutId = setTimeout(() => {
        el.classList.remove('visible');
        saveStatusTimeoutId = null;
    }, dur);
}

// Use strings for powerup display
export function updateActivePowerupDisplay() {
    const displayEl = domElements['active-powerup-display'];
    if (!displayEl) return;
    const activeIds = Object.keys(gameState.activeBoosts);

    if (activeIds.length === 0) {
        displayEl.innerHTML = '';
        displayEl.title = getString('misc.noActivePowerup'); // Use string
        return;
    }

    const firstBoostId = activeIds[0];
    const boost = gameState.activeBoosts[firstBoostId];
    if (!boost || !boost.endTime) {
        displayEl.innerHTML = '';
        displayEl.title = getString('misc.noActivePowerup');
        return;
    }

    const remainingTimeMs = boost.endTime - Date.now();
    if (remainingTimeMs <= 0) {
        displayEl.innerHTML = '';
        displayEl.title = getString('misc.noActivePowerup');
    } else {
        const remainingSeconds = (remainingTimeMs / 1000).toFixed(1);
        // Fetch names/descriptions using the boost ID
        const boostName = getString(`powerups.${firstBoostId}.name`, {fallback: boost.name || firstBoostId});
        const boostDesc = getString(`powerups.${firstBoostId}.description`, {fallback: boost.description || 'Effect active'});

        displayEl.innerHTML = `${boostName}: ${remainingSeconds}s<br><span style="font-size: 0.9em; font-weight: normal; color: #555;">(${boostDesc})</span>`;
        displayEl.title = getString('misc.powerupActiveTitle', { NAME: boostName, DESC: boostDesc, TIME: remainingSeconds });
    }
}

// Use strings for toggle buttons
export function updateAcquisitionButtonVisuals() {
    const btn = domElements['toggle-acquisition-button'];
    if (!btn) return;
    const isPausedByUser = gameState.isAcquisitionPaused;
    const isDisabled = isGameWon || isGamePaused;

    const textKey = isPausedByUser ? 'topBar.toggleAcquisitionResume' : 'topBar.toggleAcquisitionPause';
    const titleKey = isPausedByUser ? 'topBar.toggleAcquisitionPauseTitle' : 'topBar.toggleAcquisitionPauseTitle'; // Title seems same? Check ui_strings if different needed

    btn.textContent = getString(textKey);
    btn.title = getString(titleKey);
    btn.classList.toggle('paused', isPausedByUser);
    btn.disabled = isDisabled;
}

// Use strings for toggle buttons
export function updateFlexibleWorkflowToggleButtonVisuals() {
    const btn = domElements['toggle-flexible-workflow'];
    if (!btn) return;
    const isPurchased = gameState.upgrades['flexibleWorkflow']?.purchased === true;
    const isActive = gameState.flexibleWorkflowActive;
    const isDisabled = !isPurchased || isGamePaused || isGameWon;

    btn.disabled = isDisabled;
    btn.classList.toggle('active', isActive && isPurchased);

    let textKey, titleKey;
    if (isActive && isPurchased) {
        textKey = 'buttons.deactivateFlexWorkflow';
        titleKey = 'buttons.deactivateFlexWorkflowTitle';
    } else {
        textKey = 'buttons.activateFlexWorkflow';
        titleKey = isPurchased ? 'buttons.activateFlexWorkflowTitle' : 'buttons.flexWorkflowNotPurchasedTitle';
    }
    btn.textContent = getString(textKey);
    btn.title = getString(titleKey);
}

// Need to import config for FIRST_TIME_POPUP_KEY
// import * as config from './config.js'; // Already imported via destructured FIRST_TIME_POPUP_KEY