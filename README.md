# signalpot-agent-text-analyzer

A showcase agent for the [SignalPot](https://www.signalpot.dev) AI agent marketplace. Implements:
- `signalpot/text-summary@v1` — text summarization via Claude Haiku
- `signalpot/sentiment@v1` — sentiment analysis via Claude Haiku

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/h2theoran1984/signalpot-agent-text-analyzer)

Set these environment variables in Vercel:
- `ANTHROPIC_API_KEY` — your Anthropic API key
- `AGENT_BASE_URL` — your Vercel deployment URL (e.g. https://signalpot-agent-text-analyzer.vercel.app)

## Local Development

```bash
npm install
cp .env.example .env  # fill in your API keys
npx vercel dev
```

## Register on SignalPot

```bash
SIGNALPOT_API_KEY=sp_live_... AGENT_BASE_URL=https://your-deployment.vercel.app npm run register
```

## A2A Protocol

POST `/a2a/rpc` with JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "type": "data", "data": { "text": "Your text here..." } }]
    },
    "metadata": { "capability_used": "signalpot/text-summary@v1" }
  }
}
```
