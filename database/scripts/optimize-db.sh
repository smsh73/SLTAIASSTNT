#!/bin/bash

# 데이터베이스 최적화 스크립트
# 200% 완성도 버전

set -e

echo "🚀 데이터베이스 최적화 시작..."

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

echo "📊 데이터베이스 최적화 중..."

# VACUUM 및 ANALYZE 실행
echo "🧹 VACUUM 실행 중..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
VACUUM ANALYZE;
EOF

# 인덱스 재구성
echo "🔧 인덱스 재구성 중..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
REINDEX DATABASE $DB_NAME;
EOF

# 통계 업데이트
echo "📈 통계 업데이트 중..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
ANALYZE;
EOF

echo "✅ 데이터베이스 최적화 완료!"

