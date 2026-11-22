# Deployment — your PC is the server

There is no cloud deployment. "Production" = LIFEQUEST running on your Windows PC with your real data.

## 1. Run on the PC

```powershell
git switch main; git pull
npm ci
npm run app:build      # builds the real app into .next-prod (test builds use .next and never touch it)
npm run app:start      # migrates the production DB (with pre-migrate backup), then serves http://127.0.0.1:3000
```

Data: `%LOCALAPPDATA%\LIFEQUEST`. Open http://127.0.0.1:3000 and install it as an app from Edge/Chrome (Install icon in the address bar).

### Start automatically at log-in (optional)
Create a shortcut in `shell:startup` that runs `npm run app:start` in the project folder, or register a scheduled task
"At log on". (A tray launcher / Windows service can be added later.)

### Scheduled backups even when the app is closed
```powershell
.\scripts\windows\register-backup-task.ps1        # runs as you, limited privileges
```

## 2. Reach it from your iPhone (Tailscale)

1. Create a free Tailscale account and install Tailscale on the PC and the iPhone; sign in to both with the same account.
2. In the Tailscale admin console enable **MagicDNS** and **HTTPS certificates**.
3. On the PC (PowerShell): `tailscale serve --bg 3000` → it prints `https://<pc-name>.<tailnet>.ts.net`.
4. Add that hostname to `.env.local`: `LIFEQUEST_ALLOWED_HOSTS=<pc-name>.<tailnet>.ts.net`, restart the app.
5. On the iPhone (Tailscale connected), open that URL in Safari → Share → **Add to Home Screen**.

**Never** use `tailscale funnel` (public internet) or router port forwarding.

## 3. Updating safely

`npm run app:start` always backs up before migrating. If an update misbehaves:
```powershell
npm run db -- list --env=production
npm run db -- restore <backup-file> --yes --env=production   # app must be stopped
```

## 4. Why not Replit or Vercel

Both would host the server — and therefore the data — in someone else's cloud, contradicting the requirement that your PC owns
your data. They also can't reach a database on your PC without exposing it. GitHub remains the place where *code* lives.
