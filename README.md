# NodePlane

一个可以自托管的代理节点管理与检测工作台。集中管理订阅和单节点，检查可用性、延迟、下载/上传速度与平台解锁状态，并通过计划任务、通知和导出链接连接日常使用流程。

前端采用 React 19、TanStack Start 和 [Asharca UI](https://asharca.github.io/ui/)，后端采用 Go、Encore 和 mihomo。UI 组件以源码形式存放在仓库中，可以直接修改。

[界面预览](#界面预览) · [主要功能](#主要功能) · [自托管](#自托管) · [本地开发](#本地开发) · [测试](#测试) · [项目结构](#项目结构)

## 界面预览

截图由浏览器测试生成，**使用虚构的演示账户和测试数据**，不代表真实节点速度、在线率或生产状态。图片保存在仓库 `docs/screenshots/`，不依赖会过期的 CI 附件。

### 节点工作台 · 浅色

![NodePlane 浅色工作台](docs/screenshots/workspace-light.png)

### 节点工作台 · 深色

![NodePlane 深色工作台](docs/screenshots/workspace-dark.png)

<details>
<summary>登录页面与新建节点分组</summary>

![NodePlane 登录页面](docs/screenshots/login-light.png)

![新建节点分组弹窗](docs/screenshots/create-group-dialog.png)

</details>

<details>
<summary>移动端与窄屏设置页面</summary>

<p>
  <img src="docs/screenshots/workspace-mobile.png" alt="NodePlane 移动端工作台" width="320" />
  <img src="docs/screenshots/settings-small-mobile.png" alt="NodePlane 320px 窄屏设置页面" width="280" />
</p>

</details>

## 主要功能

| 模块 | 能力 |
| --- | --- |
| 节点管理 | 远程订阅分组、单节点分享链接、导入与追加、从 URL 刷新、抓取试运行、通过已有节点抓取订阅、启停及搜索筛选。 |
| 节点检测 | 可用性、延迟、下载/上传测速；全组或选中节点检测；SSE 实时进度、取消、历史结果和调试记录。未执行项目可继承已有结果。 |
| 平台规则 | 内置规则与 Condition、JavaScript、TypeScript、Tengo、Lua 五种规则类型；编辑、测试、启停、恢复内置定义和选择代理节点测试。 |
| 自动化 | Cron 定时检测、检测参数、任务启停和删除。订阅分组支持计划任务，单节点分组不支持。 |
| 通知 | Webhook、Telegram、SMTP 邮件；检测报告、平台告警、定时网络解锁报告和渠道测试。 |
| 导出 | 单组/全部节点；Clash、Base64、RouterOS 格式；API 密钥与轮换、排序、失效节点选项、国家/速度/平台标签和请求日志。 |
| 账户与界面 | 邀请码注册、登录/保持登录、资料与密码修改；明暗主题、可折叠侧栏、手机导航和响应式布局。 |

协议能力来自 mihomo；可以导入不代表所有导出格式都能保留全部字段。平台解锁结果受出口 IP、目标平台策略及规则变化影响。

## 自托管

**默认使用 Compose 内置 PostgreSQL，数据保存在 Docker 命名卷，不再需要外部数据库 IP。**

```text
frontend → backend → postgres:5432 → postgres_data 命名卷
                 ↘ nsq:4150      → nsq_data 命名卷
postgres 健康 → migrator 建库并迁移成功 → backend 启动
```

部署由五个服务组成：`postgres`、`migrator`、`nsq`、`backend`、`frontend`。PostgreSQL 与 NSQ 没有映射宿主机端口；它们和迁移容器使用内部数据网络。后端另接应用网络，以支持节点检测的外网访问。

### 首次部署

```bash
git clone https://github.com/asharca/NodePlane.git
cd NodePlane
cp .env.example .env
```

在 `.env`（或 Coolify 的环境变量）填写：

| 变量 | 设置 |
| --- | --- |
| `DB_USER` | 默认 `nodeplane`；三个数据库使用方保持一致。 |
| `DB_PASSWORD` | 必填：数据库随机密码。 |
| `JWT_SECRET` | 必填：独立随机签名密钥，建议至少 32 随机字节。 |
| `REGISTER_INVITE_CODE` | 必填：自行设置的注册邀请码，不再悄悄使用代码默认值。 |
| `BASE_URL` | 公网前端地址加 `/api`，例如 `https://nodeplane.example.com/api`。 |
| `NODEPLANE_IMAGE_PREFIX` | 默认 `ghcr.io/asharca/nodeplane`。 |
| `SUBS_CHECK_IMAGE_TAG` | 默认 `latest`；生产建议固定已发布的完整提交 SHA。 |

可分别执行 `openssl rand -hex 32` 生成不同的密码/密钥。必填变量为空时 Compose 会在启动前报错。无需再设置 `DB_HOST`、`BACKEND_IMAGE`，也无需挂载本地 SQL 目录。

确认所选版本的三个镜像均已发布：`nodeplane`、`nodeplane-frontend`、`nodeplane-migrator`。迁移镜像和后端必须使用相同版本；旧镜像不具备新的内部数据库配置。

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
# 默认入口：http://服务器地址:18080
docker compose logs --tail 100 migrator backend
```

迁移容器已包含迁移工具、PostgreSQL 客户端、初始化脚本与全部 SQL，**启动时不从 GitHub 下载工具、不依赖仓库 bind mount**。它自动创建缺失的六个数据库并按版本迁移；重复运行不会清空数据，失败时仍阻止后端启动。

### Coolify

选择此仓库、相应分支和根目录 `docker-compose.yml`，填写上述变量，把域名路由到 `frontend:3000`。不需要单独创建外部 PostgreSQL，也不需要开启保留仓库来提供数据库脚本。生产入口应配置 HTTPS。

**使用同一个 Coolify 资源/Compose 项目和部署服务器**，后续部署会复用命名卷。不要在 Coolify 中删除持久存储，也不要运行带 `--volumes` 的删除命令来“修复”迁移。

**这是一个新数据库实例，不会自动迁移旧外部数据库的数据。** 旧账户、订阅和检测记录需要另行备份/恢复；旧数据库不会被本配置访问或删除。已有卷的数据库密码不会因为环境变量变更而自动更新。命名卷不是备份，也不会自动跟随应用迁移到另一台服务器。详见 [持久化、备份与切换说明](docs/compose-volumes.md)。

### 本地构建与发布

```bash
# 从仓库根目录构建三个一致版本的镜像。
encore build docker --config deploy/infra.config.json nodeplane:local
docker build -t nodeplane-frontend:local ./frontend
docker build -f deploy/migrator.Dockerfile -t nodeplane-migrator:local .
# NODEPLANE_IMAGE_PREFIX=nodeplane、SUBS_CHECK_IMAGE_TAG=local 用于本地镜像；
# 本地启动需用 Compose override 把三个服务的 pull_policy 设置为 never。
```

后端基础设施配置在构建时嵌入，SQL 地址固定为内部 `postgres:5432`。六个数据库分别限制连接池，避免耗尽单实例 PostgreSQL 默认连接数。`metadata.base_url` 是内部服务地址，不是用户访问地址。

CI 在发布前对实际 Compose 栈验证空卷初始化、六库迁移、失败阻断、真实注册登录和容器删除重建后的数据保留。PR 只验证，不登录 GHCR、不发布、不触发 Coolify。`main`/版本标签发布三个一致版本的镜像，然后才触发 Coolify。**触发 Webhook 不等于线上健康；此前的 Coolify 公网连接问题仍需独立处理。**

### 单实例约束

当前 checker/scheduler 后端应以单实例运行。实时任务总线和 Cron 使用进程内状态，启动恢复也会处理遗留任务。不要直接增加 backend 副本数。见 [ADR：单实例部署](docs/adr/0001-single-instance-deployment.md)。

## 本地开发

需要 Go（遵循 `go.mod`）、Encore CLI、可用的 Docker、Node.js 24 和 Bun `1.3.10`。参考 [Encore 安装说明](https://encore.dev/docs/go/install)。

独立开发时备份 `encore.app` 后移除维护者应用 ID，或在独立本地副本中使用 `{}`。不要提交个人应用 ID、凭据或密钥。根目录创建 `secrets.local.cue`：

```cue
JWTSecret: "replace-with-a-long-random-local-secret"
```

后端秘密字段名是 `JWTSecret`；自托管镜像通过 `JWT_SECRET` 环境变量注入，两者不要混淆。

```bash
export REGISTER_INVITE_CODE='replace-with-your-invite-code'
encore run --port 4000
# 另开终端
cd frontend
bun install --frozen-lockfile
bun run dev
```

开发前端端口为 3001；同源 `/api/*` 默认转发到 `http://localhost:4000`，通过 `ENCORE_URL` 调整。`encore run` 的开发数据库由 Encore 管理，与生产 Compose 命名卷数据库不是同一个实例。

```bash
cd frontend
bun run check-types
bun run test:unit
bun run build
ENCORE_URL=http://localhost:4000 bun run start
```

生产前端由 Nitro 输出至 `.output/`，不是静态 `dist/`。API 客户端 `src/lib/client.gen.ts` 和路由 `src/routeTree.gen.ts` 是生成文件，不要手工修改。

## 测试

| 层次 | 入口与范围 |
| --- | --- |
| Go 回归 | `encore test -v -count=1 ./...`：业务、解析/导出、规则、事件及数据库回归。 |
| 前端单元/组件 | `cd frontend && bun run test:unit`：筛选、Cron、SSE、表单与组件适配器。 |
| 真实 HTTP 功能 | `tests/functional_api.py`：真实 Encore/PostgreSQL 上的功能与权限验证。 |
| 真实浏览器流程 | `frontend/scripts/functional-browser.mjs`：页面经 `/api` 调用真实后端并核对持久化。 |
| 界面冒烟 | `frontend/scripts/ui-smoke.mjs`：模拟 API 的主题、导航、窄屏及截图。 |
| 真实部署回归 | `tests/compose_volume_smoke.py`：实际镜像、空卷、六库迁移、失败阻断和数据持久化。 |

详细功能测试矩阵见 [测试说明](docs/testing.md)；部署测试及安全边界见 [命名卷部署说明](docs/compose-volumes.md)。不能把模拟页面测试当成真实后端或真实容器部署测试。

真实 HTTP 测试要求 `NODEPLANE_E2E_DISPOSABLE=1` 并拒绝非 loopback 地址。部署测试要求 `NODEPLANE_COMPOSE_TEST_DISPOSABLE=1`，使用随机独立项目并在结束时删除其测试卷。**所有破坏性测试只允许针对一次性实例，不得连接日常使用或生产数据库。** 外部订阅、代理、测速、Webhook/SMTP 使用受控夹具，不代表真实运营商网络或生产通知服务已验收。

## 项目结构

```text
NodePlane/
├── frontend/                   React/TanStack 工作台、同源 API 代理与浏览器测试
│   ├── src/components/asharca/  Asharca UI 源码与许可
│   ├── src/components/workbench/ 节点工作台
│   ├── src/components/platforms/ 规则编辑与调试
│   └── docs/                   UI 接入与验证说明
├── services/                   auth/subscription/checker/scheduler/notify/settings
├── tests/                      API、部署回归及外部服务夹具
├── docs/                       测试文档、架构决策与截图
├── deploy/                     内部基础设施配置、迁移镜像与脚本
├── docker-compose.yml          PostgreSQL/NSQ 命名卷和应用服务
└── .github/workflows/           构建、测试与发布
```

## UI 与贡献

UI 源码版本、MIT 许可与 Base UI 接口适配见 [UI 接入说明](frontend/docs/ui-integration.md)。组件许可证不自动代表整个仓库的许可证。

提交前运行相关测试。新增功能需覆盖成功、失败、权限和持久化；修改 API 后生成客户端；修改 UI 后检查明暗主题与窄屏。截图不得暴露真实账户、订阅或密钥。公开进度/密钥导出端点有独立访问方式，不能将其他 API 的 Bearer 鉴权视为所有端点都已受到同等保护。
