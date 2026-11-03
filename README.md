# 工作区置顶 / Workspace Pins

独立 DSH 插件；只扩展工作区菜单和原生工作区顺序，不修改 DSH 核心、DOM、会话置顶或会话归属。

## 使用

打开侧栏工作区的 `…` 菜单，选择「置顶工作区」。最新置顶在最前面；已经置顶时菜单显示「已置顶」和「取消置顶工作区」。不添加单独置顶区，也不在标题旁添加图标。再次置顶已置顶项不更新次序；取消后重新置顶则排到第一位。

取消置顶恢复保存的普通顺序，并保留普通工作区之间的拖拽顺序。插件监听存储变更，新增工作区或原生拖拽后重新保持置顶块在前。状态通过 Host 存储持久化，同一 profile 的页面共享；菜单打开时、原生工作区快照变化时及 Host 置顶变更事件到达时读取状态，无轮询；菜单卸载会关闭事件流。

## 安装与开发

发布目标：`dsh-plugin-pin@0.1.1`，MIT 许可证。GitHub：[rapidrabbitsliu/dsh-plugin-pin](https://github.com/rapidrabbitsliu/dsh-plugin-pin)。渠道可用性以 GitHub Release / npm 页面为准。

在 DSH 中让 agent 安装：

```json
{ "action": "install_bundle", "target": "dsh-plugin-pin@0.1.1" }
```

也可以在插件管理器的安装入口填写 `dsh-plugin-pin@0.1.1`，或选择本地包目录。不要手工修改 profile 配置。升级已有安装时按插件管理器提示操作；当前运行时可能要求先卸载旧 bundle 再安装新版，或重启以加载新模块。保留相同 profile 可保留置顶数据。停用/卸载通过插件管理器操作。

源码开发：`npm ci` 安装依赖；`npm test`、`npm run check` 检查，`npm pack --dry-run` 审查打包内容。

Host 依赖 `workspaceRegistry`、`storageDomain`、`connection`、`tools`；Client 使用工作区菜单插槽、locale 和 React。通信路由 `/api/plugin-workspace-pin` 由 DSH Connection 负责认证与来源校验。agent 工具 `workspace_pin` 提供 `list`、`pin`、`unpin`，与菜单调用同一串行操作。

## 生命周期与限制

停用移除菜单、API、工具和变更监听，保留置顶记录及最后的原生排列；重新启用会恢复协调。它不是纯视觉排序：原生持久顺序会改变。排序由多个原生单项移动组成，不是原子批量事务；写入失败明确报告，置顶意图保留，可重试。卸载不会删除目录或会话。

DSH 会根据路径把嵌套工作区显示在父工作区下面，因此子工作区仍遵循原生层级，不能保证跨层级独立显示在整个侧栏顶部；此插件不修改层级规则。搜索、非工作区分组仍由原生浏览器控制。

兼容依据：本地 DSH `0.2.1-rc.3` 的工作区 API；不声称其他版本已验证。v0.1.1 已在现有 DSH 的 3080 页面验证菜单置顶、取消、最新置顶优先、原顺序恢复和工具修改后的菜单同步；9 项自动测试覆盖排序、异常恢复与 Host 生命周期。未实测完整进程重启、多页面并发和全部主题/语言组合。详细记录见仓库的 [VERIFICATION.md](https://github.com/rapidrabbitsliu/dsh-plugin-pin/blob/main/VERIFICATION.md)。

图标为本插件原创 SVG，无第三方素材。

## English

Pin/unpin from each workspace's `…` menu. Pinned entries display a Pinned label in the menu and precede ordinary entries, newest pin first. Session pins remain native. Unpin restores the saved ordinary order; ordinary drag changes are retained. Host storage shares state across pages in the same profile. No polling, DOM modifications, or DSH core changes.

Release target: **dsh-plugin-pin@0.1.1**, MIT licensed. Install from DSH's Plugin Manager using that package spec, or ask the agent to call `plugin_manager` with `action: install_bundle` and `target: dsh-plugin-pin@0.1.1`. Local directories are also supported. Follow the manager's upgrade guidance: existing installations may need removal/reinstallation or a restart to load a new module generation. Keep the same profile to preserve pin data. Channel availability is authoritative on the npm/GitHub Release pages.

Use `npm ci`, `npm test`, `npm run check`, and `npm pack --dry-run` for development. The authenticated Connection routes and agent tool share serialized operations. Menus receive Host change events without polling, even when native ordering does not change. Disabling removes contributions but preserves records and the last native ordering. Multi-move sorting is not atomic; failures are reported and pending order is retained for recovery. Native path-based nesting still applies: child workspaces cannot independently rise above their parents.

Targets inspected DSH **0.2.1-rc.3** APIs. Actual 3080 UI tests covered pin/unpin, newest-first ordering, order restoration, and menu updates after agent-tool changes. Nine automated tests cover ordering, failure recovery, and Host lifecycle. Full process restart, simultaneous multi-page actions, and all theme/language combinations remain unverified. See the repository's [verification record](https://github.com/rapidrabbitsliu/dsh-plugin-pin/blob/main/VERIFICATION.md). The SVG icon is original artwork.
