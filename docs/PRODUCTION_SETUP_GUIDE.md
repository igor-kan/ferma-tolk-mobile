# Ferma.Tolk — Production Setup Instructions

This document outlines the exact manual steps required to finish the production deployment of Ferma.Tolk, using your specific credentials.

## 1. Setting up the `ferma-tolk.youridea.live` Subdomain on Namecheap
To point your custom subdomain to Vercel:
1. Log into your Namecheap account and go to **Domain List**.
2. Click **Manage** next to `youridea.live`.
3. Go to the **Advanced DNS** tab.
4. Click **Add New Record** in the Host Records section:
   - **Type:** `CNAME Record`
   - **Host:** `ferma-tolk` *(This creates ferma-tolk.youridea.live)*
   - **Value:** `cname.vercel-dns.com.` *(Include the trailing dot if Namecheap requires it)*
   - **TTL:** `Automatic`
5. Save the changes (green checkmark). DNS propagation usually takes a few minutes but can take up to an hour.

## 2. Push Database Migrations to Supabase
Open your terminal and run these commands in the project directory. 

*Note: For `supabase login`, you will need to generate a Personal Access Token from your Supabase Dashboard under **Account** -> **Access Tokens**.*

```bash
cd /home/igorkan/repos/ferma.tolk
npx supabase login
```
*(Paste your Personal Access Token when prompted)*

Link the CLI to your production project:
```bash
npx supabase link --project-ref znzaawjvuyavxqhsfrsp
```
*(It will ask for your database password - the one you created when setting up the project)*

Push the schema to production:
```bash
npx supabase db push
```

## 3. Deploy to Vercel & Set Environment Variables
1. Go to [Vercel](https://vercel.com/new) and import the `igor-kan/ferma.tolk` repository.
2. Vercel will automatically detect **Vite** as the framework.
3. Open the **Environment Variables** dropdown and copy/paste these exact values:
   - `VITE_SUPABASE_URL`: `https://znzaawjvuyavxqhsfrsp.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuemFhd2p2dXlhdnhxaHNmcnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjM1MTAsImV4cCI6MjA5MTc5OTUxMH0.fzFKApMbPvXeCTjctv-C125U1GR3wgaqmMeVag20loI`
   - `SUPABASE_URL`: `https://znzaawjvuyavxqhsfrsp.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuemFhd2p2dXlhdnhxaHNmcnNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzUxMCwiZXhwIjoyMDkxNzk5NTEwfQ.Tjur21hUkFKB00Noz6bFYTqZnFAud1z9LuiyuzD5JdQ`
   - `DEEPGRAM_API_KEY`: `d753f81d05bf8f2147d14ce4de6acc1869f79732`
   - `VITE_APP_ENV`: `production`
   - `APP_ORIGIN`: `https://ferma-tolk.youridea.live`
4. Click **Deploy**.

## 4. Connect Your Domain to Vercel
After the initial deployment is complete:
1. Go to the project in Vercel and click **Settings** -> **Domains**.
2. Type in `ferma-tolk.youridea.live` and click **Add**.
3. Vercel will verify the Namecheap CNAME record you created earlier. Once the status turns to a green checkmark, your production app is live!