/**
 * Today Homepage: the daily dashboard, plus the settings that shape it.
 *
 * Like the Template Studio, the page has two modes. Edit is a Trilium options page
 * — titled sections of labelled rows — for configuring the layout. Preview is the
 * dashboard itself, with nothing on screen that would not be there when the
 * homepage is opened normally.
 */

import { TodayEngine } from '../engine/todayEngine.js';
import { TemplateEngine } from '../engine/templateEngine.js';
import { DashboardColumns, DashboardDensity, TodayLayoutConfig, TodayWidgetConfig, WeatherConfig } from '../engine/types.js';
import { fetchWeather, hasLocation, WeatherReport } from '../engine/weatherEngine.js';
import {
    buildActivityHeatmap,
    computeMoonPhase,
    computeWritingGoalProgress,
    countWords,
    findOnThisDay,
    findStaleNotes,
    NoteSummary,
    pickDailyQuote,
} from '../engine/noteInsightsEngine.js';
import { button, emptyState, escapeHtml, iconAction, listItem, pageHeader, row, section, switchRow, toggle } from './nativeUi.js';

interface KanbanTask {
    id: string;
    title: string;
    priority: string;
    status: string;
    project: string;
}

interface ActiveProject {
    id: string;
    dashboardId?: string;
    title: string;
    kind: string;
    status: string;
    startDate: number;
}

/** Stands in for real tasks outside Trilium (this preview harness, tests). */
const SAMPLE_TASKS: KanbanTask[] = [
    { id: 't1', title: 'Review quarterly goals & roadmap', priority: 'high', status: 'todo', project: 'Trilium Extension' },
    { id: 't2', title: 'Publish LanguageTool plugin update', priority: 'medium', status: 'in_progress', project: 'LanguageTool Plugin' },
    { id: 't3', title: 'Setup ETAPI automated test suite', priority: 'high', status: 'done', project: 'Trilium Extension' },
];

const SAMPLE_ACTIVE_PROJECTS: ActiveProject[] = [
    { id: 'sample_project_1', title: 'Trilium Extension', kind: 'project', status: 'active', startDate: Date.now() },
];

const KANBAN_COLUMNS = [
    { id: 'todo', title: 'To do' },
    { id: 'in_progress', title: 'In progress' },
    { id: 'done', title: 'Completed' },
];

/**
 * Keep the Today capture bar aligned with the original Ikmal workspace
 * actions. The template registry contains more implementation/editorial
 * templates, but the daily page should expose the intentional creation
 * shortcuts users can recognize at a glance.
 */
const TODAY_QUICK_CAPTURE_ACTIONS = [
    { type: 'projectHub', label: 'New Project', icon: 'book', title: 'Create a new Project Hub' },
    { type: 'scratch', label: 'New Scratch', icon: 'file-blank', title: 'Create a scratch note' },
    { type: 'meeting', label: 'New Meeting', icon: 'calendar-event', title: 'Create a new Meeting' },
    { type: 'task', label: 'New Task', icon: 'check-square', title: 'Create a new Task' },
    { type: 'story', label: 'New Story', icon: 'news', title: 'Create a new Story draft' },
    { type: 'edit', label: 'New Edit', icon: 'edit-alt', title: 'Create a new Edit round' },
    { type: 'email', label: 'New Email', icon: 'envelope', title: 'Create a new Email draft' },
    { type: 'person', label: 'New Person', icon: 'user', title: 'Create a new Person' },
    { type: 'organization', label: 'New Org', icon: 'buildings', title: 'Create a new Organization' },
    { type: 'topic', label: 'New Topic', icon: 'purchase-tag', title: 'Create a new Topic' },
] as const;

import { SettingsEngine } from '../engine/settingsEngine.js';

// Trilium injects `api` as a scoped variable into backend script execution; it
// is not a property of `globalThis` there. Closures passed to `runOnBackend`
// must reference this bare identifier so the bundler leaves it unresolved.
declare const api: any;

export function renderTodayHomepage(
    container: HTMLElement,
    todayEngine: TodayEngine,
    templateEngine: TemplateEngine,
    onQuickCapture: (templateId: string) => void,
    settingsEngine?: SettingsEngine,
    options: TodayHomepageOptions = {}
): () => void {
    let mode: 'edit' | 'preview' = 'preview';

    const showEditor = options.showEditor !== false;
    const showJournalCard = options.showJournalCard === true;
    const showOpenTasks = options.showOpenTasks !== false;

    let journalContext: any = null;
    let journalOpenPromise: Promise<void> | null = null;
    let splitWidthTimers: number[] = [];

    // Cached so switching tabs or toggling a widget does not re-request the forecast.
    // Keyed by the location it was fetched for, so changing location invalidates it.
    let weatherCache: { key: string; report: WeatherReport } | null = null;
    let weatherError = '';
    let weatherPending = false;
    let weatherRequestKey = '';

    // The activity heatmap, On This Day, and Needs Attention widgets all read
    // from the same note search, fetched once per session and shared between
    // them rather than each widget querying Trilium independently.
    let noteSummaryCache: NoteSummary[] | null = null;
    let noteSummaryPending = false;

    let taskCache: KanbanTask[] | null = null;
    let taskPending = false;

    let activeProjectCache: ActiveProject[] | null = null;
    let activeProjectPending = false;

    // Words written today, for the Writing Goal widget.
    let wordsTodayCache: number | null = null;
    let wordsTodayPending = false;
    let dataGeneration = 0;

    function refresh() {
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'today-homepage-wrapper';
        if (todayEngine.getLayout().density === 'compact') {
            wrapper.classList.add('ns-compact');
        }

        if (options.showHeader !== false) {
            wrapper.appendChild(pageHeader({
                icon: 'bx-home-alt',
                title: options.title || 'Today Homepage',
                subtitle: options.subtitle || 'Daily dashboard with quick capture, live kanban, and a component grid.',
                actions: showEditor ? [modeSwitcher()] : undefined,
            }));
        }

        if (mode === 'edit') {
            renderEditor(wrapper);
        } else {
            renderDashboard(wrapper);
        }

        container.appendChild(wrapper);
    }

    function modeSwitcher(): HTMLElement {
        const group = document.createElement('div');
        group.className = 'btn-group btn-group-sm';
        group.setAttribute('role', 'group');

        for (const m of [
            { id: 'edit' as const, label: 'Edit', icon: 'bx-slider' },
            { id: 'preview' as const, label: 'Preview', icon: 'bx-show' },
        ]) {
            const btn = button({
                text: m.label,
                icon: m.icon,
                size: 'small',
                className: mode === m.id ? 'active' : undefined,
                onClick: () => {
                    mode = m.id;
                    refresh();
                },
            });
            btn.setAttribute('aria-pressed', String(mode === m.id));
            group.appendChild(btn);
        }

        return group;
    }

    // ------------------------------------------------------------------- edit

    function renderEditor(parent: HTMLElement) {
        const layout = todayEngine.getLayout();

        // --- layout
        const { card } = section(parent, { title: 'Layout' });

        const widthInput = document.createElement('input');
        widthInput.type = 'number';
        widthInput.className = 'form-control form-control-sm';
        widthInput.id = 'journal-width';
        widthInput.min = '35';
        widthInput.max = '85';
        widthInput.value = String(layout.journalWidthPercent);
        widthInput.addEventListener('change', () => {
            todayEngine.setJournalWidth(Number(widthInput.value));
            widthInput.value = String(todayEngine.getLayout().journalWidthPercent);
        });
        card.appendChild(row(widthInput, {
            label: 'Journal split width',
            description: 'Percentage of the homepage given to the journal panel, between 35 and 85.',
            htmlFor: 'journal-width',
        }));

        card.appendChild(switchRow({
            id: 'quick-capture-bar',
            label: 'Show the quick capture bar',
            description: 'Buttons at the top of the dashboard for creating a note from a template.',
            checked: layout.showQuickCaptureBar,
            onChange: (checked) => todayEngine.setQuickCaptureBar(checked),
        }));

        const columns = document.createElement('select');
        columns.className = 'form-select form-select-sm';
        columns.id = 'grid-columns';
        columns.innerHTML = ([
            ['auto', 'Fit to width'],
            ['1', 'One column'],
            ['2', 'Two columns'],
            ['3', 'Three columns'],
        ] as const)
            .map(([value, label]) => `<option value="${value}"${String(layout.columns) === value ? ' selected' : ''}>${label}</option>`)
            .join('');
        columns.addEventListener('change', () => {
            const value = columns.value;
            todayEngine.setColumns(value === 'auto' ? 'auto' : (Number(value) as DashboardColumns));
        });
        card.appendChild(row(columns, {
            label: 'Grid columns',
            description: 'How many widgets sit side by side at full width. Fewer are shown automatically in a narrow pane.',
            htmlFor: 'grid-columns',
        }));

        const density = document.createElement('select');
        density.className = 'form-select form-select-sm';
        density.id = 'grid-density';
        density.innerHTML = `
            <option value="comfortable"${layout.density !== 'compact' ? ' selected' : ''}>Comfortable</option>
            <option value="compact"${layout.density === 'compact' ? ' selected' : ''}>Compact</option>
        `;
        density.addEventListener('change', () => {
            todayEngine.setDensity(density.value as DashboardDensity);
            refresh();
        });
        card.appendChild(row(density, {
            label: 'Density',
            description: 'Compact trades padding for more of the dashboard on screen.',
            htmlFor: 'grid-density',
        }));

        // --- widgets
        const widgets = [...layout.widgets].sort((a, b) => a.order - b.order);
        const { card: widgetCard } = section(parent, {
            title: `Widgets (${widgets.filter((w) => w.visible).length} of ${widgets.length} shown)`,
            description: 'Which panels appear on the dashboard, how wide they are, and in what order.',
        });

        widgets.forEach((widget, idx) => {
            widgetCard.appendChild(widgetRow(widget, idx, widgets));
        });

        renderWeatherSettings(parent, layout.weather);
        renderLocalInsightsSettings(parent, layout);

        // --- explanation, which belongs with the settings rather than on the dashboard
        const { card: guideCard } = section(parent, {
            title: 'How it works',
            description: 'The three engine layers behind everything the dashboard creates.',
        });
        for (const [label, description] of [
            ['1. Pick a template', 'Tasks, meetings, story drafts, and project hubs come pre-formatted with title patterns and promoted fields.'],
            ['2. Connect relationships', 'Notes link to parent hubs and organizations; topic tags are derived and inherited from them.'],
            ['3. Automate with rules', 'If/then rules run on creation, e.g. marking a high-priority task due soon.'],
        ] as const) {
            guideCard.appendChild(row('<span></span>', { label, description, compact: true }));
        }
    }

    function widgetRow(widget: TodayWidgetConfig, idx: number, ordered: TodayWidgetConfig[]): HTMLElement {
        const visibility = toggle(`widget-${widget.id}`, widget.visible, (visible) => {
            todayEngine.toggleWidgetVisibility(widget.id, visible);
            refresh();
        });

        const span = document.createElement('select');
        span.className = 'form-select form-select-sm';
        span.style.width = 'auto';
        span.innerHTML = `
            <option value="1"${widget.colSpan === 1 ? ' selected' : ''}>One column</option>
            <option value="2"${widget.colSpan === 2 ? ' selected' : ''}>Two columns</option>
            <option value="3"${widget.colSpan === 3 ? ' selected' : ''}>Full width</option>
        `;
        span.addEventListener('change', () => {
            todayEngine.updateWidget(widget.id, { colSpan: Number(span.value) as TodayWidgetConfig['colSpan'] });
        });

        const move = (delta: number) => {
            const ids = ordered.map((w) => w.id);
            const target = idx + delta;
            [ids[idx], ids[target]] = [ids[target], ids[idx]];
            todayEngine.reorderWidgets(ids);
            refresh();
        };

        const up = iconAction({ icon: 'bx-up-arrow-alt', title: `Move ${widget.title} up`, onClick: () => move(-1) });
        if (idx === 0) up.classList.add('disabled');

        const down = iconAction({ icon: 'bx-down-arrow-alt', title: `Move ${widget.title} down`, onClick: () => move(1) });
        if (idx === ordered.length - 1) down.classList.add('disabled');

        return listItem({
            title: widget.title,
            // The marker identifies the widget: it is the tag whose notes it collects.
            description: `Collects notes tagged #${widget.marker}.`,
            disabled: !widget.visible,
            actions: [visibility, span, up, down],
        });
    }

    // ---------------------------------------------------------------- weather

    function renderWeatherSettings(parent: HTMLElement, weather: WeatherConfig | undefined) {
        const current: WeatherConfig = weather ?? { label: '', latitude: 0, longitude: 0, units: 'metric' };

        const { card } = section(parent, {
            title: 'Weather',
            description: 'Turn on the Weather widget above to show it. It fetches the forecast from open-meteo.com, which needs no account and receives only these coordinates.',
        });

        const label = document.createElement('input');
        label.type = 'text';
        label.className = 'form-control form-control-sm';
        label.id = 'weather-label';
        label.placeholder = 'Berkeley';
        label.value = current.label;
        label.addEventListener('change', () => todayEngine.setWeather({ label: label.value }));
        card.appendChild(row(label, {
            label: 'Location name',
            description: 'Shown on the widget. Not sent anywhere.',
            htmlFor: 'weather-label',
        }));

        const coords = document.createElement('div');
        coords.className = 'ns-actions';

        const lat = coordinateInput('weather-lat', 'Latitude', current.latitude);
        const lon = coordinateInput('weather-lon', 'Longitude', current.longitude);

        const commitCoordinates = () => {
            todayEngine.setWeather({ latitude: Number(lat.value), longitude: Number(lon.value) });
            // The cached report belongs to the old location.
            weatherCache = null;
            weatherError = '';
        };
        lat.addEventListener('change', commitCoordinates);
        lon.addEventListener('change', commitCoordinates);

        const locate = iconAction({
            icon: 'bx-current-location',
            title: 'Use my current location',
            onClick: () => {
                if (!navigator.geolocation) {
                    window.alert('This browser cannot report a location.');
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        lat.value = position.coords.latitude.toFixed(4);
                        lon.value = position.coords.longitude.toFixed(4);
                        commitCoordinates();
                    },
                    (err) => window.alert(`Could not read your location: ${err.message}`)
                );
            },
        });

        coords.append(lat, lon, locate);
        card.appendChild(row(coords, {
            label: 'Coordinates',
            description: 'Decimal degrees, e.g. 37.8715 and -122.2730.',
            htmlFor: 'weather-lat',
            compact: true,
        }));

        const units = document.createElement('select');
        units.className = 'form-select form-select-sm';
        units.id = 'weather-units';
        units.innerHTML = `
            <option value="metric"${current.units !== 'imperial' ? ' selected' : ''}>Celsius, km/h</option>
            <option value="imperial"${current.units === 'imperial' ? ' selected' : ''}>Fahrenheit, mph</option>
        `;
        units.addEventListener('change', () => {
            todayEngine.setWeather({ units: units.value as WeatherConfig['units'] });
            weatherCache = null;
        });
        card.appendChild(row(units, { label: 'Units', htmlFor: 'weather-units' }));
    }

    function coordinateInput(id: string, ariaLabel: string, value: number): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.className = 'form-control form-control-sm';
        input.id = id;
        input.style.width = '110px';
        input.setAttribute('aria-label', ariaLabel);
        input.value = value ? String(value) : '';
        return input;
    }

    // ------------------------------------------------------- local insights

    function renderLocalInsightsSettings(parent: HTMLElement, layout: TodayLayoutConfig) {
        const { card } = section(parent, {
            title: 'Local Insights',
            description: 'Settings for Activity, On This Day, Writing Goal, Moon & Daylight, and Needs Attention. All read-only and computed locally, except Moon & Daylight which reuses the Weather location above.',
        });

        const goalInput = document.createElement('input');
        goalInput.type = 'number';
        goalInput.className = 'form-control form-control-sm';
        goalInput.id = 'writing-goal-words';
        goalInput.min = '0';
        goalInput.step = '25';
        goalInput.value = String(layout.writingGoalWords ?? 500);
        goalInput.addEventListener('change', () => {
            todayEngine.setWritingGoalWords(Number(goalInput.value));
            goalInput.value = String(todayEngine.getLayout().writingGoalWords);
        });
        card.appendChild(row(goalInput, {
            label: 'Daily writing goal',
            description: 'Words per day the Writing Goal widget tracks against, from story drafts and edits touched today.',
            htmlFor: 'writing-goal-words',
        }));

        const staleInput = document.createElement('input');
        staleInput.type = 'number';
        staleInput.className = 'form-control form-control-sm';
        staleInput.id = 'stale-threshold-days';
        staleInput.min = '1';
        staleInput.value = String(layout.staleThresholdDays ?? 14);
        staleInput.addEventListener('change', () => {
            todayEngine.setStaleThresholdDays(Number(staleInput.value));
            staleInput.value = String(todayEngine.getLayout().staleThresholdDays);
        });
        card.appendChild(row(staleInput, {
            label: 'Stale after (days)',
            description: 'How long a still-open note can go untouched before Needs Attention flags it.',
            htmlFor: 'stale-threshold-days',
        }));
    }

    /**
     * The widget body. The forecast is requested once per location and then reused,
     * so re-rendering the dashboard does not hit the network again.
     */
    function renderWeatherWidget(card: HTMLElement) {
        const weather = todayEngine.getLayout().weather;

        if (!hasLocation(weather)) {
            card.appendChild(emptyState('No location set. Add coordinates under Weather in Edit.'));
            return;
        }

        const key = `${weather.latitude},${weather.longitude},${weather.units}`;

        if (weatherCache?.key === key) {
            card.appendChild(weatherReport(weatherCache.report, weather));
            return;
        }

        if (weatherError && weatherRequestKey === key) {
            const failed = document.createElement('div');
            failed.className = 'ns-actions';
            const message = document.createElement('span');
            message.className = 'ns-empty';
            message.textContent = weatherError;
            failed.append(message, button({
                text: 'Retry',
                icon: 'bx-refresh',
                onClick: () => {
                    weatherError = '';
                    refresh();
                },
            }));
            card.appendChild(failed);
            return;
        }

        card.appendChild(emptyState('Loading forecast…'));

        if (weatherPending) return;
        weatherPending = true;
        weatherRequestKey = key;

        fetchWeather(weather)
            .then((report) => {
                const currentWeather = todayEngine.getLayout().weather ?? weather;
                const currentKey = `${currentWeather.latitude},${currentWeather.longitude},${currentWeather.units}`;
                if (weatherRequestKey === key && currentKey === key) {
                    weatherCache = { key, report };
                    weatherError = '';
                }
            })
            .catch((err: Error) => {
                if (weatherRequestKey === key) weatherError = `Could not load the forecast: ${err.message}`;
            })
            .finally(() => {
                weatherPending = false;
                if (mode === 'preview') refresh();
            });
    }

    function weatherReport(report: WeatherReport, weather: WeatherConfig): HTMLElement {
        const el = document.createElement('div');

        const now = document.createElement('div');
        now.className = 'ns-weather-now';
        now.innerHTML = `
            <span class="ns-weather-icon bx bx-${escapeHtml(report.condition.icon)}" aria-hidden="true"></span>
            <div>
                <div class="ns-weather-temp">${report.temperature}${escapeHtml(report.temperatureUnit)}</div>
                <div class="ns-meta">
                    ${escapeHtml(report.condition.label)}${weather.label ? ` &middot; ${escapeHtml(weather.label)}` : ''}
                    &middot; wind ${report.windSpeed} ${escapeHtml(report.windUnit)}
                </div>
            </div>
        `;
        el.appendChild(now);

        if (report.days.length) {
            const forecast = document.createElement('div');
            forecast.className = 'ns-weather-forecast';
            forecast.innerHTML = report.days
                .map((day, i) => `
                    <div class="ns-weather-day">
                        <span class="ns-meta">${i === 0 ? 'Today' : escapeHtml(weekday(day.date))}</span>
                        <span class="bx bx-${escapeHtml(day.condition.icon)}" aria-hidden="true" title="${escapeHtml(day.condition.label)}"></span>
                        <span>${day.high}&deg;</span>
                        <span class="ns-meta">${day.low}&deg;</span>
                    </div>
                `)
                .join('');
            el.appendChild(forecast);
        }

        return el;
    }

    function weekday(isoDate: string): string {
        // Parsed as local time rather than UTC, so the label matches the user's day.
        const [year, month, day] = isoDate.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short' });
    }

    // ---------------------------------------------------------- local data

    /** The Trilium frontend script API, when this is actually running inside Trilium. */
    function triliumApi(): any {
        const g = globalThis as any;
        const runtimeApi = options.api || g.api;
        return runtimeApi && typeof runtimeApi.searchForNotes === 'function' ? runtimeApi : null;
    }

    /** Trilium timestamps carry an explicit offset; preserve it when parsing. */
    function parseTriliumTimestamp(value: unknown): number {
        if (typeof value !== 'string') return NaN;
        const normalized = value
            .replace(' ', 'T')
            .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
        const parsed = Date.parse(normalized);
        return Number.isNaN(parsed) ? NaN : parsed;
    }

    /**
     * Stands in for real note data outside Trilium (this preview harness, tests),
     * anchored to `now` so the demo is meaningful regardless of when it is viewed:
     * varied activity over twelve weeks, an anniversary note for On This Day, and
     * one stale plus one fresh note for Needs Attention.
     */
    function buildSampleNoteSummaries(now: Date): NoteSummary[] {
        const day = 24 * 60 * 60 * 1000;
        const summaries: NoteSummary[] = [];
        let id = 0;

        for (let offset = 0; offset < 84; offset++) {
            const count = Math.round(Math.abs(Math.sin(offset * 1.7)) * 3);
            for (let i = 0; i < count; i++) {
                const ts = now.getTime() - offset * day - i * 3_600_000;
                // Closed, so this history-filler data doesn't also show up as stale.
                summaries.push({ noteId: `sample_${id++}`, title: 'Sample note', dateCreated: ts, dateModified: ts, status: 'done' });
            }
        }

        for (const [yearsAgo, title] of [[1, 'Kickoff meeting notes'], [3, 'First project retro']] as const) {
            const anniversary = new Date(now.getFullYear() - yearsAgo, now.getMonth(), now.getDate(), 10, 0, 0);
            summaries.push({ noteId: `sample_anniversary_${yearsAgo}`, title, dateCreated: anniversary.getTime(), dateModified: anniversary.getTime(), status: 'done' });
        }

        summaries.push({ noteId: 'sample_stale_1', title: 'Vendor contract renewal', dateCreated: now.getTime() - 60 * day, dateModified: now.getTime() - 40 * day, status: 'todo' });
        summaries.push({ noteId: 'sample_fresh_1', title: "This week's planning doc", dateCreated: now.getTime() - 3 * day, dateModified: now.getTime() - 1 * day, status: 'in_progress' });

        return summaries;
    }

    /** Shared by Activity, On This Day, and Needs Attention so they issue one search between them. */
    async function loadNoteSummaries(generation = dataGeneration): Promise<NoteSummary[]> {
        if (noteSummaryCache) return noteSummaryCache;

        const api = triliumApi();
        if (!api) {
            noteSummaryCache = buildSampleNoteSummaries(new Date());
            return noteSummaryCache;
        }

        const markers = templateEngine.getAllTemplates().map((t) => `#${t.marker}`);
        const notes = await api.searchForNotes(markers.length ? markers.join(' OR ') : '#extTask');
        const summaries: NoteSummary[] = notes.map((note: any) => ({
            noteId: note.noteId,
            title: note.title,
            dateCreated: parseTriliumTimestamp(note.dateCreated),
            dateModified: parseTriliumTimestamp(note.dateModified),
            status: typeof note.getLabelValue === 'function' ? (note.getLabelValue('status') ?? undefined) : undefined,
        }));
        if (generation === dataGeneration) noteSummaryCache = summaries;
        return summaries;
    }

    /** Renders a loading placeholder and kicks off the fetch if needed; returns whether the cache is ready to read. */
    function ensureNoteSummariesLoaded(card: HTMLElement): boolean {
        if (noteSummaryCache) return true;

        card.appendChild(emptyState('Loading…'));
        if (!noteSummaryPending) {
            const generation = dataGeneration;
            noteSummaryPending = true;
            loadNoteSummaries(generation).catch((error) => {
                console.warn(`[Ikmal Tools] Activity summary could not load: ${error}`);
                if (generation === dataGeneration) noteSummaryCache = [];
            }).finally(() => {
                if (generation === dataGeneration) {
                    noteSummaryPending = false;
                    if (mode === 'preview') refresh();
                }
            });
        }
        return false;
    }

    /** The Kanban board's own search — task status/priority/project aren't part of NoteSummary. */
    async function loadTasks(): Promise<KanbanTask[]> {
        const api = triliumApi();
        if (!api) return SAMPLE_TASKS;

        const notes = await api.searchForNotes('#extTask');
        const tasks: KanbanTask[] = [];
        for (const note of notes) {
            const status = typeof note.getLabelValue === 'function' ? note.getLabelValue('status') : null;
            const priority = typeof note.getLabelValue === 'function' ? note.getLabelValue('priority') : null;
            const projectNote = typeof note.getRelationTarget === 'function' ? await note.getRelationTarget('project') : null;
            tasks.push({
                id: note.noteId,
                title: note.title,
                status: status ?? 'todo',
                priority: priority ?? 'medium',
                project: projectNote?.title ?? '',
            });
        }
        return tasks;
    }

    function noteLabel(note: any, name: string): string {
        if (typeof note?.getLabelValue === 'function') return note.getLabelValue(name) || '';
        if (typeof note?.getOwnedLabelValue === 'function') return note.getOwnedLabelValue(name) || '';
        return '';
    }

    function noteMarker(note: any, name: string): string | null {
        if (typeof note?.getOwnedLabelValue !== 'function') return null;
        const value = note.getOwnedLabelValue(name);
        return value === undefined || value === null ? null : value;
    }

    function isProjectDashboard(note: any): boolean {
        return noteMarker(note, 'extProjectDashboard') === 'projectHub'
            || noteMarker(note, 'extHubDashboard') === 'projectHub';
    }

    async function loadProjectDashboardIds(api: any): Promise<Map<string, string>> {
        const dashboards = new Map<string, any>();
        for (const query of ['#extProjectDashboard', '#extHubDashboard']) {
            try {
                for (const dashboard of await api.searchForNotes(query)) {
                    if (dashboard?.noteId && isProjectDashboard(dashboard)) {
                        dashboards.set(dashboard.noteId, dashboard);
                    }
                }
            } catch {
                // A missing legacy marker must not hide the project list.
            }
        }

        const projectDashboardIds = new Map<string, string>();
        for (const dashboard of dashboards.values()) {
            let parentIds: string[] = [];
            if (typeof dashboard.getParentNoteIds === 'function') {
                try {
                    parentIds = await Promise.resolve(dashboard.getParentNoteIds());
                } catch {
                    parentIds = [];
                }
            }
            for (const parentId of parentIds || []) {
                if (!projectDashboardIds.has(parentId)) {
                    projectDashboardIds.set(parentId, dashboard.noteId);
                }
            }
        }
        return projectDashboardIds;
    }

    async function loadActiveProjects(): Promise<ActiveProject[]> {
        const api = triliumApi();
        if (!api) return SAMPLE_ACTIVE_PROJECTS;

        const roots = await api.searchForNotes('#activeProjectRoot').catch(() => []);
        const projectNotes: any[] = [];
        const seen = new Set<string>();
        const pending = [...(roots || [])];
        while (pending.length) {
            const current = pending.shift();
            if (!current?.noteId || seen.has(current.noteId)) continue;
            seen.add(current.noteId);
            const isProject = noteMarker(current, 'extProjectHub') !== null
                || noteMarker(current, 'extTemplate') === 'projectHub'
                || noteMarker(current, 'noteType') === 'projectHub';
            if (isProject) projectNotes.push(current);
            if (typeof current.getChildNotes === 'function') {
                const children = await Promise.resolve(current.getChildNotes()).catch(() => []);
                pending.push(...(children || []));
            }
        }

        // Membership in the Active branch is authoritative. Status is shown
        // as metadata, but filtering on it here made the widget disagree with
        // the project tree whenever a legacy hub's labels lagged its location.
        projectNotes.sort((a, b) => parseTriliumTimestamp(noteLabel(b, 'startDate') || b.dateModified)
            - parseTriliumTimestamp(noteLabel(a, 'startDate') || a.dateModified));

        const projectDashboardIds = await loadProjectDashboardIds(api);
        const projectsWithDashboards = await Promise.all(projectNotes.map(async (note) => {
            const dashboardId = projectDashboardIds.get(note.noteId);
            return {
                id: note.noteId,
                dashboardId,
                title: note.title,
                kind: noteLabel(note, 'kind') || 'project',
                status: noteLabel(note, 'status') || 'active',
                startDate: parseTriliumTimestamp(noteLabel(note, 'startDate') || note.dateModified),
            };
        }));

        return projectsWithDashboards
            .sort((a, b) => (Number.isFinite(b.startDate) ? b.startDate : 0)
                - (Number.isFinite(a.startDate) ? a.startDate : 0));
    }

    function ensureActiveProjectsLoaded(card: HTMLElement): boolean {
        if (activeProjectCache) return true;

        card.appendChild(emptyState('Loading…'));
        if (!activeProjectPending) {
            const generation = dataGeneration;
            activeProjectPending = true;
            loadActiveProjects().then((projects) => {
                if (generation === dataGeneration) activeProjectCache = projects;
            }).catch((error) => {
                console.warn(`[Ikmal Tools] Active projects could not load: ${error}`);
                if (generation === dataGeneration) activeProjectCache = [];
            }).finally(() => {
                if (generation === dataGeneration) {
                    activeProjectPending = false;
                    if (mode === 'preview') refresh();
                }
            });
        }
        return false;
    }

    function renderActiveProjects(card: HTMLElement) {
        if (!ensureActiveProjectsLoaded(card)) return;
        const api = triliumApi();
        if (!activeProjectCache!.length) {
            card.appendChild(emptyState('No active projects.'));
            return;
        }
        for (const project of activeProjectCache!.slice(0, 8)) {
            const actions = api?.openTabWithNote
                ? [iconAction({
                        icon: 'bx-right-arrow-alt',
                        title: `Open ${project.title}`,
                        onClick: () => api.openTabWithNote(project.dashboardId || project.id, true),
                })]
                : undefined;
            card.appendChild(listItem({
                icon: 'bx-book',
                title: project.title,
                description: `${project.kind} · ${project.status}`,
                actions,
            }));
        }
    }

    /** Renders a loading placeholder and kicks off the fetch if needed; returns whether the cache is ready to read. */
    function ensureTasksLoaded(card: HTMLElement): boolean {
        if (taskCache) return true;

        card.appendChild(emptyState('Loading…'));
        if (!taskPending) {
            const generation = dataGeneration;
            taskPending = true;
            loadTasks().then((tasks) => {
                if (generation === dataGeneration) taskCache = tasks;
            }).catch((error) => {
                console.warn(`[Ikmal Tools] Tasks could not load: ${error}`);
                if (generation === dataGeneration) taskCache = [];
            }).finally(() => {
                if (generation === dataGeneration) {
                    taskPending = false;
                    if (mode === 'preview') refresh();
                }
            });
        }
        return false;
    }

    async function loadWordsWrittenToday(): Promise<number> {
        const api = triliumApi();
        if (!api) return 340; // representative sample outside Trilium, where there is no real content to measure

        const notes = await api.searchForNotes('#extStoryDraft OR #extEmailDraft OR #extScratch');
        const todayKey = new Date().toDateString();
        let total = 0;
        for (const note of notes) {
            const modified = parseTriliumTimestamp(note.dateModified);
            if (!Number.isFinite(modified) || new Date(modified).toDateString() !== todayKey) continue;
            const content = typeof note.getContent === 'function' ? await note.getContent() : '';
            total += countWords(content ?? '');
        }
        return total;
    }

    function heatmapLevel(count: number): number {
        if (count <= 0) return 0;
        if (count === 1) return 1;
        if (count <= 3) return 2;
        if (count <= 5) return 3;
        return 4;
    }

    function renderHeatmapWidget(card: HTMLElement) {
        if (!ensureNoteSummariesLoaded(card)) return;

        const timestamps = noteSummaryCache!.map((n) => n.dateCreated).filter((t) => Number.isFinite(t));
        if (!timestamps.length) {
            card.appendChild(emptyState('No notes created yet.'));
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'ns-heatmap';
        for (const week of buildActivityHeatmap(timestamps, new Date(), 12)) {
            const col = document.createElement('div');
            col.className = 'ns-heatmap-week';
            for (const dayCell of week.days) {
                const cell = document.createElement('div');
                cell.className = `ns-heatmap-day level-${heatmapLevel(dayCell.count)}`;
                cell.title = `${dayCell.date}: ${dayCell.count} note${dayCell.count === 1 ? '' : 's'}`;
                col.appendChild(cell);
            }
            grid.appendChild(col);
        }
        card.appendChild(grid);
    }

    function renderOnThisDayWidget(card: HTMLElement) {
        if (!ensureNoteSummariesLoaded(card)) return;

        const results = findOnThisDay(noteSummaryCache!, new Date());
        if (!results.length) {
            card.appendChild(emptyState('Nothing from this day in previous years.'));
            return;
        }
        for (const entry of results) {
            card.appendChild(listItem({
                title: entry.title,
                description: `${entry.yearsAgo} year${entry.yearsAgo === 1 ? '' : 's'} ago today`,
                actions: [
                    iconAction({
                        icon: 'bx-show',
                        title: 'Open Note',
                        onClick: () => {
                            const api = (globalThis as any).api;
                            if (api?.activateNote) api.activateNote(entry.noteId);
                        },
                    }),
                ],
            }));
        }
    }

    function renderStaleNotesWidget(card: HTMLElement) {
        if (!ensureNoteSummariesLoaded(card)) return;

        const threshold = settingsEngine?.get('staleThresholdDays') ?? todayEngine.getLayout().staleThresholdDays ?? 14;
        const stale = findStaleNotes(noteSummaryCache!, new Date(), threshold);
        if (!stale.length) {
            card.appendChild(emptyState('Nothing has gone stale.'));
            return;
        }
        for (const entry of stale.slice(0, 8)) {
            card.appendChild(listItem({
                title: entry.title,
                description: `Untouched for ${entry.daysSinceModified} days`,
                actions: [
                    iconAction({
                        icon: 'bx-show',
                        title: 'Open Note',
                        onClick: () => {
                            const api = (globalThis as any).api;
                            if (api?.activateNote) api.activateNote(entry.noteId);
                        },
                    }),
                    iconAction({
                        icon: 'bx-check-double',
                        title: 'Mark Touched',
                        onClick: () => {
                            const frontendApi = (globalThis as any).api;
                            if (frontendApi?.runOnBackend) {
                                // The closure is serialised and re-parsed on the
                                // backend, where `api` is an injected scoped
                                // variable. Capturing the frontend handle here
                                // would bundle to a renamed local that does not
                                // exist backend-side.
                                frontendApi.runOnBackend((id: string) => {
                                    const n = api.getNote?.(id);
                                    if (n) n.touch?.();
                                }, [entry.noteId]);
                            }
                        },
                    }),
                ],
            }));
        }
    }

    function renderWritingGoalWidget(card: HTMLElement) {
        const quote = pickDailyQuote(new Date());
        const quoteEl = document.createElement('blockquote');
        quoteEl.className = 'ns-quote';
        quoteEl.innerHTML = `<p>&ldquo;${escapeHtml(quote.text)}&rdquo;</p><cite>&mdash; ${escapeHtml(quote.author)}</cite>`;
        card.appendChild(quoteEl);

        if (wordsTodayCache === null) {
            card.appendChild(emptyState('Loading progress…'));
            if (!wordsTodayPending) {
                const generation = dataGeneration;
                wordsTodayPending = true;
                loadWordsWrittenToday()
                    .then((count) => { if (generation === dataGeneration) wordsTodayCache = count; })
                    .catch((error) => {
                        console.warn(`[Ikmal Tools] Writing progress could not load: ${error}`);
                        if (generation === dataGeneration) wordsTodayCache = 0;
                    })
                    .finally(() => {
                        if (generation === dataGeneration) {
                            wordsTodayPending = false;
                            if (mode === 'preview') refresh();
                        }
                    });
            }
            return;
        }

        const goal = settingsEngine?.get('writingGoalWords') ?? todayEngine.getLayout().writingGoalWords ?? 500;
        const progress = computeWritingGoalProgress(wordsTodayCache, goal);

        const bar = document.createElement('div');
        bar.className = 'ns-progress';
        bar.innerHTML = `<div class="ns-progress-fill" style="width: ${progress.percent}%"></div>`;
        card.appendChild(bar);

        const label = document.createElement('div');
        label.className = 'ns-meta ns-progress-label';
        label.textContent = progress.metGoal
            ? `${progress.current} / ${progress.goal} words — goal met!`
            : `${progress.current} / ${progress.goal} words (${progress.remaining} to go)`;
        card.appendChild(label);
    }

    function renderMoonPhaseWidget(card: HTMLElement) {
        const phase = computeMoonPhase(new Date());

        const phaseRow = document.createElement('div');
        phaseRow.className = 'ns-weather-now';
        phaseRow.innerHTML = `
            <span class="ns-weather-icon bx bx-moon" aria-hidden="true"></span>
            <div>
                <div class="ns-weather-temp">${escapeHtml(phase.name)}</div>
                <div class="ns-meta">${Math.round(phase.illumination * 100)}% illuminated</div>
            </div>
        `;
        card.appendChild(phaseRow);

        const weather = todayEngine.getLayout().weather;
        if (!hasLocation(weather)) {
            const hint = document.createElement('div');
            hint.className = 'ns-meta ns-progress-label';
            hint.textContent = 'Set a location under Weather to also show sunrise, sunset, and daylight.';
            card.appendChild(hint);
            return;
        }

        const key = `${weather.latitude},${weather.longitude},${weather.units}`;
        if (weatherCache?.key === key) {
            card.appendChild(daylightRow(weatherCache.report));
            return;
        }

        if (weatherError) {
            const hint = document.createElement('div');
            hint.className = 'ns-meta ns-progress-label';
            hint.textContent = 'Daylight unavailable — see the Weather widget for details.';
            card.appendChild(hint);
            return;
        }

        card.appendChild(emptyState('Loading daylight…'));
        if (weatherPending) return;
        weatherPending = true;
        weatherRequestKey = key;
        fetchWeather(weather)
            .then((report) => {
                const currentWeather = todayEngine.getLayout().weather ?? weather;
                const currentKey = `${currentWeather.latitude},${currentWeather.longitude},${currentWeather.units}`;
                if (weatherRequestKey === key && currentKey === key) {
                    weatherCache = { key, report };
                    weatherError = '';
                }
            })
            .catch((err: Error) => { if (weatherRequestKey === key) weatherError = `Could not load daylight: ${err.message}`; })
            .finally(() => {
                weatherPending = false;
                if (mode === 'preview') refresh();
            });
    }

    function daylightRow(report: WeatherReport): HTMLElement {
        const el = document.createElement('div');
        el.className = 'ns-meta ns-progress-label';
        if (!report.sunrise || !report.sunset) {
            el.textContent = 'Daylight data unavailable for this location.';
            return el;
        }
        el.innerHTML = `Sunrise ${formatClockTime(report.sunrise)} &middot; Sunset ${formatClockTime(report.sunset)}` +
            (report.daylightSeconds ? ` &middot; ${formatDaylight(report.daylightSeconds)} of daylight` : '');
        return el;
    }

    function formatClockTime(isoLocal: string): string {
        const date = new Date(isoLocal);
        if (Number.isNaN(date.getTime())) return isoLocal;
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    function formatDaylight(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    // -------------------------------------------------------------- dashboard

    function renderDashboard(parent: HTMLElement) {
        const layout = todayEngine.getLayout();

        if (showJournalCard) {
            renderJournalCard(parent);
        }

        if (layout.showQuickCaptureBar) {
            renderQuickCapture(parent);
        }

        const filterRow = document.createElement('div');
        filterRow.className = 'ns-filter-row mb-3';
        filterRow.innerHTML = `
            <div class="input-group input-group-sm">
                <span class="input-group-text bg-transparent border-end-0"><i class="bx bx-search text-muted"></i></span>
                <input type="text" class="form-control form-control-sm border-start-0 today-dashboard-filter" placeholder="Filter tasks, projects, and notes on today's homepage…">
            </div>
        `;
        filterRow.querySelector('input')?.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
            const items = parent.querySelectorAll('.ns-kanban-card, .ns-list-item, .ns-row, tr');
            items.forEach((item) => {
                const text = item.textContent?.toLowerCase() || '';
                (item as HTMLElement).style.display = !query || text.includes(query) ? '' : 'none';
            });
        });
        parent.appendChild(filterRow);

        const widgets = todayEngine.getVisibleWidgets()
            .filter((widget) => showOpenTasks || widget.id !== 'openTasks');
        if (!widgets.length) {
            const { card } = section(parent, { title: 'Dashboard' });
            card.appendChild(emptyState('No widgets are shown. Switch to Edit to turn some on.'));
            return;
        }

        const grid = document.createElement('div');
        grid.className = `ns-grid ${layout.columns === 'auto' || layout.columns === undefined ? 'ns-grid-auto' : `ns-cols-${layout.columns}`}`;

        for (const widget of widgets) {
            const { section: sec, card } = section(grid, {
                title: widget.title,
                actions: widget.actionType
                    ? [iconAction({
                        icon: 'bx-plus',
                        title: widget.actionLabel || `New ${widget.title}`,
                        onClick: () => onQuickCapture(widget.actionType!),
                    })]
                    : undefined,
            });

            if (widget.colSpan === 2) sec.classList.add('ns-span-2');
            if (widget.colSpan === 3) sec.classList.add('ns-span-full');

            if (widget.id === 'openTasks') {
                renderKanban(card);
            } else if (widget.id === 'activeProjects') {
                renderActiveProjects(card);
            } else if (widget.id === 'weather') {
                renderWeatherWidget(card);
            } else if (widget.id === 'activityHeatmap') {
                renderHeatmapWidget(card);
            } else if (widget.id === 'onThisDay') {
                renderOnThisDayWidget(card);
            } else if (widget.id === 'writingGoal') {
                renderWritingGoalWidget(card);
            } else if (widget.id === 'moonPhase') {
                renderMoonPhaseWidget(card);
            } else if (widget.id === 'staleNotes') {
                renderStaleNotesWidget(card);
            } else {
                card.appendChild(emptyState(widget.emptyMessage));
            }
        }

        parent.appendChild(grid);
    }

    function renderJournalCard(parent: HTMLElement) {
        const { section: journalSection, card } = section(parent);
        journalSection.classList.add('ns-journal-section');
        card.classList.add('ns-journal-card');

        const api = triliumApi();
        if (!api?.getTodayNote) {
            card.appendChild(emptyState('Open this page inside Trilium to access today’s journal.'));
            return;
        }

        const loading = emptyState('Loading today’s journal…');
        card.appendChild(loading);
        api.getTodayNote().then((note: any) => {
            loading.remove();
            const entry = document.createElement('div');
            entry.className = 'ns-journal-entry';
            const title = document.createElement('div');
            title.className = 'ns-journal-date';
            title.textContent = note?.title || 'Today’s journal';
            const hint = document.createElement('div');
            hint.className = 'ns-meta';
            hint.textContent = 'Keep this page pinned; the button opens the editable day note in a split.';
            const open = button({
                text: 'Open Today’s Journal',
                icon: 'bx-edit-alt',
                onClick: () => openJournalNote(api, note.noteId),
            });
            open.classList.add('ns-journal-open');
            const actions = document.createElement('div');
            actions.className = 'ns-actions';
            actions.appendChild(open);
            if (api.getDayNote) {
                actions.appendChild(button({
                    text: 'Plan for Tomorrow',
                    icon: 'bx-calendar-plus',
                    onClick: async () => {
                        const tomorrow = tomorrowDateIso(api);
                        const tomorrowNote = await api.getDayNote(tomorrow);
                        if (!tomorrowNote?.noteId) throw new Error('Trilium did not return tomorrow’s journal note.');
                        await openJournalNote(api, tomorrowNote.noteId);
                    },
                }));
            }
            entry.append(title, hint, actions);
            card.appendChild(entry);
        }).catch((error: Error) => {
            loading.textContent = `Today’s journal is unavailable: ${error.message}`;
        });
    }

    function tomorrowDateIso(api: any): string {
        if (typeof api?.dayjs === 'function') {
            return api.dayjs().add(1, 'day').format('YYYY-MM-DD');
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const year = tomorrow.getFullYear();
        const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const day = String(tomorrow.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function contextNoteId(context: any): string | null {
        return context?.note?.noteId || context?.noteId || null;
    }

    function isDailyContext(context: any): boolean {
        const note = context?.note;
        return Boolean(note?.hasLabel?.('dateNote')
            || note?.getLabelValue?.('dateNote')
            || note?.getOwnedLabelValue?.('dateNote'));
    }

    function splitPair(): { todaySplit: HTMLElement; journalSplit: HTMLElement; parent: HTMLElement } | null {
        const todaySplit = container.closest('.note-split') as HTMLElement | null;
        const journalNtxId = journalContext?.ntxId;
        if (!todaySplit || !journalNtxId || !todaySplit.parentElement) return null;

        const parent = todaySplit.parentElement;
        const journalSplit = [...parent.children].find((element) =>
            element instanceof HTMLElement
            && element.classList.contains('note-split')
            && element.getAttribute('data-ntx-id') === journalNtxId,
        ) as HTMLElement | undefined;
        return journalSplit ? { todaySplit, journalSplit, parent } : null;
    }

    function applyJournalWidth(): boolean {
        const pair = splitPair();
        if (!pair) return false;

        const width = Math.min(85, Math.max(35, Math.round(todayEngine.getLayout().journalWidthPercent)));
        pair.todaySplit.style.width = `${100 - width}%`;
        pair.journalSplit.style.width = `${width}%`;
        return true;
    }

    function scheduleJournalWidth(api?: any, noteId?: string) {
        for (const timer of splitWidthTimers) window.clearTimeout(timer);
        splitWidthTimers = [];
        const apply = () => {
            if (api && noteId) {
                const context = findExactJournalContext(api, noteId);
                if (context) journalContext = context;
            }
            applyJournalWidth();
        };
        window.requestAnimationFrame(() => {
            apply();
            for (const delay of [50, 150, 350, 750, 1500]) {
                splitWidthTimers.push(window.setTimeout(apply, delay));
            }
        });
    }

    function findExactJournalContext(api: any, noteId: string): any {
        const contexts = typeof api.getNoteContexts === 'function' ? api.getNoteContexts() : [];
        return contexts.find((context: any) => contextNoteId(context) === noteId);
    }

    async function openJournalNote(api: any, noteId: string): Promise<void> {
        if (!api?.openSplitWithNote) return;
        if (journalOpenPromise) return journalOpenPromise;

        journalOpenPromise = (async () => {
            let context = findExactJournalContext(api, noteId);
            if (!context && journalContext && typeof journalContext.setNote === 'function') {
                context = await journalContext.setNote(noteId);
            }
            if (!context) {
                const contexts = typeof api.getNoteContexts === 'function' ? api.getNoteContexts() : [];
                const existingDailyContext = contexts.find((candidate: any) => isDailyContext(candidate));
                if (existingDailyContext && typeof existingDailyContext.setNote === 'function') {
                    context = await existingDailyContext.setNote(noteId);
                }
            }

            if (!context) {
                await api.openSplitWithNote(noteId, true);
                context = findExactJournalContext(api, noteId);
            }

            if (context) journalContext = context;
            scheduleJournalWidth(api, noteId);
        })().finally(() => {
            journalOpenPromise = null;
        });

        await journalOpenPromise;
    }

    function renderQuickCapture(parent: HTMLElement) {
        const { card } = section(parent, { title: 'Quick capture' });

        const actions = document.createElement('div');
        actions.className = 'ns-actions';
        for (const action of TODAY_QUICK_CAPTURE_ACTIONS) {
            actions.appendChild(button({
                text: action.label,
                icon: `bx-${action.icon}`,
                className: 'ns-quick-capture-action',
                title: action.title,
                onClick: () => onQuickCapture(action.type),
            }));
        }
        card.appendChild(actions);
    }

    function renderKanban(parent: HTMLElement) {
        if (!ensureTasksLoaded(parent)) return;

        const board = document.createElement('div');
        board.className = 'ns-kanban';

        for (const column of KANBAN_COLUMNS) {
            const tasks = taskCache!.filter((t) => t.status === column.id);

            const col = document.createElement('div');
            col.className = 'kanban-col';
            col.innerHTML = `
                <div class="ns-kanban-head">
                    <span>${escapeHtml(column.title)}</span>
                    <span class="ns-count">${tasks.length}</span>
                </div>
            `;

            const list = document.createElement('div');
            list.className = 'ns-stack';

            if (!tasks.length) {
                list.appendChild(emptyState('Nothing here.'));
            } else {
                for (const task of tasks) {
                    const card = document.createElement('div');
                    card.className = 'kanban-card';
                    card.innerHTML = `
                        <div>${escapeHtml(task.title)}</div>
                        <div class="ns-meta">${escapeHtml(task.project)} &middot; ${escapeHtml(task.priority)} priority</div>
                    `;
                    list.appendChild(card);
                }
            }

            col.appendChild(list);
            board.appendChild(col);
        }

        parent.appendChild(board);
    }

    refresh();
    return () => {
        // A successful quick capture changes several widgets at once (active
        // projects, stories, recent activity, and today's journal). Clear the
        // memoized searches before repainting so the page does not look stale
        // until the user hard-refreshes Trilium.
        dataGeneration += 1;
        noteSummaryPending = false;
        taskPending = false;
        activeProjectPending = false;
        wordsTodayPending = false;
        noteSummaryCache = null;
        taskCache = null;
        activeProjectCache = null;
        wordsTodayCache = null;
        refresh();
    };
}

export interface TodayHomepageOptions {
    /** The Trilium script API is scoped to the render invocation, not window.api. */
    api?: any;
    /** Let Trilium's ordinary note title bar provide the page title. */
    showHeader?: boolean;
    /** Hide the layout editor controls when this is presented as the visible Today page. */
    showEditor?: boolean;
    /** Add the current-day journal entry point above the dashboard widgets. */
    showJournalCard?: boolean;
    /** Keep the editable workspace dashboard's task board out of the focused Today page. */
    showOpenTasks?: boolean;
    title?: string;
    subtitle?: string;
}
