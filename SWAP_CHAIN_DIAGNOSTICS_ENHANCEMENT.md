# Swap Chain Diagnostics Enhancement

## Issue
When there are unassigned students (gaps) and available staff, but the available staff are not on the gap student's team, the system should find swap chains to free up team members. However, users reported cases where swaps are not being found even when they should be possible.

**Example Scenario:**
- Justin (gap student) needs 1 staff (1:1 ratio)
- 4 direct staff available: Klaus, Lauryn Corle, Ari Lashkari, Jay Stark
- BUT: These 4 staff are NOT on Justin's team
- **Expected**: System should find a swap chain where one of these 4 staff replaces someone, freeing up a Justin team member
- **Actual**: No swap found, Justin remains unassigned

## Root Cause Analysis
The swap optimization logic (`performSwapOptimization`) was correctly structured but lacked detailed diagnostic information to understand WHY swaps were failing. Possible reasons:

1. **All of Justin's team members are locked** - Can't swap locked assignments
2. **Justin's team members are with paired students** - Can't break paired assignments
3. **Available staff not on the right teams** - Klaus/Lauryn/Ari/Jay might not be on the teams of students currently working with Justin's team members
4. **Already worked together today** - Staff may have already worked with students in the opposite session
5. **Staff in training** - Team members might be trainees (overlap status)

## Enhancements Added

### 1. Enhanced Logging for Gap Student's Team
Added logging to show the gap student's team members at the start of swap search:

```javascript
const gapStudentTeam = activeStaff.filter(s => gapStudent.teamIds.includes(s.id));
console.log(`\n   📋 ${gapStudent.name}'s team (${gapStudentTeam.length}):`, 
  gapStudentTeam.map(s => s.name).join(', '));
```

### 2. Detailed Swap Evaluation Logging
When evaluating each potential swap, show exactly why it's being accepted or rejected:

```javascript
console.log(`      📊 Evaluating swap: ${unassignedStaffMember.name} → ${otherStudent.name}, ${currentStaff.name} → ${gapStudent.name}`);
console.log(`         • ${currentStaff.name} on ${gapStudent.name}'s team? ${isCurrentStaffOnGapTeam ? '✓' : '✗'}`);
console.log(`         • ${unassignedStaffMember.name} on ${otherStudent.name}'s team? ${canUnassignedWorkWithOther ? '✓' : '✗'}`);
```

### 3. Deep Diagnostic Analysis
When no swap is found, provide detailed analysis showing:
- Where each team member is currently assigned
- Whether assignments are locked
- Who could potentially replace each team member
- Why replacements can't be made

```javascript
console.log(`\n   🔎 DEEP ANALYSIS: Where are ${gapStudent.name}'s team members?`);
for (const teamMember of gapStudentTeam) {
  // Shows current assignment
  // Shows potential replacements
  // Shows why replacements fail
}
```

## How to Use the Diagnostics

1. **Run Auto-Schedule or Smart Swap**
2. **Open browser console** (F12)
3. **Look for the gap student's diagnostic output**:
   ```
   🔀 GAP DETECTED: Justin (primary AM)
   📋 Justin's team (3): Amy Smith, Bob Jones, Carol White
   
   🔍 Checking if Klaus can enable a swap for Justin...
   📊 Evaluating swap: Klaus → Student X, Amy Smith → Justin
      • Amy Smith on Justin's team? ✓
      • Klaus on Student X's team? ✗  <-- THIS IS THE BLOCKER!
   
   🔎 DEEP ANALYSIS: Where are Justin's team members?
      • Amy Smith → Student X (unlocked)
         ✗ No available replacements on Student X's team
      • Bob Jones → Student Y (LOCKED)  <-- CAN'T SWAP LOCKED
      • Carol White → Student Z (unlocked)
         ✓ Could be replaced by: Dave Lee
   ```

## Action Items Based on Diagnostics

### If team members are LOCKED:
- **Solution**: Unlock the assignment manually, then re-run auto-schedule

### If team members are with PAIRED students:
- **Solution**: Consider unlocking/reassigning one of the paired students manually

### If available staff not on right teams:
- **Solution**: 
  1. Use "Quick Add Staff (Today Only)" feature to temporarily add available staff to needed teams
  2. OR update permanent team assignments in SharePoint

### If "already worked together today":
- **Solution**: This is a valid constraint - staff can't work with same student twice per day
- **Workaround**: Manually assign a different staff member who hasn't worked together

### If staff are trainees:
- **Solution**: Trainees can only be assigned via trainee dropdown, not as primary staff

## Files Modified
- `src/services/AutoAssignmentEngine.js` (lines ~2048-2265)

## Testing
To test the enhanced diagnostics:
1. Create a scenario with an unassigned student
2. Run Auto-Schedule
3. Check console for detailed swap evaluation logs
4. Follow the diagnostic suggestions to resolve the gap

## Date Enhanced
November 4, 2025
