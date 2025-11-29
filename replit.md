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
- **AI Services**: OpenAI, Claude, Gemini, Perplexity (configurable)

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

## Recent Changes

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
