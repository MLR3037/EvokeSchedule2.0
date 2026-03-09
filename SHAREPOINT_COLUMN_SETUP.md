# SharePoint Column Setup Guide

## Required SharePoint Columns

You need to add attendance tracking columns to both the Staff and Clients lists in SharePoint.

---

## Staff List Columns

### 1. Add AbsentAM Column
1. Go to Staff list in SharePoint
2. Click **+ Add column** → **Yes/No**
3. Enter name: `AbsentAM`
4. Description: "Staff member is absent during AM session"
5. Default value: **No**
6. Click **Save**

### 2. Add AbsentPM Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `AbsentPM`
3. Description: "Staff member is absent during PM session"
4. Default value: **No**
5. Click **Save**

### 3. Add AbsentFullDay Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `AbsentFullDay`
3. Description: "Staff member is absent for the entire day"
4. Default value: **No**
5. Click **Save**

---

## Clients List Columns

### 1. Add AbsentAM Column
1. Go to Clients list in SharePoint
2. Click **+ Add column** → **Yes/No**
3. Enter name: `AbsentAM`
4. Description: "Client is absent during AM session"
5. Default value: **No**
6. Click **Save**

### 2. Add AbsentPM Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `AbsentPM`
3. Description: "Client is absent during PM session"
4. Default value: **No**
5. Click **Save**

### 3. Add AbsentFullDay Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `AbsentFullDay`
3. Description: "Client is absent for the entire day"
4. Default value: **No**
5. Click **Save**

### 4. Add ScheduledMonday Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `ScheduledMonday`
3. Description: "Client is scheduled to attend on Mondays"
4. Default value: **Yes**
5. Click **Save**

### 5. Add ScheduledTuesday Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `ScheduledTuesday`
3. Description: "Client is scheduled to attend on Tuesdays"
4. Default value: **Yes**
5. Click **Save**

### 6. Add ScheduledWednesday Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `ScheduledWednesday`
3. Description: "Client is scheduled to attend on Wednesdays"
4. Default value: **Yes**
5. Click **Save**

### 7. Add ScheduledThursday Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `ScheduledThursday`
3. Description: "Client is scheduled to attend on Thursdays"
4. Default value: **Yes**
5. Click **Save**

### 8. Add ScheduledFriday Column
1. Click **+ Add column** → **Yes/No**
2. Enter name: `ScheduledFriday`
3. Description: "Client is scheduled to attend on Fridays"
4. Default value: **Yes**
5. Click **Save**

### 9. Add AMStartTime Column (Custom Schedule Times)
1. Click **+ Add column** → **Single line of text**
2. Enter name: `AMStartTime`
3. Description: "Custom AM session start time (e.g., '9:00 AM'). Leave blank to use program defaults."
4. Click **Save**

### 10. Add AMEndTime Column
1. Click **+ Add column** → **Single line of text**
2. Enter name: `AMEndTime`
3. Description: "Custom AM session end time (e.g., '11:30 AM'). Leave blank to use program defaults."
4. Click **Save**

### 11. Add PMStartTime Column
1. Click **+ Add column** → **Single line of text**
2. Enter name: `PMStartTime`
3. Description: "Custom PM session start time (e.g., '12:30 PM'). Leave blank to use program defaults."
4. Click **Save**

### 12. Add PMEndTime Column
1. Click **+ Add column** → **Single line of text**
2. Enter name: `PMEndTime`
3. Description: "Custom PM session end time (e.g., '2:30 PM'). Leave blank to use program defaults."
4. Click **Save**

---

## Column Settings Summary

### Staff List Columns

| Column Name      | Type   | Default | Required | Indexed |
|------------------|--------|---------|----------|---------|
| AbsentAM         | Yes/No | No      | No       | No      |
| AbsentPM         | Yes/No | No      | No       | No      |
| AbsentFullDay    | Yes/No | No      | No       | No      |

### Clients List Columns

| Column Name         | Type                | Default | Required | Indexed |
|---------------------|---------------------|---------|----------|---------|
| AbsentAM            | Yes/No              | No      | No       | No      |
| AbsentPM            | Yes/No              | No      | No       | No      |
| AbsentFullDay       | Yes/No              | No      | No       | No      |
| ScheduledMonday     | Yes/No              | Yes     | No       | No      |
| ScheduledTuesday    | Yes/No              | Yes     | No       | No      |
| ScheduledWednesday  | Yes/No              | Yes     | No       | No      |
| ScheduledThursday   | Yes/No              | Yes     | No       | No      |
| ScheduledFriday     | Yes/No              | Yes     | No       | No      |
| AMStartTime         | Single line of text | (blank) | No       | No      |
| AMEndTime           | Single line of text | (blank) | No       | No      |
| PMStartTime         | Single line of text | (blank) | No       | No      |
| PMEndTime           | Single line of text | (blank) | No       | No      |

---

## Verification Checklist

After adding columns, verify:

- [ ] **Staff list** has 3 attendance columns (AbsentAM, AbsentPM, AbsentFullDay)
- [ ] **Clients list** has 3 attendance columns (AbsentAM, AbsentPM, AbsentFullDay)
- [ ] **Clients list** has 5 schedule columns (ScheduledMonday through ScheduledFriday)
- [ ] **Clients list** has 4 time columns (AMStartTime, AMEndTime, PMStartTime, PMEndTime)
- [ ] All column names match exactly (case-sensitive)
- [ ] Attendance and schedule columns are type "Yes/No"
- [ ] Time columns are type "Single line of text"
- [ ] Default value is "No" for attendance columns
- [ ] Default value is "Yes" for schedule columns
- [ ] Time columns have no default value (blank)
- [ ] You can manually check/uncheck boxes in SharePoint

---

## Custom Schedule Times

The time columns allow you to set custom start/end times for individual clients who don't follow the standard 8:45 AM - 3:00 PM schedule.

### Time Format
Enter times in the format: `H:MM AM` or `H:MM PM`

Examples:
- `9:00 AM` - Client starts at 9 AM
- `11:30 AM` - Client ends AM session at 11:30
- `12:30 PM` - Client starts PM session at 12:30
- `2:30 PM` - Client ends at 2:30 PM

### Default Times (when columns are blank)

| Program   | AM Start | AM End   | PM Start | PM End  |
|-----------|----------|----------|----------|---------|
| Primary   | 8:45 AM  | 12:05 PM | 12:35 PM | 3:00 PM |
| Secondary | 8:45 AM  | 11:30 AM | 12:00 PM | 3:00 PM |

### Usage
- **Leave blank** to use the program defaults shown above
- **Enter a time** only for sessions that differ from the default
- Affects lunch coverage calculations and schedule display

---

## Testing After Setup

1. **Open the App:**
   - Navigate to your app (localhost:3000 or deployed URL)
   - Sign in with your credentials

2. **Test Load:**
   - Go to Staff tab - verify staff load correctly
   - Go to Students tab - verify students load correctly
   - Check browser console for any errors

3. **Test Attendance Tab:**
   - Click "Attendance" tab
   - Switch between Staff and Clients views
   - Search should work

4. **Test Save:**
   - Mark a staff member as Absent AM
   - Wait a few seconds
   - Go to SharePoint Staff list
   - Verify the AbsentAM column is checked for that person

5. **Test Load:**
   - Refresh the browser
   - Go to Attendance tab
   - Verify the absence is still marked

6. **Test Auto-Assignment:**
   - Mark a staff member as Absent Full Day
   - Go to Schedule tab
   - Click Auto-Assign
   - Verify the absent staff member is NOT assigned to any students

7. **Test Session Summaries:**
   - Mark a client as Absent AM
   - Go to Schedule tab
   - Check the AM Primary summary
   - Verify the client appears in "Absent Clients" section

---

## Troubleshooting

### Problem: "Column 'AbsentAM' does not exist"

**Solution:**
- Verify column name is exactly `AbsentAM` (case-sensitive)
- Verify column exists in the correct list (Staff or Clients)
- Try refreshing the SharePoint list page

### Problem: Attendance doesn't save

**Solution:**
- Check browser console for errors
- Verify you have edit permissions on Staff/Clients lists
- Verify column types are Yes/No (not Choice or Text)
- Check that SharePointService is authenticated

### Problem: Attendance doesn't load

**Solution:**
- Verify columns exist in SharePoint
- Check that the $select clause includes the attendance fields
- Look for errors in browser console
- Try signing out and back in

### Problem: Auto-assignment still assigns absent people

**Solution:**
- Verify the person is actually marked absent in the app
- Check that isAvailableForSession() method is working
- Look in console for "Attendance stats" log message
- Verify the attendance was saved to SharePoint

---

## Alternative: PowerShell Script

If you prefer, you can add columns via PowerShell:

```powershell
# Connect to SharePoint
Connect-PnPOnline -Url "https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators"

# Add columns to Staff list
Add-PnPField -List "Staff" -DisplayName "AbsentAM" -InternalName "AbsentAM" -Type Boolean -AddToDefaultView
Add-PnPField -List "Staff" -DisplayName "AbsentPM" -InternalName "AbsentPM" -Type Boolean -AddToDefaultView
Add-PnPField -List "Staff" -DisplayName "AbsentFullDay" -InternalName "AbsentFullDay" -Type Boolean -AddToDefaultView

# Add columns to Clients list
Add-PnPField -List "Clients" -DisplayName "AbsentAM" -InternalName "AbsentAM" -Type Boolean -AddToDefaultView
Add-PnPField -List "Clients" -DisplayName "AbsentPM" -InternalName "AbsentPM" -Type Boolean -AddToDefaultView
Add-PnPField -List "Clients" -DisplayName "AbsentFullDay" -InternalName "AbsentFullDay" -Type Boolean -AddToDefaultView

# Add Days of Week schedule columns to Clients list (default to Yes)
Add-PnPField -List "Clients" -DisplayName "ScheduledMonday" -InternalName "ScheduledMonday" -Type Boolean -AddToDefaultView
Add-PnPField -List "Clients" -DisplayName "ScheduledTuesday" -InternalName "ScheduledTuesday" -Type Boolean -AddToDefaultView
Add-PnPField -List "Clients" -DisplayName "ScheduledWednesday" -InternalName "ScheduledWednesday" -Type Boolean -AddToDefaultView
Add-PnPField -List "Clients" -DisplayName "ScheduledThursday" -InternalName "ScheduledThursday" -Type Boolean -AddToDefaultView
Add-PnPField -List "Clients" -DisplayName "ScheduledFriday" -InternalName "ScheduledFriday" -Type Boolean -AddToDefaultView

Write-Host "Attendance and Days of Week columns added successfully!" -ForegroundColor Green
```

---

## After Setup Complete

Once all columns are added and verified:

1. Update ATTENDANCE_IMPLEMENTATION_COMPLETE.md checklist
2. Begin user acceptance testing
3. Train schedulers on the new feature
4. Monitor for any issues in the first week
5. Gather feedback for future improvements

---

## Need Help?

If you encounter issues:
1. Check this guide first
2. Review browser console for errors
3. Check ATTENDANCE_IMPLEMENTATION_COMPLETE.md
4. Review code comments in the implementation files

---

## Training Completions List (NEW)

This new list tracks when staff complete their training and transition to Solo status.

### Create the TrainingCompletions List

1. Go to your SharePoint site
2. Click **+ New** → **List**
3. Select **Blank list**
4. Name: `TrainingCompletions`
5. Description: "Tracks staff training completions with session counts"
6. Click **Create**

### Add Columns to TrainingCompletions List

#### 1. StaffMember Column
1. Click **+ Add column** → **Person**
2. Enter name: `StaffMember`
3. Description: "Staff member who completed training"
4. Allow selection of: **People only**
5. Click **Save**

#### 2. Client Column (Lookup)
1. Click **+ Add column** → **Lookup**
2. Enter name: `Client`
3. Get information from: **Clients**
4. In this column: **Title**
5. Click **Save**

#### 3. TrainingType Column
1. Click **+ Add column** → **Choice**
2. Enter name: `TrainingType`
3. Choices:
   - `BCBA Overlap`
   - `Staff Overlap`
4. Click **Save**

#### 4. CompletedDate Column
1. Click **+ Add column** → **Date and time**
2. Enter name: `CompletedDate`
3. Include time: **No**
4. Click **Save**

#### 5. TotalSessions Column
1. Click **+ Add column** → **Number**
2. Enter name: `TotalSessions`
3. Number of decimal places: **0**
4. Click **Save**

#### 6. StartDate Column
1. Click **+ Add column** → **Date and time**
2. Enter name: `StartDate`
3. Include time: **No**
4. Description: "When training started (first session)"
5. Click **Save**

### TrainingCompletions Column Summary

| Column Name   | Type          | Required | Description |
|---------------|---------------|----------|-------------|
| Title         | Single line   | Auto     | Auto-generated |
| StaffMember   | Person        | No       | Who completed training |
| Client        | Lookup        | No       | Which client they trained on |
| TrainingType  | Choice        | No       | "BCBA Overlap" or "Staff Overlap" |
| CompletedDate | Date          | No       | When moved to Solo |
| TotalSessions | Number        | No       | How many sessions to complete |
| StartDate     | Date          | No       | When training started |

### How Training Completions Work

1. **Automatic Recording**: When you change a staff member's training status from "BCBA Overlap" or "Staff Overlap" to "Solo" in the Training Management view, a completion record is automatically created.

2. **Session Count**: The system counts how many times the staff member was assigned as a trainee to that client in past schedules.

3. **First Session Date**: The system finds the earliest date the staff member was a trainee for that client.

4. **Viewing Completions**: Go to the Training tab and click "Recent Completions" to see all staff who have completed training in the last 90 days.

### Training Tab Features

The Training tab now has two views:

- **Currently Training**: Staff with "BCBA Overlap" or "Staff Overlap" status
- **Recent Completions**: Staff who moved to Solo in the last 90 days

Stats shown:
- Currently Training count
- Completions (90 days) count
- Active Training Sessions
- Average Sessions to Solo

### Note About Historical Data

Completions are only recorded **from when you add this list onward**. Past training completions before this feature won't appear in the completions list, but will still count toward session history if schedule records exist.

