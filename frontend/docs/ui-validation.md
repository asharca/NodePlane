# UI 验证

## 基础检查

在 `frontend/` 执行：

```sh
bun install --frozen-lockfile
bun run check-types
bun run test:unit
bun run build
```

单元/组件测试覆盖过滤、Cron、SSE 状态、认证存储、表单标签、按钮适配、复制成功/失败和单节点创建失败时的补偿清理。

## 视觉冒烟：模拟 API

`Frontend CI` 启动生产构建，将 Playwright 1.55.0 安装在应用依赖以外的临时目录，执行 `scripts/ui-smoke.mjs`。此套件拦截应用 API 并使用虚构数据，不会修改真实账户或计划任务。

检查登录提交、密码显示、主题切换、导航折叠、节点弹窗、页面导航、移动抽屉、搜索、横向溢出、失败重试和空状态。未捕获的浏览器错误会使测试失败。

```sh
npm install --prefix /tmp/nodeplane-browser --no-package-lock --ignore-scripts playwright@1.55.0
/tmp/nodeplane-browser/node_modules/.bin/playwright install chromium
PORT=3000 HOST=127.0.0.1 node .output/server/index.mjs
# 另一终端，从 frontend/ 执行：
PLAYWRIGHT_RUNTIME=/tmp/nodeplane-browser node scripts/ui-smoke.mjs
```

截图与 JSON 报告位于 `frontend/test-results/ui/`，CI artifact 为 `nodeplane-ui-preview`，保留 14 天。README 的六张演示截图单独提交到 `docs/screenshots/`，因此不会随 artifact 到期失效。

## 功能验收：真实后端

`scripts/functional-browser.mjs` 不伪造应用 API。页面实际请求经 Nitro `/api` 代理到 Encore 和 PostgreSQL，测试还会独立读取 API 核对持久化结果。每个场景创建独立临时账户，失败时保存页面和诊断信息。

完整环境、执行命令和覆盖矩阵见 [功能测试说明](../../docs/testing.md)。该套件要求 `NODEPLANE_E2E_DISPOSABLE=1`，并拒绝非 loopback 地址；**即使是本地地址，也只能指向可销毁的测试实例，不能指向日常使用的数据库。**

浏览器功能与真实 HTTP API、Go 回归在 `Backend and Functional CI` 一起运行，报告上传为 `nodeplane-functional-tests`。测试清单包含实际 Cron 触发和完成通知；不能把视觉冒烟的截图数量当作真实功能通过数量。

## 边界

外部订阅、HTTP 代理、测速目标、Webhook 和 SMTP 使用受控本地服务；Telegram 传输契约使用假传输层。真实代理线路、商业平台解锁、生产 SMTP/Telegram、长时间运行和重启恢复仍需对应环境验收。

请查看当前 commit 的 CI 结果和报告，不要使用历史版本的绿色检查代替当前结果。测试通过不代表全协议、全数据规模、全网络条件下无缺陷。本次分支不会自动合并或部署；现有 main 部署流程保持不变。
