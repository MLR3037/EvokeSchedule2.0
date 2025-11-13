# Days of Week Scheduling Feature

## Overview

The Days of Week scheduling feature allows you to manage part-time client schedules by specifying which days of the week each client attends. This is useful for clients who have recurring absences (e.g., a client who only attends Monday, Wednesday, and Friday).

## User Story

**As a scheduler**, I want to specify which days of the week each client attends, so that clients with part-time schedules don't show up as "unassigned" on days they're not scheduled to attend.

## Feature Description

### What's New

- **Days of Week Checkboxes**: When adding or editing a client, you can now check/uncheck which days they attend
- **Default Behavior**: All days are checked by default (Monday-Friday)
- **Schedule Filtering**: Clients only appear in the schedule on their scheduled days
- **Auto-Assignment**: The auto-assignment engine only assigns clients on their scheduled days

### UI Changes

#### Student Form Modal

Added a new "Days of Week Scheduled" section with checkboxes for each weekday:

```
Days of Week Scheduled
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Monday  │ Tuesday  │Wednesday │ Thursday │  Friday  │
│    ☑     │    ☑     │    ☑     │    ☑     │    ☑     │
└──────────┴──────────┴──────────┴──────────┴──────────┘
Uncheck days when the client does not attend (for part-time schedules)
```

**Location**: Between "Date Started" and "Team Members" in the student form

**Default State**: All checkboxes are checked

**Usage**: Uncheck days when a client does not attend (e.g., for a client who only comes Mon/Wed/Fri, uncheck Tuesday and Thursday)

## Technical Implementation

### Data Model Changes

#### Student Class (`src/types/index.js`)

Added 5 new boolean fields:
- `scheduledMonday` (default: `true`)
- `scheduledTuesday` (default: `true`)
- `scheduledWednesday` (default: `true`)
- `scheduledThursday` (default: `true`)
- `scheduledFriday` (default: `true`)

Added new method:
```javascript
isScheduledForDay(date) {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  switch(dayOfWeek) {
    case 1: return this.scheduledMonday;
    case 2: return this.scheduledTuesday;
    case 3: return this.scheduledWednesday;
    case 4: return this.scheduledThursday;
    case 5: return this.scheduledFriday;
    default: return false; // Weekends default to false
  }
}
```

### SharePoint Integration

#### New Columns (Clients List)

| Column Name         | Type    | Default | Description                                 |
|---------------------|---------|---------|---------------------------------------------|
| ScheduledMonday     | Yes/No  | Yes     | Client is scheduled to attend on Mondays    |
| ScheduledTuesday    | Yes/No  | Yes     | Client is scheduled to attend on Tuesdays   |
| ScheduledWednesday  | Yes/No  | Yes     | Client is scheduled to attend on Wednesdays |
| ScheduledThursday   | Yes/No  | Yes     | Client is scheduled to attend on Thursdays  |
| ScheduledFriday     | Yes/No  | Yes     | Client is scheduled to attend on Fridays    |

**Setup Instructions**: See `SHAREPOINT_COLUMN_SETUP.md` sections 4-8

#### SharePointService Updates (`src/services/SharePointService.js`)

**loadStudents()**: Added Days of Week fields to `$select` query
```javascript
$select=Id,Title,Program,RatioAM,RatioPM,IsActive,...,
ScheduledMonday,ScheduledTuesday,ScheduledWednesday,ScheduledThursday,ScheduledFriday
```

**parseStudents()**: Load Days of Week with default-true logic
```javascript
scheduledMonday: item.ScheduledMonday !== false,
scheduledTuesday: item.ScheduledTuesday !== false,
// etc.
```

**saveStudent()**: Save Days of Week fields
```javascript
ScheduledMonday: student.scheduledMonday !== false,
ScheduledTuesday: student.scheduledTuesday !== false,
// etc.
```

### Schedule Logic Updates

#### Manual Assignment Modal (`src/components/SchedulingComponents.js`)

Updated `availableStudents` filter to check day of week:
```javascript
const availableStudents = students
  .filter(s => 
    s.isActive && 
    s.program === program &&
    s.isScheduledForDay(selectedDate) &&  // NEW: Check day of week
    !schedule.getAssignmentsForSession(session, program).some(a => a.studentId === s.id)
  )
```

#### Session Summary (`src/components/SchedulingComponents.js`)

Updated `programStudents` filter to check day of week:
```javascript
const programStudents = students
  .filter(s => 
    s.program === program && 
    s.isActive && 
    s.isScheduledForDay(selectedDate)  // NEW: Check day of week
  )
```

#### Auto-Assignment Engine (`src/services/AutoAssignmentEngine.js`)

Updated both methods to accept `selectedDate` parameter:
- `autoAssignSchedule(schedule, staff, students, selectedDate)`
- `performSwapOptimization(schedule, staff, students, selectedDate)`

Filter active students by day of week:
```javascript
const activeStudents = students.filter(s => 
  s.isActive && 
  s.isScheduledForDay(selectedDate)  // NEW: Check day of week
);
```

### UI Component Updates

#### StudentForm (`src/components/DataManagementComponents.js`)

Added Days of Week checkboxes section:
- Grid layout with 5 columns (one per weekday)
- Each checkbox labeled with day name
- Helper text: "Uncheck days when the client does not attend (for part-time schedules)"
- Checkboxes bound to `formData.scheduledMonday` through `scheduledFriday`

## Use Cases

### Example 1: Part-Time Client (3 Days/Week)

**Scenario**: Joey only attends Monday, Wednesday, and Friday

**Setup**:
1. Open Student Form for Joey
2. Go to "Days of Week Scheduled" section
3. Uncheck **Tuesday** and **Thursday**
4. Leave Monday, Wednesday, Friday checked
5. Save

**Result**:
- Joey only appears in schedule on Mon/Wed/Fri
- Joey does NOT show as "unassigned" on Tue/Thu
- Auto-assignment will not try to assign Joey on Tue/Thu

### Example 2: Full-Time Client

**Scenario**: Mia attends all 5 days

**Setup**:
1. Open Student Form for Mia
2. "Days of Week Scheduled" section shows all days checked (default)
3. No changes needed
4. Save

**Result**:
- Mia appears in schedule Monday through Friday
- Auto-assignment works as normal for all days

### Example 3: Converting to Part-Time

**Scenario**: Client was full-time, now going part-time (Mon/Tue/Wed only)

**Setup**:
1. Open Student Form for the client
2. Go to "Days of Week Scheduled" section
3. Uncheck **Thursday** and **Friday**
4. Save

**Result**:
- Client immediately stops appearing in Thu/Fri schedules
- Existing assignments for Thu/Fri are unaffected (must be manually removed if needed)
- Future schedules for Thu/Fri will not include this client

## Testing Checklist

### Before SharePoint Setup

- [x] Student form shows Days of Week checkboxes
- [x] All checkboxes default to checked
- [x] Checkboxes can be toggled on/off
- [x] Form data includes scheduledMonday-Friday fields
- [x] Student constructor accepts scheduledMonday-Friday parameters

### After SharePoint Setup

#### Data Persistence
- [ ] Create new student with some days unchecked → Save → Refresh → Verify days persist
- [ ] Edit existing student → Change days → Save → Refresh → Verify changes persist
- [ ] Check SharePoint Clients list → Verify ScheduledMonday-Friday columns exist
- [ ] Check SharePoint Clients list → Verify values match what's set in app

#### Schedule Filtering
- [ ] Create part-time student (e.g., Mon/Wed/Fri only)
- [ ] Select Tuesday on date picker
- [ ] Verify part-time student does NOT appear in Available Students list
- [ ] Select Monday on date picker
- [ ] Verify part-time student DOES appear in Available Students list

#### Auto-Assignment
- [ ] Create part-time student (e.g., Mon/Wed/Fri only)
- [ ] Select Tuesday on date picker
- [ ] Run Auto-Assign
- [ ] Verify part-time student is NOT assigned on Tuesday
- [ ] Select Monday on date picker
- [ ] Run Auto-Assign
- [ ] Verify part-time student IS assigned on Monday

#### Session Summary
- [ ] Create part-time student (e.g., Mon/Wed/Fri only)
- [ ] Select Tuesday on date picker
- [ ] Check AM/PM session summaries
- [ ] Verify part-time student does NOT appear in "Unassigned" list
- [ ] Verify part-time student does NOT appear in program student count

#### Edge Cases
- [ ] Student with NO days checked → Should never appear in schedule
- [ ] Student with ALL days checked → Should behave like normal full-time student
- [ ] Change student from full-time to part-time mid-week → Verify schedule updates
- [ ] Weekend dates → Verify students don't appear (all days default false for Sat/Sun)

## Default Behavior

### For Existing Students

**When new columns are added to SharePoint:**
- All existing students will default to `true` for all days (full-time schedule)
- No action needed for existing full-time students
- Only need to edit students who should be part-time

### For New Students

**When creating a new student:**
- All day checkboxes are checked by default
- Uncheck specific days for part-time students
- Leave all checked for full-time students

### Logic

The `!== false` comparison ensures:
- `null` or `undefined` → defaults to `true` (scheduled)
- `false` → explicitly not scheduled
- `true` → explicitly scheduled

This makes the feature backward-compatible with existing data.

## Known Limitations

1. **Weekends**: Currently defaults to false (not scheduled) - no UI to change this
2. **Holidays**: Days of Week doesn't account for holidays - use Absent features for one-time absences
3. **Existing Assignments**: Changing a student's days doesn't remove existing assignments from non-scheduled days
4. **No Validation**: System doesn't prevent you from unchecking all days (though this would be invalid)

## Future Enhancements

Potential improvements:
- Visual indicator in student list showing part-time vs full-time
- Bulk edit tool to set days for multiple students
- Copy days from one student to another
- Weekly schedule template (e.g., "Mon/Wed/Fri" preset)
- Integration with holiday calendar
- Warning when creating schedule on non-scheduled day

## Files Modified

### Core Implementation
- `src/types/index.js` - Student class with Days of Week fields and `isScheduledForDay()` method
- `src/services/SharePointService.js` - Load/save Days of Week fields
- `src/components/DataManagementComponents.js` - StudentForm with Days of Week checkboxes
- `src/components/SchedulingComponents.js` - Schedule filtering by day
- `src/services/AutoAssignmentEngine.js` - Auto-assignment respects days of week
- `src/App.js` - Pass selectedDate to auto-assignment methods

### Documentation
- `SHAREPOINT_COLUMN_SETUP.md` - Updated with ScheduledMonday-Friday columns
- `DAYS_OF_WEEK_FEATURE.md` - This document

## Deployment Steps

1. **Code Deployment**: Deploy updated React app to production
2. **SharePoint Setup**: Add ScheduledMonday-Friday columns to Clients list (see `SHAREPOINT_COLUMN_SETUP.md`)
3. **Verification**: Test with one part-time student first
4. **Rollout**: Update remaining part-time students as needed
5. **Training**: Show schedulers where to find the Days of Week checkboxes

## Support

For issues or questions:
1. Check this document first
2. Review `SHAREPOINT_COLUMN_SETUP.md` for column setup
3. Check browser console for errors
4. Verify SharePoint columns exist and have correct defaults
