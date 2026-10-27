import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, freshness, normalizeItem, reduceQuantity, useSoon, exportPayload } from '../dist/model.js';

const now = new Date('2026-10-28T12:00:00+05:00');
test('date calculations use local calendar days', () => { assert.equal(daysUntil('2026-10-29', now), 1); assert.equal(daysUntil('2026-10-27', now), -1); });
test('freshness distinguishes unknown, soon, and passed dates', () => { assert.equal(freshness({}, now).key, 'unknown'); assert.equal(freshness({ date: '2026-10-30' }, now).key, 'soon'); assert.equal(freshness({ date: '2026-10-20' }, now).key, 'passed'); });
test('use soon returns only available dated items in date order', () => { const items = [{ id:'a', status:'available', date:'2026-10-30' }, { id:'b', status:'consumed', date:'2026-10-28' }, { id:'c', status:'available', date:'2026-10-29' }, { id:'d', status:'available', date:'' }]; assert.deepEqual(useSoon(items, now).map((i) => i.id), ['c','a']); });
test('inventory normalization preserves explicit date source and fractional quantity', () => { const item = normalizeItem({ name:' Milk ', quantity:'0.5', unit:'L', dateSource:'estimated' }); assert.equal(item.name, 'Milk'); assert.equal(item.quantity, .5); assert.equal(item.dateSource, 'estimated'); });
test('inventory rejects missing names and invalid quantities', () => { assert.throws(() => normalizeItem({ name:'', quantity:1 }), /required/); assert.throws(() => normalizeItem({ name:'Rice', quantity:-1 }), /zero or greater/); });
test('partial use is precise and marks zero quantity consumed', () => { const item = { quantity:.3, status:'available' }; assert.equal(reduceQuantity(item, .1).quantity, .2); assert.equal(reduceQuantity(item, .3).status, 'consumed'); assert.throws(() => reduceQuantity(item, .4), /exceed/); });
test('export payload is versioned and retains application state', () => { const state = { profile:{ household:'Home' }, items:[] }; const out = exportPayload(state); assert.equal(out.format, 'freshloop-export'); assert.equal(out.version, 1); assert.equal(out.data, state); });
