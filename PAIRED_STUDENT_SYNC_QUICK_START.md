# Paired Student Auto-Sync Feature - Quick Start Guide

## 🎯 What This Feature Does

### Automatic Staff Sync for Paired Students
When you manually assign a staff member to one paired student, the system automatically assigns the same staff to their paired partner.

```
BEFORE (Manual Process):
┌─────────────┐                  ┌─────────────┐
│  Alice      │                  │  Bob        │
│  (Paired)   │                  │  (Paired)   │
│ AM Session  │                  │ AM Session  │
│  - Empty    │                  │  - Empty    │
└─────────────┘                  └─────────────┘
       ↓ Assign Sarah                   ↓ Manually
┌─────────────┐                  ┌─────────────┐
│  Alice      │ User must do     │  Bob        │
│  - Sarah ✓  │ same work again  │  - Sarah ✓  │
└─────────────┘                  └─────────────┘


AFTER (With Auto-Sync):
┌─────────────┐                  ┌─────────────┐
│  Alice      │                  │  Bob        │
│  (Paired)   │                  │  (Paired)   │
│ AM Session  │                  │ AM Session  │
│  - Empty    │                  │  - Empty    │
└─────────────┘                  └─────────────┘
       ↓ Assign Sarah
┌─────────────┐                  ┌─────────────┐
│  Alice      │  Auto sync! →    │  Bob        │
│  - Sarah ✓  │◄────────────→    │  - Sarah ✓  │
└─────────────┘                  └─────────────┘
```

---

## 📋 Step-by-Step Usage

### Step 1: Load Schedule
```
1. Open the application
2. Select the date for scheduling
3. Load staff and students
```

### Step 2: Find Paired Student
```
Look for students with a "Paired With" value in SharePoint:
- Alice (Paired With: Bob)
- Bob (Paired With: Alice)
```

### Step 3: Assign Staff to First Student
```
1. Click on the paired student's session (AM or PM)
2. Select a staff member from the dropdown
3. Click "Assign" button

System automatically:
✅ Creates assignment for selected student
✅ Finds their paired partner
✅ Creates matching assignment for paired partner
```

### Step 4: Verify Both Have Staff
```
Check the schedule:
- Alice (Paired) now shows: Sarah
- Bob (Paired) now shows: Sarah

Both in same session, same staff ✓
```

---

## 🎓 Trainee Assignment Sync

Same process works for trainees:

```
1. Click on paired student's session
2. Select trainee from "Add Trainee" dropdown
3. Click "Add as Trainee"

System automatically:
✅ Adds trainee to selected student
✅ Adds same trainee to paired partner
✅ Both trainee assignments locked
```

---

## 🗑️ Removing Assignments

### Removing from Paired Student
```
1. Find the staff member assigned to student
2. Click the "X" or delete button
3. Confirm removal

System automatically:
✅ Removes from selected student
✅ Removes same staff from paired partner
✅ Both schedules updated
```

**Important**: Only MANUAL assignments are removed together. 
Auto-generated assignments won't remove the paired one.

---

## 🔧 2:1 Ratio Without Paired ID

### What Changed
Students with 2:1 ratio but NO paired student ID are treated as 1:1:

```
BEFORE (Incorrect):
Student: Charlie
Ratio: 2:1
Paired With: (empty)
Result: System expects 2 staff members ❌

AFTER (Fixed):
Student: Charlie  
Ratio: 2:1
Paired With: (empty)
Result: System treats as 1:1, needs 1 staff member ✓
```

---

## ✅ Validation Rules

Your assignments still follow all safety rules:

### Staff Must Be on Team
```
❌ Can't assign John if he's not on Alice's team
✅ Can assign Sarah if she's on both Alice's and Bob's teams
```

### No Double-Booking Unpaired Staff
```
❌ Can't assign Sarah to both Alice AND Charlie
   (different unpaired students, same session)
✅ CAN assign Sarah to both Alice AND Bob
   (paired students, same session)
```

### Session Times
```
AM: 8:45 - 11:30 (Primary) or 8:45 - 12:00 (Secondary)
PM: 12:00 - 15:00 (Primary) or 12:30 - 15:00 (Secondary)
```

---

## 🔍 How to Verify It's Working

### Check Console (F12)
Look for messages like:
```
🔗 PAIRED STUDENT SYNC: Syncing staff to paired student Bob
✅ Added paired assignment: Sarah → Bob (AM)
```

### Visual Check
```
Before assigning:
Alice (AM) - Empty
Bob (AM) - Empty

After assigning Sarah to Alice:
Alice (AM) - Sarah ✓
Bob (AM) - Sarah ✓

After removing Sarah from Alice:
Alice (AM) - Empty
Bob (AM) - Empty
```

### Test with Sample Data
```
1. Create two students with pairedWith linking them
2. Assign one staff member to the first student
3. Verify staff appears for both students
4. Remove the assignment
5. Verify it's removed from both
```

---

## ⚠️ Common Scenarios

### Scenario 1: Assigning to Unpaired Student
```
Student: Charlie (Ratio: 2:1, Paired With: empty)

Action: Assign Sarah
Result: 
✓ Sarah assigned to Charlie
✗ No paired assignment (Charlie isn't paired)
```

### Scenario 2: Pairing with Missing Partner
```
Student: Alice (Paired With: 999 - doesn't exist)

Action: Assign Sarah
Result:
✓ Sarah assigned to Alice
⚠️ Paired partner not found, sync skipped
Console shows: "Paired student with ID 999 not found"
```

### Scenario 3: Staff Not on Paired Student's Team
```
Students: Alice & Bob (paired)
Staff: Tom (on Alice's team, NOT on Bob's team)

Action: Assign Tom to Alice
Result:
✓ Tom assigned to Alice
✗ Sync blocked - Tom not on Bob's team
```

### Scenario 4: Duplicate Already Exists
```
Alice & Bob are paired
Sarah already assigned to both in AM

Action: Try to assign Sarah again
Result:
✓ Assignment to Alice created
✗ Paired assignment skipped (already exists)
Console: "Paired assignment already exists for Sarah"
```

---

## 🐛 Troubleshooting

### Feature Not Working?

**Check 1**: Are students actually paired?
```
Go to SharePoint Clients list
- Does Alice have "Bob" in Paired With field?
- Does Bob have "Alice" in Paired With field?
```

**Check 2**: Is staff on both teams?
```
Go to SharePoint Clients list
- Alice's team includes staff member?
- Bob's team includes staff member?
```

**Check 3**: Are students loaded?
```
Click "Refresh" to reload students from SharePoint
Check console for load messages
```

**Check 4**: Check browser console
```
F12 → Console tab
Look for messages starting with 🔗 or ✅
Red error messages? Take a screenshot
```

### Still Not Working?

1. Clear browser cache: Ctrl+Shift+Del
2. Refresh page: F5 or Ctrl+R
3. Check browser console for errors: F12
4. Verify SharePoint columns exist and have values
5. Contact support with console error messages

---

## 📊 Assignment States

```
✅ Manual Assignment (Both Paired Students)
   - Created by user action
   - Synced to paired partner
   - Removal cascades to both

✅ Trainee Assignment (Both Paired Students)
   - Created separately for trainee
   - Synced to paired partner
   - Locked automatically
   - Removal cascades to both

🔄 Auto-Generated Assignment
   - Created by auto-assign engine
   - NOT synced (prevents cascade)
   - Can be manually moved/locked
   - Removal is independent

❌ Blocked Assignment
   - Staff not on team
   - Double-booking violation
   - Shows error message
   - Not created
```

---

## 💡 Pro Tips

### Tip 1: Speed Up Scheduling
Assign staff to the first student in a pair, paired student gets it automatically.

### Tip 2: Consistent Teams
Keep paired students' teams in sync for best results. If Sarah is on Alice's team, she should be on Bob's team too.

### Tip 3: Use Templates
Assign common staff pairings first, use Smart Swap to fill remaining gaps.

### Tip 4: Batch Remove
Removing from one paired student automatically removes from both.

### Tip 5: Verify Before Saving
Check both paired students show correct staff before clicking Save.

---

## 📚 More Information

For detailed technical information, see:
- `PAIRED_STUDENT_AUTO_SYNC.md` - Feature overview
- `PAIRED_STUDENT_SYNC_IMPLEMENTATION.md` - Technical details
- `PAIRED_STUDENT_AUTO_SYNC_SUMMARY.md` - Implementation summary

For testing details, see:
- `src/tests/PairedStudentSyncTest.js` - Test suite

---

## ✨ Summary

| Feature | Before | After |
|---------|--------|-------|
| Assign staff to paired student | Manual for both | Auto-sync both |
| Remove staff from paired student | Manual for both | Auto-removes both |
| 2:1 without pair | Expects 2 staff | Treats as 1:1 |
| Time to schedule pair | Double effort | Half effort |
| Consistency | Manual errors | Automatic |
| Error prevention | Limited | Enhanced |

---

**Ready to use! Start scheduling with paired student sync enabled. 🚀**
