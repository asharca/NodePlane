# 功能测试与验收

本项目将测试分为 Go 回归、前端单元/组件、真实 HTTP 功能、真实浏览器功能和模拟 API 的视觉冒烟五层。测试通过表示已定义场景通过，不代表所有网络、数据规模和第三方服务条件下都没有问题。

## 自动运行

PR 中的 **Frontend CI** 执行 TypeScript、前端单元/组件测试、生产构建和视觉冒烟；**Backend and Functional CI** 执行 Go 测试、真实 API 功能与真实浏览器操作。

功能 CI 在独立 GitHub runner 上启动本地 Encore 应用。数据库由 Encore/Docker 管理；测试不连接维护者的 Encore Cloud、生产 PostgreSQL、真实订阅或通知账户。CI 中使用的 JWTSecret 只供这一轮临时实例使用。

流水线源码：[frontend-ci.yml](../.github/workflows/frontend-ci.yml)、[backend-ci.yml](../.github/workflows/backend-ci.yml)。查看同一个 commit 的完整结果，不要用旧版本的绿色检查代替当前版本的结果。

## 覆盖矩阵

| 模块 | 真实 API / 持久化验证 | 浏览器 / 补充回归 |
| --- | --- | --- |
| 认证 | 注册、重复用户名、错误邀请码、错误密码、保持登录有效期、所有受保护路由未登录拒绝访问。 | 注册和登录表单、错误后保留输入、session/localStorage、刷新、退出登录。 |
| 账户 | 资料保存、邮箱校验、修改密码、旧密码失效、新密码可登录。 | 资料表单、标签关联、两次新密码不一致阻止提交。 |
| 分组 | 新建、读取、编辑、删除；远程/单节点差异；启停、导出偏好；跨用户请求不修改数据。 | 无效 URL、创建/编辑/停用、删除确认与取消。 |
| 节点来源 | 抓取试运行不落库、刷新、失败刷新保留节点、导入替换、追加单节点、无效导入、代理抓取配置。 | 从 URL 抓取、单节点创建、导入失败时回滚空分组。 |
| 检测 | 真实 HTTP 代理链路、可用性、下载、上传、平台规则、完整结果、部分重检、旧指标继承、重复任务拒绝、取消、SSE 结束消息、历史分页。 | 页面发起检测、选中节点重检、筛选、URL 选择状态恢复。 |
| 计划任务 | 创建/更新/启停/删除、无效 Cron、单节点限制、跨账户拒绝；更新响应 ID 和创建时间必须与数据库一致。 | 选择分组、快捷时间、参数选择、编辑、启停、删除。 |
| 平台规则 | 内置规则初始化、增删改、启停、恢复默认、用户隔离、未检测节点可选、无权限节点不得静默退回直连。 | Condition 规则填写、执行、保存、编辑、删除确认。 |
| 脚本引擎 | Condition、JavaScript、TypeScript、Lua、Tengo 的成功/失败；本地 HTTP 调用及执行 trace。 | Go 回归覆盖脚本取消、Tengo 输出赋值，避免重复声明和取消后继续运行。 |
| 导出与密钥 | 密钥重复读取稳定、并发读取、轮换旧密钥失效、各格式响应、单组/全部、停用节点过滤、导出日志、外部账户密钥拒绝。 | 轮换确认/取消、复制；复制权限失败不能报告成功。 |
| 通知 | Webhook 投递与错误响应、SMTP 本地实际投递、渠道 CRUD、部分更新保留告警配置、跨用户拒绝、三种报告类型。 | 新建/编辑/测试/删除；HTTP 200 但 `ok:false` 时也必须呈现失败。Telegram 发送契约用 Go 假传输层验证，不发送真实消息。 |
| 网络解锁 | 只运行当前用户启用的本地规则；IP 查询定向到本地测试服务；验证解锁报告通知。 | 不以 CI 出口对商业平台的实时可达性作为测试通过条件。 |
| 设置与界面 | 检测 URL、SMTP 配置、导出标签的保存、读取与用户隔离。 | 设置保存后刷新、320px/390px 布局、抽屉导航、明暗主题、空/错误状态。 |

HTTP 查询参数使用后端 `query` 标签，例如 `limit`、`offset`、`job_id`。生成的 TypeScript 参数名 `Limit`、`Offset`、`JobID` 不等于 wire 上的参数名。Encore 的 `failed_precondition` 在本项目运行时映射为 HTTP 400，业务判断不能仅硬编码 HTTP 412。

## 本地执行基础检查

在项目根目录：

```bash
encore test -v -count=1 -timeout=3m ./...
```

在 `frontend/`：

```bash
bun install --frozen-lockfile
bun run check-types
bun run test:unit
bun run build
```

Go 测试需要 Encore 管理的测试数据库。不要把这些命令替换成绕过 Encore 编译器的普通 `go test`，也不要把生产数据库作为测试数据库。

## 本地执行真实功能测试

**仅使用一个单独的、可销毁的工作副本和本地数据库。** 脚本会创建测试账户并执行密码修改、密钥轮换、节点删除和通知等写操作。不要在日常使用的 NodePlane 实例上运行，即使地址是 `localhost`。

在独立副本中将 `encore.app` 配为 `{}`，配置独立的 `secrets.local.cue`。确认 Docker 可用，并准备上述前端生产构建。以下终端都在这个独立副本中运行。

### 1. 本地外部服务夹具

```bash
python3 tests/fixtures/server.py
```

默认监听 `127.0.0.1:18081`（HTTP、测速、订阅、代理与 Webhook）和 `127.0.0.1:18082`（SMTP）。该代理只允许预定的本地目标，不向互联网转发。

完整 API 套件还验证 `/network-unlock`。在**临时 Linux VM/容器或 CI runner**中将 `ip-api.com` 解析到 `127.0.0.1`，并启动第二个仅本地监听的服务：

```bash
# 只在可销毁测试环境中修改 hosts，不修改日常工作机器的系统配置。
echo '127.0.0.1 ip-api.com' | sudo tee -a /etc/hosts
sudo python3 tests/fixtures/server.py --port 80 --smtp-port 18083
```

此步骤是固定外部 IP 查询的测试响应，不是模拟 NodePlane 自身 API。完整自动配置可直接参考功能 CI。

### 2. 后端和前端

```bash
# 终端 A：默认邀请码与测试脚本一致；如自行覆盖，在所有相关终端中使用同一个值。
encore run --port 4000

# 终端 B
PORT=3000 HOST=127.0.0.1 ENCORE_URL=http://127.0.0.1:4000 \
  node frontend/.output/server/index.mjs
```

### 3. API 功能

```bash
NODEPLANE_E2E_DISPOSABLE=1 python3 tests/functional_api.py
```

脚本默认只允许 `http://127.0.0.1:4000`，可通过 `NODEPLANE_API_ORIGIN` 改用其他本地端口；`NODEPLANE_FIXTURE_ORIGIN` 指定本地夹具地址。两者都会检查 loopback 边界。设置 `REGISTER_INVITE_CODE` 时，应与后端启动环境相同。

### 4. 浏览器功能

测试浏览器依赖隔离安装，不进入生产应用依赖：

```bash
export PLAYWRIGHT_RUNTIME="$(mktemp -d)"
npm install --prefix "$PLAYWRIGHT_RUNTIME" --no-package-lock --ignore-scripts playwright@1.55.0
"$PLAYWRIGHT_RUNTIME/node_modules/.bin/playwright" install --with-deps chromium
cd frontend
NODEPLANE_E2E_DISPOSABLE=1 node scripts/functional-browser.mjs
```

可通过 `UI_TEST_ORIGIN` 指定本地前端端口。此套件**不拦截或伪造应用 API 响应**，真实页面点击经 Nitro `/api` 转发到 Encore，再与数据库持久化结果核对。

完成后停止服务并销毁测试副本及对应数据库。不要根据用户名模式在生产库中批量删除记录。

## 报告与截图

| 文件或目录 | 内容 |
| --- | --- |
| `test-results/backend/go-test.log` | Go 回归测试输出。 |
| `test-results/backend/functional-api.json` | API 用例结果、失败清单、从源码提取的路由清单及观察到的响应状态。 |
| `frontend/test-results/functional/report.json` | 各浏览器功能场景的通过/失败及耗时。 |
| `frontend/test-results/functional/*.png` | 失败页面和真实后端移动端诊断截图，仅含测试账户。 |
| `frontend/test-results/ui/` | 模拟 API 的视觉冒烟截图及报告。 |
| `docs/screenshots/` | 已提交、供 README 长期展示的演示截图。 |

CI artifact 名称为 `nodeplane-functional-tests`、`nodeplane-ui-preview`，保留时间为 14 天。README 引用仓库内图片，因此不会随 artifact 到期失效。

`successful_request_observed` 只说明路由在该轮出现成功请求，不是代码覆盖率或分支覆盖率。报告不会把只有 401 校验的路由算作成功业务验证。

## 验证边界

- 本地 HTTP 代理链路验证真实检测执行，但不证明每个真实代理协议、TLS 服务或运营商网络都正常。Base64 导出目前只覆盖实现中支持的协议，HTTP 节点不能据此宣称完整编码支持。
- Telegram 验证请求构造、错误处理和配置校验，不使用真实机器人；SMTP 真实投递到本地捕获服务，不替代生产 SMTP 的证书、STARTTLS、认证与投递信誉验收。
- SSE 进度端点在原架构中是公开 raw API，以 job ID 访问。本轮测试进度、完成与取消，不宣称新增了跨用户 SSE 鉴权。
- 定时任务还会等待一次真实的分钟级 Cron 触发，验证自动抓取、检测、持久化以及完成事件触发 Webhook；这不等于长期定时可靠性验证。长时间运行、重启恢复、资源压力和多实例行为需要独立专项测试。
- 这是功能回归体系，不是渗透测试报告、性能基准或“100% 无缺陷”的保证。
