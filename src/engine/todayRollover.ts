/**
 * Keeps a long-lived Today render note aligned with the user's local clock.
 *
 * The next midnight is calculated from the current Date each time rather than
 * assuming a fixed 24-hour interval. A one-hour cap also lets us notice travel
 * between time zones and manual system-clock changes before the old midnight
 * deadline is reached.
 */

export type TodayRolloverReason = 'date-change' | 'timezone-change' | 'clock-change';

export interface TodayClockSnapshot {
    dateKey: string;
    timezoneKey: string;
    wallClockMs: number;
    monotonicMs: number;
}

export interface TodayRolloverOptions {
    checkIntervalMs?: number;
    now?: () => Date;
    monotonicNow?: () => number;
    setTimeout?: (handler: () => void, timeout: number) => ReturnType<typeof globalThis.setTimeout>;
    clearTimeout?: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
}

export function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function localTimezoneKey(date: Date): string {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    return `${timezone}|offset=${date.getTimezoneOffset()}`;
}

export function snapshotTodayClock(date: Date, monotonicMs: number): TodayClockSnapshot {
    return {
        dateKey: localDateKey(date),
        timezoneKey: localTimezoneKey(date),
        wallClockMs: date.getTime(),
        monotonicMs,
    };
}

export function nextLocalMidnight(date: Date): Date {
    const next = new Date(date.getTime());
    next.setHours(24, 0, 0, 0);
    return next;
}

export function detectTodayClockChange(
    previous: TodayClockSnapshot,
    current: TodayClockSnapshot,
    driftToleranceMs = 5 * 60 * 1000,
): TodayRolloverReason | null {
    if (previous.dateKey !== current.dateKey) return 'date-change';
    if (previous.timezoneKey !== current.timezoneKey) return 'timezone-change';

    const wallDelta = current.wallClockMs - previous.wallClockMs;
    const monotonicDelta = current.monotonicMs - previous.monotonicMs;
    if (Math.abs(wallDelta - monotonicDelta) > driftToleranceMs) return 'clock-change';
    return null;
}

/** Starts monitoring and returns an idempotent stop function. */
export function startTodayRolloverMonitor(
    onRollover: (reason: TodayRolloverReason) => void,
    options: TodayRolloverOptions = {},
): () => void {
    const now = options.now || (() => new Date());
    const monotonicNow = options.monotonicNow || (() => globalThis.performance?.now?.() ?? Date.now());
    const setTimeoutFn = options.setTimeout || ((handler, timeout) => globalThis.setTimeout(handler, timeout));
    const clearTimeoutFn = options.clearTimeout || ((timer) => globalThis.clearTimeout(timer));
    const checkIntervalMs = Math.max(60_000, options.checkIntervalMs || 60 * 60 * 1000);
    let previous = snapshotTodayClock(now(), monotonicNow());
    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let stopped = false;

    const check = () => {
        if (stopped) return;

        const currentDate = now();
        const current = snapshotTodayClock(currentDate, monotonicNow());
        const reason = detectTodayClockChange(previous, current);
        previous = current;
        if (reason) onRollover(reason);

        schedule(currentDate);
    };

    const schedule = (currentDate: Date) => {
        if (stopped) return;
        const untilMidnight = Math.max(1_000, nextLocalMidnight(currentDate).getTime() - currentDate.getTime() + 250);
        const delay = Math.min(untilMidnight, checkIntervalMs);
        timer = setTimeoutFn(check, delay);
    };

    schedule(now());

    return () => {
        if (stopped) return;
        stopped = true;
        if (timer !== null) clearTimeoutFn(timer);
        timer = null;
    };
}
