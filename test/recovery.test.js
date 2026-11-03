import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkspacePins } from '../core.js';

test('failed last-unpin restores pending order before reading current base', async () => {
  let order = ['a', 'b', 'c'];
  let state = { pinnedIds: [], baseOrder: [] };
  let fail = false;
  const pins = new WorkspacePins({
    domain: { global: { get: () => state, set: async value => { state = value; } }, close: async () => {} },
    registry: { list: () => order.map(id => ({ id })), insertBefore: async (id, anchor) => {
      if (fail) throw new Error('disk');
      order = order.filter(key => key !== id);
      order.splice(anchor === undefined ? order.length : order.indexOf(anchor), 0, id);
    } },
  });
  await pins.execute({ action: 'pin', workspaceId: 'c' });
  fail = true;
  await assert.rejects(pins.execute({ action: 'unpin', workspaceId: 'c' }));
  assert.deepEqual(state.pendingOrder, ['a', 'b', 'c']);
  fail = false;
  await pins.execute({ action: 'unpin', workspaceId: 'c' });
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(state.pendingOrder, undefined);
});
