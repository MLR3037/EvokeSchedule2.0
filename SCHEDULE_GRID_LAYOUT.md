# Schedule Grid Layout Enhancement

## Summary
Restructured the scheduling interface to use the Live View grid layout for better usability and visual clarity. Added a new "Teams Grid" tab for viewing team assignments.

## Changes Made

### 1. New Components Created

#### **TeamsGridView.js** (New File)
- Displays all clients with their assigned team members in a grid format
- Features:
  - Filter by program (All/Primary/Secondary)
  - Sort by name or program
  - Shows team members with training status badges (⭐ Trainer, 🎓 In Training)
  - Can open in new window for display/sharing
  - Read-only view of permanent team assignments

#### **ScheduleGridView.js** (New File)
- Interactive scheduling grid combining Live View layout with dropdown assignment functionality
- Features:
  - Each client shows in a single row with AM and PM columns
  - **AM Staff** and **PM Staff** dropdowns for main staff assignment
  - **AM Trainee** and **PM Trainee** dropdowns for optional second staff
  - Lock/unlock icons for each assignment
  - Manual entry for start/end times and lunch coverage
  - ABSENT/OUT indicators for unavailable students
  - Filter by program and sort options
  - Can open in new window for static display

### 2. App.js Updates

#### Added Imports
```javascript
import TeamsGridView from './components/TeamsGridView.js';
import ScheduleGridView from './components/ScheduleGridView.js';
```

#### Added New Tab
- **"Teams Grid"** tab (between Schedule and Live View)
  - Shows permanent team assignments for all clients
  - Useful for reference and sharing team information

#### Updated Schedule Tab
- Replaced `ScheduleTableView` with `ScheduleGridView`
- Kept the SessionSummary cards at the top
- Schedule portion now uses Live View-style grid layout
- Each client is on a single row instead of grouped by program

## User Experience Improvements

### Before
- Schedule tab had program-grouped sections with complex multi-row layout
- Separate Live View tab for read-only pretty display
- Teams tab for editing team assignments

### After
- **Schedule tab**: Grid layout with interactive dropdowns, one row per client
  - AM Staff / AM Trainee dropdowns
  - PM Staff / PM Trainee dropdowns
  - Manual lunch coverage and time entry
  - Lock/unlock icons per assignment
  
- **Teams Grid tab**: Read-only grid showing all team assignments
  - Quick reference for who's on each client's team
  - Shows training status
  - Can open in new window for sharing

- **Live View tab**: Unchanged, still available for pretty printing

## Technical Details

### Staff Assignment Workflow
1. User selects staff from dropdown (filtered to team members + available staff)
2. Creates unlocked assignment via `onManualAssignment`
3. User clicks lock icon to protect assignment from "Clear Unlocked"
4. Trainee dropdown creates a second assignment for the same client/session

### Dropdown Population
- Team members appear first (alphabetically)
- Then other available staff for that session
- Only shows staff available for the specific session (AM/PM)

### Data Persistence
- Lunch coverage and times stored in component state (editableData)
- Assignments saved to schedule via existing App.js handlers
- Lock status synced with schedule.lockedAssignments

## Files Modified
1. **src/App.js** - Added new tabs and replaced ScheduleTableView with ScheduleGridView
2. **src/components/TeamsGridView.js** - New component
3. **src/components/ScheduleGridView.js** - New component

## Testing Checklist
- [ ] Schedule tab shows grid layout with dropdowns
- [ ] Staff dropdowns populate with team members and available staff
- [ ] AM/PM Staff dropdowns create assignments correctly
- [ ] Trainee dropdowns add second staff to client/session
- [ ] Lock/unlock icons toggle assignment lock status
- [ ] Lunch and time fields are editable
- [ ] ABSENT/OUT indicators show for unavailable students
- [ ] Filter and sort work correctly
- [ ] "Open in New Window" displays static HTML popup
- [ ] Teams Grid tab shows all team assignments
- [ ] Teams Grid popup works correctly

## Migration Notes
- The old `ScheduleTableView` component is still in `SchedulingComponents.js` but is no longer used
- It can be removed in a future cleanup if this new layout is preferred
- All existing schedule data and functionality is preserved
- No database/SharePoint schema changes required
