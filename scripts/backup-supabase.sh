#!/bin/bash
# =============================================================================
# Supabase 数据库备份脚本（方案B：Free tier 外部备份）
# 用途：通过 pg_dump 备份核心表，上传至阿里云 OSS
# 部署位置：/opt/scripts/backup-supabase.sh（ECS 服务器）
# cron 示例：0 2 * * * root /opt/scripts/backup-supabase.sh >> /var/log/supabase-backup.log 2>&1
# =============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# 配置（从环境变量或 .env.production 读取）
# ----------------------------------------------------------------------------
ENV_FILE="${ENV_FILE:-/root/content-repurposer/.env.production}"

if [[ -f "$ENV_FILE" ]]; then
  # 使用 || true 防止 set -e 在 key 不存在时中止
  _raw=$(grep '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null || true)
  if [[ -n "$_raw" ]]; then
    _val="${_raw#DATABASE_URL=}"
    # 只剥离最外层的单引号或双引号，不修改值内部字符
    _val="${_val#\"}" ; _val="${_val%\"}"
    _val="${_val#\'}" ; _val="${_val%\'}"
    DATABASE_URL="$_val"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[ERROR] DATABASE_URL is not set. Check $ENV_FILE or set the environment variable."
  exit 1
fi

OSS_BUCKET="${OSS_BUCKET:-your-bucket}"
OSS_PATH="${OSS_PATH:-backups/content-repurposer}"
OSSUTIL_CONFIG="${OSSUTIL_CONFIG:-/root/.ossutilconfig}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 验证 OSS_BUCKET 已配置（防止使用未修改的占位符值）
if [[ "$OSS_BUCKET" == "your-bucket" ]]; then
  echo "[ERROR] OSS_BUCKET is not configured. Set the OSS_BUCKET environment variable."
  exit 1
fi

# ----------------------------------------------------------------------------
# 备份执行
# ----------------------------------------------------------------------------
# mktemp 确保文件名不可预测，防止 /tmp 符号链接攻击
BACKUP_FILE=$(mktemp /tmp/content-repurposer-XXXXXX.sql.gz)

# 无论脚本以何种方式退出（正常或异常），总是清理本地临时文件
trap 'rm -f "${BACKUP_FILE:-}"' EXIT

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: $BACKUP_FILE"

# 捕获 pg_dump | gzip 各自的退出码
# 临时关闭 errexit 以便访问 PIPESTATUS（pipefail 仍有效）
set +e
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --table=public.users \
  --table=public.rewrite_records \
  --table=public.rewrite_results \
  --table=public.platform_configs \
  | gzip > "$BACKUP_FILE"
_pipe_status=("${PIPESTATUS[@]}")
set -e

if [[ "${_pipe_status[0]}" -ne 0 ]]; then
  echo "[ERROR] pg_dump failed with exit code ${_pipe_status[0]}."
  exit 1
fi

if [[ "${_pipe_status[1]}" -ne 0 ]]; then
  echo "[ERROR] gzip compression failed with exit code ${_pipe_status[1]}."
  exit 1
fi

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "[ERROR] Backup file is empty. pg_dump produced no output."
  exit 1
fi

# 验证 gzip 归档完整性，防止损坏文件被上传
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "[ERROR] Backup archive failed integrity check (corrupt gzip)."
  exit 1
fi

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# ----------------------------------------------------------------------------
# 上传至阿里云 OSS
# ----------------------------------------------------------------------------
if ! command -v ossutil &>/dev/null; then
  echo "[ERROR] ossutil not found. Cannot upload backup to OSS."
  echo "[ERROR] Install ossutil: https://help.aliyun.com/zh/oss/developer-reference/ossutil"
  exit 1
fi

ossutil cp "$BACKUP_FILE" "oss://${OSS_BUCKET}/${OSS_PATH}/" \
  --config-file "$OSSUTIL_CONFIG"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploaded to OSS: oss://${OSS_BUCKET}/${OSS_PATH}/$(basename "$BACKUP_FILE")"

# ----------------------------------------------------------------------------
# 清理 OSS 上超过保留天数的备份
# ----------------------------------------------------------------------------
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning OSS backups older than ${RETENTION_DAYS} days..."
if ossutil rm "oss://${OSS_BUCKET}/${OSS_PATH}/" \
    --config-file "$OSSUTIL_CONFIG" \
    --recursive \
    --include "content-repurposer-*.sql.gz" \
    --older-than "${RETENTION_DAYS}d" \
    --force 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OSS retention cleanup completed."
else
  echo "[WARN] OSS retention cleanup returned non-zero (no expired files, or check ossutil version compatibility)."
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully."
