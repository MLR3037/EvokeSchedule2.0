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

| Column Name              | Type            | Notes                                                                 |
|--------------------------|-----------------|-----------------------------------------------------------------------|
| `PersonName`             | Single line     | Rename the built-in Title column — used as fallback if lookup is blank |
| `SubmissionDate`         | Date (no time)  | The date the person will be absent                                    |
| `PersonType`             | Choice          | Options: `Staff`, `Client` — determines which lookup to use           |
| `StaffLookup`            | Lookup          | **Points to the Staff list · Column: StaffPerson (display name)**     |
| `ClientLookup`           | Lookup          | **Points to the Clients list · Column: Title**                        |
| `AbsentAM`               | Yes/No          | Default: No                                                           |
| `AbsentPM`               | Yes/No          | Default: No                                                           |
| `AbsentFullDay`          | Yes/No          | Default: No (auto-sets AM+PM when checked)                            |
| `EstimatedArrivalTime`   | **Date and Time** | For AbsentAM only — when are they arriving? Maps to attendance app.  |
| `EstimatedDepartureTime` | **Date and Time** | For AbsentPM only — when are they leaving? Maps to attendance app.   |
| `Notes`                  | Multiple lines  | Optional — reason/context                                             |
| `Status`                 | Choice          | Options: `Pending`, `Applied` · Default: `Pending`                    |

### About the Lookup Columns

- When **PersonType = Staff**, the submitter picks from the **StaffLookup** dropdown (pulls directly from the Staff list — no typos possible).
- When **PersonType = Client**, the submitter picks from the **ClientLookup** dropdown (pulls from the Clients list).
- The app matches by lookup ID, which is always accurate. The `PersonName` text field is only used as a last-resort fallback.

### Lookup Column Setup Details

**StaffLookup:**
1. Add a new Lookup column named `StaffLookup`
2. Get information from: **Staff** list
3. In this column: **StaffPerson** (or Title, whichever shows the display name)

**ClientLookup:**
1. Add a new Lookup column named `ClientLookup`
2. Get information from: **Clients** list
3. In this column: **Title**

### EstimatedArrivalTime / EstimatedDepartureTime

These are **Date and Time** columns (set to show time, not just date). Submitters use the date/time picker — no free-text, no format ambiguity.
- `EstimatedArrivalTime` — used when `AbsentAM = Yes` (they're coming in late for the AM session)
- `EstimatedDepartureTime` — used when `AbsentPM = Yes` (they're leaving early during the PM session)

SharePoint stores them as ISO 8601 timestamps (e.g. `2026-05-14T09:30:00Z`). The app stores the **full ISO string** so downstream systems get an unambiguous datetime. The scheduling app displays it in readable `h:mm AM/PM` format in the notification banner.

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

The app matches submissions to staff/clients by **lookup ID** (the value from `StaffLookup` or `ClientLookup`). This is always accurate and immune to typos.

If the lookup columns are blank (e.g. someone edited the list directly), the app falls back to matching by the `PersonName` text field (case-insensitive).

If neither matches:
- The submission is skipped (not marked Applied)
- A warning is logged in the browser console: `⚠️ AbsenceSubmission: no staff match for ID 42`

---

## Workflow for Staff

> **When someone calls out absent:**
> 1. Go to the `AbsenceSubmissions` SharePoint list
> 2. Click **+ New**
> 3. Select **PersonType** (Staff or Client)
> 4. Pick the person from the **StaffLookup** or **ClientLookup** dropdown — no typing, no typos
> 5. Enter today's date in **SubmissionDate**
> 6. Check the appropriate absence boxes (AM / PM / Full Day)
> 7. If **AbsentAM** — use the date/time picker for `EstimatedArrivalTime` (set to today + arrival time)
> 8. If **AbsentPM** — use the date/time picker for `EstimatedDepartureTime` (set to today + departure time)
> 9. Click **Save**
> 10. Notify the scheduler to **click Refresh** in the app

The scheduler will see the green banner confirming the absence was applied, including the estimated times.

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
