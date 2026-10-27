# Water usage chatbot

A no-login chat page for Hong Kong classrooms. Students ask about water use, saving water, and eco-friendly water habits. The bot stays on that topic and can collect a short habit note in the conversation. It does not ask for names or other personal details.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env
```

Edit `.env` and set `DEEPSEEK_API_KEY`. Then:

```bash
npm start
```

Open http://localhost:3000 . On an iPad, use the computer’s address on the same network, for example `http://192.168.1.20:3000`.

`GET /api/health` returns `{ "ok": true, "configured": true }` when the key is set.

## Railway

1. Create a Railway service from this repository.
2. In the service **Variables**, set `DEEPSEEK_API_KEY` to your DeepSeek API key.
3. Leave `PORT` unset. Railway provides it, and the app listens on `0.0.0.0`.
4. Deploy with the `npm start` command (Railway detects it from `package.json`).

Do not commit the API key. Keep it only in `.env` locally and in Railway variables.
