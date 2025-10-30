# SharePoint Save Functionality Fix

## Overview
This update fixes the SharePoint save functionality to:
1. **UPDATE existing records** instead of creating duplicates when saving schedules for the same date
2. **Save ALL attendance data** (present and absent) to DailyAttendance list
3. **Add a Status column** to track Present/Absent/Out of Session status clearly

## Changes Made

### 1. Schedule Save - Update Instead of Insert

**Problem:** When saving a schedule for the same date multiple times, it created duplicate records in ScheduleHistory and DailyAssignments.

**Solution:** 
- Check if a schedule record already exists for the date before saving
- If exists, UPDATE the existing record instead of creating a new one
- Delete old assignments and save new ones to keep data consistent

**Code Changes in `SharePointService.js`:**

```javascript
// Check if schedule already exists for this date
const existingScheduleUrl = `${this.siteUrl}/_api/web/lists/getbytitle('ScheduleHistory')/items?` +
  `$filter=ScheduleDate eq '${schedule.date}'&` +
  `$orderby=Created desc&` +
  `$top=1`;

// If exists, UPDATE using MERGE method
if (isUpdate) {
  const updateResponse = await fetch(
    `${this.siteUrl}/_api/web/lists/getbytitle('ScheduleHistory')/items(${scheduleId})`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'X-HTTP-Method': 'MERGE',
        'If-Match': '*'
      },
      body: JSON.stringify(scheduleData)
    }
  );
}

// Delete old assignments before saving new ones
if (isUpdate) {
  await this.deleteAssignmentsForSchedule(scheduleId);
}
```

### 2. DailyAttendance - Save All Attendance Data

**Problem:** DailyAttendance list only saved records for absent people, not those who were present.

**Solution:**
- Save attendance records for ALL active staff and students
- Add a `Status` column to clearly indicate: Present, Absent AM/PM/Full Day, Out Session AM/PM/Full Day
- Automatically delete and recreate records when saving for the same date

**New Method: `saveAttendanceForDate(date)`**

This method:
1. Deletes existing attendance records for the date
2. Loads current staff and students
3. Creates attendance records for ALL active people
4. Determines status based on attendance flags
5. Saves all records to DailyAttendance

### 3. New SharePoint Columns Required

You need to add these columns to the **DailyAttendance** SharePoint list:

| Column Name | Type | Required | Notes |
|-------------|------|----------|-------|
| Status | Single line of text | No | Shows overall status (e.g., "Present", "Absent AM", "Out Session Full Day") |
| OutOfSessionAM | Yes/No | No | Default: No |
| OutOfSessionPM | Yes/No | No | Default: No |
| OutOfSessionFullDay | Yes/No | No | Default: No |

**Steps to Add Columns:**

1. Go to your SharePoint site
2. Navigate to **DailyAttendance** list
3. Click **Settings** → **List settings**
4. Under **Columns**, click **Create column**
5. Add each column with the specifications above

### 4. Metadata Type Name Fix

**Changed:** `SP.Data.ABASchedulesListItem` → `SP.Data.ScheduleHistoryListItem`
**Changed:** `SP.Data.ABAAssignmentsListItem` → `SP.Data.DailyAssignmentsListItem`

These names must match the SharePoint list's internal EntityTypeName.

## Status Field Values

The `Status` column can have these values:

### For Present:
- `"Present"` - Person is available for both AM and PM

### For Absent:
- `"Absent AM"` - Absent only in AM
- `"Absent PM"` - Absent only in PM
- `"Absent Full Day"` - Absent all day

### For Out of Session:
- `"Out Session AM"` - Out of session only in AM
- `"Out Session PM"` - Out of session only in PM
- `"Out Session Full Day"` - Out of session all day

### Mixed Status:
- `"Absent AM / Out Session PM"` - Absent in AM, Out of session in PM
- `"Out Session AM / Absent PM"` - Out of session in AM, Absent in PM

## New Methods Added

### `deleteAssignmentsForSchedule(scheduleId)`
Deletes all existing assignments for a schedule before saving new ones.

### `saveAttendanceForDate(date)`
Saves attendance records for ALL staff and students (present and absent).

### `deleteAttendanceForDate(date)`
Deletes existing attendance records for a date before saving new ones.

## How It Works Now

### When You Save a Schedule:

1. **First Save (New Date):**
   - Creates new ScheduleHistory record
   - Saves all assignments to DailyAssignments
   - Saves attendance for all staff and students to DailyAttendance

2. **Second Save (Same Date):**
   - Finds existing ScheduleHistory record by date
   - UPDATES the existing record (doesn't create duplicate)
   - DELETES old assignments from DailyAssignments
   - Saves new assignments to DailyAssignments
   - DELETES old attendance from DailyAttendance
   - Saves new attendance to DailyAttendance

### Result:
- **No duplicates** in any list
- **Always latest data** for each date
- **Complete attendance tracking** including who was present

## Testing

### Test Scenario 1: Update Existing Schedule
1. Create a schedule for today
2. Click Save
3. Verify records created in ScheduleHistory, DailyAssignments, DailyAttendance
4. Modify the schedule (change some assignments)
5. Click Save again
6. Check SharePoint:
   - ✅ Only ONE record in ScheduleHistory for today (updated, not duplicated)
   - ✅ Assignments reflect the current schedule (old ones deleted)
   - ✅ Attendance shows all staff and students with their status

### Test Scenario 2: Attendance Tracking
1. Mark some staff as absent, some as out of session
2. Mark some clients as absent, some as out of session
3. Leave others unmarked (present)
4. Save the schedule
5. Check DailyAttendance list:
   - ✅ Records for ALL active staff (not just absent ones)
   - ✅ Records for ALL active clients (not just absent ones)
   - ✅ Status column shows correct values
   - ✅ Individual flags (AbsentAM, OutOfSessionPM, etc.) are set correctly

## Backward Compatibility

The old `saveAttendanceHistory()` method still exists but is deprecated. It will be removed in a future update once the new system is confirmed working.

The new method is automatically called when saving schedules, so no changes needed in your workflow.

## Troubleshooting

### Error: "Cannot save attendance"
- Check that DailyAttendance list exists
- Verify you have added the new columns (Status, OutOfSessionAM, OutOfSessionPM, OutOfSessionFullDay)

### Error: "Failed to update schedule metadata"
- Check the EntityTypeName in SharePoint matches the code
- Verify the ScheduleHistory list exists and you have edit permissions

### Duplicates Still Appearing
- Clear browser cache
- Verify the fix is deployed
- Check browser console (F12) for error messages

## Benefits

✅ **No more duplicates** - Save as many times as needed for the same date
✅ **Complete attendance tracking** - See who was present, not just who was absent
✅ **Better reporting** - Status column makes it easy to filter and report
✅ **Data integrity** - Always have the latest version of each day's data
✅ **Simpler queries** - One record per date makes lookups faster
