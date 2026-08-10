/**
 * Ikmal Weather & Moon Phase Card (Standalone JSX Render Note)
 * Renders live Open-Meteo weather forecast, condition icons, daylight hours,
 * and moon phase illumination as an independent render note widget.
 */

import { TodayEngine } from '../engine/todayEngine.js';
import { TemplateEngine } from '../engine/templateEngine.js';
import { IfThenRuleEngine } from '../engine/ifThenRuleEngine.js';
import { SettingsEngine } from '../engine/settingsEngine.js';
import { escapeHtml, section } from '../components/nativeUi.js';
import { computeMoonPhase } from '../engine/noteInsightsEngine.js';
import { fetchWeather, hasLocation } from '../engine/weatherEngine.js';
import { loadRuntimeModel } from '../engine/runtimeModel.js';

export function initIkmalWeather(containerEl) {
    const todayEngine = new TodayEngine();
    const modelReady = loadRuntimeModel(
        new TemplateEngine(),
        todayEngine,
        new IfThenRuleEngine(),
        new SettingsEngine(),
        typeof api !== 'undefined' ? api : null,
    );
    const shell = document.createElement('div');
    shell.className = 'notes-system-shell p-3';

    const { card } = section(shell, {
        title: 'Ikmal Weather & Climate Card',
        description: 'Live local weather, condition forecast, and moon phase illumination.',
    });

    const weatherBox = document.createElement('div');
    weatherBox.className = 'ns-card p-3 mt-2';
    weatherBox.innerHTML = '<div class="ns-empty">Loading weather settings…</div>';

    async function renderWeather() {
        await modelReady;
        const configured = todayEngine.getLayout().weather;
        const phase = computeMoonPhase(new Date());
        if (!hasLocation(configured)) {
            weatherBox.innerHTML = `<div class="d-flex align-items-center gap-2"><i class="bx bx-moon fs-2 text-warning"></i><div><h6 class="mb-0 fw-bold">Local Climate & Moon Phase</h6><small class="text-muted">${escapeHtml(phase.name)} (${Math.round(phase.illumination * 100)}% illuminated)</small></div></div><div class="alert alert-light border small text-muted mb-0 mt-3">Configure coordinates under Ikmal Package Settings to enable live Open-Meteo weather forecasts.</div>`;
            return;
        }
        weatherBox.innerHTML = '<div class="ns-empty">Loading local forecast…</div>';
        try {
            const report = await fetchWeather(configured);
            weatherBox.innerHTML = `<div class="d-flex align-items-center justify-content-between mb-3"><div><h6 class="mb-0 fw-bold">${escapeHtml(configured.label || 'Local weather')}</h6><div class="ns-meta">${escapeHtml(report.condition.label)} · ${report.temperature}${escapeHtml(report.temperatureUnit)} · wind ${report.windSpeed} ${escapeHtml(report.windUnit)}</div></div><i class="bx bx-${escapeHtml(report.condition.icon)} fs-2 text-warning"></i></div><div class="ns-meta">${report.days.map((day) => `${escapeHtml(day.date)}: ${day.high}° / ${day.low}°`).join(' · ')}</div><div class="ns-meta mt-2">${escapeHtml(phase.name)} · ${Math.round(phase.illumination * 100)}% illuminated</div>`;
        } catch (error) {
            weatherBox.innerHTML = `<div class="alert alert-light border small text-muted mb-0">Could not load forecast: ${escapeHtml(error.message || error)}</div>`;
        }
    }

    card.appendChild(weatherBox);
    shell.appendChild(card);
    containerEl.appendChild(shell);
    renderWeather();
}

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.ikmal-weather-root')
            || document.body;
        if (container) {
            initIkmalWeather(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
