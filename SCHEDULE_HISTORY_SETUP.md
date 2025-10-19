# Schedule History SharePoint Lists Setup

## Overview
The enhanced save functionality requires two additional SharePoint lists to track schedule history and enable advanced rules like "no more than 3 consecutive days with the same student."

---

## Required SharePoint Lists

### 1. ABASchedules List (Schedule Metadata)

**Purpose:** Stores daily schedule metadata and summary information.

**Columns to Create:**

| Column Name | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| Title | Single line of text | Yes | (auto) | Auto-generated title |
| ScheduleDate | Date and Time | Yes | Today | Date of the schedule |
| IsFinalized | Yes/No | No | No | Whether schedule is finalized |
| TotalAssignments | Number | No | 0 | Total number of assignments |
| CreatedDate | Date and Time | No | Today | When schedule was saved |
| CreatedBy | Single line of text | No | - | User who saved the schedule |
| AssignmentsSummary | Multiple lines of text | No | - | JSON summary of assignments |

### 2. ABAAssignments List (Assignment History)

**Purpose:** Stores individual staff-student assignments for historical tracking and rule checking.

**Columns to Create:**

| Column Name | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| Title | Single line of text | Yes | (auto) | Auto-generated title |
| ScheduleID | Number | Yes | - | Links to ABASchedules list ID |
| ScheduleDate | Date and Time | Yes | Today | Date of the assignment |
| StaffID | Number | Yes | - | ID of assigned staff member |
| StudentID | Number | Yes | - | ID of assigned student |
| Session | Choice | Yes | - | AM or PM session |
| Program | Choice | Yes | - | Primary or Secondary program |
| AssignmentType | Single line of text | No | Standard | Type of assignment |
| CreatedDate | Date and Time | No | Today | When assignment was created |
| IsLocked | Yes/No | No | No | Whether assignment was manually locked |

---

## SharePoint Setup Instructions

### Step 1: Create ABASchedules List

1. **Go to your SharePoint site:** https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators
2. **Create new list:**
   - Click **New** → **List**
   - Name: `ABASchedules`
   - Description: `Daily schedule metadata and summaries`
   - Click **Create**

3. **Add columns** (click **+ Add column** for each):

   **ScheduleDate:**
   - Type: Date and Time → Date only
   - Required: Yes
   - Default: Today
   
   **IsFinalized:**
   - Type: Yes/No
   - Default: No
   
   **TotalAssignments:**
   - Type: Number
   - Min: 0
   - Default: 0
   
   **CreatedDate:**
   - Type: Date and Time
   - Default: Today
   
   **CreatedBy:**
   - Type: Single line of text
   - Max length: 100
   
   **AssignmentsSummary:**
   - Type: Multiple lines of text
   - Rich text: No

### Step 2: Create ABAAssignments List

1. **Create new list:**
   - Name: `ABAAssignments`
   - Description: `Individual staff-student assignment history`

2. **Add columns:**

   **ScheduleID:**
   - Type: Number
   - Required: Yes
   - Min: 1
   
   **ScheduleDate:**
   - Type: Date and Time → Date only
   - Required: Yes
   - Default: Today
   
   **StaffID:**
   - Type: Number
   - Required: Yes
   - Min: 1
   
   **StudentID:**
   - Type: Number
   - Required: Yes
   - Min: 1
   
   **Session:**
   - Type: Choice
   - Choices: AM, PM
   - Required: Yes
   
   **Program:**
   - Type: Choice
   - Choices: Primary, Secondary
   - Required: Yes
   
   **AssignmentType:**
   - Type: Single line of text
   - Default: Standard
   - Max length: 50
   
   **CreatedDate:**
   - Type: Date and Time
   - Default: Today
   
   **IsLocked:**
   - Type: Yes/No
   - Default: No

---

## Verification Checklist

After creating the lists, verify:

- [ ] **ABASchedules list exists** with all 7 columns
- [ ] **ABAAssignments list exists** with all 10 columns
- [ ] **Column types match exactly** (especially Choice columns with correct options)
- [ ] **Required fields are marked as required**
- [ ] **Default values are set correctly**
- [ ] **You can manually add a test item** to each list
- [ ] **App permissions allow read/write** to both lists

---

## Features Enabled by Schedule History

### 1. **Historical Tracking**
- Complete record of who worked with whom on which days
- Ability to see scheduling patterns over time
- Data for analytics and reporting

### 2. **Advanced Rules** (Future Implementation)
- **Consecutive Days Rule:** Prevent staff from working with same student >3 days in a row
- **Rotation Tracking:** Ensure students get variety in their staff assignments
- **Workload Analysis:** Track staff assignment patterns and balance
- **Student Preference Learning:** Identify successful staff-student combinations

### 3. **Reporting Capabilities**
- Weekly/monthly assignment summaries
- Staff utilization reports  
- Student coverage analysis
- Historical schedule comparisons

### 4. **Conflict Prevention**
- Check historical patterns before making assignments
- Warning system for potential issues
- Automated suggestions based on successful past assignments

---

## API Methods Available

The SharePoint service now includes these new methods:

```javascript
// Save complete schedule with history
await sharePointService.saveSchedule(schedule);

// Get assignment history for rule checking  
await sharePointService.getScheduleHistory(staffId, studentId, days);

// Check consecutive days rule
await sharePointService.checkConsecutiveDaysRule(staffId, studentId, maxDays);
```

---

## Next Steps

1. **Create the SharePoint lists** using the instructions above
2. **Test the save functionality** by creating a schedule and clicking Save
3. **Verify data appears** in both SharePoint lists
4. **Begin using historical data** for improved scheduling decisions

The enhanced save functionality transforms your scheduling system from a daily tool into a comprehensive historical tracking and rule-based assignment system!