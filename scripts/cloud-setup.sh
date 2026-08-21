#!/bin/bash
# Claude Cloud 环境的 Setup script —— 把这份内容贴进环境对话框的 Setup script 框。
#
# 约束（来自官方文档）：
#   · 必须以 0 退出，否则会话起不来 → 非关键命令一律 || true
#   · 总时长控制在 5 分钟内，否则环境缓存建不起来
#   · 只在没有环境缓存时跑一次，跑在 Claude 启动之前
#
# Node 22 / npm / git / jq / PostgreSQL 客户端都是预装的，不用管。

set -u

echo "→ 安装项目依赖"
npm ci --no-audit --fund=false || npm install --no-audit --fund=false || true

# supabase CLI 容器里默认没有。装了不等于能用——还要环境的 Network access
# 放行 *.supabase.com / *.supabase.co，见 docs/cloud-container.md。
echo "→ 安装 supabase CLI"
npm i -g supabase@latest > /tmp/install-supabase.log 2>&1 \
  || echo "  ⚠ supabase CLI 安装失败（见 /tmp/install-supabase.log），不阻塞会话"

echo "→ 版本"
node --version
command -v supabase >/dev/null && supabase --version || echo "  supabase: 未安装"

# 出网探针。失败不该拦住会话启动，但要在启动日志里留下明确证据，
# 免得后面每个命令都撞 403 才发现是网络策略没配。
echo "→ 出网检查"
for host in api.github.com api.supabase.com; do
  code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "https://$host/" 2>/dev/null || echo "000")
  if [ "$code" = "000" ]; then
    echo "  ✗ $host 不可达 —— 环境 Network access 需设为 Custom 并加入该域名"
  else
    echo "  ✓ $host (HTTP $code)"
  fi
done

exit 0
