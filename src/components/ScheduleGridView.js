import React, { useState, useEffect } from 'react';
import { ExternalLink, Filter, Lock, Unlock, User, Maximize2, Minimize2 } from 'lucide-react';

/**
 * Schedule Grid View Component
 * Combines the visual layout of LiveScheduleView with interactive staff assignment dropdowns
 * Shows all clients in a grid with dropdown pickers for AM/PM staff and trainee assignments
 */
const ScheduleGridView = ({ 
  schedule, 
  students, 
  staff, 
  selectedDate,
  onAssignmentLock,
  onAssignmentUnlock,
  onAssignmentRemove,
  onManualAssignment
}) => {
  const [editableData, setEditableData] = useState({});
  const [expandedProgram, setExpandedProgram] = useState('Primary'); // 'Primary', 'Secondary', or null for both
  const [fullScreenMode, setFullScreenMode] = useState(false); // Toggle for full screen view

  // Generate a unique localStorage key based on the selected date
  const getStorageKey = (date) => {
    const dateStr = date ? new Date(date).toISOString().split('T')[0] : 'default';
    return `evoke-schedule-lunch-${dateStr}`;
  };

  // Load lunch data from localStorage when component mounts or date changes
  useEffect(() => {
    const storageKey = getStorageKey(selectedDate);
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setEditableData(parsed);
      } catch (e) {
        console.error('Failed to parse saved lunch data:', e);
      }
    } else {
      // Reset editable data when switching to a new date with no saved data
      setEditableData({});
    }
  }, [selectedDate]);

  // Save lunch data to localStorage whenever it changes
  useEffect(() => {
    const storageKey = getStorageKey(selectedDate);
    if (Object.keys(editableData).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(editableData));
    }
  }, [editableData, selectedDate]);

  // Helper function to format name as "First Last Initial"
  const formatNameShort = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return fullName;
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}.`;
  };

  // Separate students by program
  const primaryStudents = students
    .filter(s => s.isActive && s.program === 'Primary')
    .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  
  const secondaryStudents = students
    .filter(s => s.isActive && s.program === 'Secondary')
    .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

  // Calculate staff usage and determine highlighting colors
  const getStaffHighlighting = () => {
    const staffUsage = {}; // { staffId: { count, sessions: [{studentId, session, student}], sameKidAMPM: bool, twiceInSameSession: bool } }
    const outOfSessionStaff = {}; // { staffId: ['AM', 'PM'] } - tracks which sessions staff are marked as "out"
    
    // Track out-of-session assignments
    if (schedule.outOfSessionAssignments && schedule.outOfSessionAssignments.length > 0) {
      schedule.outOfSessionAssignments.forEach(outAssignment => {
        if (!outOfSessionStaff[outAssignment.staffId]) {
          outOfSessionStaff[outAssignment.staffId] = [];
        }
        outOfSessionStaff[outAssignment.staffId].push(outAssignment.session);
      });
    }
    
    // Analyze all regular assignments
    schedule.assignments.forEach(assignment => {
      const { staffId, studentId, session, isTrainee } = assignment;
      
      if (!staffUsage[staffId]) {
        staffUsage[staffId] = {
          count: 0,
          sessions: [],
          isTrainee: false
        };
      }
      
      staffUsage[staffId].count++;
      const student = students.find(s => s.id === studentId);
      staffUsage[staffId].sessions.push({ studentId, session, student, isTrainee });
      
      // Track if ANY assignment for this staff is a trainee
      if (isTrainee) {
        staffUsage[staffId].isTrainee = true;
      }
    });
    
    // Also analyze trainee assignments
    if (schedule.traineeAssignments && schedule.traineeAssignments.length > 0) {
      schedule.traineeAssignments.forEach(assignment => {
        const { staffId, studentId, session } = assignment;
        
        if (!staffUsage[staffId]) {
          staffUsage[staffId] = {
            count: 0,
            sessions: [],
            isTrainee: true
          };
        }
        
        staffUsage[staffId].count++;
        const student = students.find(s => s.id === studentId);
        staffUsage[staffId].sessions.push({ studentId, session, student, isTrainee: true });
        staffUsage[staffId].isTrainee = true;
      });
    }
    
    // Now determine highlighting for each staff member
    const highlighting = {}; // { staffId: 'yellow' | 'green' | 'red' }
    
    Object.keys(staffUsage).forEach(staffId => {
      const usage = staffUsage[staffId];
      const { count, sessions } = usage;
      
      // Get staff name for debugging
      const staffMember = staff.find(s => s.id == staffId);
      const staffName = staffMember?.name || 'Unknown';
      
      // Check for red flag conditions
      let shouldBeRed = false;
      let hasAllowedPairedUsage = false; // Track if staff is with paired students (allowed scenario)
      
      // NOTE: Trainees can work with same student all day, but CANNOT be double-booked in same session
      // So we still need to check Red Flag 2 (same session) even for trainees
      
      // Red flag 1: Same kid AM and PM (UNLESS the kids are a paired 1:2 group)
      // Trainees get EXCEPTION - they're allowed to work with same student all day
      if (!usage.isTrainee) {
        const studentSessionMap = {}; // { studentId: [sessions] }
        sessions.forEach(({ studentId, session }) => {
          if (!studentSessionMap[studentId]) {
            studentSessionMap[studentId] = [];
          }
          studentSessionMap[studentId].push(session);
        });
        
        // Check if any student has this staff in both AM and PM
        for (const studentId of Object.keys(studentSessionMap)) {
          const studentSessions = studentSessionMap[studentId];
          if (studentSessions.includes('AM') && studentSessions.includes('PM')) {
            const student = students.find(s => s.id == studentId);
            
            // Check if this student is part of a paired 1:2 group
            // If the student is paired AND staff is working with their paired partner in the same sessions,
            // then this is ALLOWED (not a red flag)
            let isAllowedPairedCase = false;
            if (student && student.isPaired && student.isPaired()) {
              // Find the paired partner
              const pairedPartnerId = student.pairedWith;
              const partnerSessions = studentSessionMap[pairedPartnerId];
              
              // Check if staff is also with the paired partner in both AM and PM
              if (partnerSessions && partnerSessions.includes('AM') && partnerSessions.includes('PM')) {
                // Staff is with BOTH paired students in both sessions - this is ALLOWED for 1:2 pairs
                const partner = students.find(s => s.id == pairedPartnerId);
                console.log(`✅ ${staffName}: With paired students ${student?.name} and ${partner?.name} in both AM and PM - ALLOWED`);
                isAllowedPairedCase = true;
                hasAllowedPairedUsage = true;
              }
            }
            
            if (!isAllowedPairedCase) {
              console.log(`🔴 ${staffName}: Same kid AM and PM detected - ${student?.name}`);
              shouldBeRed = true;
            }
          }
        }
      }
      
      // Red flag 2: Used twice in the same session (APPLIES TO EVERYONE including trainees)
      // Trainees CANNOT be double-booked in the same session
      const sessionCounts = {}; // { 'AM': count, 'PM': count }
      const sessionStudents = {}; // { 'AM': [students], 'PM': [students] }
      sessions.forEach(({ session, student }) => {
        sessionCounts[session] = (sessionCounts[session] || 0) + 1;
        if (!sessionStudents[session]) {
          sessionStudents[session] = [];
        }
        sessionStudents[session].push(student);
      });
      
      // Check each session
      for (const session of ['AM', 'PM']) {
        if (sessionCounts[session] >= 2) {
          const studentsInSession = sessionStudents[session];
          
          console.log(`📊 ${staffName} ${session}: ${sessionCounts[session]} assignments with students:`, 
            studentsInSession.map(s => `${s?.name} (paired: ${s?.isPaired ? s.isPaired() : false})`).join(', '));
          
          // Check if exactly 2 students and they are a PAIRED group (1:2 ratio pairing)
          let isAllowedPairedCase = false;
          if (studentsInSession.length === 2) {
            const [student1, student2] = studentsInSession;
            
            // Check if these two students are paired with each other
            const arePaired = student1 && student2 &&
              student1.isPaired && student1.isPaired() &&
              student2.isPaired && student2.isPaired() &&
              student1.pairedWith === student2.id &&
              student2.pairedWith === student1.id;
            
            if (arePaired) {
              console.log(`  ✅ ${staffName}: With paired students ${student1.name} and ${student2.name} in ${session} - ALLOWED`);
              isAllowedPairedCase = true;
              hasAllowedPairedUsage = true;
            }
          }
          
          if (!isAllowedPairedCase) {
            // If we get here, either more than 2 students, or 2 students who aren't paired
            console.log(`  🔴 ${staffName}: Used ${sessionCounts[session]} times in ${session} - NOT with a paired group`);
            shouldBeRed = true;
          }
        }
      }
      
      // Determine color
      if (shouldBeRed) {
        highlighting[staffId] = 'red';
      } else {
        // Check if this staff has an out-of-session assignment in one session and is working in the other
        const outSessions = outOfSessionStaff[staffId] || [];
        const workingSessions = sessions.map(s => s.session);
        const hasOutOneSession = outSessions.length > 0;
        const isWorkingOtherSession = workingSessions.some(ws => !outSessions.includes(ws));
        
        if (hasOutOneSession && isWorkingOtherSession) {
          // Staff is "out" for one session but working the other - blue highlight
          highlighting[staffId] = 'blue';
        } else if (count === 1) {
          highlighting[staffId] = 'yellow';
        } else if (count === 2) {
          highlighting[staffId] = 'green';
        } else if (count > 2 && hasAllowedPairedUsage) {
          // More than 2 uses but with paired students - still green (valid scenario)
          highlighting[staffId] = 'green';
        }
        // If count > 2 without paired usage, don't add highlighting (will default to no color)
      }
    });
    
    return highlighting;
  };
  
  const staffHighlighting = getStaffHighlighting();

  // Get student's team members
  const getStudentTeam = (student) => {
    let team = [];
    
    // Use ONLY People Picker data - no dependency on Staff list names
    if (student.team && student.team.length > 0) {
      team = student.team.map(teamMember => {
        // Use the full name from People Picker data
        const fullName = teamMember.title || teamMember.DisplayName || teamMember.LookupValue;
        
        if (!fullName) return null;
        
        // Find staff member by email to get role info (more reliable than name matching)
        let staffMember = null;
        let staffEmail = teamMember.email;
        
        if (teamMember.email) {
          staffMember = staff.find(s => s.email && s.email.toLowerCase() === teamMember.email.toLowerCase());
        }
        
        // If email match failed, try ID match as backup
        if (!staffMember && teamMember.id) {
          staffMember = staff.find(s => s.id === teamMember.id);
        }
        
        // FILTER OUT: If staff member not found in active staff list, they've been deleted
        if (!staffMember) {
          console.log(`⚠️ Skipping deleted staff member: ${fullName} (not in active staff list)`);
          return null;
        }
        
        // Return team member using ONLY People Picker data
        return {
          id: teamMember.id,
          name: fullName, // Use ONLY the full name from People Picker
          role: staffMember.role, // Role from staff list match
          email: staffEmail
        };
      }).filter(Boolean);
    }
    
    return team;
  };

  // Get available staff for dropdown (team members filtered for availability)
  const getAvailableStaff = (student, session) => {
    const team = getStudentTeam(student);
    const currentAssignments = getAssignments(student, session);
    
    // FILTER TEAM TO ONLY AVAILABLE MEMBERS
    const availableTeamMembers = team.filter(teamMember => {
      // Always include currently assigned staff
      const isCurrentlyAssigned = currentAssignments.some(assignment => 
        assignment.staffId === teamMember.id || assignment.staffId == teamMember.id
      );
      if (isCurrentlyAssigned) {
        return true;
      }
      
      // EXCLUDE staff who are in training for THIS student (overlap-staff or overlap-bcba)
      // They should only appear in the trainee dropdown, not the regular staff dropdown
      const trainingStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(teamMember.id) : 'solo';
      const isInTraining = trainingStatus === 'overlap-staff' || trainingStatus === 'overlap-bcba';
      
      if (isInTraining) {
        console.log(`🚫 Excluding ${teamMember.name} from regular staff dropdown - in training (${trainingStatus})`);
        return false; // Don't show in regular dropdown if they're in training
      }
      
      // Check if staff is available for this session
      const staffMember = staff.find(s => s.id === teamMember.id || s.id == teamMember.id);
      
      if (!staffMember) return false;
      
      // EXCLUDE staff who are absent for this session
      if (!staffMember.isAvailableForSession(session)) {
        console.log(`🚫 Excluding ${teamMember.name} from dropdown - absent for ${session}`);
        return false;
      }
      
      return schedule.isStaffAvailable(staffMember.id, session, student.program);
    });
    
    return availableTeamMembers;
  };
  
  // Get background color for staff highlighting
  const getStaffBgColor = (staffId) => {
    const color = staffHighlighting[staffId];
    if (color === 'red') return 'bg-red-200';
    if (color === 'yellow') return 'bg-yellow-200';
    if (color === 'blue') return 'bg-blue-200';
    if (color === 'green') return 'bg-green-200';
    return '';
  };

  // Render staff dropdown (team members only)
  const renderStaffDropdown = (student, session, value, onChange, placeholder = "-- Select --") => {
    const availableTeamMembers = getAvailableStaff(student, session);
    const highlightColor = value ? staffHighlighting[value] : null;
    
    let selectClassName = "border border-gray-300 rounded px-1.5 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500";
    if (highlightColor === 'red') {
      selectClassName += " bg-red-200";
    } else if (highlightColor === 'yellow') {
      selectClassName += " bg-yellow-200";
    } else if (highlightColor === 'blue') {
      selectClassName += " bg-blue-200";
    } else if (highlightColor === 'green') {
      selectClassName += " bg-green-200";
    }
    
    return (
      <select
        value={value || ''}
        onChange={onChange}
        className={selectClassName}
      >
        <option value="">{placeholder}</option>
        {availableTeamMembers.map(s => {
          const trainingStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(s.id) : 'solo';
          const isTrainer = trainingStatus === 'trainer';
          return (
            <option key={s.id} value={s.id}>
              {isTrainer ? '⭐ ' : ''}{formatNameShort(s.name)}
            </option>
          );
        })}
      </select>
    );
  };

  // Render trainee dropdown (ONLY staff who are in training for this student)
  const renderTraineeDropdown = (student, session, value, onChange, placeholder = "-- None --") => {
    const team = getStudentTeam(student);
    const currentAssignments = getAssignments(student, session);
    
    // Filter team to ONLY show staff who are in training (overlap-staff or overlap-bcba status)
    const traineesInTraining = team.filter(teamMember => {
      const trainingStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(teamMember.id) : 'solo';
      const isInTraining = trainingStatus === 'overlap-staff' || trainingStatus === 'overlap-bcba';
      
      return isInTraining;
    }).filter(teamMember => {
      // Always show if currently selected
      if (value && teamMember.id == value) {
        return true;
      }
      // Check if staff is available for this session
      const staffMember = staff.find(s => s.id === teamMember.id || s.id == teamMember.id);
      if (!staffMember) return false;
      
      // EXCLUDE staff who are absent or out of session for this session
      if (!staffMember.isAvailableForSession(session)) {
        return false;
      }
      
      // For trainees, we DON'T need to check schedule.isStaffAvailable
      // since trainees can potentially be assigned to multiple students for training purposes
      // The validation will happen when trying to save the assignment
      return true;
    });
    
    const highlightColor = value ? staffHighlighting[value] : null;
    
    let selectClassName = "border border-gray-300 rounded px-1.5 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500";
    if (highlightColor === 'red') {
      selectClassName += " bg-red-200";
    } else if (highlightColor === 'yellow') {
      selectClassName += " bg-yellow-200";
    } else if (highlightColor === 'blue') {
      selectClassName += " bg-blue-200";
    } else if (highlightColor === 'green') {
      selectClassName += " bg-green-200";
    }
    
    return (
      <select
        value={value || ''}
        onChange={onChange}
        className={selectClassName}
      >
        <option value="">{placeholder}</option>
        {traineesInTraining.map(s => (
          <option key={s.id} value={s.id}>{formatNameShort(s.name)}</option>
        ))}
      </select>
    );
  };

  // Get current assignments for student/session
  const getAssignments = (student, session) => {
    return schedule.assignments.filter(
      a => String(a.studentId) === String(student.id) && a.session === session
    );
  };

  // Get only regular staff assignments (not trainees)
  const getStaffAssignments = (student, session) => {
    return schedule.assignments.filter(
      a => String(a.studentId) === String(student.id) && a.session === session && !a.isTrainee
    );
  };
  
  // Get only trainee assignment
  const getTraineeAssignments = (student, session) => {
    // Look in schedule.traineeAssignments (where trainees are actually stored)
    const trainees = schedule.traineeAssignments.filter(
      a => String(a.studentId) === String(student.id) && a.session === session
    );
    
    // Debug logging for first few students only
    if (student.name === 'Alejandro' || student.name === 'Allie') {
      console.log(`🔍 getTraineeAssignments for ${student.name} ${session}:`, {
        studentId: student.id,
        studentIdType: typeof student.id,
        found: trainees.length,
        trainees: trainees.map(t => ({ staffId: t.staffId, staffName: t.staffName, isTrainee: t.isTrainee })),
        totalTraineeAssignments: schedule.traineeAssignments.length,
        allForStudent: schedule.traineeAssignments.filter(a => String(a.studentId) === String(student.id) && a.session === session).map(a => ({
          staffId: a.staffId, 
          staffName: a.staffName, 
          isTrainee: a.isTrainee,
          studentIdInAssignment: a.studentId,
          studentIdType: typeof a.studentId
        }))
      });
    }
    
    return trainees;
  };

  // Get trainee assignment for student/session
  const getTraineeAssignment = (student, session) => {
    if (!schedule.traineeAssignments) return null;
    return schedule.traineeAssignments.find(
      ta => ta.studentId === student.id && ta.session === session
    );
  };

  // Handle main staff selection
  const handleStaffSelect = (student, session, staffId, staffIndex = 0) => {
    if (!staffId) {
      // Remove staff assignment at this index (not trainees)
      const staffAssignments = getStaffAssignments(student, session);
      if (staffAssignments.length > staffIndex) {
        onAssignmentRemove(staffAssignments[staffIndex].id);
      }
      return;
    }

    const parsedStaffId = parseInt(staffId);
    
    // Remove existing staff assignment at this index first (not trainees)
    const existingStaffAssignments = getStaffAssignments(student, session);
    if (existingStaffAssignments.length > staffIndex) {
      onAssignmentRemove(existingStaffAssignments[staffIndex].id);
    }

    // Create new staff assignment (not a trainee)
    onManualAssignment({
      staffId: parsedStaffId,
      studentId: student.id,
      session: session,
      program: student.program,
      isTrainee: false,
      bypassTeamCheck: true  // Allow temp team members
    });
  };
  
  // Handle trainee selection (additional staff for training)
  const handleTraineeSelect = (student, session, staffId) => {
    console.log('🎓 handleTraineeSelect called:', { studentName: student.name, session, staffId });
    
    if (!staffId) {
      // Remove trainee assignment
      const traineeAssignments = getTraineeAssignments(student, session);
      console.log('  Removing trainee, found:', traineeAssignments.length);
      if (traineeAssignments.length > 0) {
        onAssignmentRemove(traineeAssignments[0].id);
      }
      return;
    }

    const parsedStaffId = parseInt(staffId);
    
    // Remove existing trainee assignment first
    const existingTrainees = getTraineeAssignments(student, session);
    console.log('  Existing trainees:', existingTrainees.length);
    if (existingTrainees.length > 0) {
      onAssignmentRemove(existingTrainees[0].id);
    }

    console.log('  Creating trainee assignment with isTrainee: true');
    // Create new trainee assignment with isTrainee flag
    onManualAssignment({
      staffId: parsedStaffId,
      studentId: student.id,
      session: session,
      program: student.program,
      isTrainee: true,
      bypassTeamCheck: true
    });
  };

  // Toggle lock on assignment
  const toggleLock = (student, session) => {
    // Get only staff assignments (not trainees) since the lock icon is next to staff dropdown
    const staffAssignments = getStaffAssignments(student, session);
    
    if (staffAssignments.length === 0) return;
    
    const currentAssignment = staffAssignments[0];
    
    if (currentAssignment.isLocked) {
      // If locked, unlock it
      onAssignmentUnlock(currentAssignment.id);
    } else {
      // If unlocked, lock it
      onAssignmentLock(currentAssignment.id);
    }
  };

  // Handle editable field changes (lunch, times)
  const handleFieldChange = (studentId, field, value) => {
    setEditableData(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [field]: value
      }
    }));
  };

  // Get default times based on program (uses custom times if set on student)
  const getDefaultTimes = (student) => {
    // Use student's getScheduleTimes() method which returns custom times if set,
    // or falls back to program defaults
    return student.getScheduleTimes();
  };

  // Helper function to convert time string to minutes since midnight
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  };

  // Determine if lunch coverage is needed
  // L1: 11:30 AM - 12:00 PM (690-720 minutes)
  // L2: 12:05 PM - 12:35 PM (725-755 minutes)
  const isLunchCoverageNeeded = (amEnd, pmStart, lunchBlock) => {
    const amEndMinutes = timeToMinutes(amEnd);
    const pmStartMinutes = timeToMinutes(pmStart);
    
    if (amEndMinutes === null || pmStartMinutes === null) return true; // Default to enabled if times are invalid
    
    const L1_START = 11 * 60 + 30; // 11:30 AM = 690 minutes
    const L1_END = 12 * 60; // 12:00 PM = 720 minutes
    const L2_START = 12 * 60 + 5; // 12:05 PM = 725 minutes
    const L2_END = 12 * 60 + 35; // 12:35 PM = 755 minutes
    
    if (lunchBlock === 'L1') {
      // L1 is needed if there's a gap that overlaps with 11:30-12:00
      // Gap must exist during L1 time (amEnd < 12:00 PM AND pmStart > 11:30 AM)
      return amEndMinutes < L1_END && pmStartMinutes > L1_START;
    } else if (lunchBlock === 'L2') {
      // L2 is needed if there's a gap that overlaps with 12:05-12:35
      // Gap must exist during L2 time (amEnd < 12:35 PM AND pmStart > 12:05 PM)
      return amEndMinutes < L2_END && pmStartMinutes > L2_START;
    }
    
    return true;
  };

  // Open in new window
  const openInNewWindow = () => {
    const newWindow = window.open('', 'ScheduleGrid', 'width=1400,height=900,scrollbars=yes');
    if (newWindow) {
      const htmlContent = generatePopupHTML();
      newWindow.document.write(htmlContent);
    }
  };

  // Generate static HTML for popup
  const generatePopupHTML = () => {
    // Build absent/out summary for both programs
    const absentClients = [];
    const outClients = [];
    
    [...primaryStudents, ...secondaryStudents].forEach(student => {
      const isAbsentAM = !student.isAvailableForSession('AM', selectedDate);
      const isAbsentPM = !student.isAvailableForSession('PM', selectedDate);
      const isFullyAbsent = isAbsentAM && isAbsentPM;
      
      if (isFullyAbsent) {
        const isOut = student.outOfSessionFullDay || (student.outOfSessionAM && student.outOfSessionPM);
        if (isOut) {
          outClients.push(student.name);
        } else {
          absentClients.push(student.name);
        }
      }
    });
    
    // Build staff out-of-session summary
    const outStaffAM = [];
    const outStaffPM = [];
    const outStaffFullDay = [];
    
    // Check each staff member's out-of-session flags
    staff.forEach(staffMember => {
      if (!staffMember.isActive) return; // Skip inactive staff
      
      const staffName = formatNameShort(staffMember.name);
      
      if (staffMember.outOfSessionFullDay) {
        outStaffFullDay.push(staffName);
      } else if (staffMember.outOfSessionAM && staffMember.outOfSessionPM) {
        outStaffFullDay.push(staffName);
      } else if (staffMember.outOfSessionAM) {
        outStaffAM.push(staffName);
      } else if (staffMember.outOfSessionPM) {
        outStaffPM.push(staffName);
      }
    });
    
    let summaryHTML = '';
    if (absentClients.length > 0 || outClients.length > 0 || outStaffAM.length > 0 || outStaffPM.length > 0 || outStaffFullDay.length > 0) {
      summaryHTML = '<div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; padding: 8px 12px; margin-bottom: 16px; font-size: 12px;">';
      if (absentClients.length > 0) {
        summaryHTML += `<div style="margin-bottom: 4px;"><strong style="color: #991b1b;">Absent Clients:</strong> ${absentClients.join(', ')}</div>`;
      }
      if (outClients.length > 0) {
        summaryHTML += `<div style="margin-bottom: 4px;"><strong style="color: #92400e;">Out of Session Clients:</strong> ${outClients.join(', ')}</div>`;
      }
      if (outStaffFullDay.length > 0) {
        summaryHTML += `<div style="margin-bottom: 4px;"><strong style="color: #1e40af;">Out Full Day Staff:</strong> ${outStaffFullDay.join(', ')}</div>`;
      }
      if (outStaffAM.length > 0) {
        summaryHTML += `<div style="margin-bottom: 4px;"><strong style="color: #1e40af;">Out AM Staff:</strong> ${outStaffAM.join(', ')}</div>`;
      }
      if (outStaffPM.length > 0) {
        summaryHTML += `<div><strong style="color: #1e40af;">Out PM Staff:</strong> ${outStaffPM.join(', ')}</div>`;
      }
      summaryHTML += '</div>';
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Schedule - ${selectedDate.toLocaleDateString()}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #f5f5f5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          h1 {
            color: #2563eb;
            margin: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            font-size: 13px;
          }
          th {
            background: #2563eb;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
            font-size: 11px;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          tr:hover {
            background: #f9fafb;
          }
          tr.row-absent {
            background: #fee2e2;
          }
          tr.row-out {
            background: #fef3c7;
          }
          .absent {
            background: #fee2e2;
            color: #991b1b;
            font-weight: bold;
            text-align: center;
          }
          .out {
            background: #fef3c7;
            color: #92400e;
            font-weight: bold;
            text-align: center;
          }
          @media print {
            .header { display: none; }
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Schedule - ${selectedDate.toLocaleDateString()}</h1>
        </div>
        ${summaryHTML}
        <h2 style="margin-bottom: 10px; color: #2563eb;">Primary</h2>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>AM Staff</th>
              <th>AM Trainee</th>
              <th>Start</th>
              <th>End</th>
              <th>L1</th>
              <th>L2</th>
              <th>PM Staff</th>
              <th>PM Trainee</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            ${primaryStudents.map(student => {
              const amAssignments = getAssignments(student, 'AM');
              const pmAssignments = getAssignments(student, 'PM');
              
              const isAbsentAM = !student.isAvailableForSession('AM', selectedDate);
              const isAbsentPM = !student.isAvailableForSession('PM', selectedDate);
              
              const defaults = getDefaultTimes(student);
              const data = editableData[student.id] || {};
              
              // For 2:1, show both staff in one cell
              let amStaffDisplay = '';
              if (isAbsentAM) {
                amStaffDisplay = student.outOfSessionAM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT';
              } else {
                const staff1 = amAssignments[0] ? formatNameShort(staff.find(s => s.id === amAssignments[0].staffId)?.name || '') : '';
                const staff2 = student.ratioAM === '2:1' && amAssignments[1] ? formatNameShort(staff.find(s => s.id === amAssignments[1].staffId)?.name || '') : '';
                amStaffDisplay = staff1 + (staff2 ? '<br/>' + staff2 : '');
              }
              
              let pmStaffDisplay = '';
              if (isAbsentPM) {
                pmStaffDisplay = student.outOfSessionPM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT';
              } else {
                const staff1 = pmAssignments[0] ? formatNameShort(staff.find(s => s.id === pmAssignments[0].staffId)?.name || '') : '';
                const staff2 = student.ratioPM === '2:1' && pmAssignments[1] ? formatNameShort(staff.find(s => s.id === pmAssignments[1].staffId)?.name || '') : '';
                pmStaffDisplay = staff1 + (staff2 ? '<br/>' + staff2 : '');
              }
              
              const amTraineeIndex = student.ratioAM === '2:1' ? 2 : 1;
              const pmTraineeIndex = student.ratioPM === '2:1' ? 2 : 1;
              const amTraineeName = amAssignments[amTraineeIndex] ? formatNameShort(staff.find(s => s.id === amAssignments[amTraineeIndex].staffId)?.name || '') : '';
              const pmTraineeName = pmAssignments[pmTraineeIndex] ? formatNameShort(staff.find(s => s.id === pmAssignments[pmTraineeIndex].staffId)?.name || '') : '';
              
              // Check if lunch coverage is needed
              const amEnd = data.amEnd || defaults.amEnd;
              const pmStart = data.pmStart || defaults.pmStart;
              const isL1Needed = isLunchCoverageNeeded(amEnd, pmStart, 'L1');
              const isL2Needed = isLunchCoverageNeeded(amEnd, pmStart, 'L2');
              
              // Check if fully absent
              const isFullyAbsent = isAbsentAM && isAbsentPM;
              const isOutOfSession = student.outOfSessionFullDay || (student.outOfSessionAM && student.outOfSessionPM);
              const rowClass = isFullyAbsent ? (isOutOfSession ? 'row-out' : 'row-absent') : '';
              
              return `
                <tr class="${rowClass}">
                  <td><strong>${student.name}${(student.ratioAM === '2:1' || student.ratioPM === '2:1') ? ' <span style="color: #ea580c;">(2:1)</span>' : ''}</strong></td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>
                    ${amStaffDisplay}
                  </td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${amTraineeName}</td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.amStart || defaults.amStart}</td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.amEnd || defaults.amEnd}</td>
                  <td style="${!isL1Needed ? 'background-color: #f3f4f6; color: #9ca3af;' : ''}">${data.lunch1Cov || ''}</td>
                  <td style="${!isL2Needed ? 'background-color: #f3f4f6; color: #9ca3af;' : ''}">${data.lunch2Cov || ''}</td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>
                    ${pmStaffDisplay}
                  </td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${pmTraineeName}</td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.pmStart || defaults.pmStart}</td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.pmEnd || defaults.pmEnd}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <h2 style="margin-top: 30px; color: #7c3aed;">Secondary</h2>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>AM Staff</th>
              <th>AM Trainee</th>
              <th>Start</th>
              <th>End</th>
              <th>L1</th>
              <th>L2</th>
              <th>PM Staff</th>
              <th>PM Trainee</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            ${secondaryStudents.map(student => {
              const amAssignments = getAssignments(student, 'AM');
              const pmAssignments = getAssignments(student, 'PM');
              
              const isAbsentAM = !student.isAvailableForSession('AM', selectedDate);
              const isAbsentPM = !student.isAvailableForSession('PM', selectedDate);
              
              const defaults = getDefaultTimes(student);
              const data = editableData[student.id] || {};
              
              // For 2:1, show both staff in one cell
              let amStaffDisplay = '';
              if (isAbsentAM) {
                amStaffDisplay = student.outOfSessionAM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT';
              } else {
                const staff1 = amAssignments[0] ? formatNameShort(staff.find(s => s.id === amAssignments[0].staffId)?.name || '') : '';
                const staff2 = student.ratioAM === '2:1' && amAssignments[1] ? formatNameShort(staff.find(s => s.id === amAssignments[1].staffId)?.name || '') : '';
                amStaffDisplay = staff1 + (staff2 ? '<br/>' + staff2 : '');
              }
              
              let pmStaffDisplay = '';
              if (isAbsentPM) {
                pmStaffDisplay = student.outOfSessionPM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT';
              } else {
                const staff1 = pmAssignments[0] ? formatNameShort(staff.find(s => s.id === pmAssignments[0].staffId)?.name || '') : '';
                const staff2 = student.ratioPM === '2:1' && pmAssignments[1] ? formatNameShort(staff.find(s => s.id === pmAssignments[1].staffId)?.name || '') : '';
                pmStaffDisplay = staff1 + (staff2 ? '<br/>' + staff2 : '');
              }
              
              const amTraineeIndex = student.ratioAM === '2:1' ? 2 : 1;
              const pmTraineeIndex = student.ratioPM === '2:1' ? 2 : 1;
              const amTraineeName = amAssignments[amTraineeIndex] ? formatNameShort(staff.find(s => s.id === amAssignments[amTraineeIndex].staffId)?.name || '') : '';
              const pmTraineeName = pmAssignments[pmTraineeIndex] ? formatNameShort(staff.find(s => s.id === pmAssignments[pmTraineeIndex].staffId)?.name || '') : '';
              
              // Check if lunch coverage is needed
              const amEnd = data.amEnd || defaults.amEnd;
              const pmStart = data.pmStart || defaults.pmStart;
              const isL1Needed = isLunchCoverageNeeded(amEnd, pmStart, 'L1');
              const isL2Needed = isLunchCoverageNeeded(amEnd, pmStart, 'L2');
              
              // Check if fully absent
              const isFullyAbsent = isAbsentAM && isAbsentPM;
              const isOutOfSession = student.outOfSessionFullDay || (student.outOfSessionAM && student.outOfSessionPM);
              const rowClass = isFullyAbsent ? (isOutOfSession ? 'row-out' : 'row-absent') : '';
              
              return `
                <tr class="${rowClass}">
                  <td><strong>${student.name}${(student.ratioAM === '2:1' || student.ratioPM === '2:1') ? ' <span style="color: #ea580c;">(2:1)</span>' : ''}</strong></td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>
                    ${amStaffDisplay}
                  </td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${amTraineeName}</td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.amStart || defaults.amStart}</td>
                  <td ${isAbsentAM ? 'class="' + (student.outOfSessionAM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.amEnd || defaults.amEnd}</td>
                  <td style="${!isL1Needed ? 'background-color: #f3f4f6; color: #9ca3af;' : ''}">${data.lunch1Cov || ''}</td>
                  <td style="${!isL2Needed ? 'background-color: #f3f4f6; color: #9ca3af;' : ''}">${data.lunch2Cov || ''}</td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>
                    ${pmStaffDisplay}
                  </td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${pmTraineeName}</td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.pmStart || defaults.pmStart}</td>
                  <td ${isAbsentPM ? 'class="' + (student.outOfSessionPM || student.outOfSessionFullDay ? 'out' : 'absent') + '"' : ''}>${data.pmEnd || defaults.pmEnd}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  // Render a table for a specific program
  const renderProgramTable = (programStudents, programName, headerColor) => {
    const isExpanded = expandedProgram === programName;
    const isCollapsed = expandedProgram !== null && expandedProgram !== programName;
    
    if (isCollapsed) {
      return (
        <div className="bg-white rounded-lg shadow p-3">
          <button
            onClick={() => setExpandedProgram(programName)}
            className={`text-sm font-semibold ${headerColor === 'bg-blue-600' ? 'text-blue-600' : 'text-purple-600'} hover:underline`}
          >
            + Expand {programName}
          </button>
        </div>
      );
    }
    
    const handleLockEntireProgram = () => {
      // Get all assignments for this program (both AM and PM)
      const programAssignments = schedule.assignments.filter(a => a.program === programName);
      
      // Lock all assignments
      programAssignments.forEach(assignment => {
        if (!assignment.isLocked) {
          onAssignmentLock(assignment.id);
        }
      });
    };
    
    return (
      <div className="bg-white rounded-lg shadow">
        <div className={`${headerColor} px-4 py-2 flex justify-between items-center`}>
          <h3 className="text-sm font-semibold text-white">{programName}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLockEntireProgram}
              className="text-white text-xs px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded flex items-center gap-1"
              title={`Lock all ${programName} assignments`}
            >
              <Lock className="w-3 h-3" />
              Lock Entire Program
            </button>
            <button
              onClick={() => setFullScreenMode(!fullScreenMode)}
              className="text-white text-xs px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded flex items-center gap-1"
              title={fullScreenMode ? "Exit full screen view" : "Enable full screen view for screenshots"}
            >
              {fullScreenMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              {fullScreenMode ? 'Exit Full Screen' : 'Full Screen View'}
            </button>
            <button
              onClick={() => setExpandedProgram(null)}
              className="text-white text-xs hover:underline"
            >
              {isExpanded ? 'Show Both Programs' : ''}
            </button>
          </div>
        </div>
        <div className={(isExpanded && !fullScreenMode) ? "overflow-auto" : ""} style={(isExpanded && !fullScreenMode) ? { maxHeight: 'calc(100vh - 220px)' } : {}}>
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className={`${headerColor} sticky top-0 z-10`}>
              <tr>
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-white uppercase">Client</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-white uppercase">AM Staff</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-white uppercase">AM Trainee</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white uppercase">Start</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white uppercase">End</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white uppercase">L1</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white uppercase">L2</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-white uppercase">PM Staff</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-white uppercase">PM Trainee</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white uppercase">Start</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white uppercase">End</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {programStudents.map(student => {
            const amAssignments = getAssignments(student, 'AM');
            const pmAssignments = getAssignments(student, 'PM');
              
            const isAbsentAM = !student.isAvailableForSession('AM', selectedDate);
            const isAbsentPM = !student.isAvailableForSession('PM', selectedDate);
            const isFullyAbsent = isAbsentAM && isAbsentPM;
            const isOutOfSession = student.outOfSessionFullDay || (student.outOfSessionAM && student.outOfSessionPM);
              
              const defaults = getDefaultTimes(student);
              const data = editableData[student.id] || {};

              return (
                <tr key={student.id} className={`${
                  isFullyAbsent 
                    ? (isOutOfSession ? 'bg-yellow-50 hover:bg-yellow-100' : 'bg-red-50 hover:bg-red-100') 
                    : 'hover:bg-gray-50'
                }`}>
                  <td className="px-3 py-1.5 font-semibold text-gray-900 text-xs">
                    {student.name}
                    {(student.ratioAM === '2:1' || student.ratioPM === '2:1') && (
                      <span className="ml-1 text-orange-600 font-bold">(2:1)</span>
                    )}
                  </td>
                  
                  {/* AM Staff - stacked for 2:1 */}
                  <td className={`px-3 py-1.5 ${isAbsentAM ? 'bg-red-50' : ''}`}>
                    {isAbsentAM ? (
                      <span className={`font-semibold text-xs ${student.outOfSessionAM || student.outOfSessionFullDay ? 'text-yellow-700' : 'text-red-700'}`}>
                        {student.outOfSessionAM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT'}
                      </span>
                    ) : (() => {
                      const staffAssignments = getStaffAssignments(student, 'AM');
                      return (
                        <div className="space-y-1">
                          {/* Staff 1 */}
                          <div className="flex items-center gap-1">
                            {renderStaffDropdown(
                              student, 
                              'AM', 
                              staffAssignments[0]?.staffId, 
                              (e) => handleStaffSelect(student, 'AM', e.target.value, 0),
                              "-- Select --"
                            )}
                            {staffAssignments.length > 0 && (
                              <button
                                onClick={() => toggleLock(student, 'AM')}
                                className={`p-1 rounded ${
                                  staffAssignments[0].isLocked
                                    ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                    : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                                }`}
                                title={staffAssignments[0].isLocked ? 'Locked (click to unlock)' : 'Unlocked (click to lock)'}
                              >
                                {staffAssignments[0].isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          {/* Staff 2 (only for 2:1 ratio) */}
                          {student.ratioAM === '2:1' && (
                            <div className="flex items-center gap-1">
                              {renderStaffDropdown(
                                student, 
                                'AM', 
                                staffAssignments[1]?.staffId, 
                                (e) => handleStaffSelect(student, 'AM', e.target.value, 1),
                                "-- Select --"
                              )}
                              {staffAssignments.length > 1 && (
                                <button
                                  onClick={() => {
                                    const assignment = staffAssignments[1];
                                    if (assignment.isLocked) {
                                      onAssignmentUnlock(assignment.id);
                                    } else {
                                      onAssignmentLock(assignment.id);
                                    }
                                  }}
                                  className={`p-1 rounded ${
                                    staffAssignments[1].isLocked
                                      ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                      : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                                  }`}
                                  title={staffAssignments[1].isLocked ? 'Locked (click to unlock)' : 'Unlocked (click to lock)'}
                                >
                                  {staffAssignments[1].isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  
                  {/* AM Trainee */}
                  <td className="px-3 py-1.5">
                    {!isAbsentAM && (() => {
                      const traineeAssignments = getTraineeAssignments(student, 'AM');
                      const traineeStaffId = traineeAssignments[0]?.staffId || null;
                      return (
                        <div className="flex items-center gap-1">
                          {renderTraineeDropdown(
                            student, 
                            'AM', 
                            traineeStaffId, 
                            (e) => handleTraineeSelect(student, 'AM', e.target.value),
                            "-- None --"
                          )}
                          {traineeAssignments.length > 0 && (
                            <button
                              onClick={() => {
                                const assignment = traineeAssignments[0];
                                if (assignment.isLocked) {
                                  onAssignmentUnlock(assignment.id);
                                } else {
                                  onAssignmentLock(assignment.id);
                                }
                              }}
                              className={`p-1 rounded ${
                                traineeAssignments[0].isLocked
                                  ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                  : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                              }`}
                              title={traineeAssignments[0].isLocked ? 'Locked (click to unlock)' : 'Unlocked (click to lock)'}
                            >
                              {traineeAssignments[0].isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  
                  {/* AM Times */}
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={data.amStart || defaults.amStart}
                      onChange={(e) => handleFieldChange(student.id, 'amStart', e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={data.amEnd || defaults.amEnd}
                      onChange={(e) => handleFieldChange(student.id, 'amEnd', e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  
                  {/* Lunch Coverage */}
                  <td className="px-2 py-1.5">
                    {(() => {
                      const amEnd = data.amEnd || defaults.amEnd;
                      const pmStart = data.pmStart || defaults.pmStart;
                      const isNeeded = isLunchCoverageNeeded(amEnd, pmStart, 'L1');
                      return (
                        <input
                          type="text"
                          value={data.lunch1Cov || ''}
                          onChange={(e) => handleFieldChange(student.id, 'lunch1Cov', e.target.value)}
                          disabled={!isNeeded}
                          className={`border rounded px-1 py-0.5 text-xs w-14 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            isNeeded 
                              ? 'border-gray-300 bg-white' 
                              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        />
                      );
                    })()}
                  </td>
                  <td className="px-2 py-1.5">
                    {(() => {
                      const amEnd = data.amEnd || defaults.amEnd;
                      const pmStart = data.pmStart || defaults.pmStart;
                      const isNeeded = isLunchCoverageNeeded(amEnd, pmStart, 'L2');
                      return (
                        <input
                          type="text"
                          value={data.lunch2Cov || ''}
                          onChange={(e) => handleFieldChange(student.id, 'lunch2Cov', e.target.value)}
                          disabled={!isNeeded}
                          className={`border rounded px-1 py-0.5 text-xs w-14 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            isNeeded 
                              ? 'border-gray-300 bg-white' 
                              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        />
                      );
                    })()}
                  </td>
                  
                  {/* PM Staff - stacked for 2:1 */}
                  <td className={`px-3 py-1.5 ${isAbsentPM ? 'bg-red-50' : ''}`}>
                    {isAbsentPM ? (
                      <span className={`font-semibold text-xs ${student.outOfSessionPM || student.outOfSessionFullDay ? 'text-yellow-700' : 'text-red-700'}`}>
                        {student.outOfSessionPM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT'}
                      </span>
                    ) : (() => {
                      const staffAssignments = getStaffAssignments(student, 'PM');
                      return (
                        <div className="space-y-1">
                          {/* Staff 1 */}
                          <div className="flex items-center gap-1">
                            {renderStaffDropdown(
                              student, 
                              'PM', 
                              staffAssignments[0]?.staffId, 
                              (e) => handleStaffSelect(student, 'PM', e.target.value, 0),
                              "-- Select --"
                            )}
                            {staffAssignments.length > 0 && (
                              <button
                                onClick={() => toggleLock(student, 'PM')}
                                className={`p-1 rounded ${
                                  staffAssignments[0].isLocked
                                    ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                    : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                                }`}
                                title={staffAssignments[0].isLocked ? 'Locked (click to unlock)' : 'Unlocked (click to lock)'}
                              >
                                {staffAssignments[0].isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          {/* Staff 2 (only for 2:1 ratio) */}
                          {student.ratioPM === '2:1' && (
                            <div className="flex items-center gap-1">
                              {renderStaffDropdown(
                                student, 
                                'PM', 
                                staffAssignments[1]?.staffId, 
                                (e) => handleStaffSelect(student, 'PM', e.target.value, 1),
                                "-- Select --"
                              )}
                              {staffAssignments.length > 1 && (
                                <button
                                  onClick={() => {
                                    const assignment = staffAssignments[1];
                                    if (assignment.isLocked) {
                                      onAssignmentUnlock(assignment.id);
                                    } else {
                                      onAssignmentLock(assignment.id);
                                    }
                                  }}
                                  className={`p-1 rounded ${
                                    staffAssignments[1].isLocked
                                      ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                      : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                                  }`}
                                  title={staffAssignments[1].isLocked ? 'Locked (click to unlock)' : 'Unlocked (click to lock)'}
                                >
                                  {staffAssignments[1].isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  
                  {/* PM Trainee */}
                  <td className="px-3 py-1.5">
                    {!isAbsentPM && (() => {
                      const traineeAssignments = getTraineeAssignments(student, 'PM');
                      const traineeStaffId = traineeAssignments[0]?.staffId || null;
                      return (
                        <div className="flex items-center gap-1">
                          {renderTraineeDropdown(
                            student, 
                            'PM', 
                            traineeStaffId, 
                            (e) => handleTraineeSelect(student, 'PM', e.target.value),
                            "-- None --"
                          )}
                          {traineeAssignments.length > 0 && (
                            <button
                              onClick={() => {
                                const assignment = traineeAssignments[0];
                                if (assignment.isLocked) {
                                  onAssignmentUnlock(assignment.id);
                                } else {
                                  onAssignmentLock(assignment.id);
                                }
                              }}
                              className={`p-1 rounded ${
                                traineeAssignments[0].isLocked
                                  ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                  : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                              }`}
                              title={traineeAssignments[0].isLocked ? 'Locked (click to unlock)' : 'Unlocked (click to lock)'}
                            >
                              {traineeAssignments[0].isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  
                  {/* PM Times */}
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={data.pmStart || defaults.pmStart}
                      onChange={(e) => handleFieldChange(student.id, 'pmStart', e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={data.pmEnd || defaults.pmEnd}
                      onChange={(e) => handleFieldChange(student.id, 'pmEnd', e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                </tr>
            );
          })}
        </tbody>
      </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Schedule Grid</h2>
          <p className="text-sm text-gray-600">Interactive schedule with staff assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openInNewWindow}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Window
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
        <p className="text-xs text-blue-800">
          <strong>💡 Staff Selection:</strong> Dropdowns show only <strong>team members</strong> who are available for each session. 
          For <strong className="text-orange-600">2:1 ratio</strong> clients, two staff dropdowns are stacked vertically in the staff cell.
          The <strong>Trainee</strong> column is for staff in training (separate from the 2:1 ratio staff).
          To assign someone not on the team, first add them to the client's team in the Teams tab.
          Click the expand button to focus on one program at a time.
        </p>
        <div className="flex items-center gap-4 text-xs text-blue-800">
          <strong>🎨 Staff Highlighting:</strong>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-4 bg-yellow-200 border border-gray-300 rounded"></span>
            Used 1x
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-4 bg-blue-200 border border-gray-300 rounded"></span>
            Out one session, working other
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-4 bg-green-200 border border-gray-300 rounded"></span>
            Used 2x
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-4 bg-red-200 border border-gray-300 rounded"></span>
            ⚠️ Issue (2x same session or same kid AM/PM)
          </span>
        </div>
      </div>

      {/* Primary Program Table */}
      {renderProgramTable(primaryStudents, 'Primary', 'bg-blue-600')}

      {/* Secondary Program Table */}
      {renderProgramTable(secondaryStudents, 'Secondary', 'bg-purple-600')}
    </div>
  );
};

export default ScheduleGridView;
