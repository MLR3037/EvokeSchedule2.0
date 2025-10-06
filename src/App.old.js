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
import { AutoAssignmentEngine } from './services/AutoAssignmentEngine.js';
import { 
  ScheduleGrid, 
  SessionSummary 
} from './components/SchedulingComponents.js';
import { 
  ValidationPanel, 
  ConstraintRulesDisplay 
} from './components/ValidationComponents.js';

const ABAScheduler = () => {
  // SharePoint configuration
  const [spConfig] = useState({
    siteUrl: 'https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators',
    staffListName: 'Staff',
    studentsListName: 'Students',
    scheduleListName: 'ABASchedules',
    // Azure AD Configuration
    clientId: 'c9f70b7e-8ffb-403d-af93-80b95b38a0bb',
    tenantId: 'a4adcc38-7b4e-485c-80f9-7d9ca4e83d64',
    redirectUri: window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : 'https://mlr3037.github.io/EvokeSchedule2.0'
  });

  // Services
  const [sharePointService] = useState(() => new SharePointService(spConfig));
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

  useEffect(() => {
    initializeApp();
  }, []);

  // Initialize application
  const initializeApp = async () => {
    try {
      const isAuth = await sharePointService.checkAuthentication();
      setIsAuthenticated(isAuth);
      setAccessToken(sharePointService.accessToken);
      
      if (isAuth) {
        await loadData();
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  };

  // Load all data from SharePoint
  const loadData = async () => {
    setLoading(true);
    try {
      // Load staff, students, and schedule in parallel
      const [staffData, studentsData, scheduleData] = await Promise.all([
        sharePointService.loadStaff(),
        sharePointService.loadStudents(),
        sharePointService.loadSchedule(currentDate)
      ]);

      setStaff(staffData);
      setStudents(studentsData);
      setSchedule(scheduleData);
      
      console.log(`Loaded ${staffData.length} staff, ${studentsData.length} students`);
    } catch (error) {
      console.error('Error loading data:', error);
      // Show error to user
    } finally {
      setLoading(false);
    }
  };

  // Handle date change
  const handleDateChange = async (newDate) => {
    setCurrentDate(newDate);
    if (isAuthenticated) {
      try {
        const scheduleData = await sharePointService.loadSchedule(newDate);
        setSchedule(scheduleData);
      } catch (error) {
        console.error('Error loading schedule for new date:', error);
      }
    }
  };

  // Authentication handlers
  const handleLogin = async () => {
    try {
      await sharePointService.login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => {
    sharePointService.logout();
    setIsAuthenticated(false);
    setAccessToken(null);
    setStaff([]);
    setStudents([]);
    setSchedule(new Schedule({ date: currentDate }));
  };

  // Auto-assignment
  const handleAutoAssign = async () => {
    if (!validationResults?.isValid) {
      if (!window.confirm('There are validation errors. Do you want to proceed with auto-assignment anyway?')) {
        return;
      }
    }

    setAutoAssigning(true);
    autoAssignEngine.setDebugMode(true);
    
    try {
      const result = await autoAssignEngine.autoAssignSchedule(schedule, staff, students);
      
      if (result.assignments.length > 0) {
        console.log(`Auto-assignment created ${result.assignments.length} new assignments`);
        // Assignments were already added to schedule in the engine
        setSchedule({ ...schedule }); // Force re-render
      }
      
      if (result.errors.length > 0) {
        console.warn('Auto-assignment errors:', result.errors);
        // Show errors to user
      }
    } catch (error) {
      console.error('Auto-assignment failed:', error);
    } finally {
      setAutoAssigning(false);
    }
  };

  // Assignment management
  const handleAssignmentLock = (assignmentId) => {
    schedule.lockAssignment(assignmentId);
    setSchedule({ ...schedule });
  };

  const handleAssignmentUnlock = (assignmentId) => {
    schedule.unlockAssignment(assignmentId);
    setSchedule({ ...schedule });
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

    schedule.addAssignment(assignment);
    setSchedule({ ...schedule });
  };

  const handleAssignmentRemove = (assignmentId) => {
    schedule.removeAssignment(assignmentId);
    schedule.unlockAssignment(assignmentId); // Also unlock if it was locked
    setSchedule({ ...schedule });
  };

  // Save schedule
  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      await sharePointService.saveSchedule(schedule);
      console.log('Schedule saved successfully');
      // Show success message to user
    } catch (error) {
      console.error('Error saving schedule:', error);
      // Show error message to user
    } finally {
      setSaving(false);
    }
  };

  // Staff management
  const handleAddStaff = async (staffData) => {
    try {
      const newStaff = new Staff(staffData);
      await sharePointService.saveStaff(newStaff);
      await loadData(); // Reload data to get updated list
      setShowAddStaff(false);
    } catch (error) {
      console.error('Error adding staff:', error);
    }
  };

  const handleEditStaff = async (staffData) => {
    try {
      const updatedStaff = new Staff({ ...staffData, id: editingStaff.id });
      await sharePointService.saveStaff(updatedStaff, true);
      await loadData(); // Reload data
      setEditingStaff(null);
    } catch (error) {
      console.error('Error updating staff:', error);
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
    try {
      const newStudent = new Student(studentData);
      await sharePointService.saveStudent(newStudent);
      await loadData();
      setShowAddStudent(false);
    } catch (error) {
      console.error('Error adding student:', error);
    }
  };

  const handleEditStudent = async (studentData) => {
    try {
      const updatedStudent = new Student({ ...studentData, id: editingStudent.id });
      await sharePointService.saveStudent(updatedStudent, true);
      await loadData();
      setEditingStudent(null);
    } catch (error) {
      console.error('Error updating student:', error);
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

  // Validation change handler
  const handleValidationChange = (results) => {
    setValidationResults(results);
  };
      console.error('Error loading from SharePoint:', error);
      alert('Error loading data from SharePoint. Please check console for details.');
    }
    setLoading(false);
  };

  const loadScheduleHistory = async () => {
    try {
      const response = await fetch(
        `${spConfig.siteUrl}/_api/web/lists/getbytitle('${spConfig.scheduleListName}')/items?$top=100&$orderby=ScheduleDate desc`,
        { headers: getSharePointHeaders() }
      );
      const data = await response.json();
      
      const history = data.d.results.map(item => ({
        date: item.ScheduleDate,
        schedule: JSON.parse(item.ScheduleData || '{}')
      }));
      setScheduleHistory(history);
    } catch (error) {
      console.log('Schedule history list may not exist yet');
    }
  };

  const saveToSharePoint = async (listName, item, isUpdate = false) => {
    const url = isUpdate 
      ? `${spConfig.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${item.spId})`
      : `${spConfig.siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;

    const headers = {
      ...getSharePointHeaders(),
      'X-HTTP-Method': isUpdate ? 'MERGE' : 'POST',
      'IF-MATCH': isUpdate ? '*' : undefined
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(item)
      });
      return response.ok;
    } catch (error) {
      console.error('Error saving to SharePoint:', error);
      return false;
    }
  };

  const deleteFromSharePoint = async (listName, itemId) => {
    try {
      const response = await fetch(
        `${spConfig.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`,
        {
          method: 'POST',
          headers: {
            ...getSharePointHeaders(),
            'X-HTTP-Method': 'DELETE',
            'IF-MATCH': '*'
          }
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Error deleting from SharePoint:', error);
      return false;
    }
  };

  // CRUD Operations
  const addStaff = async (staffData) => {
    const newStaff = {
      __metadata: { type: 'SP.Data.StaffListItem' },
      Title: staffData.name,
      Role: staffData.position,
      Available: true,
      PrimaryProgram: staffData.primaryProgram,
      SecondaryProgram: staffData.secondaryProgram
    };

    const success = await saveToSharePoint(spConfig.staffListName, newStaff);
    if (success) {
      await loadFromSharePoint();
      setShowAddStaff(false);
    }
  };

  const updateStaff = async (staffData) => {
    const updatedStaff = {
      __metadata: { type: 'SP.Data.StaffListItem' },
      Title: staffData.name,
      Role: staffData.position,
      Available: staffData.available,
      PrimaryProgram: staffData.primaryProgram,
      SecondaryProgram: staffData.secondaryProgram,
      spId: staffData.spId
    };

    const success = await saveToSharePoint(spConfig.staffListName, updatedStaff, true);
    if (success) {
      await loadFromSharePoint();
      setEditingStaff(null);
    }
  };

  const deleteStaff = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    
    const staffMember = staff.find(s => s.id === staffId);
    const success = await deleteFromSharePoint(spConfig.staffListName, staffMember.spId);
    if (success) {
      await loadFromSharePoint();
    }
  };

  const addClient = async (clientData) => {
    const newClient = {
      __metadata: { type: 'SP.Data.ClientsListItem' },
      Title: clientData.name,
      Program: clientData.program,
      AMRatio: clientData.amRatio || '1:1',
      PMRatio: clientData.pmRatio || '1:1',
      LunchSchedule: clientData.lunch === 'first' ? 'First' : 'Second',
      RequiresLunch1to1: clientData.requiresLunch1to1,
      TeamStaffPeopleId: { results: clientData.teamIds }
    };

    const success = await saveToSharePoint(spConfig.clientsListName, newClient);
    if (success) {
      await loadFromSharePoint();
      setShowAddClient(false);
    }
  };

  const updateClient = async (clientData) => {
    const updatedClient = {
      __metadata: { type: 'SP.Data.ClientsListItem' },
      Title: clientData.name,
      Program: clientData.program,
      AMRatio: clientData.amRatio || '1:1',
      PMRatio: clientData.pmRatio || '1:1',
      // LunchSchedule: Do not update - this is managed in SharePoint
      RequiresLunch1to1: clientData.requiresLunch1to1,
      TeamStaffPeopleId: { results: clientData.teamIds },
      spId: clientData.spId
    };

    const success = await saveToSharePoint(spConfig.clientsListName, updatedClient, true);
    if (success) {
      await loadFromSharePoint();
      setEditingClient(null);
    }
  };

  const deleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    
    const client = clients.find(c => c.id === clientId);
    const success = await deleteFromSharePoint(spConfig.clientsListName, client.spId);
    if (success) {
      await loadFromSharePoint();
    }
  };

  // Staff role priority for assignment preference
  const getStaffRolePriority = (position) => {
    const rolePriority = {
      'RBT': 1,        // Highest priority - prefer RBTs first
      'BS': 2,         // Second priority - Bachelor's level staff
      'BCBA': 3,       // Third priority - Board Certified Behavior Analysts
      'EA': 4,         // Fourth priority - Educational Assistants
      'CC': 5,         // Lowest priority - Care Coordinators
      'BCaBA': 3       // Same as BCBA
    };
    return rolePriority[position] || 6;
  };

  // Get staff workload priority (staff working with fewer clients get higher priority)
  const getStaffWorkloadPriority = (staffId) => {
    const clientCount = clients.filter(client => client.teamIds.includes(staffId)).length;
    // Return negative value so fewer clients = higher priority (lower number in sort)
    return clientCount;
  };

  // Sort staff by workload (fewer clients first) then by role priority
  const sortStaffByPriority = (staffList) => {
    return [...staffList].sort((a, b) => {
      // First priority: staff with fewer clients
      const aWorkload = getStaffWorkloadPriority(a.id);
      const bWorkload = getStaffWorkloadPriority(b.id);
      if (aWorkload !== bWorkload) {
        return aWorkload - bWorkload; // Fewer clients first
      }
      
      // Second priority: role hierarchy (RBT first, then BS, etc.)
      const aRolePriority = getStaffRolePriority(a.position);
      const bRolePriority = getStaffRolePriority(b.position);
      return aRolePriority - bRolePriority;
    });
  };

  // Get client priority score (2:1 kids first, then kids with fewer RBTs on team)
  const getClientPriority = (client) => {
    let priority = 0;
    
    // Prioritize 2:1 clients (lower score = higher priority)
    if (client.amRatio === 2 || client.pmRatio === 2 || client.lunchRatio === '1:2') {
      priority -= 100; // High priority for 2:1 clients
    }
    
    // Count RBTs on client's team
    const rbtCount = staff.filter(s => 
      client.teamIds.includes(s.id) && s.position === 'RBT'
    ).length;
    
    // Clients with fewer RBTs get higher priority
    priority += rbtCount * 10;
    
    return priority;
  };

  // Enhanced cascading auto-assignment algorithm
  // Enhanced cascading auto-assignment algorithm with program separation
  const autoAssignWithCascading = () => {
    const dateKey = getDateKey(currentDate);
    const assignments = {};
    const staffBookings = {}; // Track what each staff is assigned to
    
    console.log(`\n🚀 STARTING AUTO-ASSIGNMENT for ${dateKey}`);
    console.log(`📊 Total clients: ${clients.length}, Total staff: ${staff.length}`);
    
    // Debug: Check data structure
    if (clients.length === 0) {
      console.error('❌ No clients found!');
      return;
    }
    if (staff.length === 0) {
      console.error('❌ No staff found!');
      return;
    }
    
    // Initialize with locked assignments
    clients.forEach(client => {
      assignments[client.id] = {
        am: [...(lockedAssignments[`${client.id}-am`] || [])],
        pm: [...(lockedAssignments[`${client.id}-pm`] || [])],
        lunch1: [...(lockedAssignments[`${client.id}-lunch1`] || [])],
        lunch2: [...(lockedAssignments[`${client.id}-lunch2`] || [])]
      };
      
      // Mark locked staff as booked
      ['am', 'pm', 'lunch1', 'lunch2'].forEach(session => {
        assignments[client.id][session].forEach(staffId => {
          if (!staffBookings[staffId]) staffBookings[staffId] = {};
          staffBookings[staffId][session] = client.id;
        });
      });
    });

    // Helper function to check if we can reassign a client to different staff
    const canReassignClient = (client, session, excludeStaffId, currentAssignments, currentBookings) => {
      const alternativeTeamRBTs = staff
        .filter(s => client.teamIds.includes(s.id))
        .filter(s => s.id !== excludeStaffId)
        .filter(s => s.position === 'RBT')
        .filter(s => isStaffAvailable(s, session))
        .filter(s => !currentBookings[s.id]?.[session])
        .filter(s => session !== 'pm' || !currentAssignments[client.id].am.includes(s.id));
      
      let requiredStaff = 1;
      if (session === 'am') requiredStaff = client.amRatio === 2 ? 2 : 1;
      else if (session === 'pm') requiredStaff = client.pmRatio === 2 ? 2 : 1;
      
      const currentAssignmentCount = currentAssignments[client.id][session].length;
      const neededAfterRemoval = requiredStaff - (currentAssignmentCount - 1);
      
      return alternativeTeamRBTs.length >= neededAfterRemoval;
    };

    // Assignment function for a single session with program separation
    const assignSession = (clientsList, session) => {
      console.log(`\n=== ASSIGNING ${session.toUpperCase()} SESSION ===`);
      
      // Separate clients by program for independent assignment
      const primaryClients = clientsList.filter(c => c.program?.includes('Primary'));
      const secondaryClients = clientsList.filter(c => c.program?.includes('Secondary'));
      const otherClients = clientsList.filter(c => !c.program?.includes('Primary') && !c.program?.includes('Secondary'));
      
      console.log(`Primary clients: ${primaryClients.length}, Secondary clients: ${secondaryClients.length}, Other: ${otherClients.length}`);
      
      // Process each program separately, including "other" clients
      [primaryClients, secondaryClients, otherClients].forEach((programClients, index) => {
        const programName = index === 0 ? 'PRIMARY' : index === 1 ? 'SECONDARY' : 'OTHER';
        if (programClients.length === 0) return;
        
        console.log(`\n--- Processing ${programName} Program ---`);
        
        // Sort clients by priority within program
        const sortedClients = [...programClients].sort((a, b) => {
          // Prioritize 2:1 clients
          const aPriority = (a.amRatio === 2 || a.pmRatio === 2) ? -100 : 0;
          const bPriority = (b.amRatio === 2 || b.pmRatio === 2) ? -100 : 0;
          
          if (aPriority !== bPriority) return aPriority - bPriority;
          
          // Then by fewer RBTs on team
          const aRBTCount = staff.filter(s => a.teamIds?.includes(s.id) && s.position === 'RBT').length;
          const bRBTCount = staff.filter(s => b.teamIds?.includes(s.id) && s.position === 'RBT').length;
          return aRBTCount - bRBTCount;
        });

        for (const client of sortedClients) {
          if (assignments[client.id][session].length > 0) {
            console.log(`  ⏭️ ${client.name} already assigned for ${session}`);
            continue; // Already assigned
          }
          
          let requiredStaff = 1;
          if (session === 'am') requiredStaff = client.amRatio === 2 ? 2 : 1;
          else if (session === 'pm') requiredStaff = client.pmRatio === 2 ? 2 : 1;
          else if (session === 'lunch1' || session === 'lunch2') requiredStaff = client.requiresLunch1to1 ? 1 : 1;
          
          let assignedStaff = [];
          
          console.log(`\n🎯 Processing ${client.name}: needs ${requiredStaff} staff`);
          console.log(`   Team IDs: ${client.teamIds || 'NONE'}`);
          
          // Get available team members - with fallback if teamIds is empty
          let teamStaff = [];
          
          if (client.teamIds && client.teamIds.length > 0) {
            // Try team-only assignment first
            teamStaff = staff
              .filter(s => client.teamIds.includes(s.id))
              .filter(s => isStaffAvailable(s, session))
              .filter(s => {
                if (session === 'lunch1' || session === 'lunch2') return lunchStaffPositions.includes(s.position);
                return positionHierarchy[s.position] <= 6;
              })
              .filter(s => session !== 'pm' || !assignments[client.id].am.includes(s.id))
              .filter(s => !staffBookings[s.id]?.[session]);
          }
          
          // FALLBACK: If no team members available or no teamIds, try all available staff
          if (teamStaff.length === 0) {
            console.log(`   ⚠️ No team members available, trying all staff as fallback...`);
            teamStaff = staff
              .filter(s => isStaffAvailable(s, session))
              .filter(s => {
                if (session === 'lunch1' || session === 'lunch2') return lunchStaffPositions.includes(s.position);
                return positionHierarchy[s.position] <= 6;
              })
              .filter(s => session !== 'pm' || !assignments[client.id].am.includes(s.id))
              .filter(s => !staffBookings[s.id]?.[session]);
          }

          console.log(`   Available staff: ${teamStaff.length} (${teamStaff.map(s => `${s.name}(${s.position})`).join(', ')})`);

          // STEP 1: Try RBTs first
          const availableRBTs = sortStaffByPriority(teamStaff.filter(s => s.position === 'RBT'));
          if (availableRBTs.length > 0 && assignedStaff.length < requiredStaff) {
            const needed = Math.min(availableRBTs.length, requiredStaff - assignedStaff.length);
            const selectedRBTs = availableRBTs.slice(0, needed);
            console.log(`  ✓ Using RBTs:`, selectedRBTs.map(s => `${s.name} (${getStaffWorkloadPriority(s.id)} clients)`));
            assignedStaff.push(...selectedRBTs);
          }

          // STEP 2: If still need more, try cascading RBT reassignment (only if team-based assignment)
          if (assignedStaff.length < requiredStaff && client.teamIds && client.teamIds.length > 0) {
            console.log(`  🔄 Trying RBT cascading for ${client.name}...`);
            
            const teamRBTsAssignedElsewhere = staff
              .filter(s => client.teamIds.includes(s.id))
              .filter(s => s.position === 'RBT')
              .filter(s => staffBookings[s.id]?.[session])
              .filter(s => isStaffAvailable(s, session));

            for (const rbtStaff of teamRBTsAssignedElsewhere) {
              if (assignedStaff.length >= requiredStaff) break;
              
              const currentAssignment = staffBookings[rbtStaff.id][session];
              const otherClient = clients.find(c => c.id === currentAssignment);
              
              if (otherClient && canReassignClient(otherClient, session, rbtStaff.id, assignments, staffBookings)) {
                console.log(`    ↻ Cascading: Moving RBT ${rbtStaff.name} from ${otherClient.name} to ${client.name}`);
                
                // Remove from other client
                assignments[currentAssignment][session] = 
                  assignments[currentAssignment][session].filter(id => id !== rbtStaff.id);
                delete staffBookings[rbtStaff.id][session];
                
                // Assign to current client
                assignedStaff.push(rbtStaff);
              }
            }
          }

          // STEP 3: Use BS after RBT options exhausted
          if (assignedStaff.length < requiredStaff) {
            const availableBS = sortStaffByPriority(teamStaff.filter(s => s.position === 'BS'))
              .filter(s => !assignedStaff.map(staff => staff.id || staff).includes(s.id));
            
            if (availableBS.length > 0) {
              const needed = Math.min(availableBS.length, requiredStaff - assignedStaff.length);
              const selectedBS = availableBS.slice(0, needed);
              console.log(`  ✓ Using BS:`, selectedBS.map(s => `${s.name} (${getStaffWorkloadPriority(s.id)} clients)`));
              assignedStaff.push(...selectedBS);
            }
          }

          // STEP 4: Use other positions as last resort
          if (assignedStaff.length < requiredStaff) {
            const availableOther = sortStaffByPriority(teamStaff.filter(s => ['BCBA', 'BCaBA', 'EA', 'CC'].includes(s.position)))
              .filter(s => !assignedStaff.map(staff => staff.id || staff).includes(s.id));
            
            if (availableOther.length > 0) {
              const needed = Math.min(availableOther.length, requiredStaff - assignedStaff.length);
              const selectedOther = availableOther.slice(0, needed);
              console.log(`  ✓ Using other positions:`, selectedOther.map(s => `${s.name} (${s.position})`));
              assignedStaff.push(...selectedOther);
            }
          }

          // Assign the staff we found
          if (assignedStaff.length > 0) {
            assignments[client.id][session] = assignedStaff.map(s => s.id || s);
            assignedStaff.forEach(staff => {
              const staffId = staff.id || staff;
              if (!staffBookings[staffId]) staffBookings[staffId] = {};
              staffBookings[staffId][session] = client.id;
            });
            
            console.log(`  ✅ Assigned ${assignedStaff.length}/${requiredStaff} to ${client.name}`);
          } else {
            console.log(`  ❌ Could not assign anyone to ${client.name} - no available staff found`);
          }
        }
      });
    };

    // Assign in order: AM, PM, then lunch sessions
    assignSession(clients, 'am');
    assignSession(clients, 'pm');
    
    // Handle lunch assignments with better debugging
    console.log('\n🍽️ === LUNCH ASSIGNMENT PHASE ===');
    const processedLunchGroups = new Set();
    
    clients.forEach(client => {
      const lunchSession = client.lunch === 'first' ? 'lunch1' : 'lunch2';
      
      // Skip if this client is in a group that's already been processed
      if (processedLunchGroups.has(client.id)) return;
      
      console.log(`\n🍽️ Processing lunch for ${client.name} (${lunchSession})`);
      
      // Handle lunch groups 
      if (client.lunchGroupIds && client.lunchGroupIds.length > 0) {
        const lunchGroup = [client.id, ...client.lunchGroupIds];
        console.log(`   Group lunch: ${lunchGroup.length} clients`);
        
        // Try team member first, then fallback to any available staff
        let lunchStaff = sortStaffByPriority(staff
          .filter(s => client.teamIds?.includes(s.id))
          .filter(s => lunchStaffPositions.includes(s.position))
          .filter(s => !staffBookings[s.id]?.[lunchSession]));

        // Fallback to any available lunch staff if no team members
        if (lunchStaff.length === 0) {
          console.log('   No team lunch staff, trying all available...');
          lunchStaff = sortStaffByPriority(staff
            .filter(s => lunchStaffPositions.includes(s.position))
            .filter(s => !staffBookings[s.id]?.[lunchSession]));
        }

        if (lunchStaff.length >= 1) {
          console.log(`   ✓ Assigning ${lunchStaff[0].name} to lunch group`);
          lunchGroup.forEach(clientId => {
            if (!assignments[clientId]) assignments[clientId] = { am: [], lunch1: [], lunch2: [], pm: [] };
            assignments[clientId][lunchSession] = [lunchStaff[0].id];
            processedLunchGroups.add(clientId);
          });
          
          if (!staffBookings[lunchStaff[0].id]) staffBookings[lunchStaff[0].id] = {};
          staffBookings[lunchStaff[0].id][lunchSession] = client.id;
        } else {
          console.log('   ❌ No available lunch staff for group');
        }
        return;
      }
      
      // Skip if already assigned (locked)
      if (assignments[client.id][lunchSession].length > 0) {
        console.log(`   ⏭️ Already assigned for lunch`);
        return;
      }
      
      // Individual lunch coverage if needed
      if (client.requiresLunch1to1) {
        console.log(`   Individual 1:1 lunch needed`);
        
        // Try team member first
        let lunchStaff = sortStaffByPriority(staff
          .filter(s => client.teamIds?.includes(s.id))
          .filter(s => lunchStaffPositions.includes(s.position))
          .filter(s => !staffBookings[s.id]?.[lunchSession]));

        // Fallback to any available lunch staff
        if (lunchStaff.length === 0) {
          console.log('   No team lunch staff, trying all available...');
          lunchStaff = sortStaffByPriority(staff
            .filter(s => lunchStaffPositions.includes(s.position))
            .filter(s => !staffBookings[s.id]?.[lunchSession]));
        }

        if (lunchStaff.length >= 1) {
          console.log(`   ✓ Assigning ${lunchStaff[0].name} for individual lunch`);
          assignments[client.id][lunchSession] = [lunchStaff[0].id];
          if (!staffBookings[lunchStaff[0].id]) staffBookings[lunchStaff[0].id] = {};
          staffBookings[lunchStaff[0].id][lunchSession] = client.id;
        } else {
          console.log('   ❌ No available lunch staff for individual assignment');
        }
      } else {
        console.log(`   No individual lunch coverage needed`);
      }
    });

    console.log('\n✅ === ASSIGNMENT COMPLETE ===');
    console.log(`📋 Final assignments for ${Object.keys(assignments).length} clients`);
    
    setSchedule(prev => ({ ...prev, [dateKey]: assignments }));
  };

  // Helper functions
  const getDateKey = (date) => date.toISOString().split('T')[0];

  const getPenalty = (staffId, clientId, session, date) => {
    let penalty = 0;
    const dateKey = getDateKey(date);
    
    for (let i = 1; i <= 3; i++) {
      const checkDate = new Date(date);
      checkDate.setDate(checkDate.getDate() - i);
      const checkKey = getDateKey(checkDate);
      
      const hist = scheduleHistory.find(h => h.date === checkKey);
      if (hist && hist.schedule[clientId]?.[session]?.includes(staffId)) {
        penalty += (4 - i);
      }
    }
    return penalty;
  };

  const getAvailableStaffForClient = (client, session) => {
    // For lunch sessions, if client is in a lunch group, include staff from all group members
    if ((session === 'lunch1' || session === 'lunch2') && client.lunchGroupIds.length > 0) {
      const lunchGroup = getLunchGroupForClient(client.id);
      const allTeamIds = [];
      lunchGroup.forEach(clientId => {
        const groupClient = clients.find(c => c.id === clientId);
        if (groupClient) {
          allTeamIds.push(...groupClient.teamIds);
        }
      });
      const uniqueTeamIds = [...new Set(allTeamIds)];
      return staff.filter(s => uniqueTeamIds.includes(s.id));
    }
    
    // For all other sessions (AM, PM) or non-grouped lunch, only use client's own team
    return staff.filter(s => client.teamIds.includes(s.id));
  };

  const getLunchGroupForClient = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.lunchGroupIds.length) return [clientId];
    
    // Return the full lunch group including this client
    return [clientId, ...client.lunchGroupIds];
  };

  const isClientInLunchGroup = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client && client.lunchGroupIds.length > 0;
  };

  const getLunchDisplayText = (client) => {
    if (client.requiresLunch1to1) {
      return `${client.lunchRatio} (separate)`;
    } else if (client.lunchGroupIds.length > 0) {
      const groupNames = client.lunchGroupIds.map(id => {
        const groupClient = clients.find(c => c.id === id);
        return groupClient ? groupClient.name : `ID${id}`;
      }).join(', ');
      return `${client.lunchRatio} with ${groupNames}`;
    } else {
      return `${client.lunchRatio} (AM staff)`;
    }
  };

  const getStaffPMStartTime = (staffId) => {
    const dateKey = getDateKey(currentDate);
    const currentScheduleForDate = schedule[dateKey] || {};
    
    // Find which client this staff member worked with in AM
    for (const [clientId, clientSchedule] of Object.entries(currentScheduleForDate)) {
      if (clientSchedule.am && clientSchedule.am.includes(staffId)) {
        const client = clients.find(c => c.id === parseInt(clientId));
        if (client) {
          // If AM client has first lunch (11:30-12:00), staff returns at 12:00
          // If AM client has second lunch (12:00-12:30), staff returns at 12:30
          return client.lunch === 'first' ? '12:00' : '12:30';
        }
      }
    }
    
    // Default to 12:30 if no AM assignment found
    return '12:30';
  };

  const isStaffAvailableForPMClient = (staffMember, pmClient) => {
    // First check basic availability
    if (!isStaffAvailable(staffMember, 'pm')) return false;
    
    const dateKey = getDateKey(currentDate);
    const currentScheduleForDate = schedule[dateKey] || {};
    
    // Find which client this staff member worked with in AM
    let staffPMStartTime = '12:30'; // Default PM start time
    for (const [clientId, clientSchedule] of Object.entries(currentScheduleForDate)) {
      if (clientSchedule.am && clientSchedule.am.includes(staffMember.id)) {
        const amClient = clients.find(c => c.id === parseInt(clientId));
        if (amClient) {
          // Staff PM availability depends on their AM client's lunch schedule
          staffPMStartTime = amClient.lunch === 'first' ? '12:00' : '12:30';
          break;
        }
      }
    }
    
    // If PM client needs staff to start at 12:00 but staff isn't available until 12:30, not compatible
    // For now, we'll be flexible and allow any timing since the UI shows the correct times
    return true;
  };

  const isStaffAvailable = (staffMember, session) => {
    if (staffMember.availability === 'unavailable') return false;
    if (staffMember.availability === 'all_day') {
      // For PM sessions, check if staff is coming back from lunch based on their AM client's lunch schedule
      if (session === 'pm') {
        const dateKey = getDateKey(currentDate);
        const currentScheduleForDate = schedule[dateKey] || {};
        
        // Find which client this staff member worked with in AM
        let amClientLunchSchedule = null;
        for (const [clientId, clientSchedule] of Object.entries(currentScheduleForDate)) {
          if (clientSchedule.am && clientSchedule.am.includes(staffMember.id)) {
            const client = clients.find(c => c.id === parseInt(clientId));
            if (client) {
              amClientLunchSchedule = client.lunch;
              break;
            }
          }
        }
        
        // If staff worked AM with a first lunch client, they're available for PM at 12:00
        // If staff worked AM with a second lunch client, they're available for PM at 12:30
        // This logic is handled in the UI by showing appropriate times
        return true;
      }
      
      // For lunch sessions, staff are available based on general availability
      if (session === 'lunch1' || session === 'lunch2') return true;
      
      return true;
    }
    if (session === 'am' && staffMember.availability === 'am_only') return true;
    if (session === 'pm' && staffMember.availability === 'pm_only') return true;
    if ((session === 'lunch1' || session === 'lunch2') && staffMember.availability === 'all_day') return true;
    return false;
  };

  const updateAssignment = (clientId, session, staffIds) => {
    const dateKey = getDateKey(currentDate);
    setSchedule(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [clientId]: {
          ...prev[dateKey]?.[clientId],
          [session]: staffIds
        }
      }
    }));
  };

  const toggleLock = (clientId, session) => {
    const key = `${clientId}-${session}`;
    const dateKey = getDateKey(currentDate);
    const currentAssignment = schedule[dateKey]?.[clientId]?.[session] || [];

    setLockedAssignments(prev => {
      if (prev[key]) {
        const newLocked = { ...prev };
        delete newLocked[key];
        return newLocked;
      } else {
        return { ...prev, [key]: currentAssignment };
      }
    });
  };

  const finalizeSchedule = async () => {
    const dateKey = getDateKey(currentDate);
    if (!schedule[dateKey]) {
      alert('No schedule to finalize for this date');
      return;
    }

    // Save to SharePoint
    const scheduleItem = {
      __metadata: { type: 'SP.Data.SchedulesListItem' },
      Title: `Schedule ${dateKey}`,
      ScheduleDate: dateKey,
      ScheduleData: JSON.stringify(schedule[dateKey])
    };

    const success = await saveToSharePoint(spConfig.scheduleListName, scheduleItem);
    if (success) {
      setScheduleHistory(prev => [
        ...prev.filter(h => h.date !== dateKey),
        { date: dateKey, schedule: schedule[dateKey] }
      ]);
      alert('Schedule finalized and saved!');
    }
  };

  const clearSchedule = () => {
    if (window.confirm('Are you sure you want to clear the schedule? This will remove all assignments except locked ones.')) {
      const dateKey = getDateKey(currentDate);
      const currentSchedule = schedule[dateKey] || {};
      const clearedSchedule = {};
      
      // Preserve locked assignments only
      Object.keys(currentSchedule).forEach(clientId => {
        const clientSchedule = currentSchedule[clientId];
        const clearedClientSchedule = {};
        
        ['am', 'lunch1', 'lunch2', 'pm'].forEach(session => {
          if (clientSchedule[session]) {
            const lockedStaff = clientSchedule[session].filter(staffId => 
              lockedAssignments[`${clientId}-${session}`]?.includes(staffId)
            );
            if (lockedStaff.length > 0) {
              clearedClientSchedule[session] = lockedStaff;
            }
          }
        });
        
        if (Object.keys(clearedClientSchedule).length > 0) {
          clearedSchedule[clientId] = clearedClientSchedule;
        }
      });
      
      setSchedule(prev => ({
        ...prev,
        [dateKey]: clearedSchedule
      }));
    }
  };

  const exportToCSV = () => {
    const dateKey = getDateKey(currentDate);
    const currentSchedule = schedule[dateKey] || {};
    
    const csvData = [];
    csvData.push(['Client Name', 'Program', 'Lunch', 'AM Staff', 'Lunch Staff', 'PM Staff', 'Locked Assignments']);
    
    clients.forEach(client => {
      const clientSchedule = currentSchedule[client.id] || {};
      const amStaff = (clientSchedule.am || []).map(id => staff.find(s => s.id === id)?.name || id).join(', ');
      const lunchStaff = (
        client.lunch === 'first' 
          ? (clientSchedule.lunch1 || []).map(id => staff.find(s => s.id === id)?.name || id).join(', ')
          : (clientSchedule.lunch2 || []).map(id => staff.find(s => s.id === id)?.name || id).join(', ')
      );
      const pmStaff = (clientSchedule.pm || []).map(id => staff.find(s => s.id === id)?.name || id).join(', ');
      
      const lockedInfo = [];
      ['am', 'lunch1', 'lunch2', 'pm'].forEach(session => {
        const lockKey = `${client.id}-${session}`;
        if (lockedAssignments[lockKey]?.length > 0) {
          const lockedStaffNames = lockedAssignments[lockKey]
            .map(id => staff.find(s => s.id === id)?.name || id)
            .join(', ');
          lockedInfo.push(`${session}: ${lockedStaffNames}`);
        }
      });
      
      csvData.push([
        client.name,
        client.program,
        client.lunch === 'first' ? 'First (11:30-12:00)' : 'Second (12:00-12:30)',
        amStaff,
        lunchStaff,
        pmStaff,
        lockedInfo.join('; ')
      ]);
    });
    
    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `evoke-schedule-${currentDate.toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleStaffAvailability = (staffId, availability) => {
    setStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, availability, available: availability !== 'unavailable' } : s
    ));
  };

  const currentSchedule = schedule[getDateKey(currentDate)] || {};

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Calendar className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Evoke Daily Schedule</h1>
          <p className="text-gray-600 mb-6">Sign in with your Microsoft account to access the scheduler</p>
          
          {spConfig.clientId === 'YOUR_CLIENT_ID_HERE' ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ Configuration Required</p>
              <p className="text-sm text-yellow-700">Please update the Azure AD configuration in the code:</p>
              <ul className="text-xs text-left mt-2 space-y-1">
                <li>• Set your <code>clientId</code></li>
                <li>• Set your <code>tenantId</code></li>
              </ul>
            </div>
          ) : (
            <>
              <button
                onClick={login}
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mb-4"
              >
                <LogIn className="w-5 h-5" />
                Sign in with Microsoft
              </button>
              
              {/* Development bypass - remove in production */}
              {window.location.hostname === 'localhost' && (
                <button
                  onClick={() => {
                    setIsAuthenticated(true);
                    setAccessToken('dev-token');
                  }}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Development Mode (Skip Authentication)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-8 h-8 text-blue-600" />
              Evoke Daily Schedule
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={loadFromSharePoint}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Upload className="w-5 h-5" />
                {loading ? 'Loading...' : 'Sync SharePoint'}
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
              <input
                type="date"
                value={getDateKey(currentDate)}
                onChange={(e) => setCurrentDate(new Date(e.target.value))}
                className="px-4 py-2 border rounded-lg"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 font-medium ${activeTab === 'schedule' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('staff-management')}
              className={`px-4 py-2 font-medium ${activeTab === 'staff-management' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Staff Management
            </button>
            <button
              onClick={() => setActiveTab('client-management')}
              className={`px-4 py-2 font-medium ${activeTab === 'client-management' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Client Management
            </button>
            <button
              onClick={() => setActiveTab('staff-attendance')}
              className={`px-4 py-2 font-medium ${activeTab === 'staff-attendance' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Staff Attendance
            </button>
          </div>
        </div>

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <>
            {/* Staff Analysis Box */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Staff Analysis for {getDateKey(currentDate)}
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* AM Session Analysis */}
                <div>
                  <h3 className="font-semibold mb-3 text-blue-700">AM Session (8:00-11:30)</h3>
                  <div className="space-y-2">
                    {/* Staff by Role */}
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="text-sm font-medium mb-2">Staff Assigned by Role:</div>
                      {(() => {
                        const currentSchedule = schedule[getDateKey(currentDate)] || {};
                        const assignedStaffIds = new Set();
                        
                        // Collect all assigned staff in AM
                        Object.values(currentSchedule).forEach(clientSchedule => {
                          if (clientSchedule.am) {
                            clientSchedule.am.forEach(staffId => assignedStaffIds.add(staffId));
                          }
                        });
                        
                        // Count by role
                        const roleCount = {};
                        assignedStaffIds.forEach(staffId => {
                          const staffMember = staff.find(s => s.id === staffId);
                          if (staffMember) {
                            roleCount[staffMember.position] = (roleCount[staffMember.position] || 0) + 1;
                          }
                        });
                        
                        return Object.entries(roleCount).map(([role, count]) => (
                          <div key={role} className="text-xs flex justify-between">
                            <span>{role}:</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    
                    {/* Unassigned Staff */}
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-sm font-medium mb-2">Unassigned Staff:</div>
                      {(() => {
                        const currentSchedule = schedule[getDateKey(currentDate)] || {};
                        const assignedStaffIds = new Set();
                        
                        // Collect all assigned staff in AM
                        Object.values(currentSchedule).forEach(clientSchedule => {
                          if (clientSchedule.am) {
                            clientSchedule.am.forEach(staffId => assignedStaffIds.add(staffId));
                          }
                        });
                        
                        const unassignedStaff = staff.filter(s => 
                          !assignedStaffIds.has(s.id) && 
                          (s.availability === 'all_day' || s.availability === 'am_only')
                        );
                        
                        return unassignedStaff.length > 0 ? (
                          <div className="text-xs space-y-1">
                            {unassignedStaff.map(s => (
                              <div key={s.id} className="flex justify-between">
                                <span>{s.name}</span>
                                <span className="text-gray-500">({s.position})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-green-600 font-medium">All available staff assigned ✓</div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* PM Session Analysis */}
                <div>
                  <h3 className="font-semibold mb-3 text-green-700">PM Session (12:30-3:00)</h3>
                  <div className="space-y-2">
                    {/* Staff by Role */}
                    <div className="bg-green-50 p-3 rounded">
                      <div className="text-sm font-medium mb-2">Staff Assigned by Role:</div>
                      {(() => {
                        const currentSchedule = schedule[getDateKey(currentDate)] || {};
                        const assignedStaffIds = new Set();
                        
                        // Collect all assigned staff in PM
                        Object.values(currentSchedule).forEach(clientSchedule => {
                          if (clientSchedule.pm) {
                            clientSchedule.pm.forEach(staffId => assignedStaffIds.add(staffId));
                          }
                        });
                        
                        // Count by role
                        const roleCount = {};
                        assignedStaffIds.forEach(staffId => {
                          const staffMember = staff.find(s => s.id === staffId);
                          if (staffMember) {
                            roleCount[staffMember.position] = (roleCount[staffMember.position] || 0) + 1;
                          }
                        });
                        
                        return Object.entries(roleCount).map(([role, count]) => (
                          <div key={role} className="text-xs flex justify-between">
                            <span>{role}:</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    
                    {/* Unassigned Staff */}
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-sm font-medium mb-2">Unassigned Staff:</div>
                      {(() => {
                        const currentSchedule = schedule[getDateKey(currentDate)] || {};
                        const assignedStaffIds = new Set();
                        
                        // Collect all assigned staff in PM
                        Object.values(currentSchedule).forEach(clientSchedule => {
                          if (clientSchedule.pm) {
                            clientSchedule.pm.forEach(staffId => assignedStaffIds.add(staffId));
                          }
                        });
                        
                        const unassignedStaff = staff.filter(s => 
                          !assignedStaffIds.has(s.id) && 
                          (s.availability === 'all_day' || s.availability === 'pm_only')
                        );
                        
                        return unassignedStaff.length > 0 ? (
                          <div className="text-xs space-y-1">
                            {unassignedStaff.map(s => (
                              <div key={s.id} className="flex justify-between">
                                <span>{s.name}</span>
                                <span className="text-gray-500">({s.position})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-green-600 font-medium">All available staff assigned ✓</div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Staff Workload Analysis */}
                <div>
                  <h3 className="font-semibold mb-3 text-purple-700">Staff Workload Priority</h3>
                  <div className="space-y-2">
                    {/* Staff by Client Count */}
                    <div className="bg-purple-50 p-3 rounded">
                      <div className="text-sm font-medium mb-2">Staff by Client Count (Lower = Higher Priority):</div>
                      {(() => {
                        // Group staff by client count
                        const staffByClientCount = {};
                        staff.forEach(s => {
                          const clientCount = getStaffWorkloadPriority(s.id);
                          if (!staffByClientCount[clientCount]) {
                            staffByClientCount[clientCount] = [];
                          }
                          staffByClientCount[clientCount].push(s);
                        });
                        
                        return Object.entries(staffByClientCount)
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .map(([clientCount, staffList]) => (
                            <div key={clientCount} className="text-xs mb-2">
                              <div className="font-medium text-purple-800 mb-1">
                                {clientCount} client{clientCount !== '1' ? 's' : ''}: 
                              </div>
                              <div className="ml-2 space-y-1">
                                {staffList.map(s => (
                                  <div key={s.id} className="flex justify-between">
                                    <span>{s.name}</span>
                                    <span className="text-gray-500">({s.position})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-3">
              <button
                onClick={autoAssignWithCascading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <RefreshCw className="w-5 h-5" />
                Auto Assign All Sessions
              </button>
              <button
                onClick={clearSchedule}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Clear Schedule
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                <Upload className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={finalizeSchedule}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                <Save className="w-5 h-5" />
                Finalize Schedule
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-1 py-1 text-left font-semibold text-gray-700 text-xs">Client</th>
                      <th className="px-1 py-1 text-left font-semibold text-gray-700 text-xs">Program</th>
                      <th className="px-1 py-1 text-left font-semibold text-gray-700 text-xs">AM</th>
                      <th className="px-1 py-1 text-left font-semibold text-gray-700 text-xs">L1</th>
                      <th className="px-1 py-1 text-left font-semibold text-gray-700 text-xs">L2</th>
                      <th className="px-1 py-1 text-left font-semibold text-gray-700 text-xs">PM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clients
                      .sort((a, b) => {
                        // First sort by program (Primary first)
                        if (a.program !== b.program) {
                          if (a.program === 'Primary') return -1;
                          if (b.program === 'Primary') return 1;
                          return a.program.localeCompare(b.program);
                        }
                        // Then sort alphabetically by name
                        return a.name.localeCompare(b.name);
                      })
                      .map(client => {
                      const clientSchedule = currentSchedule[client.id] || { am: [], lunch1: [], lunch2: [], pm: [] };
                      const teamStaff = staff.filter(s => client.teamIds.includes(s.id));
                      const lunchStaff = getAvailableStaffForClient(client, client.lunch === 'first' ? 'lunch1' : 'lunch2');

                      return (
                        <tr key={client.id} className="hover:bg-gray-50">
                          <td className="px-1 py-1 font-medium text-xs">{client.name}</td>
                          <td className="px-1 py-1">
                            <span className={`px-1 py-0.5 rounded text-xs ${client.program?.includes('Primary') ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                              {client.program?.replace('Primary/', 'P/').replace('Secondary/', 'S/')}
                            </span>
                          </td>
                          
                          {/* AM Session */}
                          <td className="px-1 py-1">
                            <div className="flex items-start gap-1">
                              <span className="text-xs text-gray-500 w-6 mt-1">{client.amRatio}</span>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-1">
                                  <select
                                    value={clientSchedule.am[0] || ''}
                                    onChange={(e) => {
                                      const newStaff = client.amRatio === '2:1'
                                        ? [parseInt(e.target.value), clientSchedule.am[1] || '']
                                        : [parseInt(e.target.value)];
                                      updateAssignment(client.id, 'am', newStaff.filter(Boolean));
                                    }}
                                    className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                  >
                                    <option value="">-</option>
                                    {teamStaff.filter(s => isStaffAvailable(s, 'am')).map(s => (
                                      <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
                                    ))}
                                  </select>
                                  {clientSchedule.am[0] && (
                                    <span className="text-xs text-gray-500">- 12:00</span>
                                  )}
                                </div>
                                {client.amRatio === '2:1' && (
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={clientSchedule.am[1] || ''}
                                      onChange={(e) => {
                                        const newStaff = [clientSchedule.am[0] || '', parseInt(e.target.value)];
                                        updateAssignment(client.id, 'am', newStaff.filter(Boolean));
                                      }}
                                      className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                    >
                                      <option value="">-</option>
                                      {teamStaff.filter(s => isStaffAvailable(s, 'am')).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
                                      ))}
                                    </select>
                                    {clientSchedule.am[1] && (
                                      <span className="text-xs text-gray-500">- 12:00</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleLock(client.id, 'am')}
                                className={`p-1 rounded ${lockedAssignments[`${client.id}-am`] ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                              >
                                {lockedAssignments[`${client.id}-am`] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>

                          {/* Lunch 1 (11:30-12:00) */}
                          <td className="px-1 py-1">
                            {client.lunch === 'first' ? (
                              client.requiresLunch1to1 ? (
                                // Client has first lunch and needs separate 1:1 lunch coverage
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 text-center">{client.lunchRatio}</div>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={clientSchedule.lunch1[0] || ''}
                                      onChange={(e) => updateAssignment(client.id, 'lunch1', e.target.value ? [parseInt(e.target.value)] : [])}
                                      className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                    >
                                      <option value="">-</option>
                                      {lunchStaff.filter(s => isStaffAvailable(s, 'lunch1')).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => toggleLock(client.id, 'lunch1')}
                                      className={`p-1 rounded ${lockedAssignments[`${client.id}-lunch1`] ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                      {lockedAssignments[`${client.id}-lunch1`] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>
                              ) : client.lunchGroupIds.length > 0 ? (
                                // Client is in a lunch group - show group assignment
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 text-center">{client.lunchRatio}</div>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={clientSchedule.lunch1[0] || ''}
                                      onChange={(e) => {
                                        const staffId = e.target.value ? parseInt(e.target.value) : null;
                                        // Assign to all clients in the lunch group
                                        const lunchGroup = getLunchGroupForClient(client.id);
                                        lunchGroup.forEach(clientId => {
                                          updateAssignment(clientId, 'lunch1', staffId ? [staffId] : []);
                                        });
                                      }}
                                      className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                    >
                                      <option value="">-</option>
                                      {lunchStaff.filter(s => isStaffAvailable(s, 'lunch1')).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => toggleLock(client.id, 'lunch1')}
                                      className={`p-1 rounded ${lockedAssignments[`${client.id}-lunch1`] ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                      {lockedAssignments[`${client.id}-lunch1`] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    </button>
                                  </div>
                                  <div className="text-xs text-gray-400 text-center truncate" title={getLunchDisplayText(client)}>
                                    w/ {client.lunchGroupIds.map(id => clients.find(c => c.id === id)?.name || `ID${id}`).join(', ')}
                                  </div>
                                </div>
                              ) : (
                                // Client has first lunch but AM staff stays with them
                                <div className="flex items-center justify-center h-8 bg-gray-100 rounded text-xs text-gray-500">
                                  AM Staff
                                </div>
                              )
                            ) : (
                              // Client has second lunch - no coverage needed in this slot
                              <div className="flex items-center justify-center h-8 bg-gray-50 rounded text-xs text-gray-400">
                                N/A
                              </div>
                            )}
                          </td>

                          {/* Lunch 2 (12:00-12:30) */}
                          <td className="px-1 py-1">
                            {client.lunch === 'second' ? (
                              client.requiresLunch1to1 ? (
                                // Client has second lunch and needs separate 1:1 lunch coverage
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 text-center">{client.lunchRatio}</div>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={clientSchedule.lunch2[0] || ''}
                                      onChange={(e) => updateAssignment(client.id, 'lunch2', e.target.value ? [parseInt(e.target.value)] : [])}
                                      className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                    >
                                      <option value="">-</option>
                                      {lunchStaff.filter(s => isStaffAvailable(s, 'lunch2')).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => toggleLock(client.id, 'lunch2')}
                                      className={`p-1 rounded ${lockedAssignments[`${client.id}-lunch2`] ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                      {lockedAssignments[`${client.id}-lunch2`] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>
                              ) : client.lunchGroupIds.length > 0 ? (
                                // Client is in a lunch group - show group assignment
                                <div className="space-y-1">
                                  <div className="text-xs text-gray-500 text-center">{client.lunchRatio}</div>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={clientSchedule.lunch2[0] || ''}
                                      onChange={(e) => {
                                        const staffId = e.target.value ? parseInt(e.target.value) : null;
                                        // Assign to all clients in the lunch group
                                        const lunchGroup = getLunchGroupForClient(client.id);
                                        lunchGroup.forEach(clientId => {
                                          updateAssignment(clientId, 'lunch2', staffId ? [staffId] : []);
                                        });
                                      }}
                                      className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                    >
                                      <option value="">-</option>
                                      {lunchStaff.filter(s => isStaffAvailable(s, 'lunch2')).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => toggleLock(client.id, 'lunch2')}
                                      className={`p-1 rounded ${lockedAssignments[`${client.id}-lunch2`] ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                      {lockedAssignments[`${client.id}-lunch2`] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    </button>
                                  </div>
                                  <div className="text-xs text-gray-400 text-center truncate" title={getLunchDisplayText(client)}>
                                    w/ {client.lunchGroupIds.map(id => clients.find(c => c.id === id)?.name || `ID${id}`).join(', ')}
                                  </div>
                                </div>
                              ) : (
                                // Client has second lunch but AM staff stays with them
                                <div className="flex items-center justify-center h-8 bg-gray-100 rounded text-xs text-gray-500">
                                  AM Staff
                                </div>
                              )
                            ) : (
                              // Client has first lunch - no coverage needed in this slot
                              <div className="flex items-center justify-center h-8 bg-gray-50 rounded text-xs text-gray-400">
                                N/A
                              </div>
                            )}
                          </td>

                          {/* PM Session */}
                          <td className="px-1 py-1">
                            <div className="flex items-start gap-1">
                              <span className="text-xs text-gray-500 w-6 mt-1">{client.pmRatio}</span>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-1">
                                  {clientSchedule.pm[0] && (
                                    <span className="text-xs text-gray-500">{getStaffPMStartTime(clientSchedule.pm[0])} -</span>
                                  )}
                                  <select
                                    value={clientSchedule.pm[0] || ''}
                                    onChange={(e) => {
                                      const newStaff = client.pmRatio === '2:1'
                                        ? [parseInt(e.target.value), clientSchedule.pm[1] || '']
                                        : [parseInt(e.target.value)];
                                      updateAssignment(client.id, 'pm', newStaff.filter(Boolean));
                                    }}
                                    className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                  >
                                    <option value="">-</option>
                                    {teamStaff.filter(s => isStaffAvailableForPMClient(s, client) && !clientSchedule.am.includes(s.id)).map(s => (
                                      <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
                                    ))}
                                  </select>
                                </div>
                                {client.pmRatio === '2:1' && (
                                  <div className="flex items-center gap-1">
                                    {clientSchedule.pm[1] && (
                                      <span className="text-xs text-gray-500">{getStaffPMStartTime(clientSchedule.pm[1])} -</span>
                                    )}
                                    <select
                                      value={clientSchedule.pm[1] || ''}
                                      onChange={(e) => {
                                        const newStaff = [clientSchedule.pm[0] || '', parseInt(e.target.value)];
                                        updateAssignment(client.id, 'pm', newStaff.filter(Boolean));
                                      }}
                                      className="flex-1 px-1 py-1 border rounded text-xs min-w-0"
                                    >
                                      <option value="">-</option>
                                      {teamStaff.filter(s => isStaffAvailableForPMClient(s, client) && !clientSchedule.am.includes(s.id)).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleLock(client.id, 'pm')}
                                className={`p-1 rounded ${lockedAssignments[`${client.id}-pm`] ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                              >
                                {lockedAssignments[`${client.id}-pm`] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          </>
        )}

        {/* Staff Management Tab */}
        {activeTab === 'staff-management' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Staff Management</h2>
              <button
                onClick={() => setShowAddStaff(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                Add Staff
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Position</th>
                    <th className="px-4 py-3 text-left">Program</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">{s.position}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.primaryProgram && <span className="mr-2 px-2 py-1 bg-green-100 rounded text-sm">Primary</span>}
                        {s.secondaryProgram && <span className="px-2 py-1 bg-purple-100 rounded text-sm">Secondary</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setEditingStaff(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteStaff(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Client Management Tab */}
        {activeTab === 'client-management' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Client Management</h2>
              <button
                onClick={() => setShowAddClient(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                Add Client
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Program</th>
                    <th className="px-4 py-3 text-left">Lunch</th>
                    <th className="px-4 py-3 text-left">Ratios (AM/Lunch/PM)</th>
                    <th className="px-4 py-3 text-left">Team Size</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients
                    .sort((a, b) => {
                      // First sort by program (Primary first)
                      if (a.program !== b.program) {
                        if (a.program === 'Primary') return -1;
                        if (b.program === 'Primary') return 1;
                        return a.program.localeCompare(b.program);
                      }
                      // Then sort alphabetically by name
                      return a.name.localeCompare(b.name);
                    })
                    .map(c => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-sm ${c.program?.includes('Primary') ? 'bg-blue-100' : 'bg-purple-100'}`}>
                          {c.program}
                        </span>
                      </td>
                      <td className="px-4 py-3">{c.lunch === 'first' ? 'First (11:30-12:00)' : 'Second (12:00-12:30)'}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="font-mono">1:{c.amRatio || 1} / 1:{c.lunchRatio || 1} / 1:{c.pmRatio || 1}</span>
                          {c.lunchGroupIds && c.lunchGroupIds.length > 0 && (
                            <div className="text-xs text-gray-600 mt-1">
                              Lunch group: {c.lunchGroupIds.join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{c.teamIds.length} staff</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setEditingClient(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteClient(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Staff Attendance Tab */}
        {activeTab === 'staff-attendance' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Staff Availability for {getDateKey(currentDate)}</h2>
            <div className="space-y-2">
              {staff.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-2 text-sm text-gray-600">({s.position})</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleStaffAvailability(s.id, 'all_day')}
                      className={`px-4 py-2 rounded text-sm ${s.availability === 'all_day' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                    >
                      All Day
                    </button>
                    <button
                      onClick={() => toggleStaffAvailability(s.id, 'am_only')}
                      className={`px-4 py-2 rounded text-sm ${s.availability === 'am_only' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                    >
                      AM Only
                    </button>
                    <button
                      onClick={() => toggleStaffAvailability(s.id, 'pm_only')}
                      className={`px-4 py-2 rounded text-sm ${s.availability === 'pm_only' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
                    >
                      PM Only
                    </button>
                    <button
                      onClick={() => toggleStaffAvailability(s.id, 'unavailable')}
                      className={`px-4 py-2 rounded text-sm ${s.availability === 'unavailable' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                    >
                      Unavailable
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add/Edit Staff Modal */}
        {(showAddStaff || editingStaff) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">{editingStaff ? 'Edit Staff' : 'Add New Staff'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    defaultValue={editingStaff?.name || ''}
                    id="staff-name"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Position</label>
                  <select defaultValue={editingStaff?.position || 'RBT'} id="staff-position" className="w-full px-3 py-2 border rounded-lg">
                    <option value="RBT">RBT</option>
                    <option value="BS">Behavior Specialist</option>
                    <option value="BCBA">BCBA</option>
                    <option value="EA">Educational Assistant</option>
                    <option value="CC">Clinical Coordinator</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Director">Director</option>
                    <option value="MHA">Mental Health Assistant</option>
                  </select>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked={editingStaff?.primaryProgram} id="staff-primary" className="mr-2" />
                    Primary Program
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked={editingStaff?.secondaryProgram} id="staff-secondary" className="mr-2" />
                    Secondary Program
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddStaff(false);
                      setEditingStaff(null);
                    }}
                    className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const staffData = {
                        name: document.getElementById('staff-name').value,
                        position: document.getElementById('staff-position').value,
                        primaryProgram: document.getElementById('staff-primary').checked,
                        secondaryProgram: document.getElementById('staff-secondary').checked,
                        available: true
                      };
                      if (editingStaff) {
                        updateStaff({ ...staffData, spId: editingStaff.spId });
                      } else {
                        addStaff(staffData);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingStaff ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Client Modal */}
        {(showAddClient || editingClient) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    defaultValue={editingClient?.name || ''}
                    id="client-name"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Program</label>
                  <select defaultValue={editingClient?.program || 'Primary/El'} id="client-program" className="w-full px-3 py-2 border rounded-lg">
                    <option value="Primary/El">Primary/El</option>
                    <option value="Secondary/El">Secondary/El</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Lunch Schedule</label>
                  {editingClient ? (
                    // Editing existing client - show read-only lunch schedule
                    <div>
                      <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700">
                        {editingClient?.lunch === 'first' ? 'First (11:30-12:00)' : 'Second (12:00-12:30)'}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Lunch schedule is managed in SharePoint and cannot be changed here.</p>
                    </div>
                  ) : (
                    // Adding new client - allow lunch schedule selection
                    <select id="client-lunch" className="w-full px-3 py-2 border rounded-lg">
                      <option value="first">First (11:30-12:00)</option>
                      <option value="second">Second (12:00-12:30)</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked={editingClient?.requiresLunch1to1} id="client-lunch1to1" className="mr-2" />
                    Requires 1:1 at Lunch
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">AM Ratio</label>
                    <select defaultValue={editingClient?.amRatio || 1} id="client-am-ratio" className="w-full px-3 py-2 border rounded-lg">
                      <option value={1}>1:1</option>
                      <option value={2}>1:2</option>
                      <option value={3}>1:3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Lunch Ratio</label>
                    <select defaultValue={editingClient?.lunchRatio || 1} id="client-lunch-ratio" className="w-full px-3 py-2 border rounded-lg">
                      <option value={1}>1:1</option>
                      <option value={2}>1:2</option>
                      <option value={3}>1:3</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">PM Ratio</label>
                    <select defaultValue={editingClient?.pmRatio || 1} id="client-pm-ratio" className="w-full px-3 py-2 border rounded-lg">
                      <option value={1}>1:1</option>
                      <option value={2}>1:2</option>
                      <option value={3}>1:3</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Team Staff (hold Ctrl/Cmd to select multiple)</label>
                  <select
                    multiple
                    defaultValue={editingClient?.teamIds || []}
                    id="client-team"
                    className="w-full px-3 py-2 border rounded-lg h-32"
                  >
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddClient(false);
                      setEditingClient(null);
                    }}
                    className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const selectedOptions = Array.from(document.getElementById('client-team').selectedOptions);
                      const clientData = {
                        name: document.getElementById('client-name').value,
                        program: document.getElementById('client-program').value,
                        // Include lunch field only for new clients (when lunch dropdown exists)
                        ...(editingClient ? {} : { lunch: document.getElementById('client-lunch').value }),
                        requiresLunch1to1: document.getElementById('client-lunch1to1').checked,
                        ratio: document.getElementById('client-lunch1to1').checked ? '1:1' : '1:2',
                        amRatio: parseInt(document.getElementById('client-am-ratio').value),
                        lunchRatio: parseInt(document.getElementById('client-lunch-ratio').value),
                        pmRatio: parseInt(document.getElementById('client-pm-ratio').value),
                        teamIds: selectedOptions.map(opt => parseInt(opt.value))
                      };
                      if (editingClient) {
                        updateClient({ ...clientData, spId: editingClient.spId });
                      } else {
                        addClient(clientData);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingClient ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ABAScheduler;