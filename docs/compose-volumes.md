# Docker 命名卷部署

## 服务与持久化

| 服务 | 职责 | 持久化 |
| --- | --- | --- |
| `postgres` | PostgreSQL 17，内部地址 `postgres:5432` | `postgres_data:/var/lib/postgresql/data` |
| `migrator` | 建立缺失数据库、应用版本化 SQL，然后退出 | 迁移版本记录位于各数据库 |
| `nsq` | 本地消息队列，`--data-path=/data` | `nsq_data:/data` |
| `backend` | Encore 应用，使用构建时嵌入的内部基础设施配置 | 业务数据存放于 PostgreSQL |
| `frontend` | Nitro 前端，同源代理到后端 | 无数据库文件 |

PostgreSQL 与 NSQ 均无宿主机端口，只接入 Compose 的内部 `data` 网络。后端同时接入默认网络以访问外部检测目标。默认数据库用户由 PostgreSQL 镜像创建，具有数据库管理员权限；此配置适用于隔离的单机自托管实例。不要将数据库端口直接公开。

命名卷由 Docker 创建，不需要手工准备宿主机目录。默认名称包含 Compose 项目前缀；Coolify 应保持同一资源 UUID/项目名。改变项目名、删除资源存储或换部署服务器可能得到另一个空卷。卷与容器生命周期独立，但卷仍在本机磁盘上，不能防止误删、磁盘损坏或主机丢失。

PostgreSQL 固定为 17 大版本并使用其正确的数据目录。不要简单把镜像改为 PostgreSQL 18/19；大版本和数据目录布局升级必须走备份恢复或受支持的升级流程。

## 初始化与迁移

1. `postgres` 在空卷上初始化，创建 `POSTGRES_USER` 与默认 `postgres` 数据库。
2. TCP 健康检查成功后，`migrator` 通过密码认证连接。
3. `init.sql` 在 advisory lock 保护下，仅创建缺失的 `auth/subscription/checker/scheduler/notify/settings` 六个数据库。
4. golang-migrate 按各自 `schema_migrations` 记录应用 SQL；重复运行无变更时成功退出。
5. Compose 确认迁移成功且 NSQ 健康后启动 backend，再启动 frontend。

迁移镜像在 CI 构建，内含客户端、固定版本的 golang-migrate、脚本及 SQL。启动时不安装软件、不访问 GitHub、不依赖 Coolify 临时仓库目录。不要手工给服务挂回旧 `infra.config.json`，否则可能把内部地址覆盖为旧地址。

密码通过 PG 环境变量传给 PostgreSQL 客户端，不拼进 URI，保留 `@`、`:`、`/`、`%` 等原字符。`.env` 中包含 `$` 的值应使用单引号，避免 Compose 插值；Coolify 中也要确保保存的是预期字面值。不要输出展开后的 Compose 环境变量或分享带密码的检查结果。

迁移失败仍然返回非零并阻断启动。不会自动 `force`、清空 dirty 标记、删除数据或重建已有数据库。请先备份，再检查 `docker compose logs migrator postgres` 中的实际错误。

## 从旧外部数据库切换

这是新建本地 PostgreSQL，不是把旧数据库文件转换成卷。默认空卷没有旧用户、订阅、检测历史、任务或设置。旧实例不被新栈连接、修改或删除。

要保留数据，应先停止旧应用写入，对六个数据库分别做一致性考虑的备份，记录 PostgreSQL 版本与角色/权限，在隔离环境验证恢复到本地 PostgreSQL。恢复完成后再运行对应新版本迁移，最后切换应用。恢复前检查数据库是否已有表，不要把备份盲目叠加到已经迁移的数据库上。本文不自动执行旧库搬迁。

## 密码与备份

`DB_PASSWORD` 首次创建卷时设置数据库密码。已有卷不会因修改环境变量而自动改密码；需有计划地修改数据库角色密码并同步应用配置。否则健康检查可能通过而 migrator 认证失败。请勿删除卷来解决密码问题。

下面的备份命令读取当前项目的本地数据库，保存敏感备份文件到当前目录：

```bash
umask 077
docker compose exec -T postgres sh -c 'pg_dumpall -U "$POSTGRES_USER"' > nodeplane-backup.sql
```

备份含账户信息、订阅、代理凭据与数据库角色信息，应加密保存并保留异机副本。生产备份要根据跨库一致性需求安排维护窗口，并在隔离环境做恢复演练；文件存在不等于备份已经验证有效。

正常 `docker compose down` 不删除命名卷。**不要使用 `docker compose down -v`、`docker volume rm` 或 Coolify 删除持久存储作为日常更新步骤。** 在新服务器部署前先完成备份迁移，Docker 本地命名卷不会自动同步。

## 部署验收与测试

`deploy` 工作流分别构建后端、前端和迁移镜像，再加载这些准确镜像执行实际 Compose 回归；通过后才允许发布。PR 验证期间不会推送或调用 Coolify。

回归脚本 `tests/compose_volume_smoke.py`：空卷六库初始化与完整 SQL 版本、特殊字符密码、重复迁移、错误密码、dirty 状态阻断 backend、真实 `/api/auth/register` 与登录、写入分组、删除容器但保留卷后重新启动并核对原账户/分组。源码目录不挂载到任何容器。

```bash
# 仅对已经构建的三个一致版本镜像进行一次性测试。
NODEPLANE_IMAGE_PREFIX=nodeplane \
SUBS_CHECK_IMAGE_TAG=local \
NODEPLANE_COMPOSE_TEST_DISPOSABLE=1 \
python3 tests/compose_volume_smoke.py
```

脚本拒绝缺少确认标记或使用 `latest`，不接受外部项目名；自动生成随机 `np-volume-ci-*` 项目和专属测试卷，只清理自己创建的测试资源。它对测试库注入并恢复 dirty 标志，**严禁改成使用已有生产项目**。

报告保存在 `test-results/compose/`，Actions 上传为 `nodeplane-compose-volume-tests`。测试通过不代表已从旧数据库搬迁数据，也不代表 node13 磁盘、Coolify 网络入口和真实代理线路已验证。完整业务流程回归仍由 Backend and Functional CI 执行。

## 参考

- [Docker Volumes](https://docs.docker.com/engine/storage/volumes/)
- [PostgreSQL 官方镜像：PGDATA 和初始化变量](https://hub.docker.com/_/postgres)
- [Compose 启动依赖与健康检查](https://docs.docker.com/compose/how-tos/startup-order/)
- [Encore Docker 构建时基础设施配置](https://encore.dev/docs/go/self-host/docker-build)
