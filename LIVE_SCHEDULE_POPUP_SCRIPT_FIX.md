# Live Schedule Popup Fix - November 19, 2025

## Issues Fixed

### 1. Syntax Error: "Identifier 'allRows' has already been declared"
**Problem**: When the popup window was opened, the inline JavaScript was being re-executed, trying to redeclare variables and functions.

**Solution**: 
- Wrapped function definitions in `if (!window.functionName)` checks
- Changed `window.scheduleState = {}` to conditional initialization
- This prevents redeclaration errors if the window is reused

```javascript
// Before
window.scheduleState = {
  allRows: [...],
  currentFilter: 'All',
  currentSort: 'name'
};

// After
if (!window.scheduleState) {
  window.scheduleState = {};
}
window.scheduleState.allRows = [...];
window.scheduleState.currentFilter = 'All';
window.scheduleState.currentSort = 'name';
```

### 2. Popup Not Updating with Live Changes
**Problem**: The `updateScheduleData()` function exists, but wasn't being called properly due to script errors preventing execution.

**Solution**: Fixed the redeclaration errors (issue #1), which allows the update functions to work properly.

### 3. ABSENT Text Not Red in Popup
**Problem**: The CSS class `.absent-text` was defined correctly with `color: #dc2626`, but wasn't being applied due to script execution failures.

**Solution**: With the script errors fixed, the classes now apply properly:
```javascript
const amStaffClass = row.amStaff === 'ABSENT' ? 'absent-text' : (row.amStaff === 'OUT' ? 'out-text' : '');
// Applied to: <td class="read-only ${amStaffClass}">${row.amStaff}</td>
```

### 4. Popup Window Management
**Problem**: Opening the popup multiple times could create duplicate windows or cause state issues.

**Solution**: Added proper window cleanup:
```javascript
// Close any existing popup with same name before creating new one
const existingWindow = window.open('', 'LiveSchedule');
if (existingWindow && !existingWindow.closed) {
  existingWindow.close();
}
```

## Code Changes

### src/components/LiveScheduleView.js

**Function Definition Guards**:
```javascript
// Wrap all window function definitions in existence checks
if (!window.updateScheduleData) {
  window.updateScheduleData = function(newRows, newFilter, newSort) {
    // ... function body
  };
}

if (!window.updateEditableField) {
  window.updateEditableField = function(rowId, field, value) {
    // ... function body
  };
}
```

**State Initialization**:
```javascript
// Conditional state object creation
if (!window.scheduleState) {
  window.scheduleState = {};
}
// Always update the data
window.scheduleState.allRows = ${JSON.stringify(scheduleData)};
window.scheduleState.currentFilter = '${programFilter}';
window.scheduleState.currentSort = '${sortBy}';
```

**Window Cleanup**:
```javascript
const openInNewWindow = () => {
  // Check if popup already exists and is open
  if (popupWindow && !popupWindow.closed) {
    popupWindow.focus();
    return;
  }
  
  // Close any existing popup with same name
  const existingWindow = window.open('', 'LiveSchedule');
  if (existingWindow && !existingWindow.closed) {
    existingWindow.close();
  }
  
  // Create new window...
};
```

## Testing Checklist

✅ **Open Popup**: Click "Open in New Window" - should open without console errors
✅ **Live Updates**: Change staff in main app - popup should update automatically
✅ **ABSENT Styling**: Students marked ABSENT should show in red text
✅ **Gray Rows**: Fully absent students should have gray background
✅ **Editable Fields**: Times and lunch coverage should sync to popup
✅ **Multiple Opens**: Closing and reopening popup should work without errors
✅ **Focus Existing**: Clicking "Open in New Window" when already open should focus it

## Console Output

**Before Fix**:
```
❌ Uncaught SyntaxError: Failed to execute 'write' on 'Document': Identifier 'allRows' has already been declared
❌ Uncaught SyntaxError: Failed to execute 'write' on 'Document': Identifier 'allRows' has already been declared
```

**After Fix**:
```
ℹ️ Live Schedule: Received update from parent window
(Clean console - no errors!)
```

## Related Files
- `src/components/LiveScheduleView.js` - Main component with popup logic
- `LIVE_SCHEDULE_POPUP_FIX.md` - Previous popup fix documentation
- `LIVE_SCHEDULE_STYLING_UPDATE.md` - Styling improvements
