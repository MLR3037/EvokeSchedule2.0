# Auto Schedule After Loading - Bug Fixes

## Issues Fixed

### 1. **Main Staff Not Being Assigned (Skipped Due to Trainee)** ⭐ **PRIMARY BUG**
**Problem:** When loading a saved schedule with trainee assignments and then clicking "Auto schedule for the rest", students with trainee assignments were skipped entirely - no main staff was assigned!

**Root Cause:** The `isStudentAssigned()` function was counting trainee assignments as regular assignments. So:
1. Student has a loaded trainee assignment  
2. `isStudentAssigned()` returns true (sees trainee, thinks student is covered)
3. Auto-assignment skips the student (thinks they're already assigned)
4. Result: Student has trainee but NO main staff!

**Solution:** Exclude trainee assignments when checking if student is assigned:
```javascript
// Only count main staff assignments, NOT trainee assignments
const studentAssignments = sessionAssignments.filter(assignment => 
  assignment.studentId === studentId && !assignment.isTrainee
);
```

**Files Modified:** 
- `src/services/AutoAssignmentEngine.js` (line ~1454) - isStudentAssigned filter
- `src/App.js` (lines ~543-560) - Enhanced logging

**New Logging:**
```
✅ Keeping these assignments (manual/loaded/locked): 25
  Main staff: 20
  Trainees: 5
  KEEPING: John Doe → Student A (AM) - assignedBy: loaded, isLocked: false, isTrainee: false
  KEEPING: Jane Smith → Student B (AM) - assignedBy: loaded, isLocked: false, isTrainee: true
```

---

### 2. **Trainees Being Removed by Safety Check**
**Problem:** When a student had main staff + trainee assignments, SAFETY CHECK 2 was limiting total assignments to maxStaff (1 or 2), which removed trainees.

**Root Cause:** SAFETY CHECK 2 treated ALL assignments equally and limited them based on student ratio. But trainees should NOT count toward the ratio limit - they're observational/training only.

**Solution:** Separate main staff from trainees, limit only main staff, always keep ALL trainees:
```javascript
// CRITICAL: Separate main staff from trainees
const mainStaff = assignments.filter(a => !a.isTrainee);
const trainees = assignments.filter(a => a.isTrainee);

// Limit only main staff based on ratio
const keptMainStaff = sortedMainStaff.slice(0, maxStaff);

// Keep limited main staff + ALL trainees
validAssignments.push(...keptMainStaff, ...trainees);
```

**Why This Matters:** Trainees don't provide coverage - they're extras for training purposes. A 1:1 student can have 1 main staff + unlimited trainees.

**File Modified:** `src/App.js` (lines ~601-625)

---

### 3. **Locked Assignments Set Not Populated on Load**
**Problem:** When loading a schedule from SharePoint, the `lockedAssignments` Set was always empty, even though individual assignments had `isLocked: true/false`.

**Impact:** While this didn't break the filter (which checks `a.isLocked` directly), it could cause issues with other features that rely on the `schedule.lockedAssignments` Set.

**Solution:** Build the `lockedAssignments` Set from assignments that have `isLocked: true` when loading.

**File Modified:** `src/services/SharePointService.js` (lines ~844-849)

**Code Change:**
```javascript
// Build lockedAssignments Set from assignments that have isLocked: true
const lockedAssignments = new Set(
  assignments.filter(a => a.isLocked).map(a => a.id)
);

const schedule = new Schedule({
  // ...
  lockedAssignments: lockedAssignments, // Now properly populated
  // ...
});
```

---

### 4. **Extra Staff Count Showing -1 (Negative)**
**Problem:** After auto-scheduling with loaded assignments, the "Extra Staff" count in the summary was showing -1, even though there was adequate staff.

**Root Cause:** Trainee assignments were being counted in:
1. `studentAssignmentCounts` - making it seem like students had more staff than they actually did
2. `assignedStaffIds` - making it seem like more staff were unavailable than actually were

**Impact:** 
- Students with trainees appeared fully assigned when they weren't
- Trainees made staff appear "busy" when they should still be available
- Staff utilization calculations were incorrect

**Solution:** Exclude trainee assignments from both counts:
1. Skip trainee assignments when building `studentAssignmentCounts`
2. Filter out trainees when building `assignedStaffIds`

**File Modified:** `src/components/SchedulingComponents.js` (lines ~2117-2122, ~2213-2218)

**Code Changes:**
```javascript
// Before: Counted ALL assignments including trainees
assignments.forEach(a => {
  studentAssignmentCounts[a.studentId] = (studentAssignmentCounts[a.studentId] || 0) + 1;
});

// After: Skip trainee assignments
assignments.forEach(a => {
  if (a.isTrainee) return; // Trainees don't count toward coverage
  studentAssignmentCounts[a.studentId] = (studentAssignmentCounts[a.studentId] || 0) + 1;
});
```

```javascript
// Before: Counted all assigned staff
const assignedStaffIds = new Set(assignments.map(a => a.staffId));

// After: Only count main staff, not trainees
const assignedStaffIds = new Set(
  assignments.filter(a => !a.isTrainee).map(a => a.staffId)
);
```

---

## Why This Matters

### Trainee Assignments Are Different
- **Main Staff Assignment:** Provides direct service coverage (1:1, 2:1, etc.)
- **Trainee Assignment:** Observational/training, does NOT provide coverage

### Counting Rules
1. **Student Coverage:** Only main staff count toward meeting student ratios
2. **Staff Availability:** Trainees don't consume staff availability (staff can be main + trainee simultaneously)
3. **Extra Staff Calculation:** `directStaffCount - totalSessions` should only consider main staff assignments

---

## Testing the Fix

1. **Load a saved schedule** with both main staff and trainee assignments
2. **Check the console logs:**
   - Should see: `✅ Keeping these assignments (manual/loaded/locked): XX`
   - Should show breakdown of main staff vs. trainees
3. **Click "Auto schedule for the rest"**
4. **Verify:**
   - ✅ Loaded main staff assignments are kept
   - ✅ Loaded trainee assignments are kept
   - ✅ Extra Staff count is correct (not negative)
   - ✅ Unassigned count is accurate

---

## Related Issues Fixed

### Console Logging (from CONSOLE_LOG_GUIDE.md)
The recent console logging improvements now show:
- Which assignments are being kept vs. removed
- Staff eligibility during auto-assignment
- Assignment results (full/partial/failed)

This makes it much easier to debug issues like this one.

---

**Date Fixed:** December 16, 2025  
**Files Modified:** 
- `src/App.js` - Enhanced logging for assignment filtering
- `src/services/SharePointService.js` - Populate lockedAssignments Set on load
- `src/components/SchedulingComponents.js` - Exclude trainees from coverage calculations

**Related Features:** AUTO_LOCK_ON_SELECTION, MANUAL_LOCK_TOGGLE_FEATURE, CONSOLE_LOG_GUIDE
