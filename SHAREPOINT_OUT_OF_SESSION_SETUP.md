# SharePoint Setup: Out of Session Columns

## Overview
This guide provides step-by-step instructions for adding the new "Out of Session" columns to the SharePoint Staff list.

## Required Columns

Add the following three columns to your **Staff** SharePoint list:

### 1. OutOfSessionAM
- **Column Type:** Yes/No
- **Column Name:** `OutOfSessionAM`
- **Display Name:** Out of Session AM
- **Default Value:** No
- **Description:** Staff member is out of session (meetings, trainings, etc.) during the AM session

### 2. OutOfSessionPM
- **Column Type:** Yes/No
- **Column Name:** `OutOfSessionPM`
- **Display Name:** Out of Session PM
- **Default Value:** No
- **Description:** Staff member is out of session (meetings, trainings, etc.) during the PM session

### 3. OutOfSessionFullDay
- **Column Type:** Yes/No
- **Column Name:** `OutOfSessionFullDay`
- **Display Name:** Out of Session Full Day
- **Default Value:** No
- **Description:** Staff member is out of session (meetings, trainings, etc.) for the entire day

## Step-by-Step Instructions

### Using SharePoint Modern UI

1. **Navigate to Staff List**
   - Go to your SharePoint site
   - Click on the "Staff" list

2. **Add First Column (OutOfSessionAM)**
   - Click "+ Add column" button
   - Select "Yes/No"
   - Enter Name: `OutOfSessionAM`
   - Enter Description: "Staff member is out of session during the AM session"
   - Set Default value: No
   - Click "Save"

3. **Add Second Column (OutOfSessionPM)**
   - Click "+ Add column" button
   - Select "Yes/No"
   - Enter Name: `OutOfSessionPM`
   - Enter Description: "Staff member is out of session during the PM session"
   - Set Default value: No
   - Click "Save"

4. **Add Third Column (OutOfSessionFullDay)**
   - Click "+ Add column" button
   - Select "Yes/No"
   - Enter Name: `OutOfSessionFullDay`
   - Enter Description: "Staff member is out of session for the entire day"
   - Set Default value: No
   - Click "Save"

### Using SharePoint Classic UI

1. **Navigate to List Settings**
   - Go to Staff list
   - Click "List Settings" (gear icon → List Settings)

2. **Create OutOfSessionAM Column**
   - Under "Columns", click "Create column"
   - Column name: `OutOfSessionAM`
   - Type: Yes/No (check box)
   - Default value: No
   - Click "OK"

3. **Create OutOfSessionPM Column**
   - Click "Create column" again
   - Column name: `OutOfSessionPM`
   - Type: Yes/No (check box)
   - Default value: No
   - Click "OK"

4. **Create OutOfSessionFullDay Column**
   - Click "Create column" again
   - Column name: `OutOfSessionFullDay`
   - Type: Yes/No (check box)
   - Default value: No
   - Click "OK"

### Using PowerShell (Advanced)

```powershell
# Connect to SharePoint Online
Connect-PnPOnline -Url "https://yourtenant.sharepoint.com/sites/yoursite" -Interactive

# Add OutOfSessionAM column
Add-PnPField -List "Staff" -DisplayName "Out of Session AM" -InternalName "OutOfSessionAM" -Type Boolean -AddToDefaultView

# Add OutOfSessionPM column
Add-PnPField -List "Staff" -DisplayName "Out of Session PM" -InternalName "OutOfSessionPM" -Type Boolean -AddToDefaultView

# Add OutOfSessionFullDay column
Add-PnPField -List "Staff" -DisplayName "Out of Session Full Day" -InternalName "OutOfSessionFullDay" -Type Boolean -AddToDefaultView
```

## Verification

After adding the columns, verify they appear in the Staff list:

1. **Check List View**
   - Navigate to Staff list
   - Click "All Items" view
   - Scroll right to see new columns
   - Should see: "Out of Session AM", "Out of Session PM", "Out of Session Full Day"

2. **Check New Item Form**
   - Click "New" to create a new staff member
   - Scroll down to see the new checkboxes
   - All should default to unchecked (No)

3. **Test API Access**
   - Open browser dev tools (F12)
   - Go to Network tab
   - Load the scheduling app
   - Check the API response for staff data
   - Should see `OutOfSessionAM`, `OutOfSessionPM`, `OutOfSessionFullDay` fields

## Column Organization (Optional)

For better organization in SharePoint forms, you can group attendance-related columns:

### Suggested Column Order
1. StaffPerson
2. Role
3. PrimaryProgram
4. SecondaryProgram
5. IsActive
6. **--- Attendance Section ---**
7. AbsentAM
8. AbsentPM
9. AbsentFullDay
10. OutOfSessionAM
11. OutOfSessionPM
12. OutOfSessionFullDay

### Create Custom View (Optional)

Create a view that shows only attendance information:

1. **Create New View**
   - List Settings → Create View
   - Name: "Attendance Tracking"
   
2. **Select Columns:**
   - StaffPerson (Name)
   - Role
   - AbsentAM
   - AbsentPM
   - AbsentFullDay
   - OutOfSessionAM
   - OutOfSessionPM
   - OutOfSessionFullDay

3. **Apply Filters (Optional):**
   - Show only items where IsActive = Yes
   - Sort by StaffPerson ascending

## Troubleshooting

### Column Not Appearing in API Response

**Problem:** New columns don't show up in the app

**Solution:**
1. Verify column internal names exactly match (case-sensitive)
2. Check that columns are not hidden
3. Ensure you have read permissions on the columns
4. Try refreshing the browser cache (Ctrl+Shift+R)

### Permission Errors When Saving

**Problem:** Error when trying to save out-of-session status

**Solution:**
1. Verify you have Edit permissions on the Staff list
2. Check that columns are not read-only
3. Ensure columns are not in a sealed section (if using content types)

### Default Values Not Working

**Problem:** Columns always show as null or undefined

**Solution:**
1. Set default value to "No" in column settings
2. For existing items, run a bulk update:
   ```powershell
   Connect-PnPOnline -Url "https://yourtenant.sharepoint.com/sites/yoursite" -Interactive
   
   # Get all staff items
   $items = Get-PnPListItem -List "Staff"
   
   # Update each item with default values
   foreach($item in $items) {
       Set-PnPListItem -List "Staff" -Identity $item.Id -Values @{
           "OutOfSessionAM" = $false
           "OutOfSessionPM" = $false
           "OutOfSessionFullDay" = $false
       }
   }
   ```

## Related Documentation
- `OUT_OF_SESSION_FEATURE.md` - Feature documentation
- `SHAREPOINT_COLUMN_SETUP.md` - Original SharePoint column setup
- `ATTENDANCE_AUTO_CLEANUP.md` - Attendance automation feature

## Migration Notes

### For Existing Deployments

If you already have the app deployed:

1. **Add Columns to SharePoint** (as described above)
2. **Deploy Updated Code** to GitHub
3. **Clear Browser Cache** on all client machines
4. **Test with One Staff Member**
   - Mark them "Out AM"
   - Verify they are removed from AM schedule
   - Verify status badge shows "Out AM"
5. **Communicate to Users** about new feature

### Data Migration

No data migration needed - new columns will:
- Default to `false` for all existing staff
- Not affect existing absent/present status
- Work immediately after code deployment
