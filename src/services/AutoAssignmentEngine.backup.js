import { 
  Assignment, 
  PROGRAMS, 
  RATIOS, 
  SchedulingUtils, 
  SchedulingRules 
} from '../types/index.js';

/**
 * ULTIMATE Auto-assignment algorithm for ABA scheduling
 * Features deep cascading multi-level iteration until all students assigned
 */
export class AutoAssignmentEngine {
  constructor() {
    this.debugMode = true; // Always on for ultimate mode
    this.maxIterations = 100; // Ultimate iteration limit
    this.maxChainDepth = 10; // How deep to search for swap chains
  }

  /**
   * Auto-assign all unassigned students for a given date
   * @param {Schedule} schedule - Current schedule
   * @param {Staff[]} staff - Array of staff members
   * @param {Student[]} students - Array of students
   * @returns {Assignment[]} Array of new assignments created
   */
  async autoAssignSchedule(schedule, staff, students) {
    const newAssignments = [];
    const errors = [];

    this.log('Starting auto-assignment process...');

    // Get active staff and students
    const activeStaff = staff.filter(s => s.isActive);
    const activeStudents = students.filter(s => s.isActive);

    this.log(`Active staff: ${activeStaff.length}, Active students: ${activeStudents.length}`);
    
    // DEBUG: Log staff details
    console.log('🔍 STAFF DEBUGGING - Active Staff Details:');
    activeStaff.forEach((staffMember, index) => {
      console.log(`  Staff ${index + 1}: ${staffMember.name} (ID: ${staffMember.id})`);
      console.log(`    Role: ${staffMember.role}`);
      console.log(`    Primary Program: ${staffMember.primaryProgram}`);
      console.log(`    Secondary Program: ${staffMember.secondaryProgram}`);
      console.log(`    Can work Primary: ${staffMember.canWorkProgram(PROGRAMS.PRIMARY)}`);
      console.log(`    Can work Secondary: ${staffMember.canWorkProgram(PROGRAMS.SECONDARY)}`);
      console.log(`    Can do 1:1 sessions: ${staffMember.canDo1To1Sessions()}`);
      console.log('---');
    });

    // Process each program and session
    const sessions = ['AM', 'PM'];
    const programs = [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY];

    for (const program of programs) {
      for (const session of sessions) {
        this.log(`\nProcessing ${program} ${session} session...`);
        
        // Get students for this program who need assignments
        const programStudents = activeStudents.filter(student => 
          student.program === program && 
          !this.isStudentAssigned(student.id, session, program, schedule)
        );

        this.log(`Students needing assignment: ${programStudents.length}`);
        
        // DEBUG: Log student details for this program/session
        console.log(`🔍 STUDENTS DEBUGGING - ${program} ${session} Students:`);
        programStudents.forEach((student, index) => {
          const sessionRatio = session === 'AM' ? student.ratioAM : student.ratioPM;
          console.log(`  Student ${index + 1}: ${student.name} (ID: ${student.id})`);
          console.log(`    Program: ${student.program}`);
          console.log(`    ${session} Ratio: ${sessionRatio}`);
          console.log('---');
        });

        // Sort students by priority (2:1 ratio first, then 1:1, then 1:2)
        const prioritizedStudents = this.prioritizeStudents(programStudents);

        // Assign each student
        for (const student of prioritizedStudents) {
          try {
            // Check if this student is paired with another student
            if (student.isPaired()) {
              this.log(`🔗 ${student.name} is paired with student ID: ${student.pairedWith}`);
              const pairedStudent = student.getPairedStudent(activeStudents);
              if (pairedStudent && programStudents.includes(pairedStudent)) {
                this.log(`🔗 Found paired student: ${pairedStudent.name}`);
                // Handle paired students together
                const assignments = await this.assignPairedStudents(
                  student,
                  pairedStudent,
                  session,
                  program,
                  activeStaff,
                  schedule
                );
                
                if (assignments.length > 0) {
                  newAssignments.push(...assignments);
                  // Add assignments to schedule for subsequent iterations
                  assignments.forEach(assignment => schedule.addAssignment(assignment));
                  this.log(`✓ Assigned paired students ${student.name} and ${pairedStudent.name}`);
                  
                  // Remove the paired student from the list to avoid processing it again
                  const pairedIndex = prioritizedStudents.indexOf(pairedStudent);
                  if (pairedIndex > -1) {
                    prioritizedStudents.splice(pairedIndex, 1);
                  }
                } else {
                  errors.push(`Could not assign paired students ${student.name} and ${pairedStudent.name} in ${program} ${session}`);
                  this.log(`✗ Could not assign paired students ${student.name} and ${pairedStudent.name}`);
                }
                continue;
              } else {
                this.log(`🔗 Paired student for ${student.name} not found or not in same program`);
              }
            }

            // Handle individual student assignment
            const assignments = await this.assignStudent(
              student, 
              session, 
              program, 
              activeStaff, 
              schedule
            );
            
            if (assignments.length > 0) {
              newAssignments.push(...assignments);
              // Add assignments to schedule for subsequent iterations
              assignments.forEach(assignment => schedule.addAssignment(assignment));
              this.log(`✓ Assigned ${assignments.length} staff to ${student.name}`);
            } else {
              errors.push(`Could not assign ${student.name} in ${program} ${session}`);
              this.log(`✗ Could not assign ${student.name} - checking available staff...`);
              
              // DEBUG: Log why staff aren't available for this student
              console.log(`🔍 DEBUGGING FAILED ASSIGNMENT for ${student.name} in ${program} ${session}:`);
              const sessionRatio = session === 'AM' ? student.ratioAM : student.ratioPM;
              console.log(`  Required ratio: ${sessionRatio}`);
              
              activeStaff.forEach((staffMember, index) => {
                const isActive = staffMember.isActive;
                const canWorkProgram = staffMember.canWorkProgram(program);
                const isAvailable = schedule.isStaffAvailable(staffMember.id, session, program);
                const hasWorkedWithStudent = schedule.hasStaffWorkedWithStudentToday(staffMember.id, student.id);
                const canDo1To1 = sessionRatio === '1:1' ? staffMember.canDo1To1Sessions() : true;
                
                console.log(`    Staff ${index + 1}: ${staffMember.name}`);
                console.log(`      Active: ${isActive}`);
                console.log(`      Can work ${program}: ${canWorkProgram}`);
                console.log(`      Available for ${session}: ${isAvailable}`);
                console.log(`      Already worked with student today: ${hasWorkedWithStudent}`);
                console.log(`      Can do 1:1 (if needed): ${canDo1To1}`);
                console.log(`      Overall eligible: ${isActive && canWorkProgram && isAvailable && !hasWorkedWithStudent && canDo1To1}`);
                console.log('      ---');
              });
            }
          } catch (error) {
            errors.push(`Error assigning ${student.name}: ${error.message}`);
            this.log(`✗ Error assigning ${student.name}: ${error.message}`);
          }
        }
      }
    }

    this.log(`\nAuto-assignment complete. Created ${newAssignments.length} assignments.`);
    
    // PHASE 2: Smart reallocation for unassigned students
    console.log('\n🔄 PHASE 2: Starting smart staff reallocation for unassigned students...');
    const reallocationResults = await this.performStaffReallocation(schedule, staff, students);
    
    if (reallocationResults.swaps.length > 0) {
      newAssignments.push(...reallocationResults.newAssignments);
      this.log(`✅ Reallocation created ${reallocationResults.swaps.length} swaps and ${reallocationResults.newAssignments.length} new assignments`);
    }
    
    if (errors.length > 0) {
      this.log(`Errors: ${errors.length}`);
      errors.forEach(error => this.log(`  - ${error}`));
    }

    return { assignments: newAssignments, errors };
  }

  /**
   * Assign staff to a specific student
   * @param {Student} student - Student to assign
   * @param {string} session - AM or PM
   * @param {string} program - Primary or Secondary
   * @param {Staff[]} staff - Available staff
   * @param {Schedule} schedule - Current schedule
   * @returns {Assignment[]} Array of assignments created
   */
  async assignStudent(student, session, program, staff, schedule) {
    const assignments = [];

    // Determine how many staff this student needs
    const staffCount = this.getRequiredStaffCount(student);
    this.log(`${student.name} needs ${staffCount} staff (${student.ratio})`);

    if (student.isSmallGroup()) {
      // Handle 1:2 ratio (small group)
      return this.assignSmallGroupStudent(student, session, program, staff, schedule);
    } else {
      // Handle 1:1 or 2:1 ratios
      const availableStaff = SchedulingUtils.getAvailableStaffForStudent(
        student, session, program, staff, schedule
      );

      // FILTER TO ONLY TEAM MEMBERS - this ensures dropdown compatibility
      let teamStaff = availableStaff.filter(staffMember => 
        student.teamIds.includes(staffMember.id)
      );

      // STRICT PRIORITIZATION: Prefer direct service staff (RBTs/BSs) over support staff (EAs)
      const preferredTeamStaff = teamStaff.filter(staffMember => staffMember.isPreferredDirectService());
      const fallbackTeamStaff = teamStaff.filter(staffMember => staffMember.canDoDirectSessions() && !staffMember.isPreferredDirectService());
      
      console.log(`🔍 STAFF PRIORITIZATION for ${student.name} ${session}:`);
      console.log(`  Total team staff: ${teamStaff.length}`);
      console.log(`  Preferred (RBTs/BSs): ${preferredTeamStaff.length} - ${preferredTeamStaff.map(s => `${s.name}(${s.role})`).join(', ')}`);
      console.log(`  Fallback (EAs/etc): ${fallbackTeamStaff.length} - ${fallbackTeamStaff.map(s => `${s.name}(${s.role})`).join(', ')}`);

      // Use preferred staff first, only fallback if insufficient preferred staff
      if (preferredTeamStaff.length >= staffCount) {
        teamStaff = preferredTeamStaff;
        console.log(`✅ Using ONLY preferred staff for ${student.name}`);
      } else if (preferredTeamStaff.length > 0) {
        // Mix preferred + fallback only if we don't have enough preferred
        teamStaff = [...preferredTeamStaff, ...fallbackTeamStaff];
        console.log(`⚠️ Using preferred + fallback staff for ${student.name} (need ${staffCount}, have ${preferredTeamStaff.length} preferred)`);
      } else {
        // Only use fallback if no preferred staff available
        teamStaff = fallbackTeamStaff;
        console.log(`🚨 WARNING: Using ONLY fallback staff for ${student.name} (no preferred staff available)`);
      }

      this.log(`  Available staff: ${availableStaff.length}, Team staff: ${teamStaff.length} (after prioritization)`);
      
      // ENHANCED DEBUG: Show detailed team data for this student
      console.log(`🔍 DETAILED TEAM DEBUG for ${student.name}:`);
      console.log(`  Student team array:`, student.team);
      console.log(`  Student teamIds array:`, student.teamIds);
      console.log(`  Available staff IDs:`, availableStaff.map(s => `${s.name} (ID: ${s.id})`));
      console.log(`  Final team staff after filtering:`, teamStaff.map(s => `${s.name} (ID: ${s.id}, Role: ${s.role})`));
      
      if (teamStaff.length < staffCount) {
        this.log(`Insufficient team staff available. Need ${staffCount}, have ${teamStaff.length} team members`);
        this.log(`  Team IDs for ${student.name}:`, student.teamIds);
        this.log(`  Available team staff:`, teamStaff.map(s => `${s.name} (ID: ${s.id})`));
        
        // ENHANCED DEBUG: Show why staff aren't matching
        console.log(`🔍 TEAM MATCHING DEBUG for ${student.name}:`);
        console.log(`  Student needs ${staffCount} staff members`);
        console.log(`  Student's team IDs:`, student.teamIds);
        
        availableStaff.forEach(staffMember => {
          const isInTeam = student.teamIds.includes(staffMember.id);
          const canDoDirect = staffMember.canDoDirectSessions();
          const isPreferred = staffMember.isPreferredDirectService();
          const isAvailable = true; // already filtered in availableStaff
          
          console.log(`  📋 Staff ${staffMember.name}:`);
          console.log(`    ID: ${staffMember.id}, Role: ${staffMember.role}`);
          console.log(`    In Team: ${isInTeam}, Can Do Direct: ${canDoDirect}, Is Preferred: ${isPreferred}`);
          console.log(`    Available: ${isAvailable}`);
          
          // Special check for Logan
          if (student.name.toLowerCase().includes('logan') && staffMember.role === 'BS') {
            console.log(`🚨 LOGAN + BS DEBUG: ${staffMember.name} should be prioritized over EAs!`);
          }
        });
        
        // SPECIAL DEBUG for specific student names like Asen or Logan
        if (student.name.toLowerCase().includes('asen') || student.name.toLowerCase().includes('logan')) {
          console.log(`🚨 SPECIAL DEBUG for ${student.name}:`);
          console.log(`  This student has insufficient team staff!`);
          console.log(`  Check if their team is properly configured in SharePoint`);
          console.log(`  Student team array:`, student.team);
          console.log(`  Student teamIds:`, student.teamIds);
        }
        
        return [];
      }

      // IMPROVED PM SHUFFLING: Add randomization for PM sessions to better distribute workload
      const sortedStaff = this.sortStaffForStudentWithShuffling(student, teamStaff, session);

      // Assign the required number of staff
      for (let i = 0; i < staffCount && i < sortedStaff.length; i++) {
        const assignment = new Assignment({
          id: SchedulingUtils.generateAssignmentId(),
          staffId: sortedStaff[i].id,
          studentId: student.id,
          session,
          program,
          date: schedule.date,
          isLocked: false,
          assignedBy: 'auto'
        });

        // Validate assignment
        const validationErrors = SchedulingRules.validateAssignment(
          assignment, schedule, staff, [student]
        );

        if (validationErrors.length === 0) {
          assignments.push(assignment);
          this.log(`  Assigned ${sortedStaff[i].name} to ${student.name}`);
        } else {
          this.log(`  Cannot assign ${sortedStaff[i].name}: ${validationErrors.join(', ')}`);
        }
      }
    }

    return assignments;
  }

  /**
   * Handle small group (1:2) student assignment
   * @param {Student} student - Student needing assignment
   * @param {string} session - AM or PM
   * @param {string} program - Primary or Secondary
   * @param {Staff[]} staff - Available staff
   * @param {Schedule} schedule - Current schedule
   * @returns {Assignment[]} Array of assignments created
   */
  assignSmallGroupStudent(student, session, program, staff, schedule) {
    // For 1:2 ratio, try to find a staff member who is already assigned
    // to another 1:2 student in the same session, or assign a new staff member
    
    // Defensive check: ensure schedule has the required method
    if (typeof schedule.getAssignmentsForSession !== 'function') {
      console.error('Schedule object missing getAssignmentsForSession method', schedule);
      return [];
    }
    
    const sessionAssignments = schedule.getAssignmentsForSession(session, program);
    
    // Look for existing 1:2 groups that can accommodate this student
    for (const assignment of sessionAssignments) {
      const assignedStudent = this.findStudentById(assignment.studentId);
      if (assignedStudent && assignedStudent.isSmallGroup()) {
        // Check if this staff member can take another student
        const staffAssignmentsInSession = sessionAssignments.filter(
          a => a.staffId === assignment.staffId
        );
        
        if (staffAssignmentsInSession.length === 1) { // Staff has room for one more
          const staffMember = staff.find(s => s.id === assignment.staffId);
          if (staffMember && this.canStaffWorkWithStudent(staffMember, student, schedule)) {
            const newAssignment = new Assignment({
              id: SchedulingUtils.generateAssignmentId(),
              staffId: assignment.staffId,
              studentId: student.id,
              session,
              program,
              date: schedule.date,
              isLocked: false,
              assignedBy: 'auto'
            });
            
            this.log(`  Added ${student.name} to existing small group with ${staffMember.name}`);
            return [newAssignment];
          }
        }
      }
    }

    // No existing group found, assign new staff
    const availableStaff = SchedulingUtils.getAvailableStaffForStudent(
      student, session, program, staff, schedule
    );

    // FILTER TO ONLY TEAM MEMBERS - this ensures dropdown compatibility
    let teamStaff = availableStaff.filter(staffMember => 
      student.teamIds.includes(staffMember.id)
    );

    // ADDITIONAL FILTERING: Only use preferred direct service staff (RBTs/BSs)
    const preferredTeamStaff = teamStaff.filter(staffMember => staffMember.isPreferredDirectService());
    
    // Use preferred staff if available, otherwise fall back to all team staff who can do direct sessions
    teamStaff = preferredTeamStaff.length > 0 ? preferredTeamStaff : teamStaff.filter(staffMember => staffMember.canDoDirectSessions());

    if (teamStaff.length > 0) {
      const sortedStaff = this.sortStaffForStudentWithShuffling(student, teamStaff, session);
      const assignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: sortedStaff[0].id,
        studentId: student.id,
        session,
        program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto'
      });

      this.log(`  Started new small group with ${sortedStaff[0].name} for ${student.name}`);
      return [assignment];
    }

    return [];
  }

  /**
   * Sort staff by preference for a specific student
   * @param {Student} student - Student to assign
   * @param {Staff[]} availableStaff - Staff available for assignment
   * @returns {Staff[]} Sorted staff array
   */
  sortStaffForStudent(student, availableStaff) {
    return [...availableStaff].sort((a, b) => {
      // Team members first (staff assigned to this student's team)
      const aIsTeamMember = student.teamIds.includes(a.id);
      const bIsTeamMember = student.teamIds.includes(b.id);
      if (aIsTeamMember && !bIsTeamMember) return -1;
      if (!aIsTeamMember && bIsTeamMember) return 1;

      // Preferred direct service providers first (RBTs/BSs over EAs)
      const aIsPreferred = a.isPreferredDirectService();
      const bIsPreferred = b.isPreferredDirectService();
      if (aIsPreferred && !bIsPreferred) return -1;
      if (!aIsPreferred && bIsPreferred) return 1;

      // Then by hierarchy (lower level = higher priority)
      const aLevel = a.getRoleLevel();
      const bLevel = b.getRoleLevel();
      if (aLevel !== bLevel) return aLevel - bLevel;

      // Then alphabetically by name for consistency
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Enhanced staff sorting with session-based shuffling for better PM distribution
   * @param {Student} student - Student to assign
   * @param {Staff[]} availableStaff - Available staff members
   * @param {string} session - 'AM' or 'PM'
   * @returns {Staff[]} Sorted staff array
   */
  sortStaffForStudentWithShuffling(student, availableStaff, session) {
    // PRIORITY 1: Only use preferred direct service providers (RBTs, BSs) if available
    const preferredStaff = availableStaff.filter(staff => staff.isPreferredDirectService());
    
    console.log(`🔍 STAFF PRIORITY DEBUG for ${student.name}:`);
    console.log(`  Total team staff: ${availableStaff.length}`);
    console.log(`  Preferred staff (RBTs/BSs): ${preferredStaff.length}`);
    console.log(`  Preferred staff list:`, preferredStaff.map(s => `${s.name} (${s.role})`));
    
    // Use preferred staff if available, otherwise fall back to all available staff
    const staffToUse = preferredStaff.length > 0 ? preferredStaff : availableStaff;
    
    if (preferredStaff.length === 0) {
      console.log(`⚠️ WARNING: No preferred staff (RBTs/BSs) available for ${student.name}, using fallback staff`);
    }

    // For AM sessions, use standard hierarchy-based sorting
    if (session === 'AM') {
      return this.sortStaffForStudent(student, staffToUse);
    }

    // For PM sessions, add shuffling to better distribute workload
    const staffWithPriority = [...staffToUse].map(staff => ({
      staff,
      isTeamMember: student.teamIds.includes(staff.id),
      roleLevel: staff.getRoleLevel(),
      isPreferred: staff.isPreferredDirectService(),
      // Add slight randomization for PM to encourage different assignments
      randomFactor: Math.random() * 0.5 // Small random factor (0-0.5)
    }));

    return staffWithPriority.sort((a, b) => {
      // Team members first
      if (a.isTeamMember && !b.isTeamMember) return -1;
      if (!a.isTeamMember && b.isTeamMember) return 1;

      // Preferred direct service providers first (RBTs/BSs over EAs)
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;

      // Within same preference level, mix hierarchy with slight randomization for PM
      const aScore = a.roleLevel + a.randomFactor;
      const bScore = b.roleLevel + b.randomFactor;
      
      if (Math.abs(aScore - bScore) > 0.1) {
        return aScore - bScore;
      }

      // If very close, alphabetical for consistency
      return a.staff.name.localeCompare(b.staff.name);
    }).map(item => item.staff);
  }

  /**
   * Prioritize students for assignment (2:1 ratio first, etc.)
   * @param {Student[]} students - Students to prioritize
   * @returns {Student[]} Sorted students array
   */
  prioritizeStudents(students) {
    return [...students].sort((a, b) => {
      // 2:1 ratio students first (they need more staff)
      if (a.requiresMultipleStaff() && !b.requiresMultipleStaff()) return -1;
      if (!a.requiresMultipleStaff() && b.requiresMultipleStaff()) return 1;

      // Then by team size (students with smaller teams get priority to ensure coverage)
      const aTeamSize = a.teamIds.length;
      const bTeamSize = b.teamIds.length;
      if (aTeamSize !== bTeamSize) return aTeamSize - bTeamSize;

      // Then alphabetically for consistency
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get the number of staff required for a student based on their ratio
   * @param {Student} student - Student to check
   * @returns {number} Number of staff needed
   */
  getRequiredStaffCount(student) {
    switch (student.ratio) {
      case RATIOS.TWO_TO_ONE:
        return 2;
      case RATIOS.ONE_TO_ONE:
      case RATIOS.ONE_TO_TWO:
      default:
        return 1;
    }
  }

  /**
   * Check if a student is already assigned for a session
   * @param {number} studentId - Student ID
   * @param {string} session - AM or PM
   * @param {string} program - Primary or Secondary
   * @param {Schedule} schedule - Current schedule
   * @returns {boolean} True if student is already assigned
   */
  isStudentAssigned(studentId, session, program, schedule) {
    // Defensive check: ensure schedule has the required method
    if (typeof schedule.getAssignmentsForSession !== 'function') {
      console.error('Schedule object missing getAssignmentsForSession method', schedule);
      return false;
    }
    
    const sessionAssignments = schedule.getAssignmentsForSession(session, program);
    return sessionAssignments.some(assignment => assignment.studentId === studentId);
  }

  /**
   * Check if staff can work with a specific student
   * @param {Staff} staff - Staff member
   * @param {Student} student - Student
   * @param {Schedule} schedule - Current schedule
   * @returns {boolean} True if staff can work with student
   */
  canStaffWorkWithStudent(staff, student, schedule) {
    // Check if staff has already worked with this student today
    if (schedule.hasStaffWorkedWithStudentToday(staff.id, student.id)) {
      return false;
    }

    // Note: excludedStaff validation removed - now using team-based assignments

    return true;
  }

  /**
   * Find student by ID (helper method)
   * @param {number} studentId - Student ID to find
   * @returns {Student|null} Student object or null
   */
  findStudentById(studentId) {
    // This would typically be passed in or accessed from a service
    // For now, return null as this is just for the small group logic
    return null;
  }

  /**
   * Optimize assignments after initial auto-assignment
   * @param {Schedule} schedule - Current schedule
   * @param {Staff[]} staff - Available staff
   * @param {Student[]} students - Students
   * @returns {Assignment[]} Optimized assignments
   */
  optimizeAssignments(schedule, staff, students) {
    // Future enhancement: implement optimization logic
    // Could include:
    // - Balancing workloads across staff
    // - Ensuring preferred staff-student pairings when possible
    // - Minimizing conflicts and maximizing satisfaction scores
    
    this.log('Assignment optimization not yet implemented');
    return schedule.assignments;
  }

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Log debug information
   * @param {string} message - Message to log
   */
  log(message) {
    if (this.debugMode) {
      console.log(`[AutoAssignment] ${message}`);
    }
  }

  /**
   * Generate assignment statistics
   * @param {Schedule} schedule - Schedule to analyze
   * @param {Staff[]} staff - Staff members
   * @param {Student[]} students - Students
   * @returns {Object} Statistics object
   */
  generateStats(schedule, staff, students) {
    const stats = {
      totalAssignments: schedule.assignments.length,
      staffUtilization: {},
      unassignedStudents: [],
      assignmentsBySession: {},
      ratioDistribution: {}
    };

    // Calculate staff utilization
    const activeStaff = staff.filter(s => s.isActive);
    activeStaff.forEach(staffMember => {
      const assignments = schedule.getStaffAssignments(staffMember.id);
      stats.staffUtilization[staffMember.name] = {
        assignmentCount: assignments.length,
        utilizationRate: assignments.length / 2 // 2 sessions per day
      };
    });

    // Find unassigned students
    const activeStudents = students.filter(s => s.isActive);
    activeStudents.forEach(student => {
      const assignments = schedule.getStudentAssignments(student.id);
      const requiredAssignments = 2; // AM and PM sessions
      if (assignments.length < requiredAssignments) {
        stats.unassignedStudents.push({
          name: student.name,
          assignmentCount: assignments.length,
          requiredCount: requiredAssignments
        });
      }
    });

    // Assignments by session
    ['AM', 'PM'].forEach(session => {
      [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY].forEach(program => {
        const key = `${program}_${session}`;
        // Defensive check: ensure schedule has the required method
        if (typeof schedule.getAssignmentsForSession === 'function') {
          stats.assignmentsBySession[key] = schedule.getAssignmentsForSession(session, program).length;
        } else {
          stats.assignmentsBySession[key] = 0;
          console.error('Schedule object missing getAssignmentsForSession method in stats collection');
        }
      });
    });

    // Ratio distribution
    Object.values(RATIOS).forEach(ratio => {
      const count = activeStudents.filter(s => s.ratio === ratio).length;
      stats.ratioDistribution[ratio] = count;
    });

    return stats;
  }

  /**
   * Assign staff to paired students (they should get the same staff)
   * @param {Student} student1 - First paired student
   * @param {Student} student2 - Second paired student
   * @param {string} session - AM or PM
   * @param {string} program - Primary or Secondary
   * @param {Staff[]} staff - Available staff
   * @param {Schedule} schedule - Current schedule
   * @returns {Assignment[]} Array of assignments created
   */
  async assignPairedStudents(student1, student2, session, program, staff, schedule) {
    const assignments = [];
    this.log(`Assigning paired students: ${student1.name} and ${student2.name}`);

    // Check if either student is already assigned in this session
    if (this.isStudentAssigned(student1.id, session, program, schedule) ||
        this.isStudentAssigned(student2.id, session, program, schedule)) {
      this.log(`One of the paired students is already assigned`);
      return [];
    }

    // Get the combined staff requirements for both students
    const student1StaffCount = this.getRequiredStaffCount(student1);
    const student2StaffCount = this.getRequiredStaffCount(student2);
    const totalStaffNeeded = student1StaffCount + student2StaffCount;

    this.log(`Paired students need ${student1StaffCount} + ${student2StaffCount} = ${totalStaffNeeded} staff total`);

    // Get available staff that can work with both students
    const availableStaff = SchedulingUtils.getAvailableStaffForStudent(
      student1, session, program, staff, schedule
    ).filter(staffMember => 
      // Staff must be able to work with both students' programs
      this.canStaffWorkWithStudent(staffMember, student2, schedule)
    );

    if (availableStaff.length < totalStaffNeeded) {
      this.log(`Insufficient staff for paired students. Need ${totalStaffNeeded}, have ${availableStaff.length}`);
      return [];
    }

    // Sort staff by hierarchy and preferences
    const sortedStaff = this.sortStaffForStudent(student1, availableStaff);

    // For paired students, they should share the same staff
    // This is different from the regular assignment where each student gets their own staff
    let staffIndex = 0;

    // Check if both students have 1:2 ratio (small group)
    if (student1.isSmallGroup() && student2.isSmallGroup()) {
      // Both students are 1:2 ratio - they should share the same staff member
      this.log(`Both students are 1:2 ratio - assigning same staff to both`);
      
      if (sortedStaff.length === 0) {
        this.log(`No available staff for paired 1:2 students`);
        return [];
      }

      const sharedStaffMember = sortedStaff[0];
      
      // Create assignment for first student
      const assignment1 = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: sharedStaffMember.id,
        studentId: student1.id,
        session,
        program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-paired'
      });

      // Create assignment for second student with SAME staff
      const assignment2 = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: sharedStaffMember.id,
        studentId: student2.id,
        session,
        program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-paired'
      });

      // Validate both assignments
      const validationErrors1 = SchedulingRules.validateAssignment(
        assignment1, schedule, staff, [student1, student2]
      );
      const validationErrors2 = SchedulingRules.validateAssignment(
        assignment2, schedule, staff, [student1, student2]
      );

      if (validationErrors1.length === 0 && validationErrors2.length === 0) {
        assignments.push(assignment1, assignment2);
        this.log(`  Assigned ${sharedStaffMember.name} to both ${student1.name} and ${student2.name} (shared 1:2)`);
      } else {
        this.log(`  Cannot assign ${sharedStaffMember.name} to paired students: ${[...validationErrors1, ...validationErrors2].join(', ')}`);
        return [];
      }
    } else {
      // Handle other ratios (1:1, 2:1) - assign same staff to both but may need multiple staff for 2:1
      this.log(`Assigning staff for ratios: ${student1.getSessionRatio(session)} and ${student2.getSessionRatio(session)}`);
      
      // For simplicity, assign the same staff to both students
      // If they need multiple staff (2:1), assign the same set of staff to both
      const maxStaffNeeded = Math.max(student1StaffCount, student2StaffCount);
      
      for (let i = 0; i < maxStaffNeeded && i < sortedStaff.length; i++) {
        const staffMember = sortedStaff[i];
        
        // Assign to first student if they need this many staff
        if (i < student1StaffCount) {
          const assignment1 = new Assignment({
            id: SchedulingUtils.generateAssignmentId(),
            staffId: staffMember.id,
            studentId: student1.id,
            session,
            program,
            date: schedule.date,
            isLocked: false,
            assignedBy: 'auto-paired'
          });

          const validationErrors1 = SchedulingRules.validateAssignment(
            assignment1, schedule, staff, [student1, student2]
          );

          if (validationErrors1.length === 0) {
            assignments.push(assignment1);
            this.log(`  Assigned ${staffMember.name} to ${student1.name} (paired)`);
          } else {
            this.log(`  Cannot assign ${staffMember.name} to ${student1.name}: ${validationErrors1.join(', ')}`);
            return [];
          }
        }

        // Assign SAME staff to second student if they need this many staff
        if (i < student2StaffCount) {
          const assignment2 = new Assignment({
            id: SchedulingUtils.generateAssignmentId(),
            staffId: staffMember.id,
            studentId: student2.id,
            session,
            program,
            date: schedule.date,
            isLocked: false,
            assignedBy: 'auto-paired'
          });

          const validationErrors2 = SchedulingRules.validateAssignment(
            assignment2, schedule, staff, [student1, student2]
          );

          if (validationErrors2.length === 0) {
            assignments.push(assignment2);
            this.log(`  Assigned ${staffMember.name} to ${student2.name} (paired)`);
          } else {
            this.log(`  Cannot assign ${staffMember.name} to ${student2.name}: ${validationErrors2.join(', ')}`);
            return [];
          }
        }
      }
    }

    // Ensure both students got their required staff
    const student1Assignments = assignments.filter(a => a.studentId === student1.id);
    const student2Assignments = assignments.filter(a => a.studentId === student2.id);

    if (student1Assignments.length === student1StaffCount && 
        student2Assignments.length === student2StaffCount) {
      this.log(`Successfully assigned ${assignments.length} staff to paired students`);
      return assignments;
    } else {
      this.log(`Failed to assign sufficient staff to paired students`);
      return [];
    }
  }

  /**
   * Perform intelligent staff reallocation to help unassigned students
   * @param {Schedule} schedule - Current schedule
   * @param {Staff[]} staff - Array of staff members
   * @param {Student[]} students - Array of students
   * @returns {Object} Reallocation results with swaps and new assignments
   */
  async performStaffReallocation(schedule, staff, students) {
    console.log('🔄 Starting multi-layered staff reallocation analysis...');
    
    const allSwaps = [];
    const allNewAssignments = [];
    const sessions = ['AM', 'PM'];
    const programs = [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY];

    // Multiple passes to handle cascading assignments
    const maxPasses = 3;
    let passNumber = 1;

    while (passNumber <= maxPasses) {
      console.log(`\n🔄 REALLOCATION PASS ${passNumber}/${maxPasses}`);
      let foundSwapsThisPass = false;

      for (const program of programs) {
        for (const session of sessions) {
          console.log(`\n🔍 Pass ${passNumber}: Analyzing ${program} ${session}...`);
          
          // Find unassigned students who need help
          const unassignedStudents = students.filter(student => 
            student.isActive && 
            student.program === program && 
            !this.isStudentAssigned(student.id, session, program, schedule)
          );

          if (unassignedStudents.length === 0) {
            console.log(`  ✅ No unassigned students in ${program} ${session}`);
            continue;
          }

          console.log(`  📋 Found ${unassignedStudents.length} unassigned students:`, unassignedStudents.map(s => s.name));

          // Try different reallocation strategies
          for (const unassignedStudent of unassignedStudents) {
            console.log(`\n🎯 Pass ${passNumber}: Finding solutions for ${unassignedStudent.name}...`);
            
            // Strategy 1: Direct assignment with available preferred staff
            const directAssignment = await this.attemptDirectAssignment(unassignedStudent, session, program, staff, schedule);
            if (directAssignment.success) {
              allNewAssignments.push(...directAssignment.assignments);
              directAssignment.assignments.forEach(assignment => schedule.addAssignment(assignment));
              console.log(`  ✅ DIRECT: Assigned ${directAssignment.description}`);
              foundSwapsThisPass = true;
              continue;
            }

            // Strategy 2: Simple swap (existing logic)
            const simpleSwap = await this.attemptSimpleSwap(unassignedStudent, session, program, staff, schedule, students);
            if (simpleSwap.success) {
              allSwaps.push(simpleSwap.swap);
              allNewAssignments.push(...simpleSwap.newAssignments);
              simpleSwap.newAssignments.forEach(assignment => schedule.addAssignment(assignment));
              schedule.removeAssignment(simpleSwap.removedAssignment.id);
              console.log(`  ✅ SIMPLE SWAP: ${simpleSwap.swap.description}`);
              foundSwapsThisPass = true;
              continue;
            }

            // Strategy 3: Chain reassignment (new advanced logic)
            const chainReassignment = await this.attemptChainReassignment(unassignedStudent, session, program, staff, students, schedule);
            if (chainReassignment.success) {
              allSwaps.push(...chainReassignment.swaps);
              allNewAssignments.push(...chainReassignment.newAssignments);
              chainReassignment.changes.forEach(change => {
                if (change.type === 'add') {
                  schedule.addAssignment(change.assignment);
                } else if (change.type === 'remove') {
                  schedule.removeAssignment(change.assignmentId);
                }
              });
              console.log(`  ✅ CHAIN: ${chainReassignment.description}`);
              foundSwapsThisPass = true;
              continue;
            }

            // Strategy 4: Cross-session reallocation (move staff from other session)
            const crossSessionMove = await this.attemptCrossSessionReallocation(unassignedStudent, session, program, staff, students, schedule);
            if (crossSessionMove.success) {
              allSwaps.push(...crossSessionMove.swaps);
              allNewAssignments.push(...crossSessionMove.newAssignments);
              crossSessionMove.changes.forEach(change => {
                if (change.type === 'add') {
                  schedule.addAssignment(change.assignment);
                } else if (change.type === 'remove') {
                  schedule.removeAssignment(change.assignmentId);
                }
              });
              console.log(`  ✅ CROSS-SESSION: ${crossSessionMove.description}`);
              foundSwapsThisPass = true;
              continue;
            }

            console.log(`  ❌ No solution found for ${unassignedStudent.name} in pass ${passNumber}`);
          }
        }
      }

      if (!foundSwapsThisPass) {
        console.log(`\n🔄 No changes in pass ${passNumber}, stopping reallocation`);
        break;
      }

      passNumber++;
    }

    console.log(`\n🎯 Multi-layered reallocation complete: ${allSwaps.length} swaps executed across ${passNumber - 1} passes`);
    allSwaps.forEach(swap => console.log(`  ✅ ${swap.description}`));

    return { swaps: allSwaps, newAssignments: allNewAssignments };
  }

  /**
   * Validate if a staff swap is possible and beneficial
   */
  async validateStaffSwap(originalAssignment, currentStaff, replacementStaff, unassignedStudent, schedule, staff, students) {
    // Check if replacement staff can work with the currently assigned student
    const assignedStudent = students.find(s => s.id === originalAssignment.studentId);
    if (!assignedStudent) return false;

    // Validate replacement assignment
    const replacementAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: replacementStaff.id,
      studentId: assignedStudent.id,
      session: originalAssignment.session,
      program: originalAssignment.program,
      date: schedule.date,
      isLocked: false,
      assignedBy: 'auto-swap'
    });

    const replacementErrors = SchedulingRules.validateAssignment(
      replacementAssignment, schedule, staff, [assignedStudent]
    );

    if (replacementErrors.length > 0) {
      console.log(`      ❌ Replacement validation failed: ${replacementErrors.join(', ')}`);
      return false;
    }

    // Validate new assignment for unassigned student
    const newAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: currentStaff.id,
      studentId: unassignedStudent.id,
      session: originalAssignment.session,
      program: originalAssignment.program,
      date: schedule.date,
      isLocked: false,
      assignedBy: 'auto-swap'
    });

    const newAssignmentErrors = SchedulingRules.validateAssignment(
      newAssignment, schedule, staff, [unassignedStudent]
    );

    if (newAssignmentErrors.length > 0) {
      console.log(`      ❌ New assignment validation failed: ${newAssignmentErrors.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Execute a validated staff swap
   */
  async executeStaffSwap(originalAssignment, currentStaff, replacementStaff, unassignedStudent, session, program, schedule) {
    try {
      // Find the student who is currently assigned
      const assignedStudentId = originalAssignment.studentId;
      
      // Create replacement assignment
      const replacementAssignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: replacementStaff.id,
        studentId: assignedStudentId,
        session: session,
        program: program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-swap'
      });

      // Create new assignment for unassigned student
      const newAssignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: currentStaff.id,
        studentId: unassignedStudent.id,
        session: session,
        program: program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-swap'
      });

      const swap = {
        originalAssignment: originalAssignment,
        replacementAssignment: replacementAssignment,
        newAssignment: newAssignment,
        unassignedStudent: unassignedStudent.name,
        description: `${replacementStaff.name}(${replacementStaff.role}) → Student${assignedStudentId}, ${currentStaff.name}(${currentStaff.role}) → ${unassignedStudent.name}`
      };

      return {
        success: true,
        swap: swap,
        newAssignments: [replacementAssignment, newAssignment]
      };
    } catch (error) {
      console.log(`      ❌ Swap execution failed: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Strategy 1: Attempt direct assignment with available preferred staff
   */
  async attemptDirectAssignment(unassignedStudent, session, program, staff, schedule) {
    console.log(`    🎯 Strategy 1: Direct assignment for ${unassignedStudent.name}`);
    
    // Get available preferred staff who are on this student's team
    const availableTeamStaff = staff.filter(staffMember => {
      return staffMember.isActive &&
             staffMember.canWorkProgram(program) &&
             staffMember.isPreferredDirectService() &&
             unassignedStudent.teamIds.includes(staffMember.id) &&
             schedule.isStaffAvailable(staffMember.id, session, program);
    });

    if (availableTeamStaff.length > 0) {
      const bestStaff = availableTeamStaff[0];
      const assignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: bestStaff.id,
        studentId: unassignedStudent.id,
        session: session,
        program: program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-direct'
      });

      console.log(`      ✅ Direct assignment: ${bestStaff.name}(${bestStaff.role}) → ${unassignedStudent.name}`);
      return {
        success: true,
        assignments: [assignment],
        description: `${bestStaff.name}(${bestStaff.role}) → ${unassignedStudent.name}`
      };
    }

    console.log(`      ❌ No available team staff for direct assignment`);
    return { success: false };
  }

  /**
   * Strategy 2: Attempt simple swap (existing logic refactored)
   */
  async attemptSimpleSwap(unassignedStudent, session, program, staff, schedule, students) {
    console.log(`    🎯 Strategy 2: Simple swap for ${unassignedStudent.name}`);
    
    const availablePreferredStaff = staff.filter(staffMember => {
      return staffMember.isActive &&
             staffMember.canWorkProgram(program) &&
             staffMember.isPreferredDirectService() &&
             schedule.isStaffAvailable(staffMember.id, session, program);
    });

    if (availablePreferredStaff.length === 0) {
      console.log(`      ❌ No available preferred staff for swapping`);
      return { success: false };
    }

    const currentAssignments = schedule.getAssignmentsForSession(session, program);
    
    for (const assignment of currentAssignments) {
      const assignedStaff = staff.find(s => s.id === assignment.staffId);
      const assignedStudent = students.find(s => s.id === assignment.studentId);
      
      if (!assignedStaff || !assignedStudent) continue;

      const isOnUnassignedTeam = unassignedStudent.teamIds.includes(assignedStaff.id);
      if (!isOnUnassignedTeam) continue;

      for (const preferredStaff of availablePreferredStaff) {
        const canWorkWithAssignedStudent = assignedStudent.teamIds.includes(preferredStaff.id);
        
        if (canWorkWithAssignedStudent) {
          const swapValid = await this.validateStaffSwap(
            assignment, assignedStaff, preferredStaff, unassignedStudent, schedule, staff, students
          );

          if (swapValid) {
            const swapResult = await this.executeStaffSwap(
              assignment, assignedStaff, preferredStaff, unassignedStudent, 
              session, program, schedule
            );

            if (swapResult.success) {
              console.log(`      ✅ Simple swap: ${swapResult.swap.description}`);
              return {
                success: true,
                swap: swapResult.swap,
                newAssignments: swapResult.newAssignments,
                removedAssignment: assignment
              };
            }
          }
        }
      }
    }

    console.log(`      ❌ No simple swap opportunities found`);
    return { success: false };
  }

  /**
   * Strategy 3: Attempt chain reassignment (multi-level shuffling)
   */
  async attemptChainReassignment(unassignedStudent, session, program, staff, students, schedule) {
    console.log(`    🎯 Strategy 3: Chain reassignment for ${unassignedStudent.name}`);
    
    // Look for chain opportunities: A works with B, C could work with B, freeing A for unassigned student
    const currentAssignments = schedule.getAssignmentsForSession(session, program);
    const availableStaff = staff.filter(s => 
      s.isActive && 
      s.canWorkProgram(program) && 
      schedule.isStaffAvailable(s.id, session, program)
    );

    for (const assignment1 of currentAssignments) {
      const staff1 = staff.find(s => s.id === assignment1.staffId);
      const student1 = students.find(s => s.id === assignment1.studentId);
      
      if (!staff1 || !student1) continue;
      if (!unassignedStudent.teamIds.includes(staff1.id)) continue;

      console.log(`      🔗 Checking chain with ${staff1.name} → ${student1.name}`);

      // Find if any available staff can replace staff1 with student1
      for (const replacementStaff of availableStaff) {
        if (!student1.teamIds.includes(replacementStaff.id)) continue;
        if (!replacementStaff.isPreferredDirectService()) continue;

        console.log(`        🔍 Potential replacement: ${replacementStaff.name} could work with ${student1.name}`);

        // Check if this creates a valid chain
        const chainValid = await this.validateChainReassignment(
          assignment1, staff1, replacementStaff, unassignedStudent, schedule, staff, students
        );

        if (chainValid) {
          const chainResult = await this.executeChainReassignment(
            assignment1, staff1, replacementStaff, unassignedStudent, session, program, schedule
          );

          if (chainResult.success) {
            console.log(`      ✅ Chain executed: ${chainResult.description}`);
            return chainResult;
          }
        }
      }
    }

    console.log(`      ❌ No chain reassignment opportunities found`);
    return { success: false };
  }

  /**
   * Strategy 4: Cross-session reallocation (move staff from other session if possible)
   */
  async attemptCrossSessionReallocation(unassignedStudent, session, program, staff, students, schedule) {
    console.log(`    🎯 Strategy 4: Cross-session reallocation for ${unassignedStudent.name}`);
    
    const otherSession = session === 'AM' ? 'PM' : 'AM';
    const otherSessionAssignments = schedule.getAssignmentsForSession(otherSession, program);

    for (const otherAssignment of otherSessionAssignments) {
      const otherStaff = staff.find(s => s.id === otherAssignment.staffId);
      const otherStudent = students.find(s => s.id === otherAssignment.studentId);
      
      if (!otherStaff || !otherStudent) continue;
      if (!unassignedStudent.teamIds.includes(otherStaff.id)) continue;

      console.log(`      🔄 Checking if ${otherStaff.name} can move from ${otherSession} to ${session}`);

      // Check if this staff member is available in the target session
      if (!schedule.isStaffAvailable(otherStaff.id, session, program)) {
        console.log(`        ❌ ${otherStaff.name} not available in ${session}`);
        continue;
      }

      // Find replacement for other session
      const availableForOtherSession = staff.filter(s => 
        s.isActive && 
        s.canWorkProgram(program) && 
        s.isPreferredDirectService() &&
        otherStudent.teamIds.includes(s.id) &&
        schedule.isStaffAvailable(s.id, otherSession, program)
      );

      if (availableForOtherSession.length > 0) {
        const replacement = availableForOtherSession[0];
        console.log(`        ✅ Found replacement: ${replacement.name} for ${otherSession}`);

        const crossSessionResult = await this.executeCrossSessionReallocation(
          otherAssignment, otherStaff, replacement, unassignedStudent, 
          session, otherSession, program, schedule
        );

        if (crossSessionResult.success) {
          console.log(`      ✅ Cross-session reallocation: ${crossSessionResult.description}`);
          return crossSessionResult;
        }
      }
    }

    console.log(`      ❌ No cross-session reallocation opportunities found`);
    return { success: false };
  }

  /**
   * Validate chain reassignment
   */
  async validateChainReassignment(originalAssignment, currentStaff, replacementStaff, unassignedStudent, schedule, staff, students) {
    // Similar validation logic as simple swap but for chain
    const assignedStudent = students.find(s => s.id === originalAssignment.studentId);
    if (!assignedStudent) return false;

    // Validate replacement can work with current student
    const replacementAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: replacementStaff.id,
      studentId: assignedStudent.id,
      session: originalAssignment.session,
      program: originalAssignment.program,
      date: schedule.date,
      isLocked: false,
      assignedBy: 'auto-chain'
    });

    const replacementErrors = SchedulingRules.validateAssignment(
      replacementAssignment, schedule, staff, [assignedStudent]
    );

    if (replacementErrors.length > 0) return false;

    // Validate current staff can work with unassigned student
    const newAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: currentStaff.id,
      studentId: unassignedStudent.id,
      session: originalAssignment.session,
      program: originalAssignment.program,
      date: schedule.date,
      isLocked: false,
      assignedBy: 'auto-chain'
    });

    const newAssignmentErrors = SchedulingRules.validateAssignment(
      newAssignment, schedule, staff, [unassignedStudent]
    );

    return newAssignmentErrors.length === 0;
  }

  /**
   * Execute chain reassignment
   */
  async executeChainReassignment(originalAssignment, currentStaff, replacementStaff, unassignedStudent, session, program, schedule) {
    try {
      const assignedStudentId = originalAssignment.studentId;
      
      const replacementAssignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: replacementStaff.id,
        studentId: assignedStudentId,
        session: session,
        program: program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-chain'
      });

      const newAssignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: currentStaff.id,
        studentId: unassignedStudent.id,
        session: session,
        program: program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-chain'
      });

      return {
        success: true,
        swaps: [{
          type: 'chain',
          description: `Chain: ${replacementStaff.name}(${replacementStaff.role}) → Student${assignedStudentId}, ${currentStaff.name}(${currentStaff.role}) → ${unassignedStudent.name}`
        }],
        newAssignments: [replacementAssignment, newAssignment],
        changes: [
          { type: 'remove', assignmentId: originalAssignment.id },
          { type: 'add', assignment: replacementAssignment },
          { type: 'add', assignment: newAssignment }
        ],
        description: `${replacementStaff.name} → Student${assignedStudentId}, ${currentStaff.name} → ${unassignedStudent.name}`
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Execute cross-session reallocation
   */
  async executeCrossSessionReallocation(otherAssignment, staffToMove, replacement, unassignedStudent, targetSession, sourceSession, program, schedule) {
    try {
      const otherStudentId = otherAssignment.studentId;
      
      const replacementAssignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: replacement.id,
        studentId: otherStudentId,
        session: sourceSession,
        program: program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-cross'
      });

      const newAssignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: staffToMove.id,
        studentId: unassignedStudent.id,
        session: targetSession,
        program: program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto-cross'
      });

      return {
        success: true,
        swaps: [{
          type: 'cross-session',
          description: `Cross-session: ${replacement.name} → ${sourceSession}, ${staffToMove.name} → ${targetSession} with ${unassignedStudent.name}`
        }],
        newAssignments: [replacementAssignment, newAssignment],
        changes: [
          { type: 'remove', assignmentId: otherAssignment.id },
          { type: 'add', assignment: replacementAssignment },
          { type: 'add', assignment: newAssignment }
        ],
        description: `${staffToMove.name} moved from ${sourceSession} to ${targetSession} for ${unassignedStudent.name}`
      };
    } catch (error) {
      return { success: false };
    }
  }
}