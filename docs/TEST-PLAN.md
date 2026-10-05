# MindSync — Manual Test Plan

> **Purpose:** Verify the showcase demo flow and key features before presenting MindSync.

## Prerequisites

1. App running at `http://localhost:3000`
2. StepFun API key configured in **Settings** (optional — offline mode also works)
3. Browser DevTools **Network** and **Console** tabs open

---

## Test 1: Settings & Model List

**Steps:**
1. Open `http://localhost:3000`
2. Click **Settings**
3. Expand **StepFun AI Configuration**
4. Enter a StepFun API key
5. Verify the model dropdown shows only:
   - `step-3.7-flash`
   - `step-3.5-flash`
   - `step-3.5-flash-2603`

**Expected:**
- ✅ No deprecated entries like `step-router-v1`
- ✅ API key saved to browser `localStorage`
- ✅ Settings shows local key status

---

## Test 2: AI Coach — Online Mode

**Steps:**
1. With a valid StepFun key in Settings, open **Coach**
2. Type: `"Schedule meditation on 2026-09-09 at 8pm for 30 minutes"`
3. Click **Send**
4. Inspect the Network tab for a request to `/api/coach`

**Expected:**
- ✅ Request sent to `/api/coach`
- ✅ Response includes an action block with **Add to Timeline**
- ✅ Clicking **Add to Timeline** creates the task
- ✅ Mode indicator shows **StepFun**

---

## Test 3: AI Coach — Offline / Smart Logic Fallback

**Steps:**
1. Go to **Settings** and clear the StepFun API key
2. Open **Coach**
3. Type: `"Schedule gym on 2026-09-10 at 6pm for 60 minutes"`
4. Click **Send**

**Expected:**
- ✅ Mode indicator shows **SMART LOGIC**
- ✅ Response includes an action block with **Add to Timeline**
- ✅ Task is created with:
  - `scheduledDate = 2026-09-10`
  - `scheduledTime = 18:00`
  - `duration = 60`
  - `type = ADULT`
- ✅ No network request sent to `/api/coach`

---

## Test 4: Explicit-Date Scheduling

**Steps:**
1. In **Coach**, send:
   - `"Schedule yoga on 2026-09-09 at 7am for 30 minutes"`
   - `"Schedule meeting on 2026-09-10 at 2pm for 45 minutes"`
2. Open **Timeline** view
3. Switch to each date and verify task placement

**Expected:**
- ✅ Dates parsed as `YYYY-MM-DD`
- ✅ Times parsed correctly
- ✅ Tasks appear on the correct timeline dates
- ✅ No timezone/off-by-one day issues

---

## Test 5: Goals — Breakdown & Start

**Steps:**
1. Open **Goals** panel
2. Create a goal: `"Launch website"`, target date `2026-09-15`
3. Click the **Sparkles** icon (**Breakdown with AI**)
4. Verify Coach opens with a breakdown prompt
5. Verify the response contains 3–4 sequenced starter tasks with **Add to Timeline** buttons
6. Close Coach, then click the **Play** icon (**Start**) on the same goal
7. Verify Coach opens with starter tasks again

**Expected:**
- ✅ Breakdown returns concrete starter tasks
- ✅ Start returns concrete starter tasks
- ✅ Both flows include actionable `[ACTION: CREATE_TASK ...]` blocks
- ✅ Goals panel can be dismissed with **Escape**, overlay click, or **X**

---

## Test 6: Chat UI Space

**Steps:**
1. Open **Coach**
2. Send any message
3. Observe the quick-action pills below the input

**Expected:**
- ✅ Prompt pills and quick actions collapse after the first message
- ✅ More vertical space is available for the conversation

---

## Test 7: Undefined Resilience

**Steps:**
1. In **Coach**, send a malformed or unexpected request that might trigger fallback parsing
2. Observe the response

**Expected:**
- ✅ No raw `undefined` text appears in the UI
- ✅ Coach shows a coherent response or a safe fallback message

---

## Test 8: Supabase / Console Warnings

**Steps:**
1. Hard-refresh the app (`Ctrl+Shift+R`)
2. Open DevTools **Console**
3. Look for any Supabase-related warnings or credential errors

**Expected:**
- ✅ Zero Supabase mentions
- ✅ Zero credential warnings
- ✅ No uncaught errors on load

---

## Test 9: Data & Privacy

**Steps:**
1. Open DevTools **Application → Local Storage**
2. Verify data is stored under `mindsync-storage`
3. Use **Export** to download a JSON backup
4. Clear local storage and use **Import** to restore

**Expected:**
- ✅ No cloud sync, accounts, or telemetry
- ✅ Export/import round-trips cleanly
- ✅ Clearing storage does not break the app

---

## Demo Checklist

- [ ] App loads without console errors
- [ ] Settings shows cleaned model list, no deprecated entries
- [ ] Coach responds in online mode with StepFun key
- [ ] Coach falls back to Smart Logic without a key
- [ ] Explicit-date scheduling works across multiple dates
- [ ] Tasks appear on the correct timeline dates
- [ ] Goals breakdown/start return real starter tasks
- [ ] Chat pills collapse after the first message
- [ ] No `undefined` text in Coach responses
- [ ] Hard refresh shows no Supabase warnings
- [ ] Data stays in `localStorage` only

---

*Test plan updated for current showcase build.*
