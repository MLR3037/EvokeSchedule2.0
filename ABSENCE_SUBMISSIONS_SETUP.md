# Absence Submissions – Setup Guide

Staff can now enter client and staff absences directly into a SharePoint list instead of sending Teams messages. The app automatically picks up pending submissions every time the page refreshes and applies them to the attendance view.

---

## How It Works

1. **Staff fill out a simple SharePoint form** (just like adding any list item in SharePoint)
2. **On the next app refresh**, the app finds all `Pending` submissions for today's date
3. **Absences are applied automatically** — the matching person's attendance flags are updated
4. **The submission is marked `Applied`** so it isn't double-processed
5. A **green banner** appears in the Attendance tab listing who was auto-marked absent
6. The scheduler **saves the schedule** to lock in the updated attendance

---

## Step 1 — Create the SharePoint List

Go to your SharePoint site and create a new **Custom list** called exactly:

```
AbsenceSubmissions
```

> ⚠️ The name must match exactly (case-sensitive). Do not add spaces or hyphens.

---

## Step 2 — Add Required Columns

Add the following columns to the list. The built-in **Title** column can be renamed to `PersonName`.

| Column Name      | Type            | Notes                                      |
|------------------|-----------------|--------------------------------------------|
| `PersonName`     | Single line     | Rename the built-in Title column to this   |
| `SubmissionDate` | Date (no time)  | The date the person will be absent         |
| `PersonType`     | Choice          | Options: `Staff`, `Client`                 |
| `AbsentAM`       | Yes/No          | Default: No                                |
| `AbsentPM`       | Yes/No          | Default: No                                |
| `AbsentFullDay`  | Yes/No          | Default: No (auto-sets AM+PM when checked) |
| `Notes`          | Multiple lines  | Optional — reason/context                  |
| `Status`         | Choice          | Options: `Pending`, `Applied` · Default: `Pending` |

---

## Step 3 — Set Permissions

- **All staff** who enter absences need **Contribute** access (to add list items)
- The app's **service account / logged-in user** needs **Edit** access (to update Status to `Applied`)

---

## Step 4 — Optional: Create a Custom New Form (Power Apps or default)

The default SharePoint **+ New** form works fine out of the box. Staff just:
1. Open the `AbsenceSubmissions` list
2. Click **+ New**
3. Fill in: Person Name, Date, Person Type, which sessions they'll miss
4. Click **Save**

That's it — no app access required for submitters.

---

## Step 5 — Test It

1. Add a test submission in the list for today's date with `Status = Pending`
2. Open the scheduler app
3. Click **Refresh** or navigate to the **Attendance** tab
4. You should see the green banner: *"1 absence submission auto-applied from SharePoint"*
5. Verify the person shows as absent in the Attendance tab
6. Check the SharePoint list — the submission's Status should now show `Applied`

---

## How the App Matches Names

The app matches submissions to staff/clients by **exact name** (case-insensitive).  
The name in `PersonName` must match exactly what appears in the **Staff** or **Clients** SharePoint list.

If a name doesn't match:
- The submission is skipped (not marked Applied)
- A warning is logged in the browser console: `⚠️ AbsenceSubmission: no staff match for "..."`

---

## Workflow for Staff

> **When someone calls out absent:**
> 1. Go to the `AbsenceSubmissions` SharePoint list
> 2. Click **+ New**
> 3. Enter the person's name, today's date, whether they are Staff or Client, and which sessions (AM / PM / Full Day)
> 4. Click **Save**
> 5. Notify the scheduler to **click Refresh** in the app

The scheduler will see the green banner confirming the absence was applied automatically.

---

## What Happens After Applied

- The submission row stays in the list but `Status` changes to `Applied`
- It won't be re-processed on the next refresh
- You can view all historical submissions for tracking/reporting purposes
- The app still writes the attendance to `DailyAttendance` when the schedule is saved

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Banner doesn't appear after refresh | Submission Status is not `Pending` | Check the list — it may have already been Applied |
| Person not found warning in console | Name typo in submission | Correct `PersonName` to match exactly |
| App shows warning "AbsenceSubmissions not found" | List doesn't exist yet | Create the list per Step 1 |
| Status not updating to Applied | Permission issue | Grant the logged-in user Edit access to the list |
