import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Save, 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  LogIn, 
  LogOut, 
  Users, 
  Play,
  Settings,
  BarChart3,
  Clock
} from 'lucide-react';

// Import our new components and services
import { Staff, Student, Schedule, Assignment, SchedulingUtils } from './types/index.js';
import { SharePointService } from './services/SharePointService.js';
import { PeoplePickerService } from './services/PeoplePickerService.js';
import { AutoAssignmentEngine } from './services/AutoAssignmentEngine.js';
import { 
  ScheduleGrid, 
  ScheduleTableView,
  SessionSummary 
} from './components/SchedulingComponents.js';
import { 
  ValidationPanel, 
  ConstraintRulesDisplay 
} from './components/ValidationComponents.js';
import { 
  StaffForm, 
  StudentForm 
} from './components/DataManagementComponents.js';
import TeamManagement from './components/TeamManagement.js';
import AttendanceManagement from './components/AttendanceManagement.js';
import { runTests } from './tests/SchedulingTestSuite.js';
import ErrorBoundary from './components/ErrorBoundary.js';

const ABAScheduler = () => {
  // SharePoint configuration
  const [spConfig] = useState({
    siteUrl: 'https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators',
    staffListName: 'Staff',
    studentsListName: 'Clients',
    scheduleListName: 'ABASchedules',
    // Azure AD Configuration for external hosting
    clientId: 'c9f70b7e-8ffb-403d-af93-80b95b38a0bb',
    tenantId: 'a4adcc38-7b4e-485c-80f9-7d9ca4e83d64',
    redirectUri: window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : 'https://mlr3037.github.io/EvokeSchedule2.0'
  });

  // Services
  const [sharePointService] = useState(() => new SharePointService(spConfig));
  const [peoplePickerService] = useState(() => new PeoplePickerService(spConfig));
  const [autoAssignEngine] = useState(() => new AutoAssignmentEngine());


  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  // Core data
  const [staff, setStaff] = useState([]);
  const [students, setStudents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState(new Schedule({ date: new Date() }));

  // UI state
  const [activeTab, setActiveTab] = useState('schedule');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  
  // Modal states
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Test state
  const [testResults, setTestResults] = useState(null);
  const [isTestRunning, setIsTestRunning] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);


  // Initialize application
  const initializeApp = async () => {
    try {
      // First ensure MSAL is initialized before any authentication checks
      await sharePointService.initializeMSAL();
      
      const isAuth = await sharePointService.checkAuthentication();
      setIsAuthenticated(isAuth);
      setAccessToken(sharePointService.accessToken);
      
      // Set access token for People Picker service
      if (sharePointService.accessToken) {
        peoplePickerService.setAccessToken(sharePointService.accessToken);
      }
      
      if (isAuth) {
        await loadData();
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      if (error.message.includes('session has expired') || error.message.includes('Authentication')) {
        // Handle authentication errors gracefully
        setIsAuthenticated(false);
        setAccessToken(null);
      }
    }
  };

  // Load all data from SharePoint
  const loadData = async () => {
    setLoading(true);
    try {
      // Load staff, students, and schedule in parallel
      const [staffData, studentsData, scheduleData] = await Promise.all([
        sharePointService.loadStaff().catch(err => {
          console.error('Failed to load staff:', err);
          return [];
        }),
        sharePointService.loadStudents().catch(err => {
          console.error('Failed to load students:', err);
          return [];
        }),
        sharePointService.loadSchedule(currentDate).catch(err => {
          console.error('Failed to load schedule:', err);
          return { assignments: [], date: currentDate };
        })
      ]);

      setStaff(staffData);
      setStudents(studentsData);
      setSchedule(scheduleData);
      
      console.log(`✅ Loaded ${staffData.length} staff, ${studentsData.length} students`);
      
      if (staffData.length === 0 && studentsData.length === 0) {
        console.warn('⚠️ No data loaded. Check authentication and SharePoint list names.');
      }
    } catch (error) {
      console.error('💥 Error loading data:', error);
      // Set empty arrays to prevent crashes
      setStaff([]);
      setStudents([]);
      setSchedule({ assignments: [], date: currentDate });
    } finally {
      setLoading(false);
    }
  };

  // Handle date change
  const handleDateChange = async (newDate) => {
    setCurrentDate(newDate);
    if (isAuthenticated) {
      try {
        // Check if date actually changed (not just same day)
        const oldDateStr = currentDate.toDateString();
        const newDateStr = newDate.toDateString();
        
        if (oldDateStr !== newDateStr) {
          console.log('📅 Date changed, clearing attendance for new day...');
          await clearAllAttendance();
        }
        
        const scheduleData = await sharePointService.loadSchedule(newDate);
        setSchedule(scheduleData);
      } catch (error) {
        console.error('Error loading schedule for new date:', error);
      }
    }
  };

  // Clear all attendance for a new day
  const clearAllAttendance = async () => {
    try {
      // Clear attendance for all staff
      const clearedStaff = staff.map(s => new Staff({
        ...s,
        absentAM: false,
        absentPM: false,
        absentFullDay: false
      }));
      
      // Clear attendance for all students
      const clearedStudents = students.map(s => new Student({
        ...s,
        absentAM: false,
        absentPM: false,
        absentFullDay: false
      }));
      
      // Update local state immediately
      setStaff(clearedStaff);
      setStudents(clearedStudents);
      
      // Save to SharePoint in background
      const savePromises = [
        ...clearedStaff.map(s => 
          sharePointService.saveStaff(s, true).catch(err => 
            console.error(`Failed to clear attendance for staff ${s.name}:`, err)
          )
        ),
        ...clearedStudents.map(s => 
          sharePointService.saveStudent(s, true).catch(err => 
            console.error(`Failed to clear attendance for student ${s.name}:`, err)
          )
        )
      ];
      
      await Promise.all(savePromises);
      console.log('✅ All attendance cleared for new day');
    } catch (error) {
      console.error('Error clearing attendance:', error);
    }
  };

  // Authentication handlers
  const handleLogin = async () => {
    try {
      setLoading(true);
      const loginSuccessful = await sharePointService.login();
      
      if (loginSuccessful) {
        setIsAuthenticated(true);
        setAccessToken(sharePointService.accessToken);
        
        // Set access token for People Picker service
        if (sharePointService.accessToken) {
          peoplePickerService.setAccessToken(sharePointService.accessToken);
        }
        
        // Load data after successful authentication
        await loadData();
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(`Login failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sharePointService.forceLogout();
    setIsAuthenticated(false);
    setAccessToken(null);
    setStaff([]);
    setStudents([]);
    setSchedule(new Schedule({ date: currentDate }));
  };

  // Clear authentication (useful for fixing 401 errors)
  const clearAuthentication = () => {
    localStorage.removeItem('sp_access_token');
    localStorage.removeItem('sp_token_expiry');
    sharePointService.accessToken = null;
    sharePointService.tokenExpiry = null;
    setIsAuthenticated(false);
    setAccessToken(null);
    alert('Authentication cache cleared. Please refresh the page and log in again.');
  };

  // Auto-assignment
  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    
    try {
      const result = await autoAssignEngine.autoAssignSchedule(schedule, staff, students);
      
      if (result.assignments.length > 0) {
        // Combine existing assignments with new auto-assignments
        const allAssignments = [...schedule.assignments, ...result.assignments];
        
        // Force re-render by creating a new Schedule instance with ALL assignments
        const newSchedule = new Schedule({
          date: schedule.date,
          assignments: allAssignments,
          lockedAssignments: schedule.lockedAssignments,
          isFinalized: schedule.isFinalized
        });
        setSchedule(newSchedule);
      }
      
      if (result.errors.length > 0) {
        console.warn('Auto-assignment errors:', result.errors);
      }
    } catch (error) {
      console.error('Auto-assignment failed:', error);
      alert('Auto-assignment failed. Please check the console for details.');
    } finally {
      setAutoAssigning(false);
    }
  };

// Assignment management
const handleAssignmentLock = (assignmentId) => {
  schedule.lockAssignment(assignmentId);
  
  // Create new Schedule instance to trigger re-render
  const newSchedule = new Schedule({
    date: schedule.date,
    assignments: [...schedule.assignments],
    lockedAssignments: new Set(schedule.lockedAssignments),
    isFinalized: schedule.isFinalized
  });
  
  setSchedule(newSchedule);
};

const handleAssignmentUnlock = (assignmentId) => {
  schedule.unlockAssignment(assignmentId);
  
  // Create new Schedule instance to trigger re-render
  const newSchedule = new Schedule({
    date: schedule.date,
    assignments: [...schedule.assignments],
    lockedAssignments: new Set(schedule.lockedAssignments),
    isFinalized: schedule.isFinalized
  });
  
  setSchedule(newSchedule);
};

const handleManualAssignment = ({ staffId, studentId, session, program }) => {
  const assignment = new Assignment({
    id: SchedulingUtils.generateAssignmentId(),
    staffId,
    studentId,
    session,
    program,
    date: currentDate,
    isLocked: false,
    assignedBy: 'manual'
  });

  // Add assignment to schedule
  schedule.addAssignment(assignment);
  
  // Force re-render with new Schedule instance
  const newSchedule = new Schedule({
    date: schedule.date,
    assignments: [...schedule.assignments], // Create new array reference
    lockedAssignments: new Set(schedule.lockedAssignments),
    isFinalized: schedule.isFinalized
  });
  
  setSchedule(newSchedule);
};

const handleAssignmentRemove = (assignmentId) => {
  console.log('🗑️ Removing assignment:', assignmentId);
  
  schedule.removeAssignment(assignmentId);
  schedule.unlockAssignment(assignmentId); // Also unlock if it was locked
  
  // Force re-render with new Schedule instance
  const newSchedule = new Schedule({
    date: schedule.date,
    assignments: [...schedule.assignments], // Create new array reference
    lockedAssignments: new Set(schedule.lockedAssignments),
    isFinalized: schedule.isFinalized
  });
  
  setSchedule(newSchedule);
  
  console.log('✅ Assignment removed. Total assignments:', newSchedule.assignments.length);
};

  // Save schedule
  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      // Ensure schedule has the current date
      const scheduleToSave = {
        ...schedule,
        date: currentDate.toISOString().split('T')[0]
      };

      const success = await sharePointService.saveSchedule(scheduleToSave);
      
      if (success) {
        console.log('✅ Schedule saved successfully to SharePoint');
        alert('Schedule saved successfully! Historical data is now available for rule checking.');
      } else {
        console.log('ℹ️ Schedule save failed - check browser console for details');
        alert('Failed to save schedule. Please check the browser console (F12 → Console) for detailed error information. This might be due to missing SharePoint lists, permissions, or column naming issues.');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error saving schedule: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Staff management
  const handleAddStaff = async (staffData) => {
    setSaving(true);
    try {
      const newStaff = new Staff(staffData);
      await sharePointService.saveStaff(newStaff);
      await loadData(); // Reload data to get updated list
      setShowAddStaff(false);
      alert('Staff member added successfully!');
    } catch (error) {
      console.error('Error adding staff:', error);
      alert(`Failed to add staff: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditStaff = async (staffData) => {
    setSaving(true);
    try {
      const updatedStaff = new Staff({ ...staffData, id: editingStaff.id });
      await sharePointService.saveStaff(updatedStaff, true);
      await loadData(); // Reload data
      setEditingStaff(null);
      setShowAddStaff(false);
      alert('Staff member updated successfully!');
    } catch (error) {
      console.error('Error updating staff:', error);
      alert(`Failed to update staff: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await sharePointService.deleteStaff(staffId);
        await loadData();
      } catch (error) {
        console.error('Error deleting staff:', error);
      }
    }
  };

  // Student management
  const handleAddStudent = async (studentData) => {
    setSaving(true);
    try {
      const newStudent = new Student(studentData);
      await sharePointService.saveStudent(newStudent);
      await loadData();
      setShowAddStudent(false);
      alert('Student added successfully!');
    } catch (error) {
      console.error('Error adding student:', error);
      alert(`Failed to add student: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditStudent = async (studentData) => {
    setSaving(true);
    try {
      const updatedStudent = new Student({ ...studentData, id: editingStudent.id });
      await sharePointService.saveStudent(updatedStudent, true);
      await loadData();
      setEditingStudent(null);
      setShowAddStudent(false);
      alert('Student updated successfully!');
    } catch (error) {
      console.error('Error updating student:', error);
      alert(`Failed to update student: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await sharePointService.deleteStudent(studentId);
        await loadData();
      } catch (error) {
        console.error('Error deleting student:', error);
      }
    }
  };

  // Attendance management
  const handleUpdateStaffAttendance = async (staffId, attendanceData) => {
    try {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) {
        console.error('Staff member not found:', staffId);
        return;
      }

      // Update local state immediately for responsive UI
      const updatedStaff = staff.map(s => {
        if (s.id === staffId) {
          return new Staff({
            ...s,
            absentAM: attendanceData.absentAM,
            absentPM: attendanceData.absentPM,
            absentFullDay: attendanceData.absentFullDay
          });
        }
        return s;
      });
      setStaff(updatedStaff);

      // Save to SharePoint in background
      const updatedStaffMember = new Staff({
        ...staffMember,
        absentAM: attendanceData.absentAM,
        absentPM: attendanceData.absentPM,
        absentFullDay: attendanceData.absentFullDay
      });
      await sharePointService.saveStaff(updatedStaffMember, true);
      
      console.log('✅ Staff attendance updated:', staffMember.name, attendanceData);
    } catch (error) {
      console.error('Error updating staff attendance:', error);
      // Don't reload on error - keep local state
      // User can manually refresh if needed
      console.warn('⚠️ Attendance updated locally but not saved to SharePoint');
    }
  };

  const handleUpdateStudentAttendance = async (studentId, attendanceData) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) {
        console.error('Student not found:', studentId);
        return;
      }

      // Update local state immediately for responsive UI
      const updatedStudents = students.map(s => {
        if (s.id === studentId) {
          return new Student({
            ...s,
            absentAM: attendanceData.absentAM,
            absentPM: attendanceData.absentPM,
            absentFullDay: attendanceData.absentFullDay
          });
        }
        return s;
      });
      setStudents(updatedStudents);

      // Save to SharePoint in background
      const updatedStudent = new Student({
        ...student,
        absentAM: attendanceData.absentAM,
        absentPM: attendanceData.absentPM,
        absentFullDay: attendanceData.absentFullDay
      });
      await sharePointService.saveStudent(updatedStudent, true);
      
      console.log('✅ Student attendance updated:', student.name, attendanceData);
    } catch (error) {
      console.error('Error updating student attendance:', error);
      // Don't reload on error - keep local state
      // User can manually refresh if needed
      console.warn('⚠️ Attendance updated locally but not saved to SharePoint');
    }
  };

  // Validation change handler
  const handleValidationChange = (results) => {
    setValidationResults(results);
  };

  // Test runner
  const handleRunTests = async () => {
    setIsTestRunning(true);
    setTestResults(null);
    
    try {
      console.log('🧪 Starting test suite...');
      const results = await runTests();
      setTestResults(results);
      console.log('✅ Test suite completed');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      setTestResults({
        summary: { total: 0, passed: 0, failed: 1, duration: 0 },
        results: [],
        error: error.message
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  // Render login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ABA Scheduler</h1>
            <p className="text-gray-600">Staff & Student Scheduling System</p>
          </div>
          
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign in with Microsoft
              </>
            )}
          </button>
          
          <div className="mt-6 text-sm text-gray-500 text-center">
            <p>Sign in to access the ABA scheduling system</p>
          </div>
        </div>
      </div>
    );
  }

  // Main application UI
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">ABA Scheduler</h1>
                <p className="text-sm text-gray-500">Staff & Student Scheduling</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Date selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  value={currentDate.toISOString().split('T')[0]}
                  onChange={(e) => handleDateChange(new Date(e.target.value))}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                />
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoAssign}
                  disabled={autoAssigning || loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {autoAssigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Auto Assign
                </button>
                
                <button
                  onClick={handleSaveSchedule}
                  disabled={saving || loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                
                <button
                  onClick={clearAuthentication}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2"
                  title="Clear authentication cache to fix 401 errors"
                >
                  🔄 Clear Auth
                </button>
              </div>
              
              {/* User menu */}
              <div className="relative">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'schedule', label: 'Schedule', icon: Clock },
              { id: 'staff', label: 'Staff', icon: Users },
              { id: 'students', label: 'Students', icon: Users },
              { id: 'teams', label: 'Teams', icon: Users },
              { id: 'attendance', label: 'Attendance', icon: Calendar },
              { id: 'validation', label: 'Validation', icon: BarChart3 },
              { id: 'rules', label: 'Rules', icon: Settings },
              { id: 'tests', label: 'Tests', icon: Play }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                  <SessionSummary 
                    schedule={schedule} 
                    staff={staff} 
                    students={students} 
                    session="AM" 
                    program="Primary" 
                  />
                  <SessionSummary 
                    schedule={schedule} 
                    staff={staff} 
                    students={students} 
                    session="PM" 
                    program="Primary" 
                  />
                  <SessionSummary 
                    schedule={schedule} 
                    staff={staff} 
                    students={students} 
                    session="AM" 
                    program="Secondary" 
                  />
                  <SessionSummary 
                    schedule={schedule} 
                    staff={staff} 
                    students={students} 
                    session="PM" 
                    program="Secondary" 
                  />
                </div>
                
                {/* Interactive Assignment Table */}
                <ScheduleTableView
                  schedule={schedule}
                  staff={staff}
                  students={students}
                  onAssignmentLock={handleAssignmentLock}
                  onAssignmentUnlock={handleAssignmentUnlock}
                  onAssignmentRemove={handleAssignmentRemove}
                  onManualAssignment={handleManualAssignment}
                  selectedDate={currentDate}
                />
              </div>
            )}

            {/* Staff Tab */}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
                  <button
                    onClick={() => setShowAddStaff(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Staff
                  </button>
                </div>
                
                {/* Debug Information */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Authentication Status:</strong> {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
                    </div>
                    <div>
                      <strong>Access Token:</strong> {accessToken ? '✅ Present' : '❌ Missing'}
                    </div>
                    <div>
                      <strong>Staff Count:</strong> {staff.length}
                    </div>
                    <div>
                      <strong>Students Count:</strong> {students.length}
                    </div>
                    <div className="col-span-2">
                      <strong>SharePoint Site:</strong> {spConfig.siteUrl}
                    </div>
                    <div>
                      <strong>Staff List:</strong> {spConfig.staffListName}
                    </div>
                    <div>
                      <strong>Students List:</strong> {spConfig.studentsListName}
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Program</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Secondary Program</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {staff.map(staffMember => (
                        <tr key={staffMember.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {staffMember.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {staffMember.role}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {staffMember.primaryProgram || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {staffMember.secondaryProgram || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              staffMember.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {staffMember.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => setEditingStaff(staffMember)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(staffMember.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
                  <button
                    onClick={() => setShowAddStudent(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Student
                  </button>
                </div>
                
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ratio AM</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ratio PM</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map(student => (
                        <tr key={student.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {student.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.program}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {student.ratioAM}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                              {student.ratioPM}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              student.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {student.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => setEditingStudent(student)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <TeamManagement
                staff={staff}
                students={students}
                onEditStaff={(staff) => {
                  setEditingStaff(staff);
                  setShowAddStaff(true);
                }}
                onEditStudent={(student) => {
                  setEditingStudent(student);
                  setShowAddStudent(true);
                }}
              />
            )}

            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <AttendanceManagement
                staff={staff}
                students={students}
                currentDate={currentDate}
                onUpdateStaffAttendance={handleUpdateStaffAttendance}
                onUpdateStudentAttendance={handleUpdateStudentAttendance}
                onResetAllAttendance={clearAllAttendance}
              />
            )}

            {/* Validation Tab */}
            {activeTab === 'validation' && (
              <ValidationPanel
                schedule={schedule}
                staff={staff}
                students={students}
                onValidationChange={handleValidationChange}
              />
            )}

            {/* Rules Tab */}
            {activeTab === 'rules' && (
              <ConstraintRulesDisplay />
            )}

            {/* Tests Tab */}
            {activeTab === 'tests' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Test Suite</h2>
                  <button
                    onClick={handleRunTests}
                    disabled={isTestRunning}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isTestRunning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    {isTestRunning ? 'Running Tests...' : 'Run All Tests'}
                  </button>
                </div>

                {/* Test Results Summary */}
                {testResults && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Results Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-blue-600">{testResults.summary.total}</div>
                          <div className="text-sm text-blue-800">Total Tests</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-green-600">{testResults.summary.passed}</div>
                          <div className="text-sm text-green-800">Passed</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-red-600">{testResults.summary.failed}</div>
                          <div className="text-sm text-red-800">Failed</div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-gray-600">{testResults.summary.duration}ms</div>
                          <div className="text-sm text-gray-800">Duration</div>
                        </div>
                      </div>
                      
                      {/* Success Rate */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Success Rate</span>
                          <span>{testResults.summary.total > 0 ? ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1) : 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${testResults.summary.failed === 0 ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${testResults.summary.total > 0 ? (testResults.summary.passed / testResults.summary.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Individual Test Results */}
                    {testResults.results && testResults.results.length > 0 && (
                      <div>
                        <h4 className="text-md font-semibold text-gray-900 mb-3">Test Details</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {testResults.results.map((result, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded border-l-4 ${
                                result.passed 
                                  ? 'bg-green-50 border-green-400' 
                                  : 'bg-red-50 border-red-400'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${
                                    result.passed ? 'text-green-800' : 'text-red-800'
                                  }`}>
                                    {result.passed ? '✅' : '❌'} {result.name}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">{result.duration}ms</span>
                              </div>
                              {result.error && (
                                <div className="mt-2 text-sm text-red-700 font-mono bg-red-100 p-2 rounded">
                                  {result.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {testResults.error && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                        <h4 className="text-red-800 font-medium">Test Suite Error</h4>
                        <p className="text-red-700 text-sm mt-1">{testResults.error}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Test Information */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">About the Test Suite</h3>
                  <div className="text-blue-800 space-y-2">
                    <p>This comprehensive test suite validates all core functionality of the ABA Scheduling System:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li><strong>Data Models:</strong> Staff and Student object validation, role hierarchies</li>
                      <li><strong>Validation Rules:</strong> Schedule constraints, ratio requirements, program separation</li>
                      <li><strong>Auto-Assignment:</strong> Automated scheduling algorithms and optimization</li>
                      <li><strong>Performance:</strong> Large dataset handling and response times</li>
                      <li><strong>Integration:</strong> End-to-end workflow testing</li>
                    </ul>
                    <p className="mt-3 text-sm">
                      <strong>Note:</strong> Tests run using sample data and do not affect your actual schedule or database.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Staff and Student Forms */}
      {showAddStaff && (
        <StaffForm
          staff={editingStaff}
          onSave={editingStaff ? handleEditStaff : handleAddStaff}
          onCancel={() => {
            setShowAddStaff(false);
            setEditingStaff(null);
          }}
          peoplePickerService={peoplePickerService}
        />
      )}

      {showAddStudent && (
        <StudentForm
          student={editingStudent}
          onSave={editingStudent ? handleEditStudent : handleAddStudent}
          onCancel={() => {
            setShowAddStudent(false);
            setEditingStudent(null);
          }}
          allStaff={staff}
          peoplePickerService={peoplePickerService}
        />
      )}
    </div>
  );
};

// Wrap with Error Boundary
const ABASchedulerWithErrorBoundary = () => (
  <ErrorBoundary>
    <ABAScheduler />
  </ErrorBoundary>
);

export default ABASchedulerWithErrorBoundary;