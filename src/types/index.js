// Data models and types for ABA Scheduling System

// Staff role hierarchy (used for assignment priority)
export const STAFF_ROLES = {
  RBT: { level: 1, name: 'RBT' },
  BS: { level: 2, name: 'Behavior Specialist' },
  BCBA: { level: 3, name: 'BCBA' },
  EA: { level: 4, name: 'Educational Assistant' },
  MHA: { level: 5, name: 'Mental Health Assistant' },
  CC: { level: 6, name: 'Clinical Coordinator' },
  Trainer: { level: 7, name: 'Trainer' },
  Teacher: { level: 8, name: 'Teacher' },
  Director: { level: 9, name: 'Director' }
};

// Export ROLES as alias for backward compatibility
export const ROLES = STAFF_ROLES;

// Program types (Yes/No columns)
export const PROGRAMS = {
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary'
};

// Session times
export const SESSION_TIMES = {
  PRIMARY: {
    AM: { start: '8:45', end: '11:30' },
    PM: { start: '12:00', end: '15:00' }
  },
  SECONDARY: {
    AM: { start: '8:45', end: '12:00' },
    PM: { start: '12:30', end: '15:00' }
  }
};

// Ratio types
export const RATIOS = {
  ONE_TO_ONE: '1:1',
  TWO_TO_ONE: '2:1',
  ONE_TO_TWO: '1:2'
};

/**
 * Staff member data structure
 */
export class Staff {
  constructor({
    id,
    listItemId = null, // SharePoint list item ID for updates
    name,
    role,
    email = '',
    userId = null,
    staffPerson = null,
    primaryProgram = false, // Can be boolean or program string
    secondaryProgram = false, // Can be boolean or program string
    isActive = true,
    absentAM = false, // Absent for AM session
    absentPM = false, // Absent for PM session
    absentFullDay = false // Absent for full day (both sessions)
  }) {
    this.id = id;
    this.listItemId = listItemId; // For SharePoint updates
    this.name = name;
    this.role = role;
    this.email = email;
    this.userId = userId; // SharePoint User ID for People Picker
    this.staffPerson = staffPerson; // People Picker data
    
    // Handle both boolean and string values for program assignment
    if (typeof primaryProgram === 'string') {
      // If it's a string, convert to boolean and store the program
      this.primaryProgram = true;
      this.primaryProgramType = primaryProgram;
    } else {
      this.primaryProgram = primaryProgram; // Boolean for Yes/No column
      this.primaryProgramType = primaryProgram ? PROGRAMS.PRIMARY : null;
    }
    
    if (typeof secondaryProgram === 'string') {
      // If it's a string, convert to boolean and store the program
      this.secondaryProgram = true;
      this.secondaryProgramType = secondaryProgram;
    } else {
      this.secondaryProgram = secondaryProgram; // Boolean for Yes/No column
      this.secondaryProgramType = secondaryProgram ? PROGRAMS.SECONDARY : null;
    }
    
    this.isActive = isActive;
    
    // Attendance tracking
    this.absentFullDay = absentFullDay;
    this.absentAM = absentFullDay ? true : absentAM; // If full day absent, AM is also absent
    this.absentPM = absentFullDay ? true : absentPM; // If full day absent, PM is also absent
  }

  getRoleLevel() {
    return STAFF_ROLES[this.role]?.level || 0;
  }

  canWorkProgram(program) {
    if (program === PROGRAMS.PRIMARY || program === 'Primary') {
      return this.primaryProgram;
    } else if (program === PROGRAMS.SECONDARY || program === 'Secondary') {
      return this.secondaryProgram;
    }
    return false;
  }

  /**
   * Check if staff member is eligible for 1:1 sessions
   * Teachers, Trainers, Directors, and BCBAs should not do 1:1 sessions
   * @returns {boolean} True if staff can do 1:1 sessions
   */
  canDo1To1Sessions() {
    const restrictedRoles = ['Teacher', 'Trainer', 'Director', 'BCBA'];
    return !restrictedRoles.includes(this.role);
  }

  /**
   * Check if staff member is eligible for direct client sessions (all ratios)
   * Only RBTs and Behavior Specialists should do direct client work
   * @returns {boolean} True if staff can do direct client sessions
   */
  canDoDirectSessions() {
    const directServiceRoles = ['RBT', 'BS', 'Behavior Specialist', 'Senior RBT'];
    return directServiceRoles.includes(this.role);
  }

  /**
   * Check if staff member is available for a specific session
   * @param {string} session - 'AM' or 'PM'
   * @returns {boolean} True if staff is available (not absent)
   */
  isAvailableForSession(session) {
    if (!this.isActive) return false;
    if (this.absentFullDay) return false;
    if (session === 'AM') return !this.absentAM;
    if (session === 'PM') return !this.absentPM;
    return true;
  }

  /**
   * Get attendance status string
   * @returns {string} 'Present', 'Absent AM', 'Absent PM', or 'Absent Full Day'
   */
  getAttendanceStatus() {
    if (this.absentFullDay) return 'Absent Full Day';
    if (this.absentAM && this.absentPM) return 'Absent Full Day';
    if (this.absentAM) return 'Absent AM';
    if (this.absentPM) return 'Absent PM';
    return 'Present';
  }

  /**
   * Check if staff member is a preferred direct service provider
   * RBTs and BSs are preferred over EAs and other roles
   * @returns {boolean} True if staff is preferred for direct service
   */
  isPreferredDirectService() {
    const preferredRoles = ['RBT', 'BS', 'Behavior Specialist', 'Senior RBT'];
    return preferredRoles.includes(this.role);
  }
}

// Training status constants
export const TRAINING_STATUS = {
  CERTIFIED: 'certified', // Fully trained, can work solo
  OVERLAP_BCBA: 'overlap-bcba', // Needs BCBA overlaps
  OVERLAP_STAFF: 'overlap-staff', // Needs staff overlaps
  TRAINER: 'trainer', // Designated trainer for this student
  SOLO: 'solo' // Default - working independently (legacy/no training needed)
};

/**
 * Student/Kid data structure
 */
export class Student {
  constructor({
    id,
    name,
    program,
    ratio, // Backward compatibility - single ratio for both sessions
    ratioAM = RATIOS.ONE_TO_ONE, // Separate ratio for AM
    ratioPM = RATIOS.ONE_TO_ONE, // Separate ratio for PM
    isActive = true,
    team = [], // Team members (People Picker array)
    teamIds = [], // Array of staff IDs extracted from team
    pairedWith = null, // ID of paired student (for shared staff assignments)
    absentAM = false, // Absent for AM session
    absentPM = false, // Absent for PM session
    absentFullDay = false, // Absent for full day (both sessions)
    teamTrainingStatus = {} // Training status for each team member: { staffId: 'certified' | 'overlap-bcba' | 'overlap-staff' }
  }) {
    this.id = id;
    this.name = name;
    this.program = program; // PRIMARY or SECONDARY
    
    // Handle backward compatibility - if ratio is provided, use it for both sessions
    if (ratio) {
      this.ratioAM = ratio;
      this.ratioPM = ratio;
      this.ratio = ratio; // Keep for backward compatibility
    } else {
      this.ratioAM = ratioAM; // AM session ratio
      this.ratioPM = ratioPM; // PM session ratio
      this.ratio = ratioAM; // Default to AM ratio for backward compatibility
    }
    
    this.isActive = isActive;
    this.team = team; // Array of team members (People Picker data)
    this.teamIds = teamIds.length > 0 ? teamIds : team.map(t => t.id).filter(Boolean); // Extract IDs from team if not provided
    this.pairedWith = pairedWith; // ID of paired student for shared staff assignments
    
    // Attendance tracking
    this.absentFullDay = absentFullDay;
    this.absentAM = absentFullDay ? true : absentAM; // If full day absent, AM is also absent
    this.absentPM = absentFullDay ? true : absentPM; // If full day absent, PM is also absent
    
    // Training status tracking: { staffId: status }
    this.teamTrainingStatus = teamTrainingStatus || {};
  }

  requiresMultipleStaff(session = 'AM') {
    const ratio = session === 'AM' ? this.ratioAM : this.ratioPM;
    return ratio === RATIOS.TWO_TO_ONE;
  }

  getSessionRatio(session) {
    return session === 'AM' ? this.ratioAM : this.ratioPM;
  }

  isSmallGroup(session = 'AM') {
    const ratio = session === 'AM' ? this.ratioAM : this.ratioPM;
    return ratio === RATIOS.ONE_TO_TWO;
  }

  /**
   * Check if student is available for a specific session
   * @param {string} session - 'AM' or 'PM'
   * @returns {boolean} True if student is available (not absent)
   */
  isAvailableForSession(session) {
    if (!this.isActive) return false;
    if (this.absentFullDay) return false;
    if (session === 'AM') return !this.absentAM;
    if (session === 'PM') return !this.absentPM;
    return true;
  }

  /**
   * Get attendance status string
   * @returns {string} 'Present', 'Absent AM', 'Absent PM', or 'Absent Full Day'
   */
  getAttendanceStatus() {
    if (this.absentFullDay) return 'Absent Full Day';
    if (this.absentAM && this.absentPM) return 'Absent Full Day';
    if (this.absentAM) return 'Absent AM';
    if (this.absentPM) return 'Absent PM';
    return 'Present';
  }

  /**
   * Check if this student is paired with another student
   * @returns {boolean} True if student has a paired partner
   */
  isPaired() {
    return this.pairedWith !== null && this.pairedWith !== undefined;
  }

  /**
   * Get the paired student from a list of students
   * @param {Student[]} students - Array of all students
   * @returns {Student|null} The paired student or null if not found
   */
  getPairedStudent(students) {
    if (!this.isPaired()) return null;
    
    // Try both string and number comparison in case of type mismatch
    const found = students.find(s => s.id == this.pairedWith || s.id === this.pairedWith) || null;
    
    return found;
  }

  /**
   * Get training status for a specific staff member
   * @param {number|string} staffId - Staff member ID
   * @returns {string} Training status ('certified', 'overlap-bcba', 'overlap-staff', or 'solo')
   */
  getStaffTrainingStatus(staffId) {
    return this.teamTrainingStatus[staffId] || TRAINING_STATUS.SOLO;
  }

  /**
   * Update training status for a staff member
   * @param {number|string} staffId - Staff member ID
   * @param {string} status - New training status
   */
  setStaffTrainingStatus(staffId, status) {
    this.teamTrainingStatus[staffId] = status;
  }

  /**
   * Check if a staff member is fully certified for this student
   * @param {number|string} staffId - Staff member ID
   * @returns {boolean} True if staff is certified
   */
  isStaffCertified(staffId) {
    const status = this.getStaffTrainingStatus(staffId);
    return status === TRAINING_STATUS.CERTIFIED || status === TRAINING_STATUS.SOLO;
  }
}

/**
 * Assignment represents a staff-student pairing for a specific session
 */
export class Assignment {
  constructor({
    id,
    staffId,
    staffName = '',
    studentId,
    studentName = '',
    session, // 'AM' or 'PM'
    program, // 'Primary' or 'Secondary'
    date,
    isLocked = false,
    assignedBy = 'auto' // 'auto' or 'manual'
  }) {
    this.id = id;
    this.staffId = staffId;
    this.staffName = staffName;
    this.studentId = studentId;
    this.studentName = studentName;
    this.session = session;
    this.program = program;
    this.date = date;
    this.isLocked = isLocked;
    this.assignedBy = assignedBy;
  }

  getSessionTimes() {
    return SESSION_TIMES[this.program.toUpperCase()][this.session];
  }
}

/**
 * Schedule represents the complete schedule for a day
 */
export class Schedule {
  constructor({
    date,
    assignments = [],
    lockedAssignments = new Set(),
    isFinalized = false
  }) {
    this.date = date;
    this.assignments = assignments; // Array of Assignment objects
    this.lockedAssignments = lockedAssignments; // Set of assignment IDs that are manually locked
    this.isFinalized = isFinalized;
  }

  getAssignmentsForSession(session, program) {
    return this.assignments.filter(a => 
      a.session === session && 
      a.program.toLowerCase() === program.toLowerCase()
    );
  }

  getStaffAssignments(staffId) {
    return this.assignments.filter(a => a.staffId === staffId);
  }

  getStudentAssignments(studentId) {
    return this.assignments.filter(a => a.studentId === studentId);
  }

  isStaffAvailable(staffId, session, program) {
    // Check for conflicts in the SAME SESSION across ALL PROGRAMS
    // A staff member can't work both Primary and Secondary in the same session
    const sessionAssignments = this.assignments.filter(a => a.session === session);
    return !sessionAssignments.some(a => a.staffId === staffId);
  }

  hasStaffWorkedWithStudentToday(staffId, studentId) {
    return this.assignments.some(a => 
      a.staffId === staffId && a.studentId === studentId
    );
  }

  addAssignment(assignment) {
    this.assignments.push(assignment);
  }

  removeAssignment(assignmentId) {
    this.assignments = this.assignments.filter(a => a.id !== assignmentId);
  }

  lockAssignment(assignmentId) {
    this.lockedAssignments.add(assignmentId);
  }

  unlockAssignment(assignmentId) {
    this.lockedAssignments.delete(assignmentId);
  }

  isAssignmentLocked(assignmentId) {
    return this.lockedAssignments.has(assignmentId);
  }
}

/**
 * Validation rules for scheduling
 */
export class SchedulingRules {
  static validateAssignment(assignment, schedule, staff, student) {
    const errors = [];

    // Check if staff can work this program
    const staffMember = staff.find(s => s.id === assignment.staffId);
    if (!staffMember) {
      errors.push('Staff member not found');
      return errors;
    }

    if (!staffMember.canWorkProgram(assignment.program)) {
      errors.push(`${staffMember.name} is not assigned to ${assignment.program} program`);
    }

    // Check if staff is already assigned in this session
    if (!schedule.isStaffAvailable(assignment.staffId, assignment.session, assignment.program)) {
      errors.push(`${staffMember.name} is already assigned in ${assignment.session} session`);
    }

    // Check if staff has already worked with this student today
    if (schedule.hasStaffWorkedWithStudentToday(assignment.staffId, assignment.studentId)) {
      errors.push(`${staffMember.name} has already worked with this student today`);
    }

    // Note: Additional student requirements validation can be added here
    // Note: excludedStaff validation removed - now using team-based assignments

    return errors;
  }

  static validateSchedule(schedule, staff, students) {
    const errors = [];
    
    // Check all assignments for violations
    for (const assignment of schedule.assignments) {
      // Create a temporary schedule without the current assignment for validation
      const tempSchedule = new Schedule({ 
        date: schedule.date,
        assignments: schedule.assignments.filter(a => a.id !== assignment.id),
        lockedAssignments: schedule.lockedAssignments,
        isFinalized: schedule.isFinalized
      });
      
      const assignmentErrors = this.validateAssignment(assignment, tempSchedule, staff, students);
      errors.push(...assignmentErrors.map(err => `Assignment ${assignment.id}: ${err}`));
    }

    // Check ratio requirements are met
    const studentRatioCounts = {};
    for (const assignment of schedule.assignments) {
      const student = students.find(s => s.id === assignment.studentId);
      if (student) {
        const key = `${assignment.session}-${assignment.program}-${student.id}`;
        studentRatioCounts[key] = (studentRatioCounts[key] || 0) + 1;
        
        // Check ratio requirements using the session-specific ratio
        const sessionRatio = student.getSessionRatio ? student.getSessionRatio(assignment.session) : student.ratio;
        if (sessionRatio === RATIOS.TWO_TO_ONE && studentRatioCounts[key] < 2) {
          errors.push(`${student.name} requires 2:1 ratio but only has ${studentRatioCounts[key]} staff assigned`);
        }
      }
    }

    return errors;
  }
}

/**
 * Utility functions for scheduling
 */
export class SchedulingUtils {
  static generateAssignmentId() {
    return `assignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  static sortStaffByHierarchy(staff) {
    return [...staff].sort((a, b) => a.getRoleLevel() - b.getRoleLevel());
  }

  static getAvailableStaffForStudent(student, session, program, staff, schedule) {
    return staff.filter(staffMember => {
      // Must be active
      if (!staffMember.isActive) return false;
      
      // Must not be absent for this session
      if (!staffMember.isAvailableForSession(session)) return false;
      
      // Must be able to work this program
      if (!staffMember.canWorkProgram(program)) return false;
      
      // Must be available for this session
      if (!schedule.isStaffAvailable(staffMember.id, session, program)) return false;
      
      // Must not have worked with this student already today
      if (schedule.hasStaffWorkedWithStudentToday(staffMember.id, student.id)) return false;
      
      // Check direct session eligibility - supervisory roles can't do direct sessions
      if (!staffMember.canDoDirectSessions()) {
        return false; // BCBA/Director/Trainer can't do direct client sessions
      }
      
      // Check 1:1 eligibility - if student needs 1:1, staff must be eligible
      const sessionRatio = session === 'AM' ? student.ratioAM : student.ratioPM;
      if (sessionRatio === RATIOS.ONE_TO_ONE && !staffMember.canDo1To1Sessions()) {
        return false; // Teacher/Trainer/Director/BCBA can't do 1:1 sessions
      }
      
      // Must not be excluded by student
      // Note: excludedStaff validation removed - now using team-based assignments
      
      return true;
    });
  }
}