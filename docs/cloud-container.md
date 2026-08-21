# 在 Claude Cloud 容器里读写 Supabase + 推 git

面向「新开一个 Claude Cloud 环境，容器能读写 Supabase、能推代码」这件事。不涉及 Vercel。

先说三条会直接卡住你的事实，都是在容器里实测出来的：

| 事实 | 后果 | 对策 |
| --- | --- | --- |
| 默认 **Trusted** 网络策略不含 Supabase | 所有请求收 `403 CONNECT tunnel failed`，与 key 是否正确无关 | 环境改 **Custom** 并加白名单 |
| 环境变量框**没有密钥存储**，值对该环境所有使用者可读 | 写库要用的 service_role key 只能明文放在那儿 | 见下方「写权限怎么放」 |
| 出网代理只转 443 HTTPS，不支持裸 TCP | `supabase db push`（5432 直连）必然失败 | 用 `npm run db:push`，走 Management API |

官方原话（[Cloud environments](https://code.claude.com/docs/en/cloud-environments)）：
> Anyone who uses the environment can read the values, and cloud environments have no dedicated secrets store, so don't add API keys or other credentials.

---

## 1. 网络访问

环境对话框 → **Network access** 选 **Custom**，**Allowed domains** 一行一个：

```
api.supabase.com
supabase.com
*.supabase.com
*.supabase.co
```

勾上 **Also include default list of common package managers**，否则 npm 会被一起挡掉。

> `db.<ref>.supabase.co:5432` 加进白名单也没用 —— 代理只转 443。

GitHub 不用加：它走独立代理，不受这份白名单管。

---

## 2. 环境变量框

非机密的部分，直接贴：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<你的-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_PROJECT_ID=<你的-ref>
NEXT_PUBLIC_SITE_URL=https://guiye-admin.com
NEXT_TELEMETRY_DISABLED=1
```

anon key 本来就要发到浏览器、靠 RLS 兜底，放这儿没问题。

---

## 3. 写权限怎么放

当前 RLS 只有 `for select using (true)` —— **anon key 只能读，写不了任何表**。
所以容器要写库，必须给它一个真机密，没有绕过的办法。两个候选：

| 变量 | 能干什么 | 权限范围 |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | 数据面读写，绕过全部 RLS | 本项目数据库 |
| `SUPABASE_ACCESS_TOKEN`（PAT） | 跑迁移、执行任意 SQL | **整个 Supabase 账号**，比上面那个还大 |

放法三选一：

**只读** —— 两个都不填，A 段的 anon key 就够，容器里一个机密都没有。

**偶尔写** —— 不存进环境变量框，需要时在会话里临时给：

```bash
export SUPABASE_SERVICE_ROLE_KEY='...'
npm run admin:create -- --email you@guiye.com --password '...' --name 你的名字
```

值只落在这一次会话，环境配置里不留痕。缺点是每次都要重贴。

**常态写** —— 存进框里，接受它可读。个人独占的环境里「可读」= 只有你自己可读，
风险有限；但环境一旦分享或被别人用，这个 key 就一起给出去了。建议定期轮换。

PAT 尤其建议用完就吊销 —— 它是账号级权限，泄漏的代价比 service_role key 大。

---

## 4. Setup script 框

贴 [`scripts/cloud-setup.sh`](../scripts/cloud-setup.sh) 的内容。装依赖、装 supabase CLI，
并在启动日志里打印域名可达性 —— 网络策略没配对时一眼能看出来，
不用等到每条命令都撞 403。

---

## 进容器后

```bash
npm run env:check      # 逐项验证变量 / 出网 / 令牌，失败会指向具体修法
```

绿了之后：

```bash
# 迁移（默认干跑只列清单，确认后再 --apply）
npm run db:push
npm run db:push -- --apply

# 连通性与表结构体检（只用 anon key）
npm run db:check

# 建管理员账号（需要 service_role key）
npm run admin:create -- --email you@guiye.com --password '...' --name 你的名字
```

---

## git 能干什么

GitHub 走独立代理。实测结果：

| 路径 | 结果 | 说明 |
| --- | --- | --- |
| `git clone` / `fetch` / `push` | ✅ | 本项目的提交都是这么推上去的 |
| Claude 自带的 GitHub 工具 | ✅ | 读 issue / PR、列分支、发评论都正常 |
| `curl $GH_TOKEN .../user` | ✅ | 代理把占位符换成真凭据 |
| `curl $GH_TOKEN .../repos/{owner}/{repo}` | ❌ 403 | `An org admin must connect the Claude GitHub App for this organization.` |
| `curl $GH_TOKEN .../user/repos` | ❌ 403 | `sessions are bound to their configured repositories` |
| GraphQL | ❌ 403 | 只服务 PR review 那几个固定操作 |

**推代码没问题，Claude 自己调 API 没问题，你写的脚本直接打 REST 仓库接口会被拒。**
用 `access: "push"` 重新挂载也不解决 —— 是账号层面没连 GitHub App。

脚本确实要调 GitHub API 才需要处理：装 [Claude GitHub App](https://github.com/apps/claude)，
或自己配一个真 PAT 到 `GITHUB_TOKEN`（同样明文可读）。

---

## 排错

| 现象 | 原因 | 修法 |
| --- | --- | --- |
| `403 CONNECT tunnel failed` | 网络策略没放行该域名 | 加进 Custom 白名单 |
| `fetch failed`（Node 脚本） | Node 内置 fetch 不读 `HTTPS_PROXY` | 本仓库脚本已自动设 `NODE_USE_ENV_PROXY=1`；自己写的要记得设 |
| 403 但分不清是被墙还是令牌错 | 两者状态码一样 | 看响应头 `x-deny-reason`：有值就是出网被拦 |
| 表能读不能写 | RLS 只有 select 策略 | 用 service_role key，或补写策略 |
| `supabase db push` 连不上 | 5432 裸 TCP，代理不支持 | 改用 `npm run db:push` |
| `echo $GH_TOKEN` 打印 `proxy-injected` | 正常，代理在替换真凭据 | 不用管 |
| 会话起不来 | Setup script 非零退出 | 非关键命令加 `\|\| true` |
| 改了环境变量但没生效 | 变量只在会话启动时复制一次 | 重开会话 |

诊断出网最可靠的办法是看被拒响应自己带的头：

```bash
curl -sSI https://api.supabase.com/v1/projects | grep -i x-deny-reason
# x-deny-reason: host_not_allowed   ← 出网被拦
```

`curl -sS "$HTTPS_PROXY/__agentproxy/status"` 里的 `recentRelayFailures` 也能看，
但那是个滚动窗口，隔一会儿记录就没了，别拿它当准。
