# Attendance Management Feature - October 17, 2025

## Overview
Implemented comprehensive attendance tracking system for both staff and clients, allowing marking absences for AM, PM, or full day sessions.

## Implementation Summary

### 1. Data Model Updates (`src/types/index.js`)

#### Staff Class
**New Fields:**
- `absentAM` - Boolean, marks staff absent for AM session
- `absentPM` - Boolean, marks staff absent for PM session
- `absentFullDay` - Boolean, marks staff absent for both sessions

**New Methods:**
```javascript
isAvailableForSession(session) // Returns true if staff is available for the session
getAttendanceStatus() // Returns 'Present', 'Absent AM', 'Absent PM', or 'Absent Full Day'
```

#### Student Class
**New Fields:**
- `absentAM` - Boolean, marks client absent for AM session
- `absentPM` - Boolean, marks client absent for PM session
- `absentFullDay` - Boolean, marks client absent for both sessions

**New Methods:**
```javascript
isAvailableForSession(session) // Returns true if student is available for the session
getAttendanceStatus() // Returns attendance status string
```

**Logic:**
- If `absentFullDay` is true, both `absentAM` and `absentPM` are automatically true
- This ensures consistency and prevents conflicting states

### 2. Attendance Management Component (`src/components/AttendanceManagement.js`)

**Features:**
- Toggle between Staff and Clients views
- Search functionality to filter lists
- Real-time attendance summary statistics
- Three checkboxes per person:
  - Absent AM
  - Absent PM
  - Absent Full Day (checking this disables and checks both AM/PM)
- Visual status badges showing attendance status
- Color-coded interface:
  - Green = Present
  - Orange = Partially absent (AM or PM)
  - Red = Absent full day

**UI Sections:**
1. **Summary Stats Dashboard** - Shows total staff/clients and absences
2. **View Toggle** - Switch between staff and client lists
3. **Search Bar** - Filter by name
4. **Person Cards** - Individual attendance controls with visual feedback
5. **Help Section** - Explains attendance functionality

### 3. Auto-Assignment Engine Updates (`src/services/AutoAssignmentEngine.js`)

**Modified Functions:**

1. **`countUnassignedStudents()`**
   - Now skips students absent for each session
   - Only counts students who need assignment

2. **`findReplacementStaff()`**
   - Checks `s.isAvailableForSession(session)` for staff availability
   - Excludes absent staff from consideration

3. **`performFullScheduleReshuffle()`**
   - Filters students by session availability before attempting assignment
   - Won't try to assign absent students

4. **`autoAssignSchedule()`**
   - Logs attendance statistics at start
   - Filters students by `isAvailableForSession()` before assignment
   - Shows counts of absent staff/students for transparency

**Impact:**
- Absent staff will NOT be assigned to any students
- Absent clients will NOT be assigned staff
- Auto-scheduling respects attendance automatically
- No manual intervention needed during scheduling

### 4. To Be Completed

#### SessionSummary Display Update (Task #4)
Need to modify `SchedulingComponents.js` to show absent people in AM/PM summaries:
- Add "Absent" section listing absent staff and clients
- Show who's missing for each session
- Visual indicators for absences

#### SharePoint Integration (Task #5)
Need to update `SharePointService.js`:
- Add attendance fields to `saveStaff()` and `saveStudent()`
- Load attendance data from SharePoint
- Map to Yes/No columns or Choice fields
- Persist attendance between sessions

#### App Integration (Task #6)
Need to add Attendance tab to main navigation:
- Import AttendanceManagement component
- Add to tab navigation
- Wire up update handlers for staff and students
- Ensure changes persist

## Usage Workflow

### Marking Attendance:
1. Navigate to **Attendance** tab
2. Switch between **Staff** or **Clients** view
3. Check appropriate boxes:
   - **Absent AM** - Person won't be available morning session
   - **Absent PM** - Person won't be available afternoon session  
   - **Absent Full Day** - Person won't be available all day
4. Changes save immediately (once integrated)

### Impact on Scheduling:
1. Run **Auto-Assign** from Schedule tab
2. Engine automatically:
   - Skips absent staff when assigning
   - Doesn't assign staff to absent clients
   - Logs attendance info in console
3. Schedule reflects only present people

### Viewing Absences:
- **Attendance Tab** - Full list with status badges
- **AM/PM Summary** - Lists absent people (after Task #4)
- **Schedule Grid** - Absent people won't appear in assignments

## Technical Notes

### Attendance State Logic:
```javascript
// When marking Full Day absent:
absentFullDay = true
absentAM = true  // Automatically set
absentPM = true  // Automatically set

// When unmarking AM while PM still absent:
absentAM = false
absentFullDay = false  // Automatically cleared
absentPM = true  // Remains true
```

### Filtering Pattern:
```javascript
// Example: Get available staff for AM session
const availableStaff = staff.filter(s => 
  s.isActive && 
  s.isAvailableForSession('AM')
);
```

### Performance:
- Attendance checks are O(1) boolean lookups
- No performance impact on scheduling algorithm
- Filtering happens once per session

## SharePoint Schema Requirements

### Staff List - New Columns Needed:
- `AbsentAM` - Yes/No
- `AbsentPM` - Yes/No  
- `AbsentFullDay` - Yes/No

### Clients List - New Columns Needed:
- `AbsentAM` - Yes/No
- `AbsentPM` - Yes/No
- `AbsentFullDay` - Yes/No

## Testing Checklist

### Unit Testing:
- [x] Staff.isAvailableForSession() returns correct values
- [x] Student.isAvailableForSession() returns correct values
- [x] getAttendanceStatus() returns correct strings
- [x] absentFullDay cascades to AM and PM
- [ ] Auto-assignment skips absent people

### Integration Testing:
- [ ] Attendance tab loads correctly
- [ ] Marking staff absent excludes them from auto-assign
- [ ] Marking client absent prevents assignment
- [ ] Attendance persists to SharePoint
- [ ] Attendance loads from SharePoint
- [ ] Session summaries show absent people

### UI Testing:
- [ ] Full Day checkbox disables and checks AM/PM
- [ ] Unchecking AM/PM clears Full Day if both unchecked
- [ ] Search filters correctly
- [ ] View toggle works
- [ ] Status badges display correctly
- [ ] Statistics update in real-time

## Files Created/Modified

### Created:
- `src/components/AttendanceManagement.js` - Main attendance UI component

### Modified:
- `src/types/index.js` - Added attendance fields and methods to Staff and Student classes
- `src/services/AutoAssignmentEngine.js` - Updated to respect attendance status

### To Be Modified:
- `src/components/SchedulingComponents.js` - Add absence display to session summaries
- `src/services/SharePointService.js` - Add attendance field persistence
- `src/App.js` - Integrate Attendance tab and update handlers

## Next Steps

1. **Update SessionSummary component** to show absent staff/clients
2. **Add SharePoint integration** for attendance fields
3. **Wire up Attendance tab** in main App navigation
4. **Test end-to-end** with real data
5. **Create SharePoint columns** for attendance tracking
6. **Deploy and verify** attendance persists correctly

## Benefits

✅ **For Schedulers:**
- Quick visual attendance tracking
- One-click absence marking
- Automatic schedule adjustment

✅ **For Staff:**
- Clear communication of availability
- No double-booking when absent
- Transparent absence tracking

✅ **For System:**
- Prevents invalid assignments
- Reduces manual corrections
- Maintains schedule integrity
- Better resource allocation

