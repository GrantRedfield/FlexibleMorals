# Flexible Morals — Unified Dev Workspace (Express + Session Auth)

This is a ready-to-run local development setup with:
- **Backend**: Express REST API (with session-based auth and cookie sessions)
- **Frontend**: React + TypeScript (Create React App)
- **Shared Local Env**

## Quick Start

```bash
# 1) From the project root, install everything
npm install
npm run install:all

# 2) Copy env templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3) Start both servers (backend on :3001, frontend on :3000)
npm run dev:all
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

Cookies are issued by the **backend** and are sent automatically by the browser when the frontend calls the API (CORS + `credentials: include`).

---

## API Overview

- `POST /auth/login` — body: `{ "name": "Alice", "email": "alice@example.com" }`
- `GET /auth/me` — returns current user (requires session)
- `POST /auth/logout` — clears session
- `GET /posts` — list posts
- `GET /posts/:id` — fetch a single post
- `POST /posts` — create post (requires session)
- `POST /posts/:id/vote` — body: `{ "direction": "up" | "down" }` (requires session)

## Data Persistence
- Uses a simple JSON file at `backend/data/db.json` for local development.
- Not suitable for production; replace with a database before deploying.

## Folder Structure

```
flexiblemorals-unified/
├── backend/              # Express API + session auth
│   ├── src/
│   │   └── server.js
│   ├── data/
│   │   └── db.json       # auto-created on first run
│   ├── .env.example
│   └── package.json
├── frontend/             # React + TypeScript app
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── lib/api.ts
│   │   ├── pages/Home.tsx
│   │   ├── pages/Vote.tsx
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── types.ts
│   ├── tsconfig.json
│   ├── .env.example
│   └── package.json
├── package.json
└── README.md
```

## Notes
- CORS is configured to allow `http://localhost:3000` with credentials.
- Session cookies use `SameSite=Lax`, `Secure=false` for local dev. Never use `MemoryStore` in production.
- Validation is done on both client and server for a better UX.
