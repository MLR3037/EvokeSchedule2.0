# Training Tracker Feature

## Overview
The Training Tracker is a new tab that displays comprehensive training information for staff members who are currently in training status (overlap-staff or overlap-bcba).

## Features

### Staff Training List
- **Staff Name**: Name and role of staff member in training
- **Training On**: Client(s) they are training on with program information
- **Training Type**: Badge indicating type of training (Staff Overlap or BCBA Overlap)
- **First Training Session**: Date of the first training session (from historical data)
- **Sessions Completed**: Count of training sessions completed in the last 90 days

### Filtering & Sorting
- **Program Filter**: Filter training records by Primary or Secondary program
- **Sort Options**:
  - Staff Name (alphabetical)
  - Total Sessions (most sessions first)
  - First Training Date (earliest first)

### Summary Statistics
Three cards at the bottom showing:
1. **Total Staff in Training**: Count of active staff with training status
2. **Total Training Sessions**: Sum of all training sessions across all staff
3. **Clients in Training**: Count of unique clients with staff in training

### Visual Indicators
- **Role Badges**: Color-coded badges for RBT, BS, BCBA, EA, etc.
- **Training Type Badges**: 
  - Red badge with graduation cap for "Staff Overlap"
  - Yellow badge with graduation cap for "BCBA Overlap"
- **Session Progress**:
  - Gray: 0 sessions
  - Yellow: 1-2 sessions
  - Blue: 3-5 sessions
  - Green: 6+ sessions (with checkmark icon)

## Implementation Details

### Components
- **TrainingTracker.js** (New component)
  - Located in: `src/components/TrainingTracker.js`
  - Props: `staff`, `students`, `sharePointService`
  - Uses React hooks: `useState`, `useEffect`

### Services
- **SharePointService.getTrainingHistory()**
  - Added to: `src/services/SharePointService.js`
  - Parameters: 
    - `startDate` (optional): Start date for history query
    - `endDate` (optional): End date for history query
  - Returns: Array of training session records
  - Data sources:
    - `ScheduleHistory` list (finalized schedules)
    - `DailyAssignments` list (trainee assignments)

### Data Flow
1. Component loads and calls `getTrainingHistory()` for last 90 days
2. Service queries SharePoint for finalized schedules in date range
3. For each schedule, retrieves assignments marked as `IsTrainee: true`
4. Component processes data to group by staff member
5. Calculates first session date and total sessions per staff-client pair
6. Displays in sortable, filterable table

### Integration
- Added "Training" tab to main navigation (between Attendance and Validation)
- Uses existing `GraduationCap` icon from lucide-react
- Integrated with existing staff/student data structures
- Respects training status from student records

## Usage

1. Navigate to the **Training** tab in the main navigation
2. View list of all staff currently in training
3. Use **Program Filter** to focus on specific program
4. Use **Sort** dropdown to organize data
5. Click **Refresh Data** button to reload training history
6. Review summary statistics at bottom for overview

## Training Status Logic

Staff appear in Training Tracker if:
- They have active status (`isActive: true`)
- They are assigned to a student with training status:
  - `TRAINING_STATUS.OVERLAP_STAFF` (red badge)
  - `TRAINING_STATUS.OVERLAP_BCBA` (yellow badge)

Session counts are calculated from:
- Historical schedule data in `ScheduleHistory` list
- Where schedule status is "Finalized"
- Where assignment has `IsTrainee: true` flag
- Within the last 90 days (configurable)

## Future Enhancements

Potential improvements:
- Adjustable date range filter (30/60/90/180 days)
- Export training history to Excel
- Training progress goals (e.g., target 10 sessions)
- Training completion certificates
- Email notifications for training milestones
- Trainer assignments (who is training whom)
- Training notes/comments per session
- Calendar view of training sessions

## Technical Notes

### Performance Considerations
- Training history is cached in component state
- Manual refresh required to update data
- Queries limited to 90 days to reduce data load
- Batch queries used for SharePoint requests

### Dependencies
- React 18+
- lucide-react (icons)
- SharePoint REST API
- Existing TRAINING_STATUS constants from `types/index.js`

### Browser Compatibility
- Modern browsers (Chrome, Edge, Firefox, Safari)
- Requires JavaScript enabled
- Responsive design for mobile/tablet viewing

## Troubleshooting

**No staff showing in Training Tracker**
- Verify staff have `isActive: true`
- Check that students have training status set
- Confirm training status is OVERLAP_STAFF or OVERLAP_BCBA

**"No sessions yet" appears**
- Staff may be newly assigned to training
- Historical data may not exist yet (need finalized schedules)
- Check ScheduleHistory list has records with IsTrainee: true

**Sessions count seems low**
- Default query is last 90 days only
- Only counts finalized schedules
- Verify assignments have IsTrainee flag set correctly

## Related Documentation
- `TRAINING_FEATURE.md` - Original training feature documentation
- `TRAINING_IMPLEMENTATION_COMPLETE.md` - Training status implementation
- `TRAINING_UI_IMPROVEMENTS.md` - Training UI enhancements
- `SharePoint-Configuration.md` - SharePoint list setup

## Files Modified/Created

### New Files
- `src/components/TrainingTracker.js` - Training tracker component

### Modified Files
- `src/App.js` - Added training tab and component import
- `src/services/SharePointService.js` - Added getTrainingHistory() method

## Testing

To test the Training Tracker:
1. Navigate to Training tab
2. Verify staff with training status appear
3. Check that session counts are accurate
4. Test program filter functionality
5. Test sort options
6. Verify refresh button updates data
7. Check summary statistics are correct
8. Verify responsive design on different screen sizes
