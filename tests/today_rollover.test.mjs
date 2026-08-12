import test from 'node:test';
import assert from 'node:assert/strict';

import {
    detectTodayClockChange,
    localDateKey,
    nextLocalMidnight,
    snapshotTodayClock,
    startTodayRolloverMonitor,
} from '../dist/engine/todayRollover.js';

test('Today rollover calculates local date keys and the next local midnight', () => {
    const date = new Date(2026, 7, 12, 18, 30, 0, 0);
    assert.equal(localDateKey(date), '2026-08-12');
    assert.equal(nextLocalMidnight(date).getHours(), 0);
    assert.equal(localDateKey(nextLocalMidnight(date)), '2026-08-13');
});

test('Today rollover detects a date, timezone, and system-clock change', () => {
    const previous = snapshotTodayClock(new Date(2026, 7, 12, 23, 59), 1000);
    assert.equal(
        detectTodayClockChange(previous, snapshotTodayClock(new Date(2026, 7, 13, 0, 1), 3000)),
        'date-change',
    );

    const timezoneChanged = { ...previous, timezoneKey: `${previous.timezoneKey}-travelled` };
    assert.equal(detectTodayClockChange(previous, timezoneChanged), 'timezone-change');

    const clockJumped = { ...previous, wallClockMs: previous.wallClockMs + 60 * 60 * 1000, monotonicMs: previous.monotonicMs + 1000 };
    assert.equal(detectTodayClockChange(previous, clockJumped), 'clock-change');
});

test('Today rollover schedules the nearer of midnight and the hourly clock guard and can stop cleanly', () => {
    let now = new Date(2026, 7, 12, 23, 30);
    let monotonic = 0;
    const timers = [];
    const changes = [];
    const stop = startTodayRolloverMonitor((reason) => changes.push(reason), {
        now: () => now,
        monotonicNow: () => monotonic,
        setTimeout: (handler, timeout) => {
            timers.push({ handler, timeout });
            return timers.length;
        },
        clearTimeout: (timer) => { timers[timer - 1].cleared = true; },
    });

    assert.equal(timers.length, 1);
    assert.ok(timers[0].timeout < 60 * 60 * 1000);
    now = new Date(2026, 7, 13, 0, 1);
    monotonic += 31 * 60 * 1000;
    timers[0].handler();
    assert.deepEqual(changes, ['date-change']);

    stop();
    assert.equal(timers.at(-1).cleared, true);
    stop();
});
