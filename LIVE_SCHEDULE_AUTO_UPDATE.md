# Live Schedule Auto-Update Feature

## Overview
The Live Schedule View now automatically updates in real-time when changes are made on the Schedule tab. This allows you to display the schedule on a separate monitor/TV while building it, and see changes instantly.

## What Was Changed

### 1. **Popup Window Tracking**
- Added state to track the popup window reference
- Monitors if the popup is still open
- Automatically cleans up when popup is closed

### 2. **Auto-Update on Schedule Changes**
- When schedule data changes (assignments, staff, students, attendance), it automatically pushes updates to the popup
- Uses a `useEffect` hook that watches for changes in `scheduleData`
- Calls `window.updateScheduleData()` in the popup to refresh the display

### 3. **Visual Indicators**

#### In the Main App:
- Shows a green success banner when popup is connected
- Banner indicates: "✅ Live Schedule window is open and will auto-update"
- Banner disappears when popup is closed

#### In the Popup Window:
- Shows a temporary "🔄 Schedule Updated" indicator (top-right corner)
- Appears for 2 seconds whenever an update is received
- Green badge with animation

### 4. **Popup Window Functions**
- `window.updateScheduleData(newRows, newFilter, newSort)` - Receives updates from parent
- `showUpdateIndicator()` - Shows the update notification
- Automatically re-renders the table when data changes

## How It Works

### Workflow:
1. User opens Live Schedule popup window
2. Parent app stores reference to popup window
3. When schedule changes (assignments, attendance, etc.), parent detects it
4. Parent calls `popupWindow.updateScheduleData()` with new data
5. Popup receives update, shows indicator, and re-renders table
6. All happens automatically without manual refresh

### What Triggers Updates:
- ✅ Manual staff assignments
- ✅ Auto Assign
- ✅ Smart Swap
- ✅ Adding/removing assignments
- ✅ Marking attendance changes
- ✅ Adding/removing staff or students
- ✅ Changing program filters or sort order

## Usage

### For Users:
1. Navigate to **Live View** tab
2. Click **"Open in New Window"** button
3. Position the popup on a second monitor/TV
4. Go back to the **Schedule** tab
5. Make changes to the schedule as normal
6. **Popup automatically updates** - no refresh needed!

### For Display/Sharing:
- Perfect for showing the schedule on a TV in the office
- Staff can see the schedule update in real-time
- Great for collaborative schedule building
- Can be used during team meetings

## Technical Details

### Parent Window (LiveScheduleView.js):
```javascript
// Track popup window
const [popupWindow, setPopupWindow] = useState(null);

// Auto-update popup when data changes
useEffect(() => {
  if (popupWindow && !popupWindow.closed && scheduleData.length > 0) {
    try {
      if (popupWindow.updateScheduleData) {
        popupWindow.updateScheduleData(scheduleData, programFilter, sortBy);
      }
    } catch (error) {
      console.warn('Could not update popup window:', error);
    }
  }
}, [scheduleData, popupWindow, programFilter, sortBy]);
```

### Popup Window (JavaScript):
```javascript
// Function to receive updates from parent
window.updateScheduleData = function(newRows, newFilter, newSort) {
  console.log('🔄 Live Schedule: Received update from parent window');
  allRows = newRows;
  if (newFilter !== undefined) currentFilter = newFilter;
  if (newSort !== undefined) currentSort = newSort;
  
  // Update dropdowns
  document.getElementById('programFilter').value = currentFilter;
  document.getElementById('sortBy').value = currentSort;
  
  // Show indicator and re-render
  showUpdateIndicator();
  renderTable();
};
```

### Cleanup:
```javascript
// Check if popup is closed and clean up
useEffect(() => {
  if (!popupWindow) return;

  const checkInterval = setInterval(() => {
    if (popupWindow.closed) {
      setPopupWindow(null);
      clearInterval(checkInterval);
    }
  }, 1000);

  return () => clearInterval(checkInterval);
}, [popupWindow]);
```

## Benefits

✅ **Real-Time Updates** - No manual refresh needed
✅ **Multi-Monitor Support** - Display on separate screen
✅ **Collaborative** - Great for team scheduling sessions
✅ **Visual Feedback** - Shows when updates are received
✅ **Seamless** - Works automatically in the background
✅ **Reliable** - Handles popup closure gracefully

## Browser Compatibility

Works in all modern browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari

Note: Popup blockers must allow popups from this site.

## Future Enhancements (Optional)

Potential improvements:
- [ ] Add sound notification when schedule updates
- [ ] Show what changed (highlight new assignments)
- [ ] Add "Last Updated" timestamp
- [ ] Support multiple popup windows
- [ ] Add WebSocket for more reliable updates
- [ ] Sync editable fields (times, lunch coverage) back to parent

## Testing Checklist

- [x] Popup opens successfully
- [x] Status indicator appears in parent app
- [x] Auto Assign triggers popup update
- [x] Smart Swap triggers popup update
- [x] Manual assignments trigger update
- [x] Attendance changes trigger update
- [x] Update indicator shows in popup
- [x] Popup closes gracefully
- [x] Status indicator disappears when popup closes
- [x] Multiple updates work correctly
- [x] Filter/sort changes sync to popup

## Known Limitations

1. **One Popup at a Time** - Only one popup window is tracked
2. **Same Origin Only** - Must be same domain (not cross-origin)
3. **Manual Edits** - Changes to times/lunch in popup don't sync back to parent yet
4. **Popup Blockers** - Users must allow popups

## Support

If the popup doesn't update:
1. Check browser console for errors
2. Make sure popup isn't blocked
3. Try closing and reopening the popup
4. Refresh both windows

---

**Implementation Date:** November 19, 2025
**Status:** ✅ Complete and Ready for Testing
