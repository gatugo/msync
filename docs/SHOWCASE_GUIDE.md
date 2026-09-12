# MindSync — Final Report, User Guide & Framework

> **Purpose:** This document is the single source of truth for showcasing MindSync. It covers what the app does, how it works, how to use it, and the psychological framework behind it.

---

## 1. Final Report: App & Features

### 1.1 What Is MindSync?

MindSync is a **second-brain psychological task management system** that balances three modes of human activity:

- **Adult Brain** — productivity, responsibility, long-term goals
- **Child Brain** — play, creativity, fun, stimulation
- **Rest** — recovery, vegetative reset, guilt-free downtime

Unlike ordinary todo apps, MindSync doesn’t just track tasks. It classifies them, schedules them across days, scores your daily balance, and uses an AI Coach to convert vague goals into executable action blocks.

### 1.2 Current State

| Area | Status |
|------|--------|
| Timeline scheduling | ✅ Working |
| Kanban board (TODO/START/DONE) | ✅ Working |
| AI Coach — online (StepFun) | ✅ Working |
| AI Coach — offline (Smart Logic) | ✅ Working |
| Natural language time parsing | ✅ Working |
| Explicit-date scheduling | ✅ Working |
| Goals creation & breakdown | ✅ Working |
| Goals start flow | ✅ Working |
| Balance scoring | ✅ Working |
| Dark mode / responsive UI | ✅ Working |
| Supabase removal / localStorage only | ✅ Working |
| Settings / API key management | ✅ Working |
| Build stability | ✅ Passing |

### 1.3 What the App Can Do

1. **Create and schedule tasks** via modal form or natural language in AI Coach.
2. **Parse natural language** like `"Schedule meditation on 2026-09-09 at 8pm for 30 minutes"` into structured tasks.
3. **Balance your day** by tagging tasks as ADULT, CHILD, or REST and viewing a daily score.
4. **Set goals** with target dates and break them into starter tasks using AI.
5. **Chat with AI Coach** that either calls StepFun or falls back to Smart Logic when no API key is present.
6. **Add Coach suggestions to your timeline** with one click.
7. **Move tasks between columns** on the Kanban board.
8. **Export / import** your data as JSON.
9. **Work offline** — all data lives in `localStorage` under `mindsync-storage`.
10. **Switch providers** — the app is provider-agnostic; StepFun is the default, but the architecture supports others.

### 1.4 Architecture Overview

```
User Interface
  ├── Timeline View (daily/hourly schedule)
  ├── Kanban Board (TODO → START → DONE)
  ├── AI Coach (chat + action blocks)
  ├── Goals Panel (targets + breakdown/start)
  └── Settings (API key, model, theme)

State Layer
  └── Zustand store + db.ts (localStorage persistence)

AI Layer
  ├── Online: /api/coach → StepFun StepPlan
  └── Offline: runOfflineLogic() → Smart Logic

Data Model
  ├── Task { id, title, type, scheduledDate, scheduledTime, duration, status }
  ├── Goal { id, title, targetDate, completed }
  └── Message { id, role, content, actions[] }
```

---

## 2. User Guide

### 2.1 Getting Started

1. Open `http://localhost:3000` in your browser.
2. No account is required. Data is stored locally in your browser.
3. Optional: Go to **Settings** and enter a StepFun API key to unlock advanced AI coaching.

### 2.2 Tabs & Navigation

| Tab | Purpose |
|-----|---------|
| **Home** | Main dashboard with timeline, tasks, and goals |
| **Coach** | AI Coach chat interface |
| **Stats** | Balance scoring and insights |
| **Settings** | API key, model selection, theme |

### 2.3 Creating Tasks

#### Option A: Timeline / Kanban
1. Click **+ Add Task** in the Timeline or Kanban view.
2. Enter title, date, time, duration, and type (ADULT / CHILD / REST).
3. Click **Add to Timeline** or **Save**.

#### Option B: Natural Language in AI Coach
1. Open **Coach** tab.
2. Type a request like:
   - `"Schedule meditation on 2026-09-09 at 8pm for 30 minutes"`
   - `"Add a 1-hour workout tomorrow at 6am"`
3. The Coach parses it and returns an action block with **Add to Timeline**.

### 2.4 Using AI Coach

#### Online Mode (StepFun Key Configured)
- Coach calls the StepFun StepPlan API.
- Responses include structured reasoning, action blocks, and follow-up suggestions.
- Mode indicator shows: **StepFun**.

#### Offline Mode (No API Key)
- Coach automatically falls back to **Smart Logic**.
- Still parses explicit dates and times.
- Still creates tasks with correct `scheduledDate`, `scheduledTime`, and `duration`.
- Mode indicator shows: **SMART LOGIC**.

#### Chat UX
- Type a message and press **Enter** or click the send button.
- After the first response, quick-action pills collapse to give more space to the conversation.
- Each AI response may include:
  - **Add to Timeline** — creates the suggested task
  - **Suggest Another** — regenerates the suggestion
  - **Mental Note** — saves a context snippet to memory

### 2.5 Goals

#### Creating a Goal
1. Open the **Goals** panel.
2. Click **Set New Target**.
3. Enter goal title, target date, and optional time.
4. Click **Start Journey**.

#### Breaking Down a Goal
1. Find an active goal in the Goals list.
2. Click the **Sparkles** icon (`Breakdown with AI`).
3. Coach opens with a prompt to break the goal into 3–4 smaller tasks.
4. Review the starter tasks and click **Add to Timeline** for each.

#### Starting a Goal
1. Find an active goal.
2. Click the **Play** icon (`Start`).
3. Coach opens with starter tasks to begin execution immediately.

#### Completing a Goal
- Click the **Checkmark** icon to toggle completion without opening Coach.

### 2.6 Calendar & Scheduling

- The **Timeline View** shows tasks by hour for the selected date.
- Tasks created by Coach include explicit `scheduledDate` and `scheduledTime`.
- Drag-and-drop rescheduling is supported where implemented.
- Conflict detection exists; an override path is available for intentional overlaps.

### 2.7 Balance & Types

Every task has a **type**:
- **ADULT** — work, responsibilities, deep focus
- **CHILD** — play, creativity, fun
- **REST** — recovery, breaks, vegetative reset

The app tracks daily ratios and warns when a day is unbalanced.

### 2.8 Settings

| Setting | Purpose |
|---------|---------|
| **StepFun API Key** | Enables online AI Coach mode |
| **Model** | Choose between `step-3.7-flash`, `step-3.5-flash`, `step-3.5-flash-2603` |
| **Theme** | Light / dark mode |
| **Clear Data** | Reset all localStorage |

> **Security note:** Your API key is stored only in your browser’s `localStorage`. It is never hardcoded into the app, never sent to any server except StepFun, and is not included in build artifacts.

### 2.9 Data & Privacy

- All data is local by default (`localStorage` key: `mindsync-storage`).
- No cloud sync, no accounts, no telemetry.
- Use **Export** to back up your data as JSON.
- Use **Import** to restore from a backup.

---

## 3. MindSync Framework & Methodology

### 3.1 Core Philosophy

MindSync is built on the premise that the brain operates in distinct modes, and optimal mental health comes from **intentionally balancing** them rather than letting one dominate.

### 3.2 The Three Brain Modes

#### Adult Brain
- **Focus:** productivity, responsibility, long-term planning
- **Risk:** can override Child and Rest needs, leading to burnout
- **App mapping:** ADULT tasks, goals, deadlines, scheduling

#### Child Brain
- **Focus:** stimulation, fun, creativity, learning
- **Risk:** can avoid Adult responsibilities if unchecked
- **App mapping:** CHILD tasks, creative projects, play breaks

#### Rest
- **Focus:** recovery, dissociation reset, vegetative recovery
- **Risk:** often dismissed as “laziness” by the Adult brain
- **App mapping:** REST tasks, breaks, “do nothing” permission blocks

### 3.3 Fun vs Enjoyable

| | Fun | Enjoyable |
|--|-----|-----------|
| **Goal** | Yes | Yes |
| **Skill** | Yes | Yes |
| **Challenge** | Yes | Yes |
| **Reward hormones** | Yes | Yes |
| **Long-term consequences** | No | **Yes** |

**Key insight:** Adding long-term consequences to fun turns it into *enjoyable*. Enjoyable activities drain emotional and energy reserves. MindSync helps users identify which activities truly recharge them.

### 3.4 Vegetative Recovery

When the body is overstimulated, it seeks “doing nothing”:
- Lying down
- Mindless scrolling
- Watching TV

The Adult brain often labels this as lazy. **MindSync gives permission.** REST tasks are first-class citizens in the system, not leftovers.

### 3.5 The Three Phases

#### Phase 1: Self-Value
- Build insight and value of self **outside social supports**
- Develop independence
- Envision a healthy future
- Explore passions without external validation

#### Phase 2: Social Reconnection
- Learn assertive communication
- Establish boundaries
- Practice de-escalation
- Improve communication outcomes

#### Phase 3: Mastery
- Apply Phases 1 and 2 in larger settings
- Engage in family, work, and social events
- Maintain confidence regardless of environment
- Leave interactions without being emotionally drained

### 3.6 Intuition / 6th Sense

- Experience builds pattern recognition
- Like a mechanic diagnosing an engine by sound
- **Intuition = recognizing patterns + assumptions from personal history**
- MindSync tracks patterns over time to help users trust their gut

### 3.7 Parenting Skill: “How Can I Earn It?”

A reframing tool for productivity:
- Instead of: `"I want..."` → `"How can I earn...?"`
- Instead of parent as barrier → child as self-barrier
- Teaches the productivity → reward cycle

### 3.8 How MindSync App Implements the Framework

| Framework Concept | App Feature |
|-------------------|-------------|
| Adult/Child/Rest balance | Task type tagging + daily balance score |
| Fun vs Enjoyable | Activity classification in AI Coach responses |
| Vegetative Recovery | REST task type + “permission to rest” language in Coach |
| Phase progression | Goals system with increasing complexity |
| Intuition development | Conversation memory + pattern tracking |
| “How can I earn it” | Goal breakdown into sequential, earnable tasks |

---

## 4. Showcase Demo Flow

### 4.1 Recommended Demo Sequence (5 Minutes)

1. **Open app** at `http://localhost:3000`
2. **Settings** — show model list, confirm no `step-router-v1`
3. **Coach** — send: `"Schedule meditation on 2026-09-09 at 8pm for 30 minutes"`
   - Show action block with **Add to Timeline**
4. **Add to Timeline** — show task appears with correct date/time/duration
5. **Goals** — create goal: `"Launch website"`
6. **Breakdown with AI** — show Coach returns 4 sequenced starter tasks
7. **Start** — show Coach returns starter tasks again
8. **Hard refresh** — confirm no console errors, no Supabase warnings
9. **Clear API key** — send same prompt, show Smart Logic fallback works
10. **Calendar/Timeline** — show scheduled tasks on correct dates

### 4.2 Key Talking Points

- **No cloud lock-in:** all data in `localStorage`
- **Provider-agnostic AI:** StepFun key in Settings, no hardcoding
- **Offline-first:** Smart Logic fallback ensures Coach always responds
- **Framework-backed:** not just a todo app — grounded in psychological model
- **Date-independent:** demo uses explicit dates, not “tomorrow”
- **Clean architecture:** Zustand + db.ts + API routes = maintainable

---

## 5. Technical Quick Reference

### 5.1 Environment Variables

```env
# .env.local
STEPFUN_API_KEY=your_key_here
STEPFUN_API_URL=https://api.stepfun.ai/step_plan/v1
AI_PROVIDER=stepfun
```

### 5.2 Key Files

| File | Purpose |
|------|---------|
| `src/app/api/coach/route.ts` | StepFun API proxy |
| `src/components/AICoachScreen.tsx` | Coach UI + offline brain |
| `src/components/GoalsPanel.tsx` | Goals CRUD + breakdown/start |
| `src/components/SettingsTab.tsx` | API key + model config |
| `src/lib/coachLogic.ts` | Task parsing + type inference |
| `src/lib/smartLogic.ts` | Offline scheduling logic |
| `src/lib/datePatterns.ts` | Natural language date/time parser |
| `src/lib/db.ts` | localStorage persistence layer |
| `src/store/useStore.ts` | Global state |

### 5.3 Data Model

```typescript
type TaskType = 'ADULT' | 'CHILD' | 'REST';

interface Task {
  id: string;
  title: string;
  type: TaskType;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  duration: number; // minutes
  status: 'TODO' | 'START' | 'DONE';
  createdAt: number;
}

interface Goal {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionBlock[];
}
```

---

## 6. Known Limitations & Future Work

| Item | Status |
|------|--------|
| Supabase auth removed — localStorage only | ✅ Complete |
| Mobile bottom nav | ✅ Implemented |
| Test coverage expansion | 🔲 Optional |
| Additional AI providers | 🔲 Architecture ready |
| Real-time collaboration | 🔲 Not in scope |
| Push notifications | 🔲 Not in scope |

---

*Document generated for showcase purposes. All features verified as of 2026-09-11.*
