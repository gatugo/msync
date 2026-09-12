/**
 * Manual Test Plan for MindSync AI Coach
 * 
 * This file documents the test cases for verifying:
 * 1. API key configuration in Settings
 * 2. Backend receives and uses StepFun API key
 * 3. Natural language date/time parsing
 * 4. Offline mode fallback
 * 5. Calendar integration
 */

# Test Suite: MindSync AI Coach Demo Readiness

## Prerequisites
1. App running at http://localhost:3000
2. StepFun API key configured in Settings
3. Browser DevTools Network tab open

---

## Test 1: API Key Configuration

**Steps:**
1. Open http://localhost:3000
2. Click Settings
3. Expand "StepFun AI Configuration"
4. Enter API key: `sk-...`
5. Select Base URL: `https://api.stepfun.ai/step_plan/v1`
6. Select Model: `step-3.5-flash`
7. Click "Save Config"
8. Verify green "Connected" badge appears

**Expected Result:**
- ✅ API key saved to localStorage
- ✅ Connected badge visible
- ✅ No error messages

**Verification:**
```javascript
// In browser console
localStorage.getItem('mindsync_stepfun_config')
// Should return JSON with apiKey, baseUrl, model
```

---

## Test 2: Backend API Proxy

**Steps:**
1. Open browser DevTools Network tab
2. Open AI Coach
3. Type: "Hello, can you help me schedule tasks?"
4. Click Send

**Expected Result:**
- ✅ Request sent to `/api/coach`
- ✅ Request payload includes `stepfunConfig` with API key
- ✅ Response is streamed from StepFun (or shows error if key is invalid)

**Verification:**
```javascript
// Check network request payload
// Should include: stepfunConfig: { apiKey: "sk-...", baseUrl: "...", model: "..." }
```

---

## Test 3: Natural Language Date/Time Parsing

**Test Cases:**

### 3.1: Tomorrow
**Input:** `Schedule gym tomorrow at 6pm for 1 hour`
**Expected:**
- Date: Tomorrow's date (YYYY-MM-DD)
- Time: 18:00
- Duration: 60 minutes
- Type: ADULT

### 3.2: Today
**Input:** `Meeting today at 2pm`
**Expected:**
- Date: Today's date (YYYY-MM-DD)
- Time: 14:00
- Duration: 30 minutes (default)
- Type: ADULT

### 3.3: Specific Date
**Input:** `Lunch on 9/10/2026 at 12:30`
**Expected:**
- Date: 2026-09-10
- Time: 12:30
- Duration: 30 minutes
- Type: ADULT

### 3.4: Relative Time
**Input:** `Call in 2 hours`
**Expected:**
- Date: Today
- Time: Current time + 2 hours
- Duration: 30 minutes
- Type: ADULT

### 3.5: Next Weekday
**Input:** `Gym session next Monday at 7am`
**Expected:**
- Date: Next Monday's date
- Time: 07:00
- Duration: 60 minutes
- Type: ADULT

### 3.6: No Time Specified
**Input:** `Buy groceries`
**Expected:**
- Date: Today (or undefined)
- Time: undefined
- Duration: 30 minutes (default)
- Type: ADULT

---

## Test 4: Offline Mode (Smart Logic)

**Steps:**
1. Go to Settings
2. Enable "Force Offline Mode" toggle
3. Open AI Coach
4. Type: `Video game at six PM tonight`
5. Click Send

**Expected Result:**
- ✅ Shows "OFFLINE MODE" header
- ✅ Parses input using smart logic
- ✅ Creates task with:
  - Title: "Video game"
  - Type: CHILD (detected from keywords)
  - Date: Today
  - Time: 18:00 (6 PM)
  - Duration: 30 minutes (default)
- ✅ Shows "Add to Timeline" button
- ✅ No network request sent to `/api/coach`

**Verification:**
```javascript
// Check no network requests
// DevTools Network tab should show no /api/coach request
```

---

## Test 5: Online Mode with Invalid API Key

**Steps:**
1. Go to Settings
2. Enter invalid API key: `sk-invalid-key-123`
3. Save Config
4. Open AI Coach
5. Type: `Schedule gym tomorrow at 6pm`
6. Click Send

**Expected Result:**
- ✅ Shows error message: "AI request failed: 401 - ..."
- ✅ Falls back to offline mode automatically
- ✅ Creates task using smart logic
- ✅ No crash or blank screen

---

## Test 6: Calendar Integration

**Steps:**
1. Use AI Coach to schedule tasks for 9/9/2026:
   - `Morning meeting at 9am for 1 hour`
   - `Gym at 5pm for 1 hour`
   - `Dinner at 7pm for 1 hour`
2. Switch to Timeline view
3. Verify tasks appear on correct dates/times

**Expected Result:**
- ✅ Tasks appear on 9/9/2026 timeline
- ✅ Tasks are positioned at correct times
- ✅ No overlapping tasks (unless intended)
- ✅ Task types have correct colors:
  - ADULT: Blue/Purple
  - CHILD: Pink/Orange
  - REST: Green

**Steps:**
1. Schedule tasks for 9/10/2026:
   - `Morning yoga at 8am for 30 minutes`
   - `Work session at 10am for 2 hours`
   - `Break at 12pm for 30 minutes`
2. Switch to Timeline view
3. Navigate to 9/10/2026
4. Verify tasks appear correctly

**Expected Result:**
- ✅ Tasks appear on 9/10/2026 timeline
- ✅ All times and durations are correct
- ✅ Calendar view shows both days correctly

---

## Test 7: Error Handling

**Test 7.1: Empty Input**
**Input:** (empty)
**Expected:**
- ✅ Send button disabled
- ✅ No request sent

**Test 7.2: Invalid Natural Language**
**Input:** `asdfghjkl random text 12345`
**Expected:**
- ✅ Falls back to default task creation
- ✅ Shows helpful error message

**Test 7.3: Network Timeout**
**Steps:**
1. Disconnect from internet
2. Enable online mode
3. Try to use AI Coach
**Expected:**
- ✅ Shows timeout error
- ✅ Falls back to offline mode
- ✅ User can still create tasks

---

## Test 8: StepFun vs Smart Logic Comparison

**Test 8.1: Smart Logic Only**
**Steps:**
1. Clear API key in Settings
2. Use AI Coach with: `Schedule gym tomorrow at 6pm`
**Expected:**
- ✅ Shows "OFFLINE MODE" header
- ✅ Creates task with basic parsing
- ✅ No advanced AI suggestions

**Test 8.2: StepFun Mode**
**Steps:**
1. Add valid StepFun API key
2. Use AI Coach with: `Schedule gym tomorrow at 6pm`
**Expected:**
- ✅ No "OFFLINE MODE" header
- ✅ Streams response from StepFun
- ✅ Provides intelligent suggestions
- ✅ May suggest related tasks (e.g., "Should I also schedule a post-workout meal?")

---

## Demo Checklist

Before showcasing:

- [ ] App loads without errors
- [ ] Settings > StepFun AI Configuration shows your API key
- [ ] Green "Connected" badge visible
- [ ] AI Coach responds without "Offline Mode"
- [ ] Natural language parsing works for:
  - [ ] "today at 3pm"
  - [ ] "tomorrow at 6pm"
  - [ ] "9/10/2026 at 12pm"
  - [ ] "in 2 hours"
- [ ] Tasks appear in Timeline view on correct dates
- [ ] Tasks have correct times and durations
- [ ] No console errors in DevTools
- [ ] Works offline with Smart Logic fallback
- [ ] Works online with StepFun AI

---

## Quick Test Commands

### Test Backend Proxy
```bash
cd C:/Users/mela/.aiprojects_2/newmind
node -e "
const http = require('http');
const body = JSON.stringify({
  mode: 'chat',
  question: 'Schedule gym tomorrow at 6pm',
  stepfunConfig: { apiKey: 'YOUR_KEY', baseUrl: 'https://api.stepfun.ai/v1', model: 'step-3.7-flash' },
  localDate: '2026-09-09',
  localTime: '14:30',
  tasks: [],
  score: 50,
  balance: 'neutral',
  preferences: { aiEnabled: true, forceOfflineMode: false }
});
const req = http.request({ hostname: 'localhost', port: 3000, path: '/api/coach', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data.substring(0, 200)));
});
req.write(body);
req.end();
"
```

### Test Natural Language Parsing
```javascript
// In browser console on http://localhost:3000
// After opening AI Coach and typing "Schedule gym tomorrow at 6pm for 1 hour"

// Check localStorage for saved tasks
JSON.parse(localStorage.getItem('mindsync-tasks') || '[]')
// Should show task with scheduledDate and scheduledTime
```

---

## Known Issues & Fixes

1. **"Offline Mode" showing despite API key**
   - Fixed: Removed forced offline gating in AICoachScreen.tsx
   - Now checks StepFun config before falling back

2. **Edge middleware blocking requests**
   - Fixed: Removed Bearer token requirement in proxy.ts
   - Backend now validates API key directly

3. **Natural language not parsing dates**
   - Verified: datePatterns.ts supports today, tomorrow, specific dates, relative times
   - Test with browser console to confirm

4. **Tasks not appearing in calendar**
   - Verify: Tasks are saved with scheduledDate in YYYY-MM-DD format
   - Check: Timeline view filters by scheduledDate correctly

---

## Next Steps

1. Test all cases above
2. Take screenshots of working features
3. Record demo video showing:
   - Settings configuration
   - Natural language task creation
   - Timeline view with scheduled tasks
   - Offline mode fallback
4. Fix any issues found
5. Prepare demo environment
