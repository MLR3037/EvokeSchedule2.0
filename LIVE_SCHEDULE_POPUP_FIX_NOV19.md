# Live Schedule Popup Window Fix - November 19

## Issues Fixed

### 1. ABSENT Text Not Red in Popup Window
**Problem**: The word "ABSENT" appeared in gray text in the popup window, but showed correctly in red in the main Live View.

**Root Cause**: CSS specificity issue - the `.read-only` class sets `color: #374151` (gray) which was overriding the `.absent-text` red color.

**Fix**: Added `!important` to the color declarations in popup window CSS (lines 350-357):

```css
.absent-text {
  color: #dc2626 !important;  /* Red */
  font-weight: 600;
}
.out-text {
  color: #f59e0b !important;  /* Orange */
  font-weight: 600;
}
```

### 2. Popup Not Updating When Button Clicked Again
**Problem**: When user clicked "Live Schedule" button and the popup was already open, it would just focus the window without updating the data to the current schedule.

**Fix**: Modified `openInNewWindow()` function in `LiveScheduleView.js` (line 206-212) to call `popupWindow.updateScheduleData()` before focusing:

```javascript
// Check if popup already exists and is open
if (popupWindow && !popupWindow.closed) {
  // Update existing popup with current data before focusing
  if (popupWindow.updateScheduleData) {
    popupWindow.updateScheduleData(scheduleData, programFilter, sortBy);
  }
  popupWindow.focus();
  return;
}
```

### 3. Fixed Paired Students Not Showing Staff
**Problem**: Paired students (1:2 ratio) showed times but no staff names in Live View/popup, even though they had staff assigned on Schedule tab.

**Root Cause**: Paired students share staff assignments. The assignment is stored under one student's ID. LiveScheduleView was only checking `assignment.studentId === student.id`, so the paired partner wouldn't see the staff.

**Fix**: Added logic to check paired partner's assignments if student has no direct assignments (lines 52-82):

```javascript
// PAIRED STUDENT FIX: If student is paired and has no assignments, check paired partner
if (amAssignments.length === 0 && student.isPaired && student.isPaired()) {
  const ratio = student.ratioAM;
  if (ratio === '1:2') {
    const pairedStudent = student.getPairedStudent(students);
    if (pairedStudent && pairedStudent.ratioAM === '1:2') {
      const pairedAssignments = schedule.assignments.filter(
        a => a.studentId === pairedStudent.id && a.session === 'AM'
      );
      if (pairedAssignments.length > 0) {
        amAssignments = pairedAssignments;
      }
    }
  }
}
```

### 4. Added Debug Logging
**Purpose**: To track schedule data generation and popup updates.

**Added**: 
- Console log showing paired student assignment lookup: `🔗 PAIRED FIX AM: [name] using [partner]'s assignments`
- Console log showing schedule data generation: `📊 Generated X schedule rows from Y assignments`
- Console log showing popup updates: `📤 Updating popup with X rows`
**Purpose**: To help diagnose why ABSENT text might not be showing in red.

**Added**: Console logging in the `renderTable()` function (line 503-505) that logs when an ABSENT student is being rendered:

```javascript
// Debug logging for ABSENT text
if (row.amStaff === 'ABSENT' || row.pmStaff === 'ABSENT') {
  console.log('Popup rendering ABSENT:', row.studentName, 'AM:', row.amStaff, 'class:', amStaffClass, 'PM:', row.pmStaff, 'class:', pmStaffClass);
}
```

## How to Test

### Important: Open Both Consoles
Before testing, open the browser console (F12) in BOTH:
1. The main schedule window
2. The popup window (click in popup, then F12)

This will show you the debug logs that help diagnose the issue.

### Test 1: Popup Updates on Re-open
1. Open the schedule app
2. Make some assignments
3. Click "Live Schedule" to open popup
4. Go back to main window
5. Change an assignment (swap a staff member)
6. Click "Live Schedule" again
7. **Expected**: 
   - Main console shows: `📤 Updating popup with [N] rows`
   - Popup console shows: `📥 Popup received update: [N] rows`
   - Popup should show the NEW assignment, not the old one

### Test 2: ABSENT Text Shows in Red
1. Open the schedule app
2. Mark a student as ABSENT (both AM and PM)
3. Open "Live Schedule" popup
4. Open browser console in BOTH windows (F12)
5. Look at the popup - find the absent student
6. **Expected**: 
   - Popup console shows: `Popup rendering ABSENT: [StudentName] AM: ABSENT class: absent-text PM: ABSENT class: absent-text`
   - The word "ABSENT" should appear in RED text in the schedule table
   - The entire row should have a gray background

### Test 3: Auto-Update While Popup is Open
1. Open "Live Schedule" popup
2. Keep popup visible
3. In main window, make a change (swap staff, mark absent, etc.)
4. **Expected**: 
   - Main console shows: `📤 Updating popup with [N] rows`
   - Popup console shows: `📥 Popup received update: [N] rows`
   - Popup should update automatically within 1 second
   - If marking someone ABSENT, popup console should show the ABSENT debug log

### What the Console Logs Mean
- `📤 Updating popup with [N] rows` - Main window is sending update
- `📥 Popup received update: [N] rows` - Popup received the update
- `⚠️ Popup window exists but updateScheduleData function not found` - **Problem**: Function didn't initialize
- `❌ Error updating popup:` - **Problem**: Error occurred during update
- `Popup rendering ABSENT:` - Shows which students are being rendered as ABSENT with their CSS classes

## Technical Notes

### CSS Classes in Popup
The popup has these CSS classes defined:
- `.absent-text` → Red text (`color: #dc2626; font-weight: 600;`)
- `.absent-row` → Gray background (`background: #9ca3af;`)
- `.out-text` → Orange text (`color: #f59e0b; font-weight: 600;`)

### How the Styling Works
1. In `renderTable()`, we determine the CSS class:
   ```javascript
   const amStaffClass = row.amStaff === 'ABSENT' ? 'absent-text' : (row.amStaff === 'OUT' ? 'out-text' : '');
   ```

2. We apply it to the table cell:
   ```javascript
   <td class="read-only ${amStaffClass}">${row.amStaff}</td>
   ```

3. This generates HTML like:
   ```html
   <td class="read-only absent-text">ABSENT</td>
   ```

### Potential Issues to Check
If ABSENT is still not red after this fix:
1. Open popup's DevTools (F12 in popup window)
2. Inspect an ABSENT cell
3. Check computed styles - is `.absent-text` class present?
4. Is the CSS rule being overridden by something else?
5. Check console for any JavaScript errors that might prevent rendering

## Files Modified
- `src/components/LiveScheduleView.js`
  - Line 148-161: Enhanced auto-update useEffect with debug logging (main window)
  - Line 204-210: Added data update before focusing existing popup
  - Line 397: Added debug logging to popup's updateScheduleData function
  - Line 507-509: Added debug logging for ABSENT rendering in popup

## Next Steps If Issue Persists
If ABSENT text is still not red:
1. Check the browser console in the popup for the debug log
2. Inspect the HTML element in popup's DevTools
3. Verify the CSS class is actually being applied
4. Check if there are any CSS conflicts or overrides
5. Consider increasing CSS specificity: `.read-only.absent-text { color: #dc2626 !important; }`

## Can Remove Debug Logging Later
Once the issue is confirmed fixed, you can remove the debug logging (lines 503-505) to clean up the console.
