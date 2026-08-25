/**
 * Today Engine: Grid layout state, widget configuration, and section provider for the Today Homepage
 */

import { TodayWidgetConfig, TodayLayoutConfig, DashboardColumns, DashboardDensity, WeatherConfig } from './types.js';

/**
 * Off by default: showing it calls out to open-meteo.com, which is the user's
 * choice to make rather than something the dashboard starts doing on its own.
 */
export const DEFAULT_WEATHER: WeatherConfig = {
    label: '',
    latitude: 0,
    longitude: 0,
    units: 'metric',
};

export const DEFAULT_TODAY_WIDGETS: TodayWidgetConfig[] = [
    {
        id: 'weather',
        title: 'Weather',
        marker: 'weather',
        visible: false,
        order: 0,
        colSpan: 1,
        columns: [],
        emptyMessage: 'Set a location to show the local forecast.',
    },
    {
        id: 'openTasks',
        title: 'Open Tasks',
        marker: 'openTasks',
        visible: true,
        order: 1,
        colSpan: 2,
        columns: [['Due', 'dueDate'], ['Priority', 'priority'], ['Project', 'project']],
        emptyMessage: 'No open tasks. All caught up!',
        actionType: 'task',
        actionLabel: 'New Task',
    },
    {
        id: 'overdue',
        title: 'Overdue Work',
        marker: 'overdue',
        visible: true,
        order: 2,
        colSpan: 1,
        columns: [['Due', 'dueDate'], ['Priority', 'priority'], ['Project', 'project']],
        emptyMessage: 'No overdue tasks.',
        actionType: 'task',
        actionLabel: 'New Task',
    },
    {
        id: 'dueSoon',
        title: 'Due Soon',
        marker: 'dueSoon',
        visible: true,
        order: 3,
        colSpan: 1,
        columns: [['Due', 'dueDate'], ['Priority', 'priority'], ['Project', 'project']],
        emptyMessage: 'No tasks due soon.',
        actionType: 'task',
        actionLabel: 'New Task',
    },
    {
        id: 'activeProjects',
        title: 'Active Projects',
        marker: 'activeProjects',
        visible: true,
        order: 4,
        colSpan: 1,
        columns: [['Kind', 'kind'], ['Status', 'status']],
        emptyMessage: 'No active projects.',
        actionType: 'projectHub',
        actionLabel: 'New Project',
    },
    {
        id: 'highPriority',
        title: 'High Priority',
        marker: 'highPriority',
        visible: true,
        order: 5,
        colSpan: 1,
        columns: [['Priority', 'priority'], ['Due', 'dueDate'], ['Project', 'project']],
        emptyMessage: 'No unfinished high-priority work.',
        actionType: 'task',
        actionLabel: 'New Task',
    },
    {
        id: 'followUpsDue',
        title: 'Follow-ups & Replies',
        marker: 'followUpsDue',
        visible: true,
        order: 6,
        colSpan: 1,
        columns: [['Follow-up', 'followUpDate'], ['Waiting on', 'waitingOn']],
        emptyMessage: 'No follow-ups due soon.',
        actionType: 'email',
        actionLabel: 'New Email',
    },
    {
        id: 'openDrafts',
        title: 'Stories & Drafts',
        marker: 'openDrafts',
        visible: true,
        order: 7,
        colSpan: 1,
        columns: [['Status', 'status'], ['Round', 'round'], ['Project', 'project']],
        emptyMessage: 'No open drafts.',
        actionType: 'story',
        actionLabel: 'New Story',
    },
    {
        id: 'recentlyTouched',
        title: 'Recently Touched',
        marker: 'recentlyTouched',
        visible: true,
        order: 8,
        colSpan: 2,
        columns: [['Kind', 'kind'], ['Status', 'status'], ['Project', 'project']],
        emptyMessage: 'Nothing touched in the last seven days.',
    },
    {
        id: 'activityHeatmap',
        title: 'Activity',
        marker: 'activityHeatmap',
        visible: false,
        order: 9,
        colSpan: 3,
        columns: [],
        emptyMessage: 'No notes created yet.',
    },
    {
        id: 'onThisDay',
        title: 'On This Day',
        marker: 'onThisDay',
        visible: false,
        order: 10,
        colSpan: 1,
        columns: [],
        emptyMessage: 'Nothing from this day in previous years.',
    },
    {
        id: 'writingGoal',
        title: 'Writing Goal',
        marker: 'writingGoal',
        visible: false,
        order: 11,
        colSpan: 1,
        columns: [],
        emptyMessage: 'Set a daily word goal under Layout to track progress.',
    },
    {
        id: 'moonPhase',
        title: 'Moon & Daylight',
        marker: 'moonPhase',
        visible: false,
        order: 12,
        colSpan: 1,
        columns: [],
        emptyMessage: 'Set a location under Weather to show sunrise, sunset, and daylight.',
    },
    {
        id: 'staleNotes',
        title: 'Needs Attention',
        marker: 'staleNotes',
        visible: false,
        order: 13,
        colSpan: 1,
        columns: [],
        emptyMessage: 'Nothing has gone stale.',
    },
];

export class TodayEngine {
    private layout: TodayLayoutConfig;

    constructor(initialLayout?: TodayLayoutConfig) {
        const base: TodayLayoutConfig = initialLayout ?? {
            journalWidthPercent: 65,
            showQuickCaptureBar: true,
            widgets: JSON.parse(JSON.stringify(DEFAULT_TODAY_WIDGETS)),
        };

        // Fill in anything a layout saved by an older version is missing, so an
        // existing YAML specification keeps loading.
        this.layout = {
            ...base,
            columns: base.columns ?? 'auto',
            density: base.density ?? 'comfortable',
            weather: { ...DEFAULT_WEATHER, ...(base.weather ?? {}) },
            writingGoalWords: base.writingGoalWords ?? 500,
            staleThresholdDays: base.staleThresholdDays ?? 14,
        };
    }

    public getLayout(): TodayLayoutConfig {
        return JSON.parse(JSON.stringify(this.layout));
    }

    public getVisibleWidgets(): TodayWidgetConfig[] {
        return this.layout.widgets
            .filter(w => w.visible)
            .sort((a, b) => a.order - b.order);
    }

    public toggleWidgetVisibility(widgetId: string, visible?: boolean): TodayLayoutConfig {
        const widget = this.layout.widgets.find(w => w.id === widgetId);
        if (widget) {
            widget.visible = visible !== undefined ? visible : !widget.visible;
        }
        return this.getLayout();
    }

    public reorderWidgets(orderedIds: string[]): TodayLayoutConfig {
        orderedIds.forEach((id, index) => {
            const widget = this.layout.widgets.find(w => w.id === id);
            if (widget) {
                widget.order = index + 1;
            }
        });
        return this.getLayout();
    }

    public setColumns(columns: DashboardColumns): TodayLayoutConfig {
        this.layout.columns = columns;
        return this.getLayout();
    }

    public setDensity(density: DashboardDensity): TodayLayoutConfig {
        this.layout.density = density;
        return this.getLayout();
    }

    public setWeather(updates: Partial<WeatherConfig>): TodayLayoutConfig {
        this.layout.weather = { ...DEFAULT_WEATHER, ...this.layout.weather, ...updates };
        return this.getLayout();
    }

    public setQuickCaptureBar(visible: boolean): TodayLayoutConfig {
        this.layout.showQuickCaptureBar = visible;
        return this.getLayout();
    }

    public setJournalWidth(percent: number): TodayLayoutConfig {
        this.layout.journalWidthPercent = Number.isFinite(percent) ? Math.min(85, Math.max(35, percent)) : 65;
        return this.getLayout();
    }

    public setWritingGoalWords(words: number): TodayLayoutConfig {
        this.layout.writingGoalWords = Math.max(0, Math.round(words) || 0);
        return this.getLayout();
    }

    public setStaleThresholdDays(days: number): TodayLayoutConfig {
        this.layout.staleThresholdDays = Math.max(1, Math.round(days) || 1);
        return this.getLayout();
    }

    public updateWidget(widgetId: string, updates: Partial<TodayWidgetConfig>): TodayLayoutConfig {
        const widget = this.layout.widgets.find(w => w.id === widgetId);
        if (widget) {
            Object.assign(widget, updates);
        }
        return this.getLayout();
    }
}
