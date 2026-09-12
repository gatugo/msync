# MindSync Showcase Demo Script
## 2-Day Calendar Fill: Sep 9 and Sep 10, 2026

---

## Setup
1. Open http://localhost:3000
2. Go to Settings → StepFun AI Configuration
3. Confirm:
   - API Key: configured
   - Base URL: https://api.stepfun.ai/step_plan/v1
   - Model: step-3.5-flash-2603
4. Verify AI Coach header shows green **StepFun** badge
5. Open DevTools → Network tab (optional, for verification)

---

## Day 1: September 9, 2026 (Wednesday)

### Prompt 1: Morning Meeting
**Input:** `Schedule morning meeting on 2026-09-09 at 9am for 1 hour`
**Expected:**
- Title: Morning meeting
- Date: 2026-09-09
- Time: 9:00 AM
- Duration: 60m
- Type: ADULT

### Prompt 2: Gym Session
**Input:** `Schedule gym on 2026-09-09 at 5pm for 1 hour`
**Expected:**
- Title: Gym
- Date: 2026-09-09
- Time: 5:00 PM
- Duration: 60m
- Type: ADULT

### Prompt 3: Evening Wind-Down
**Input:** `Schedule meditation on 2026-09-09 at 8pm for 30 minutes`
**Expected:**
- Title: Meditation
- Date: 2026-09-09
- Time: 8:00 PM
- Duration: 30m
- Type: REST

---

## Day 2: September 10, 2026 (Thursday)

### Prompt 4: Deep Work Block
**Input:** `Schedule deep work on 2026-09-10 at 10am for 2 hours`
**Expected:**
- Title: Deep work
- Date: 2026-09-10
- Time: 10:00 AM
- Duration: 120m
- Type: ADULT

### Prompt 5: Lunch Break
**Input:** `Schedule lunch on 2026-09-10 at 12:30pm for 45 minutes`
**Expected:**
- Title: Lunch
- Date: 2026-09-10
- Time: 12:30 PM
- Duration: 45m
- Type: REST

### Prompt 6: Creative Session
**Input:** `Schedule painting on 2026-09-10 at 3pm for 1 hour`
**Expected:**
- Title: Painting
- Date: 2026-09-10
- Time: 3:00 PM
- Duration: 60m
- Type: CHILD

### Prompt 7: Evening Wrap
**Input:** `Schedule review on 2026-09-10 at 5:30pm for 30 minutes`
**Expected:**
- Title: Review
- Date: 2026-09-10
- Time: 5:30 PM
- Duration: 30m
- Type: ADULT

---

## Verification Checklist

### After Each Prompt:
- [ ] AI Coach shows response WITHOUT `[OFFLINE MODE]`
- [ ] Action block shows correct date and time
- [ ] Click **Add to Timeline**
- [ ] Task appears in Timeline view on correct date
- [ ] No duplicate tasks created

### Final Calendar State:
**Sep 9:**
- [ ] 9:00 AM - Morning meeting (60m, ADULT)
- [ ] 5:00 PM - Gym (60m, ADULT)
- [ ] 8:00 PM - Meditation (30m, REST)

**Sep 10:**
- [ ] 10:00 AM - Deep work (120m, ADULT)
- [ ] 12:30 PM - Lunch (45m, REST)
- [ ] 3:00 PM - Painting (60m, CHILD)
- [ ] 5:30 PM - Review (30m, ADULT)

### Network Verification:
- [ ] DevTools Network tab shows `/api/coach` requests
- [ ] Each request payload contains `stepfunConfig` with API key
- [ ] Responses are streaming (not instant)

---

## Fallback Test (Smart Logic)

1. Go to Settings
2. Clear API Key
3. Save Config
4. Verify AI Coach header shows amber **Smart Logic** badge
5. Send: `Schedule gym on 2026-09-10 at 6pm for 1 hour`
6. Expected:
   - Shows `[OFFLINE MODE]`
   - Still creates task with parsed date/time
   - No `/api/coach` request in Network tab

---

## Demo Talking Points

1. **"No cloud dependencies"** - All data stored locally in browser
2. **"Bring your own AI"** - Users enter their own StepFun API key
3. **"Natural language scheduling"** - "on 2026-09-10 at 7pm" → exact calendar entry
4. **"Dual mode"** - Works offline with Smart Logic, online with StepFun
5. **"Local-first privacy"** - API key never leaves user's browser except to StepFun

---

## Quick Reset Between Demos

```javascript
// In browser console to clear all data
localStorage.clear();
location.reload();
```

Or use Settings → Data Management → Erase All Data
