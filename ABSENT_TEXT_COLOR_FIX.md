# ABSENT Text Color Fix - Popup Window

## Problem
The word "ABSENT" displayed in **gray text** in the popup window, but showed correctly in **red text** in the main Live View.

## Root Cause
CSS specificity conflict:
- The `.read-only` class sets `color: #374151` (gray)
- The `.absent-text` class sets `color: #dc2626` (red)
- Because both classes are applied (`class="read-only absent-text"`), the gray color was winning

## Solution
Added `!important` flag to force the text color:

```css
.absent-text {
  color: #dc2626 !important;  /* Bright red */
  font-weight: 600;
}

.out-text {
  color: #f59e0b !important;  /* Orange */
  font-weight: 600;
}
```

## File Modified
- `src/components/LiveScheduleView.js` (lines 350 & 354)

## Result
✅ "ABSENT" now displays in **bright red** in the popup window
✅ "OUT" displays in **orange** in the popup window
✅ Main Live View continues to work correctly (uses Tailwind classes)

## Why Main View Works Without !important
The main app view uses inline Tailwind classes:
```javascript
className={`${
  row.amStaff === 'ABSENT' ? 'text-red-600 font-semibold' : 
  row.amStaff === 'OUT' ? 'text-orange-600 font-semibold' : 
  'text-gray-900'
}`}
```

These conditional classes don't conflict because only ONE is applied at a time.

## Testing
1. Open Live Schedule popup
2. Find a student marked ABSENT
3. Verify the word "ABSENT" appears in **bright red** (#dc2626)
4. Find a student marked OUT
5. Verify the word "OUT" appears in **orange** (#f59e0b)
