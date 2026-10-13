# Lattice dashboard

Next.js dashboard for the LLM gateway. It supports Better Auth sign-in, provider management, gateway API keys, and an OpenAI-compatible chat playground.

## Run locally

1. Start the backend from `../server` and set `FRONTEND_ORIGIN=http://localhost:3000` in its environment.
2. Copy `.env.example` to `.env.local` if the backend is not available at `http://127.0.0.1:4000`.
3. Start the dashboard:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), create an account or sign in, connect a provider, and create a gateway key.

The gateway key is only displayed once. Keep it available for the playground, which sends requests to the backend's `/v1/chat/completions` endpoint.
