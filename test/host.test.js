import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';

test('host registers authenticated route and shared tool, disposing contributions', async () => {
  const effects = [];
  const listeners = new Map();
  let route, tool;
  let state;
  let closed = false;
  let order = ['a', 'b'];
  const ctx = {
    storageDomain: { open: async spec => {
      assert.equal(spec.name, 'dsh_plugin_pin');
      state = spec.global.schema.parse(spec.global.initial);
      return { global: { get: () => state, set: async value => { state = spec.global.schema.parse(value); } }, close: async () => { closed = true; } };
    } },
    workspaceRegistry: { list: () => order.map(id => ({ id, title: id })), insertBefore: async (id, anchor) => {
      order = order.filter(key => key !== id);
      order.splice(anchor === undefined ? order.length : order.indexOf(anchor), 0, id);
    } },
    effect: setup => { const dispose = setup(); effects.push(dispose); return dispose; },
    on: (name, fn) => { listeners.set(name, fn); },
    connection: { fetch: { register: spec => { if (spec.path === '/api/plugin-workspace-pin') route = spec; return () => { if (spec.path === '/api/plugin-workspace-pin') route = null; }; } } },
    tools: { register: spec => { tool = spec; return () => { tool = null; }; } },
  };
  await apply(ctx);
  assert.equal(route.path, '/api/plugin-workspace-pin');
  assert.ok(listeners.has('domain/changed'));
  let response = await route.fetch(new Request('http://localhost/api/plugin-workspace-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pin', workspaceId: 'b' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).value.pinnedIds, ['b']);
  assert.deepEqual((await tool.execute({ action: 'list' })).pinnedIds, ['b']);
  await tool.execute({ action: 'unpin', workspaceId: 'b' });
  assert.deepEqual(order, ['a', 'b']);
  response = await route.fetch(new Request('http://localhost/api/plugin-workspace-pin', { method: 'POST', body: '{' }));
  assert.equal(response.status, 400);
  for (const dispose of effects.reverse()) await dispose();
  assert.equal(route, null);
  assert.equal(tool, null);
  assert.equal(closed, true);
});
