-- 초기 스키마 마이그레이션
-- 200% 완성도 버전

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 텍스트 검색용

-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 대화 세션 테이블
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    topic VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 테이블
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    tokens INTEGER DEFAULT 0,
    model VARCHAR(100),
    provider VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 문서 테이블
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL,
    size BIGINT DEFAULT 0,
    s3_key VARCHAR(1000) NOT NULL,
    s3_url VARCHAR(2000),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API 키 테이블
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    weight DECIMAL(5,2) DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, created_by)
);

-- 워크플로우 테이블
CREATE TABLE workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    plan JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    current_step INTEGER DEFAULT 0,
    results JSONB DEFAULT '{}',
    errors JSONB DEFAULT '{}',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 로그 테이블
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    screen_name VARCHAR(255),
    screen_url VARCHAR(1000),
    caller_function VARCHAR(255),
    button_id VARCHAR(255),
    called_api VARCHAR(255),
    backend_api_url VARCHAR(1000),
    log_type VARCHAR(50) NOT NULL,
    message TEXT,
    error_code VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 가드레일 테이블
CREATE TABLE guardrails (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pattern TEXT NOT NULL,
    action VARCHAR(50) DEFAULT 'block',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 세션 테이블
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    refresh_token VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MCP 연결 테이블
CREATE TABLE mcp_connections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    server_url VARCHAR(1000) NOT NULL,
    server_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 워크플로우 실행 이력 테이블
CREATE TABLE workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL,
    step_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    error TEXT,
    duration INTEGER DEFAULT 0,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP
);

-- 캐시 메타데이터 테이블
CREATE TABLE cache_metadata (
    id SERIAL PRIMARY KEY,
    key VARCHAR(500) NOT NULL UNIQUE,
    prefix VARCHAR(100) NOT NULL,
    ttl INTEGER DEFAULT 3600,
    hit_count INTEGER DEFAULT 0,
    miss_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP,
    last_miss_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI 요청 통계 테이블
CREATE TABLE ai_request_stats (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    request_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_duration DECIMAL(10,3),
    total_tokens BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, date)
);

-- 인덱스 생성
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Conversations
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversations_topic ON conversations(topic);
CREATE INDEX idx_conversations_title_topic_gin ON conversations USING gin(to_tsvector('korean', coalesce(title, '') || ' ' || coalesce(topic, '')));

-- Messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_provider ON messages(provider);
CREATE INDEX idx_messages_content_gin ON messages USING gin(to_tsvector('korean', content));

-- Documents
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_conversation_id ON documents(conversation_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_name_gin ON documents USING gin(to_tsvector('korean', name));

-- API Keys
CREATE INDEX idx_api_keys_provider ON api_keys(provider);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_weight ON api_keys(weight);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);

-- Workflows
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_conversation_id ON workflows(conversation_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_at ON workflows(created_at);
CREATE INDEX idx_workflows_started_at ON workflows(started_at);
CREATE INDEX idx_workflows_name_gin ON workflows USING gin(to_tsvector('korean', name));

-- Logs
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_log_type ON logs(log_type);
CREATE INDEX idx_logs_created_at ON logs(created_at);
CREATE INDEX idx_logs_screen_name ON logs(screen_name);
CREATE INDEX idx_logs_backend_api_url ON logs(backend_api_url);
CREATE INDEX idx_logs_caller_function ON logs(caller_function);
CREATE INDEX idx_logs_message_gin ON logs USING gin(to_tsvector('korean', coalesce(message, '')));

-- Guardrails
CREATE INDEX idx_guardrails_is_active ON guardrails(is_active);
CREATE INDEX idx_guardrails_priority ON guardrails(priority);
CREATE INDEX idx_guardrails_action ON guardrails(action);
CREATE INDEX idx_guardrails_created_by ON guardrails(created_by);
CREATE INDEX idx_guardrails_name_description_gin ON guardrails USING gin(to_tsvector('korean', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);

-- MCP Connections
CREATE INDEX idx_mcp_connections_is_active ON mcp_connections(is_active);
CREATE INDEX idx_mcp_connections_server_type ON mcp_connections(server_type);
CREATE INDEX idx_mcp_connections_last_used_at ON mcp_connections(last_used_at);
CREATE INDEX idx_mcp_connections_name_gin ON mcp_connections USING gin(to_tsvector('korean', name));

-- Workflow Executions
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_step_id ON workflow_executions(step_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at);

-- Cache Metadata
CREATE INDEX idx_cache_metadata_prefix ON cache_metadata(prefix);
CREATE INDEX idx_cache_metadata_last_hit_at ON cache_metadata(last_hit_at);
CREATE INDEX idx_cache_metadata_created_at ON cache_metadata(created_at);

-- AI Request Stats
CREATE INDEX idx_ai_request_stats_provider ON ai_request_stats(provider);
CREATE INDEX idx_ai_request_stats_date ON ai_request_stats(date);

-- 함수 및 트리거
-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardrails_updated_at BEFORE UPDATE ON guardrails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_connections_updated_at BEFORE UPDATE ON mcp_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_metadata_updated_at BEFORE UPDATE ON cache_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_request_stats_updated_at BEFORE UPDATE ON ai_request_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 로그 정리 함수 (오래된 로그 자동 삭제)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 세션 정리 함수 (만료된 세션 삭제)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 통계 집계 함수
CREATE OR REPLACE FUNCTION aggregate_ai_request_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO ai_request_stats (provider, date, request_count, success_count, error_count, avg_duration, total_tokens)
    SELECT 
        provider,
        DATE(created_at) as date,
        COUNT(*) as request_count,
        SUM(CASE WHEN log_type = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN log_type = 'error' THEN 1 ELSE 0 END) as error_count,
        NULL as avg_duration,
        0 as total_tokens
    FROM logs
    WHERE log_type IN ('success', 'error')
        AND created_at >= CURRENT_DATE - INTERVAL '1 day'
        AND provider IS NOT NULL
    GROUP BY provider, DATE(created_at)
    ON CONFLICT (provider, date) 
    DO UPDATE SET
        request_count = ai_request_stats.request_count + EXCLUDED.request_count,
        success_count = ai_request_stats.success_count + EXCLUDED.success_count,
        error_count = ai_request_stats.error_count + EXCLUDED.error_count,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 뷰 생성
-- 사용자 활동 요약 뷰
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    u.id,
    u.email,
    u.name,
    COUNT(DISTINCT c.id) as conversation_count,
    COUNT(DISTINCT m.id) as message_count,
    COUNT(DISTINCT d.id) as document_count,
    MAX(m.created_at) as last_message_at,
    MAX(c.created_at) as last_conversation_at
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id
LEFT JOIN messages m ON m.user_id = u.id
LEFT JOIN documents d ON d.user_id = u.id
GROUP BY u.id, u.email, u.name;

-- AI 프로바이더 통계 뷰
CREATE OR REPLACE VIEW ai_provider_stats AS
SELECT 
    provider,
    COUNT(*) as total_requests,
    SUM(CASE WHEN log_type = 'success' THEN 1 ELSE 0 END) as success_count,
    SUM(CASE WHEN log_type = 'error' THEN 1 ELSE 0 END) as error_count,
    ROUND(100.0 * SUM(CASE WHEN log_type = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM logs
WHERE provider IS NOT NULL
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY provider;

-- 워크플로우 성공률 뷰
CREATE OR REPLACE VIEW workflow_success_rate AS
SELECT 
    status,
    COUNT(*) as total,
    ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM workflows
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY status;

-- 권한 설정
-- 읽기 전용 사용자 생성 (선택사항)
-- CREATE USER readonly_user WITH PASSWORD 'readonly_password';
-- GRANT CONNECT ON DATABASE your_database TO readonly_user;
-- GRANT USAGE ON SCHEMA public TO readonly_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- 코멘트 추가
COMMENT ON TABLE users IS '시스템 사용자 정보';
COMMENT ON TABLE conversations IS '대화 세션 정보';
COMMENT ON TABLE messages IS '대화 메시지';
COMMENT ON TABLE documents IS '업로드된 문서 메타데이터';
COMMENT ON TABLE api_keys IS 'AI 서비스 API 키 (암호화 저장)';
COMMENT ON TABLE workflows IS '워크플로우 정의 및 실행 상태';
COMMENT ON TABLE logs IS '시스템 로그';
COMMENT ON TABLE guardrails IS '프롬프트 가드레일 규칙';
COMMENT ON TABLE sessions IS '사용자 세션 정보';
COMMENT ON TABLE mcp_connections IS 'MCP 서버 연결 정보';
COMMENT ON TABLE workflow_executions IS '워크플로우 단계별 실행 이력';
COMMENT ON TABLE cache_metadata IS '캐시 메타데이터 및 통계';
COMMENT ON TABLE ai_request_stats IS 'AI 요청 통계 (일별 집계)';

