# DailyFill — Vercel Deployment Guide

## Prerequisites

1. **Supabase account** — [supabase.com](https://supabase.com)
2. **Vercel account** — [vercel.com](https://vercel.com)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Get your **Service Role Key** (Settings → API — keep this secret!)

---

## Step 2: Run Database Migrations

In Supabase Dashboard → **SQL Editor**, run these in order:

1. **`supabase/migrations/001_create_users_table.sql`** (if not already run)
2. **`supabase/migrations/002_profiles_scores.sql`**

This creates:
- `profiles` table (linked to auth.users)
- `scores` table for leaderboard
- RLS policies and triggers

---

## Step 3: Configure Supabase Auth

1. **Authentication → Providers** — Email is enabled by default
2. **Authentication → URL Configuration**:
   - Site URL: `https://your-app.vercel.app` (or your domain)
   - Redirect URLs: Add `https://your-app.vercel.app/**` and `http://localhost:5173/**` for dev
3. **Email confirmation** (optional for internal testing):  
   - Authentication → Providers → Email → disable "Confirm email" for faster signup during testing

---

## Step 4: Deploy to Vercel

### Option A: Deploy from GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. **Root Directory**: Set to `daily-fill` if your repo has the app in a subfolder
4. Add **Environment Variables**:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase API settings |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Service role key (secret) |
| `ADMIN_PASSWORD` | `dailyfill2026` | Admin panel password (optional) |

5. Deploy

### Option B: Deploy via CLI

```bash
cd daily-fill
npm i -g vercel
vercel
# Follow prompts, add env vars when asked
```

---

## Step 5: Post-Deploy Checklist

- [ ] Sign up with a test email — verify it works
- [ ] Complete a puzzle — verify score appears on leaderboard
- [ ] Visit `https://your-app.vercel.app/#admin` — enter password `dailyfill2026`
- [ ] Admin dashboard shows real users and puzzle stats

---

## Local Development with Supabase

1. Copy `.env.example` to `.env`
2. Add your Supabase URL and keys
3. Run `npm run dev` (no Express server needed — auth goes to Supabase)
4. API routes (`/api/admin/*`) won't work locally unless you run `vercel dev`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Supabase not configured" | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel env |
| Admin shows 0 users | Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env |
| Password reset link fails | Add your Vercel URL to Supabase Auth → Redirect URLs |
| Leaderboard empty | Complete a puzzle while logged in — scores submit automatically |
