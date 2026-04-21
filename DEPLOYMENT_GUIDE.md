I have updated your local `/home/igorkan/repos/ferma.tolk/.env.local` file with all of the new API keys, Supabase URLs, and the new `APP_ORIGIN` you provided.

Here is exactly what you have left to do to finish the deployment for `ferma.tolk`:

### 1. Push Database Migrations to Supabase
Because logging in and linking requires interactive browser authentication and your database password, you need to run these commands manually in your terminal:
```bash
cd /home/igorkan/repos/ferma.tolk
npx supabase login
npx supabase link --project-ref znzaawjvuyavxqhsfrsp
npx supabase db push
```
*(When prompted during the `link` step, enter the database password you created when you set up the `ferma-tolk-production` project on Supabase).*

### 2. Deploy to Vercel & Set Environment Variables
1. Go to [Vercel](https://vercel.com/new) and import your `igor-kan/ferma.tolk` repository.
2. The framework preset will automatically detect **Vite**.
3. **Crucial Step:** Before clicking "Deploy", expand the **Environment Variables** section and copy-paste these exact values:

   - **`VITE_SUPABASE_URL`**: `https://znzaawjvuyavxqhsfrsp.supabase.co`
   - **`VITE_SUPABASE_ANON_KEY`**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuemFhd2p2dXlhdnhxaHNmcnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjM1MTAsImV4cCI6MjA5MTc5OTUxMH0.fzFKApMbPvXeCTjctv-C125U1GR3wgaqmMeVag20loI`
   - **`SUPABASE_URL`**: `https://znzaawjvuyavxqhsfrsp.supabase.co`
   - **`SUPABASE_SERVICE_ROLE_KEY`**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuemFhd2p2dXlhdnhxaHNmcnNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzUxMCwiZXhwIjoyMDkxNzk5NTEwfQ.Tjur21hUkFKB00Noz6bFYTqZnFAud1z9LuiyuzD5JdQ`
   - **`DEEPGRAM_API_KEY`**: `d753f81d05bf8f2147d14ce4de6acc1869f79732`
   - **`VITE_APP_ENV`**: `production`
   - **`APP_ORIGIN`**: `https://ferma-tolk.youridea.live`
4. Click **Deploy**.

### 3. Set up the Subdomain (`ferma-tolk.youridea.live`)
Since you own `youridea.live` on Namecheap, here is how you create and connect the `ferma-tolk` subdomain:

1. **In Vercel:** Once your deployment finishes, go to the project's **Settings** tab > **Domains**. Type `ferma-tolk.youridea.live` and click **Add**. It will temporarily show an "Invalid Configuration" error and give you a target value (usually `cname.vercel-dns.com`).
2. **In Namecheap:** Log into your Namecheap dashboard, go to **Domain List**, and click **Manage** next to `youridea.live`.
3. Navigate to the **Advanced DNS** tab.
4. Under the "Host Records" section, click **Add New Record** and enter:
   - **Type:** `CNAME Record`
   - **Host:** `ferma-tolk` *(do not put the full domain here)*
   - **Value:** `cname.vercel-dns.com` *(or the exact target Vercel gave you)*
   - **TTL:** `Automatic`
5. Click the green checkmark to save.

Wait a few minutes (up to an hour in rare cases) for the DNS to propagate. Vercel will automatically detect the new record, generate a free SSL certificate, and your site will be live!
