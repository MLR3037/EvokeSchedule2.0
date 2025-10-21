# Excel Export Feature

## Overview
The Excel Export feature allows users to download the current day's schedule and absence data as an Excel (.xlsx) file.

## Features

### Schedule Tab
Contains the main schedule with the following columns:

1. **Client Name** - Student name
2. **Program** - Primary or Secondary
3. **AM Staff** - Staff assigned to AM session (comma-separated if multiple)
4. **AM Start** - Blank (filled in after export)
5. **AM End** - Blank (filled in after export)
6. **Lunch 1 Cov** - Blank (filled in after export)
7. **Lunch 2 Cov** - Blank (filled in after export)
8. **PM Staff** - Staff assigned to PM session (comma-separated if multiple)
9. **PM Start** - Blank (filled in after export)
10. **PM End** - Blank (filled in after export)

### Trainee Rows
If a client has a trainee assigned:
- A separate row is added for the trainee
- The trainee's name appears with "(Trainee)" suffix
- Only the session column where they're assigned is filled

### Absences Tab
Contains absence information with the following columns:

1. **Name** - Student or staff member name
2. **Staff/Student** - Type of person (Staff or Student)
3. **Absent AM** - Yes/No for AM session
4. **Absent PM** - Yes/No for PM session

## Usage

1. Navigate to the **Schedule** tab
2. Ensure the schedule is loaded for the desired date
3. Click the **Export** button (green button with download icon)
4. Excel file will download automatically with filename: `Schedule_MM-DD-YYYY.xlsx`

## Technical Details

### Implementation
- **Service**: `src/services/ExcelExportService.js`
- **Library**: `xlsx` (SheetJS)
- **Export Handler**: `handleExportToExcel()` in `App.js`

### File Structure
- Two worksheets: "Schedule" and "Absences"
- Auto-sized columns for readability
- Headers in first row
- Data sorted alphabetically by name

### Special Handling
- Students marked as absent show "ABSENT" in the staff column
- Trainees are marked with "(Trainee)" suffix
- Multiple staff members are comma-separated
- If no absences, displays "No absences recorded"

## Button Location
The Export button is located in the top toolbar, between the Save and Refresh buttons.

## Error Handling
- Export disabled when no assignments exist
- Catches and displays export errors in alert dialog
- Logs errors to browser console for debugging

## Future Enhancements
- Option to include time estimates
- Custom date range exports
- Multiple day exports
- Export templates with pre-filled times
