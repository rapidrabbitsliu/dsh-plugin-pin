import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkspacePins, reconcileBase } from '../core.js';

function fixture(ids = ['a', 'b', 'c']) {
  let order = [...ids];
  let state = { pinnedIds: [], baseOrder: [] };
  let closed = false;
  let fail = false;
  let pins;
  const domain = { global: { get: () => state, set: async value => { state = structuredClone(value); } }, close: async () => { closed = true; } };
  const registry = {
    list: () => order.map(id => ({ id, title: id })),
    insertBefore: async (id, before) => {
      if (fail) throw new Error('disk failed');
      order = order.filter(key => key !== id);
      order.splice(before === undefined ? order.length : order.indexOf(before), 0, id);
      pins.changed();
      return order;
    },
  };
  pins = new WorkspacePins({ domain, registry, onError: () => {} });
  return { pins, domain, registry, order: () => order, setOrder: value => { order = value; }, fail: value => { fail = value; }, closed: () => closed };
}

test('latest pin leads, idempotent pin stays, unpin restores ordinary order', async () => {
  const f = fixture();
  await f.pins.enqueue(() => f.pins.reconcile());
  await f.pins.execute({ action: 'pin', workspaceId: 'c' });
  assert.deepEqual(f.order(), ['c', 'a', 'b']);
  await f.pins.execute({ action: 'pin', workspaceId: 'b' });
  assert.deepEqual(f.order(), ['b', 'c', 'a']);
  await f.pins.execute({ action: 'pin', workspaceId: 'c' });
  assert.deepEqual(f.order(), ['b', 'c', 'a']);
  await f.pins.execute({ action: 'unpin', workspaceId: 'c' });
  assert.deepEqual(f.order(), ['b', 'a', 'c']);
  await f.pins.execute({ action: 'unpin', workspaceId: 'b' });
  assert.deepEqual(f.order(), ['a', 'b', 'c']);
  await f.pins.execute({ action: 'pin', workspaceId: 'c' });
  assert.deepEqual(f.pins.snapshot().pinnedIds, ['c']);
});

test('native ordinary reorders survive pin enforcement and unpin', async () => {
  const f = fixture(['a', 'b', 'c', 'd']);
  await f.pins.execute({ action: 'pin', workspaceId: 'b' });
  f.setOrder(['d', 'b', 'c', 'a']);
  await f.pins.enqueue(() => f.pins.reconcile());
  assert.deepEqual(f.order(), ['b', 'd', 'c', 'a']);
  await f.pins.execute({ action: 'unpin', workspaceId: 'b' });
  assert.deepEqual(f.order(), ['d', 'b', 'c', 'a']);
});

test('new and deleted workspaces reconcile without lost IDs or loops', async () => {
  const f = fixture();
  await f.pins.execute({ action: 'pin', workspaceId: 'c' });
  f.setOrder(['new', 'c', 'a', 'b']);
  f.pins.changed(); f.pins.changed();
  await f.pins.tail;
  assert.deepEqual(f.order(), ['c', 'new', 'a', 'b']);
  f.setOrder(['new', 'a', 'b']);
  await f.pins.enqueue(() => f.pins.reconcile());
  assert.deepEqual(f.pins.snapshot().pinnedIds, []);
});

test('failures remain explicit, intent durable and subsequent retry works', async () => {
  const f = fixture();
  f.fail(true);
  await assert.rejects(f.pins.execute({ action: 'pin', workspaceId: 'c' }), /disk failed/);
  assert.deepEqual(f.pins.snapshot().pinnedIds, ['c']);
  assert.equal(f.pins.snapshot().error, 'disk failed');
  f.fail(false);
  await f.pins.execute({ action: 'pin', workspaceId: 'c' });
  assert.deepEqual(f.order(), ['c', 'a', 'b']);
  assert.equal(f.pins.snapshot().error, null);
});

test('restart keeps pins and close drains and rejects new writes', async () => {
  const f = fixture();
  await f.pins.execute({ action: 'pin', workspaceId: 'b' });
  const restored = new WorkspacePins({ domain: f.domain, registry: f.registry });
  await restored.enqueue(() => restored.reconcile());
  assert.deepEqual(restored.snapshot().pinnedIds, ['b']);
  await f.pins.close();
  assert.equal(f.closed(), true);
  await assert.rejects(f.pins.execute({ action: 'list' }), /stopping/);
});

test('concurrent requests serialize; invalid inputs change nothing', async () => {
  const f = fixture();
  await Promise.all(['b', 'c'].map(workspaceId => f.pins.execute({ action: 'pin', workspaceId })));
  assert.deepEqual(f.order(), ['c', 'b', 'a']);
  for (const input of [{ action: 'toggle' }, { action: 'pin' }, { action: 'pin', workspaceId: 'missing' }]) await assert.rejects(f.pins.execute(input));
  assert.deepEqual(f.order(), ['c', 'b', 'a']);
});

test('base reconciliation is stable for removals and empty pins', () => {
  assert.deepEqual(reconcileBase(['a', 'b'], ['x', 'b'], []), ['x', 'b']);
  assert.deepEqual(reconcileBase(['a', 'b', 'c'], ['c', 'b'], ['c']), ['b', 'c']);
});
