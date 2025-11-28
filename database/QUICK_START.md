# 데이터베이스 빠른 시작 가이드

## 200% 완성도 스키마 설정

### 1단계: 환경 변수 설정

```bash
# .env 파일 생성
cat > backend/.env <<EOF
DATABASE_URL="postgresql://user:password@localhost:5432/saltlux_ai"
JWT_SECRET="your-secret-key-here"
ENCRYPTION_MASTER_KEY="your-32-byte-hex-key-here"
REDIS_URL="redis://localhost:6379"
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_REGION="ap-northeast-2"
S3_BUCKET_NAME="saltlux-ai-documents"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-password"
SMTP_FROM="your-email@gmail.com"
ADMIN_EMAILS="admin@saltlux.com"
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/your/webhook/url"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
EOF
```

### 2단계: 데이터베이스 생성

```bash
# PostgreSQL에 데이터베이스 생성
createdb saltlux_ai

# 또는 psql 사용
psql -U postgres -c "CREATE DATABASE saltlux_ai;"
```

### 3단계: 스키마 생성

#### 방법 1: SQL 스크립트 사용 (권장)

```bash
cd database
export DATABASE_URL="postgresql://user:password@localhost:5432/saltlux_ai"
./scripts/init-db.sh
```

#### 방법 2: Prisma 사용

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 4단계: 시드 데이터 생성

```bash
cd database
./scripts/init-db.sh --seed

# 또는 Prisma 사용
cd backend
npm run prisma:seed
```

### 5단계: 확인

```bash
# 데이터베이스 모니터링
cd database
./scripts/monitor-db.sh

# Prisma Studio 실행
cd backend
npm run prisma:studio
```

## 기본 계정

- **관리자**: admin@saltlux.com / admin123
- **테스트 사용자**: test@saltlux.com / test123

## 다음 단계

1. 백엔드 서버 시작: `cd backend && npm run dev`
2. 프론트엔드 시작: `cd frontend && npm run dev`
3. API 문서 확인: http://localhost:5000/api-docs
4. 메트릭 확인: http://localhost:5000/metrics

## 문제 해결

### 연결 오류
```bash
# PostgreSQL 서비스 확인
sudo systemctl status postgresql

# 연결 테스트
psql $DATABASE_URL -c "SELECT 1"
```

### 마이그레이션 오류
```bash
# Prisma 마이그레이션 리셋 (주의: 데이터 삭제됨)
cd backend
npx prisma migrate reset

# 새로 마이그레이션
npx prisma migrate dev
```

### 권한 오류
```bash
# PostgreSQL 사용자 권한 부여
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE saltlux_ai TO your_user;"
psql -U postgres -d saltlux_ai -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;"
```

