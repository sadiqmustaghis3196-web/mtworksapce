# Deployment Troubleshooting Guide

## "Load Fail" Error When Users Access Your App

### Problem
When you deploy TranspoPilot AI and send the URL to users, they see "load fail" errors or blank screens. Data won't load, and the app appears broken.

### Root Cause
The app was deployed **without configuring the required Supabase environment variables**. Without these variables, the app cannot connect to the database, causing all data operations to fail.

### Required Environment Variables
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Quick Fix (5 Minutes)

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project (or select existing one)
3. Navigate to **Settings → API**
4. Copy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

### Step 2: Add Environment Variables to Your Hosting Platform

#### For Vercel:
1. Go to your project dashboard on Vercel
2. Click **Settings** → **Environment Variables**
3. Add both variables:
   - Name: `VITE_SUPABASE_URL` → Value: Your Supabase URL
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: Your Supabase anon key
4. Click **Save**

#### For Netlify:
1. Go to your site dashboard on Netlify
2. Click **Site settings** → **Environment variables**
3. Click **Add a variable** and add both:
   - `VITE_SUPABASE_URL` = Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
4. Click **Save**

#### For Other Platforms:
Look for "Environment Variables", "Build Settings", or "Configuration" in your hosting dashboard and add the two variables there.

### Step 3: Redeploy
- **Vercel/Netlify**: Trigger a new deployment (usually happens automatically after adding env vars)
- **Manual deployment**: Run `npm run build` again with the env vars set, then redeploy

### Step 4: Verify
After redeploying, visit your app URL and add `/diagnostics` at the end:
```
https://your-app-url.com/diagnostics
```

You should see all green checkmarks. If you still see red X marks, the environment variables weren't properly set.

---

## Prevention: Pre-Deployment Checklist

Before sharing your app URL with users, complete this checklist:

- [ ] Supabase project created
- [ ] Environment variables added to hosting platform
- [ ] App redeployed after adding env vars
- [ ] Visited `/diagnostics` and verified all checks are green
- [ ] Tested login/signup functionality
- [ ] Tested loading vehicles and drivers data
- [ ] All features work without "load fail" errors

---

## Common Mistakes

### 1. Forgot the `VITE_` Prefix
**Wrong:**
```env
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
```

**Correct:**
```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

Vite requires the `VITE_` prefix for environment variables to be accessible in the browser.

### 2. Added Variables But Didn't Redeploy
Environment variables are injected at **build time**, not runtime. After adding them, you MUST trigger a new deployment.

### 3. Using Service Role Key Instead of Anon Key
Make sure you're using the **anon/public key**, not the service role key. The service role key should never be exposed in frontend code.

### 4. Trailing Spaces or Quotes
Don't add extra quotes or spaces:
```env
# Wrong
VITE_SUPABASE_URL="https://..."
VITE_SUPABASE_URL= https://...

# Correct
VITE_SUPABASE_URL=https://...
```

---

## How to Test Locally

Before deploying, test the configuration locally:

1. Create a `.env` file in your project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Restart your dev server:
```bash
npm run dev
```

3. Visit `http://localhost:5173/diagnostics`
4. All checks should be green

---

## What Happens If Environment Variables Are Missing?

When the app is deployed without environment variables:

1. **Startup**: The app shows a full-screen Setup Wizard with instructions
2. **Data Operations**: All database operations fail with connection errors
3. **User Experience**: Users see "load fail" messages instead of data
4. **Authentication**: Login and signup won't work
5. **Diagnostics Page**: Shows red X marks for missing configuration

The Setup Wizard provides step-by-step instructions for fixing the configuration.

---

## Advanced: Automated Deployment

### GitHub Actions Example
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

Store your Supabase credentials in GitHub Secrets for security.

---

## Still Having Issues?

1. Check browser console for specific error messages (F12 → Console)
2. Visit `/diagnostics` to see detailed configuration status
3. Verify your Supabase project is active and accessible
4. Ensure you're using the correct region URL for your Supabase project
5. Try creating a new Supabase project and using fresh credentials

---

## Contact Support

If you've followed all steps and still experience issues:
- Email: support@transpopilot.ai
- Include: Deployment platform, error messages, and diagnostics page screenshot
