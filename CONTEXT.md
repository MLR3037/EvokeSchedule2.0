# ABA Scheduler - Development Context

## 📁 Project Structure Overview

```
evoke-schedule/
├── src/
│   ├── types/
│   │   └── index.js                    # 🔄 Staff/Student data models (UPDATED)
│   ├── services/
│   │   ├── SharePointService.js        # 🔄 SharePoint CRUD operations (UPDATED)
│   │   ├── PeoplePickerService.js      # ✨ People Picker utilities (NEW)
│   │   └── AutoAssignmentEngine.js     # Scheduling algorithm
│   ├── components/
│   │   ├── SchedulingComponents.js     # Schedule grid and session components
│   │   ├── ValidationComponents.js     # Validation and rules display
│   │   ├── DataManagementComponents.js # 🔄 Staff/Student forms (UPDATED)
│   │   ├── PeoplePicker.js            # ✨ People Picker components (NEW)
│   │   └── TeamManagement.js          # ✨ Team management interface (NEW)
│   ├── data/
│   │   └── sampleData.js              # Test data
│   ├── tests/
│   │   └── SchedulingTestSuite.js     # Comprehensive tests
│   ├── App.js                         # 🔄 Main application (UPDATED)
│   └── index.js                       # Entry point
├── public/                            # Static assets
├── SharePoint-Configuration.md        # 🔄 SharePoint setup guide (UPDATED)
├── RECENT_CHANGES.md                  # ✨ Latest session summary (NEW)
├── CONTINUATION_GUIDE.md              # ✨ Cross-device guide (NEW)
├── CONTEXT.md                         # ✨ This file (NEW)
├── package.json                       # Dependencies
└── README.md                          # Project documentation
```

## 🎯 **Current Development Phase**

### **Phase**: Post-Implementation, Pre-Testing
- **Completed**: Major field restructure and team management features
- **Status**: Code complete, ready for SharePoint list updates
- **Next**: SharePoint configuration and testing

## 🔑 **Key Concepts**

### **Staff Management**
- **Programs**: Yes/No checkboxes (Primary/Secondary) instead of arrays
- **People Picker**: Integration with SharePoint user directory
- **No MaxStudents**: Teams adapt dynamically to client needs

### **Student/Client Management**  
- **Ratios**: Separate AM/PM fields for flexible scheduling
- **Teams**: People Picker multi-select for team assignments
- **Simplified**: Removed excluded staff and special requirements

### **Team Management**
- **Dual Views**: Staff→Clients and Clients→Staff perspectives
- **Real-time**: Live statistics and team composition
- **Editable**: Direct editing from team management interface

## 🔄 **Recent Major Changes**

### **Data Model Evolution**
```javascript
// OLD Staff Model
{
  primaryPrograms: ['Primary', 'Secondary'], // Array
  maxStudents: 3                            // Number
}

// NEW Staff Model  
{
  primaryProgram: true,    // Boolean
  secondaryProgram: false  // Boolean
  // maxStudents removed
}

// OLD Student Model
{
  ratio: '1:1',                    // Single field
  preferredStaff: [1, 2, 3],      // Staff IDs
  excludedStaff: [4, 5]           // Staff IDs
}

// NEW Student Model
{
  ratioAM: '1:1',     // AM session ratio
  ratioPM: '2:1',     // PM session ratio  
  team: [             // People Picker objects
    { id: 1, title: 'John Doe', email: 'john@example.com' }
  ]
  // excludedStaff removed
}
```

## 🛠 **Technical Stack**

### **Frontend**
- **React 19.2.0**: Modern React with hooks
- **Tailwind CSS 3.4.0**: Utility-first styling
- **Lucide React**: Icon library
- **MSAL**: SharePoint authentication

### **Backend Integration**
- **SharePoint Lists**: Data storage
- **SharePoint REST API**: CRUD operations
- **People Picker API**: User management
- **MSAL Authentication**: Secure access

### **Architecture Patterns**
- **Component-based**: Modular React components
- **Service layer**: Separate business logic
- **Data models**: Structured classes for consistency
- **State management**: React hooks and context

## 🎨 **UI/UX Approach**

### **Design Principles**
- **Clean & Simple**: Minimal, functional interface
- **Role-based**: Different views for different users
- **Responsive**: Works on desktop and tablet
- **Accessible**: Proper labels and keyboard navigation

### **Color Coding**
- **Blue**: Staff-related elements
- **Green**: Student/client-related elements  
- **Purple**: Team management features
- **Indigo**: Navigation and primary actions

## 🔐 **Security & Permissions**

### **SharePoint Security**
- **Site Members**: Contribute access to lists
- **Site Owners**: Full control for management
- **People Picker**: Respects SharePoint permissions
- **MSAL**: Secure authentication flow

## 📈 **Performance Considerations**

### **Optimization Strategies**
- **People Picker**: Local filtering for better performance
- **Data Loading**: Parallel loading of staff/students/schedules
- **Component Updates**: React memoization where appropriate
- **API Calls**: Batch operations and proper error handling

## 🧪 **Testing Strategy**

### **Test Coverage**
- **Unit Tests**: Data models and utilities
- **Integration Tests**: SharePoint service operations
- **Component Tests**: Form validation and interactions
- **E2E Tests**: Complete user workflows

### **Test Data**
- **Sample Data**: Realistic test scenarios in `sampleData.js`
- **Edge Cases**: Boundary conditions and error states
- **Performance**: Large dataset testing

---
*This context file provides a comprehensive overview for developers joining or continuing the project*