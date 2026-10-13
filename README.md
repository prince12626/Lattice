# Lattice

An OpenAI-compatible LLM gateway with a clean dashboard, encrypted provider credentials, and automatic failover across configured providers.

## Requirements

- Node.js 22 or later
- MongoDB

## Run locally

1. Configure and start the backend:

   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run dev
   ```

   Set unique values for `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, and `ADMIN_API_KEY` in `server/.env`. Keep that file private.

2. Configure and start the dashboard in a second terminal:

   ```bash
   cd client
   cp .env.example .env.local
   npm install
   npm run dev
   ```

3. Visit [http://localhost:3000](http://localhost:3000), create an account, add one or more OpenAI-compatible providers, and create a gateway API key.

The dashboard playground and OpenAI SDK clients use `http://127.0.0.1:4000/v1`. Set `FRONTEND_ORIGIN` on the backend to the dashboard's origin if it differs from `http://localhost:3000`.
