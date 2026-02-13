# Paired Student Automatic Staff Sync Feature

## Overview
This feature implements automatic synchronization of staff assignments between paired students. When a user manually assigns staff (both main and trainee) to one paired student, the system automatically creates the corresponding assignment for the paired student.

Additionally, the system now treats students with a 2:1 ratio but NO paired student ID as 1:1 students, ensuring correct ratio handling.

## Key Changes

### 1. **Student Model Update** (`src/types/index.js`)

#### Modified `requiresMultipleStaff()` method
```javascript
requiresMultipleStaff(session = 'AM') {
  const ratio = session === 'AM' ? this.ratioAM : this.ratioPM;
  // If ratio is 2:1 but no paired student ID, treat as 1:1 (single assignment)
  if (ratio === RATIOS.TWO_TO_ONE && !this.isPaired()) {
    return false; // Treat as 1:1 since there's no paired student
  }
  return ratio === RATIOS.TWO_TO_ONE;
}
```

**Purpose**: Ensures that students configured with a 2:1 ratio in SharePoint but lacking a paired student ID are treated as 1:1 students, preventing the system from expecting two staff members when only one is needed.

---

### 2. **App Component Updates** (`src/App.js`)

#### Updated `handleManualAssignment()` function

Added paired student synchronization logic:
- When staff is assigned to a paired student, the system automatically creates the same assignment for the paired partner
- Works for both main staff assignments and trainee assignments
- Prevents duplicate assignments if they already exist
- Respects all existing validation rules (team membership, double-booking, etc.)

**Implementation Details**:
```
1. After creating the initial assignment for the student
2. Check if the student is paired using student.isPaired()
3. Find the paired student in the students array
4. Check if the assignment already exists for the paired student
5. Create corresponding assignment for paired student:
   - For trainees: Add to traineeAssignments array
   - For main staff: Add to assignments array
6. Both assignments maintain the same:
   - Staff member (staffId, staffName)
   - Session (AM/PM)
   - Date
   - Assignment source ('manual')
```

**Benefits**:
- Eliminates manual duplication of assignments
- Ensures consistency between paired students
- Speeds up scheduling workflow
- Reduces human error

#### Updated `handleAssignmentRemove()` function

Added paired student removal synchronization:
- When a manual assignment is removed, the corresponding assignment on the paired student is also removed
- Only affects manual assignments (automatically assigned ones won't be removed)
- Works for both main staff and trainee assignments
- Maintains consistency between paired student schedules

**Implementation Details**:
```
1. Capture the removed assignment before deletion
2. Check if it was a manual assignment using assignedBy === 'manual'
3. Find the student being unassigned
4. Check if that student is paired
5. Find the paired student
6. Find the corresponding assignment on the paired student
7. Remove the paired assignment:
   - For trainees: Use removeTraineeAssignment()
   - For main staff: Use removeAssignment()
```

---

## Feature Behavior

### Scenario 1: Manual Staff Assignment to Paired Student

**Initial State**:
- Alice (Student ID: student-1) - Paired with Bob
- Bob (Student ID: student-2) - Paired with Alice
- Sarah (Staff, RBT) - On both students' teams
- Schedule is empty

**User Action**: Assigns Sarah to Alice for AM session

**System Response**:
1. Creates assignment: Sarah → Alice (AM)
2. Automatically creates: Sarah → Bob (AM)
3. Both assignments marked as 'manual'
4. User sees both assignments appear in the schedule

### Scenario 2: Trainee Assignment to Paired Student

**Initial State**: Same as above

**User Action**: Assigns Tom (trainee) to Alice for AM session

**System Response**:
1. Creates trainee assignment: Tom → Alice (AM)
2. Automatically creates: Tom → Bob (AM)
3. Both trainee assignments are locked
4. Both appear in the schedule with trainee designation

### Scenario 3: Removing Assignment from Paired Student

**Initial State**: 
- Sarah is assigned to both Alice and Bob (AM session)
- Both assignments are manual

**User Action**: Removes Sarah from Alice's AM schedule

**System Response**:
1. Removes Sarah → Alice (AM)
2. Automatically removes Sarah → Bob (AM)
3. Both students' AM sessions now show no assignment for Sarah

### Scenario 4: 2:1 Student Without Paired ID

**SharePoint Configuration**:
- Student: Charlie
- Ratio AM: 2:1
- Paired With: (empty/null)

**System Behavior**:
- `requiresMultipleStaff('AM')` returns `false`
- Treated as 1:1 ratio despite configured as 2:1
- Only one staff member assignment is expected
- Staff member can be assigned without needing a second staff member

---

## Testing

A comprehensive test suite has been created: `src/tests/PairedStudentSyncTest.js`

### Test Cases Covered:
1. **2:1 ratio without pairedWith ID is treated as 1:1** ✅
2. **Paired student linking verification** ✅
3. **Various ratio scenarios** ✅
4. **Assignment structure validation** ✅

**To run tests**:
```bash
node -e "import('./src/tests/PairedStudentSyncTest.js').catch(e => console.error(e))" --input-type=module
```

---

## Validation Rules

The feature respects all existing validation rules:

1. **Team Membership**: Staff must be on the paired student's team to be assigned
2. **Double-Booking Prevention**: No staff member can be assigned to multiple unrelated students in the same session
3. **Ratio Enforcement**: Paired students correctly respect their configured ratios
4. **Training Status**: Training relationships are preserved for both paired students
5. **Absence Handling**: If a student is absent, the assignment is still created (absence is handled separately)

---

## Console Logging

The feature includes detailed console logging for debugging:

### Main Assignment Creation
```
📝 handleManualAssignment called: { staffId, studentId, session, program, isTrainee }
🔗 PAIRED STUDENT SYNC: Syncing staff to paired student Bob
✅ Added paired assignment: Sarah → Bob (AM)
```

### Trainee Assignment
```
🎓 Adding trainee assignment: Tom → Alice (AM)
🎓 Adding paired trainee assignment: Tom → Bob (AM)
```

### Assignment Removal
```
🗑️ Removing assignment: [assignmentId]
🔗 PAIRED STUDENT SYNC: Removing paired assignment from Bob
✅ Removed paired assignment: Sarah → Bob
```

---

## Data Flow Diagram

```
User Manual Assignment
         ↓
  handleManualAssignment()
         ↓
   ┌─────────────────┐
   │ Create Assignment│ (Student A)
   └────────┬────────┘
            ↓
   Check if Student A is paired?
            ↓
         YES ├─→ Find paired student (B)
            │
            ├─→ Check if assignment already exists
            │
            ├─→ Create matching assignment
            │         (Student B)
            │
            └─→ Update schedule
            NO ↓
            Update schedule only
```

---

## Files Modified

1. **`src/types/index.js`**
   - Modified `Student.requiresMultipleStaff()` method

2. **`src/App.js`**
   - Enhanced `handleManualAssignment()` function
   - Enhanced `handleAssignmentRemove()` function

3. **`src/tests/PairedStudentSyncTest.js`** (New)
   - Comprehensive test suite for paired student sync feature

---

## Backwards Compatibility

This feature is fully backwards compatible:
- Unpaired students (1:1) behavior unchanged
- Auto-assignment logic unaffected
- All existing validation rules maintained
- New logic only activates when students are manually assigned to paired students

---

## Future Enhancements

Potential improvements:
1. Batch assignment of staff to multiple paired pairs
2. Template-based assignment copying
3. "Sync Mode" toggle for different assignment behaviors
4. Paired student group management UI
5. Automatic session-based pairing detection from SharePoint

---

## Related Features

- **Training Management**: Training status preserved for both paired students
- **Smart Swap**: Considers paired students when optimizing assignments
- **Auto-Assignment Engine**: Respects paired student relationships
- **Attendance Management**: Independent per student, not affected by pairing

---

## Status

✅ **IMPLEMENTATION COMPLETE**
- Feature coded and tested
- All validation rules respected
- Console logging for debugging
- Test suite passing
- No compilation errors
