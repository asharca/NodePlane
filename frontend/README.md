# NodePlane Frontend

NodePlane 的 React 工作台：节点分组、检测进度与结果、定时任务、平台规则编辑器和账户设置。

![NodePlane 工作台预览，使用模拟测试数据](../docs/screenshots/workspace-light.png)

完整项目功能、后端启动和自托管注意事项见[根目录 README](../README.md)。

## 环境与命令

使用 Node.js 24、Bun 1.3.10。以下命令在 `frontend/` 目录执行：

```bash
bun install --frozen-lockfile
bun run dev          # 开发服务：http://localhost:3001
bun run check-types  # TypeScript
bun run test:unit    # Vitest 单元和组件测试
bun run build        # 构建 Nitro 服务及浏览器资源
bun run start        # 启动 .output/server/index.mjs
```

后端默认运行在 `http://localhost:4000`。`server/routes/api/[...path].ts` 将浏览器请求的 `/api/*` 同源转发到后端。需要其他地址时设置 `ENCORE_URL`，不要在浏览器代码中硬编码生产 API 地址。

`bun run check` 会执行 Biome **并写回格式/可自动修复内容**，不是只读检查。提交前检查 diff，避免混入与功能无关的格式变更。

## 目录

```text
src/
├── components/
│   ├── asharca/      锁定来源版本的 Asharca UI 源码
│   ├── ui/           现有交互接口的适配器
│   ├── workbench/    节点管理、检测进度、表格与导出
│   └── platforms/    规则编辑、脚本、测试控制台
├── routes/           TanStack 文件路由
├── queries/          TanStack Query 读写与缓存失效
├── lib/              生成客户端、认证、主题及业务工具
└── styles.css        全局样式与主题变量
server/routes/api/    Nitro 后端代理
scripts/             浏览器功能测试和视觉冒烟
```

这是一个单独的前端应用，**不存在 `apps/web`、`packages/ui` 或 `bun run dev:web`**。旧模板文档中的这些路径不再适用。

## UI 修改

直接修改或组合 `src/components/asharca/` 的组件；需要兼容旧的 Base UI `render`、事件或复合组件接口时，在 `src/components/ui/` 中适配，不要盲目替换签名。

```tsx
import { Button } from "@/components/asharca/button";
import { Page, PageHeader } from "@/components/asharca/page";

export function Example() {
  return (
    <Page as="div">
      <PageHeader title="NodePlane" description="Manage your nodes." />
      <Button onClick={() => console.log("action")}>操作</Button>
    </Page>
  );
}
```

组件来源、许可和适配边界见 [UI 接入说明](docs/ui-integration.md)。Asharca UI 是源码安装方式，不需要发布或安装一个旧式组件包。

## 测试

[功能测试说明](../docs/testing.md)记录完整步骤、覆盖矩阵和边界。

- `scripts/ui-smoke.mjs` 使用模拟 API，检查布局、主题、导航及空/错误状态，并生成 README 演示截图。
- `scripts/functional-browser.mjs` 使用真实后端，验证页面提交、持久化、错误反馈和关键用户流程。必须设置 `NODEPLANE_E2E_DISPOSABLE=1`，只允许一次性 loopback 实例。
- 浏览器 runtime 按 CI 中的方式安装在独立目录，用 `PLAYWRIGHT_RUNTIME` 指定；不进入生产依赖。

不要把两个浏览器套件的结果混在一起宣称“全链路已验证”。真实第三方代理、平台解锁、Telegram 和生产 SMTP 仍有单独的环境验收要求。

`src/lib/client.gen.ts` 与 `src/routeTree.gen.ts` 是生成文件。API 变更后使用项目的生成命令更新客户端；TypeScript 参数字段名与 HTTP query 标签名可能不同，手写 HTTP 测试应以服务定义为准。
