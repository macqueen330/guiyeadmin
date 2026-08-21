# 在 Claude Cloud 容器里部署与操控 Vercel / Supabase / GitHub

面向「新开一个 Claude Cloud 环境，让容器能自己发版、跑迁移、推代码」这件事。

先说三条会直接卡住你的事实，都是在容器里实测出来的：

| 事实 | 后果 | 对策 |
| --- | --- | --- |
| 默认 **Trusted** 网络策略不含 Vercel / Supabase | 所有请求收 `403 CONNECT tunnel failed`，与令牌是否正确无关 | 环境改 **Custom** 并加白名单（下文） |
| 环境变量框**没有密钥存储**，值对该环境所有使用者可读 | 把 `VERCEL_TOKEN` / service_role key 贴进去 = 明文留存 | 走下面的「零机密方案」，或用短期窄权限令牌 |
| 出网代理只转发 443 HTTPS，不支持裸 TCP | `supabase db push`（5432/6543 直连）必然失败 | 用 `npm run db:push`，走 Management API |

官方原话（[Cloud environments](https://code.claude.com/docs/en/cloud-environments)）：
> Anyone who uses the environment can read the values, and cloud environments have no dedicated secrets store, so don't add API keys or other credentials.

---

## 方案一：零机密（推荐）

让容器只做它天然就有权限做的事——**推 Git**——其余交给各平台自己的自动化。
容器里一个密钥都不用存。

```
容器  ──git push──▶  GitHub  ──webhook──▶  Vercel 构建部署
                                              └─ service_role key 存在 Vercel 项目变量里
```

- **GitHub**：容器内 GitHub 走独立代理，`GH_TOKEN` 读出来是占位符 `proxy-injected`，
  真实凭据在容器外替换。`git push` 开箱即用，**不需要**你自备 PAT。
  但代理对「脚本自己调 REST API」另有限制，见下方 [GitHub 到底能干什么](#github-到底能干什么)。
- **Vercel**：在 Vercel 项目里开启 Git 集成（Settings → Git），推分支即预览部署，
  合并 `main` 即生产部署。容器不需要 `VERCEL_TOKEN`。
- **Supabase**：`SUPABASE_SERVICE_ROLE_KEY` 填在 Vercel 的
  Settings → Environment Variables，勾 **Sensitive**，不加 `NEXT_PUBLIC_` 前缀。
  应用在 Vercel 运行时读取，密钥从不进容器。

这样网络策略保持默认 **Trusted** 就够了，环境变量框只放 A 段公开配置。

**代价**：容器不能主动触发部署、不能读部署日志、不能跑迁移。需要这些就看方案二。

---

## 方案二：容器直接操控（要配网络 + 存令牌）

### 1. 网络访问

环境对话框 → **Network access** 选 **Custom**，
**Allowed domains** 一行一个：

```
api.vercel.com
vercel.com
*.vercel.com
*.vercel.app
api.supabase.com
supabase.com
*.supabase.com
*.supabase.co
```

勾上 **Also include default list of common package managers**，
否则 npm / GitHub 也会一起被挡。

> 注意：`db.<ref>.supabase.co:5432` 加进白名单也没用——代理只转 443。

### 2. 环境变量框（只贴这些）

这一段全部非机密：anon key 本来就要发到浏览器靠 RLS 兜底，
`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` 本来就写在仓库的 `.vercel/project.json` 里。

```env
NEXT_PUBLIC_SUPABASE_URL=https://<你的-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
NEXT_PUBLIC_SITE_URL=https://guiye-admin.com
SUPABASE_PROJECT_ID=<你的-ref>
VERCEL_ORG_ID=team_xxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxx
NEXT_TELEMETRY_DISABLED=1
VERCEL_TELEMETRY_DISABLED=1
```

### 3. 令牌：三种放法，按风险选

| 放法 | 风险 | 适合 |
| --- | --- | --- |
| 不放，需要时在会话里临时 `export` | 只落在该会话 transcript | 偶尔手动发版 |
| 放环境变量框 | 该环境所有使用者可读，长期留存 | 个人独占环境 + 短期令牌 |
| 不放，改用方案一 | 无 | 常态 |

真要放进框里，请：
- Vercel 令牌 Scope 选**单个项目**、有效期选最短（vercel.com/account/tokens）
- Supabase PAT 权限等同整个账号，**用完立刻吊销**（supabase.com/dashboard/account/tokens）
- 任务结束后回来清空这两个值

```env
VERCEL_TOKEN=<短期、限本项目>
SUPABASE_ACCESS_TOKEN=<用完即吊销>
```

`SUPABASE_SERVICE_ROLE_KEY` 无论哪种方案都**不建议**进容器——
它绕过全部 RLS，而容器里没有任何一段代码需要它（应用跑在 Vercel 上）。

### 4. Setup script 框

贴 [`scripts/cloud-setup.sh`](../scripts/cloud-setup.sh) 的内容。它装依赖、装两个 CLI，
并在启动日志里打印三个域名的可达性——网络策略没配对时一眼能看出来，
不用等到每条命令都撞 403。

---

## GitHub 到底能干什么

GitHub 不走上面那份域名白名单，它有自己的代理。但「能用」分三层，实测结果：

| 路径 | 结果 | 说明 |
| --- | --- | --- |
| `git clone` / `fetch` / `push` | ✅ | 本项目两次提交都是这么推上去的 |
| Claude 自带的 GitHub 工具 | ✅ | 读 issue / PR、列分支、发评论都正常 |
| `curl $GH_TOKEN api.github.com/user` | ✅ | 代理会把占位符换成真凭据，返回真实用户名 |
| `curl $GH_TOKEN api.github.com/repos/{owner}/{repo}` | ❌ 403 | `GitHub access is not enabled for this session. An org admin must connect the Claude GitHub App for this organization.` |
| `curl $GH_TOKEN api.github.com/user/repos` | ❌ 403 | `sessions are bound to their configured repositories` |
| GraphQL | ❌ 403 | 只服务 PR review 相关的固定几个操作，Projects v2 之类够不到 |
| 未挂载的仓库 | ❌ 403 | 要先把仓库挂进会话 |

也就是说：**推代码没问题，Claude 自己调 API 没问题，但你写的脚本直接打 REST 仓库接口会被拒。**
用 `access: "push"` 重新挂载也不解决——这是账号层面没连 GitHub App，不是挂载方式的问题。

脚本确实需要调 GitHub API 时，二选一：

1. 装并授权 [Claude GitHub App](https://github.com/apps/claude)（顺带也是 PR 自动修复的前提）
2. 自己配一个真的 PAT 到 `GITHUB_TOKEN` —— 注意它和其他令牌一样，在环境变量框里是明文可读的

CI/CD 一般用不上：推分支触发 Vercel 构建这条链路只需要 `git push`，那是通的。

---

## 进容器后

```bash
npm run env:check      # 逐项验证变量 / 出网 / 令牌，失败会指向具体修法
```

确认全绿后：

```bash
# 迁移（默认干跑，只列出将要执行的，确认后再 --apply）
npm run db:push
npm run db:push -- --apply

# 部署
npx vercel pull --yes --environment=production
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

`vercel` / `supabase` CLI 会自动读取 `VERCEL_TOKEN` / `SUPABASE_ACCESS_TOKEN`，
不要用 `--token` 传参——那会进 shell 历史和进程列表。

---

## 排错

| 现象 | 原因 | 修法 |
| --- | --- | --- |
| `403 CONNECT tunnel failed` | 网络策略没放行该域名 | 加进 Custom 白名单 |
| `fetch failed`（Node 脚本） | Node 内置 fetch 不读 `HTTPS_PROXY` | 本仓库脚本已自动设 `NODE_USE_ENV_PROXY=1`；自己写的脚本要记得设 |
| `supabase db push` 连不上 | 5432 裸 TCP，代理不支持 | 改用 `npm run db:push` |
| `echo $GH_TOKEN` 打印 `proxy-injected` | 正常，代理在替换真凭据 | 不用管；除非脚本要拿真 token 调 API |
| 会话起不来 | Setup script 非零退出 | 非关键命令加 `|| true` |
| 改了环境变量但没生效 | 变量只在会话启动时复制一次 | 重开会话 |

诊断出网问题：`curl -sS "$HTTPS_PROXY/__agentproxy/status"`，
`recentRelayFailures` 会列出最近被拒的域名。
