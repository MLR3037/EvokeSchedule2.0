# SharePoint Permissions Fix

## Issue
Users in the "Clinistrators" group with edit access to the SharePoint lists were getting 401 (Unauthorized) errors when trying to use the Client Teams page.

### Errors Observed
- `Failed to load resource: the server responded with a status of 401 ()` on `/_api/contextinfo`
- `Error getting all site users: Error: Failed to get site users: 401`
- `Error loading users: Error: Failed to get site users: 401`

## Root Cause
The app was trying to call `/_api/web/siteusers` which requires site collection administrator permissions. Regular users (even with list edit permissions) don't have access to this endpoint.

## Solution

### 1. Graceful Fallback for Site Users Query
**File**: `src/services/PeoplePickerService.js`

Modified `getAllSiteUsers()` to:
- Return empty array instead of throwing error when 401 is encountered
- Log a warning that the user doesn't have permission
- Allow the app to continue functioning with reduced functionality

```javascript
if (response.status === 401) {
  console.warn('User does not have permission to query all site users. Using limited fallback.');
  return []; // Return empty array - search will work with searchUsers instead
}
```

### 2. Search API Fallback
**File**: `src/components/PeoplePicker.js`

Modified the `handleSearch()` function to:
- Use local filtering when `allUsers` is loaded (for admins)
- Fall back to SharePoint search API when `allUsers` is empty (for regular users)

```javascript
if (allUsers.length > 0) {
  // Filter locally (better performance)
  const filtered = allUsers.filter(...);
  setSearchResults(filtered);
} else {
  // Fallback to SharePoint search API
  const results = await peoplePickerService.searchUsers(text);
  setSearchResults(results.slice(0, 10));
}
```

### 3. Better Error Messages
**File**: `src/services/SharePointService.js`

Added specific error message for 401 authentication errors:
```javascript
} else if (response.status === 401) {
  throw new Error('Authentication failed. Please make sure you are logged in and have access to this SharePoint site.');
}
```

## Impact

### For Site Admins (Full Permissions)
- No change - app works exactly as before
- All users preloaded for faster searching

### For Regular Users (List Edit Permissions)
- People Picker still works via search
- Must type to search for users (no dropdown of all users)
- All other functionality unchanged

## Testing
1. Login as a user in the "Clinistrators" group
2. Navigate to Client Teams page
3. Try to add/edit team members using the People Picker
4. Type a name to search - should return results
5. Should not see 401 errors in console

## Related Files Modified
- `src/services/PeoplePickerService.js` - Graceful error handling
- `src/components/PeoplePicker.js` - Search fallback logic
- `src/services/SharePointService.js` - Better error messages
