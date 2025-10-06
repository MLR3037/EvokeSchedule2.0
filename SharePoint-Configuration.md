# SharePoint List Configuration for ABA Scheduling App with People Picker

This document ou### People Picker Configuration

### Important Notes:
1. **People Picker fields must be configured to:**
   - Allow selection from SharePoint site users only
   - Store user information (to maintain references when users leave)
   - Allow multiple selections where specified

2. **For multiple selection People Picker fields:**
   - Team: Allow multiple selections

3. **For single selection People Picker fields:**
   - StaffPerson: Allow single selection only

4. **Yes/No field configuration:**
   - PrimaryProgram: Default value should be unchecked
   - SecondaryProgram: Default value should be unchecked
   - Staff can have one or both programs enabled

### Key Changes from Previous Version:
- **Staff Programs**: Changed from multi-choice dropdown to separate Yes/No checkboxes for Primary and Secondary programs
- **Student Ratios**: Split into separate AM and PM ratio fields for more flexibility
- **Team Management**: Renamed "PreferredStaff" to "Team" to better reflect client team assignments
- **Removed Fields**: Eliminated MaxStudents (teams change frequently), ExcludedStaff, and SpecialRequirements
- **Role Hierarchy**: Updated to match organizational structure (RBT, BS, BCBA, EA, MHA, CC, Teacher, Director)

### User Management Benefits:
- When employees leave the organization, their SharePoint accounts can be disabled
- People Picker automatically handles name changes and email updates
- Provides integration with organization's user directory
- Enables easier staff management and cleanup
- Yes/No program fields simplify staff program assignment and filtering

## Team Management Features

### New Capabilities:
1. **View Clients by Staff**: See all clients assigned to each staff member with ratio breakdown
2. **View Staff by Client**: See all team members assigned to each client
3. **Team Assignment Management**: Easily manage which staff work with which clients
4. **Ratio Analysis**: Track AM/PM ratios separately for better scheduling
5. **Program Filtering**: Filter staff and clients by Primary/Secondary programs

### Example API Calls:
```javascript
// Load staff with expanded People Picker and Yes/No program fields
$select=Title,StaffPerson/Title,StaffPerson/EMail,StaffPerson/Id,Role,PrimaryProgram,SecondaryProgram,IsActive&$expand=StaffPerson

// Load students with expanded Team People Picker and separate ratios
$select=Title,Program,RatioAM,RatioPM,Team/Title,Team/EMail,Team/Id,IsActive&$expand=Team
```SharePoint list configurations for the ABA Scheduling application with People Picker integration and Yes/No program fields.

## Required SharePoint Lists

### 1. Staff List
**List Name:** `Staff`

#### Required Columns:
| Column Name | Type | Required | Description |
|-------------|------|----------|-------------|
| Title | Single line of text | Yes | Staff member name (auto-populated from People Picker) |
| StaffPerson | Person or Group | Yes | **People Picker field** - Links to SharePoint user account |
| Role | Choice | Yes | Staff role (RBT, Senior RBT, Lead, Supervisor, Director) |
| Email | Single line of text | Yes | Email address (auto-populated from People Picker) |
| Phone | Single line of text | No | Phone number |
| IsActive | Yes/No | Yes | Whether staff member is currently active |
| PrimaryProgram | Yes/No | Yes | **Yes/No field** - Can work Primary program |
| SecondaryProgram | Yes/No | Yes | **Yes/No field** - Can work Secondary program |
| CertificationExpiry | Date and Time | No | Certification expiration date |
| UserId | Single line of text | Yes | SharePoint User ID (auto-populated) |

#### Choice Field Values:
**Role choices:**
- RBT
- BS (Behavior Specialist)
- BCBA
- EA (Educational Assistant)
- MHA (Mental Health Assistant)
- CC (Clinical Coordinator)
- Teacher
- Director

### 2. Students List
**List Name:** `Students`

#### Required Columns:
| Column Name | Type | Required | Description |
|-------------|------|----------|-------------|
| Title | Single line of text | Yes | Student name |
| Program | Choice | Yes | Student's program |
| RatioAM | Choice | Yes | **AM session ratio** - Staff-to-student ratio for morning |
| RatioPM | Choice | Yes | **PM session ratio** - Staff-to-student ratio for afternoon |
| Team | Person or Group | No | **People Picker field (multiple)** - Team members assigned to client |
| IsActive | Yes/No | Yes | Whether student is currently active |
| Notes | Multiple lines of text | No | Additional notes |
| DateStarted | Date and Time | No | Date student started program |

#### Choice Field Values:
**Program choices:**
- Primary
- Secondary

**RatioAM choices:**
- 1:1
- 2:1
- 1:2

**RatioPM choices:**
- 1:1
- 2:1
- 1:2

### 3. ABASchedules List
**List Name:** `ABASchedules`

#### Required Columns:
| Column Name | Type | Required | Description |
|-------------|------|----------|-------------|
| Title | Single line of text | Yes | Schedule identifier |
| ScheduleDate | Date and Time | Yes | Date of the schedule |
| Program | Choice | Yes | Program name |
| Session | Choice | Yes | Session time (AM/PM) |
| StaffId | Number | Yes | Reference to staff member |
| StudentId | Number | Yes | Reference to student |
| AssignedBy | Choice | Yes | How assignment was made |
| IsLocked | Yes/No | Yes | Whether assignment is locked |
| CreatedDate | Date and Time | Yes | When assignment was created |
| ModifiedDate | Date and Time | Yes | When assignment was last modified |

#### Choice Field Values:
**Program choices:**
- Primary
- Secondary

**Session choices:**
- AM
- PM

**AssignedBy choices:**
- Auto
- Manual

## People Picker Configuration

### Important Notes:
1. **People Picker fields must be configured to:**
   - Allow selection from SharePoint site users only
   - Store user information (to maintain references when users leave)
   - Allow multiple selections where specified

2. **For multiple selection People Picker fields:**
   - PreferredStaffPeople: Allow multiple selections
   - ExcludedStaffPeople: Allow multiple selections

3. **For single selection People Picker fields:**
   - StaffPerson: Allow single selection only

### User Management Benefits:
- When employees leave the organization, their SharePoint accounts can be disabled
- People Picker automatically handles name changes and email updates
- Provides integration with organization's user directory
- Enables easier staff management and cleanup

## List Permissions

### Required Permissions:
- **Site Members:** Contribute access to all lists
- **Site Owners:** Full Control for list management
- **App Service Account:** Full Control for API operations

### Security Considerations:
- People Picker fields respect SharePoint security
- Only users with appropriate permissions can be selected
- Deleted users remain in historical records but cannot be newly assigned

## API Integration

The SharePoint service will automatically:
1. Expand People Picker fields to get user details
2. Handle user ID resolution and validation
3. Manage People Picker field updates
4. Provide search functionality for user selection

### Example API Calls:
```javascript
// Load staff with expanded People Picker and Yes/No program fields
$select=Title,StaffPerson/Title,StaffPerson/EMail,StaffPerson/Id,Role,PrimaryProgram,SecondaryProgram,IsActive&$expand=StaffPerson

// Load students with expanded Team People Picker and separate ratios
$select=Title,Program,RatioAM,RatioPM,Team/Title,Team/EMail,Team/Id,IsActive&$expand=Team
```

## Migration from Current System

If migrating from an existing system:
1. **Update Staff List:**
   - Add PrimaryProgram and SecondaryProgram Yes/No columns
   - Remove MaxStudents column
   - Convert existing program data to Yes/No format

2. **Update Students List:**
   - Add RatioAM and RatioPM choice columns
   - Add Team People Picker column (multiple selections)
   - Remove ExcludedStaffPeople column
   - Migrate PreferredStaffPeople data to Team column
   - Split existing ratio data into AM/PM fields

3. **Update application to use new field structure**
4. **Remove old unused columns after successful migration**
5. **Test People Picker and Yes/No field functionality thoroughly**

## Troubleshooting

### Common Issues:
1. **People Picker not showing users:** Check site permissions and user access
2. **Expansion errors:** Verify field names match SharePoint internal names
3. **Multiple selection not working:** Ensure People Picker configured for multiple selections
4. **Performance issues:** Consider limiting search results and using targeted queries

### Testing Checklist:
- [ ] People Picker displays site users correctly
- [ ] Multiple selection works for preferred/excluded staff
- [ ] User information expands properly in API calls
- [ ] Form validation works with People Picker data
- [ ] Staff management integrates with SharePoint users
- [ ] Data saves correctly with People Picker references