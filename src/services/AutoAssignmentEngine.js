import { 
  Assignment, 
  PROGRAMS, 
  RATIOS, 
  SchedulingUtils, 
  SchedulingRules 
} from '../types/index.js';

/**
 * Auto-assignment algorithm for ABA scheduling
 * Handles intelligent staff-to-student assignments based on hierarchy, 
 * availability, ratios, and constraints
 */
export class AutoAssignmentEngine {
  constructor() {
    this.debugMode = false;
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

        // Sort students by priority (2:1 ratio first, then 1:1, then 1:2)
        const prioritizedStudents = this.prioritizeStudents(programStudents);

        // Assign each student
        for (const student of prioritizedStudents) {
          try {
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
              this.log(`✗ Could not assign ${student.name}`);
            }
          } catch (error) {
            errors.push(`Error assigning ${student.name}: ${error.message}`);
            this.log(`✗ Error assigning ${student.name}: ${error.message}`);
          }
        }
      }
    }

    this.log(`\nAuto-assignment complete. Created ${newAssignments.length} assignments.`);
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

      if (availableStaff.length < staffCount) {
        this.log(`Insufficient staff available. Need ${staffCount}, have ${availableStaff.length}`);
        return [];
      }

      // Sort staff by hierarchy and preferences
      const sortedStaff = this.sortStaffForStudent(student, availableStaff);

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

    if (availableStaff.length > 0) {
      const sortedStaff = this.sortStaffForStudent(student, availableStaff);
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
      // Preferred staff first
      const aPreferred = student.preferredStaff.includes(a.id);
      const bPreferred = student.preferredStaff.includes(b.id);
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;

      // Then by hierarchy (lower level = higher priority)
      const aLevel = a.getRoleLevel();
      const bLevel = b.getRoleLevel();
      if (aLevel !== bLevel) return aLevel - bLevel;

      // Then alphabetically by name for consistency
      return a.name.localeCompare(b.name);
    });
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

      // Then by preferred staff (students with specific needs first)
      const aHasPreferences = a.preferredStaff.length > 0;
      const bHasPreferences = b.preferredStaff.length > 0;
      if (aHasPreferences && !bHasPreferences) return -1;
      if (!aHasPreferences && bHasPreferences) return 1;

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

    // Check if student excludes this staff member
    if (student.excludedStaff.includes(staff.id)) {
      return false;
    }

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
        stats.assignmentsBySession[key] = schedule.getAssignmentsForSession(session, program).length;
      });
    });

    // Ratio distribution
    Object.values(RATIOS).forEach(ratio => {
      const count = activeStudents.filter(s => s.ratio === ratio).length;
      stats.ratioDistribution[ratio] = count;
    });

    return stats;
  }
}