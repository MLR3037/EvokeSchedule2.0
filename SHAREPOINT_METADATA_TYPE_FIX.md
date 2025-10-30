# SharePoint Metadata Type Fix

## Problem
When saving schedules, got this error:
```
Failed to update schedule metadata: {"error":{"code":"-1, Microsoft.SharePoint.Client.InvalidClientQueryException","message":
"SP.Data.ScheduleHistoryListItem" could not be resolved by the model. When a model is available, each type name must resolve to a valid type."}}
```

## Root Cause
When SharePoint lists are renamed, the **display name** changes but the **internal EntityTypeName** does NOT change. 

For example:
- Original list name: `ABASchedules`
- Internal EntityTypeName: `SP.Data.ABASchedulesListItem` (locked at creation)
- Renamed to: `ScheduleHistory`
- EntityTypeName stays: `SP.Data.ABASchedulesListItem` (doesn't change!)

We were using `SP.Data.ScheduleHistoryListItem` (based on new name) but SharePoint still expects `SP.Data.ABASchedulesListItem` (based on original name).

## Solution
Updated the code to **dynamically detect** the correct EntityTypeName from SharePoint instead of hardcoding it.

### Changes in `SharePointService.js`

#### 1. Store Entity Type Names
```javascript
// After fetching list information
if (scheduleHistoryList && dailyAssignmentsList) {
  console.log('✅ Both required lists found! Proceeding with schedule save...');
  
  // Store entity type names for use in save operations
  this.scheduleHistoryEntityType = scheduleHistoryList.ListItemEntityTypeFullName;
  this.dailyAssignmentsEntityType = dailyAssignmentsList.ListItemEntityTypeFullName;
  
  console.log('📋 ScheduleHistory EntityType:', this.scheduleHistoryEntityType);
  console.log('📋 DailyAssignments EntityType:', this.dailyAssignmentsEntityType);
}
```

#### 2. Use Dynamic Entity Type in Schedule Save
```javascript
const scheduleData = {
  __metadata: { type: this.scheduleHistoryEntityType },  // Dynamic!
  Title: `Schedule_${schedule.date}`,
  // ... rest of fields
};
```

#### 3. Use Dynamic Entity Type in Assignment Save
```javascript
const assignmentData = {
  __metadata: { type: this.dailyAssignmentsEntityType || 'SP.Data.DailyAssignmentsListItem' },
  Title: `Assignment_${assignment.staffId}_${assignment.studentId}_${assignment.session}`,
  // ... rest of fields
};
```

## What This Does

1. **Fetches list metadata** from SharePoint when saving
2. **Reads the actual EntityTypeName** that SharePoint uses internally
3. **Uses that exact name** in the `__metadata.type` field
4. **Works regardless of list renaming** - always gets the correct name

## Console Output

When saving, you'll now see:
```
📋 Available lists on site:
  - ScheduleHistory (Internal: ABASchedules)
  - DailyAssignments (Internal: ABAAssignments)
✅ Both required lists found! Proceeding with schedule save...
📋 ScheduleHistory EntityType: SP.Data.ABASchedulesListItem
📋 DailyAssignments EntityType: SP.Data.ABAAssignmentsListItem
💾 Prepared schedule data for SharePoint: {...}
```

Notice:
- Display name: `ScheduleHistory`
- Internal name: `ABASchedules`
- Entity type: `SP.Data.ABASchedulesListItem` (based on internal name)

## Why This Happened

SharePoint's `EntityTypeName` is set when the list is **first created** and cannot be changed later. This is by design to prevent breaking external integrations.

When you rename a list:
- ✅ Display name updates
- ✅ URL path updates (with redirect)
- ❌ EntityTypeName stays the same (frozen at creation)
- ❌ ListItemEntityTypeFullName stays the same

## Benefits

✅ **No hardcoding**: Works with any list name  
✅ **Rename-proof**: Survives list renames  
✅ **Self-discovering**: Automatically finds correct type  
✅ **Future-proof**: Works if you recreate lists with different names  

## Testing

After this fix, try saving again. You should see:
1. List detection succeeds
2. Entity types logged correctly
3. Schedule saves without metadata errors
4. Assignments save successfully

---

**Date Fixed**: October 30, 2025  
**File Modified**: `src/services/SharePointService.js`  
**Error Fixed**: InvalidClientQueryException - metadata type not resolved
