# How to Run DailyFill

## One command to start everything

```bash
npm run dev:full
```

Then open **http://localhost:5173** (or 5174 if 5173 is busy) in your browser.

---

## Auth flow

**New user:**
1. Enter **email** → Continue
2. Create **password** (min 6 chars) + confirm → Continue
3. Choose **alias** (3–20 chars, unique) → Let's Play
4. You're in!

**Returning user:**
1. Enter **email** → Continue
2. Enter **password** → Sign in
3. You're in!

**Forgot password:**
1. On the password screen, click **Forgot password?**
2. Enter **new password** + confirm → Reset Password
3. Back to sign in with your new password

---

## Data storage

Users are stored in `server/data/users.json` (created automatically). Passwords are hashed with bcrypt.

---

## Admin dashboard

Open `http://localhost:5173/#admin` (or your port) to view the admin panel. Default password: `dailyfill2026`
