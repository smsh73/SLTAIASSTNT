#!/bin/bash

# 데이터베이스 초기화 스크립트
# 200% 완성도 버전

set -e

echo "🚀 데이터베이스 초기화 시작..."

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

echo "📊 데이터베이스 정보:"
echo "   호스트: $DB_HOST"
echo "   포트: $DB_PORT"
echo "   데이터베이스: $DB_NAME"
echo "   사용자: $DB_USER"

# 데이터베이스 존재 확인 및 생성
echo "🔍 데이터베이스 확인 중..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME"

echo "✅ 데이터베이스 준비 완료"

# 스키마 마이그레이션 실행
echo "📝 스키마 마이그레이션 실행 중..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ../migrations/001_initial_schema.sql

echo "✅ 스키마 마이그레이션 완료"

# Prisma 마이그레이션 실행
echo "🔄 Prisma 마이그레이션 실행 중..."
cd ../../backend
npx prisma migrate deploy

echo "✅ Prisma 마이그레이션 완료"

# 시드 데이터 생성 (선택사항)
if [ "$1" == "--seed" ]; then
    echo "🌱 시드 데이터 생성 중..."
    npx prisma db seed
    echo "✅ 시드 데이터 생성 완료"
fi

echo "🎉 데이터베이스 초기화 완료!"

