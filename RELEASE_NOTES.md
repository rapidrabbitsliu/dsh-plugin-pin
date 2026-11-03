# v0.1.1 — Workspace Pins / 工作区置顶

## 中文

- 在工作区 `…` 菜单置顶或取消置顶，并显示「已置顶」状态。
- 置顶项排在普通工作区前，最新置顶优先；取消后恢复普通顺序。
- Host 持久保存，同一 profile 页面共享；事件通知同步打开的菜单，不轮询。
- 排序失败保存待恢复顺序，支持重试；不修改 DSH 核心、DOM 或内置会话置顶。
- 原创图标，MIT 许可证。

安装：在 DSH 插件管理中填写 `dsh-plugin-pin@0.1.1`；或下载本 Release 的 `.tgz` 并使用 DSH 支持的本地包安装入口。

验证：9 项自动化测试、语法检查和实际 3080 GUI 菜单/排序/状态同步验证通过。目标 DSH 0.2.1-rc.3；未实测完整进程重启、多页面并发和所有主题语言组合。

限制：遵循原生父子工作区层级；多个原生移动不是原子事务；停用后保留置顶记录及最后原生排列。API 由 DSH Connection 认证和来源检查保护。

## English

Pin/unpin workspaces from their menus, with a Pinned indicator, newest-pin-first native ordering, durable profile-wide state, and event-driven open-menu updates. Failed ordering retains a recovery target. No core/DOM changes; native session pins remain unchanged. Original artwork; MIT licensed.

Install `dsh-plugin-pin@0.1.1` through DSH Plugin Manager, or use the attached tarball with DSH's supported local-package installation.

Verified: 9 automated tests, syntax checks, and actual 3080 GUI menu/ordering/state synchronization. Targets DSH 0.2.1-rc.3. Full process restart, simultaneous multi-page actions, and every theme/language combination are not verified. Native workspace nesting applies, multi-move sorting is non-atomic, and disabling retains records/last native order. DSH Connection protects API access.
