# CLAUDE.md — MindSync Working Edition

## Project Identity

**Name:** MindSync
**Status:** ✅ Production Ready (This is the active, working edition)
**Location:** `/c/Users/Rex/projects/mindsync/`
**GitHub:** https://github.com/gatugo/mindsync
**Live Demo:** https://mindsync-topaz.vercel.app

---

## ⚠️ CRITICAL: No Rebuild Here

**This is NOT the rebuild project.** The SvelteKit/Convex rebuild (`mindsync-rebuild/`) was deleted on May 27, 2026 to avoid confusion.

**If you see references to "rebuild" in old documentation, ignore them.** They refer to the deleted folder.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Backend:** Supabase (PostgreSQL + Auth)
- **AI:** Groq / Gemini / StepFun (multi-provider)
- **Testing:** Jest / Playwright

---

## Quick Start

```bash
cd /c/Users/Rex/projects/mindsync

# Install dependencies (first time)
npm install

# Start dev server
npm run dev
# → Opens at http://localhost:3000

# Run tests
npm test

# Build for production
npm run build
```

---

## Environment Variables

Create `.env.local` in the project root:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Provider (choose one)
AI_PROVIDER=groq  # or gemini, stepfun
GROQ_API_KEY=gsk_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See `docs/CONTEXT.md` for detailed setup.

---

## Project Structure

```
mindsync/
├── src/
│   ├── app/              # Next.js pages & API routes
│   │   ├── page.tsx      # Main dashboard
│   │   └── api/          # AI Coach endpoint, etc.
│   ├── components/       # React components
│   │   ├── AICoachScreen.tsx  ← Main AI interface
│   │   ├── TimelineView.tsx   ← Hourly schedule
│   │   ├── KanbanBoard.tsx    ← TODO/START/DONE
│   │   ├── GoalsPanel.tsx     ← Goals tracker
│   │   └── ...
│   ├── store/            # Zustand state
│   │   └── useStore.ts   # Global state + localStorage sync
│   ├── lib/              # Utilities
│   │   ├── supabase.ts   # Database client
│   │   ├── aiService.ts  # AI API calls
│   │   └── ...
│   └── types/            # TypeScript types
├── docs/                 # Documentation
│   ├── CONTEXT.md        # ← READ THIS FIRST
│   ├── TASKS.md          # Progress tracker
│   └── ...
├── public/               # Static assets
└── package.json
```

---

## Key Files to Read First

1. **`docs/CONTEXT.md`** — Project overview, features, AI prompts
2. **`docs/TASKS.md`** — Session history and next steps
3. **`src/store/useStore.ts`** — Central state (tasks, goals, history)
4. **`src/components/AICoachScreen.tsx`** — AI Coach UI + logic

---

## Recent Work (May 27, 2026)

### AI Coach Formatting Fixes
- Fixed bold text color inheritance in `AICoachScreen.tsx`
- Removed forced `text-white` from `<strong>` tags
- Removed `font-medium` from message containers
- Build compiles successfully

### Previous Sessions
- May 21: SSR fixes, Vercel deployment resolved
- May 20: Phase 10 complete (testing, security audit)
- May 19: All 10 phases complete (100% feature complete)

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)

# Testing
npm test                 # Run unit tests
npm run test:watch       # Watch mode

# Build
npm run build            # Production build
npm run start            # Start production server

# Database
# → Supabase dashboard: https://supabase.com/dashboard
```

---

## Known Issues

1. **AI Coach formatting** - Fixed May 27, verify with real AI responses
2. **Mobile responsiveness** - Could be improved on some pages
3. **Test coverage** - Could expand beyond unit tests

---

## Memory System

This project uses Claude Code's auto-memory system. Memories are stored in:
`C:\Users\Rex\.claude\projects\c--Users-Rex-projects-mindsync\memory\`

Key memory files:
- `MEMORY.md` - Index of all memories
- `AI-COACH-FORMATTING-FIXED-2026-05-27.md` - Latest fix
- `SESSION-SUMMARY-2026-05-27.md` - Last session summary

---

## Git

```bash
git status
git add .
git commit -m "feat: description"
git push origin main
```

**Remote:** https://github.com/gatugo/mindsync.git

---

## When Starting a New Session

1. Read this file (CLAUDE.md)
2. Read `docs/CONTEXT.md` for full context
3. Check `docs/TASKS.md` for current status
4. Ask user what they want to work on

---

## Important Rules

- ✅ **Do:** Work in the working edition (this folder)
- ✅ **Do:** Read CONTEXT.md before making changes
- ✅ **Do:** Test locally before committing
- ❌ **Don't:** Create a rebuild folder again
- ❌ **Don't:** Switch tech stacks without explicit approval
- ❌ **Don't:** Delete docs/TASKS.md without archiving

---

**Last Updated:** May 27, 2026
**Maintained By:** Rex + Claude Code
**Status:** ✅ Active — This is the only edition that matters
