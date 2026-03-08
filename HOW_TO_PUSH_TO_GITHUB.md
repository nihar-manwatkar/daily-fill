# How to Push Your Code to GitHub (Step by Step)

When the AI makes changes to your code, you need to "push" those changes to GitHub so Vercel can redeploy your app. Here's how.

---

## Option A: Using Cursor (Easiest)

### Step 1: Open the Source Control panel
- Look at the **left sidebar** in Cursor (the column with icons).
- Click the **branch icon** (it looks like a Y or a fork). This opens "Source Control".
- Or press **Ctrl + Shift + G** (Windows) to open it.

### Step 2: See what changed
- You'll see a list of files that were modified (they might be under "Changes").
- Each file will have a little "M" or "U" next to it (Modified or Untracked).

### Step 3: Stage the changes
- Click the **"+"** button next to "Changes" to stage all files.
- Or click the "+" next to each file to stage them one by one.

### Step 4: Write a commit message
- In the box that says "Message (Ctrl+Enter to commit)", type something like: **Updated app**
- Or: **Fixed blank screen**

### Step 5: Commit
- Press **Ctrl + Enter** (or click the checkmark ✓ above the message box).
- This saves your changes locally.

### Step 6: Push to GitHub
- At the top of the Source Control panel, you'll see a **"Sync Changes"** or **"Push"** button.
- Click it.
- If it asks you to sign in to GitHub, follow the prompts.
- Wait a few seconds. When it says "Pushed" or the sync icon stops spinning, you're done.

### Step 7: Wait for Vercel
- Go to [vercel.com](https://vercel.com) and open your DailyFill project.
- Vercel will automatically start a new deployment (usually within 30 seconds).
- Wait 1–2 minutes for the build to finish.
- Your live site will update.

---

## Option B: Using the Terminal (If Cursor's Source Control doesn't work)

### Step 1: Open the Terminal in Cursor
- Press **Ctrl + `** (backtick, the key above Tab).
- Or go to **View → Terminal**.

### Step 2: Go to your project folder
Type this and press Enter:
```
cd "c:\Users\Nihar Manwatkar\Documents\daily-fill-cursor-project\daily-fill"
```

### Step 3: Check status
Type:
```
git status
```
Press Enter. You'll see which files changed.

### Step 4: Add all changes
Type:
```
git add .
```
Press Enter. (The dot means "everything".)

### Step 5: Commit
Type:
```
git commit -m "Updated app"
```
Press Enter.

### Step 6: Push
Type:
```
git push
```
Press Enter. If it asks for your GitHub username and password, enter them.

### Step 7: Wait for Vercel
- Same as Option A, Step 7.

---

## If Something Goes Wrong

**"Git is not installed"**
- You may need to install Git: [git-scm.com/download/win](https://git-scm.com/download/win)

**"Permission denied" or "Authentication failed"**
- You may need to sign in to GitHub. In Cursor, try: **File → Preferences → Settings**, search for "GitHub", and sign in.

**"Nothing to commit"**
- That's okay! It means there are no new changes to push. Your last push might have already gone through.

---

## Quick Reference

| What you want to do | In Cursor |
|---------------------|-----------|
| See what changed | Left sidebar → Branch icon (Source Control) |
| Save changes to Git | Stage (+) → Type message → Commit (Ctrl+Enter) |
| Send to GitHub | Click "Sync" or "Push" |
| Check if Vercel updated | Go to vercel.com → Your project → Deployments |
