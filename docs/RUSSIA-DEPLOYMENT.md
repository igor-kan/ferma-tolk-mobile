# Ferma.Tolk — Russia Deployment Guide

This guide is for operators **physically located in the Russian Federation** who need to deploy and run Ferma.Tolk for Russian farmers. It documents which services are accessible from Russia, which are restricted, and what Russian alternatives exist.

> **Disclaimer:** Sanctions and access policies change frequently. Information in this document was compiled from public statements by the providers themselves and is current as of early 2026. Always re-verify before committing to a provider.

## TL;DR — recommended Russia stack

| Layer | Cloud option (easiest) | Self-hosted option (most resilient) |
|---|---|---|
| **Database + Auth** | Supabase Cloud (eu-central-1, paid in $) | Self-hosted Supabase on Yandex Cloud or Selectel |
| **Speech-to-text** | Deepgram (works but billing is hard) | **Yandex SpeechKit** (recommended), SaluteSpeech, VK Cloud Voice |
| **Hosting + Functions** | Vercel free tier | Yandex Cloud Functions + Object Storage; or generic VPS + Caddy |
| **CI/CD** | GitHub Actions | Self-hosted Forgejo / Gitea Actions |
| **CDN** | Cloudflare (works) | Yandex CDN, Selectel CDN |
| **DNS** | Cloudflare DNS | Yandex DNS, Beget DNS |
| **TLS certs** | Let's Encrypt (works) | Russian CA "TLS" (limited browser trust) |
| **Backups** | Supabase managed backups | Yandex Object Storage / Selectel S3 |
| **Monitoring** | Glitchtip (self-hosted) | Same |

## 1. Supabase

### Status: ⚠️ Works for now

Supabase Cloud is hosted on AWS and the Supabase company is US-based. As of early 2026:
- ✅ Sign-up and free tier sign-in work from Russian IPs
- ⚠️ Paid plans require non-Russian payment methods (Russian-issued cards rejected)
- ⚠️ Region selection: there is no Russia region. Closest: `eu-central-1` (Frankfurt) or `ap-south-1` (Mumbai)
- ⚠️ Supabase has not formally restricted Russian access but Stripe (Supabase's billing processor) does not operate in Russia

### Self-hosted Supabase (recommended for resilience)

Supabase is fully open source and can be self-hosted using Docker Compose. The full stack includes:
- PostgreSQL 15
- PostgREST (REST API)
- GoTrue (Auth)
- Realtime (Phoenix-based websocket server)
- Storage API
- Edge Functions runtime (Deno)
- Studio (admin UI)

**Deploy on Yandex Cloud or Selectel:**

```bash
# 1. Provision a 4 vCPU / 8 GB RAM Ubuntu 22.04 VM
# 2. SSH in and:
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy the example env file and customize secrets
cp .env.example .env
nano .env
# Generate strong secrets:
#   POSTGRES_PASSWORD=$(openssl rand -hex 32)
#   JWT_SECRET=$(openssl rand -hex 32)
#   ANON_KEY  — generate via supabase/jwt.io with role=anon
#   SERVICE_ROLE_KEY  — generate via supabase/jwt.io with role=service_role
#   DASHBOARD_USERNAME / DASHBOARD_PASSWORD

docker compose up -d

# Verify
curl http://localhost:8000/health
```

Reverse-proxy port 8000 (Kong gateway) through Caddy for HTTPS:

```caddy
api.ferma.your-domain.ru {
    reverse_proxy 127.0.0.1:8000
}
studio.ferma.your-domain.ru {
    reverse_proxy 127.0.0.1:3000
    basicauth {
        admin $2a$14$...   # bcrypt hash of dashboard password
    }
}
```

Then set in `.env.local`:
```bash
VITE_SUPABASE_URL=https://api.ferma.your-domain.ru
VITE_SUPABASE_ANON_KEY=<your generated anon key>
SUPABASE_URL=https://api.ferma.your-domain.ru
SUPABASE_SERVICE_ROLE_KEY=<your generated service_role key>
SUPABASE_DB_URL=postgresql://postgres:<password>@127.0.0.1:5432/postgres
```

The app code requires no changes — Supabase's open-source stack is API-compatible with the cloud product.

### Migration path: cloud → self-hosted

If you start on Supabase Cloud and later need to migrate (because billing or access becomes blocked):

```bash
# Dump from cloud
pg_dump "$CLOUD_DB_URL" --no-owner --no-acl --no-comments > backup.sql

# Restore to self-hosted
psql "$SELFHOSTED_DB_URL" < backup.sql

# Re-apply migrations to capture any divergence
for f in supabase/migrations/*.sql; do
  psql "$SELFHOSTED_DB_URL" -f "$f"
done
```

User accounts (managed by GoTrue) require an additional dump from `auth.users` — see Supabase's [self-hosting migration guide](https://supabase.com/docs/guides/self-hosting).

## 2. Vercel & alternatives

### Status: ⚠️ Free tier works, paid blocked

- ✅ Free Hobby tier sign-up works from Russian IPs via GitHub OAuth
- ⚠️ Paid Pro plans require non-Russian payment methods
- ⚠️ Some Vercel customers in Russia have been notified of TOS reviews; status is uncertain

### Alternative: Yandex Cloud Functions + Object Storage

Yandex Cloud Functions can host the same Vite-built SPA + Edge Function backend that Vercel does:

```bash
# 1. Build the SPA
npm run build

# 2. Upload to Yandex Object Storage as a static website
yc storage bucket create --name ferma-tolk-prod
aws --endpoint-url https://storage.yandexcloud.net s3 sync dist/ s3://ferma-tolk-prod/ \
    --acl public-read

# 3. Enable static website hosting
yc storage bucket update --name ferma-tolk-prod \
    --website-settings "index=index.html,error=index.html"

# 4. Deploy each api/*.js file as a Yandex Cloud Function
yc serverless function create --name ferma-tolk-speech
yc serverless function version create \
    --function-name ferma-tolk-speech \
    --runtime nodejs20 \
    --entrypoint speech.handler \
    --memory 256m \
    --execution-timeout 30s \
    --source-path ./api/speech.js \
    --environment SUPABASE_URL=...,DEEPGRAM_API_KEY=...
```

Note that Yandex Cloud Functions have a **slightly different handler signature** than Vercel Edge Functions — you'd need a small adapter wrapper. The differences:

| Aspect | Vercel | Yandex |
|---|---|---|
| Handler signature | `(req, res) => ...` | `(event, context) => ...` |
| Request body | `req.body` (parsed) | `JSON.parse(event.body)` |
| Headers | `req.headers` | `event.headers` |
| Response | `res.status(200).json({...})` | `return { statusCode: 200, body: JSON.stringify({...}) }` |

A 50-line adapter (`api/_yandex-adapter.js`) can wrap each function to support both runtimes.

### Alternative: Self-hosted Node + Caddy on a VPS

Simplest option — runs the SPA via static file serving and the `api/` functions as a tiny Express app:

```bash
# Build the frontend
npm run build

# Create a tiny Express server that serves dist/ + mounts the api/ functions
cat > server.js <<'EOF'
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import speech from './api/speech.js';
import analytics from './api/analytics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));

app.use('/api/speech', speech);
app.use('/api/analytics', analytics);
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist/index.html')));

app.listen(3000, () => console.log('Ferma.Tolk listening on :3000'));
EOF

node server.js
```

Front with Caddy (auto-HTTPS via Let's Encrypt):
```caddy
ferma.your-domain.ru {
    reverse_proxy 127.0.0.1:3000
}
```

This runs comfortably on a 1 vCPU / 1 GB Beget VPS (~₽300/mo).

## 3. Speech-to-text

### Deepgram — ⚠️ Works but billing is restricted

- ✅ API calls from Russian IPs work
- ⚠️ Sign-up and credit purchase require non-Russian payment
- ⚠️ Existing accounts continue to function

### Russian alternatives

| Service | Free tier | Russian language quality | API style | Notes |
|---|---|---|---|---|
| **Yandex SpeechKit** | 4000 min/mo trial | Excellent (native) | gRPC + REST | Best Russian recognition; supports nova-2-equivalent quality |
| **SaluteSpeech (Sber)** | Free trial | Excellent (native) | REST | SberDevices' speech engine |
| **VK Cloud Voice** | Free trial | Very good | REST | VK group's speech service |
| **Tinkoff VoiceKit** | Free trial | Good | gRPC | Tinkoff Bank's speech tech |
| **Vosk (open source)** | unlimited self-hosted | Good | offline / library | Free, runs on-device. Slightly lower accuracy. |
| **Whisper (OpenAI, open source)** | unlimited self-hosted | Very good | library | OpenAI's open-source model. The model itself is unrestricted; only hosted OpenAI API is restricted in Russia. |

### Recommended: Yandex SpeechKit adapter

Replace `api/speech.js` with a Yandex SpeechKit adapter (~80 lines). Sketch:

```js
// api/speech-yandex.js
import { requireAuth } from './_auth-session.js';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const audioBuffer = req.body;  // raw audio bytes

  const ydxResponse = await fetch(
    'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?lang=ru-RU&format=oggopus',
    {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
        'Content-Type': 'application/octet-stream',
      },
      body: audioBuffer,
    }
  );

  if (!ydxResponse.ok) {
    return res.status(502).json({ error: 'Yandex SpeechKit error' });
  }

  const { result } = await ydxResponse.json();
  return res.status(200).json({ transcript: result });
}
```

Add to `.env`:
```bash
YANDEX_API_KEY=your-api-key
```

Get a Yandex Cloud API key:
1. Sign up at https://cloud.yandex.ru
2. Create a service account with role `ai.speechkit-stt.user`
3. Create an API key for that service account
4. Use the key as `YANDEX_API_KEY`

### Recommended: Vosk for offline/edge

If you want zero external dependencies, [Vosk](https://alphacephei.com/vosk/) provides offline speech recognition:

```bash
npm install vosk
# Download a Russian model (~50MB):
wget https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip
unzip vosk-model-small-ru-0.22.zip -d models/
```

Vosk runs entirely on the server with no API calls. Quality is slightly below Deepgram/Yandex but it never goes down.

## 4. SMTP providers (for Supabase Auth emails)

| Provider | Endpoint | Notes |
|---|---|---|
| **Yandex Mail** | smtp.yandex.ru:465 | ✅ Native, free |
| **Yandex 360** | smtp.yandex.ru:465 | ✅ Custom domain support, paid |
| **Mail.ru** | smtp.mail.ru:465 | ✅ Native, free |
| **UniSender Go** | smtp.go.unisender.ru | ✅ Russian transactional, 1500/mo free |
| **Mailopost** | smtp.mailopost.ru | ✅ Russian transactional |
| **Beget Mail** | smtp.beget.com:465 | ✅ Tied to Beget hosting |
| **SendGrid / Mailgun / Postmark / SES** | — | ❌ All suspended in Russia |
| **Self-hosted Postfix** | your-server | ✅ Works but deliverability is hard |

Configure in **Supabase Dashboard → Authentication → SMTP Settings**.

## 5. CI/CD

| Service | Status | Notes |
|---|---|---|
| **GitHub Actions** | ✅ Works | Free tier minutes available |
| **GitLab CI (gitlab.com)** | ✅ Works | Free CI minutes available |
| **CircleCI** | ⚠️ | Russian payment methods restricted |
| **Drone CI (self-hosted)** | ✅ Open source | Deploy on any VPS |
| **Forgejo Actions** (self-hosted) | ✅ Open source | Drop-in replacement for GitHub Actions |
| **Gitea Actions** (self-hosted) | ✅ Open source | Same |

Recommendation: stick with GitHub Actions for now. Mirror the repo to GitFlic or self-hosted Forgejo as a backup.

## 6. CDN, DNS, and TLS

| Service | Russian status |
|---|---|
| Cloudflare CDN/DNS | ✅ Works (some regions partial) |
| AWS CloudFront / Route 53 | ❌ Restricted |
| Yandex CDN / Yandex DNS | ✅ Native |
| Selectel CDN / DNS | ✅ Native |
| Beget DNS | ✅ Native (free with domains) |
| NGENIX, EdgeЦентр | ✅ Native (Russian CDNs) |
| **Let's Encrypt** | ✅ Works, free, recommended |
| Russian CA "TLS" | ⚠️ Trusted only by Russian-locale browsers |

For most farm-scale deployments, no CDN is needed — Ferma.Tolk's bundle is small (~500 KB gzipped). DNS via Cloudflare or Yandex DNS, TLS via Let's Encrypt (Caddy auto-handles it).

## 7. Object storage / backups

| Service | Status |
|---|---|
| AWS S3 | ❌ Restricted |
| Google Cloud Storage | ⚠️ Limited |
| Cloudflare R2 | ⚠️ Free tier only |
| **Yandex Object Storage** | ✅ Native, S3-compatible |
| **Selectel Object Storage** | ✅ Native, S3-compatible |
| **VK Cloud Object Storage** | ✅ Native, S3-compatible |
| **MinIO (self-hosted)** | ✅ Open source |

### Backup recipe (Yandex Object Storage)

```bash
# Daily Postgres dump → Yandex Object Storage (cron @ 03:00)
DATE=$(date +%F)
pg_dump "$SUPABASE_DB_URL" | gzip > /tmp/ferma-tolk-$DATE.sql.gz
aws --endpoint-url https://storage.yandexcloud.net \
    s3 cp /tmp/ferma-tolk-$DATE.sql.gz s3://ferma-tolk-backups/
rm /tmp/ferma-tolk-$DATE.sql.gz

# Retention: keep last 30 days
aws --endpoint-url https://storage.yandexcloud.net \
    s3 ls s3://ferma-tolk-backups/ \
    | awk '{print $4}' | sort | head -n -30 \
    | xargs -I{} aws --endpoint-url https://storage.yandexcloud.net \
        s3 rm s3://ferma-tolk-backups/{}
```

## 8. Concrete deployment recipe

A complete recipe for deploying Ferma.Tolk to a Yandex Cloud or Selectel VPS in Russia:

```bash
# 1. Provision a 2 vCPU / 4 GB RAM Ubuntu 22.04 VPS

# 2. Install dependencies
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y caddy git nodejs npm postgresql-client

# 3. Clone the repos
cd /opt
git clone https://github.com/igor-kan/ferma.tolk.git
git clone --depth 1 https://github.com/supabase/supabase

# 4. Bring up self-hosted Supabase
cd /opt/supabase/docker
cp .env.example .env
# Generate secrets in .env (see § 1 above)
docker compose up -d

# 5. Apply Ferma.Tolk migrations
cd /opt/ferma.tolk
export SUPABASE_DB_URL='postgresql://postgres:PASSWORD@127.0.0.1:5432/postgres'
for f in supabase/migrations/*.sql; do
  psql "$SUPABASE_DB_URL" -f "$f"
done

# 6. Get a Yandex SpeechKit API key (see § 3)

# 7. Configure .env
cp .env.example .env.local
nano .env.local
# Set:
#   VITE_SUPABASE_URL=https://api.ferma.your-domain.ru
#   VITE_SUPABASE_ANON_KEY=<from supabase/.env>
#   SUPABASE_URL=http://127.0.0.1:8000
#   SUPABASE_SERVICE_ROLE_KEY=<from supabase/.env>
#   YANDEX_API_KEY=<from Yandex Cloud Console>
#   VITE_APP_ENV=production
#   APP_ORIGIN=https://ferma.your-domain.ru

# 8. Build the SPA
npm install
npm run build

# 9. Create a tiny Express server (see § 2)
cat > server.js <<'EOF'
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));

// Mount API handlers (use Yandex adapter for non-Vercel runtimes)
import speech from './api/speech-yandex.js';
app.post('/api/speech', speech);

app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist/index.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Ferma.Tolk listening on :${port}`));
EOF

# 10. Run as a systemd service
cat > /etc/systemd/system/ferma-tolk.service <<EOF
[Unit]
Description=Ferma.Tolk web app
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ferma.tolk
EnvironmentFile=/opt/ferma.tolk/.env.local
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl enable --now ferma-tolk

# 11. Caddy reverse proxy
cat > /etc/caddy/Caddyfile <<'EOF'
ferma.your-domain.ru {
    reverse_proxy 127.0.0.1:3000
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://api.ferma.your-domain.ru wss://api.ferma.your-domain.ru;"
    }
}

api.ferma.your-domain.ru {
    reverse_proxy 127.0.0.1:8000
}
EOF
systemctl reload caddy

# 12. Point DNS at the VPS public IP and wait for Let's Encrypt to issue certs
```

## 9. Verification checklist

- [ ] Site loads over HTTPS from a Russian IP
- [ ] Sign-up and login work
- [ ] Adding a transaction persists across reloads
- [ ] Voice input transcribes Russian speech (or returns a clear error)
- [ ] Supabase Studio is accessible (via basic auth)
- [ ] Daily backups land in Yandex Object Storage
- [ ] Caddy auto-renewed Let's Encrypt cert
- [ ] `journalctl -u ferma-tolk` shows no recurring errors
- [ ] `journalctl -u caddy` is clean
- [ ] CSP header is present (verify at https://securityheaders.com)

## 10. Resilience risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Supabase Cloud blocks Russian users | Site goes down | Self-host Supabase (already documented) |
| Deepgram blocks Russian API calls | Voice input stops | Switch to Yandex SpeechKit (1-day port) |
| Vercel terminates Russian accounts | Site goes down | Self-host on Yandex Cloud / Selectel / generic VPS |
| GitHub becomes unreachable | CI/CD blocked | Mirror to GitFlic / self-hosted Forgejo |
| Let's Encrypt blocked from Russia | TLS renewal fails | Switch to ZeroSSL or Russian "TLS" CA |
| npm registry blocked | Builds fail | Mirror via Verdaccio or Yandex Cloud npm proxy |
| Docker Hub partial outage | Container pulls fail | Mirror base images to Selectel/Yandex Container Registry |

## 11. Further reading

- [Supabase self-hosting docs](https://supabase.com/docs/guides/self-hosting)
- [Yandex Cloud docs](https://cloud.yandex.ru/docs)
- [Yandex SpeechKit STT API](https://yandex.cloud/docs/speechkit/stt/)
- [Selectel docs](https://docs.selectel.ru/)
- [Caddy 2 docs](https://caddyserver.com/docs/)
- [Let's Encrypt status](https://letsencrypt.status.io/)
- Existing Ferma.Tolk docs:
  - [DATABASE-SETUP.md](./DATABASE-SETUP.md)
  - [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md)
  - [DEPLOYMENT-PIPELINE.md](./DEPLOYMENT-PIPELINE.md)
  - [INTEGRATIONS.md](./INTEGRATIONS.md)
  - [DEPENDENCIES-RUSSIA-AUDIT.md](./DEPENDENCIES-RUSSIA-AUDIT.md)
