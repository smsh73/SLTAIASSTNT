#!/bin/bash

# 데이터베이스 복원 스크립트
# 200% 완성도 버전

set -e

if [ -z "$1" ]; then
    echo "사용법: $0 <백업파일경로>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ 백업 파일을 찾을 수 없습니다: $BACKUP_FILE"
    exit 1
fi

echo "🚀 데이터베이스 복원 시작..."
echo "📦 백업 파일: $BACKUP_FILE"

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

# 압축 해제 (필요한 경우)
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "📂 백업 파일 압축 해제 중..."
    TEMP_FILE="${BACKUP_FILE%.gz}"
    gunzip -c $BACKUP_FILE > $TEMP_FILE
    BACKUP_FILE=$TEMP_FILE
fi

# 복원 확인
read -p "⚠️  데이터베이스를 복원하면 기존 데이터가 삭제됩니다. 계속하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 복원이 취소되었습니다."
    exit 1
fi

# 데이터베이스 복원
echo "🔄 데이터베이스 복원 중..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres < $BACKUP_FILE

# 임시 파일 삭제
if [ -f "$TEMP_FILE" ]; then
    rm $TEMP_FILE
fi

echo "✅ 데이터베이스 복원 완료!"

