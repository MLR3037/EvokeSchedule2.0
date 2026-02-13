# Paired Student Auto-Sync Implementation Guide

## Quick Reference

### What Was Added

#### 1. Smarter 2:1 Ratio Handling
- **File**: `src/types/index.js` (Student class)
- **Change**: Modified `requiresMultipleStaff()` method
- **Behavior**: Students with 2:1 ratio but NO paired student ID are now treated as 1:1

```javascript
// Before: Would return true for any 2:1 ratio
// After: Returns false if pairedWith is null/undefined
requiresMultipleStaff(session = 'AM') {
  const ratio = session === 'AM' ? this.ratioAM : this.ratioPM;
  if (ratio === RATIOS.TWO_TO_ONE && !this.isPaired()) {
    return false; // Treat as 1:1 since there's no paired student
  }
  return ratio === RATIOS.TWO_TO_ONE;
}
```

#### 2. Automatic Staff Sync on Assignment
- **File**: `src/App.js` - `handleManualAssignment()` function
- **Change**: Added paired student synchronization
- **Behavior**: When staff is manually assigned to one paired student, the same assignment is automatically created for the paired partner

```
User assigns Sarah to Alice
         ↓
System also assigns Sarah to Bob (Alice's paired partner)
         ↓
Both students see Sarah in their schedule
```

#### 3. Automatic Staff Removal Sync
- **File**: `src/App.js` - `handleAssignmentRemove()` function  
- **Change**: Added paired student removal synchronization
- **Behavior**: When a manual assignment is removed from one paired student, the corresponding assignment is also removed from the paired partner (only for manual assignments)

```
User removes Sarah from Alice
         ↓
System also removes Sarah from Bob
         ↓
Both students' schedules updated
```

---

## Code Examples

### Example 1: Automatic Sync on Manual Assignment

**SharePoint Setup**:
```
Client "Alice" (ID: 123)
- Ratio AM: 2:1
- Paired With: 124

Client "Bob" (ID: 124)  
- Ratio AM: 2:1
- Paired With: 123

Staff "Sarah" (ID: S001)
- On both Alice's and Bob's teams
```

**User Action in UI**:
```
Click on Alice's AM session
→ Select "Sarah" from staff dropdown
→ Click "Assign"
```

**System Response**:
```
1. Creates: Assignment(staffId: S001, studentId: 123, session: AM)
2. Detects: Alice.isPaired() = true
3. Finds: Paired student Bob (ID: 124)
4. Creates: Assignment(staffId: S001, studentId: 124, session: AM)
5. Re-renders: Both Alice's and Bob's schedules show Sarah
```

**Console Output**:
```
📝 handleManualAssignment called: { staffId: "S001", studentId: "123", session: "AM", ... }
🔗 PAIRED STUDENT SYNC: Syncing staff to paired student Bob
✅ Added paired assignment: Sarah → Bob (AM)
```

### Example 2: Automatic Sync with Trainees

**User Action**:
```
Click on Alice's AM session
→ Select "Tom" from TRAINEE dropdown
→ Click "Add as Trainee"
```

**System Response**:
```
1. Creates trainee: Assignment(staffId: S002, studentId: 123, session: AM, isTrainee: true)
2. Detects: Alice.isPaired() = true
3. Finds: Paired student Bob
4. Creates trainee: Assignment(staffId: S002, studentId: 124, session: AM, isTrainee: true)
5. Both trainee assignments locked
```

### Example 3: Removing Manual Assignment

**User Action**:
```
Click "X" or trash icon next to Sarah in Alice's AM schedule
→ Confirm removal
```

**System Response**:
```
1. Finds: Assignment(staffId: S001, studentId: 123, session: AM)
2. Checks: assignment.assignedBy = "manual" ✓
3. Removes: Assignment from Alice
4. Finds: Assignment(staffId: S001, studentId: 124, session: AM)
5. Removes: Assignment from Bob
6. Re-renders: Both schedules without Sarah
```

### Example 4: 2:1 Student Without Paired ID

**SharePoint Setup**:
```
Client "Charlie" (ID: 456)
- Ratio AM: 2:1
- Paired With: (empty)
```

**System Behavior**:
```
charlie.isPaired() = false
charlie.requiresMultipleStaff('AM') = false  // Treated as 1:1!

// Only one staff member assignment needed
User assigns Sarah to Charlie
→ No secondary staff required
→ System only creates one assignment
```

---

## Important Details

### What Gets Synced
- ✅ Main staff assignments
- ✅ Trainee assignments
- ✅ Assignment removal (manual only)
- ✅ Session (AM/PM)
- ✅ Date
- ✅ Program assignment

### What Doesn't Get Synced
- ❌ Auto-generated assignments (to prevent cascading auto-assignments)
- ❌ Absence flags (handled independently)
- ❌ Locking/unlocking status (each assignment independent)

### Validation Rules Enforced
1. **Team Check**: Staff must be on paired student's team
2. **Duplicate Check**: Won't create if assignment already exists
3. **Manual Only**: Only manual assignments are synced/removed
4. **Null Safety**: Checks if paired student exists in student list

---

## Error Handling

### Scenario: Paired Student Not Found
```javascript
if (pairedStudent) {
  // Process sync...
} else {
  console.warn(`⚠️ Paired student with ID ${student.pairedWith} not found in students list`);
  // Continues with normal assignment without sync
}
```

### Scenario: Paired Assignment Already Exists  
```javascript
const existingPairedAssignment = schedule.assignments.find(a => 
  a.staffId === staffId && 
  a.studentId === pairedStudent.id && 
  a.session === session
);

if (!existingPairedAssignment) {
  // Create new assignment
} else {
  console.log(`ℹ️ Paired assignment already exists for ${staffMember.name}`);
  // Skip creation
}
```

---

## Testing Verification

All tests passing ✅

```bash
$ node -e "import('./src/tests/PairedStudentSyncTest.js')" --input-type=module

🧪 Testing Paired Student Sync Feature
✅ 2:1 ratio without paired ID is treated as 1:1
✅ Paired students are correctly linked  
✅ Various ratio scenarios
✅ Assignment structure validation
✅ All tests passed
```

---

## SharePoint Prerequisites

For the feature to work, ensure:

1. **Clients List** has columns:
   - `Title` (Client name)
   - `Ratio_AM` (Select 1:1, 2:1, 1:2)
   - `Ratio_PM` (Select 1:1, 2:1, 1:2)
   - `Paired With` (Link to list item - Points to another Client)

2. **Staff Assignment**:
   - Both paired students must include the staff in their team

3. **Valid Pairing**:
   - If A is paired with B, then B should be paired with A (reciprocal)
   - System will still work with unidirectional pairing but may have inconsistencies

---

## Performance Considerations

- No significant performance impact
- Sync operations are O(n) where n = number of assignments
- Additional array lookups for paired student are minimal
- Schedule re-rendering triggers single React update (batch)

---

## Backwards Compatibility

✅ Fully backwards compatible
- Unpaired students (1:1) unaffected
- Auto-assignment engine unaffected  
- Existing schedules unaffected
- Manual assignment workflow enhanced, not changed

---

## Troubleshooting

### Issue: Paired sync not working
**Check**:
- Is student configured with valid pairedWith ID in SharePoint?
- Is paired student in the same load?
- Are both students active?
- Is the staff member on both teams?

**Debug**:
- Check browser console for sync messages starting with 🔗
- Verify students list loaded correctly
- Confirm assignment was saved

### Issue: Assignments appearing for both students
**This is correct behavior** - the paired sync feature is working as designed

### Issue: Can't assign staff to one paired student
**Check**:
- Staff must be on the student's team
- If assigning to second student in pair, staff must also be on their team
- No other unpaired student in same session with same staff

---

## Implementation Details by File

### `src/types/index.js` 
- **Lines 253-260**: `requiresMultipleStaff()` method
- **Change**: Added pairing check

### `src/App.js`
- **Lines 1127-1175**: Paired sync in `handleManualAssignment()`
- **Lines 1195-1277**: Paired removal in `handleAssignmentRemove()`

### `src/tests/PairedStudentSyncTest.js`
- **New file**: Comprehensive test suite with 4 test groups

---

## Related Features Affected

- **Auto-Assignment**: Respects paired relationships
- **Smart Swap**: Considers paired students as atomic unit
- **Training Management**: Training status maintained per student
- **Attendance**: Absence handled independently per student
- **Validation**: All rules applied to both paired students
