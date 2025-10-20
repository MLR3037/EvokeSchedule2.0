# Staff Training Management Feature

## Overview
The Training Management system tracks the certification status of staff members working with individual students. New staff must complete overlap sessions before working independently.

---

## Training Workflow

### 1. 🔴 **Staff Overlap** (Red Badge)
- **Purpose:** New staff member learns from existing team members
- **Duration:** Typically 3-5 sessions
- **Activities:** Shadow existing staff, observe techniques, build rapport with student
- **Next Step:** Move to BCBA Overlap once comfortable with student

### 2. 🟡 **BCBA Overlap** (Yellow Badge)
- **Purpose:** BCBA observes new staff working with student
- **Duration:** Typically 2-3 sessions
- **Activities:** BCBA provides oversight, feedback, and ensures protocol compliance
- **Next Step:** Move to Certified once approved by BCBA

### 3. 🟢 **Certified** (No Badge - Green Status)
- **Purpose:** Staff is fully trained and approved
- **Status:** Can work independently with this student
- **Note:** No badge displayed for certified staff (clean UI)

### 4. **Solo** (No Badge - Gray Status)
- **Purpose:** No training needed (existing team members)
- **Usage:** For staff who were on the team before training tracking began

---

## How to Use

### Access Training Tab
1. Click **"Training"** tab in main navigation (🎓 icon)
2. View dashboard with training statistics

### Update Training Status
1. Find the student in the list
2. Locate the staff member you want to update
3. Select new status from dropdown:
   - 🔴 Staff Overlap
   - 🟡 BCBA Overlap
   - 🟢 Certified
   - Solo (No Training)
4. Changes save automatically to SharePoint

### Filter Students
- **Search:** Type student name in search box
- **Program:** Filter by Primary/Secondary/All programs

---

## Visual Indicators

### Schedule Tab - Full Team Column
Training status badges appear next to staff names:

```
John Doe (RBT) [🔴 Staff]  ← Needs staff overlap
Jane Smith (RBT) [🟡 BCBA]  ← Needs BCBA overlap
Mike Jones (RBT)            ← Certified (no badge)
```

### Color Coding
- **Red Badge:** Staff Overlap needed
- **Yellow Badge:** BCBA Overlap needed
- **No Badge:** Certified or Solo (fully trained)

---

## SharePoint Setup

### Required Column
Add this column to the **Clients** list:

**Column Name:** `TeamTrainingStatus`
- **Type:** Multiple lines of text (Plain text)
- **Purpose:** Stores JSON data: `{"staffId": "status"}`
- **Example:** `{"23": "overlap-staff", "45": "certified"}`

### Migration
- Existing students: All team members default to "Solo" status
- New students: Set training status when adding staff to team

---

## Statistics Dashboard

The Training tab shows:
- **Total Assignments:** All staff-student pairs
- **Staff Overlap:** Count needing staff overlaps (🔴)
- **BCBA Overlap:** Count needing BCBA overlaps (🟡)
- **Certified:** Count fully certified (🟢)
- **Solo:** Count not in training (no tracking needed)

---

## Technical Details

### Data Model
```javascript
// Student class has:
teamTrainingStatus = {
  23: 'overlap-staff',  // Staff ID 23 needs staff overlap
  45: 'overlap-bcba',   // Staff ID 45 needs BCBA overlap
  67: 'certified',      // Staff ID 67 is certified
  89: 'solo'            // Staff ID 89 is existing (no training)
}
```

### Status Constants
```javascript
TRAINING_STATUS = {
  CERTIFIED: 'certified',        // Fully trained
  OVERLAP_BCBA: 'overlap-bcba',  // Needs BCBA
  OVERLAP_STAFF: 'overlap-staff', // Needs staff
  SOLO: 'solo'                   // Default/no training
}
```

### Methods
```javascript
student.getStaffTrainingStatus(staffId)  // Get status
student.setStaffTrainingStatus(staffId, status)  // Update status
student.isStaffCertified(staffId)  // Check if certified
```

---

## Benefits

### ✅ For Schedulers
- Visual tracking of training progress
- Clear oversight of certification status
- Easy status updates

### ✅ For BCBAs
- Track which staff need oversight
- Monitor training completion
- Ensure protocol compliance

### ✅ For New Staff
- Clear training path
- Transparent expectations
- Progress tracking

### ✅ For The System
- **No impact on auto-assignment** (informational only)
- Manual scheduling still available via lock-in feature
- Training data persists in SharePoint

---

## Future Enhancements

### Possible Additions:
1. **Validation Warnings:** Alert if training staff assigned solo
2. **Training Logs:** Track date of overlap sessions
3. **Bulk Updates:** Mark multiple staff at once
4. **Reports:** Export training progress reports
5. **Email Notifications:** Alert BCBA when staff ready for oversight
6. **Training Checklist:** Track specific competencies

---

## Troubleshooting

### Status Not Saving
1. Check browser console (F12) for errors
2. Verify `TeamTrainingStatus` column exists in Clients list
3. Ensure column type is "Multiple lines of text"
4. Check user has edit permissions on Clients list

### Badge Not Showing
1. Refresh the page
2. Verify training status is set in Training tab
3. Check that staff is actually on student's team

### Status Reset After Page Refresh
1. Column might be missing in SharePoint
2. Check console for save errors
3. Verify JSON format in SharePoint column

---

## Summary

The Training Management feature provides a **simple, visual way** to track staff certification without disrupting your existing scheduling workflow. It's:

- **Informational:** Doesn't affect auto-assignment
- **Visual:** Color-coded badges for quick status
- **Flexible:** Supports your existing training process
- **Persistent:** Saves to SharePoint automatically

**Next Steps:**
1. Add `TeamTrainingStatus` column to Clients list
2. Set training status for any new staff
3. Update status as training progresses
4. Monitor dashboard for oversight needs
