# DailyFill — Auto-Deploy Setup (Step-by-Step)

This guide sets up **automatic deployment** so that when you push changes to GitHub:
- **Vercel** deploys your frontend (already works if your repo is connected)
- **Supabase** runs migrations so your database stays in sync

---

## Part 1: Vercel (Already Automatic)

If your GitHub repo is connected to Vercel, **you're done**. Every push to `main` triggers a new deployment.

**To verify:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Open your DailyFill project
3. Check **Settings → Git** — your repo should be connected
4. Push a small change and confirm a new deployment appears under **Deployments**

---

## Part 2: Supabase Auto-Migrations (One-Time Setup)

### Step 1: Get your Supabase Project Reference ID

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Open your DailyFill project
3. Go to **Project Settings** (gear icon in the left sidebar)
4. Under **General**, find **Reference ID** — it looks like `abcdefghijklmnop`
5. Copy it — you'll need it as `SUPABASE_PROJECT_REF`

---

### Step 2: Create a Supabase Access Token

1. Go to [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Click **Generate new token**
3. Name it something like `GitHub Actions - DailyFill`
4. Copy the token immediately (you won't see it again)
5. You'll add this as `SUPABASE_ACCESS_TOKEN` in GitHub

---

### Step 3: Get your Database Password

- This is the password you set when you created the Supabase project
- If you don't remember it: **Project Settings → Database** → you can reset the database password
- You'll add this as `SUPABASE_DB_PASSWORD` in GitHub

---

### Step 4: Add Secrets to GitHub

1. Go to your repo on GitHub: `https://github.com/YOUR_USERNAME/daily-fill`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these three:

| Name | Value |
|------|-------|
| `SUPABASE_ACCESS_TOKEN` | The token from Step 2 |
| `SUPABASE_PROJECT_REF` | The Reference ID from Step 1 |
| `SUPABASE_DB_PASSWORD` | Your database password from Step 3 |

---

### Step 5: Push the Workflow (If You Haven't Already)

The workflow file is at `.github/workflows/deploy.yml`. If it's in your repo and you've pushed it, you're set.

To push:
```bash
cd daily-fill
git add .github/workflows/deploy.yml DEPLOYMENT.md
git commit -m "Add auto-deploy workflow for Supabase migrations"
git push origin main
```

---

### Step 6: Test It

1. Make a small change to any file in `supabase/migrations/` (e.g. add a comment)
2. Commit and push:
   ```bash
   git add supabase/migrations/
   git commit -m "Trigger migration workflow"
   git push origin main
   ```
3. Go to your repo on GitHub → **Actions** tab
4. You should see a **Deploy** workflow run
5. Click it to see the logs — it should complete with "Push migrations" succeeding

---

## Your Day-to-Day Flow

From now on:

1. **Edit in Cursor** → save your changes
2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Your change description"
   git push origin main
   ```
3. **Vercel** deploys your frontend in ~1–2 minutes
4. **Supabase** migrations run automatically when you change files in `supabase/migrations/`
5. Visit your live URL to see the changes

---

## Troubleshooting

**"Supabase Migrations" workflow fails**
- Check the **Actions** tab for the error message
- Verify all three secrets are set correctly in GitHub
- Ensure your database password is correct (try resetting it in Supabase if needed)

**Vercel doesn't deploy**
- Confirm your repo is connected in Vercel project settings
- Check that you're pushing to the branch Vercel is watching (usually `main`)

**Migrations run but tables don't change**
- Migrations are applied in order; already-applied migrations are skipped
- Check Supabase **Table Editor** or **SQL Editor** to confirm schema state
