# SharePoint List Renaming Guide

## Overview
This guide explains how to rename the SharePoint lists to match the updated code.

## List Name Changes

| Old Name | New Name |
|----------|----------|
| ABASchedules | ScheduleHistory |
| ABAAssignments | DailyAssignments |
| ABAAttendance | DailyAttendance |

## Steps to Rename Lists in SharePoint

### Method 1: Using SharePoint Web Interface

1. **Navigate to your SharePoint site:**
   - Go to: `https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators`

2. **For each list to rename:**

   **ABASchedules → ScheduleHistory:**
   - Click on the Settings gear icon (⚙️) in the top right
   - Select "Site contents"
   - Find "ABASchedules" in the list
   - Click the three dots (...) next to it
   - Select "Settings"
   - Under "General Settings", click "List name, description and navigation"
   - Change the Name from "ABASchedules" to "ScheduleHistory"
   - Click "Save"

   **ABAAssignments → DailyAssignments:**
   - Repeat the same steps above
   - Change the Name from "ABAAssignments" to "DailyAssignments"
   - Click "Save"

   **ABAAttendance → DailyAttendance:**
   - If this list exists, repeat the same steps
   - Change the Name from "ABAAttendance" to "DailyAttendance"
   - If this list doesn't exist yet, create it with the name "DailyAttendance"

### Method 2: Using PowerShell (Advanced)

```powershell
# Connect to SharePoint Online
Connect-PnPOnline -Url "https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators" -Interactive

# Rename the lists
Set-PnPList -Identity "ABASchedules" -Title "ScheduleHistory"
Set-PnPList -Identity "ABAAssignments" -Title "DailyAssignments"
Set-PnPList -Identity "ABAAttendance" -Title "DailyAttendance"
```

## DailyAttendance List Setup

If you haven't created the DailyAttendance list yet, create it with these columns:

| Column Name | Type | Required | Notes |
|-------------|------|----------|-------|
| Title | Single line of text | Yes | Default column |
| AttendanceDate | Date | Yes | Date only (no time) |
| PersonType | Single line of text | Yes | "Staff" or "Student" |
| PersonID | Number | Yes | The person's ID |
| PersonName | Single line of text | Yes | The person's name |
| AbsentAM | Yes/No | No | Default: No |
| AbsentPM | Yes/No | No | Default: No |
| AbsentFullDay | Yes/No | No | Default: No |
| CreatedDate | Date and Time | No | Auto-populated |

## Verification

After renaming, verify the changes:

1. **Check the code is updated:**
   - ✅ `App.js` - scheduleListName: 'ScheduleHistory'
   - ✅ `SharePointService.js` - scheduleListName default: 'ScheduleHistory'
   - ✅ All API calls use 'DailyAssignments' instead of 'ABAAssignments'
   - ✅ All API calls use 'DailyAttendance' instead of 'ABAAttendance'
   - ✅ All metadata types updated (e.g., 'SP.Data.DailyAssignmentsListItem')

2. **Test the application:**
   - Load the schedule - should read from ScheduleHistory
   - Make a manual assignment - should save to DailyAssignments
   - Mark someone absent and change the date - should save to DailyAttendance

## Important Notes

⚠️ **Before renaming:**
- Back up your SharePoint lists (export to Excel)
- Inform team members about the name changes
- Update any documentation or external links

⚠️ **After renaming:**
- The list URLs will change (the internal name stays the same)
- Any bookmarks or saved links will need to be updated
- Power Automate flows or Power Apps using these lists will need to be updated

## Troubleshooting

### If you get "List not found" errors:

1. **Double-check the list names** in SharePoint match exactly:
   - ScheduleHistory (not Schedule History)
   - DailyAssignments (not Daily Assignments)
   - DailyAttendance (not Daily Attendance)

2. **Clear browser cache** and refresh the app

3. **Check the metadata type names:**
   - The internal name might be different from the display name
   - SharePoint auto-generates these based on the original list name
   - If you renamed an existing list, the metadata type might still use the old name

### If metadata type errors occur:

You may need to check the actual internal type name:
```javascript
// In SharePoint REST API, check the list's EntityTypeName
fetch('https://yoursite.sharepoint.com/_api/web/lists/getbytitle(\'DailyAssignments\')')
```

The EntityTypeName should match what's in the `__metadata: { type: '...' }` field in the code.

## Code Changes Made

All references to the old list names have been updated in:
- `src/App.js`
- `src/services/SharePointService.js`

The application now uses:
- **ScheduleHistory** for schedule metadata
- **DailyAssignments** for assignment records
- **DailyAttendance** for attendance history
