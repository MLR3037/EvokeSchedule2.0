import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Users, Clock, AlertTriangle, CheckCircle, GraduationCap, Star } from 'lucide-react';
import { SESSION_TIMES, RATIOS, TRAINING_STATUS } from '../types/index.js';

/**
 * Interactive Assignment Table - Pre-assignment with team dropdowns
 */
export const ScheduleTableView = ({ 
  schedule, 
  staff, 
  students, 
  onAssignmentLock, 
  onAssignmentUnlock,
  onAssignmentRemove,
  onManualAssignment,
  selectedDate 
}) => {
  console.log('🔍 ScheduleTableView rendering with:', { 
    studentsCount: students.length, 
    staffCount: staff.length,
    assignmentsCount: schedule.assignments.length 
  });
  
  const [preAssignments, setPreAssignments] = useState({});
  const [lockedAssignments, setLockedAssignments] = useState(new Set());
  const [traineeAssignments, setTraineeAssignments] = useState({});

  // Sync component state when schedule changes
  useEffect(() => {
    console.log('🔄 Schedule changed, syncing state...');
    console.log('  Total assignments:', schedule.assignments.length);
    
    // Sync locked assignments based on actual schedule
    const newLockedAssignments = new Set();
    
    schedule.assignments.forEach(assignment => {
      const key = getPreAssignmentKey(assignment.studentId, assignment.session);
      newLockedAssignments.add(key);
    });
    
    setLockedAssignments(newLockedAssignments);
    
    // Clear pre-assignments for students that now have real assignments
    setPreAssignments(prev => {
      const newPre = { ...prev };
      schedule.assignments.forEach(assignment => {
        const key = getPreAssignmentKey(assignment.studentId, assignment.session);
        if (newPre[key]) {
          delete newPre[key];
        }
      });
      return newPre;
    });
  }, [schedule.assignments.length]);

  // Get unique programs from students
  const programs = [...new Set(students.filter(s => s.isActive).map(s => s.program))];

  // Generate role color mapping
  const getRoleColor = (role) => {
    const roleColors = {
      'RBT': 'bg-purple-100 text-purple-800',
      'BS': 'bg-indigo-100 text-indigo-800', 
      'BCBA': 'bg-blue-100 text-blue-800',
      'EA': 'bg-green-100 text-green-800',
      'MHA': 'bg-yellow-100 text-yellow-800',
      'CC': 'bg-orange-100 text-orange-800',
      'Teacher': 'bg-pink-100 text-pink-800',
      'Director': 'bg-gray-100 text-gray-800'
    };
    return roleColors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStudentTeam = (student) => {
    let team = [];
    
    // Use ONLY People Picker data - no dependency on Staff list names
    if (student.team && student.team.length > 0) {
      team = student.team.map(teamMember => {
        // Use the full name from People Picker data
        const fullName = teamMember.title || teamMember.DisplayName || teamMember.LookupValue;
        
        if (!fullName) return null;
        
        // Find staff member by email to get role info (more reliable than name matching)
        let staffRole = 'RBT'; // Default role
        let staffEmail = teamMember.email;
        
        if (teamMember.email) {
          const staffMember = staff.find(s => s.email && s.email.toLowerCase() === teamMember.email.toLowerCase());
          if (staffMember) {
            staffRole = staffMember.role;
          }
        }
        
        // If email match failed, try ID match as backup
        if (staffRole === 'RBT' && teamMember.id) {
          const staffMember = staff.find(s => s.id === teamMember.id);
          if (staffMember) {
            staffRole = staffMember.role;
          }
        }
        
        // Return team member using ONLY People Picker data
        return {
          id: teamMember.id,
          name: fullName, // Use ONLY the full name from People Picker
          role: staffRole, // Role from staff list match
          email: staffEmail
        };
      }).filter(Boolean);
    }
    
    return team;
  };

  const getCurrentAssignment = (student, session) => {
    const assignment = schedule.assignments.find(a => 
      a.studentId === student.id && 
      a.session === session && 
      a.program === student.program
    );
    
    return assignment;
  };

  const getPreAssignmentKey = (studentId, session, staffIndex = 0) => {
    return `${studentId}_${session}_${staffIndex}`;
  };

  const handleStaffSelection = (studentId, session, staffId, staffIndex = 0) => {
    const key = getPreAssignmentKey(studentId, session, staffIndex);
    setPreAssignments(prev => ({
      ...prev,
      [key]: staffId ? parseInt(staffId) : null
    }));
    
    console.log(`📝 Staff selected: Student ${studentId}, Session ${session}, Staff ${staffId}, Index ${staffIndex}`);
  };

  const handleLockAssignment = (studentId, session, staffIndex = 0) => {
    const key = getPreAssignmentKey(studentId, session, staffIndex);
    const staffId = preAssignments[key];
    
    console.log(`🔒 Locking assignment: Student ${studentId}, Session ${session}, Staff ${staffId}`);
    
    if (staffId) {
      // Create manual assignment
      const student = students.find(s => s.id === studentId);
      if (student && onManualAssignment) {
        console.log(`📤 Calling onManualAssignment with:`, {
          staffId: staffId,
          studentId: studentId,
          session: session,
          program: student.program
        });
        
        onManualAssignment({
          staffId: staffId,
          studentId: studentId,
          session: session,
          program: student.program
        });
        
        // Add to locked assignments
        setLockedAssignments(prev => new Set([...prev, key]));
        
        // Clear pre-assignment since it's now a real assignment
        setPreAssignments(prev => {
          const newPre = { ...prev };
          delete newPre[key];
          return newPre;
        });
        
        console.log(`✅ Assignment locked successfully`);
      }
    } else {
      console.warn(`⚠️ No staff selected for ${studentId} ${session}`);
    }
  };

  const handleUnlockAssignment = (studentId, session, staffIndex = 0) => {
    const key = getPreAssignmentKey(studentId, session, staffIndex);
    
    console.log(`🔓 Unlocking assignment: Student ${studentId}, Session ${session}, Index ${staffIndex}`);
    
    // Find the specific assignment by staff index
    const student = students.find(s => s.id === studentId);
    const studentAssignments = getStudentAssignments(student, session);
    const currentAssignment = studentAssignments[staffIndex];
    
    if (currentAssignment) {
      console.log(`🗑️ Removing assignment ID: ${currentAssignment.id} (Index ${staffIndex})`);
      
      // Remove the actual assignment
      if (onAssignmentRemove) {
        onAssignmentRemove(currentAssignment.id);
      }
      
      // Also unlock via parent handler if available
      if (onAssignmentUnlock) {
        onAssignmentUnlock(currentAssignment.id);
      }
    }
    
    // Remove from locked assignments
    setLockedAssignments(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
    
    // Clear pre-assignment
    setPreAssignments(prev => ({
      ...prev,
      [key]: null
    }));
    
    console.log(`✅ Assignment unlocked successfully`);
  };

  const isAssignmentLocked = (studentId, session) => {
    const key = getPreAssignmentKey(studentId, session);
    return lockedAssignments.has(key);
  };

  const formatStudentName = (student) => {
    let displayName = student.name;
    if (student.isPaired()) {
      const pairedStudent = student.getPairedStudent(students);
      if (pairedStudent) {
        displayName += ` (paired: ${pairedStudent.name})`;
      }
    }
    return displayName;
  };

  const getRatioDisplay = (student) => {
    const ratioColors = {
      [RATIOS.ONE_TO_ONE]: 'bg-blue-100 text-blue-800',
      [RATIOS.TWO_TO_ONE]: 'bg-red-100 text-red-800', 
      [RATIOS.ONE_TO_TWO]: 'bg-green-100 text-green-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${ratioColors[student.ratio] || 'bg-gray-100 text-gray-800'}`}>
        {student.ratio}
      </span>
    );
  };

  // Helper function to get the required staff count for a student in a session
  const getRequiredStaffCount = (student, session) => {
    const ratio = session === 'AM' ? student.ratioAM : student.ratioPM;
    switch (ratio) {
      case RATIOS.TWO_TO_ONE:
        return 2;
      case RATIOS.ONE_TO_ONE:
      case RATIOS.ONE_TO_TWO:
      default:
        return 1;
    }
  };

  // Helper function to get all assignments for a student in a session
  const getStudentAssignments = (student, session) => {
    if (!schedule || !schedule.assignments) return [];
    return schedule.assignments.filter(assignment => 
      assignment.studentId === student.id && 
      assignment.session === session && 
      assignment.program === student.program
    );
  };

  const renderStaffDropdown = (student, session) => {
    // Check if student is absent for this session
    if (!student.isAvailableForSession(session)) {
      return (
        <div className="flex items-center gap-2">
          <div className="text-sm px-3 py-2 bg-gray-100 text-gray-400 rounded border border-gray-200 italic">
            ABSENT
          </div>
          <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-medium">
            {student.absentFullDay ? 'Full Day' : session === 'AM' ? 'Absent AM' : 'Absent PM'}
          </span>
        </div>
      );
    }

    const team = getStudentTeam(student);
    const requiredStaffCount = getRequiredStaffCount(student, session);
    const currentAssignments = getStudentAssignments(student, session);
    
    console.log(`🔍 DROPDOWN RENDER for ${student.name} ${session}:`);
    console.log(`  Required staff:`, requiredStaffCount);
    console.log(`  Current assignments:`, currentAssignments.length);

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
      const trainingStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(teamMember.id) : TRAINING_STATUS.SOLO;
      const isInTraining = trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || trainingStatus === TRAINING_STATUS.OVERLAP_BCBA;
      
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

    if (availableTeamMembers.length === 0) {
      return <span className="text-gray-400 text-sm">No available team</span>;
    }

    // Render multiple dropdowns for 2:1 students
    const dropdowns = [];
    for (let staffIndex = 0; staffIndex < requiredStaffCount; staffIndex++) {
      const currentAssignment = currentAssignments[staffIndex];
      const key = `${student.id}_${session}_${staffIndex}`;
      const isLocked = isAssignmentLocked(student.id, session);
      
      // Get the selected staff ID for this dropdown
      const selectedStaffId = currentAssignment?.staffId || preAssignments[key] || '';

      // Filter out staff already assigned to other dropdowns for this student/session
      const assignedStaffIds = currentAssignments
        .filter((_, idx) => idx !== staffIndex)
        .map(a => a.staffId);
      
      const availableForThisDropdown = availableTeamMembers.filter(member => 
        !assignedStaffIds.includes(member.id) || member.id === selectedStaffId
      );

      dropdowns.push(
        <div key={key} className="flex items-center gap-2 mb-1">
          <select
            value={selectedStaffId}
            onChange={(e) => handleStaffSelection(student.id, session, e.target.value, staffIndex)}
            disabled={!!currentAssignment}
            className={`text-sm border rounded px-2 py-1 min-w-[160px] ${
              currentAssignment ? 'bg-gray-100 text-gray-600' : 'bg-white'
            }`}
          >
            <option value="">Select staff...</option>
            {availableForThisDropdown.map(staffMember => (
              <option key={staffMember.id} value={staffMember.id}>
                {staffMember.name} ({staffMember.role})
              </option>
            ))}
          </select>
          
          {requiredStaffCount > 1 && (
            <span className="text-xs text-gray-500">#{staffIndex + 1}</span>
          )}
          
          {/* Show lock button if staff is selected but not yet assigned */}
          {!currentAssignment && selectedStaffId && (
            <button
              onClick={() => handleLockAssignment(student.id, session, staffIndex)}
              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
              title="Lock in this assignment"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
          
          {/* Show unlock button if there's a current assignment */}
          {currentAssignment && (
            <button
              onClick={() => handleUnlockAssignment(student.id, session, staffIndex)}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
              title="Remove this assignment"
            >
              <Unlock className="w-4 h-4" />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {dropdowns}
        {requiredStaffCount > 1 && (
          <div className="text-xs text-gray-500 mt-1">
            Requires {requiredStaffCount} staff
          </div>
        )}
      </div>
    );
  };

  const renderTraineeDropdown = (student, session) => {
    // Check if student is absent for this session
    if (!student.isAvailableForSession(session)) {
      return null;
    }

    const team = getStudentTeam(student);
    const traineeKey = `${student.id}_${session}`;
    const selectedTraineeId = traineeAssignments[traineeKey] || '';
    
    // Filter team to ONLY show staff who are in training (overlap-staff or overlap-bcba status)
    const traineesInTraining = team.filter(teamMember => {
      const trainingStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(teamMember.id) : TRAINING_STATUS.SOLO;
      const isInTraining = trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || trainingStatus === TRAINING_STATUS.OVERLAP_BCBA;
      
      console.log(`🎓 Checking ${teamMember.name} for trainee dropdown:`, {
        trainingStatus,
        isInTraining,
        isOverlapStaff: trainingStatus === TRAINING_STATUS.OVERLAP_STAFF,
        isOverlapBCBA: trainingStatus === TRAINING_STATUS.OVERLAP_BCBA
      });
      
      return isInTraining;
    }).filter(teamMember => {
      // Always show if currently selected
      if (selectedTraineeId && teamMember.id == selectedTraineeId) {
        return true;
      }
      // Check if staff is available for this session
      const staffMember = staff.find(s => s.id === teamMember.id || s.id == teamMember.id);
      if (!staffMember) return false;
      
      // EXCLUDE staff who are absent for this session
      if (!staffMember.isAvailableForSession(session)) {
        console.log(`🚫 Excluding ${teamMember.name} from trainee dropdown - absent for ${session}`);
        return false;
      }
      
      return schedule.isStaffAvailable(staffMember.id, session, student.program);
    });

    console.log(`🎓 Trainees available for ${student.name} ${session}:`, traineesInTraining.map(t => t.name));

    const handleTraineeChange = (e) => {
      const staffId = e.target.value ? parseInt(e.target.value) : null;
      console.log(`🎓 Trainee selected: ${staffId} for ${student.name} ${session}`);
      
      if (staffId) {
        // Update local state
        setTraineeAssignments(prev => ({
          ...prev,
          [traineeKey]: staffId
        }));
        
        // Update schedule object
        const traineeAssignment = {
          staffId: staffId,
          studentId: student.id,
          session: session,
          program: student.program,
          isTrainee: true
        };
        
        if (schedule.removeTraineeAssignment) {
          schedule.removeTraineeAssignment(student.id, session);
        }
        if (schedule.addTraineeAssignment) {
          schedule.addTraineeAssignment(traineeAssignment);
        }
        
        console.log('✅ Trainee assigned:', traineeAssignment);
      } else {
        // Remove trainee
        setTraineeAssignments(prev => {
          const newState = { ...prev };
          delete newState[traineeKey];
          return newState;
        });
        
        if (schedule.removeTraineeAssignment) {
          schedule.removeTraineeAssignment(student.id, session);
        }
        
        console.log('🗑️ Trainee removed');
      }
    };

    const handleRemoveTrainee = () => {
      setTraineeAssignments(prev => {
        const newState = { ...prev };
        delete newState[traineeKey];
        return newState;
      });
      
      if (schedule.removeTraineeAssignment) {
        schedule.removeTraineeAssignment(student.id, session);
      }
    };

    return (
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <select
            value={selectedTraineeId}
            onChange={handleTraineeChange}
            className="text-sm border rounded px-2 py-1 min-w-[160px] bg-orange-50 border-orange-300"
          >
            <option value="">Trainee (optional)...</option>
            {traineesInTraining.map(staffMember => (
              <option key={staffMember.id} value={staffMember.id}>
                🎓 {staffMember.name} ({staffMember.role})
              </option>
            ))}
          </select>
          {selectedTraineeId && (
            <button
              onClick={handleRemoveTrainee}
              className="p-1 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded"
              title="Remove trainee"
            >
              <Unlock className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {programs.map(program => {
        const programStudents = students
          .filter(s => s.program === program && s.isActive)
          .sort((a, b) => a.name.localeCompare(b.name));
        
        return (
          <div key={program} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
              <h3 className="text-lg font-bold">{program.toUpperCase()}</h3>
              <p className="text-blue-100 text-sm">{programStudents.length} students</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                      AM Staff Assignment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                      PM Staff Assignment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Team
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {programStudents.map((student, index) => {
                    const team = getStudentTeam(student);
                    const isEvenRow = index % 2 === 0;
                    
                    return (
                      <tr key={student.id} className={isEvenRow ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap border-r">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {formatStudentName(student)}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {getRatioDisplay(student)}
                                {student.isPaired() && (
                                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                                    Paired
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap border-r">
                          {renderStaffDropdown(student, 'AM')}
                          {renderTraineeDropdown(student, 'AM')}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap border-r">
                          {renderStaffDropdown(student, 'PM')}
                          {renderTraineeDropdown(student, 'PM')}
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {team.length > 0 ? (
                              team.map((teamMember, idx) => {
                                const trainingStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(teamMember.id) : TRAINING_STATUS.SOLO;
                                return (
                                  <div key={idx} className="flex items-center gap-1">
                                    {trainingStatus === TRAINING_STATUS.TRAINER && (
                                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" title="Trainer" />
                                    )}
                                    {trainingStatus === TRAINING_STATUS.OVERLAP_STAFF && (
                                      <GraduationCap className="w-3.5 h-3.5 text-red-600 flex-shrink-0" title="Needs Staff Overlap" />
                                    )}
                                    {trainingStatus === TRAINING_STATUS.OVERLAP_BCBA && (
                                      <GraduationCap className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" title="Needs BCBA Overlap" />
                                    )}
                                    <span 
                                      className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(teamMember.role)}`}
                                    >
                                      {teamMember.name}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-gray-400 text-sm">No team assigned</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Schedule Grid Component - Shows the main scheduling grid with sessions and assignments
 */
export const ScheduleGrid = ({ 
  schedule, 
  staff, 
  students, 
  onAssignmentLock, 
  onAssignmentUnlock,
  onManualAssignment,
  onAssignmentRemove,
  selectedDate 
}) => {
  const [selectedCell, setSelectedCell] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Get unique programs from students
  const programs = [...new Set(students.map(s => s.program))];
  const sessions = ['AM', 'PM'];

  const getSessionAssignments = (session, program) => {
    return schedule.getAssignmentsForSession(session, program);
  };

  const getStudentsForProgram = (program) => {
    return students
      .filter(s => s.program === program && s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getAssignmentDisplay = (assignment) => {
    const staffMember = staff.find(s => s.id === assignment.staffId);
    const student = students.find(s => s.id === assignment.studentId);
    
    if (!staffMember || !student) return null;

    // Get training status for this staff member on this student
    const trainingStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(staffMember.id) : TRAINING_STATUS.SOLO;

    return {
      id: assignment.id,
      staffName: staffMember.name,
      studentName: student.name,
      staffRole: staffMember.role,
      ratio: student.ratio,
      isLocked: schedule.isAssignmentLocked(assignment.id),
      assignedBy: assignment.assignedBy,
      trainingStatus: trainingStatus
    };
  };

  const handleCellClick = (session, program) => {
    setSelectedCell({ session, program });
    setShowAssignmentModal(true);
  };

  const getSessionTimeDisplay = (session, program) => {
    const times = SESSION_TIMES[program.toUpperCase()]?.[session];
    return times ? `${times.start} - ${times.end}` : '';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-blue-600 text-white p-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Schedule for {selectedDate.toLocaleDateString()}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Program</th>
              {sessions.map(session => (
                <th key={session} className="px-4 py-3 text-center font-semibold text-gray-700 min-w-80">
                  {session} Session
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map(program => (
              <tr key={program} className="border-b hover:bg-gray-50">
                <td className="px-4 py-6 font-medium text-gray-900 bg-gray-50">
                  <div className="flex flex-col">
                    <span className="text-lg">{program}</span>
                    <span className="text-sm text-gray-500">
                      {getStudentsForProgram(program).length} students
                    </span>
                  </div>
                </td>
                {sessions.map(session => {
                  const assignments = getSessionAssignments(session, program);
                  const timeDisplay = getSessionTimeDisplay(session, program);
                  
                  return (
                    <td key={`${program}-${session}`} className="px-4 py-6 align-top">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium text-gray-600">
                            {timeDisplay}
                          </span>
                          <button
                            onClick={() => handleCellClick(session, program)}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                          >
                            + Add Assignment
                          </button>
                        </div>
                        
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {assignments.map(assignment => {
                            const display = getAssignmentDisplay(assignment);
                            if (!display) return null;

                            return (
                              <AssignmentCard
                                key={assignment.id}
                                assignment={display}
                                onLock={() => onAssignmentLock(assignment.id)}
                                onUnlock={() => onAssignmentUnlock(assignment.id)}
                                onRemove={() => onAssignmentRemove(assignment.id)}
                              />
                            );
                          })}
                          
                          {assignments.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No assignments</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAssignmentModal && (
        <ManualAssignmentModal
          session={selectedCell.session}
          program={selectedCell.program}
          staff={staff}
          students={students}
          schedule={schedule}
          onAssign={onManualAssignment}
          onClose={() => setShowAssignmentModal(false)}
        />
      )}
    </div>
  );
};

/**
 * Assignment Card Component - Shows individual staff-student assignments
 */
const AssignmentCard = ({ assignment, onLock, onUnlock, onRemove }) => {
  const getRatioColor = (ratio) => {
    switch (ratio) {
      case RATIOS.TWO_TO_ONE: return 'bg-red-100 text-red-800';
      case RATIOS.ONE_TO_TWO: return 'bg-green-100 text-green-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      'RBT': 'bg-purple-100 text-purple-800',
      'BS': 'bg-indigo-100 text-indigo-800',
      'BCBA': 'bg-blue-100 text-blue-800',
      'EA': 'bg-green-100 text-green-800',
      'MHA': 'bg-yellow-100 text-yellow-800',
      'CC': 'bg-orange-100 text-orange-800',
      'Teacher': 'bg-pink-100 text-pink-800',
      'Director': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  // Check if this is a trainee working solo (needs warning)
  const isTraineeSolo = (assignment.trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || 
                         assignment.trainingStatus === TRAINING_STATUS.OVERLAP_BCBA) && 
                        assignment.ratio === RATIOS.ONE_TO_ONE;

  return (
    <div className={`border rounded-lg p-3 transition-all hover:shadow-md ${
      assignment.isLocked ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-medium text-gray-900">{assignment.studentName}</div>
          <div className="text-sm text-gray-900 flex items-center gap-1">
            {assignment.trainingStatus === TRAINING_STATUS.TRAINER && (
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" title="Trainer" />
            )}
            {assignment.trainingStatus === TRAINING_STATUS.OVERLAP_STAFF && (
              <GraduationCap className="w-3.5 h-3.5 text-red-600 flex-shrink-0" title="Needs Staff Overlap" />
            )}
            {assignment.trainingStatus === TRAINING_STATUS.OVERLAP_BCBA && (
              <GraduationCap className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" title="Needs BCBA Overlap" />
            )}
            {isTraineeSolo && (
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" title="Warning: Trainee assigned solo" />
            )}
            <span className="font-medium">{assignment.staffName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={assignment.isLocked ? onUnlock : onLock}
            className={`p-1 rounded ${
              assignment.isLocked 
                ? 'text-yellow-600 hover:bg-yellow-100' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={assignment.isLocked ? 'Unlock assignment' : 'Lock assignment'}
          >
            {assignment.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded text-red-400 hover:bg-red-50"
            title="Remove assignment"
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(assignment.staffRole)}`}>
          {assignment.staffRole}
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRatioColor(assignment.ratio)}`}>
          {assignment.ratio}
        </span>
        {assignment.assignedBy === 'manual' && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Manual
          </span>
        )}
        {assignment.assignedBy === 'auto' && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Auto
          </span>
        )}
        {assignment.assignedBy === 'auto-paired' && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Paired
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Manual Assignment Modal - Allows manual staff-student assignments
 */
const ManualAssignmentModal = ({ 
  session, 
  program, 
  staff, 
  students, 
  schedule, 
  onAssign, 
  onClose 
}) => {
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  // Get available staff and students for this session/program
  const availableStaff = staff.filter(s => 
    s.isActive && 
    s.canWorkProgram(program) &&
    schedule.isStaffAvailable(s.id, session, program)
  );

  const availableStudents = students
    .filter(s => 
      s.isActive && 
      s.program === program &&
      !schedule.getAssignmentsForSession(session, program).some(a => a.studentId === s.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleAssign = () => {
    if (!selectedStaff || !selectedStudent) {
      setValidationErrors(['Please select both staff and student']);
      return;
    }

    // Additional validation could be added here
    setValidationErrors([]);
    
    onAssign({
      staffId: parseInt(selectedStaff),
      studentId: parseInt(selectedStudent),
      session,
      program
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">
          Manual Assignment - {program} {session}
        </h3>

        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            {validationErrors.map((error, index) => (
              <p key={index} className="text-red-700 text-sm">{error}</p>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Student
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a student...</option>
              {availableStudents.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.ratio})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Staff
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose staff member...</option>
              {availableStaff.map(staffMember => (
                <option key={staffMember.id} value={staffMember.id}>
                  {staffMember.name} ({staffMember.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Session Summary Component - Shows summary statistics for a session
 */
export const SessionSummary = ({ schedule, staff, students, session, program }) => {
  const assignments = schedule.getAssignmentsForSession(session, program);
  const programStudents = students
    .filter(s => s.program === program && s.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Calculate absent staff and students for this session
  const absentStaff = staff.filter(s => s.isActive && !s.isAvailableForSession(session));
  const absentStudents = students.filter(s => s.isActive && s.program === program && !s.isAvailableForSession(session));
  
  // Filter out absent students when counting - only count present students
  const presentProgramStudents = programStudents.filter(s => s.isAvailableForSession(session));
  const assignedStudents = new Set(assignments.map(a => a.studentId));
  const unassignedCount = presentProgramStudents.length - assignedStudents.size;
  
  // Calculate staff utilization by role
  const staffByRole = {};
  const assignedStaffIds = new Set(assignments.map(a => a.staffId));
  
  assignments.forEach(assignment => {
    const staffMember = staff.find(s => s.id === assignment.staffId);
    if (staffMember) {
      const role = staffMember.role;
      if (!staffByRole[role]) {
        staffByRole[role] = new Set();
      }
      staffByRole[role].add(staffMember.id);
    }
  });

  // Convert Set to count for display
  const staffRoleCounts = {};
  Object.keys(staffByRole).forEach(role => {
    staffRoleCounts[role] = staffByRole[role].size;
  });

  // Find unassigned students (exclude absent students)
  const unassignedStudents = programStudents.filter(student => 
    !assignedStudents.has(student.id) && student.isAvailableForSession(session)
  );

  // Find unassigned staff for this program and session
  const availableStaff = staff.filter(staffMember => {
    if (!staffMember.isActive) return false;
    
    // Check if staff is available for this session (not absent)
    if (!staffMember.isAvailableForSession(session)) return false;
    
    // Check if staff works with this program
    const worksWithProgram = program === 'Primary' 
      ? staffMember.primaryProgram 
      : staffMember.secondaryProgram;
    
    return worksWithProgram && !assignedStaffIds.has(staffMember.id);
  });

  // Group unassigned staff by role
  const unassignedStaffByRole = {};
  availableStaff.forEach(staffMember => {
    const role = staffMember.role;
    if (!unassignedStaffByRole[role]) {
      unassignedStaffByRole[role] = [];
    }
    unassignedStaffByRole[role].push(staffMember);
  });

  const getCompletionColor = () => {
    if (unassignedCount === 0) return 'text-green-600';
    if (unassignedCount <= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRoleColor = (role) => {
    const colors = {
      'RBT': 'bg-purple-100 text-purple-800',
      'BS': 'bg-indigo-100 text-indigo-800',
      'BCBA': 'bg-blue-100 text-blue-800',
      'EA': 'bg-green-100 text-green-800',
      'MHA': 'bg-yellow-100 text-yellow-800',
      'CC': 'bg-orange-100 text-orange-800',
      'Teacher': 'bg-pink-100 text-pink-800',
      'Trainer': 'bg-gray-100 text-gray-800',
      'Director': 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-900 mb-3">
        {program} {session} Summary
      </h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Total Students:</span>
          <span className="font-medium">{programStudents.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Assigned:</span>
          <span className="font-medium">{assignedStudents.size}</span>
        </div>
        <div className="flex justify-between">
          <span>Unassigned:</span>
          <span className={`font-medium ${getCompletionColor()}`}>
            {unassignedCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Staff Used:</span>
          <span className="font-medium">{assignedStaffIds.size}</span>
        </div>
      </div>

      {/* Staff by Role */}
      {Object.keys(staffRoleCounts).length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-medium text-gray-600 mb-2">Staff by Role:</div>
          <div className="space-y-1">
            {Object.entries(staffRoleCounts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([role, count]) => (
                <div key={role} className="flex justify-between items-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(role)}`}>
                    {role}
                  </span>
                  <span className="text-xs font-semibold">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Absent Staff */}
      {absentStaff.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-medium text-red-600 mb-2">
            Absent Staff ({absentStaff.length}):
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {absentStaff.map(staffMember => (
              <div key={staffMember.id} className="text-xs flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded ${getRoleColor(staffMember.role)}`}>
                  {staffMember.role}
                </span>
                <span className="text-gray-700">{staffMember.name}</span>
                <span className="text-red-600 text-[10px]">
                  {staffMember.absentFullDay ? '(Full Day)' : 
                   session === 'AM' ? '(AM)' : '(PM)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Absent Students */}
      {absentStudents.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-medium text-red-600 mb-2">
            Absent Clients ({absentStudents.length}):
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {absentStudents.map(student => (
              <div key={student.id} className="text-xs text-gray-700 flex items-center gap-2">
                <span>{student.name}</span>
                <span className="text-red-600 text-[10px]">
                  {student.absentFullDay ? '(Full Day)' : 
                   session === 'AM' ? '(AM)' : '(PM)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Students */}
      {unassignedStudents.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-medium text-gray-600 mb-2">Unassigned Students:</div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {unassignedStudents.map(student => (
              <div key={student.id} className="text-xs text-gray-700 flex justify-between">
                <span>{student.name}</span>
                <span className="text-gray-500">
                  {session === 'AM' ? student.ratioAM : student.ratioPM}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Staff */}
      {Object.keys(unassignedStaffByRole).length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-medium text-gray-600 mb-2">Available Staff:</div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {Object.entries(unassignedStaffByRole)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([role, staffList]) => (
                <div key={role} className="space-y-0.5">
                  <div className={`px-2 py-0.5 rounded text-xs font-medium inline-block ${getRoleColor(role)}`}>
                    {role} ({staffList.length})
                  </div>
                  <div className="ml-2 space-y-0.5">
                    {staffList.map(staffMember => (
                      <div key={staffMember.id} className="text-xs text-gray-600">
                        {staffMember.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {unassignedCount === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Complete</span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Incomplete</span>
        </div>
      )}
    </div>
  );
};