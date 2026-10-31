# Environment Variables Setup Guide

## Quick Reference

Copy-paste these exact variable names into your hosting platform:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Where to Add Them

### Vercel
1. Open your project on [vercel.com](https://vercel.com)
2. Go to **Settings** tab
3. Click **Environment Variables** in the sidebar
4. Add each variable:
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: Your Supabase project URL (e.g., `https://abcdefg.supabase.co`)
   - Click **Add**

   - **Name**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: Your Supabase anon key (starts with `eyJ...`)
   - Click **Add**
5. **Redeploy** your project

### Netlify
1. Open your site on [netlify.com](https://netlify.com)
2. Go to **Site configuration** → **Environment variables**
3. Click **Add a variable**
4. Add each variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: Your Supabase project URL
   - Click **Create variable**

   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: Your Supabase anon key
   - Click **Create variable**
5. **Trigger a new deploy**

### Railway
1. Open your project on [railway.app](https://railway.app)
2. Click on your service
3. Go to **Variables** tab
4. Click **New Variable**
5. Add each variable:
   - `VITE_SUPABASE_URL` = your URL
   - `VITE_SUPABASE_ANON_KEY` = your key
6. Railway will auto-redeploy

### Render
1. Open your service on [render.com](https://render.com)
2. Go to **Environment** tab
3. Click **Add Environment Variable**
4. Add each variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: Your URL

   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: Your key
5. Render will auto-redeploy

### Local Development (.env file)
Create a file named `.env` in your project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Then restart your dev server:
```bash
npm run dev
```

## How to Get Your Supabase Credentials

### Step-by-Step:
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click on your project (or create a new one)
3. Click the ⚙️ **Settings** icon in the sidebar
4. Click **API** in the settings menu
5. You'll see two important values:

   **Project URL** (Project API URL)
   ```
   https://your-project-id.supabase.co
   ```
   Copy this entire URL

   **anon public** key
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   Click the copy icon to copy the full key

### Screenshot Guide:
```
Supabase Dashboard
├── Your Project
    └── Settings (⚙️)
        └── API
            ├── Project URL: [Copy this] ← Use for VITE_SUPABASE_URL
            └── Project API keys
                └── anon public: [Copy this] ← Use for VITE_SUPABASE_ANON_KEY
```

## Verification Checklist

After adding environment variables and redeploying:

- [ ] Visit `https://your-app.com/diagnostics`
- [ ] Both "Supabase URL" and "Supabase Anon Key" show green checkmarks
- [ ] "Overall Configuration" shows "All required variables configured"
- [ ] App loads without showing Setup Wizard
- [ ] You can sign up for a new account
- [ ] You can log in
- [ ] Dashboard loads without "load fail" errors

## Common Issues

### Issue: "Still seeing Setup Wizard after adding variables"
**Solution**: You need to **redeploy** after adding environment variables. They're injected at build time.

### Issue: "Variables are set but diagnostics shows red X"
**Solution**:
1. Check for typos in variable names (must be exact)
2. Check for extra spaces or quotes in values
3. Make sure you used the anon key, not service role key
4. Trigger a new deployment

### Issue: "Works locally but not in production"
**Solution**: Local `.env` file is separate from hosting platform environment variables. You need to add them in both places.

### Issue: "App was working, now shows Setup Wizard"
**Solution**: Environment variables might have been deleted. Re-add them and redeploy.

## Need Help?

1. Check [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) for detailed troubleshooting
2. Visit `/diagnostics` on your deployed app to see configuration status
3. Check your hosting platform's deployment logs for errors
4. Verify your Supabase project is active and not paused

## Security Notes

- ✅ **Safe to expose**: The anon key is safe to use in frontend code
- ❌ **Never expose**: Don't use the service role key in frontend
- ✅ **Commit to git**: `.env.example` files can be committed
- ❌ **Never commit**: `.env` files with real credentials
- ✅ **Use secrets**: Store credentials in hosting platform's environment variables
