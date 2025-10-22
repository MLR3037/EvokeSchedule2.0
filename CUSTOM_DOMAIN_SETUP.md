# Custom Domain Setup for Evoke Schedule

## Your New URL will be: https://schedule.evokebehavioralhealth.com

## What I've Done:
✅ Created CNAME file with your custom domain
✅ Updated package.json to use custom domain
✅ Changed browser tab title to "Evoke Schedule"

## What YOU Need to Do:

### Step 1: Configure DNS Records (with your domain provider)

You need to add a DNS record with whoever manages `evokebehavioralhealth.com` (likely GoDaddy, Namecheap, Cloudflare, etc.)

**Add this DNS record:**
- **Type**: CNAME
- **Name/Host**: `schedule`
- **Value/Points to**: `mlr3037.github.io`
- **TTL**: Automatic or 3600

### Step 2: Push Changes to GitHub

Run these commands:
```bash
npm run build
git add -A
git commit -m "Configure custom domain: schedule.evokebehavioralhealth.com"
git push origin main
```

### Step 3: Enable HTTPS in GitHub Settings

1. Go to: https://github.com/MLR3037/EvokeSchedule2.0/settings/pages
2. Under "Custom domain", you should see: `schedule.evokebehavioralhealth.com`
3. Wait a few minutes for DNS to propagate
4. Check the box: "Enforce HTTPS"

### Step 4: Test Your New URL

After DNS propagates (can take 5 minutes to 24 hours), visit:
**https://schedule.evokebehavioralhealth.com**

## DNS Setup Help by Provider:

### If using GoDaddy:
1. Log into GoDaddy
2. Go to "My Products" → "DNS"
3. Click "Add" under DNS Records
4. Type: CNAME, Name: schedule, Value: mlr3037.github.io, TTL: 1 hour

### If using Cloudflare:
1. Log into Cloudflare
2. Select your domain
3. Go to "DNS" tab
4. Add record: Type CNAME, Name: schedule, Target: mlr3037.github.io

### If using Namecheap:
1. Log into Namecheap
2. Go to Domain List → Manage
3. Advanced DNS tab
4. Add New Record: Type CNAME, Host: schedule, Value: mlr3037.github.io

## Troubleshooting:

**If it's not working:**
1. Check DNS propagation: https://www.whatsmydns.net/#CNAME/schedule.evokebehavioralhealth.com
2. Make sure CNAME record points to: mlr3037.github.io (NO https://, NO trailing slash)
3. Wait 24 hours for DNS to fully propagate
4. Clear your browser cache

**Need Help?**
Contact your IT department or domain administrator to add the CNAME record.
