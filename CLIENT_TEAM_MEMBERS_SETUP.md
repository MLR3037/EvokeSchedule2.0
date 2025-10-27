# Client Team Members SharePoint List Setup

## Overview
This new list replaces the `Team` field and `TeamTrainingStatus` JSON field in the Clients list. It allows users to manage client team members and their training status directly from SharePoint.

## Create the SharePoint List

1. Go to your SharePoint site: https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators
2. Click **Site Contents** > **New** > **List**
3. Name it: **ClientTeamMembers**
4. Description: "Manages team member assignments and training status for each client"

## Add These Columns

### 1. Title (Single line of text) - DEFAULT COLUMN
- **This is the built-in Title column - don't create it, just use it!**
- Use format: **"ClientName - StaffName"** (e.g., "John Doe - Sarah Smith")
- This makes each record easy to identify in SharePoint views
- The app will auto-generate this when syncing

### 2. ClientID (Number)
- Type: **Number**
- Required: **Yes**
- Description: "ID of the client from the Clients list"

### 3. ClientName (Single line of text)
- Type: **Single line of text**
- Required: **Yes**
- Description: "Name of the client (for easy reference)"

### 4. StaffMember (Person or Group)
- Type: **Person or Group**
- Required: **Yes**
- Allow multiple selections: **No**
- Description: "Staff member on this client's team"

### 5. TrainingStatus (Choice)
- Type: **Choice**
- Required: **Yes**
- Choices:
  - Solo
  - Trainer
  - Overlap BCBA
  - Overlap Staff
- Default: **Solo**
- Display: **Drop-Down Menu**
- Description: "Training status for this staff member with this client"

### 6. IsActive (Yes/No)
- Type: **Yes/No**
- Required: **Yes**
- Default: **Yes**
- Description: "Whether this team member assignment is active"

### 7. DateAdded (Date and Time)
- Type: **Date and Time**
- Required: **No**
- Include Time: **Yes**
- Description: "When this staff member was added to the client's team"

## List Settings

### Views
Create these helpful views:

#### By Client View
- Group by: **ClientName**
- Sort by: **ClientName** (ascending)
- Show columns: ClientName, StaffMember, TrainingStatus, IsActive

#### By Staff Member View
- Group by: **StaffMember**
- Sort by: **StaffMember** (ascending)
- Show columns: StaffMember, ClientName, TrainingStatus, IsActive

#### Training View
- Filter: **TrainingStatus** is not equal to **Solo**
- Group by: **TrainingStatus**
- Sort by: **ClientName** (ascending)
- Show columns: ClientName, StaffMember, TrainingStatus

### Permissions
- Grant **Edit** permissions to Clinical Coordinators and administrators
- Grant **Read** permissions to all staff who need to view team assignments

## How Users Will Use This List

### To Add a Staff Member to a Client's Team:
1. Click **New** in the ClientTeamMembers list
2. **Title**: Enter **"ClientName - StaffName"** (e.g., "John Doe - Sarah Smith")
   - Or just enter the client name - the app will fix it when syncing
3. **ClientID**: Enter the client's ID number (from Clients list)
4. **ClientName**: Enter the client's name
5. **StaffMember**: Select staff member from People Picker
6. **TrainingStatus**: Choose from dropdown (default is Solo)
7. Click **Save**

### To Change Training Status:
1. Find the record in the ClientTeamMembers list
2. Click to edit the item
3. Change **TrainingStatus** dropdown
4. Click **Save**

### To Remove a Staff Member from a Team:
1. Find the record in the ClientTeamMembers list
2. Either:
   - Delete the item (permanent removal), OR
   - Set **IsActive** to **No** (soft delete, preserves history)

## Migration Notes

### Running the Migration Script

After setting up the ClientTeamMembers list:

1. **Open the migration tool**: `migrate-to-client-team-members.html`
   - Open this file in your web browser
   - Or host it on a web server

2. **Follow the steps in order**:
   - Click **"1. Login to SharePoint"** - Authenticate with your Microsoft account
   - Click **"2. Start Migration"** - This will copy all team data from Clients list
   - Click **"3. Verify Data"** - Confirms the migration was successful

3. **What the migration does**:
   - Reads all clients from the Clients list
   - For each client, reads their Team field and TeamTrainingStatus
   - Creates records in ClientTeamMembers for each team member
   - Preserves training status information
   - Skips duplicates if you run it multiple times

4. **Safe to run multiple times**:
   - The script checks for existing records and skips them
   - Your Clients list data is never modified
   - It's additive only (no deletions)

### After Migration

1. Test the React app - it should now load teams from ClientTeamMembers list
2. (Optional) Keep the old Team and TeamTrainingStatus columns as backup
3. (Optional) Remove the old columns after confirming everything works

## Benefits

✅ **Easy to Edit**: Users can manage teams directly in SharePoint without using the React app
✅ **Better Reporting**: Can create views, charts, and reports on team assignments
✅ **Audit Trail**: Can see when team members were added/changed
✅ **Training Visibility**: Easy to see which staff are in training with which clients
✅ **Better Performance**: No JSON parsing, cleaner data structure
