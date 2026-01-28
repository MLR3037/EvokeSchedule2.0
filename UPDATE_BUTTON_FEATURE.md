# Update Button Feature - Live Schedule Popup

## Overview
Added a manual "🔄 Update Schedule" button with timestamp display in the popup window, allowing users to refresh the schedule data without closing/reopening the window.

## Features

### 1. Update Button
- Located in the header next to the filter controls
- Shows "🔄 Update Schedule" text
- Blue button with hover effect
- Fetches latest data from the main app window

### 2. Last Updated Timestamp
- Displays below the title: "Last updated: [time]"
- Updates automatically when:
  - Button is clicked
  - Auto-update triggers (editable field changes)
  - Popup is first opened
- Shows time in local format (e.g., "3:45:23 PM")

## How It Works

### User Flow
1. User opens Live Schedule popup window
2. User works on Schedule tab, making assignments
3. User switches to Live View tab
4. **User clicks "🔄 Update Schedule" button in popup**
5. Popup fetches fresh data from main window
6. Table updates with new assignments
7. Timestamp updates to current time
8. Green "🔄 Schedule Updated" indicator briefly appears

### Technical Flow
1. Popup button calls `requestUpdateFromParent()`
2. Function accesses `window.opener` (the main app window)
3. Calls `window.opener.updateLiveSchedulePopup()`
4. Main window's LiveScheduleView component sends current `scheduleData` to popup
5. Popup's `updateScheduleData()` function:
   - Updates the internal state
   - Updates the timestamp display
   - Calls `renderTable()` to rebuild the display
   - Shows update indicator

## Code Structure

### Popup Window (Inside document.write)

**HTML:**
```html
<div class="header">
  <div>
    <h1>Daily Schedule - 11/19/2025</h1>
    <div class="last-update" id="lastUpdate">Last updated: 3:45:23 PM</div>
  </div>
  <div class="filters">
    <button class="update-button" onclick="requestUpdateFromParent()">
      🔄 Update Schedule
    </button>
    <!-- Filter/sort controls -->
  </div>
</div>
```

**JavaScript:**
```javascript
function requestUpdateFromParent() {
  if (window.opener && !window.opener.closed) {
    if (window.opener.updateLiveSchedulePopup) {
      window.opener.updateLiveSchedulePopup();
    }
  } else {
    alert('Main window is closed. Please reopen from main app.');
  }
}
```

### Main Window (LiveScheduleView.js)

**Expose update function:**
```javascript
useEffect(() => {
  window.updateLiveSchedulePopup = () => {
    if (popupWindow && !popupWindow.closed && popupWindow.updateScheduleData) {
      console.log('🔄 Popup requested update via button');
      popupWindow.updateScheduleData(scheduleData, programFilter, sortBy);
    }
  };

  return () => {
    delete window.updateLiveSchedulePopup;
  };
}, [popupWindow, scheduleData, programFilter, sortBy]);
```

## Benefits

### Before (Manual Refresh):
1. User makes changes on Schedule tab
2. User goes to Live View tab
3. User clicks "Open in New Window" button
4. Popup focuses and updates
5. **Problem:** Extra click, loses focus on popup

### After (Update Button):
1. User makes changes on Schedule tab
2. User goes to Live View tab (popup stays focused on other monitor)
3. **User clicks "🔄 Update Schedule" in popup itself**
4. Popup updates without changing focus
5. **Benefit:** One click, stay focused on popup, cleaner workflow

## CSS Styling

```css
.update-button {
  background: #2563eb;        /* Blue */
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.update-button:hover {
  background: #1d4ed8;        /* Darker blue */
}

.update-button:active {
  transform: scale(0.98);     /* Slight press effect */
}

.last-update {
  font-size: 12px;
  color: #6b7280;             /* Gray */
  font-style: italic;
}
```

## Error Handling

### If Main Window is Closed:
```
Alert: "Main window is closed. Please reopen this from the main app."
```

### If Update Function Not Available:
```
Alert: "Please click 'Open in New Window' from the main app to refresh."
Console: "⚠️ Parent window does not have updateLiveSchedulePopup function"
```

### If Connection Error:
```
Alert: "Unable to connect to main window. Please click 'Open in New Window' to refresh."
Console: "❌ Error requesting update from parent: [error details]"
```

## Files Modified
- `src/components/LiveScheduleView.js`
  - Lines 293-334: Added CSS for update button and timestamp
  - Lines 450-457: Added Update button and timestamp to header HTML
  - Lines 488-495: Update timestamp in `updateScheduleData()`
  - Lines 523-550: Added `requestUpdateFromParent()` function
  - Lines 221-233: Exposed `window.updateLiveSchedulePopup()` function

## Testing
1. Open Live Schedule popup
2. Go to Schedule tab in main app
3. Assign a staff member to a student
4. Switch to Live View tab in main app
5. In popup window, click "🔄 Update Schedule"
6. Verify:
   - Schedule updates with new assignment
   - Timestamp updates to current time
   - Green update indicator briefly appears
   - Console shows: `🔄 Popup requested update via button`

## Future Enhancements
- Add auto-refresh interval (e.g., every 30 seconds)
- Add keyboard shortcut (e.g., F5 or Ctrl+R)
- Add connection status indicator
- Add "refresh in progress" loading state
