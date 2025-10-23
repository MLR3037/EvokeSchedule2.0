# Training Status Auto-Assignment Fix

## Problem
When running auto-assignment, staff who are marked as "in training" (with `overlap-staff` or `overlap-bcba` status) were still showing up as available/unassigned. These staff should ONLY be assigned through the trainee dropdown, not as main staff assignments.

## Root Cause
The `AutoAssignmentEngine` was not checking the training status of staff members before assigning them to students. It only checked:
- If staff is active
- If staff can work the program
- If staff is available for the session
- If staff is on the student's team
- If staff can do direct service

But it was **missing** the check for whether the staff member is currently in training for that specific student.

## Solution
Added training status checking to the `AutoAssignmentEngine` to exclude staff who are in training from main assignments.

### Changes Made

**File: `src/services/AutoAssignmentEngine.js`**

1. **Import TRAINING_STATUS constant**:
   ```javascript
   import { 
     Assignment, 
     PROGRAMS, 
     RATIOS, 
     TRAINING_STATUS, // ← Added
     SchedulingUtils, 
     SchedulingRules 
   } from '../types/index.js';
   ```

2. **Added new method `isStaffInTrainingForStudent`**:
   ```javascript
   isStaffInTrainingForStudent(staffMember, student) {
     if (!student.getStaffTrainingStatus) {
       return false;
     }
     
     const trainingStatus = student.getStaffTrainingStatus(staffMember.id);
     const isInTraining = trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || 
                          trainingStatus === TRAINING_STATUS.OVERLAP_BCBA;
     
     if (isInTraining) {
       console.log(`  🎓 ${staffMember.name} is in training for ${student.name} (${trainingStatus}) - excluding from main assignment`);
     }
     
     return isInTraining;
   }
   ```

3. **Updated `assignStudent` method** (line ~896):
   Added check in team staff filter:
   ```javascript
   // EXCLUDE staff who are in training for this student
   if (this.isStaffInTrainingForStudent(staffMember, student)) {
     console.log(`  🚫 EXCLUDING ${staffMember.name}: In training for ${student.name} (trainee only)`);
     return false;
   }
   ```

4. **Updated `assignSmallGroupStudent` method** (line ~1057):
   Added same check in team staff filter:
   ```javascript
   // EXCLUDE staff who are in training for this student
   if (this.isStaffInTrainingForStudent(staffMember, student)) {
     return false;
   }
   ```

5. **Updated `findReplacementStaff` method** (line ~124):
   Added check when finding replacement staff:
   ```javascript
   // EXCLUDE staff who are in training for this student
   if (this.isStaffInTrainingForStudent(s, student)) return false;
   ```

## Training Status Values

From `src/types/index.js`:
```javascript
export const TRAINING_STATUS = {
  CERTIFIED: 'certified',           // Fully trained, can work solo
  OVERLAP_BCBA: 'overlap-bcba',     // Needs BCBA overlaps (trainee only)
  OVERLAP_STAFF: 'overlap-staff',   // Needs staff overlaps (trainee only)
  TRAINER: 'trainer',                // Designated trainer for this student
  SOLO: 'solo'                       // Default - working independently
};
```

## Behavior

### Before Fix
- Staff with `overlap-staff` or `overlap-bcba` status would be auto-assigned as main staff
- They would show in both regular dropdown AND trainee dropdown
- Could be accidentally assigned solo when they need supervision

### After Fix
- Staff with `overlap-staff` or `overlap-bcba` status are **excluded** from main assignments
- They ONLY appear in the trainee dropdown (orange/special dropdown)
- Auto-assignment will not assign them as primary staff
- Manual locking also respects this (handled by `SchedulingComponents.js`)

## Console Output

When the auto-assignment encounters a staff member in training, you'll see:
```
🎓 [Staff Name] is in training for [Student Name] (overlap-staff) - excluding from main assignment
🚫 EXCLUDING [Staff Name]: In training for [Student Name] (trainee only)
```

This makes it easy to debug and verify the training status is being respected.

## Integration with Existing Features

This fix integrates with:
1. **Manual Assignment** - SchedulingComponents.js already filters out trainees from regular dropdown
2. **Paired Student Linking** - Trainees assigned through trainee dropdown still link to paired students
3. **Training Management** - Training status is set via the Training Management tab
4. **Validation** - Validation rules can check if trainees are working solo (warning)

## Testing

To test this fix:
1. Set a staff member's training status to `overlap-staff` or `overlap-bcba` for a specific student
2. Run auto-assignment
3. Verify that staff member is NOT assigned as main staff to that student
4. Verify that staff member still appears in the trainee dropdown for that student
5. Check console logs for `🎓` emoji showing training status detection

## Future Enhancements

Potential improvements:
- Auto-assign trainees based on trainer/trainee relationships
- Validate that trainees have a trainer/supervisor assigned
- Track training progress and auto-promote from `overlap-staff` to `certified`
- Warning if trainee is assigned without a trainer in the same session

---

**Date Fixed**: October 23, 2025
**Files Modified**: `src/services/AutoAssignmentEngine.js`
**Related Feature**: TRAINING_MANAGEMENT, PAIRED_STUDENT_LINKING
