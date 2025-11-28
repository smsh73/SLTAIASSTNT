# 데이터베이스 관리 가이드

## 200% 완성도 스키마

이 디렉토리에는 완벽하게 최적화된 데이터베이스 스키마와 관리 스크립트가 포함되어 있습니다.

## 디렉토리 구조

```
database/
├── schema.sql              # 기본 SQL 스키마
├── migrations/             # 마이그레이션 파일
│   └── 001_initial_schema.sql
├── scripts/                # 관리 스크립트
│   ├── init-db.sh          # 데이터베이스 초기화
│   ├── seed.sql            # 시드 데이터
│   ├── optimize-db.sh       # 데이터베이스 최적화
│   ├── backup-db.sh        # 백업
│   └── restore-db.sh       # 복원
└── README.md               # 이 파일
```

## 빠른 시작

### 1. 데이터베이스 초기화

```bash
# 환경 변수 설정
export DATABASE_URL="postgresql://user:password@localhost:5432/saltlux_ai"

# 데이터베이스 초기화
./scripts/init-db.sh

# 시드 데이터 포함 초기화
./scripts/init-db.sh --seed
```

### 2. Prisma 마이그레이션

```bash
cd ../../backend
npm run prisma:migrate
# 또는
npx prisma migrate dev
```

### 3. 데이터베이스 백업

```bash
./scripts/backup-db.sh
```

### 4. 데이터베이스 복원

```bash
./scripts/restore-db.sh backups/backup_20240101_120000.sql.gz
```

### 5. 데이터베이스 최적화

```bash
./scripts/optimize-db.sh
```

## 스키마 특징

### 완벽한 인덱싱

- **기본 인덱스**: 모든 외래 키, 자주 조회되는 컬럼
- **복합 인덱스**: 자주 함께 조회되는 컬럼 조합
- **전문 검색 인덱스**: GIN 인덱스를 사용한 한국어 텍스트 검색
- **부분 인덱스**: 특정 조건의 데이터만 인덱싱

### 성능 최적화

- **JSONB 타입**: 메타데이터 및 유연한 데이터 저장
- **트리거**: updated_at 자동 업데이트
- **함수**: 로그 정리, 세션 정리, 통계 집계
- **뷰**: 복잡한 쿼리 최적화

### 데이터 무결성

- **외래 키 제약**: CASCADE, SET NULL 적절히 사용
- **UNIQUE 제약**: 중복 방지
- **CHECK 제약**: 데이터 유효성 검증
- **NOT NULL**: 필수 데이터 보장

### 확장성

- **파티셔닝 준비**: 날짜 기반 파티셔닝 가능
- **읽기 전용 사용자**: 보고서용 사용자 분리
- **통계 테이블**: 성능 모니터링용 별도 테이블

## 테이블 구조

### 핵심 테이블

1. **users**: 사용자 정보
2. **conversations**: 대화 세션
3. **messages**: 메시지
4. **documents**: 문서 메타데이터
5. **workflows**: 워크플로우

### 관리 테이블

6. **api_keys**: API 키 (암호화)
7. **guardrails**: 프롬프트 가드레일
8. **logs**: 시스템 로그
9. **sessions**: 사용자 세션

### 확장 테이블

10. **mcp_connections**: MCP 서버 연결
11. **workflow_executions**: 워크플로우 실행 이력
12. **cache_metadata**: 캐시 통계
13. **ai_request_stats**: AI 요청 통계

## 인덱스 전략

### B-Tree 인덱스
- 기본 조회용 (email, user_id, status 등)
- 범위 검색 최적화

### GIN 인덱스
- 전문 검색용 (content, name, title 등)
- 한국어 텍스트 검색 지원

### 복합 인덱스
- 자주 함께 조회되는 컬럼 조합
- 쿼리 성능 최적화

## 유지보수

### 정기 작업

1. **일일**: 로그 정리, 세션 정리
2. **주간**: 통계 집계, 인덱스 최적화
3. **월간**: 백업 검증, 성능 분석

### 자동화

```bash
# crontab 예시
0 2 * * * /path/to/scripts/backup-db.sh
0 3 * * 0 /path/to/scripts/optimize-db.sh
```

## 모니터링

### 주요 메트릭

- 테이블 크기
- 인덱스 사용률
- 쿼리 성능
- 연결 수
- 캐시 히트율

### 쿼리 예시

```sql
-- 테이블 크기 확인
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 인덱스 사용률 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 문제 해결

### 연결 문제
```bash
# PostgreSQL 서비스 상태 확인
sudo systemctl status postgresql

# 연결 테스트
psql $DATABASE_URL -c "SELECT 1"
```

### 성능 문제
```bash
# 느린 쿼리 확인
# PostgreSQL 설정에서 log_min_duration_statement 활성화

# 인덱스 재구성
./scripts/optimize-db.sh
```

### 백업/복원 문제
```bash
# 백업 파일 검증
pg_restore --list backup_file.sql

# 부분 복원
pg_restore --table=users backup_file.sql
```

## 보안

- API 키는 암호화되어 저장
- 비밀번호는 bcrypt 해싱
- 세션 토큰은 만료 시간 관리
- 로그에는 민감 정보 제외

## 참고 자료

- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)
- [Prisma 문서](https://www.prisma.io/docs)
- [인덱스 최적화 가이드](https://www.postgresql.org/docs/current/indexes.html)

