// Data models and types for ABA Scheduling System

// Staff role hierarchy (used for assignment priority)
export const STAFF_ROLES = {
  RBT: { level: 1, name: 'RBT' },
  BS: { level: 2, name: 'Behavior Specialist' },
  BCBA: { level: 3, name: 'BCBA' },
  EA: { level: 4, name: 'Educational Assistant' },
  MHA: { level: 5, name: 'Mental Health Assistant' },
  CC: { level: 6, name: 'Clinical Coordinator' },
  Teacher: { level: 7, name: 'Teacher' },
  Director: { level: 8, name: 'Director' }
};

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
    name,
    role,
    email = '',
    userId = null,
    staffPerson = null,
    primaryProgram = false, // Yes/No field
    secondaryProgram = false, // Yes/No field
    isActive = true
  }) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.email = email;
    this.userId = userId; // SharePoint User ID for People Picker
    this.staffPerson = staffPerson; // People Picker data
    this.primaryProgram = primaryProgram; // Boolean for Yes/No column
    this.secondaryProgram = secondaryProgram; // Boolean for Yes/No column
    this.isActive = isActive;
  }

  getRoleLevel() {
    return STAFF_ROLES[this.role]?.level || 0;
  }

  canWorkProgram(program) {
    if (program === PROGRAMS.PRIMARY) {
      return this.primaryProgram;
    } else if (program === PROGRAMS.SECONDARY) {
      return this.secondaryProgram;
    }
    return false;
  }
}

/**
 * Student/Kid data structure
 */
export class Student {
  constructor({
    id,
    name,
    program,
    ratioAM = RATIOS.ONE_TO_ONE, // Separate ratio for AM
    ratioPM = RATIOS.ONE_TO_ONE, // Separate ratio for PM
    isActive = true,
    team = [] // Renamed from preferredStaff, People Picker array
  }) {
    this.id = id;
    this.name = name;
    this.program = program; // PRIMARY or SECONDARY
    this.ratioAM = ratioAM; // AM session ratio
    this.ratioPM = ratioPM; // PM session ratio
    this.isActive = isActive;
    this.team = team; // Array of team members (People Picker data)
  }

  requiresMultipleStaff(session) {
    const ratio = session === 'AM' ? this.ratioAM : this.ratioPM;
    return ratio === RATIOS.TWO_TO_ONE;
  }

  getSessionRatio(session) {
    return session === 'AM' ? this.ratioAM : this.ratioPM;
  }

  isSmallGroup(session) {
    const ratio = session === 'AM' ? this.ratioAM : this.ratioPM;
    return ratio === RATIOS.ONE_TO_TWO;
  }
}

/**
 * Assignment represents a staff-student pairing for a specific session
 */
export class Assignment {
  constructor({
    id,
    staffId,
    studentId,
    session, // 'AM' or 'PM'
    program, // 'Primary' or 'Secondary'
    date,
    isLocked = false,
    assignedBy = 'auto' // 'auto' or 'manual'
  }) {
    this.id = id;
    this.staffId = staffId;
    this.studentId = studentId;
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
    const existingAssignments = this.getAssignmentsForSession(session, program);
    return !existingAssignments.some(a => a.staffId === staffId);
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

    // Check student requirements
    const studentRecord = student.find(s => s.id === assignment.studentId);
    if (studentRecord) {
      if (studentRecord.excludedStaff.includes(assignment.staffId)) {
        errors.push(`${studentRecord.name} cannot be assigned to ${staffMember.name}`);
      }
    }

    return errors;
  }

  static validateSchedule(schedule, staff, students) {
    const errors = [];
    
    // Check all assignments for violations
    for (const assignment of schedule.assignments) {
      const assignmentErrors = this.validateAssignment(assignment, schedule, staff, students);
      errors.push(...assignmentErrors.map(err => `Assignment ${assignment.id}: ${err}`));
    }

    // Check ratio requirements are met
    const studentRatioCounts = {};
    for (const assignment of schedule.assignments) {
      const student = students.find(s => s.id === assignment.studentId);
      if (student) {
        const key = `${assignment.session}-${assignment.program}-${student.id}`;
        studentRatioCounts[key] = (studentRatioCounts[key] || 0) + 1;
        
        if (student.ratio === RATIOS.TWO_TO_ONE && studentRatioCounts[key] < 2) {
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
      
      // Must be able to work this program
      if (!staffMember.canWorkProgram(program)) return false;
      
      // Must be available for this session
      if (!schedule.isStaffAvailable(staffMember.id, session, program)) return false;
      
      // Must not have worked with this student already today
      if (schedule.hasStaffWorkedWithStudentToday(staffMember.id, student.id)) return false;
      
      // Must not be excluded by student
      if (student.excludedStaff.includes(staffMember.id)) return false;
      
      return true;
    });
  }
}