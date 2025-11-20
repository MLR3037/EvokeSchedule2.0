# Quick Setup Guide - Live Schedule Improvements

## 🚀 What's New (November 19, 2025)

### 1. ✅ Temp Staff Now Saved in Schedules
**Before:** Temp staff disappeared when you loaded a saved schedule  
**After:** Temp staff persist in saved schedules and load back automatically

### 2. ✅ Live Schedule Popup Updates Instantly
**Before:** Editing times/lunch in main view didn't update the popup  
**After:** Changes appear in popup immediately as you type

### 3. ✅ Absent Students Grayed Out
**Before:** All students looked the same  
**After:** Students absent all day are grayed out and struck through

---

## 📋 One-Time Setup (Required)

### Add Column to SharePoint

You need to add ONE new column to your SharePoint list:

1. Go to: https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators
2. Click **Site Contents** → **DailyAssignments** list
3. Click **Add column** → **Yes/No**
4. Settings:
   - **Name:** `IsTempStaff`
   - **Description:** "Indicates if this is a temporary staff assignment"
   - **Default value:** No
5. Click **Save**

**That's it!** The column is now ready.

---

## 🎯 How to Use

### Temp Staff Persistence

**Before (Old Way):**
1. Add temp staff for the day
2. Build your schedule
3. Save schedule
4. Load schedule later → 😞 Temp staff gone!

**Now (New Way):**
1. Add temp staff for the day
2. Build your schedule
3. Save schedule
4. Load schedule later → ✅ Temp staff still there!

### Live Schedule Sync

**Before (Old Way):**
1. Open popup on second monitor
2. Edit times in main window
3. Popup shows old times → 😞 Not in sync

**Now (New Way):**
1. Open popup on second monitor
2. Edit times in main window
3. Popup updates instantly → ✅ Always in sync!

### Absent Student Styling

**Look for:**
- **Gray rows with strikethrough** = Student absent all day
- **Yellow rows** = Trainee assignments
- **White rows** = Present students
- **Red "ABSENT"** in cell = Absent for that session only

---

## 🧪 Quick Test

1. **Test Temp Staff:**
   - Add temp staff to a student
   - Save the schedule
   - Click "Clear Unlocked"
   - Click "Load Saved"
   - ✅ Temp staff should be back!

2. **Test Popup Sync:**
   - Open Live Schedule popup
   - Change a time in the main view
   - ✅ Popup should update instantly!

3. **Test Absent Styling:**
   - Mark a student absent for full day
   - Check Live Schedule tab
   - ✅ Row should be gray with strikethrough!

---

## ❓ Troubleshooting

### Temp Staff Not Saving
- Did you add the `IsTempStaff` column to SharePoint?
- Check browser console (F12) for errors
- Try saving and loading again

### Popup Not Updating
- Make sure popup is open when you edit
- Check if popup is on the same computer (not a different device)
- Try closing and reopening the popup

### Absent Rows Not Gray
- Student must be absent for BOTH AM and PM
- If only absent for one session, row won't be grayed (by design)
- Check that student is marked absent in Attendance tab

---

## 💡 Tips

### For Temp Staff:
- Temp staff are marked with ⏰ icon in the Full Team column
- They persist in saved schedules now!
- Still managed locally until date changes

### For Live Schedule:
- Open popup on second monitor/TV for display
- Edit times and lunch in main view
- Everything syncs automatically
- Great for team meetings!

### For Absent Students:
- Gray rows = Can skip when building schedule
- Makes it easy to see who's actually there
- Prevents assigning staff to absent students

---

## 📞 Need Help?

Check the detailed documentation: `LIVE_SCHEDULE_IMPROVEMENTS_NOV19.md`

---

**Version:** November 19, 2025  
**Status:** ✅ Ready to Use
