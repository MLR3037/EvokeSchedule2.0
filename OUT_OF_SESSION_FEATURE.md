# Out of Session Feature

## Overview
This feature allows staff to be marked as "Out of Session" (for meetings, trainings, etc.) without marking them as absent. Staff marked as out of session are automatically removed from the schedule and excluded from auto-assignment, similar to absent staff, but with distinct visual indicators.

## Key Difference from Absent
- **Absent**: Staff is physically not present at the location (call-out, sick, vacation)
- **Out of Session**: Staff is at the location but unavailable for client sessions (meetings, internal trainings, administrative work)

## Implementation Details

### Data Model Changes

#### Staff Class (`src/types/index.js`)
Added three new properties to the Staff class:
```javascript
outOfSessionAM: false       // Out of session for AM (meetings, etc.)
outOfSessionPM: false       // Out of session for PM (meetings, etc.)
outOfSessionFullDay: false  // Out of session for full day (meetings, etc.)
```

**Logic:**
- If `outOfSessionFullDay` is true, both AM and PM are automatically marked as out
- Same cascading behavior as absent status

#### Updated Methods

**`isAvailableForSession(session)`**
Now checks both absent AND out-of-session status:
```javascript
if (this.absentFullDay || this.outOfSessionFullDay) return false;
if (session === 'AM') return !this.absentAM && !this.outOfSessionAM;
if (session === 'PM') return !this.absentPM && !this.outOfSessionPM;
```

**`getAttendanceStatus()`**
Returns status strings in priority order:
1. Absent statuses (checked first)
2. Out of session statuses (checked second)
3. Present (default)

Possible return values:
- `'Absent Full Day'`
- `'Absent AM'`
- `'Absent PM'`
- `'Out Full Day'`
- `'Out AM'`
- `'Out PM'`
- `'Present'`

### UI Changes

#### Attendance Management Component (`src/components/AttendanceManagement.js`)

**New Checkbox Section:**
Each staff member now has two sections:
1. **Absent Section** (top):
   - Absent AM (orange)
   - Absent PM (purple)
   - Full Day (red)

2. **Out of Session Section** (bottom, separated by border):
   - Out AM (blue)
   - Out PM (indigo)
   - Out Full Day (cyan)

**Label:** "Out of Session (Meetings, etc.)"

**Checkbox Behavior:**
- Out of Session checkboxes are disabled if staff is marked absent (can't be both)
- Full Day checkbox disables AM/PM checkboxes in the same section
- Distinct colors for visual differentiation

**Status Badges:**
New badge styles for out of session:
- **Out Full Day**: Cyan badge
- **Out AM**: Blue badge  
- **Out PM**: Indigo badge

**Handler Updates:**
`handleStaffAttendanceChange()` now manages 6 fields total:
- `absentAM`, `absentPM`, `absentFullDay`
- `outOfSessionAM`, `outOfSessionPM`, `outOfSessionFullDay`

### Auto-Assignment Integration

#### AutoAssignmentEngine
The existing `isAvailableForSession()` method automatically handles out-of-session status because it's built into the Staff class. No additional changes needed in the auto-assignment engine.

**Workflow:**
1. Staff marked "Out AM"
2. `staff.isAvailableForSession('AM')` returns `false`
3. Auto-assignment engine skips this staff for AM sessions
4. Staff remains available for PM sessions

### Schedule Cleanup

#### App.js Updates
`handleUpdateStaffAttendance()` enhanced to auto-cleanup for out-of-session:

**Before:**
```javascript
if (attendanceData.absentAM || attendanceData.absentPM || attendanceData.absentFullDay) {
  // Remove from schedule
}
```

**After:**
```javascript
const isUnavailableAM = attendanceData.absentAM || attendanceData.absentFullDay || 
                        attendanceData.outOfSessionAM || attendanceData.outOfSessionFullDay;
const isUnavailablePM = attendanceData.absentPM || attendanceData.absentFullDay || 
                        attendanceData.outOfSessionPM || attendanceData.outOfSessionFullDay;

if (isUnavailableAM || isUnavailablePM) {
  // Remove from schedule and free up for reassignment
}
```

**Result:**
- Staff marked "Out AM" are immediately removed from all AM assignments
- Staff marked "Out Full Day" are removed from both AM and PM
- Other staff become available for auto-assignment to fill the gaps

### SharePoint Integration

#### SharePointService Updates

**New SharePoint Columns Required:**
```
OutOfSessionAM - Yes/No column
OutOfSessionPM - Yes/No column  
OutOfSessionFullDay - Yes/No column
```

**Updated API Calls:**

**Get Staff ($select):**
```javascript
$select=Id,StaffPerson/Id,StaffPerson/Title,StaffPerson/EMail,Role,
        PrimaryProgram,SecondaryProgram,IsActive,
        AbsentAM,AbsentPM,AbsentFullDay,
        OutOfSessionAM,OutOfSessionPM,OutOfSessionFullDay
```

**Save Staff (body):**
```javascript
{
  AbsentAM: staff.absentAM || false,
  AbsentPM: staff.absentPM || false,
  AbsentFullDay: staff.absentFullDay || false,
  OutOfSessionAM: staff.outOfSessionAM || false,
  OutOfSessionPM: staff.outOfSessionPM || false,
  OutOfSessionFullDay: staff.outOfSessionFullDay || false
}
```

**Parse Response:**
```javascript
outOfSessionAM: item.OutOfSessionAM === true,
outOfSessionPM: item.OutOfSessionPM === true,
outOfSessionFullDay: item.OutOfSessionFullDay === true
```

## Usage Workflow

### Marking Staff as Out of Session

1. **Navigate to Attendance Tab**
2. **Find Staff Member** in the staff list
3. **Check Out of Session Checkbox:**
   - "Out AM" - Staff in meetings during AM session
   - "Out PM" - Staff in meetings during PM session
   - "Out Full Day" - Staff in all-day meeting/training

4. **Automatic Actions:**
   - Staff is immediately removed from schedule for checked sessions
   - Status badge updates to show "Out AM", "Out PM", or "Out Full Day"
   - Auto-assignment engine excludes staff from future assignments
   - Changes saved to SharePoint

### Visual Indicators

**Status Badge Colors:**
- 🟢 Green = Present
- 🔴 Red = Absent Full Day
- 🟠 Orange = Absent AM/PM
- 🔵 Blue/Indigo/Cyan = Out of Session AM/PM/Full Day

**Checkbox Colors:**
- Orange/Purple/Red = Absent checkboxes
- Blue/Indigo/Cyan = Out of Session checkboxes

### Difference in Practice

**Scenario 1: Staff Call-Out (Sick)**
```
Action: Check "Absent Full Day"
Result: Staff removed from schedule, marked absent in attendance records
```

**Scenario 2: Staff in Quarterly Team Meeting**
```
Action: Check "Out Full Day"
Result: Staff removed from schedule but not marked absent
Benefit: Attendance tracking shows they were present but unavailable for sessions
```

**Scenario 3: Staff in Morning Supervision**
```
Action: Check "Out AM"
Result: Removed from AM sessions only, still available for PM
```

## Benefits

1. **Accurate Attendance Tracking**
   - Distinguish between absent (not at work) vs out of session (at work but busy)
   - Better reporting and analytics

2. **Automated Schedule Management**
   - Same automatic cleanup as absent feature
   - Staff removed from sessions when marked out
   - No manual intervention needed

3. **Flexible Availability**
   - Can mark partial day (AM or PM only)
   - Staff marked "Out AM" still available for PM assignments

4. **Visual Clarity**
   - Distinct colors and labels differentiate from absent
   - Clear indication of why staff is unavailable

## Technical Notes

### State Management
All out-of-session state is managed identically to absent state:
- Local React state updated immediately for responsive UI
- Background save to SharePoint
- Auto-cleanup triggers schedule re-render
- No page reload required

### Validation
- Cannot be both absent AND out of session for same time period
- Out of session checkboxes disabled when absent is checked
- Full day checkbox automatically checks AM and PM

### Performance
- No performance impact - uses existing attendance update pipeline
- Same efficient state management as absent feature
- Minimal additional API overhead (3 boolean fields)

## Future Enhancements

Potential improvements:
1. **Reason Tracking**: Add dropdown for meeting type (supervision, training, admin)
2. **Calendar Integration**: Sync with Outlook calendar for automatic out-of-session marking
3. **Reporting**: Generate reports on staff availability patterns
4. **Scheduling**: Advanced view showing who's in meetings vs client sessions

## Related Features
- **Attendance Auto-Cleanup** (`ATTENDANCE_AUTO_CLEANUP.md`)
- **Staff Availability Tracking** (built into Staff class)
- **Auto-Assignment Engine** (respects availability)
