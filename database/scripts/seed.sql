-- 시드 데이터
-- 200% 완성도 버전

-- 관리자 사용자 생성 (비밀번호: admin123)
INSERT INTO users (email, password_hash, name, role, is_active) VALUES
('admin@saltlux.com', '$2b$10$rOzJqZqZqZqZqZqZqZqZqOqZqZqZqZqZqZqZqZqZqZqZqZqZqZq', '관리자', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- 기본 가드레일 규칙
INSERT INTO guardrails (name, description, pattern, action, is_active, priority) VALUES
('금지어 필터', '부적절한 언어 사용 차단', '(?i)(욕설|비방|혐오)', 'block', true, 10),
('개인정보 보호', '개인정보 포함 차단', '(?i)(주민등록번호|신용카드|계좌번호)', 'block', true, 9),
('시스템 명령 차단', '시스템 명령 실행 차단', '(?i)(rm -rf|format|delete|drop)', 'block', true, 8),
('SQL Injection 방어', 'SQL Injection 시도 차단', '(?i)(union|select|insert|delete|update|drop|create|alter).*(from|into|table)', 'block', true, 7)
ON CONFLICT DO NOTHING;

-- 기본 MCP 연결 예시
INSERT INTO mcp_connections (name, server_url, server_type, is_active) VALUES
('Example MCP Server', 'http://localhost:8080/mcp', 'http', false)
ON CONFLICT (name) DO NOTHING;

-- 통계 초기화
INSERT INTO ai_request_stats (provider, date, request_count, success_count, error_count, total_tokens)
SELECT 
    'openai' as provider,
    CURRENT_DATE as date,
    0 as request_count,
    0 as success_count,
    0 as error_count,
    0 as total_tokens
ON CONFLICT (provider, date) DO NOTHING;

