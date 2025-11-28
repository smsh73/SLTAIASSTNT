#!/bin/bash

# Prisma 스키마 생성 및 마이그레이션 스크립트
# 200% 완성도 버전

set -e

echo "🚀 Prisma 스키마 생성 시작..."

# Prisma 클라이언트 생성
echo "📦 Prisma 클라이언트 생성 중..."
npx prisma generate

echo "✅ Prisma 클라이언트 생성 완료"

# 마이그레이션 생성
echo "📝 마이그레이션 생성 중..."
npx prisma migrate dev --name init

echo "✅ 마이그레이션 생성 완료"

# 데이터베이스 시각화 (선택사항)
if command -v prisma-studio &> /dev/null; then
    echo "🎨 Prisma Studio 실행 중..."
    echo "   브라우저에서 http://localhost:5555 접속"
    npx prisma studio &
fi

echo "🎉 스키마 생성 완료!"

