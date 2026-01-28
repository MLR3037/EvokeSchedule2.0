# Live Schedule Improvements - November 19, 2025

## Summary
Three major improvements to the Live Schedule feature to enhance usability and data persistence.

---

## 1. 🔄 Temp Staff Persistence in Saved Schedules

### Problem
Temporary staff assignments were stored only in localStorage and lost when loading a saved schedule from SharePoint. Users had to re-add temp staff every time they loaded a saved schedule.

### Solution
Added `IsTempStaff` boolean field to assignment storage in SharePoint's DailyAssignments list.

### Changes Made

#### Assignment Class (`src/types/index.js`)
Added new property to track temp staff:
```javascript
export class Assignment {
  constructor({
    // ... existing fields
    isTempStaff = false // NEW: Track if this is a temp staff assignment
  }) {
    // ... existing code
    this.isTempStaff = isTempStaff;
  }
}
```

#### SharePoint Service (`src/services/SharePointService.js`)

**Saving:**
```javascript
async saveAssignmentToHistory(assignment, scheduleId, scheduleDate) {
  const assignmentData = {
    // ... existing fields
    IsTempStaff: assignment.isTempStaff || false // NEW: Save temp staff flag
  };
  // ... save to SharePoint
}
```

**Loading:**
```javascript
async loadSchedule(date) {
  // ... load assignments from SharePoint
  const assignments = assignmentItems.map(item => {
    return new Assignment({
      // ... existing fields
      isTempStaff: item.IsTempStaff || false // NEW: Load temp staff flag
    });
  });
}
```

#### App.js
Updated `handleManualAssignment` to detect and mark temp staff:
```javascript
const handleManualAssignment = ({ staffId, studentId, session, program, bypassTeamCheck = false }) => {
  // Check if this is a temp staff assignment
  const isTempStaff = bypassTeamCheck || !student.teamIds.includes(staffId);
  
  const assignment = new Assignment({
    // ... existing fields
    isTempStaff: isTempStaff // Mark as temp staff if bypassed team check
  });
  
  if (isTempStaff) {
    console.log(`✅ Created TEMP STAFF assignment: ${staffMember.name} → ${student.name} ${session}`);
  }
  // ... rest of function
}
```

### SharePoint Setup Required

**Add column to DailyAssignments list:**
1. Go to SharePoint → Site Contents → DailyAssignments list
2. Click "Add column" → "Yes/No"
3. Name: `IsTempStaff`
4. Description: "Indicates if this is a temporary staff assignment"
5. Default value: No
6. Save

### How It Works Now

1. **Adding Temp Staff:**
   - User adds temp staff via "Quick Add Staff (Today Only)" button
   - Assignment is created with `isTempStaff = true`

2. **Saving Schedule:**
   - When user clicks "Save Schedule", all assignments are saved
   - Temp staff assignments include `IsTempStaff = true` flag

3. **Loading Schedule:**
   - When user clicks "Load Saved", assignments are loaded from SharePoint
   - Temp staff assignments have `isTempStaff = true` restored
   - Schedule shows temp staff exactly as they were saved

### Benefits
✅ Temp staff persist across schedule loads
✅ Historical schedules preserve temp staff information
✅ No need to re-add temp staff every time
✅ Clear distinction between regular and temp staff in saved data

---

## 2. 📡 Real-Time Editable Field Sync to Popup Window

### Problem
When users edited times or lunch coverage in the main Live Schedule view, the popup window didn't update until the schedule data changed (staff assignments). This created confusion as the popup appeared outdated.

### Solution
Added immediate sync of editable field changes to the popup window using `window.updateEditableField()` function.

### Changes Made

#### LiveScheduleView.js

**Enhanced handleFieldChange:**
```javascript
const handleFieldChange = (rowId, field, value) => {
  setEditableData(prev => {
    const updated = {
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: value
      }
    };
    
    // NEW: Immediately update popup window with the new editable data
    if (popupWindow && !popupWindow.closed && popupWindow.updateEditableField) {
      popupWindow.updateEditableField(rowId, field, value);
    }
    
    return updated;
  });
  // ... rest of function
};
```

**Added popup function:**
```javascript
// In popup window script
window.updateEditableField = function(rowId, field, value) {
  console.log('🔄 Live Schedule: Received field update:', rowId, field, value);
  
  // Find the input element and update its value
  const input = document.querySelector(`input[data-rowid="${rowId}"][data-field="${field}"]`);
  if (input) {
    input.value = value;
    
    // Also update the row data
    const row = allRows.find(r => r.id === rowId);
    if (row) {
      row[field] = value;
    }
  }
};
```

### How It Works Now

1. **User edits time/lunch in main view**
   - Types in input field (e.g., changes "8:45 AM" to "9:00 AM")
   - `handleFieldChange` is triggered

2. **Immediate sync to popup**
   - Function checks if popup is open
   - Calls `popupWindow.updateEditableField(rowId, field, value)`
   - Popup input field updates instantly

3. **Visual feedback**
   - No lag between main view and popup
   - Both windows stay in perfect sync

### Benefits
✅ Instant synchronization of time changes
✅ Instant synchronization of lunch coverage changes
✅ No need to refresh popup window
✅ Consistent user experience across windows

---

## 3. 🎨 Gray Out Absent Student Rows

### Problem
Absent students appeared the same as present students in the Live Schedule view, making it hard to quickly identify which students wouldn't be attending.

### Solution
Added visual styling to gray out and strike through rows for students who are absent in both sessions.

### Changes Made

#### Main App View (LiveScheduleView.js)

**Updated row rendering:**
```javascript
{scheduleData.map(row => {
  // Check if student is absent (both AM and PM absent = fully absent)
  const isAbsent = (row.amStaff === 'ABSENT' || row.amStaff === 'OUT') && 
                   (row.pmStaff === 'ABSENT' || row.pmStaff === 'OUT');
  
  return (
    <tr 
      key={row.id}
      className={`${
        isAbsent 
          ? 'bg-gray-200 opacity-60' 
          : row.isTrainee 
            ? 'bg-yellow-50 hover:bg-yellow-100' 
            : 'hover:bg-gray-50'
      }`}
    >
      <td className={`px-4 py-3 whitespace-nowrap text-sm ${
        isAbsent ? 'text-gray-500 line-through' : 'text-gray-900'
      }`}>
        {row.studentName}
      </td>
      {/* ... rest of row */}
    </tr>
  );
})}
```

#### Popup Window (LiveScheduleView.js)

**Added CSS styles:**
```css
.absent-row {
  background: #d1d5db;
  opacity: 0.6;
}
.absent-row td {
  color: #6b7280;
  text-decoration: line-through;
}
```

**Updated renderTable function:**
```javascript
filteredRows.forEach(row => {
  // Check if student is fully absent (both AM and PM)
  const isAbsent = (row.amStaff === 'ABSENT' || row.amStaff === 'OUT') && 
                   (row.pmStaff === 'ABSENT' || row.pmStaff === 'OUT');
  const rowClass = isAbsent ? 'absent-row' : (row.isTrainee ? 'trainee-row' : '');
  // ... rest of rendering
});
```

### Visual Effect

**Before:**
- All students looked the same
- Hard to distinguish absent students

**After:**
- **Fully absent students** (absent or out of session for both AM and PM):
  - Gray background (#d1d5db)
  - Reduced opacity (60%)
  - Text color: gray (#6b7280)
  - Student name: strike-through
  - All fields grayed out

- **Partially absent students** (only AM or PM):
  - Normal row appearance
  - Only the affected session shows "ABSENT" or "OUT" in red/orange

- **Trainee rows** (still visible):
  - Yellow background maintained
  - Not affected by absent styling

### Benefits
✅ **Quick visual scan** - Instantly see who's absent
✅ **Reduces scheduling errors** - Less likely to assign staff to absent students
✅ **Clear communication** - Display on TV shows absent students immediately
✅ **Consistent styling** - Works in both main view and popup window

### Examples

**Full Day Absent:**
```
[GRAY ROW - 60% OPACITY]
John Doe (crossed out) | ABSENT | --- | --- | --- | --- | ABSENT | --- | ---
```

**AM Only Absent:**
```
[NORMAL ROW]
Jane Smith | ABSENT (red) | --- | --- | --- | --- | Mary Jones | 12:35 PM | 3:00 PM
```

**Out of Session (Both):**
```
[GRAY ROW - 60% OPACITY]
Bob Wilson (crossed out) | OUT | --- | --- | --- | --- | OUT | --- | ---
```

---

## Testing Checklist

### Temp Staff Persistence
- [ ] Add temp staff to a student
- [ ] Save the schedule
- [ ] Clear the schedule (not saved)
- [ ] Load the saved schedule
- [ ] Verify temp staff appears in assignments
- [ ] Check console for "✅ Created TEMP STAFF assignment" messages

### Editable Field Sync
- [ ] Open Live Schedule popup
- [ ] Edit a time field in main view
- [ ] Verify popup updates immediately
- [ ] Edit lunch coverage in main view
- [ ] Verify popup updates immediately
- [ ] Close and reopen popup
- [ ] Verify all edits persist

### Absent Student Styling
- [ ] Mark a student absent for full day
- [ ] Check main Live Schedule view - row should be gray
- [ ] Open popup - row should be gray
- [ ] Mark student absent for AM only
- [ ] Check row is NOT grayed out (only AM shows red ABSENT)
- [ ] Mark student absent for PM only
- [ ] Check row is NOT grayed out (only PM shows red ABSENT)
- [ ] Mark student out of session for both AM and PM
- [ ] Check row is grayed out
- [ ] Check trainee rows still show yellow background

---

## Files Modified

1. `src/types/index.js` - Added `isTempStaff` to Assignment class
2. `src/services/SharePointService.js` - Save/load temp staff flag
3. `src/App.js` - Detect and mark temp staff in handleManualAssignment
4. `src/components/LiveScheduleView.js` - All three improvements

---

## Known Limitations

### Temp Staff Persistence
1. Temp staff assignments are saved, but if the staff member no longer exists in the Staff list, assignment will show but may appear as "Unknown Staff"
2. Temp staff training status is not saved (always defaults to "solo")
3. Session-specific temp staff (AM only or PM only) is tracked in localStorage but not in SharePoint assignment

### Editable Field Sync
1. Sync only works parent → popup (not bidirectional)
2. If popup is closed and reopened, editable fields reset to defaults
3. Editable fields (times, lunch) are NOT saved to SharePoint yet

### Absent Styling
1. Only applies to students absent for BOTH sessions
2. Partially absent students (AM only or PM only) don't get gray styling
3. "Out of session" is treated same as "absent" for styling purposes

---

## Future Enhancements

### Temp Staff
- [ ] Save session-specific temp staff info to SharePoint
- [ ] Allow editing temp staff sessions after adding
- [ ] Show temp staff indicator in schedule grid
- [ ] Report on temp staff usage patterns

### Field Sync
- [ ] Make editable fields bidirectional (popup → parent)
- [ ] Save times and lunch coverage to SharePoint
- [ ] Add visual indicator in popup when fields are synced

### Styling
- [ ] Add different styling for partial absence (AM only / PM only)
- [ ] Add hover tooltip explaining why row is grayed
- [ ] Add legend showing color meanings
- [ ] Make gray-out optional via user preference

---

**Implementation Date:** November 19, 2025  
**Status:** ✅ Complete and Ready for Testing
