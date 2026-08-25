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

    const clockSetBack = { ...previous, wallClockMs: previous.wallClockMs - 60 * 60 * 1000, monotonicMs: previous.monotonicMs + 1000 };
    assert.equal(detectTodayClockChange(previous, clockSetBack), 'clock-change');
});

test('Today rollover treats a suspended machine as a quiet tick, not a clock change', () => {
    // performance.now() stops with the machine, so every wake from sleep leaves
    // the wall clock hours ahead of the monotonic one. Repainting on that would
    // drop scroll position and any open editor on a date that never rolled.
    const previous = snapshotTodayClock(new Date(2026, 7, 12, 13, 0), 5000);
    const wokeSameDay = snapshotTodayClock(new Date(2026, 7, 12, 17, 0), 5100);
    assert.equal(detectTodayClockChange(previous, wokeSameDay), null);

    const wokeNextDay = snapshotTodayClock(new Date(2026, 7, 13, 9, 0), 5100);
    assert.equal(detectTodayClockChange(previous, wokeNextDay), 'date-change');
});

test('Today rollover keeps its timer chain armed when the handler throws', () => {
    // The handler is a full page repaint; one failed Trilium search inside it
    // must not leave the render unable to roll over for the rest of the session.
    let now = new Date(2026, 7, 12, 23, 30);
    const timers = [];
    const attempts = [];
    startTodayRolloverMonitor((reason) => {
        attempts.push(reason);
        throw new Error('render failed');
    }, {
        now: () => now,
        monotonicNow: () => 0,
        setTimeout: (handler, timeout) => {
            timers.push({ handler, timeout });
            return timers.length;
        },
        clearTimeout: () => {},
    });

    now = new Date(2026, 7, 13, 0, 1);
    assert.doesNotThrow(() => timers[0].handler());
    assert.deepEqual(attempts, ['date-change']);
    assert.equal(timers.length, 2, 'a throwing handler still re-arms the chain');

    now = new Date(2026, 7, 14, 0, 1);
    timers[1].handler();
    assert.deepEqual(attempts, ['date-change', 'date-change'], 'the next day still rolls over');
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

test('Today rollover stops rescheduling once its owner reports it is gone', () => {
    // A quiet tick never reaches the rollover handler, so a monitor that only
    // checked liveness there would re-arm forever behind a discarded render.
    let alive = true;
    const timers = [];
    const changes = [];
    const now = new Date(2026, 7, 12, 12, 0);
    startTodayRolloverMonitor((reason) => changes.push(reason), {
        now: () => now,
        monotonicNow: () => 0,
        shouldContinue: () => alive,
        setTimeout: (handler, timeout) => {
            timers.push({ handler, timeout });
            return timers.length;
        },
        clearTimeout: (timer) => { timers[timer - 1].cleared = true; },
    });

    assert.equal(timers.length, 1);
    timers[0].handler();
    assert.equal(timers.length, 2, 'a live owner keeps the chain armed');
    assert.deepEqual(changes, [], 'an unchanged clock does not trigger a rollover');

    alive = false;
    timers[1].handler();
    assert.equal(timers.length, 2, 'a detached owner schedules nothing further');
    assert.deepEqual(changes, []);
});
