# DailyFill

A daily crossword puzzle app — one puzzle, every player, every day.

## Tech Stack

- **React 18** + **Vite 5**
- Pure inline styles (no CSS framework needed)
- Fonts: Libre Baskerville (serif) + Source Sans 3 (sans) via Google Fonts

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy .env.example to .env and add your keys
cp .env.example .env

# 3. Start dev server (run OTP server for email verification)
npm run dev          # Frontend only (OTP logged to console without server)
npm run dev:full     # Frontend + OTP server (sends real emails with RESEND_API_KEY)

# 4. Open http://localhost:5173
```

## Build for Production

```bash
npm run build
# Output goes to /dist — deploy to Vercel, Netlify, or any static host
```

## Project Structure

```
daily-fill/
├── index.html               # HTML shell, fonts, global CSS keyframes
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx             # React entry point
    ├── App.jsx              # All state management & game logic
    ├── data/
    │   └── puzzles.js       # All puzzle grids, clues, categories
    ├── utils/
    │   ├── helpers.js       # getCountdown, bounds, pairFor, numAt
    │   └── styles.js        # COLORS, FONTS, shared style objects
    └── screens/
        ├── SplashScreen.jsx
        ├── AuthScreen.jsx
        ├── UsernameScreen.jsx
        ├── HomeScreen.jsx
        ├── GameScreen.jsx   # Main crossword UI
        └── LeaderboardScreen.jsx
```

## Key Files to Edit

| What you want to change | File |
|---|---|
| Add/edit puzzles | `src/data/puzzles.js` |
| Change colors, fonts | `src/utils/styles.js` |
| Game rules / scoring | `src/App.jsx` (top of file, `PENALTY` constant in puzzles.js) |
| Crossword grid rendering | `src/screens/GameScreen.jsx` |
| Home page layout | `src/screens/HomeScreen.jsx` |

## Scoring System

- Start: **100 pts**
- Wrong at submit: **−3 pts per wrong cell**
- Reveal Letter: **−5 pts**
- Reveal Word: **−15 pts**
- Reveal Entire Grid: **−100 pts**
- Check Word (when word has errors): **−10 pts**

## Auth Flow (Email OTP)

1. User enters email → server sends 6-digit OTP via branded email (Resend)
2. User enters OTP → verified → new users choose alias, returning users go to home
3. Session persists on device (no re-login unless user logs out)

**Setup:**
- Add `RESEND_API_KEY` to `.env` (get from [resend.com](https://resend.com))
- Run `npm run dev:full` to start frontend + OTP server
- Without the server, OTP is logged to console (dev only)

## Supabase Setup (User Database)

User signup, login, and the Admin dashboard use Supabase when configured.

1. Create a project at [supabase.com](https://supabase.com)
2. In SQL Editor, run: `supabase/migrations/001_create_users_table.sql`
3. Add to `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. On first load with Supabase, existing localStorage user data is cleared (one-time migration)

Without Supabase, the app falls back to localStorage (dev only).

## Next Steps (Backend)

1. **Daily puzzle**: Serve today's puzzle from an API keyed by `YYYY-MM-DD`
2. **Leaderboard**: Real-time rankings via Supabase Realtime or Firebase RTDB
3. **Scoring**: Validate scores server-side to prevent tampering

## Design Notes

- Mobile-first, max-width 480px, works on desktop too
- Crossword grid cells are auto-sized to fit the viewport width
- Physical keyboard fully supported (letters, Backspace, Tab to flip direction)
- No right/wrong cell feedback during play — only revealed after puzzle completion or Check Word
- Resets daily at midnight IST
