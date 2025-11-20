# Paired Student Fix - Live Schedule View

## Problem
Roman (and other paired students) showed times but **no staff names** in Live Schedule View and popup window, even though they had staff assigned on the Schedule tab.

## Root Cause
Paired students (1:2 ratio) share staff assignments. The assignment is stored under ONE student's ID, but BOTH students should see the staff name.

The LiveScheduleView component was only looking for assignments where `assignment.studentId === student.id`. If Roman is paired with another student and the assignment was stored under the partner's ID, Roman would show up with no staff.

## Solution
Added the same paired student logic that exists in SchedulingComponents:

```javascript
// PAIRED STUDENT FIX: If student is paired and has no assignments, check paired partner's assignments
if (amAssignments.length === 0 && student.isPaired && student.isPaired()) {
  const ratio = student.ratioAM;
  if (ratio === '1:2') {
    const pairedStudent = student.getPairedStudent(students);
    if (pairedStudent) {
      const pairedRatio = pairedStudent.ratioAM;
      if (pairedRatio === '1:2') {
        const pairedAssignments = schedule.assignments.filter(
          a => a.studentId === pairedStudent.id && a.session === 'AM'
        );
        if (pairedAssignments.length > 0) {
          console.log(`🔗 PAIRED FIX AM: ${student.name} using ${pairedStudent.name}'s assignments`);
          amAssignments = pairedAssignments;
        }
      }
    }
  }
}
```

This logic is applied for BOTH AM and PM sessions.

## How It Works
1. Check if student has no assignments for the session
2. Check if student is paired (`student.isPaired()`)
3. Check if student has 1:2 ratio (shared staff)
4. Get the paired partner student
5. Check if partner also has 1:2 ratio
6. Get partner's assignments for that session
7. If partner has assignments, use them for this student too

## Files Modified
- `src/components/LiveScheduleView.js` (lines 43-82)
  - Added paired student logic for AM assignments
  - Added paired student logic for PM assignments
  - Console logs when using paired partner's assignments

## Testing
1. Make sure Roman (or any paired student) has staff assigned on Schedule tab
2. Check the paired partner also has 1:2 ratio
3. Go to Live View tab
4. Console should show: `🔗 PAIRED FIX AM: Roman using [Partner]'s assignments`
5. Roman should now show the staff name
6. Open popup window - Roman should show staff there too

## Related Features
- Paired student setup in Students tab (`pairedWith` field)
- 1:2 ratio setting in student configuration
- Shared staff assignment logic in SchedulingComponents.js

## Notes
- This fix only applies to 1:2 (paired) students
- Both students must have 1:2 ratio to share staff
- If one student is 1:1 and partner is 1:2, they don't share staff
- The assignment is still stored under ONE student ID (not duplicated)
- This is a display-only fix - the underlying data structure remains the same
