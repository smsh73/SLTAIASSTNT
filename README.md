# 솔트룩스 AI 어시스턴트 통합 그룹웨어

## 기술 스택

- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS
- **백엔드**: Node.js + Express + TypeScript
- **데이터베이스**: PostgreSQL
- **파일 저장**: AWS S3
- **코드 실행**: Docker 컨테이너

## 시작하기

### 사전 요구사항

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (또는 Docker 사용)

### 설치

1. 데이터베이스 시작:
```bash
docker-compose up -d postgres
```

2. 백엔드 설정:
```bash
cd backend
npm install
cp .env.example .env
# .env 파일 수정
npm run dev
```

3. 프론트엔드 설정:
```bash
cd frontend
npm install
npm run dev
```

## 프로젝트 구조

```
SLTAIASSTNT/
├── frontend/          # React 프론트엔드
├── backend/           # Node.js 백엔드
├── docker/            # Docker 설정
├── database/          # 데이터베이스 스키마
└── docs/              # 문서
```

