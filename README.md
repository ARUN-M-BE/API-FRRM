# API-FRRM — Dynamic REST APIs at the Edge

A Next.js 15 (App Router, TypeScript) application for managing dynamic REST APIs, deployed to Cloudflare Workers via `@opennextjs/cloudflare`, backed by Neon serverless PostgreSQL.

---

## ⚡ Features

- **Schema Isolation**: Each project gets its own isolated PostgreSQL schema with custom tables, UUID primary keys, and automatic timestamps.
- **Dynamic CRUD Endpoints**: Fully generated REST endpoints at `/api/p/{project}/{version}/{api}` supporting:
  - `POST`: Single or batch inserts (up to 100 items) with strict schema validation
  - `GET`: Filterable list queries with pagination (`limit`, `offset`)
  - `GET /:id`: Single record retrieval by UUID
  - `PUT /:id`: Full record replacement
  - `PATCH /:id`: Partial updates
  - `DELETE /:id`: Record deletion
- **Edge Security & PBKDF2**: Uses native Web Crypto `PBKDF2` (100,000 iterations, SHA-256) for password hashing and HMAC-SHA256 for tamper-proof session cookies—100% Cloudflare Workers runtime compatible with zero bcrypt CPU timeouts.
- **API Key Protection**: Every project is guarded by a cryptographically secure `x-api-key` header with constant-time verification.
- **Automated Health Monitoring**: Independent Cloudflare Cron Worker pings registered health check endpoints every 5 minutes, logs latency history, and sends state-change alerts (`UP` ↔ `DOWN`).
- **Multi-Channel Alerts**: Out-of-the-box dispatchers for **Telegram**, **Slack Webhooks**, **Discord Webhooks**, and **Resend (Email)**.
- **Interactive Workbench**: Built-in API Tester (lightweight Postman/Insomnia) with request history and response inspection.

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Cloudflare Edge"
        A["Next.js 15 App<br/>@opennextjs/cloudflare"] --> B["Route Handlers<br/>/api/p/{project}/{ver}/{api}"]
        A --> C["Dashboard Pages<br/>/dashboard/*"]
        A --> D["Auth Pages<br/>/login, /register"]
        A --> E["API Tester Page<br/>/tester"]
        F["Monitor Worker<br/>Cron every 5 min"] --> G["/api/cron/check"]
    end
    
    subgraph "Neon PostgreSQL"
        H["public schema<br/>users, projects, apis,<br/>api_checks, notify_channels"]
        I["project schemas<br/>shop_app.products_v1<br/>shop_app.orders_v2"]
    end
    
    B --> H
    B --> I
    G --> H
    G --> J["External Alerts<br/>Telegram, Slack,<br/>Discord, Resend"]
```

---

## 📂 Project Structure

```
API-FRRM/
├── .env.example                      # Sample environment variables
├── wrangler.jsonc                    # OpenNext Cloudflare Worker configuration
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies and build scripts
├── tsconfig.json                     # TypeScript configuration
├── README.md                         # Documentation
│
├── migrations/
│   └── 001_init.sql                  # PostgreSQL meta-tables DDL
│
├── monitor-worker/                   # Standalone Cloudflare Cron Worker
│   ├── wrangler.toml                 # Monitor worker configuration
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts                  # Scheduled cron handler
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout with Inter font
│   │   ├── page.tsx                  # Landing page
│   │   ├── globals.css               # Design system & glassmorphic styling
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # User login
│   │   │   └── register/page.tsx     # User registration
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx            # Sidebar navigation layout
│   │   │   ├── page.tsx              # Projects overview
│   │   │   ├── new/page.tsx          # Create project (Form Builder & JSON paste)
│   │   │   └── [project]/
│   │   │       ├── page.tsx          # Project detail: APIs & latency canvas chart
│   │   │       ├── apis/new/page.tsx # Add new API/table to project
│   │   │       └── settings/page.tsx # API key rotation & notification channels
│   │   │
│   │   ├── tester/page.tsx           # Interactive API tester workbench
│   │   │
│   │   └── api/
│   │       ├── auth/                 # Register, login, logout, me
│   │       ├── projects/             # Project CRUD & API management
│   │       ├── p/                    # Generated dynamic CRUD routes
│   │       └── cron/check/           # Scheduled monitoring endpoint
│   │
│   └── lib/
│       ├── db.ts                     # Neon HTTP serverless client
│       ├── auth.ts                   # PBKDF2 password hashing & verification
│       ├── session.ts                # HMAC-SHA256 cookie session management
│       ├── validators.ts             # Regex identifier & body validators
│       ├── schemas.ts                # Column type definitions
│       ├── api-key.ts                # API key generation & constant-time check
│       ├── notifications.ts          # Telegram, Slack, Discord, Resend dispatchers
│       ├── project-db.ts             # Schema & table DDL operations
│       └── middleware.ts             # Session & API key route guards
│
└── __tests__/
    ├── validators.test.ts            # Identifier, column & body validation tests
    └── crud.test.ts                  # PBKDF2, HMAC session & API key tests
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+
- A [Neon](https://neon.tech) Serverless PostgreSQL database
- A [Cloudflare](https://cloudflare.com) account (for deployment)

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your connection details:
```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=your-secure-random-64-character-string
CRON_SECRET=your-secure-cron-secret-string
TELEGRAM_BOT_TOKEN=your-optional-telegram-token
RESEND_API_KEY=your-optional-resend-key
```

### 3. Initialize Database Tables
Run the migration script in `migrations/001_init.sql` against your Neon database using the Neon Console SQL Editor or `psql`:
```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

### 4. Run Locally
```bash
# Install dependencies
npm install

# Run test suite
npm test

# Start Next.js development server
npm run dev
```
Visit `http://localhost:3000` to register your account and create projects.

---

## 🌐 Deployment to Cloudflare

### Deploying the Next.js Application
```bash
# Login to Cloudflare Wrangler
npx wrangler login

# Set your secrets on Cloudflare
npx wrangler secret put DATABASE_URL
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CRON_SECRET

# Build and deploy with OpenNext
npm run deploy
```

### Deploying the Monitor Worker
```bash
cd monitor-worker
npm install

# Configure APP_URL in wrangler.toml with your deployed app URL
# Set the cron secret
npx wrangler secret put CRON_SECRET

# Deploy the worker
npm run deploy
```

---

## 🧪 Testing

Run Vitest unit tests:
```bash
npm test
```
