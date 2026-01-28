# Live Schedule Popup Auto-Update Behavior

## How Auto-Update Works

The Live Schedule popup window has **partial auto-update** capabilities:

### ✅ Updates Automatically:
1. **Editable field changes** - When you change times or lunch coverage ON THE LIVE VIEW TAB
2. **Schedule changes while viewing Live View** - If you're actively viewing the Live View tab when assignments change

### ⚠️ Requires Manual Refresh:
1. **Changes made on Schedule tab** - When you switch to Schedule tab, make assignments, then return to Live View
2. **Initial data load** - When you first open the popup

## Why Doesn't It Auto-Update From Schedule Tab?

When you're on the Schedule tab making assignments:
1. The Schedule tab updates and shows the change ✅
2. The Live View tab is not currently visible (you're on Schedule tab)
3. React may not fully re-render the Live View until you switch back to it
4. The popup auto-update useEffect depends on `scheduleData` changing
5. If you're not on the Live View tab when the change happens, the effect may not fire immediately

## Solution: Manual Refresh

**Click "Open in New Window" again** to refresh the popup with current data:

1. Go to Live View tab
2. Click "Open in New Window" button
3. The code will detect the popup is already open
4. It will update it with current `scheduleData` before focusing
5. Console shows: `✅ Popup already open, updating with current data`

This gives you **full control** over when to refresh the popup.

## For True Real-Time Updates

If you need the popup to update immediately when changes happen on Schedule tab, you would need:

### Option 1: Event-Based Updates
```javascript
// In App.js, create an event emitter
const scheduleUpdateEvent = new EventTarget();

// Fire event when schedule changes
scheduleUpdateEvent.dispatchEvent(new CustomEvent('scheduleUpdated', { 
  detail: { schedule: newSchedule } 
}));

// In LiveScheduleView, listen for events
useEffect(() => {
  const handler = (e) => {
    // Rebuild scheduleData from new schedule
  };
  scheduleUpdateEvent.addEventListener('scheduleUpdated', handler);
  return () => scheduleUpdateEvent.removeEventListener('scheduleUpdated', handler);
}, []);
```

### Option 2: Force Update via Key
```javascript
// In App.js, add a timestamp to schedule
const newSchedule = new Schedule({
  ...scheduleData,
  lastModified: Date.now()
});

// In LiveScheduleView useEffect dependencies
useEffect(() => {
  // Rebuild rows
}, [schedule, schedule.lastModified, ...]);
```

### Option 3: WebSocket/Polling
- Use WebSocket for true real-time updates across tabs
- Or poll SharePoint every few seconds for changes
- More complex, requires backend changes

## Current Workflow (Recommended)

1. **Work on Schedule tab** - Make all your assignments, swaps, etc.
2. **Switch to Live View tab** - See the updated schedule
3. **Click "Open in New Window"** - Refresh the popup
4. **Leave popup open** - Further changes ON LIVE VIEW TAB will auto-update

This gives you the best balance of performance and functionality.

## Debug Information

Check console logs to understand what's happening:

- `📊 Generated X schedule rows from Y assignments` - Live View rebuilt data
- `🔄 Auto-update effect triggered` - useEffect is checking if popup needs update
- `📤 Updating popup with X rows` - Popup is being updated
- `⏸️ Skipping popup update - scheduleData is empty` - Update skipped (waiting for data)
- `🔷 Opening Live Schedule popup, current scheduleData has X rows` - Opening/focusing popup
- `✅ Popup already open, updating with current data` - Refreshing existing popup

## Files
- `src/components/LiveScheduleView.js` - Popup management and auto-update logic
