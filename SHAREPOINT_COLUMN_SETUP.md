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

---

## Column Settings Summary

### Staff List Columns

| Column Name      | Type   | Default | Required | Indexed |
|------------------|--------|---------|----------|---------|
| AbsentAM         | Yes/No | No      | No       | No      |
| AbsentPM         | Yes/No | No      | No       | No      |
| AbsentFullDay    | Yes/No | No      | No       | No      |

### Clients List Columns

| Column Name         | Type   | Default | Required | Indexed |
|---------------------|--------|---------|----------|---------|
| AbsentAM            | Yes/No | No      | No       | No      |
| AbsentPM            | Yes/No | No      | No       | No      |
| AbsentFullDay       | Yes/No | No      | No       | No      |
| ScheduledMonday     | Yes/No | Yes     | No       | No      |
| ScheduledTuesday    | Yes/No | Yes     | No       | No      |
| ScheduledWednesday  | Yes/No | Yes     | No       | No      |
| ScheduledThursday   | Yes/No | Yes     | No       | No      |
| ScheduledFriday     | Yes/No | Yes     | No       | No      |

---

## Verification Checklist

After adding columns, verify:

- [ ] **Staff list** has 3 attendance columns (AbsentAM, AbsentPM, AbsentFullDay)
- [ ] **Clients list** has 3 attendance columns (AbsentAM, AbsentPM, AbsentFullDay)
- [ ] **Clients list** has 5 schedule columns (ScheduledMonday through ScheduledFriday)
- [ ] All column names match exactly (case-sensitive)
- [ ] All columns are type "Yes/No"
- [ ] Default value is "No" for attendance columns
- [ ] Default value is "Yes" for schedule columns
- [ ] You can manually check/uncheck boxes in SharePoint

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

