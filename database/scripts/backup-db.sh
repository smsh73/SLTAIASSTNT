#!/bin/bash

# 데이터베이스 백업 스크립트
# 200% 완성도 버전

set -e

echo "🚀 데이터베이스 백업 시작..."

# 환경 변수 확인
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL 환경 변수가 설정되지 않았습니다."
    exit 1
fi

# 백업 디렉토리 생성
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# 백업 파일명 생성
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# PostgreSQL 연결 정보 파싱
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "📦 백업 생성 중: $BACKUP_FILE"

# pg_dump 실행
PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    --clean --if-exists --create --format=plain \
    --file=$BACKUP_FILE

# 백업 파일 압축
echo "🗜️  백업 파일 압축 중..."
gzip $BACKUP_FILE
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "✅ 백업 완료: $BACKUP_FILE"

# 오래된 백업 파일 삭제 (30일 이상)
echo "🧹 오래된 백업 파일 정리 중..."
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "🎉 백업 프로세스 완료!"

