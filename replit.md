# Saltlux AI Assistant

## Overview

A fullstack AI assistant application with a React + Vite frontend and Node.js + Express backend. The application provides AI chat capabilities, document management, code generation/execution, and workflow automation.

## Project Structure

```
/
├── frontend/           # React + Vite frontend (port 5000)
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── store/      # Zustand state management
│   │   └── types/      # TypeScript types
│   └── vite.config.ts  # Vite configuration
├── backend/            # Node.js + Express backend (port 3001)
│   ├── src/
│   │   ├── routes/     # API routes
│   │   ├── services/   # Business logic services
│   │   ├── middleware/ # Express middleware
│   │   └── utils/      # Utility functions
│   └── prisma/         # Prisma ORM schema
├── database/           # Database scripts and schema
└── package.json        # Root package.json with concurrently
```

## Technology Stack

- **Frontend**: React 18, Vite 5, TypeScript, TailwindCSS, Zustand
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL (Neon)
- **AI Services**: OpenAI, Claude, Gemini, Perplexity, Luxia (configurable)

## Development

Run the application:
```bash
npm run dev
```

This starts both frontend (port 5000) and backend (port 3001) concurrently.

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (min 32 characters)
- `ENCRYPTION_MASTER_KEY` - 64-character hex string for encryption

### Optional
- `REDIS_URL` - Redis connection for caching
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` - S3 storage
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` - Email notifications
- `SLACK_WEBHOOK_URL` - Slack notifications
- `ALLOWED_ORIGINS` - CORS allowed origins

## API Documentation

Access Swagger API docs at `/api-docs` when the backend is running.

## Chat Modes

The application supports three chat modes:

| Mode | Description |
|------|-------------|
| **일반 (Normal)** | Single AI provider responds to queries |
| **Mix of Agents** | Multiple AI providers respond separately for comparison |
| **A2A 협력 토론** | Agent-to-Agent collaborative mode with multi-round discussion |

### A2A Mode Details

The A2A (Agent-to-Agent) mode enables collaborative conversation among multiple AI agents:

1. **Phase 1: Collaboration (2 rounds)** - Each agent (OpenAI, Claude, Gemini, Perplexity) shares insights, building on previous contributions
2. **Phase 2: Debate (2 rounds)** - Agents critique and improve upon the discussion, identifying gaps and proposing enhancements
3. **Phase 3: Synthesis** - Luxia AI synthesizes all contributions into a comprehensive final answer

## Recent Changes

- **2025-11-29**: AI Model Updates & Client Caching Fix
  - Updated Gemini model from deprecated `gemini-pro` to `gemini-1.5-flash`
  - Updated Perplexity model from deprecated `llama-3-sonar-large-32k-online` to `sonar-pro`
  - Fixed API client caching: clients now invalidate when API key changes

- **2025-11-29**: A2A (Agent-to-Agent) Mode Implementation
  - Added chat mode selector with Normal/Mix/A2A options
  - Implemented A2A orchestration: 2 collaboration rounds + 2 debate rounds + Luxia synthesis
  - Streaming support with progressive word-by-word output for A2A responses
  - Fallback to Claude if Luxia synthesis fails

- **2025-11-29**: Luxia API & Provider Auto-Display
  - Updated Luxia API to match official documentation (https://bridge.luxiacloud.com/luxia/v1/chat)
  - Changed authentication from Bearer token to `apikey` header as per Luxia spec
  - Added streaming support for Luxia with fallback to non-streaming on error
  - AI provider dropdown now automatically shows only providers with stored API keys

- **2025-11-29**: System Configuration & Security Improvements
  - Added admin settings API (`/api/admin/settings`) for managing system configuration
  - Implemented local code execution mode with security validation patterns
  - Added CODE_EXECUTION_MODE toggle (local/docker) - admin controlled
  - Added CODE_EXECUTION_ENABLED toggle to enable/disable code execution
  - Implemented local file storage (`/uploads`) replacing S3 dependency
  - Added security patterns to block dangerous code (subprocess, os.system, etc.)
  - Created SystemSettings model in database for persistent configuration

- **2025-11-28**: Enhanced Chat Features
  - Added AI provider selection dropdown (OpenAI, Claude, Gemini, Perplexity, Luxia)
  - Implemented file upload UI with document context support
  - Added Mix of Agents mode for comparing responses from multiple AI providers
  - Added `/api/ai/providers` endpoint for retrieving active AI providers
  - Updated streaming orchestrator to support provider selection and mix mode

- **2025-11-28**: Initial Replit migration
  - Configured Vite for Replit (port 5000, allow all hosts)
  - Changed backend port to 3001 to avoid conflict
  - Fixed Prisma schema for PostgreSQL compatibility (removed MySQL-only features)
  - Fixed circular dependency in logger/database modules
  - Added missing imports in route files
  - Set up deployment configuration

## Admin Settings

The following system settings can be configured via `/api/admin/settings`:

| Key | Default | Description |
|-----|---------|-------------|
| CODE_EXECUTION_MODE | local | Code execution mode (local/docker) |
| CODE_EXECUTION_ENABLED | false | Enable/disable code execution (disabled by default for security) |
| CODE_EXECUTION_TIMEOUT | 30000 | Execution timeout in milliseconds |
| STORAGE_MODE | local | File storage mode (local/s3) |
| MAX_FILE_SIZE | 52428800 | Max upload file size (50MB) |
| AI_DEFAULT_PROVIDER | auto | Default AI provider |
| AI_MIX_OF_AGENTS_ENABLED | true | Enable Mix of Agents mode |
