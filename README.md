# Lattice

A multi-provider LLM gateway with OpenAI and Anthropic API compatibility, a clean dashboard, encrypted provider credentials, and automatic failover across configured providers.

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

3. Visit [http://localhost:3000](http://localhost:3000), create an account, add one or more OpenAI- or Anthropic-compatible providers, and create a gateway API key.

The dashboard playground and OpenAI SDK clients use `http://127.0.0.1:4000/v1`. Set `FRONTEND_ORIGIN` on the backend to the dashboard's origin if it differs from `http://localhost:3000`.

## API compatibility

The gateway supports both OpenAI Chat Completions (`POST /v1/chat/completions`)
and Anthropic Messages (`POST /v1/messages`). Configure Anthropic-compatible
upstreams as providers with a provider ID containing `anthropic` or `claude`
(for example, `anthropic`) and an Anthropic API base URL such as
`https://api.anthropic.com/v1`. OpenAI-compatible upstreams continue to use
provider IDs such as `openai` or `openrouter`.

Both APIs use gateway API keys. OpenAI clients send the key as a Bearer token;
Anthropic clients may send it as `x-api-key`. For example, an Anthropic SDK can
use `http://127.0.0.1:4000` as its base URL and the gateway key as its API key.
