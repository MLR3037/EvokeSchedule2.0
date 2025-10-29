# Smart Swap Fixes - Training Status & Locked Assignments

## Date: October 29, 2025

## Issues Fixed

### Issue 1: Locked Assignments Being Removed
**Problem:** When performing smart swap optimization, locked assignments (staff manually assigned by the user) were being removed and swapped to different students. This violated the user's explicit assignment choices.

**Root Cause:** The smart swap algorithm checked `!a.isLocked` when FINDING assignments to swap, but didn't double-check before actually removing them. There was a gap between finding and executing.

**Fix Applied:**
- Added a final safety check before executing swaps in `performSwapOptimization()`:
  ```javascript
  // FINAL SAFETY CHECK: Ensure assignment is not locked before swapping
  if (currentAssignment.isLocked || schedule.isAssignmentLocked(currentAssignment.id)) {
    console.log(`🔒 BLOCKED - Assignment is locked, cannot swap`);
    continue;
  }
  ```

- Added locked assignment check in `findSimpleSwapWithUnassignedStaff()`:
  ```javascript
  // CRITICAL CHECK: Skip locked assignments - they should NOT be swapped
  if (currentAssignment.isLocked || schedule.isAssignmentLocked(currentAssignment.id)) {
    console.log(`🔒 BLOCKED - Assignment is locked, skipping`);
    continue;
  }
  ```

### Issue 2: Staff in Training Scheduled Solo
**Problem:** Staff members who are marked as "in training" (overlap-staff or overlap-bcba status) were being auto-scheduled as primary/solo staff with students. These staff should ONLY be assigned as trainees (paired with an experienced trainer), never as the primary staff member.

**Root Cause:** The smart swap algorithm didn't check the training status of staff members before making swap decisions. It only verified team membership and availability.

**Fix Applied:**
- Added training status checks in `performSwapOptimization()`:
  ```javascript
  // CRITICAL CHECK: Don't use staff who are in training for gap student
  // They should only be assigned as trainees, not primary staff
  if (this.isStaffInTrainingForStudent(unassignedStaffMember, gapStudent)) {
    console.log(`🚫 EXCLUDING - in training (trainee only)`);
    continue;
  }
  ```

- Added same check for the freed staff:
  ```javascript
  // CRITICAL CHECK: Don't swap staff who are in training for gap student
  if (this.isStaffInTrainingForStudent(currentStaff, gapStudent)) {
    console.log(`🚫 EXCLUDING - in training (trainee only)`);
    continue;
  }
  ```

- Added training status filters in `findSimpleSwapWithUnassignedStaff()`:
  - Excluded staff in training from the pool of unassigned RBT/BS staff
  - Filtered out team members who are in training when building the target team list
  ```javascript
  if (this.isStaffInTrainingForStudent(s, targetStudent)) return false;
  ```

## Functions Modified

### 1. `performSwapOptimization()`
Located at line ~1870 in AutoAssignmentEngine.js
- Added 4 new safety checks (2 for locked, 2 for training status)

### 2. `findSimpleSwapWithUnassignedStaff()`
Located at line ~150 in AutoAssignmentEngine.js
- Added locked assignment check in the assignment loop
- Added training status filter for unassigned staff pool
- Added training status filter for target team members

## Testing Recommendations

1. **Test Locked Assignments:**
   - Manually assign staff to students
   - Lock the assignments
   - Run smart swap
   - Verify locked assignments are not changed

2. **Test Training Status:**
   - Mark staff as "overlap-staff" or "overlap-bcba" for specific students
   - Run smart swap
   - Verify those staff are NOT assigned as primary staff to those students
   - Verify they can still be assigned as trainees in the trainee dropdown

3. **Test Combined Scenario:**
   - Have locked assignments AND staff in training
   - Run smart swap
   - Verify both protections work together

## Technical Notes

### Training Status Detection
The fix uses the existing `isStaffInTrainingForStudent()` method which checks:
```javascript
const trainingStatus = student.getStaffTrainingStatus(staffMember.id);
const isInTraining = trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || 
                     trainingStatus === TRAINING_STATUS.OVERLAP_BCBA;
```

This means staff with `TRAINING_STATUS.TRAINER` or `TRAINING_STATUS.SOLO` can still be assigned as primary staff, which is correct behavior.

### Locked Assignment Detection
The fix uses both properties to ensure maximum protection:
```javascript
currentAssignment.isLocked || schedule.isAssignmentLocked(currentAssignment.id)
```

This guards against any inconsistency between the assignment's isLocked property and the schedule's locked assignment tracking.

## Expected Behavior After Fix

1. **Locked Assignments:**
   - ✅ Will NEVER be removed or swapped during smart swap
   - ✅ User's manual assignments are respected
   - ✅ Smart swap works around locked assignments to fill other gaps

2. **Staff in Training:**
   - ✅ Will NOT be assigned as primary staff to students they're training for
   - ✅ Can still be selected in the trainee dropdown (correct behavior)
   - ✅ Can be assigned as primary staff to OTHER students they're not training for
   - ✅ Smart swap respects training relationships

## Impact on Existing Features

- **No breaking changes** to existing functionality
- **No changes** to manual assignment process
- **No changes** to trainee assignment process
- **Enhanced protection** during smart swap only
- **Backward compatible** with existing schedules
