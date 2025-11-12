# Temporary Staff AM/PM Session Feature

## Overview
Enhanced the temporary staff functionality to support session-specific (AM/PM) assignments. Users can now add temporary staff to a client's program for just the AM session, just the PM session, or both sessions.

## Changes Made

### 1. Data Structure Update
**File:** `src/components/SchedulingComponents.js`

**Before:**
```javascript
tempTeamAdditions = {
  studentId: [staffId1, staffId2, ...]
}
```

**After:**
```javascript
tempTeamAdditions = {
  studentId: [
    { staffId: 1, sessions: ['AM'] },
    { staffId: 2, sessions: ['PM'] },
    { staffId: 3, sessions: ['AM', 'PM'] }
  ]
}
```

### 2. Quick Add Modal UI Enhancement
Added three buttons for session selection when adding temporary staff:
- **AM Only** - Orange button: Staff available only for AM session
- **PM Only** - Purple button: Staff available only for PM session
- **Both** - Blue button: Staff available for both AM and PM sessions

When a staff member is added, the modal shows which sessions they're assigned to with colored badges.

### 3. Staff Dropdown Filtering
The staff dropdown for each session now filters temp staff based on their assigned sessions:
- Temp staff assigned to AM only will **only** appear in AM dropdowns
- Temp staff assigned to PM only will **only** appear in PM dropdowns
- Temp staff assigned to Both will appear in **both** AM and PM dropdowns

### 3. Direct Staff Count in Summary
The session summary boxes at the top now include temp staff in the "Direct Staff (RBT/BS)" count:
- Only counts temp staff who are RBT or BS roles (direct service providers)
- Only counts temp staff assigned to that specific session
- **Automatically subtracts staff borrowed by other programs** - if a Primary staff is temp-added to Secondary, they're removed from Primary's count
- Shows breakdown: e.g., "26 (2 absent, 1 out, +3 temp, -1 borrowed)"

### 5. Full Team Display
In the "Full Team" column, temporary staff members now display:
- Yellow background with clock icon (⏰)
- Session badges showing AM and/or PM availability
- Remove button (×) to remove the temporary assignment

Example display:
```
⏰ John Smith [AM] [PM] ×
⏰ Jane Doe [AM] ×
```

### 6. localStorage Persistence
The new data structure automatically persists to localStorage and is restored when:
- Navigating between tabs
- Refreshing the page (same day)
- Returning to the schedule page

Temporary assignments are automatically cleaned up:
- When the date changes
- After 7 days (old entries are purged)
- When explicitly cleared by the user

## User Workflow

### Adding Temporary Staff with Session Selection

1. Navigate to the **Schedule** tab
2. Find the client you want to add temporary staff to
3. Click **"Quick Add Staff (Today Only)"** button in the "Full Team" column
4. In the modal, find the staff member you want to add
5. Click one of three buttons:
   - **AM Only** - Staff only available in the morning
   - **PM Only** - Staff only available in the afternoon
   - **Both** - Staff available all day
6. The staff member is now added and shows in the appropriate session dropdowns
7. Click **"Done"** to close the modal

### Visual Indicators

**In the Full Team Column:**
- Temp staff show with yellow background and clock icon
- Session badges show which sessions they're available for
  - Orange [AM] badge = Available in morning
  - Purple [PM] badge = Available in afternoon

**In Session Summary Boxes:**
- Direct Staff count includes temp staff added to this program
- Subtracts temp staff borrowed by other programs
- Shows breakdown: "(+3 temp, -1 borrowed)" indicating net change

**In Staff Dropdowns:**
- Temp staff only appear in dropdowns for their assigned sessions
- AM-only temp staff won't appear in PM dropdowns (and vice versa)

### Removing Temporary Staff

Click the **×** button next to any temporary staff member in the "Full Team" column to remove them completely (from all sessions).

## Technical Details

### Functions Modified

1. **`handleQuickAddStaff(studentId, staffId, sessions)`**
   - Now accepts `sessions` array parameter: `['AM']`, `['PM']`, or `['AM', 'PM']`
   - Updates or adds temp staff with session information

2. **`getStudentTeam(student)`**
   - Returns temp staff with `tempSessions` property
   - Used by dropdown rendering and team display

3. **`renderStaffDropdown(student, session)`**
   - Filters temp staff by session availability
   - Only shows temp staff assigned to the current session

4. **`SessionSummary` component**
   - Counts temp direct staff (RBT/BS only) per session
   - Adds temp count to total direct staff display

### Data Flow

```
User clicks "AM Only" button
    ↓
handleQuickAddStaff(studentId, staffId, ['AM'])
    ↓
Updates tempTeamAdditions state
    ↓
Saves to localStorage
    ↓
getStudentTeam returns team with temp staff
    ↓
renderStaffDropdown filters for session
    ↓
Staff appears ONLY in AM dropdown
    ↓
SessionSummary counts temp staff for AM
    ↓
Direct Staff count increases for AM session
```

## Benefits

1. **More Flexibility**: Add temporary staff for just one session when needed
2. **Accurate Counts**: Direct staff summary reflects actual available staff per session
3. **Clear Communication**: Visual indicators show exactly when temp staff are available
4. **Prevents Errors**: System prevents assigning temp staff to wrong sessions
5. **Session-Specific Staffing**: Address AM or PM shortages independently

## Example Use Cases

### Use Case 1: Morning Coverage Only
**Scenario:** Regular staff member calls in sick for AM only, returning for PM.

**Solution:** Add temp staff with "AM Only" option. Temp staff:
- Appears in AM dropdowns for all their assigned clients
- Does NOT appear in PM dropdowns
- Counted in AM direct staff total only

### Use Case 2: Afternoon Float Staff
**Scenario:** Float staff joins the program only for afternoon sessions.

**Solution:** Add float staff with "PM Only" option. Float staff:
- Only available in PM session dropdowns
- Not shown in AM assignments
- Counted in PM direct staff count

### Use Case 3: Full Day Substitute
**Scenario:** Substitute staff covering full day for absent team member.

**Solution:** Add substitute with "Both" option. Substitute:
- Appears in both AM and PM dropdowns
- Available for assignment in any session
- Counted in both AM and PM direct staff totals

## Limitations

1. Temporary staff assignments are **not saved to SharePoint** - they only persist in localStorage for the day
2. Temp staff are cleared when:
   - Date changes
   - Page is refreshed after clearing cache
   - User manually clears all temp assignments
3. Cannot edit session assignment after adding - must remove and re-add
4. Temp staff cannot be assigned training status (they're always considered "solo" certified for temp purposes)

## Future Enhancements

Potential improvements for future versions:
- Edit session availability after adding temp staff
- Save temp staff to SharePoint for permanent tracking
- Set specific time ranges (not just AM/PM)
- Add notes/reason for temporary assignment
- Report on temporary staff usage patterns

---

**Date Implemented:** November 12, 2025  
**Files Modified:** `src/components/SchedulingComponents.js`  
**Feature Status:** ✅ Complete and Ready for Testing
