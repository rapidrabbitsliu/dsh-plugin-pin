window.__ModuleLoader__.load({
  id: 'dsh-plugin-pin',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ns = 'workspace-pin';
    const dicts = {
      zh: { pin: '置顶工作区', unpin: '取消置顶工作区', pinned: '已置顶', loading: '读取置顶状态…', busy: '正在保存…', error: '置顶操作失败，点击重试', retry: '重试读取置顶状态' },
      en: { pin: 'Pin workspace', unpin: 'Unpin workspace', pinned: 'Pinned', loading: 'Loading pin state…', busy: 'Saving…', error: 'Pin operation failed; retry', retry: 'Retry loading pin state' },
    };
    async function call(input, signal) {
      const response = await fetch('./api/plugin-workspace-pin', input ? {
        method: 'POST', credentials: 'same-origin', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      } : { credentials: 'same-origin', signal, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || String(response.status));
      return result.value;
    }
    function MenuItem({ workspaceId, useMenuOpenState, useWorkspaces, t }) {
      const [, setOpen] = useMenuOpenState();
      const snapshot = useWorkspaces(state => state);
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [retry, setRetry] = React.useState(0);
      const alive = React.useRef(true);
      React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
      React.useEffect(() => {
        const controller = new AbortController();
        call(null, controller.signal).then(value => { setState(value); setError(value.error); }).catch(reason => {
          if (!controller.signal.aborted) setError(String(reason.message ?? reason));
        });
        return () => controller.abort();
      }, [snapshot, retry]);
      React.useEffect(() => {
        const events = new EventSource('./api/plugin-workspace-pin-events');
        events.onmessage = () => setRetry(value => value + 1);
        return () => events.close();
      }, []);
      const pinned = state?.pinnedIds.includes(workspaceId) ?? false;
      async function activate(event) {
        event.stopPropagation();
        if (!state) { setRetry(value => value + 1); return; }
        setBusy(true); setError(null);
        try {
          await call({ action: pinned ? 'unpin' : 'pin', workspaceId });
          if (alive.current) setOpen(false);
        } catch (reason) {
          if (alive.current) { setError(String(reason.message ?? reason)); setRetry(value => value + 1); }
        } finally { if (alive.current) setBusy(false); }
      }
      const label = busy ? t('busy') : !state ? t(error ? 'retry' : 'loading') : t(pinned ? 'unpin' : 'pin');
      return h(React.Fragment, null,
        h('style', null, '.dsh-pin-menu{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}.dsh-pin-menu:hover,.dsh-pin-menu:focus-visible{background:var(--dsw-alias-bg-layer-2)}.dsh-pin-menu:focus-visible{outline:2px solid var(--dsw-alias-brand-primary)}.dsh-pin-menu:disabled{opacity:.6;cursor:default}.dsh-pin-state{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:12px}.dsh-pin-error{display:block;padding:4px 12px;color:var(--dsw-alias-state-error-primary);font-size:12px;max-width:240px;overflow-wrap:anywhere}'),
        h('button', { type: 'button', role: 'menuitem', className: 'dsh-pin-menu', disabled: busy || (!state && !error), onClick: activate, title: error || label },
          h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: pinned ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'M8 3h8l-1 7 3 4v2h-5v6h-2v-6H6v-2l3-4z' })),
          label, pinned && h('span', { className: 'dsh-pin-state' }, t('pinned'))),
        error && h('span', { role: 'alert', className: 'dsh-pin-error', title: error }, t('error')),
      );
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [locale, dict] of Object.entries(dicts)) ctx.effect(() => ctx.locale.register(ns, locale, dict));
        ctx.slots.inject('sidebar.workspaces.workspace.menu.item', () => ctx.slots.register({
          name: 'sidebar.workspaces.workspace.menu.item', id: 'dsh-plugin-pin.toggle', order: 50, locale: ns,
        }, MenuItem));
      },
    };
  },
});
