# Trainee Assignment Feature

## October 20, 2025 - Implementation Complete

### Overview
Added a comprehensive trainee assignment system that allows schedulers to manually assign staff who are in training to specific sessions WITHOUT involving them in auto-assignment.

---

## Key Features

### 1. **Removed Green Certified Badge** ✅
- Removed the green CheckCircle icon from the Training tab
- Certified status no longer shows a visual indicator (cleaner UI)
- Only training-in-progress statuses show icons (trainer ⭐, staff overlap 🎓, BCBA overlap 🎓)

### 2. **Trainee Dropdown in Schedule** 🎓
- Added a **second dropdown** below the main staff assignment dropdown
- Located in each session box (AM/PM) for every student
- Orange-tinted border to distinguish from regular staff assignment
- Label: "Trainee (optional)..."

### 3. **Smart Filtering**
- Trainee dropdown **ONLY shows staff with training statuses**:
  - Staff Overlap (🔴)
  - BCBA Overlap (🟡)
- Regular staff (Solo/Certified/Trainer) do NOT appear in trainee dropdown
- Only shows available team members (not already assigned)

### 4. **Auto-Assign Protection** 🛡️
- Trainees assigned manually are **marked as busy** for that session
- Auto-assignment engine will NOT pull them into other sessions
- Prevents scheduling conflicts automatically

### 5. **Training Icons in Schedule Display** ⭐🎓
- Training status icons now appear **next to staff names** in schedule assignments
- Visual indicators:
  - ⭐ Yellow star = Trainer
  - 🎓 Red graduation cap = Needs Staff Overlap
  - 🎓 Yellow graduation cap = Needs BCBA Overlap
- Shows in both:
  - Schedule grid assignment cards
  - Full Team column in Schedule Table View

---

## Technical Implementation

### Data Structure

#### Schedule Class (`src/types/index.js`)
```javascript
class Schedule {
  constructor({
    date,
    assignments = [],           // Regular assignments
    traineeAssignments = [],   // NEW: Trainee assignments (separate)
    lockedAssignments = new Set(),
    isFinalized = false
  })
}
```

#### New Methods:
- `addTraineeAssignment(traineeAssignment)` - Add a trainee to a session
- `removeTraineeAssignment(studentId, session)` - Remove trainee assignment
- `getTraineeAssignment(studentId, session)` - Get current trainee for student/session
- `isStaffAvailable(staffId, session, program)` - Updated to check trainee assignments

### Updated `isStaffAvailable()` Logic
```javascript
isStaffAvailable(staffId, session, program) {
  // Check regular assignments
  const isInRegularAssignment = this.assignments.filter(a => a.session === session)
    .some(a => a.staffId === staffId);
  
  // Check trainee assignments  
  const isInTraineeAssignment = this.traineeAssignments.filter(a => a.session === session)
    .some(a => a.staffId === staffId);
  
  return !isInRegularAssignment && !isInTraineeAssignment;
}
```

### UI Components

#### Trainee Dropdown (`renderTraineeDropdown`)
```javascript
- Located in: src/components/SchedulingComponents.js
- Filters team members by training status
- Orange-tinted background (bg-orange-50 border-orange-300)
- Shows 🎓 icon prefix for trainees in dropdown
- Remove button with unlock icon
- Help text: "Trainee assignment (won't be auto-assigned elsewhere)"
```

#### Assignment Display (`AssignmentCard`)
```javascript
- Shows training status icons BEFORE staff name
- Checks student.getStaffTrainingStatus(staffId)
- Renders appropriate icon based on status
```

### SharePoint Integration

#### ScheduleHistory List
Added new column for trainee assignments:
- **Column**: `TraineeAssignments`
- **Type**: Multiple lines of text (JSON)
- **Format**: Array of trainee assignment objects
```json
[
  {
    "staffId": 23,
    "studentId": 45,
    "session": "AM",
    "program": "Primary",
    "isTrainee": true
  }
]
```

#### Save/Load Methods
- `saveSchedule()` - Stringifies traineeAssignments to JSON
- `loadSchedule()` - Parses traineeAssignments from JSON

---

## User Workflow

### Assigning a Trainee

1. **Navigate to Schedule tab**
2. **Find the student** you want to assign a trainee to
3. **In the AM or PM column**, below the main staff dropdown, you'll see a second dropdown labeled "Trainee (optional)..."
4. **Click the trainee dropdown**
   - Only staff marked as "Staff Overlap" or "BCBA Overlap" in the Training tab will appear
   - Shows their name, role, and a 🎓 icon
5. **Select the trainee** from the dropdown
6. **The trainee is now assigned** and won't be auto-assigned elsewhere during that session

### Viewing Training Status on Schedule

- **Schedule Table View**: Look in the "Full Team" column
  - Icons appear BEFORE staff names:
    - ⭐ = Trainer for this student
    - 🎓 (red) = Needs staff overlap
    - 🎓 (yellow) = Needs BCBA overlap

- **Schedule Grid View**: In assignment cards
  - Training icons appear next to staff names
  - Shows the training relationship for that specific student

### Removing a Trainee

1. **Find the trainee assignment** in the schedule
2. **Click the unlock icon** (🔓) next to the trainee dropdown
3. **Trainee is removed** and becomes available for other assignments

---

## Benefits

✅ **Protected Training Sessions**: Trainees can't be accidentally auto-assigned during training sessions  
✅ **Clear Visual Indicators**: Icons show who's training and who's a trainer at a glance  
✅ **Filtered Lists**: Only relevant staff appear in trainee dropdown (no clutter)  
✅ **Separate Tracking**: Trainee assignments don't interfere with regular assignments  
✅ **Persistent Data**: Trainee assignments save to SharePoint automatically  
✅ **No Auto-Assign Impact**: Zero changes to auto-assignment engine logic  

---

## Files Modified

### Core Logic
- ✅ `src/types/index.js` - Schedule class with trainee assignments
- ✅ `src/components/SchedulingComponents.js` - Trainee dropdown and visual indicators
- ✅ `src/services/SharePointService.js` - Save/load trainee assignments
- ✅ `src/components/TrainingManagement.js` - Removed certified icon

### Build Status
- ✅ Compiles successfully
- ✅ Bundle size: +401 B (minimal increase)
- ✅ No errors, only minor linting warnings

---

## SharePoint Setup Required

### New Column in ScheduleHistory List

**Column Name**: `TraineeAssignments`  
**Type**: Multiple lines of text  
**Format**: Plain text  
**Required**: No  
**Default**: `[]`

**Purpose**: Stores JSON array of trainee assignments for each schedule

---

## Testing Checklist

### Basic Functionality
- [ ] Trainee dropdown appears below staff dropdown
- [ ] Only staff with "Staff Overlap" or "BCBA Overlap" status appear
- [ ] Selecting a trainee removes them from availability
- [ ] Auto-assign doesn't pull assigned trainees
- [ ] Remove button clears trainee assignment

### Visual Indicators
- [ ] Training icons show in Full Team column (Schedule Table View)
- [ ] Training icons show in assignment cards (Schedule Grid View)
- [ ] ⭐ for trainers, 🎓 (red) for staff overlap, 🎓 (yellow) for BCBA overlap

### Persistence
- [ ] Trainee assignments save when changed
- [ ] Trainee assignments persist after page refresh
- [ ] Training status icons persist after page refresh

---

## Future Enhancements (Optional)

- [ ] Add trainee count to statistics dashboard
- [ ] Add notification when trainees complete training
- [ ] Add training hours tracking
- [ ] Add automatic status progression (Staff → BCBA → Certified)
- [ ] Add training session notes/feedback field

---

## Support

If trainee assignments aren't working:

1. **Check SharePoint column exists**: `TraineeAssignments` in ScheduleHistory list
2. **Check browser console** for error messages
3. **Verify training status** is set correctly in Training tab
4. **Refresh page** to reload data from SharePoint
5. **Check staff availability** - they may already be assigned elsewhere

