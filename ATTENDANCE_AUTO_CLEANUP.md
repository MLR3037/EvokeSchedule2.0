# Attendance Auto-Cleanup Feature

## Overview
When attendance is updated in the Attendance Management tab, the system automatically removes affected assignments from the schedule and frees up staff for reassignment.

## Functionality

### Staff Call-Outs
When a staff member is marked absent:
1. **Immediate Removal**: All assignments for that staff member in the affected session(s) are automatically removed
2. **Availability**: The staff is immediately marked as unavailable in those sessions
3. **Both Roles**: Removes assignments where the staff was assigned as:
   - Regular staff (main assignments)
   - Trainee (trainee assignments)

### Student Absences
When a student is marked absent:
1. **Assignment Removal**: All assignments for that student in the affected session(s) are removed
2. **Staff Liberation**: Staff previously assigned to that student become available for reassignment
3. **Paired Students**: If the student is in a 1:2 ratio pair, their partner's assignments remain intact

## Affected Sessions

### Full Day Absence
- Removes assignments from **both AM and PM** sessions
- Applies to both staff and students

### Partial Absence
- **Absent AM**: Removes only AM session assignments
- **Absent PM**: Removes only PM session assignments

## User Workflow

### Scenario 1: Staff Calls Out
1. Navigate to **Attendance** tab
2. Check the appropriate absence box for the staff member (Absent AM, Absent PM, or Full Day)
3. System automatically:
   - Removes staff from all assignments in affected sessions
   - Marks staff as unavailable
   - Logs the changes to console
4. Students who lost their assigned staff are now unassigned
5. Use **Auto-Schedule** to reassign affected students with available staff

### Scenario 2: Student Calls Out
1. Navigate to **Attendance** tab
2. Check the appropriate absence box for the student (Absent AM, Absent PM, or Full Day)
3. System automatically:
   - Removes student from schedule
   - Frees up their assigned staff
   - Marks student as absent
   - Logs the changes to console
4. Previously assigned staff are now available for other students
5. Use **Auto-Schedule** to utilize now-available staff

### Scenario 3: Marking Present Again
When you uncheck an absence box:
- Attendance status is updated
- The person/student **does not** automatically get reassigned
- They are now available in the dropdown for manual assignment
- Or use Auto-Schedule to assign them automatically

## Console Logging

The system provides detailed console logs for tracking:

```
🗑️ Staff John Doe marked absent - removing from schedule...
  ✅ Removed 2 assignment(s) for John Doe
✅ Staff attendance updated: John Doe {absentAM: true}
```

```
🗑️ Student Jane Smith marked absent - removing from schedule...
  ✅ Removed 1 assignment(s) for Jane Smith - staff are now available
✅ Student attendance updated: Jane Smith {absentPM: true}
```

## Technical Details

### App.js Changes
- **handleUpdateStaffAttendance()**: Enhanced to call `schedule.removeStaffFromSessions()`
- **handleUpdateStudentAttendance()**: Enhanced to call `schedule.removeStudentFromSessions()`
- Triggers schedule re-render after removals

### Schedule Class Methods (types/index.js)
- **removeStaffFromSessions(staffId, sessions)**: Removes all assignments (regular + trainee) for a staff member in specified sessions
- **removeStudentFromSessions(studentId, sessions)**: Removes all assignments for a student in specified sessions

### Return Values
Both cleanup methods return the count of removed assignments for logging purposes.

## Integration with Existing Features

### Paired Students (1:2 Ratio)
- When one paired student is marked absent, only their assignments are removed
- The pair partner keeps their assignments intact
- When both are marked absent, both are removed independently

### Training/Overlap
- Removes trainee assignments as well as regular assignments
- Staff in training who are marked absent are removed from both roles

### Auto-Assignment Engine
- Automatically respects attendance status
- Won't assign absent staff or students
- Considers freed-up staff when reassigning

## Best Practices

1. **Check Attendance First**: Before finalizing a schedule, verify all attendance
2. **Use Auto-Schedule After**: After marking absences, run auto-schedule to fill gaps
3. **Save Often**: Save the schedule after making attendance changes
4. **Review Console**: Check browser console (F12) for detailed cleanup logs
5. **Verify Assignments**: After marking someone absent, verify their former assignments are covered

## Benefits

✅ **Time Savings**: No manual removal of assignments needed
✅ **Accuracy**: Prevents scheduling conflicts with absent people
✅ **Flexibility**: Quick response to last-minute call-outs
✅ **Efficiency**: Staff immediately available for reassignment
✅ **Audit Trail**: Console logs track all automated changes
