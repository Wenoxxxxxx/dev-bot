# dev-bot

Bot-user that posts changed-files report on every PR. No Actions workflow. Runs as service, auths as your managed account via PAT.

## How it works
GitHub webhook `pull_request: opened,synchronize,reopened` -> `POST /webhooks` -> bot lists PR files via API -> upserts one comment `<!-- dev-bot-pr-report -->`.

Comment has: diffstat, files grouped by dir, full table, risk flags, optional AI summary.

## Setup
1. Create/manage bot account, add as Collaborator to target repos (Read min, Write needed to comment on private repos).
2. Make fine-grained PAT: Contents:read, Pull requests:read, Issues:write, Metadata:read. Scope to repos.
3. Host this service (Render/Fly/Railway/VPS). Set env:
   ```
   BOT_PAT=...
   WEBHOOK_SECRET=...  # random 32+ chars
   PORT=3000
   ```
4. GitHub repo Settings -> Webhooks -> Add: Payload URL `https://<host>/webhooks`, Content-Type `application/json`, Secret = same `WEBHOOK_SECRET`, Events = Pull requests.
5. Open test PR -> bot comments, updates in place on push.

## Local run
```
cp .env.example .env   # fill real values, never commit
npm install
npm start              # :3000, health at /healthz
```

Manual test without webhook:
```
curl -X POST localhost:3000/run -H "Content-Type: application/json" \
  -d '{"owner":"you","repo":"test","pull_number":1}'
```

## Security
- Never commit `.env` or `Bot-token.txt`. PAT lives in host env only.
- Rotate PAT if leaked. Use fine-grained, least repos.
- Webhook secret required — unsigned posts rejected.
