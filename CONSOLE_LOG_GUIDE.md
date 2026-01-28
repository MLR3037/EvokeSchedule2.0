# Console Logging Guide

## Console Noise Reduction

The console logs have been streamlined to show only **critical information** by default, making it easier to debug issues like missing main staff assignments.

## Current Console Output

### What You'll Always See (Critical Logs):

#### Staff Eligibility Checks
- ✅ `ELIGIBLE for [Student]` - Staff who CAN be assigned
- 🚫 `EXCLUDING` - Staff in training (trainee-only)
- 🚫 `BLOCKING: NO SOLO CASES` - Training-only staff who can't be auto-assigned
- 🚫 `SAME-DAY SKIP` - Preventing same staff with same student both sessions

#### Assignment Results
- ✅ `[Student] [Session]: [Staff Names]` - Successful full assignments
- ⚠️ `PARTIAL [Student]: 1/2` - Partially assigned (missing staff)
- ❌ `NO STAFF assigned to [Student]` - Complete failure
- ❌ `INSUFFICIENT for [Student]: Need 2, have 1` - Not enough team members available
- 📊 `Team members available for [Student]: 3` - Count of eligible staff

#### Phase Summaries
- 🚀 `STARTING AUTO-ASSIGNMENT`
- 📋 `===== Primary AM =====` - Session headers
- 📊 `Attendance` - Who's absent
- 🔄 `PHASE 2: Full Reshuffle` - Gap-filling attempts
- 🎉 `AUTO-ASSIGNMENT COMPLETE` - Final summary

### What You'll See Only in Verbose Mode:

Set `this.verboseLogging = true` in [AutoAssignmentEngine.js](src/services/AutoAssignmentEngine.js) constructor to enable:

- Detailed team breakdowns (RBT/BS/EA counts)
- Assignment ordering details
- Individual validation errors
- Role preference selections
- Step-by-step assignment progress

## Debugging Main Staff Not Showing

Look for these patterns in the console:

### 1. Check Eligibility
```
✅ John Doe ELIGIBLE for StudentName (status: solo)
✅ Jane Smith ELIGIBLE for StudentName (status: trainer)
```
**If you DON'T see eligible staff:** They're being blocked. Look for:
- 🚫 `EXCLUDING` - Staff is in training (overlap)
- 🚫 `BLOCKING: NO SOLO CASES` - Staff has no solo certifications

### 2. Check Team Availability
```
📊 Team members available for StudentName AM: 3
```
**If count is too low:** Check SharePoint team configuration

### 3. Check Assignment Results
```
✅ StudentName AM: John Doe, Jane Smith
⚠️ PARTIAL StudentName AM: 1/2 - John Doe
❌ NO STAFF assigned to StudentName AM (needed 2)
```

### 4. Check for Same-Day Blocking
```
🚫 SAME-DAY SKIP: John Doe already with StudentName in PM
```
This prevents the same staff from working with the same student all day.

## Quick Toggle

To temporarily see ALL logs (for deep debugging):

1. Open `src/services/AutoAssignmentEngine.js`
2. Change line ~30: `this.verboseLogging = false;` to `true`
3. Refresh and auto-schedule again
4. Set back to `false` when done

## Common Issues

### Main Staff Not Showing After Auto-Schedule

**Look for:**
1. ✅ Lines showing who is ELIGIBLE
2. 📊 Team member count
3. 🚫 BLOCKING or EXCLUDING messages
4. Final assignment results for that student

**Most Common Causes:**
- Staff are marked as "overlap" (in training) in SharePoint
- Staff have no solo cases (training-only)
- Not enough team members configured for the student
- Staff already assigned to the same student in the other session
