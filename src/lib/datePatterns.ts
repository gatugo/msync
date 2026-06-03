/**
 * Shared utility for robust natural language date/time parsing.
 * Used by AICoachModal, AddTaskPanel, and TimelineView.
 */

export interface ParsedDateTime {
    date?: string; // YYYY-MM-DD
    time?: string; // HH:MM
    duration?: number; // In minutes, detected from "15mins" etc
    remainingText?: string; // The text content left after parsing (Title)
}

export const parseNaturalDateTime = (input: string): ParsedDateTime => {
    let clean = input.trim();
    const now = new Date();
    let targetDate = new Date(now);
    let targetTime: string | undefined;
    let detectedDuration: number | undefined;
    let dateDetected = false;

    // Helper to remove text case-insensitively
    const removePattern = (text: string, pattern: string | RegExp) => {
        if (typeof pattern === 'string') {
            return text.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
        }
        return text.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
    };

    // 1. Detect Duration FIRST
    // specific "for X ..." pattern to avoid "Task 2" matches
    const durationMatch = clean.match(/for\s+(\d+)\s*(mins?|minutes?|hrs?|hours?)/i) || clean.match(/(\d+)\s*(mins?|minutes?|hrs?|hours?)/i);
    
    if (durationMatch) {
        const val = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        if (unit.startsWith('h')) {
            detectedDuration = val * 60;
        } else {
            detectedDuration = val;
        }
        clean = removePattern(clean, durationMatch[0]);
    }

    // 2. Extract Date
    // a) M-D-YY or M-D-YYYY
    const numericDateMatch = clean.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    // b) MMM D
    const months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
    const namedDateRegex = new RegExp(`(?:${months})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i');
    const namedDateMatch = clean.match(namedDateRegex);

    if (numericDateMatch) {
        const m = parseInt(numericDateMatch[1]) - 1;
        const d = parseInt(numericDateMatch[2]);
        let y = parseInt(numericDateMatch[3]);
        if (y < 100) y += 2000;
        targetDate = new Date(y, m, d);
        clean = removePattern(clean, numericDateMatch[0]);
        dateDetected = true;
    } else if (namedDateMatch) {
        const day = parseInt(namedDateMatch[1]);
        const monthStr = namedDateMatch[0].toLowerCase().match(new RegExp(`(${months})`))![0];
        const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthStr.substring(0, 3));
        targetDate.setMonth(monthIndex);
        targetDate.setDate(day);

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        if (targetDate < oneMonthAgo) {
            targetDate.setFullYear(targetDate.getFullYear() + 1);
        }
        clean = removePattern(clean, namedDateMatch[0]);
        dateDetected = true;
    } else if (clean.match(/\btomorrow\b/i)) {
        targetDate.setDate(targetDate.getDate() + 1);
        clean = removePattern(clean, /\btomorrow\b/i);
        dateDetected = true;
    } else if (clean.match(/\btoday\b/i)) {
        // Just remove 'today', date is already now
        clean = removePattern(clean, /\btoday\b/i);
        dateDetected = true;
    } else if (clean.match(/\bnext\s+week\b/i)) {
        targetDate.setDate(targetDate.getDate() + 7);
        clean = removePattern(clean, /\bnext\s+week\b/i);
        dateDetected = true;
    } else {
         const dayMatch = clean.match(/(?:this\s+|next\s+|on\s+)?\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
         if (dayMatch) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDayName = dayMatch[1].toLowerCase();
            const targetDayIndex = dayNames.indexOf(targetDayName);
            const currentDayIndex = targetDate.getDay();
            let daysToAdd = targetDayIndex - currentDayIndex;
            if (daysToAdd <= 0) daysToAdd += 7;
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            clean = removePattern(clean, dayMatch[0]);
            dateDetected = true;
         }
    }

    // 3. Extract Time
    // Patterns:
    // 1. HH:MM am/pm (old)
    // 2. HHMMam/pm (compact 4 digit) -> 1030am
    // 3. HMMam/pm (compact 3 digit) -> 130p
    // 4. Ham/pm (compact 1-2 digit) -> 5p, 11a
    
    // Combined Regex: 
    // Group 1: HH (standard)
    // Group 2: MM (standard)
    // Group 3: am/pm (standard)
    // Group 4: HHMM (compact)
    // Group 5: am/pm/a/p (compact)
    // Group 6: HH (compact short)
    // Group 7: am/pm/a/p (compact short)
    
    // We'll iterate multiple reliable patterns instead of one giant one to avoid complexity
    const patterns = [
        /(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i,      // 1:30pm (Standard)
        /(?:at\s+)?(\d{1,2})(\d{2})\s*(am|pm|a|p)/i,              // 130p, 1030am (Compact Time)
        /(?:at\s+)?(\d{1,2})\s*(am|pm|a|p)\b/i,                      // 5p, 11a (Hour Only)
        /(?:at\s+)(\d{1,2})\b(?:\s*o'?clock)?/i         // at 5, at 14
    ];

    let bestTimeMatchString = '';
    let targetTimeStr: string | undefined;

    for (const regex of patterns) {
        const match = clean.match(regex);
        if (match) {
            let h = 0;
            let m = 0;
            let ampm = '';
            
            // Determine structure based on regex index/groups
            if (match[0].includes(':')) {
                // Case 1: Standard 1:30
                h = parseInt(match[1]);
                m = parseInt(match[2]);
                ampm = match[3]?.toLowerCase() || '';
            } else if (match[1] && match[2] && match[3]) {
                 // Case 2: Compact 130p
                 h = parseInt(match[1]);
                 m = parseInt(match[2]);
                 ampm = match[3].toLowerCase();
            } else if (match[1] && match[2]) {
                // Case 3: Hour Only 5p
                h = parseInt(match[1]);
                m = 0;
                ampm = match[2].toLowerCase();
            } else if (match[1]) {
                // Case 4: "at 5"
                h = parseInt(match[1]);
                m = 0;
                ampm = '';
            }

            // Normalize AM/PM shorthand
            if (ampm === 'a') ampm = 'am';
            if (ampm === 'p') ampm = 'pm';

            if (ampm === 'pm' && h < 12) h += 12;
            if (ampm === 'am' && h === 12) h = 0;

            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                 targetTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                 bestTimeMatchString = match[0];
                 break; // Found a valid match, stop
            }
        }
    }

    if (bestTimeMatchString) {
        targetTime = targetTimeStr;
        clean = removePattern(clean, bestTimeMatchString);
    } else {
        // Handle "in X hours"
        const relativeTimeMatch = clean.match(/in\s+(\d+)\s+hours?/i);
        if (relativeTimeMatch) {
             const hours = parseInt(relativeTimeMatch[1]);
             const relDate = new Date();
             relDate.setHours(relDate.getHours() + hours);
             targetTime = `${relDate.getHours().toString().padStart(2, '0')}:${relDate.getMinutes().toString().padStart(2, '0')}`;
             
             if (targetDate.toDateString() === new Date().toDateString()) {
                 if (relDate.getDate() !== new Date().getDate()) {
                     targetDate.setDate(targetDate.getDate() + 1);
                     dateDetected = true;
                 }
             }
             clean = removePattern(clean, relativeTimeMatch[0]);
        }
    }

    // Clean up "at" if left over (e.g. "Break at" -> "Break")
    clean = clean.replace(/\bat\s*$/i, '').trim(); 
    clean = clean.replace(/^\s*at\b/i, '').trim();

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return {
        date: dateDetected ? dateStr : undefined,
        time: targetTime,
        duration: detectedDuration,
        remainingText: clean // Extracted Title
    };
};

export const format12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
};
