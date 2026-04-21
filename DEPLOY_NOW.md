# ferma.tolk — Deploy Now

All env vars and config are already set. This file lists only the manual steps
you must run yourself (browser auth, external dashboards).

---

## What's already done

- `.env.local` is populated with your Supabase project `znzaawjvuyavxqhsfrsp`
- `vercel.json` is configured for `ferma-tolk.youridea.live`
- 9 migration files are ready in `supabase/migrations/`
- Supabase CLI 2.90.0 is installed via Homebrew

---

## Step 1 — Log in to Supabase CLI (opens browser)

```bash
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv bash)"
cd /home/igorkan/repos/ferma.tolk
supabase login
```

A browser tab will open. Sign in with your Supabase account (alexastrum@gmail.com).

---

## Step 2 — Link to your remote project

```bash
supabase link --project-ref znzaawjvuyavxqhsfrsp
```

When prompted for the database password, enter the password you set when
creating the `znzaawjvuyavxqhsfrsp` project on supabase.com.

---

## Step 3 — Push all migrations to production

```bash
supabase db push
```

This runs all 9 migration files against the remote Postgres instance.
If it asks to confirm destructive changes, review and type `y`.

---

## Step 4 — Install Vercel CLI and deploy

```bash
npm install -g vercel
vercel login    # browser opens — sign in with alexastrum@gmail.com
```

Then deploy to production:

```bash
vercel --prod
```

When prompted:
- **Set up and deploy?** → Y
- **Which scope?** → your personal account
- **Link to existing project?** → N (first time), then give it the name `ferma-tolk`
- **In which directory?** → `.` (current)
- **Want to override the settings?** → N (vercel.json handles it)

---

## Step 5 — Set environment variables in Vercel

Go to: https://vercel.com/dashboard → ferma-tolk → Settings → Environment Variables

Add all of these for **Production + Preview + Development**:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://znzaawjvuyavxqhsfrsp.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuemFhd2p2dXlhdnhxaHNmcnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjM1MTAsImV4cCI6MjA5MTc5OTUxMH0.fzFKApMbPvXeCTjctv-C125U1GR3wgaqmMeVag20loI` |
| `SUPABASE_URL` | `https://znzaawjvuyavxqhsfrsp.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuemFhd2p2dXlhdnhxaHNmcnNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzUxMCwiZXhwIjoyMDkxNzk5NTEwfQ.Tjur21hUkFKB00Noz6bFYTqZnFAud1z9LuiyuzD5JdQ` |
| `DEEPGRAM_API_KEY` | `d753f81d05bf8f2147d14ce4de6acc1869f79732` |
| `VITE_APP_ENV` | `production` |
| `APP_ORIGIN` | `https://ferma-tolk.youridea.live` |

After saving, trigger a redeploy:

```bash
vercel --prod
```

---

## Step 6 — Add custom domain in Vercel

Go to: https://vercel.com/dashboard → ferma-tolk → Settings → Domains

Add: `ferma-tolk.youridea.live`

Vercel will show you a CNAME target (usually `cname.vercel-dns.com`).

---

## Step 7 — Add CNAME in Namecheap

1. Log in to Namecheap → Domain List → Manage `youridea.live`
2. Advanced DNS tab → Add New Record:
   - Type: `CNAME Record`
   - Host: `ferma-tolk`
   - Value: `cname.vercel-dns.com`
   - TTL: Automatic
3. Save. DNS propagates in 5–30 minutes.

Vercel auto-provisions SSL once it sees the CNAME.

---

## Verify

```bash
curl -I https://ferma-tolk.youridea.live
```

Should return `HTTP/2 200`.

---

## Auth setup in Supabase dashboard

Go to: https://supabase.com/dashboard/project/znzaawjvuyavxqhsfrsp/auth/url-configuration

Set **Site URL** to: `https://ferma-tolk.youridea.live`

Add to **Redirect URLs**:
- `https://ferma-tolk.youridea.live/**`
- `http://localhost:5173/**`
