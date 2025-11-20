# Live Schedule Popup Window Fix - November 19, 2025

## Issues Fixed

### 1. **JavaScript Redeclaration Error**
**Problem**: When opening the popup window, got error:
```
Uncaught SyntaxError: Failed to execute 'write' on 'Document': identifier 'allRows' has already been declared
```

**Root Cause**: The popup window's JavaScript was declaring variables (`allRows`, `currentFilter`, `currentSort`) at the top level. If the window was reused or updated, these variables would be redeclared, causing a syntax error.

**Solution**: 
- Wrapped state variables in `window.scheduleState` object
- Changed all references from local variables to `window.scheduleState.allRows`, `window.scheduleState.currentFilter`, etc.
- Added `newWindow.document.open()` to clear existing content before writing
- Added `newWindow.document.close()` to finalize the document
- Added check to prevent reopening if window already exists (just focus it instead)

### 2. **Staff Changes Not Syncing to Popup**
**Problem**: When changing staff assignments in the main app, the popup window didn't update.

**Status**: Should now work properly with the fixed JavaScript state management. The `updateScheduleData` function now correctly updates `window.scheduleState.allRows` and calls `renderTable()` to refresh the display.

### 3. **Absent Rows Not Grayed Out in Popup**
**Problem**: Students marked as absent weren't showing with gray background in popup.

**Status**: The logic was already correct, but wasn't executing due to the JavaScript errors. Now that the errors are fixed, absent rows should display properly with:
- Gray background (`background: #d1d5db; opacity: 0.6;`)
- Strikethrough text
- Detection logic: `(row.amStaff === 'ABSENT' || row.amStaff === 'OUT') && (row.pmStaff === 'ABSENT' || row.pmStaff === 'OUT')`

## Code Changes

### `src/components/LiveScheduleView.js`

**Opening Popup Window**:
```javascript
const openInNewWindow = () => {
  // Check if popup already exists and is open
  if (popupWindow && !popupWindow.closed) {
    popupWindow.focus();
    return;
  }
  
  const newWindow = window.open('', 'LiveSchedule', 'width=1400,height=800,scrollbars=yes');
  if (newWindow) {
    // Clear any existing content
    newWindow.document.open();
    
    // Store reference to popup window
    setPopupWindow(newWindow);
    
    newWindow.document.write(`...`);
    
    // Close the document to finalize it
    newWindow.document.close();
    
    // Make handleFieldChange available to popup
    newWindow.opener.handlePopupFieldChange = handleFieldChange;
  }
};
```

**State Management in Popup**:
```javascript
// Initialize state in window scope
(function() {
  window.scheduleState = {
    allRows: [...],
    currentFilter: 'All',
    currentSort: 'name'
  };
})();

// All functions now reference window.scheduleState
window.updateScheduleData = function(newRows, newFilter, newSort) {
  window.scheduleState.allRows = newRows;
  if (newFilter !== undefined) window.scheduleState.currentFilter = newFilter;
  if (newSort !== undefined) window.scheduleState.currentSort = newSort;
  // ...
};
```

**Enhanced Logging**:
- Main window logs when updating popup: `🔄 Main window: Updating popup with new schedule data`
- Popup logs when receiving updates: `🔄 Live Schedule Popup: Received schedule update from parent window`
- Popup logs rendering details: `Popup rendering row: [student], AM: [staff], PM: [staff], isAbsent: [bool]`

## Testing

1. **Open popup window**: Click "Open in New Window" button
   - Should open without errors
   - Should display schedule with correct styling

2. **Change staff assignment**: Modify AM or PM staff in main app
   - Watch console in both windows
   - Popup should update immediately with new staff
   - Green "🔄 Schedule Updated" indicator should appear briefly

3. **Edit times/lunch**: Change editable fields in main app
   - Should sync to popup immediately
   - No page refresh needed

4. **Absent students**: Mark a student as absent
   - Row should show gray background in both main view and popup
   - Text should have strikethrough effect
   - Staff should show "ABSENT" or "OUT" in red/orange

5. **Close and reopen**: Close popup and open again
   - Should work without errors
   - Should display current schedule state

## Console Commands for Debugging

Open browser console (F12) in **both** the main window and popup window:

**Main Window**:
```javascript
// Check if popup reference exists
console.log('Popup window:', popupWindow);

// Check if popup has update function
console.log('Has update function:', popupWindow?.updateScheduleData);
```

**Popup Window**:
```javascript
// Check state
console.log('Schedule state:', window.scheduleState);

// Manually update a field
window.updateEditableField('student-id-0', 'amStart', '9:00 AM');
```

## Related Files
- `src/components/LiveScheduleView.js` - Main component with popup logic
- `LIVE_SCHEDULE_AUTO_UPDATE.md` - Initial auto-update feature
- `LIVE_SCHEDULE_IMPROVEMENTS_NOV19.md` - Previous improvements (temp staff, editable fields, absent styling)
