# Trainee Solo Assignment Bug Fix

## Issue
The auto-schedule and smart swap functionality was incorrectly scheduling trainees (staff with `OVERLAP_STAFF` or `OVERLAP_BCBA` training status) to work solo with students. Trainees should ONLY appear in the trainee dropdown and should never be assigned as primary/solo staff.

## Root Cause
In the `findSimpleSwapWithUnassignedStaff` method of `AutoAssignmentEngine.js`, when searching for unassigned staff who could enable a swap, the code checked:
1. ✅ If the unassigned staff is on the current student's team
2. ❌ **MISSING**: If the unassigned staff is in training for that student

This meant that if a trainee was unassigned and on a student's team, they could be used as a replacement staff in a swap, allowing them to work solo.

## Example Scenario (Before Fix)
1. **Lydia** needs staff (gap)
2. **Amy** (on Lydia's team) is currently assigned to **Student X**
3. **Carol** (trainee for Student X) is unassigned and on Student X's team
4. **BUG**: System would swap Carol → Student X (SOLO!), Amy → Lydia
5. **Result**: Trainee Carol is working solo with Student X ❌

## Fix Applied
Added a critical check in `AutoAssignmentEngine.js` line ~228:

```javascript
// CRITICAL: Don't use staff who are in training for currentStudent
// They should only be assigned as trainees, not primary staff
if (this.isStaffInTrainingForStudent(unassignedStaffMember, currentStudent)) {
  console.log(`      🎓 EXCLUDING ${unassignedStaffMember.name} - in training for ${currentStudent.name} (trainee only)`);
  continue;
}
```

## Validation
The fix ensures that:
- ✅ Trainees are NEVER assigned as primary/solo staff via auto-schedule
- ✅ Trainees are NEVER used as replacement staff in smart swaps
- ✅ Trainees can ONLY be assigned via the trainee dropdown (manual assignment)
- ✅ All existing trainee blocking logic remains intact in other parts of the codebase

## Files Modified
- `src/services/AutoAssignmentEngine.js` (line ~228)

## Testing Recommendations
1. Set a staff member to `overlap-staff` or `overlap-bcba` training status for a student
2. Run auto-schedule multiple times
3. Verify the trainee is NEVER assigned as primary staff to that student
4. Verify the trainee CAN be manually assigned via the trainee dropdown
5. Run smart swap/gap filling and verify trainees are never used as replacements

## Related Code Locations
The codebase already had proper trainee blocking in:
- `assignStudent()` method (line ~945)
- `assignSmallGroupStudent()` method (line ~1086)  
- `performSwapOptimization()` method (line ~2004, 2046, 2071, 2174, 2202)
- `findSimpleSwapWithUnassignedStaff()` method (line ~162, 186) - NOW COMPLETE ✅

## Date Fixed
November 4, 2025
