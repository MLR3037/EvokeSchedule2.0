# Paired Student Staff Linking Feature

## Problem
When locking in staff (main and trainee) for a child who is in a 1:2 paired ratio, the staff would only show for that one child. The pair partner wouldn't automatically get the same staff assignments, even though they share the same staff in a 1:2 ratio.

## Solution
Implemented automatic staff linking for paired students. When you assign staff to one child in a 1:2 pair, the same staff are automatically assigned to their pair partner.

## What Changed

### Main Staff Assignments
**File: `src/components/SchedulingComponents.js`**

1. **`handleLockAssignment` function** - Enhanced to check if a student is paired:
   - When you lock in staff for a paired student, it automatically creates the same assignment for their pair partner
   - Only auto-assigns if both students have a 1:2 ratio for the session
   - Logs the pairing action for debugging

2. **`handleUnlockAssignment` function** - Enhanced to handle paired unlocking:
   - When you unlock/remove staff from a paired student, it automatically removes the same staff from their pair partner
   - Finds matching assignments by staff ID
   - Maintains synchronization between paired students

### Trainee Assignments
**File: `src/components/SchedulingComponents.js`**

1. **`handleTraineeChange` function** - Enhanced for trainee linking:
   - When you assign a trainee to a paired student, it automatically assigns the same trainee to their pair partner
   - When you remove a trainee, it removes from both paired students
   - Updates both local state and schedule object

2. **`handleRemoveTrainee` function** - Enhanced to remove from both students:
   - Removes trainee assignments from both paired students simultaneously
   - Keeps the UI synchronized

## How It Works

### Data Flow
1. User selects staff/trainee for Student A (who is paired with Student B)
2. System checks if Student A has `pairedWith` property set
3. If paired, system finds Student B using `getPairedStudent()` method
4. System creates identical assignment for Student B
5. Both assignments are locked/unlocked together

### Key Checks
- ✅ Verifies student has `isPaired()` method returning true
- ✅ Checks paired student exists in the students list
- ✅ Validates paired student has same ratio (1:2) for the session
- ✅ Prevents orphaned assignments if pair relationship is one-way

## Benefits

1. **Consistency**: Both paired students always show the same staff
2. **Efficiency**: No need to manually assign staff twice
3. **Error Prevention**: Eliminates possibility of paired students having different staff
4. **Better UX**: Clear visual indication that assignments are linked
5. **Console Logging**: Detailed logs with 🔗 emoji for easy debugging

## Usage Example

**Scenario**: Sarah and Emma are paired (1:2 ratio) in AM session

**Before**:
1. Select staff "John" for Sarah → Lock
2. Manually select staff "John" for Emma → Lock
3. Assign trainee "Alice" to Sarah
4. Manually assign trainee "Alice" to Emma

**After**:
1. Select staff "John" for Sarah → Lock
   - ✅ Automatically locked for Emma too!
2. Assign trainee "Alice" to Sarah
   - ✅ Automatically assigned to Emma too!

## Console Messages

Look for these console messages to confirm pairing is working:

```
🔗 LINKED PAIR: Also assigning [staffId] to pair partner [StudentName]
✅ Pair partner assignment locked: [StudentName] with same staff
🔗 LINKED PAIR TRAINEE: Also assigning trainee [staffId] to pair partner [StudentName]
✅ Pair partner trainee assigned: [StudentName]
```

## Technical Notes

- Uses existing `Student.pairedWith` property (ID of paired student)
- Uses existing `Student.isPaired()` method to check pairing status
- Uses existing `Student.getPairedStudent(students)` method to find pair partner
- Maintains backward compatibility with non-paired students
- Works with both manual assignments and auto-assignment engine

## Future Enhancements

Potential improvements:
- Visual indicator (chain link icon) showing paired assignments
- Validation to ensure pairing is bidirectional
- Bulk pairing/unpairing interface
- Pair relationship management in Teams tab

## Testing

To test this feature:
1. Set up two students with 1:2 ratio
2. Set their `pairedWith` property to each other's ID
3. Lock in staff for one student
4. Verify the same staff appears for the paired student
5. Unlock staff from one student
6. Verify it unlocks from both students
7. Repeat with trainee assignments

---

**Date Implemented**: October 23, 2025
**Files Modified**: `src/components/SchedulingComponents.js`
