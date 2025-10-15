# ABA Scheduler - GitHub Pages Deployment with Microsoft Authentication

## Final Deployment Approach

Due to SharePoint's security restrictions that block JavaScript execution from document libraries and embedded content, we've deployed the app to GitHub Pages with Microsoft OAuth authentication.

## App URL
**Live App:** https://mlr3037.github.io/EvokeSchedule2.0/

## How It Works

### Authentication Flow:
1. **User visits the app** → App checks for existing authentication
2. **If not authenticated** → Shows "Sign in with Microsoft" button
3. **User clicks Sign In** → Redirects to Microsoft login page
4. **User enters Microsoft credentials** → Microsoft validates against your tenant
5. **Success** → User is redirected back to app with access token
6. **App loads real SharePoint data** → Staff, Clients, and schedules from your lists

### Features:
- ✅ **No SharePoint hosting restrictions** - Runs from external domain
- ✅ **Microsoft authentication** - Uses your existing Office 365 accounts
- ✅ **Real SharePoint data** - Connects to your Staff and Clients lists via REST API
- ✅ **Secure access tokens** - Cached locally for seamless experience
- ✅ **Cross-device compatibility** - Works on desktop, tablet, mobile

## Sharing the App

### For Internal Users:
Simply share this link: **https://mlr3037.github.io/EvokeSchedule2.0/**

Users will need:
- A Microsoft account in your tenant (evokebehavioralhealthcom)
- Read access to the SharePoint lists (Staff, Clients, ABASchedules)

### For External Users:
External users would need to be added as guest users to your tenant first.

## User Experience

1. **First Visit:**
   - User sees the app with a "Sign in with Microsoft" button
   - Clicking it redirects to familiar Microsoft login page
   - After signing in, they're back in the app with full access

2. **Subsequent Visits:**
   - App automatically detects existing authentication
   - No need to sign in again (token cached for 1 hour)
   - Immediate access to real data

## Technical Details

### Authentication:
- **Protocol:** OAuth 2.0 with Microsoft Azure AD
- **Scope:** SharePoint Sites.ReadWrite.All + User.Read
- **Token Storage:** Browser localStorage (secure, local only)
- **Token Expiry:** Automatically refreshed as needed

### Data Access:
- **SharePoint REST API** calls with Bearer token authentication
- **Real-time data** from your SharePoint lists
- **CORS-enabled** through Microsoft Graph API

### Security:
- **No credentials stored** in the app or code
- **Tokens expire** and require re-authentication
- **Same security model** as other Microsoft 365 apps

## Troubleshooting

### If users can't sign in:
1. Verify they have a valid Microsoft account in your tenant
2. Check they have access to the SharePoint site: https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators
3. Ensure the Azure AD app registration is properly configured

### If data doesn't load:
1. Check that SharePoint lists exist: Staff, Clients, ABASchedules
2. Verify list permissions allow read access
3. Use browser dev tools (F12) to check for API errors

### Clear authentication issues:
- App includes a "Clear Auth" button for troubleshooting
- Users can manually clear browser data if needed

## Benefits of This Approach

1. **No IT restrictions** - Bypasses SharePoint's JavaScript limitations
2. **Familiar authentication** - Uses existing Microsoft login
3. **Real data integration** - Direct access to SharePoint lists
4. **Easy sharing** - Just send a link
5. **Mobile-friendly** - Works on any device with a browser
6. **Future-proof** - Independent of SharePoint hosting policies