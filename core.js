/** Restore normal ordering without losing user reorders among ordinary workspaces. */
export function reconcileBase(base, actual, pins) {
  if (pins.length === 0) return [...actual];
  const live = new Set(actual);
  const pinned = new Set(pins);
  const ordinary = actual.filter(id => !pinned.has(id));
  let at = 0;
  const result = base.filter(id => live.has(id)).map(id => pinned.has(id) ? id : ordinary[at++]);
  result.push(...ordinary.slice(at));
  for (const id of actual) if (!result.includes(id)) result.push(id);
  return result;
}

/** Shared serialized operations used by the menu HTTP endpoint and the agent tool. */
export class WorkspacePins {
  constructor({ domain, registry, onError = console.error }) {
    this.domain = domain;
    this.registry = registry;
    this.onError = onError;
    this.tail = Promise.resolve();
    this.closed = false;
    this.scheduled = false;
    this.error = null;
  }

  enqueue(operation) {
    const result = this.tail.then(() => {
      if (this.closed) throw new Error('Workspace pin plugin is stopping');
      return operation();
    });
    this.tail = result.catch(() => {}); // Callers receive the original rejection; later requests remain usable.
    return result;
  }

  actual() { return this.registry.list().map(workspace => workspace.id); }

  snapshot() {
    const state = this.domain.global.get();
    return {
      pinnedIds: [...state.pinnedIds],
      workspaces: this.registry.list().map(w => ({ id: w.id, title: w.title })),
      error: this.error,
    };
  }

  async save(next) {
    if (JSON.stringify(next) !== JSON.stringify(this.domain.global.get())) await this.domain.global.set(next);
  }

  async reconcile() {
    let actual = this.actual();
    let saved = this.domain.global.get();
    if (saved.pendingOrder) {
      const target = saved.pendingOrder.filter(id => actual.includes(id));
      target.push(...actual.filter(id => !target.includes(id)));
      await this.applyOrder(target);
      await this.save({ pinnedIds: saved.pinnedIds, baseOrder: saved.baseOrder });
      saved = this.domain.global.get();
      actual = this.actual();
    }
    const pins = saved.pinnedIds.filter(id => actual.includes(id));
    const base = reconcileBase(saved.baseOrder, actual, pins);
    await this.save({ pinnedIds: pins, baseOrder: base });
    const desired = [...pins, ...actual.filter(id => !pins.includes(id))];
    await this.applyOrder(desired);
    this.error = null;
  }

  async applyOrder(desired) {
    for (let i = 0; i < desired.length; i++) {
      const actual = this.actual();
      if (!actual.includes(desired[i])) continue; // A concurrent native deletion wins.
      if (actual[i] !== desired[i]) await this.registry.insertBefore(desired[i], actual[i]);
    }
  }

  /** Coalesce domain notifications without polling or unhandled promise rejections. */
  changed() {
    if (this.closed || this.scheduled) return;
    this.scheduled = true;
    this.enqueue(async () => {
      this.scheduled = false;
      await this.reconcile();
    }).catch(error => {
      this.error = String(error.message ?? error);
      this.onError(error);
    });
  }

  execute(request) {
    return this.enqueue(async () => {
      if (!request || !['list', 'pin', 'unpin'].includes(request.action)) throw new Error('Expected action: list, pin, or unpin');
      if (request.action === 'list') return this.snapshot();
      const id = request.workspaceId;
      if (typeof id !== 'string' || id.length === 0) throw new Error('workspaceId is required');
      if (this.domain.global.get().pendingOrder) await this.reconcile();
      const actual = this.actual();
      if (!actual.includes(id)) throw new Error('Unknown workspace: ' + id);
      const saved = this.domain.global.get();
      const pins = saved.pinnedIds.filter(key => actual.includes(key));
      const base = reconcileBase(saved.baseOrder, actual, pins);
      const nextPins = request.action === 'pin'
        ? (pins.includes(id) ? pins : [id, ...pins])
        : pins.filter(key => key !== id);
      // Intent is durable first. A native-order failure is explicit and retryable.
      const pendingOrder = [...nextPins, ...base.filter(key => !nextPins.includes(key))];
      await this.save({ pinnedIds: nextPins, baseOrder: base, pendingOrder });
      try {
        await this.applyOrder(pendingOrder);
        await this.save({ pinnedIds: nextPins, baseOrder: base });
        this.error = null;
      } catch (error) {
        this.error = String(error.message ?? error);
        throw error;
      }
      return this.snapshot();
    });
  }

  async close() {
    this.closed = true;
    await this.tail;
    await this.domain.close();
  }
}
