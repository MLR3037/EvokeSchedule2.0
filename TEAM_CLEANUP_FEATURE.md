# Team Cleanup Feature

## Overview
Automatically removes deleted staff members from student team assignments in SharePoint.

## Problem
When a staff member is deleted from the Staff list, they remain in student team assignments (People Picker field). This causes:
- Deleted staff appearing in the "Full Team" column
- Confusion about actual team membership
- Stale data in SharePoint

## Solution
Two-part fix:

### 1. Display Filter (Immediate)
The Teams page now automatically filters out deleted staff when displaying teams:
- Only shows staff who currently exist in the active Staff list
- Deleted staff are skipped with console logging
- No manual action required - happens automatically

### 2. Data Cleanup (On-Demand)
A new "Clean Up Teams" button permanently removes deleted staff from SharePoint:

## How to Use

### Access the Cleanup Tool
1. Navigate to the **Teams** tab
2. Look for the **"Clean Up Teams"** button in the top-right corner (white button next to the header)

### Run the Cleanup
1. Click **"Clean Up Teams"**
2. Confirm the action in the dialog:
   - Warning: "This will remove deleted staff members from all student teams. This action cannot be undone. Continue?"
3. The system will:
   - Scan all student teams
   - Identify deleted staff (not in active Staff list)
   - Remove them from team assignments
   - Save updated teams to SharePoint
   - Reload data to reflect changes
4. See results in success message:
   - Example: "Successfully cleaned up 5 deleted staff member(s) from 12 student team(s)!"

## What Gets Cleaned

The cleanup process removes staff members who:
- ✅ No longer exist in the Staff list
- ✅ Have been marked as inactive/deleted
- ✅ Can't be matched by email or ID

The cleanup process keeps staff members who:
- ✅ Are active in the Staff list
- ✅ Can be matched by email (most reliable)
- ✅ Can be matched by ID

## Matching Logic

The system uses a multi-step verification to avoid false positives:

1. **Email Match** (Primary) - Most reliable identifier
2. **ID Match** (Secondary) - Backup if email unavailable
3. **Not Found** = Deleted staff, will be removed

## Console Logging

Monitor the cleanup process in browser console (F12):

```
🧹 Starting cleanup of deleted staff from student teams...
  🗑️ Removing deleted staff "John Doe" from Student A's team
  ✅ Cleaned 1 deleted staff from Student A's team
  🗑️ Removing deleted staff "Jane Smith" from Student B's team
  ✅ Cleaned 1 deleted staff from Student B's team
💾 Saving 2 students with cleaned teams...
✅ Cleanup complete: 2 deleted staff removed from 2 student teams
```

## Safety Features

### Confirmation Dialog
- Prevents accidental cleanup
- Warns that action cannot be undone

### No Changes Alert
- If no deleted staff are found, shows: "No deleted staff found in student teams. All teams are clean!"
- No unnecessary SharePoint writes

### Error Handling
- Catches and displays any errors
- Shows specific error message
- Doesn't corrupt existing data on failure

## Technical Details

### App.js
**New Handler**: `handleCleanupDeletedStaff()`
- Iterates through all students
- Filters team members against active staff list
- Creates updated Student objects
- Saves to SharePoint
- Reloads data

### TeamManagement.js
**New UI**: "Clean Up Teams" button
- Positioned in header next to title
- Calls `onCleanupDeletedStaff` handler
- Trash icon for visual clarity

### SchedulingComponents.js
**Display Filter**: `getStudentTeam()`
- Returns `null` for deleted staff
- Filters them from the team array
- Logs skipped staff to console

## When to Use

### Regular Maintenance
Run cleanup periodically to keep data clean:
- After deleting staff members
- At the start of each semester
- During annual data audits

### Before Important Operations
Run cleanup before:
- Exporting data
- Running reports
- Making bulk team changes

### Troubleshooting
Run cleanup when you notice:
- Deleted staff in team displays
- Team counts don't match expectations
- Stale data in SharePoint

## Best Practices

1. **Backup First**: Always have a SharePoint backup before running cleanup
2. **Off-Hours**: Run during low-usage times if possible
3. **Review Results**: Check the success message and console logs
4. **Verify**: Spot-check a few student teams after cleanup
5. **Document**: Note when cleanup was run and results

## Limitations

- **Cannot be undone**: Once deleted, staff are permanently removed from teams
- **No individual selection**: Cleans all students at once (not per-student)
- **Requires permissions**: User must have edit rights on Student list

## Future Enhancements (Potential)

- Preview mode: Show what will be cleaned before doing it
- Per-student cleanup: Clean individual student teams
- Scheduled cleanup: Automatic periodic cleanup
- Backup/restore: Save team state before cleanup
- Audit log: Track what was cleaned and when
