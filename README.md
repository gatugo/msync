# MindSync - Working Edition

**Status:** ✅ **PRODUCTION READY** — This is the active, maintained version
**Tech Stack:** Next.js 16 + TypeScript + Tailwind CSS + Supabase + Zustand
**Live Demo:** https://mindsync-topaz.vercel.app
**GitHub:** https://github.com/gatugo/mindsync

---

## ⚠️ Important: Use This Folder

**This is the working, deployed edition.** There is no "rebuild" folder anymore—it was consolidated here on May 27, 2026.

If you're looking for the SvelteKit/Convex rebuild attempt, it has been archived and removed to avoid confusion.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Opens at http://localhost:3000

# Build for production
npm run build

# Run tests
npm test
```

---

## ✨ Features (All Working)

- ✅ **Timeline View** - Hourly schedule with drag-and-drop
- ✅ **Kanban Board** - TODO/START/DONE columns
- ✅ **AI Coach** - Smart suggestions with conversation memory (StepFun/Gemini/Groq)
- ✅ **Natural Language Parsing** - "gym tomorrow 5pm" auto-creates tasks
- ✅ **Balance Scoring** - Adult/Child/Rest ratio tracking
- ✅ **Goals System** - Target dates and progress tracking
- ✅ **Export/Import** - JSON backup and restore
- ✅ **Dark Mode** - System-wide theme toggle
- ✅ **Mobile Responsive** - PWA-ready with bottom navigation
- ✅ **Supabase Auth** - Email/password authentication

---

## 📂 Project Structure

```
mindsync/
├── src/
│   ├── app/                    # Next.js 16 App Router
│   │   ├── page.tsx            # Main dashboard
│   │   ├── layout.tsx          # Root layout
│   │   ├── api/                # API routes (AI Coach, etc.)
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── AICoachScreen.tsx   # AI Coach UI
│   │   ├── TimelineView.tsx    # Timeline grid
│   │   ├── KanbanBoard.tsx     # Kanban columns
│   │   ├── GoalsPanel.tsx      # Goals tracker
│   │   ├── BottomNav.tsx       # Mobile navigation
│   │   ├── EditTaskModal.tsx   # Task editor
│   │   └── ...
│   ├── store/                  # Zustand state management
│   │   └── useStore.ts         # Global state
│   ├── lib/                    # Utilities
│   │   ├── supabase.ts         # Supabase client
│   │   ├── aiService.ts        # AI API integration
│   │   ├── parseNaturalLanguage.ts
│   │   └── ...
│   └── types/                  # TypeScript definitions
├── docs/                       # Documentation
│   ├── CONTEXT.md              # Project brain
│   ├── TASKS.md                # Progress tracker
│   └── archive/                # Archived docs
├── public/                     # Static assets
└── package.json
```

---

## 🔑 Environment Setup

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Provider (choose one)
AI_PROVIDER=groq  # or gemini, stepfun
GROQ_API_KEY=your_groq_key
# GEMINI_API_KEY=your_gemini_key
# STEPFUN_API_KEY=your_stepfun_key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📖 Documentation

- **[docs/CONTEXT.md](docs/CONTEXT.md)** - Project overview, architecture, and AI context
- **[docs/TASKS.md](docs/TASKS.md)** - Session notes, completed tasks, and next steps
- **[docs/DEPLOYMENT_OPTIONS.md](docs/DEPLOYMENT_OPTIONS.md)** - Vercel, Railway, Oracle Cloud guides

---

## 🎯 Recent Work

### May 28, 2026
- Modernized AI Coach UI to a premium twenty-twenty-six aesthetic (asymmetric bubbles, holographic HUD, floating command bar).
- Optimized layout for large monitors with a new responsive dual-panel dashboard.
- Consolidated navigation to maximize vertical workspace (`100dvh`).
- Added roadmap for purely local, in-browser model failovers.

### May 27, 2026
- Fixed AI Coach formatting bugs (bold text color inheritance)
- Verified production build compiles successfully
- Confirmed all features working locally

### May 21, 2026
- Completed SSR fixes for Vercel deployment
- Fixed Convex client initialization
- Deployed to https://mindsync-v2.vercel.app

### May 20, 2026
- Phase 10 complete: Testing & Security audit
- 71 unit tests passing
- Security score: 9/10
- All 10 phases functionally complete

---

## 🔒 Security Notes

- ✅ Row-level security via Supabase RLS policies
- ✅ Input validation with Zod schemas
- ✅ API keys server-side only (Next.js API routes)
- ✅ Rate limiting on AI endpoints
- ✅ XSS prevention (React escapes by default)
- ✅ Audit logging for all mutations

---

## 📝 Notes for AI Assistants

**Start here:** Read `docs/CONTEXT.md` for full project context before making changes.

**Key files to understand:**
1. `src/store/useStore.ts` - Central state management
2. `src/lib/aiService.ts` - AI integration logic
3. `src/components/AICoachScreen.tsx` - Main AI interface
4. `src/lib/parseNaturalLanguage.ts` - Natural language parser

**Tech debt:**
- Some components still use legacy patterns
- Mobile responsiveness could be improved
- Test coverage could be expanded

---

## 🚀 Deployment

**Recommended:** Vercel (already deployed)

```bash
# Push to GitHub
git push origin main

# Vercel auto-deploys from GitHub
# Or deploy manually:
vercel --prod
```

See [docs/DEPLOYMENT_OPTIONS.md](docs/DEPLOYMENT_OPTIONS.md) for alternatives.

---

**Last Updated:** May 27, 2026
**Status:** ✅ Production Ready — No rebuild needed
