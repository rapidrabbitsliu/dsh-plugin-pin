import { z } from 'zod';
import { WorkspacePins } from './core.js';

export const inject = ['workspaceRegistry', 'storageDomain', 'connection', 'tools'];

/** Install only plugin-owned state, a protected API route, and a shared-operation tool. */
export async function apply(ctx) {
  const schema = z.object({ pinnedIds: z.array(z.string()), baseOrder: z.array(z.string()), pendingOrder: z.array(z.string()).optional() });
  const domain = await ctx.storageDomain.open({
    name: 'dsh_plugin_pin', version: 1,
    global: { schema, initial: { pinnedIds: [], baseOrder: [] } }, tables: {},
  });
  const pins = new WorkspacePins({ domain, registry: ctx.workspaceRegistry });
  ctx.effect(() => () => pins.close(), 'workspace-pin: storage close');
  await pins.enqueue(() => pins.reconcile());
  const streams = new Set();
  const encoder = new TextEncoder();
  ctx.on('domain/changed', change => {
    if (change.domain === 'workspace') pins.changed();
    if (change.domain === 'dsh_plugin_pin') for (const stream of [...streams]) {
      try { stream.enqueue(encoder.encode('data: changed\n\n')); } catch { streams.delete(stream); }
    }
  });
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/plugin-workspace-pin-events', methods: ['GET'], requestBody: 'buffered',
    fetch(request) {
      let controller;
      const cleanup = () => {
        if (controller && streams.delete(controller)) { try { controller.close(); } catch {} }
        request.signal.removeEventListener('abort', cleanup);
      };
      const body = new ReadableStream({
        start(value) {
          controller = value; streams.add(value);
          value.enqueue(encoder.encode('data: connected\n\n'));
          request.signal.addEventListener('abort', cleanup, { once: true });
          if (request.signal.aborted) cleanup();
        },
        cancel: cleanup,
      });
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
    },
  }), 'workspace-pin: event route');
  ctx.effect(() => () => { for (const stream of streams) { try { stream.close(); } catch {} } streams.clear(); }, 'workspace-pin: event streams');
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/plugin-workspace-pin', methods: ['GET', 'POST'], requestBody: 'buffered',
    async fetch(request) {
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      try {
        const input = request.method === 'GET' ? { action: 'list' } : await request.json();
        const value = await pins.execute(input);
        return new Response(JSON.stringify({ ok: true, value }), { headers });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: String(error.message ?? error) }), { status: 400, headers });
      }
    },
  }), 'workspace-pin: authenticated route');
  ctx.effect(() => ctx.tools.register({
    name: 'workspace_pin',
    description: 'List workspaces and their pin state, or pin/unpin one workspace. Pinned workspaces precede ordinary ones, newest pin first. Changes affect all pages in this profile; session pins are unchanged.',
    parameters: {
      type: 'object', properties: {
        action: { type: 'string', enum: ['list', 'pin', 'unpin'] },
        workspaceId: { type: 'string', description: 'Workspace ID from list; required for pin and unpin.' },
      }, required: ['action'], additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: args => pins.execute(args),
  }), 'workspace-pin: tool');
}
