# Development Workflow - Computer Switching Guide

## 🏠 **Local Development Setup**

### **This Computer (Current Setup)**
- **Local Path**: `C:\Dev\EvokeSchedule2.0\evoke-schedule`
- **GitHub Repo**: `https://github.com/MLR3037/EvokeSchedule2.0.git`
- **Status**: ✅ Connected and ready

### **Other Computer Setup**
```powershell
# 1. Create local development directory
mkdir C:\Dev\EvokeSchedule2.0
cd C:\Dev\EvokeSchedule2.0

# 2. Clone the repository
git clone https://github.com/MLR3037/EvokeSchedule2.0.git evoke-schedule
cd evoke-schedule

# 3. Install dependencies
npm install

# 4. Open in VS Code
code .
```

## 🔄 **Daily Workflow**

### **Starting Work Session**
```powershell
cd C:\Dev\EvokeSchedule2.0\evoke-schedule
git pull  # Get latest changes from other computer
npm start # Start development server
```

### **Ending Work Session**
```powershell
git add .
git commit -m "Description of what you worked on"
git push  # Send changes to GitHub for other computer
```

## ✅ **Benefits**
- ❌ **No more OneDrive sync conflicts**
- ✅ **Seamless switching between computers**
- ✅ **Full version control with Git**
- ✅ **Professional development workflow**
- ✅ **Automatic backup to GitHub**

## 📁 **File Structure**
```
C:\Dev\EvokeSchedule2.0\evoke-schedule\
├── src/                          # All your React components
├── SharePoint-Configuration.md   # SharePoint setup guide
├── RECENT_CHANGES.md             # Latest session summary
├── CONTINUATION_GUIDE.md         # Cross-computer guide
└── WORKFLOW.md                   # This file
```

---
*Created: October 6, 2025*
*Purpose: Enable smooth development across multiple computers*