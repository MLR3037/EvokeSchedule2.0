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
  Clock,
  GraduationCap,
  Download,
  Upload,
  Check,
  AlertCircle,
  X
} from 'lucide-react';

// Import our new components and services
import { Staff, Student, Schedule, Assignment, SchedulingUtils } from './types/index.js';
import { SharePointService } from './services/SharePointService.js';
import { PeoplePickerService } from './services/PeoplePickerService.js';
import { AutoAssignmentEngine } from './services/AutoAssignmentEngine.js';
import { ExcelExportService } from './services/ExcelExportService.js';
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
    scheduleListName: 'ScheduleHistory',
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
  const [dataLoadedAt, setDataLoadedAt] = useState(null); // Track when data was last loaded from server

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
        await refreshDataOnly(); // Load staff/students only, start with blank schedule
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
  const loadData = async (skipConfirmation = false) => {
    // Check if there are unsaved schedule changes (schedule has assignments but no lastModified)
    if (!skipConfirmation && schedule.assignments && schedule.assignments.length > 0 && !schedule.lastModified) {
      const confirmMessage = '⚠️ WARNING: Refreshing will clear any unsaved schedule changes.\n\nIf you have filled slots on the Schedule page, they will be lost.\n\nRecommendation: Save your schedule first before refreshing.\n\nDo you want to refresh anyway?';
      if (!window.confirm(confirmMessage)) {
        return; // User chose not to refresh
      }
    }

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
      
      // CRITICAL: Clean up schedule by removing assignments for absent staff/students
      let cleanedSchedule = scheduleData;
      let removedCount = 0;
      
      if (scheduleData && scheduleData.assignments && scheduleData.assignments.length > 0) {
        const originalCount = scheduleData.assignments.length;
        
        // Filter out assignments where staff or student is unavailable
        const validAssignments = scheduleData.assignments.filter(assignment => {
          const staffMember = staffData.find(s => s.id === assignment.staffId);
          const student = studentsData.find(s => s.id === assignment.studentId);
          
          // Remove if staff doesn't exist or is unavailable for this session
          if (!staffMember || !staffMember.isAvailableForSession(assignment.session)) {
            console.log(`🗑️ Removing assignment: ${assignment.staffName || 'Staff'} (unavailable) → ${assignment.studentName || 'Student'} ${assignment.session}`);
            return false;
          }
          
          // Remove if student doesn't exist or is unavailable for this session
          if (!student || !student.isAvailableForSession(assignment.session)) {
            console.log(`🗑️ Removing assignment: ${assignment.staffName || 'Staff'} → ${assignment.studentName || 'Student'} (unavailable) ${assignment.session}`);
            return false;
          }
          
          return true;
        });
        
        removedCount = originalCount - validAssignments.length;
        
        if (removedCount > 0) {
          console.log(`🧹 Cleaned up ${removedCount} invalid assignment(s) based on current attendance`);
          cleanedSchedule = new Schedule({
            ...scheduleData,
            assignments: validAssignments
          });
        }
      }
      
      setSchedule(cleanedSchedule);
      setDataLoadedAt(new Date()); // Track when data was loaded
      
      console.log(`✅ Loaded ${staffData.length} staff, ${studentsData.length} students at ${new Date().toLocaleTimeString()}`);
      
      // Log attendance status after load
      const absentStaff = staffData.filter(s => s.absentAM || s.absentPM || s.absentFullDay);
      const absentStudents = studentsData.filter(s => s.absentAM || s.absentPM || s.absentFullDay);
      if (absentStaff.length > 0 || absentStudents.length > 0) {
        console.log(`📊 Attendance after load: ${absentStaff.length} staff absent, ${absentStudents.length} students absent`);
      }
      
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

  // Smart refresh: Update staff/students without clearing schedule
  const refreshDataOnly = async () => {
    console.log('🔄 Smart refresh: Updating data without clearing schedule...');
    setLoading(true);
    try {
      // Load staff and students in parallel
      const [staffData, studentsData] = await Promise.all([
        sharePointService.loadStaff().catch(err => {
          console.error('Failed to load staff:', err);
          return [];
        }),
        sharePointService.loadStudents().catch(err => {
          console.error('Failed to load students:', err);
          return [];
        })
      ]);

      // Update staff and students
      setStaff(staffData);
      setStudents(studentsData);
      
      // CRITICAL: Clean up schedule by removing assignments for absent staff/students
      let removedCount = 0;
      
      if (schedule && schedule.assignments && schedule.assignments.length > 0) {
        const originalCount = schedule.assignments.length;
        
        // Filter out assignments where staff or student is unavailable
        const validAssignments = schedule.assignments.filter(assignment => {
          const staffMember = staffData.find(s => s.id === assignment.staffId);
          const student = studentsData.find(s => s.id === assignment.studentId);
          
          // Remove if staff doesn't exist or is unavailable for this session
          if (!staffMember || !staffMember.isAvailableForSession(assignment.session)) {
            console.log(`🗑️ Removing assignment: ${assignment.staffName || 'Staff'} (unavailable) → ${assignment.studentName || 'Student'} ${assignment.session}`);
            return false;
          }
          
          // Remove if student doesn't exist or is unavailable for this session
          if (!student || !student.isAvailableForSession(assignment.session)) {
            console.log(`🗑️ Removing assignment: ${assignment.staffName || 'Staff'} → ${assignment.studentName || 'Student'} (unavailable) ${assignment.session}`);
            return false;
          }
          
          return true;
        });
        
        removedCount = originalCount - validAssignments.length;
        
        if (removedCount > 0) {
          console.log(`🧹 Cleaned up ${removedCount} invalid assignment(s) based on current attendance`);
          const cleanedSchedule = new Schedule({
            ...schedule,
            assignments: validAssignments
          });
          setSchedule(cleanedSchedule);
        }
      }
      
      setDataLoadedAt(new Date()); // Track when data was loaded
      
      console.log(`✅ Smart refresh complete: ${staffData.length} staff, ${studentsData.length} students loaded. ${removedCount > 0 ? removedCount + ' assignments removed.' : 'Schedule preserved.'}`);
      
      // Log attendance status after refresh
      const absentStaff = staffData.filter(s => s.absentAM || s.absentPM || s.absentFullDay);
      const absentStudents = studentsData.filter(s => s.absentAM || s.absentPM || s.absentFullDay);
      if (absentStaff.length > 0 || absentStudents.length > 0) {
        console.log(`📊 Attendance after refresh: ${absentStaff.length} staff absent, ${absentStudents.length} students absent`);
      }
      
      if (staffData.length === 0 && studentsData.length === 0) {
        console.warn('⚠️ No data loaded. Check authentication and SharePoint list names.');
      }
    } catch (error) {
      console.error('💥 Error refreshing data:', error);
      alert(`Error refreshing data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle date change
  const handleDateChange = async (newDate) => {
    if (isAuthenticated) {
      try {
        // Check if date actually changed (not just same day)
        const oldDateStr = currentDate.toDateString();
        const newDateStr = newDate.toDateString();
        
        if (oldDateStr !== newDateStr) {
          console.log('📅 Date changed from', oldDateStr, 'to', newDateStr);
          
          // Save current day's attendance to history before changing date
          console.log('💾 Saving attendance history for', oldDateStr);
          await sharePointService.saveAttendanceHistory(staff, students, currentDate);
          
          // Clear attendance in local state FIRST
          const clearedStaff = staff.map(s => new Staff({
            ...s,
            absentAM: false,
            absentPM: false,
            absentFullDay: false
          }));
          
          const clearedStudents = students.map(s => new Student({
            ...s,
            absentAM: false,
            absentPM: false,
            absentFullDay: false
          }));
          
          // Update local state immediately so UI shows cleared attendance
          setStaff(clearedStaff);
          setStudents(clearedStudents);
          console.log('✅ Local attendance state cleared for', clearedStaff.length, 'staff and', clearedStudents.length, 'students');
          
          // Clear attendance in SharePoint synchronously to ensure it's saved before loading new date
          console.log('🧹 Clearing attendance in SharePoint...');
          try {
            await sharePointService.clearAllAttendanceInSharePoint(clearedStaff, clearedStudents);
            console.log('✅ SharePoint attendance cleared');
          } catch (err) {
            console.error('⚠️ Error clearing SharePoint attendance:', err);
            // Continue anyway - local state is already cleared
          }
          
          // Update the date state
          setCurrentDate(newDate);
          
          // Load schedule for new date
          const scheduleData = await sharePointService.loadSchedule(newDate);
          setSchedule(scheduleData);
          
          // Load attendance data for the new date
          console.log('📥 Loading attendance data for', newDateStr);
          const attendanceData = await sharePointService.loadAttendanceForDate(newDate);
          
          if (attendanceData) {
            console.log('✅ Attendance data loaded, applying to staff and students');
            
            // Apply attendance data to staff (using the already cleared staff)
            const staffWithAttendance = clearedStaff.map(s => {
              const attendance = attendanceData.staff[s.id];
              if (attendance) {
                return new Staff({
                  ...s,
                  absentAM: attendance.absentAM,
                  absentPM: attendance.absentPM,
                  absentFullDay: attendance.absentFullDay,
                  outOfSessionAM: attendance.outOfSessionAM,
                  outOfSessionPM: attendance.outOfSessionPM,
                  outOfSessionFullDay: attendance.outOfSessionFullDay
                });
              }
              return s;
            });
            
            // Apply attendance data to students (using the already cleared students)
            const studentsWithAttendance = clearedStudents.map(s => {
              const attendance = attendanceData.students[s.id];
              if (attendance) {
                return new Student({
                  ...s,
                  absentAM: attendance.absentAM,
                  absentPM: attendance.absentPM,
                  absentFullDay: attendance.absentFullDay,
                  outOfSessionAM: attendance.outOfSessionAM,
                  outOfSessionPM: attendance.outOfSessionPM,
                  outOfSessionFullDay: attendance.outOfSessionFullDay
                });
              }
              return s;
            });
            
            setStaff(staffWithAttendance);
            setStudents(studentsWithAttendance);
            
            console.log('✅ Attendance data applied to UI');
          } else {
            console.log('ℹ️ No attendance data found for this date - all marked as present');
          }
        }
      } catch (error) {
        console.error('Error loading schedule for new date:', error);
      }
    } else {
      // Just update the date if not authenticated
      setCurrentDate(newDate);
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
        absentFullDay: false,
        outOfSessionAM: false,
        outOfSessionPM: false,
        outOfSessionFullDay: false
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
      console.log('✅ All attendance and out-of-session status cleared for new day');
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
        await loadData(true); // Skip confirmation on login
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
        // Keep only locked/manual assignments from the existing schedule
        // Auto-assignments should be completely replaced
        const manualAssignments = schedule.assignments.filter(a => 
          a.assignedBy === 'manual' || a.isLocked
        );
        
        // Combine manual assignments with new auto-assignments
        let allAssignments = [...manualAssignments, ...result.assignments];
        
        // SAFETY CHECK 1: Remove any assignments where staff is marked absent
        // This is a failsafe in case of state sync issues
        allAssignments = allAssignments.filter(assignment => {
          const staffMember = staff.find(s => s.id === assignment.staffId);
          if (!staffMember) return true; // Keep if staff not found (shouldn't happen)
          
          const isAbsent = assignment.session === 'AM' 
            ? (staffMember.absentAM || staffMember.absentFullDay)
            : (staffMember.absentPM || staffMember.absentFullDay);
            
          if (isAbsent) {
            console.warn(`⚠️ SAFETY CHECK: Removed assignment for absent staff: ${staffMember.name} (${assignment.session})`);
            return false;
          }
          return true;
        });
        
        // SAFETY CHECK 2: Limit assignments per student based on their ratio
        // This prevents the auto-assignment engine from over-assigning
        const assignmentsByStudent = {};
        allAssignments.forEach(a => {
          const key = `${a.studentId}-${a.session}`;
          if (!assignmentsByStudent[key]) assignmentsByStudent[key] = [];
          assignmentsByStudent[key].push(a);
        });
        
        let validAssignments = [];
        Object.entries(assignmentsByStudent).forEach(([key, assignments]) => {
          const [studentId, session] = key.split('-');
          const student = students.find(s => s.id == studentId);
          if (!student) {
            validAssignments.push(...assignments);
            return;
          }
          
          const ratio = session === 'AM' ? student.ratioAM : student.ratioPM;
          const maxStaff = ratio === '2:1' ? 2 : 1;
          
          // Take only the first maxStaff assignments, prioritize manual/locked
          const sorted = assignments.sort((a, b) => {
            if (a.assignedBy === 'manual' || a.isLocked) return -1;
            if (b.assignedBy === 'manual' || b.isLocked) return 1;
            return 0;
          });
          
          validAssignments.push(...sorted.slice(0, maxStaff));
          
          if (sorted.length > maxStaff) {
            console.warn(`⚠️ ${student.name} ${session}: Trimmed ${sorted.length} assignments to ${maxStaff} (ratio: ${ratio})`);
          }
        });

        // SAFETY CHECK 3: Prevent double-booking of staff in the same session
        // Staff can only be assigned once per session UNLESS students are paired (1:2)
        const staffDoubleBookings = {};
        validAssignments = validAssignments.filter(assignment => {
          const key = `${assignment.staffId}-${assignment.session}`;
          
          if (staffDoubleBookings[key]) {
            // Staff is already assigned in this session
            const existingAssignment = staffDoubleBookings[key];
            const currentStudent = students.find(s => s.id === assignment.studentId);
            const existingStudent = students.find(s => s.id === existingAssignment.studentId);
            
            // Allow only if students are paired (1:2 ratio)
            const arePaired = currentStudent && existingStudent && 
              currentStudent.isPaired() && 
              currentStudent.pairedWith === existingStudent.id;
            
            if (!arePaired) {
              const staffMember = staff.find(s => s.id === assignment.staffId);
              console.warn(`⚠️ BLOCKED DOUBLE-BOOKING: ${staffMember?.name || 'Staff'} cannot be assigned to ${currentStudent?.name || 'student'} - already assigned to ${existingStudent?.name || 'another student'} in ${assignment.session}`);
              return false; // Remove this assignment
            }
          }
          
          staffDoubleBookings[key] = assignment;
          return true; // Keep this assignment
        });
        
        console.log(`🔄 Auto-assign: ${schedule.assignments.length} existing → ${manualAssignments.length} manual + ${result.assignments.length} new auto → ${validAssignments.length} final (after safety checks)`);
        
        // Force re-render by creating a new Schedule instance with ALL assignments
        // IMPORTANT: Preserve traineeAssignments when creating new schedule instance
        const newSchedule = new Schedule({
          date: schedule.date,
          assignments: validAssignments,
          traineeAssignments: [...(schedule.traineeAssignments || [])], // Preserve trainee assignments
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

  // Smart Swap Optimization - Fill gaps by finding beneficial swaps
  const handleSmartSwap = async () => {
    setAutoAssigning(true);
    
    try {
      console.log('🔀 Starting Smart Swap Optimization...');
      
      // Use the AutoAssignmentEngine's swap optimization
      const result = await autoAssignEngine.performSwapOptimization(schedule, staff, students);
      
      if (result.swapsMade > 0 || result.newAssignments.length > 0) {
        console.log(`✅ Smart Swap Results: ${result.swapsMade} swaps, ${result.gapsFilled} gaps filled`);
        
        // Apply swaps and new assignments
        let updatedAssignments = [...schedule.assignments];
        
        // Remove swapped assignments
        for (const swap of result.swaps) {
          if (swap.oldAssignment) {
            updatedAssignments = updatedAssignments.filter(a => a.id !== swap.oldAssignment.id);
          }
        }
        
        // Add all new assignments from swaps and gap fills
        updatedAssignments = [...updatedAssignments, ...result.newAssignments];
        
        // SAFETY CHECK 1: Limit assignments per student based on their ratio
        const assignmentsByStudent = {};
        updatedAssignments.forEach(a => {
          const key = `${a.studentId}-${a.session}`;
          if (!assignmentsByStudent[key]) assignmentsByStudent[key] = [];
          assignmentsByStudent[key].push(a);
        });
        
        let validAssignments = [];
        Object.entries(assignmentsByStudent).forEach(([key, assignments]) => {
          const [studentId, session] = key.split('-');
          const student = students.find(s => s.id == studentId);
          if (!student) {
            validAssignments.push(...assignments);
            return;
          }
          
          const ratio = session === 'AM' ? student.ratioAM : student.ratioPM;
          const maxStaff = ratio === '2:1' ? 2 : 1;
          
          // Take only the first maxStaff assignments, prioritize manual/locked
          const sorted = assignments.sort((a, b) => {
            if (a.assignedBy === 'manual' || a.isLocked) return -1;
            if (b.assignedBy === 'manual' || b.isLocked) return 1;
            return 0;
          });
          
          validAssignments.push(...sorted.slice(0, maxStaff));
          
          if (sorted.length > maxStaff) {
            console.warn(`⚠️ SMART SWAP: ${student.name} ${session}: Trimmed ${sorted.length} assignments to ${maxStaff} (ratio: ${ratio})`);
          }
        });

        // SAFETY CHECK 2: Prevent double-booking of staff in the same session
        const staffDoubleBookings = {};
        validAssignments = validAssignments.filter(assignment => {
          const key = `${assignment.staffId}-${assignment.session}`;
          
          if (staffDoubleBookings[key]) {
            const existingAssignment = staffDoubleBookings[key];
            const currentStudent = students.find(s => s.id === assignment.studentId);
            const existingStudent = students.find(s => s.id === existingAssignment.studentId);
            
            // Allow only if students are paired (1:2 ratio)
            const arePaired = currentStudent && existingStudent && 
              currentStudent.isPaired() && 
              currentStudent.pairedWith === existingStudent.id;
            
            if (!arePaired) {
              const staffMember = staff.find(s => s.id === assignment.staffId);
              console.warn(`⚠️ SMART SWAP BLOCKED DOUBLE-BOOKING: ${staffMember?.name || 'Staff'} cannot be assigned to ${currentStudent?.name || 'student'} - already assigned to ${existingStudent?.name || 'another student'} in ${assignment.session}`);
              return false;
            }
          }
          
          staffDoubleBookings[key] = assignment;
          return true;
        });
        
        // Create new schedule instance
        const newSchedule = new Schedule({
          date: schedule.date,
          assignments: validAssignments,
          traineeAssignments: [...(schedule.traineeAssignments || [])],
          lockedAssignments: schedule.lockedAssignments,
          isFinalized: schedule.isFinalized
        });
        
        setSchedule(newSchedule);
        alert(`✅ Smart Swap Complete!\n\n${result.swapsMade} swaps made\n${result.gapsFilled} gaps filled\n\nCheck the schedule for improvements.`);
      } else {
        alert('ℹ️ No beneficial swaps found.\n\nAll gaps may require staff who are already assigned or unavailable.');
      }
    } catch (error) {
      console.error('Smart swap failed:', error);
      alert('Smart swap failed. Please check the console for details.');
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
    traineeAssignments: [...(schedule.traineeAssignments || [])], // Preserve trainee assignments
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
    traineeAssignments: [...(schedule.traineeAssignments || [])], // Preserve trainee assignments
    lockedAssignments: new Set(schedule.lockedAssignments),
    isFinalized: schedule.isFinalized
  });
  
  setSchedule(newSchedule);
};

const handleManualAssignment = ({ staffId, studentId, session, program }) => {
  // Get staff and student names
  const staffMember = staff.find(s => s.id === staffId);
  const student = students.find(s => s.id === studentId);
  
  if (!staffMember || !student) {
    console.error('❌ Cannot assign: Staff or student not found');
    return;
  }

  // CRITICAL CHECK 1: Staff must be on student's team
  if (!student.teamIds.includes(staffId)) {
    alert(`❌ Cannot assign ${staffMember.name} to ${student.name}.\n\n${staffMember.name} is not on ${student.name}'s team.\n\nOnly team members can be assigned to a student.`);
    console.warn(`⚠️ Blocked assignment: ${staffMember.name} is not on ${student.name}'s team`);
    return;
  }

  // CRITICAL CHECK 2: Prevent double-booking of staff
  // Check if staff is already assigned in this session (any program)
  const existingStaffAssignment = schedule.assignments.find(a => 
    a.staffId === staffId && a.session === session
  );

  if (existingStaffAssignment) {
    // Allow only if the student is 1:2 (paired) and staff is already with their paired partner
    const isPairedStudent = student.isPaired();
    const existingStudent = students.find(s => s.id === existingStaffAssignment.studentId);
    const isWithPairedPartner = isPairedStudent && existingStudent && 
      student.pairedWith === existingStudent.id;

    if (!isWithPairedPartner) {
      const existingStudentName = existingStudent ? existingStudent.name : 'unknown student';
      alert(`❌ Cannot assign ${staffMember.name} to ${student.name} in ${session} session.\n\n${staffMember.name} is already assigned to ${existingStudentName} in the ${session} session.\n\nStaff can only be assigned to multiple students if they are in a 1:2 paired group.`);
      console.warn(`⚠️ Blocked double-booking: ${staffMember.name} already assigned to ${existingStudentName} in ${session}`);
      return;
    }
  }

  const assignment = new Assignment({
    id: SchedulingUtils.generateAssignmentId(),
    staffId,
    staffName: staffMember.name,
    studentId,
    studentName: student.name,
    session,
    program,
    date: currentDate,
    isLocked: false, // Manual assignments start UNLOCKED - user must click lock icon to lock
    assignedBy: 'manual'
  });

  // Add assignment to schedule
  schedule.addAssignment(assignment);
  
  // Force re-render with new Schedule instance
  const newSchedule = new Schedule({
    date: schedule.date,
    assignments: [...schedule.assignments], // Create new array reference
    traineeAssignments: [...(schedule.traineeAssignments || [])], // Preserve trainee assignments
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
    traineeAssignments: [...(schedule.traineeAssignments || [])], // Preserve trainee assignments
    lockedAssignments: new Set(schedule.lockedAssignments),
    isFinalized: schedule.isFinalized
  });
  
  setSchedule(newSchedule);
  
  console.log('✅ Assignment removed. Total assignments:', newSchedule.assignments.length);
};

  // Save schedule
  const handleSaveSchedule = async () => {
    // Check if schedule was modified after we loaded it
    if (schedule.lastModified && dataLoadedAt) {
      const scheduleModifiedAt = new Date(schedule.lastModified);
      if (scheduleModifiedAt > dataLoadedAt) {
        const timeDiff = Math.floor((scheduleModifiedAt - dataLoadedAt) / 1000 / 60); // minutes
        const confirmMessage = `⚠️ WARNING: This schedule was modified by ${schedule.lastModifiedBy} ${timeDiff} minute${timeDiff !== 1 ? 's' : ''} after you loaded the page.\n\nSaving now may overwrite their changes.\n\nRecommendation: Click "Cancel", then click the "Refresh" button to see their changes before making your edits.\n\nDo you want to save anyway and potentially overwrite their work?`;
        
        if (!window.confirm(confirmMessage)) {
          return; // User chose not to save
        }
      }
    }

    setSaving(true);
    try {
      // Get current user info from SharePoint service
      const currentUser = sharePointService.currentUser?.displayName || 'Unknown User';
      const timestamp = new Date().toISOString();

      // Update schedule with metadata before saving
      const scheduleToSave = new Schedule({
        ...schedule,
        date: currentDate.toISOString().split('T')[0],
        lastModified: timestamp,
        lastModifiedBy: currentUser
      });

      const success = await sharePointService.saveSchedule(scheduleToSave);
      
      if (success) {
        // Update local schedule state with metadata
        setSchedule(scheduleToSave);
        setDataLoadedAt(new Date()); // Reset the load time since we just saved
        console.log('✅ Schedule saved successfully to SharePoint');
        alert('Schedule saved successfully! Historical data is now available for rule checking.');
      } else {
        console.log('ℹ️ Schedule save failed - check browser console for details');
        alert('Failed to save schedule. Please check the browser console (F12 → Console) for detailed error information. This might be due to missing SharePoint lists, permissions, or column naming issues.');
      }
    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      
      let errorMessage = 'An error occurred while saving the schedule.';
      
      if (error.message.includes('Authentication required')) {
        errorMessage = 'Authentication expired. Please refresh the page and sign in again.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network connection error. Please check your internet connection and try again.';
      } else if (error.message.includes('TypeError')) {
        errorMessage = 'Configuration error. Please check the browser console (F12 → Console) for technical details.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      alert(errorMessage + '\n\nFor technical details, check the browser console (F12 → Console).');
    } finally {
      setSaving(false);
    }
  };

  // Load previously saved schedule for the selected date
  const handleLoadSchedule = async () => {
    // Confirm with user before loading
    const confirmMessage = `📅 Load Previously Saved Schedule?\n\nThis will:\n✅ Load the saved schedule for ${currentDate.toLocaleDateString()}\n⚠️ Replace any unsaved changes in the current view\n\nDo you want to proceed?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    try {
      console.log('📥 Loading saved schedule for:', currentDate);
      
      const scheduleData = await sharePointService.loadSchedule(currentDate);
      
      if (scheduleData && scheduleData.assignments && scheduleData.assignments.length > 0) {
        setSchedule(scheduleData);
        setDataLoadedAt(new Date());
        console.log('✅ Schedule loaded successfully:', scheduleData.assignments.length, 'assignments');
        alert(`✅ Schedule loaded successfully!\n\n${scheduleData.assignments.length} assignments loaded from ${currentDate.toLocaleDateString()}`);
      } else {
        console.log('ℹ️ No saved schedule found for this date');
        alert(`ℹ️ No saved schedule found for ${currentDate.toLocaleDateString()}.\n\nThis might mean:\n• No schedule has been saved for this date yet\n• The schedule was saved but contains no assignments\n\nYou can create a new schedule using Auto Assign.`);
      }
    } catch (error) {
      console.error('❌ Error loading schedule:', error);
      alert(`Error loading schedule: ${error.message}\n\nPlease check the browser console (F12) for more details.`);
    } finally {
      setLoading(false);
    }
  };

  // Clear the schedule
  const handleClearSchedule = () => {
    const confirmMessage = `⚠️ CLEAR UNLOCKED ASSIGNMENTS?\n\nThis will:\n❌ Remove all AUTO-ASSIGNED staff and trainees\n✅ KEEP all MANUAL (locked) assignments\n\n💡 Manual assignments stay locked and protected.\n\nDo you want to clear unlocked assignments?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Keep only LOCKED assignments and LOCKED trainee assignments
    const lockedAssignments = schedule.assignments.filter(a => a.isLocked);
    const lockedTrainees = (schedule.traineeAssignments || []).filter(t => t.isLocked);
    
    const clearedSchedule = new Schedule({ 
      date: currentDate.toISOString().split('T')[0],
      assignments: lockedAssignments,
      traineeAssignments: lockedTrainees,
      lockedAssignments: new Set(schedule.lockedAssignments),
      isFinalized: false
    });
    
    setSchedule(clearedSchedule);
    const removedCount = schedule.assignments.length - lockedAssignments.length;
    const removedTrainees = (schedule.traineeAssignments || []).length - lockedTrainees.length;
    console.log(`🧹 Cleared ${removedCount} unlocked assignments and ${removedTrainees} unlocked trainees. Kept ${lockedAssignments.length} locked assignments and ${lockedTrainees.length} locked trainees.`);
    alert(`Schedule cleared!\n\n✅ Kept ${lockedAssignments.length} locked assignments and ${lockedTrainees.length} locked trainees\n❌ Removed ${removedCount} auto-assigned staff and ${removedTrainees} auto-assigned trainees`);
  };

  const handleTotalClear = () => {
    const confirmMessage = `🚨 TOTAL CLEAR - DELETE EVERYTHING?\n\nThis will:\n❌ Remove ALL assignments (manual AND auto)\n❌ Remove ALL trainees (manual AND auto)\n❌ Clear EVERYTHING including locked items\n⚠️ This action cannot be undone\n\n✅ The schedule will NOT be saved - it just clears your current view\n\nAre you SURE you want to delete everything?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Create a completely empty schedule
    const clearedSchedule = new Schedule({ 
      date: currentDate.toISOString().split('T')[0],
      assignments: [],
      traineeAssignments: [],
      lockedAssignments: new Set(),
      isFinalized: false
    });
    
    setSchedule(clearedSchedule);
    console.log('🗑️ TOTAL CLEAR - All assignments and trainees removed');
    alert('Total clear complete! Everything has been removed.');
  };

  // Export schedule to Excel
  const handleExportToExcel = () => {
    try {
      ExcelExportService.exportSchedule(schedule, students, staff, currentDate);
      console.log('✅ Schedule exported to Excel successfully');
    } catch (error) {
      console.error('❌ Error exporting schedule:', error);
      alert(`Failed to export schedule: ${error.message}`);
    }
  };

  // Staff management
  const handleAddStaff = async (staffData) => {
    setSaving(true);
    try {
      const newStaff = new Staff(staffData);
      await sharePointService.saveStaff(newStaff);
      await refreshDataOnly(); // Smart refresh: Update data without clearing schedule
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
      await refreshDataOnly(); // Smart refresh: Update data without clearing schedule
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
        // Find the staff member to get their listItemId
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember) {
          console.error('Staff member not found:', staffId);
          alert('Staff member not found');
          return;
        }

        const listItemId = staffMember.listItemId || staffMember.id;
        console.log(`🗑️ Deleting staff: ${staffMember.name} (User ID: ${staffId}, List Item ID: ${listItemId})`);
        
        // First, remove this staff member from all student teams
        console.log(`🗑️ Removing staff ID ${staffId} from all student teams...`);
        
        const updatedStudents = students.map(student => {
          // Check if this staff is on the student's team
          if (student.teamIds.includes(staffId)) {
            console.log(`  Removing staff from ${student.name}'s team`);
            
            // Remove from team array (People Picker data)
            const updatedTeam = student.team.filter(teamMember => teamMember.id !== staffId);
            
            // Remove from teamIds array
            const updatedTeamIds = student.teamIds.filter(id => id !== staffId);
            
            // Create updated student
            return new Student({
              ...student,
              team: updatedTeam,
              teamIds: updatedTeamIds
            });
          }
          return student;
        });
        
        // Save all updated students to SharePoint
        const studentsToUpdate = updatedStudents.filter((student, index) => {
          return students[index].teamIds.includes(staffId);
        });
        
        if (studentsToUpdate.length > 0) {
          console.log(`📝 Updating ${studentsToUpdate.length} students in SharePoint...`);
          await Promise.all(
            studentsToUpdate.map(student => sharePointService.saveStudent(student, true))
          );
          console.log('✅ Student teams updated');
        }
        
        // Now delete the staff member using the list item ID
        await sharePointService.deleteStaff(listItemId);
        console.log('✅ Staff member deleted');
        
        // Reload all data to reflect changes
        await refreshDataOnly(); // Smart refresh: Update data without clearing schedule
      } catch (error) {
        console.error('Error deleting staff:', error);
        alert(`Failed to delete staff: ${error.message}`);
      }
    }
  };

  // Student management
  const handleAddStudent = async (studentData) => {
    setSaving(true);
    try {
      const newStudent = new Student(studentData);
      await sharePointService.saveStudent(newStudent);
      await refreshDataOnly(); // Smart refresh: Update data without clearing schedule
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
      await refreshDataOnly(); // Smart refresh: Update data without clearing schedule
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
        await refreshDataOnly(); // Smart refresh: Update data without clearing schedule
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
            absentFullDay: attendanceData.absentFullDay,
            outOfSessionAM: attendanceData.outOfSessionAM,
            outOfSessionPM: attendanceData.outOfSessionPM,
            outOfSessionFullDay: attendanceData.outOfSessionFullDay
          });
        }
        return s;
      });
      setStaff(updatedStaff);

      // AUTO-CLEANUP: Remove staff from schedule if marked absent OR out of session
      const isUnavailableAM = attendanceData.absentAM || attendanceData.absentFullDay || 
                              attendanceData.outOfSessionAM || attendanceData.outOfSessionFullDay;
      const isUnavailablePM = attendanceData.absentPM || attendanceData.absentFullDay || 
                              attendanceData.outOfSessionPM || attendanceData.outOfSessionFullDay;
      
      if (isUnavailableAM || isUnavailablePM) {
        console.log(`🗑️ Staff ${staffMember.name} marked unavailable - removing from schedule...`);
        
        const sessionsToRemove = [];
        if ((attendanceData.absentFullDay || attendanceData.outOfSessionFullDay)) {
          sessionsToRemove.push('AM', 'PM');
        } else {
          if (isUnavailableAM) sessionsToRemove.push('AM');
          if (isUnavailablePM) sessionsToRemove.push('PM');
        }

        // Remove all assignments for this staff in the affected sessions
        const removedCount = schedule.removeStaffFromSessions(staffId, sessionsToRemove);
        
        if (removedCount > 0) {
          console.log(`  ✅ Removed ${removedCount} assignment(s) for ${staffMember.name}`);
          // Trigger re-render by updating schedule state
          setSchedule(new Schedule({ 
            ...schedule, 
            assignments: [...schedule.assignments],
            traineeAssignments: [...schedule.traineeAssignments]
          }));
        }
      }

      // Save to SharePoint in background
      const updatedStaffMember = new Staff({
        ...staffMember,
        absentAM: attendanceData.absentAM,
        absentPM: attendanceData.absentPM,
        absentFullDay: attendanceData.absentFullDay,
        outOfSessionAM: attendanceData.outOfSessionAM,
        outOfSessionPM: attendanceData.outOfSessionPM,
        outOfSessionFullDay: attendanceData.outOfSessionFullDay
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

      // AUTO-CLEANUP: Remove student assignments and free up staff if marked absent
      if (attendanceData.absentAM || attendanceData.absentPM || attendanceData.absentFullDay) {
        console.log(`🗑️ Student ${student.name} marked absent - removing from schedule...`);
        
        const sessionsToRemove = [];
        if (attendanceData.absentFullDay) {
          sessionsToRemove.push('AM', 'PM');
        } else {
          if (attendanceData.absentAM) sessionsToRemove.push('AM');
          if (attendanceData.absentPM) sessionsToRemove.push('PM');
        }

        // Remove all assignments for this student in the affected sessions
        const removedCount = schedule.removeStudentFromSessions(studentId, sessionsToRemove);
        
        if (removedCount > 0) {
          console.log(`  ✅ Removed ${removedCount} assignment(s) for ${student.name} - staff are now available`);
          // Trigger re-render by updating schedule state
          setSchedule(new Schedule({ 
            ...schedule, 
            assignments: [...schedule.assignments],
            traineeAssignments: [...schedule.traineeAssignments]
          }));
        }
      }

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

  // Clean up deleted staff from student teams
  const handleCleanupDeletedStaff = async () => {
    if (!window.confirm('This will remove deleted staff members from all student teams. This action cannot be undone. Continue?')) {
      return;
    }

    setSaving(true);
    try {
      console.log('🧹 Starting cleanup of deleted staff from student teams...');
      
      const activeStaffIds = new Set(staff.filter(s => s.isActive).map(s => s.id));
      const activeStaffEmails = new Set(staff.filter(s => s.isActive && s.email).map(s => s.email.toLowerCase()));
      
      let totalCleaned = 0;
      const updatedStudents = [];

      for (const student of students) {
        if (!student.team || student.team.length === 0) continue;

        const originalTeamSize = student.team.length;
        
        // Filter out deleted staff (not in active staff list)
        const cleanedTeam = student.team.filter(teamMember => {
          // Check by email first (most reliable)
          if (teamMember.email) {
            const found = activeStaffEmails.has(teamMember.email.toLowerCase());
            if (found) return true;
          }
          
          // Check by ID
          if (teamMember.id) {
            const found = activeStaffIds.has(teamMember.id);
            if (found) return true;
          }
          
          // Staff member not found - they've been deleted
          console.log(`  🗑️ Removing deleted staff "${teamMember.title || teamMember.name}" from ${student.name}'s team`);
          return false;
        });

        // If team changed, update the student
        if (cleanedTeam.length !== originalTeamSize) {
          const removedCount = originalTeamSize - cleanedTeam.length;
          totalCleaned += removedCount;
          console.log(`  ✅ Cleaned ${removedCount} deleted staff from ${student.name}'s team`);
          
          // Update student with cleaned team
          const cleanedStudent = new Student({
            ...student,
            team: cleanedTeam,
            teamIds: cleanedTeam.map(t => t.id)
          });
          
          updatedStudents.push(cleanedStudent);
        }
      }

      if (updatedStudents.length === 0) {
        alert('No deleted staff found in student teams. All teams are clean!');
        return;
      }

      // Save all updated students to SharePoint
      console.log(`💾 Saving ${updatedStudents.length} students with cleaned teams...`);
      
      for (const student of updatedStudents) {
        await sharePointService.saveStudent(student, true);
      }

      // Reload data to reflect changes
      await refreshDataOnly(); // Smart refresh: Update data without clearing schedule
      
      alert(`Successfully cleaned up ${totalCleaned} deleted staff member(s) from ${updatedStudents.length} student team(s)!`);
      console.log(`✅ Cleanup complete: ${totalCleaned} deleted staff removed from ${updatedStudents.length} student teams`);
      
    } catch (error) {
      console.error('❌ Error cleaning up deleted staff:', error);
      alert(`Failed to clean up deleted staff: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Training management
  const handleUpdateStudentTrainingStatus = async (studentId, staffId, newStatus) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) {
        console.error('Student not found:', studentId);
        return;
      }

      // Update local state immediately
      const updatedStudents = students.map(s => {
        if (s.id === studentId) {
          const updatedStudent = new Student({ ...s });
          updatedStudent.setStaffTrainingStatus(staffId, newStatus);
          return updatedStudent;
        }
        return s;
      });
      setStudents(updatedStudents);

      // Save to SharePoint in background
      const updatedStudent = new Student({ ...student });
      updatedStudent.setStaffTrainingStatus(staffId, newStatus);
      await sharePointService.saveStudent(updatedStudent, true);
      
      console.log('✅ Training status updated:', student.name, staffId, newStatus);
    } catch (error) {
      console.error('Error updating training status:', error);
      console.warn('⚠️ Training status updated locally but not saved to SharePoint');
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
                  title="Automatically assign staff to students (includes smart swap optimization)"
                >
                  {autoAssigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Auto Assign
                </button>
                
                <button
                  onClick={handleSmartSwap}
                  disabled={autoAssigning || loading || schedule.assignments.length === 0}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  title="Fill gaps by swapping staff to enable team member assignments"
                >
                  {autoAssigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🔀'}
                  Smart Swap
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
                  onClick={handleLoadSchedule}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  title="Load previously saved schedule for this date"
                >
                  <Upload className="w-4 h-4" />
                  Load Saved
                </button>
                
                <button
                  onClick={handleExportToExcel}
                  disabled={loading || schedule.assignments.length === 0}
                  className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                  title="Export schedule to Excel"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                
                <button
                  onClick={refreshDataOnly}
                  disabled={loading}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                
                <button
                  onClick={handleClearSchedule}
                  disabled={loading || schedule.assignments.length === 0}
                  className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
                  title="Clear unlocked (auto-assigned) items, keep manual assignments"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Unlocked
                </button>
                
                <button
                  onClick={handleTotalClear}
                  disabled={loading || schedule.assignments.length === 0}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  title="Delete everything - all assignments and trainees (manual and auto)"
                >
                  <Trash2 className="w-4 h-4" />
                  Total Clear
                </button>
                
                <button
                  onClick={clearAuthentication}
                  className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 flex items-center gap-2"
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
                {/* Concurrent User Warning Banner */}
                {schedule.lastModified && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg shadow-sm">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-amber-800">
                          Schedule Status
                        </h3>
                        <p className="text-sm text-amber-700 mt-1">
                          Last saved by <span className="font-medium">{schedule.lastModifiedBy}</span> at{' '}
                          <span className="font-medium">
                            {new Date(schedule.lastModified).toLocaleString()}
                          </span>
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                          ⚠️ If someone else is editing this schedule, their changes may overwrite yours. Click Refresh before making changes to see the latest version.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!schedule.lastModified && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-blue-800">
                          New Schedule - Not Yet Saved
                        </h3>
                        <p className="text-sm text-blue-700 mt-1">
                          This schedule hasn't been saved yet. Your changes are only visible to you until someone saves the schedule to SharePoint.
                        </p>
                        <div className="mt-3 p-3 bg-blue-100 rounded-md">
                          <p className="text-xs font-semibold text-blue-800 mb-1">
                            👥 Multi-User Workflow:
                          </p>
                          <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                            <li>Multiple people can work on the schedule at the same time</li>
                            <li>The <strong>last person to click "Save Schedule"</strong> will overwrite all previous work</li>
                            <li>Coordinate with your team to decide who will save the final version</li>
                            <li>If working simultaneously, communicate frequently to avoid losing changes</li>
                          </ul>
                        </div>
                        <p className="text-xs text-blue-600 mt-2 font-medium">
                          💡 Best Practice: Designate one person to be the "schedule saver" for the day, or take turns and communicate before saving.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                      {[...staff].sort((a, b) => a.name.localeCompare(b.name)).map(staffMember => (
                        <tr key={staffMember.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {staffMember.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {staffMember.role}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {staffMember.primaryProgram ? (
                              <Check className="w-5 h-5 text-green-600" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {staffMember.secondaryProgram ? (
                              <Check className="w-5 h-5 text-green-600" />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
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
                              onClick={() => {
                                setEditingStaff(staffMember);
                                setShowAddStaff(true);
                              }}
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
                              onClick={() => {
                                setEditingStudent(student);
                                setShowAddStudent(true);
                              }}
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
                dataLoadedAt={dataLoadedAt}
                loading={loading}
                onEditStaff={(staff) => {
                  setEditingStaff(staff);
                  setShowAddStaff(true);
                }}
                onEditStudent={(student) => {
                  setEditingStudent(student);
                  setShowAddStudent(true);
                }}
                onCleanupDeletedStaff={handleCleanupDeletedStaff}
                onUpdateTrainingStatus={handleUpdateStudentTrainingStatus}
              />
            )}

            {/* Attendance Tab */}
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