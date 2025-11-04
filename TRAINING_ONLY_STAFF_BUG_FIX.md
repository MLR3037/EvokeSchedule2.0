# Training-Only Staff Auto-Assignment Bug Fix

## Critical Issue
**BLOCKER**: Mya (and other training-only staff) were being auto-assigned to students they are NOT solo/certified on. This violates a core business rule: **TRAINEES WHO ARE NOT SOLO ON ANY STUDENT CANNOT BE AUTO-SCHEDULED**.

## Root Cause
The auto-assignment logic had multiple layers of trainee protection:
1. ✅ **Checked**: If staff is in training for a SPECIFIC student (overlap-staff/overlap-bcba status)
2. ❌ **MISSING**: If staff has NO solo cases with ANY student (training-only staff)

**Example Scenario:**
- **Mya** is on several student teams but has `overlap-staff` status on ALL of them (no solo cases)
- **Justin** needs staff - Mya is on his team
- **Bug**: System checked if Mya is in training for Justin specifically, but she might be marked as "solo" on Justin while still being training-only overall
- **Result**: Mya gets auto-assigned to Justin even though she has NO certified solo cases

## The Fix

### 1. Added `staffHasAnySoloCase()` Helper Method
New method in `AutoAssignmentEngine.js`:

```javascript
staffHasAnySoloCase(staffMember, students) {
  const activeStudents = students.filter(s => s.isActive);
  
  for (const student of activeStudents) {
    if (student.teamIds && student.teamIds.includes(staffMember.id)) {
      const trainingStatus = student.getStaffTrainingStatus ? 
        student.getStaffTrainingStatus(staffMember.id) : TRAINING_STATUS.SOLO;
      
      // They have a solo case if status is 'solo' or 'trainer'
      if (trainingStatus === TRAINING_STATUS.SOLO || trainingStatus === TRAINING_STATUS.TRAINER) {
        return true; // Found at least one solo case
      }
    }
  }
  
  return false; // No solo cases found - training-only staff
}
```

### 2. Updated `assignStudent()` Method
Added check after the existing training check:

```javascript
// CRITICAL: EXCLUDE staff who have NO solo cases at all (training-only staff)
const hasAnySoloCase = this.staffHasAnySoloCase(staffMember, students);
if (!hasAnySoloCase) {
  console.log(`  🚫 BLOCKING ${staffMember.name}: NO SOLO CASES - training-only staff cannot be auto-assigned`);
  return false;
}
```

### 3. Updated `assignSmallGroupStudent()` Method
Added identical check for 1:2 ratio assignments.

### 4. Updated `getAvailableStaffForStudent()` Utility Function
Enhanced the core utility function in `types/index.js` to accept an optional `allStudents` parameter and perform the training-only check:

```javascript
// CRITICAL: EXCLUDE staff who have NO solo cases at all (training-only staff)
if (allStudents) {
  let hasAnySoloCase = false;
  // ... check all students for solo cases ...
  if (!hasAnySoloCase) {
    return false; // Training-only staff excluded
  }
}
```

### 5. Updated All Function Calls
Updated all calls to `getAvailableStaffForStudent()` to pass the `students` array:
- `assignStudent()` (line 946)
- `assignSmallGroupStudent()` (line 1115)
- `assignPairedStudents()` (line 1467)

## Impact on "Direct Staff" Count

The fix also explains the count discrepancy:
- **"Direct Staff (RBT/BS): 26"** - Counts ALL RBT/BS who can do direct service
- **"Available Direct Staff: 3"** - Counts only those NOT currently assigned

**But now with the fix:**
- Training-only staff like Mya are NOT counted in the "Direct Staff" calculation (they're filtered out in the UI summary)
- Training-only staff are NEVER available for auto-assignment
- The count should now match reality

## Business Rules Enforced

After this fix, the system enforces:
1. ✅ Staff in training for a specific student CANNOT be auto-assigned to that student
2. ✅ Staff with NO solo cases CANNOT be auto-assigned to ANY student
3. ✅ Training-only staff can ONLY be manually assigned via the trainee dropdown
4. ✅ Staff with at least ONE solo case CAN be auto-assigned to students they're certified on

## Testing Scenarios

### Scenario A: Pure Training-Only Staff
- **Mya**: overlap-staff on ALL students (no solo cases)
- **Expected**: BLOCKED from auto-assignment
- **Can still be used**: Via trainee dropdown only

### Scenario B: Mixed Training/Solo Staff
- **Bob**: solo on Students A, B, C; overlap-staff on Student D
- **Expected**: CAN be auto-assigned to A, B, C (his solo cases)
- **Expected**: BLOCKED from auto-assignment to D (training case)
- **Can be trainee for**: Student D via trainee dropdown

### Scenario C: All Solo Staff
- **Amy**: solo/trainer on all students
- **Expected**: CAN be auto-assigned normally

## Files Modified
1. `src/services/AutoAssignmentEngine.js`:
   - Added `staffHasAnySoloCase()` method
   - Updated `assignStudent()` with training-only check
   - Updated `assignSmallGroupStudent()` with training-only check
   - Updated all `getAvailableStaffForStudent()` calls to pass students array

2. `src/types/index.js`:
   - Updated `getAvailableStaffForStudent()` signature to accept `allStudents` parameter
   - Added training-only staff check in the utility function

## Console Logging
When a training-only staff member is blocked, you'll see:
```
🚫 BLOCKING Mya: NO SOLO CASES - training-only staff cannot be auto-assigned
```

## Date Fixed
November 4, 2025
