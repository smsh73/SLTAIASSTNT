#!/bin/bash

# Cron 작업 설정 스크립트
# 200% 완성도 버전

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Cron 작업 설정 시작..."

# Cron 작업 추가
(crontab -l 2>/dev/null; cat <<EOF

# AI Assistant 데이터베이스 관리 작업
# 매일 새벽 2시 백업
0 2 * * * cd $PROJECT_DIR && bash $SCRIPT_DIR/backup-db.sh >> /var/log/ai-assistant-backup.log 2>&1

# 매주 일요일 새벽 3시 최적화
0 3 * * 0 cd $PROJECT_DIR && bash $SCRIPT_DIR/optimize-db.sh >> /var/log/ai-assistant-optimize.log 2>&1

# 매일 새벽 4시 오래된 로그 정리
0 4 * * * psql \$DATABASE_URL -c "SELECT cleanup_old_logs();" >> /var/log/ai-assistant-cleanup.log 2>&1

# 매일 새벽 5시 만료된 세션 정리
0 5 * * * psql \$DATABASE_URL -c "SELECT cleanup_expired_sessions();" >> /var/log/ai-assistant-session-cleanup.log 2>&1

# 매일 새벽 6시 통계 집계
0 6 * * * psql \$DATABASE_URL -c "SELECT aggregate_ai_request_stats();" >> /var/log/ai-assistant-stats.log 2>&1

EOF
) | crontab -

echo "✅ Cron 작업 설정 완료!"
echo ""
echo "설정된 작업:"
crontab -l | grep "AI Assistant"

