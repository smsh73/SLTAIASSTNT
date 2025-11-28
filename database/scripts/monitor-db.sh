#!/bin/bash

# 데이터베이스 모니터링 스크립트
# 200% 완성도 버전

set -e

echo "📊 데이터베이스 모니터링 리포트"
echo "================================"
echo ""

# 환경 변수 확인
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL 환경 변수가 설정되지 않았습니다."
    exit 1
fi

# PostgreSQL 연결 정보 파싱
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# 테이블 크기
echo "📦 테이블 크기:"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

echo ""
echo "📈 인덱스 사용률:"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;
"

echo ""
echo "👥 사용자 통계:"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_users,
    SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users
FROM users;
"

echo ""
echo "💬 대화 통계:"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    COUNT(*) as total_conversations,
    COUNT(DISTINCT user_id) as unique_users,
    AVG((SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id)) as avg_messages_per_conversation
FROM conversations;
"

echo ""
echo "📄 문서 통계:"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    type,
    COUNT(*) as count,
    pg_size_pretty(SUM(size)) as total_size
FROM documents
GROUP BY type
ORDER BY count DESC;
"

echo ""
echo "🤖 AI 요청 통계 (최근 7일):"
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    provider,
    SUM(request_count) as total_requests,
    SUM(success_count) as total_success,
    SUM(error_count) as total_errors,
    ROUND(100.0 * SUM(success_count) / NULLIF(SUM(request_count), 0), 2) as success_rate
FROM ai_request_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY provider
ORDER BY total_requests DESC;
"

echo ""
echo "✅ 모니터링 리포트 완료"

