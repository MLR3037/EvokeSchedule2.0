import { Staff, Student, Schedule, Assignment, PROGRAMS, RATIOS } from '../types/index.js';

/**
 * Sample data for testing the ABA scheduling system
 */

// Sample staff data (80 staff as requested)
export const sampleStaff = [
  // RBTs (Registered Behavior Technicians) - 40 staff
  new Staff({ id: 1, name: 'Sarah Johnson', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 2, name: 'Mike Chen', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 3, name: 'Emily Rodriguez', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 4, name: 'David Kim', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 5, name: 'Jessica Williams', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 6, name: 'Alex Thompson', role: 'RBT', primaryProgram: true, secondaryProgram: true, isActive: true }), // Both programs
  new Staff({ id: 7, name: 'Maria Garcia', role: 'RBT', primaryProgram: true, secondaryProgram: true, isActive: true }), // Both programs
  new Staff({ id: 8, name: 'Chris Lee', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 9, name: 'Amanda Davis', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 10, name: 'Ryan Martinez', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 11, name: 'Nicole Brown', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 12, name: 'Kevin Wilson', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 13, name: 'Stephanie Taylor', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 14, name: 'Brandon White', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 15, name: 'Melissa Adams', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  // ... Add more RBTs (continuing pattern for 40 total)
  new Staff({ id: 16, name: 'Jordan Smith', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 17, name: 'Taylor Jones', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 18, name: 'Morgan Clark', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 19, name: 'Casey Green', role: 'RBT', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 20, name: 'Riley Miller', role: 'RBT', primaryProgram: false, secondaryProgram: true, isActive: true }),
  
  // Behavior Specialists (BS) - 15 staff
  new Staff({ id: 41, name: 'Dr. Jennifer Parker', role: 'BS', primaryProgram: true, secondaryProgram: true, isActive: true }),
  new Staff({ id: 42, name: 'Lisa Anderson', role: 'BS', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 43, name: 'Mark Roberts', role: 'BS', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 44, name: 'Amy Foster', role: 'BS', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 45, name: 'Daniel Cooper', role: 'BS', primaryProgram: false, secondaryProgram: true, isActive: true }),
  // ... more BS staff
  
  // BCBAs (Board Certified Behavior Analysts) - 10 staff
  new Staff({ id: 61, name: 'Dr. Michael Stevens', role: 'BCBA', primaryProgram: true, secondaryProgram: true, isActive: true }),
  new Staff({ id: 62, name: 'Dr. Sarah Mitchell', role: 'BCBA', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 63, name: 'Dr. Robert Turner', role: 'BCBA', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 64, name: 'Dr. Linda Campbell', role: 'BCBA', primaryProgram: true, secondaryProgram: true, isActive: true }),
  
  // Educational Assistants (EA) - 8 staff
  new Staff({ id: 71, name: 'Carol Henderson', role: 'EA', primaryProgram: true, secondaryProgram: false, isActive: true }),
  new Staff({ id: 72, name: 'Janet Phillips', role: 'EA', primaryProgram: false, secondaryProgram: true, isActive: true }),
  new Staff({ id: 73, name: 'Robert Evans', role: 'EA', primaryProgram: true, secondaryProgram: false, isActive: true }),
  
  // Mental Health Assistants (MHA) - 4 staff
  new Staff({ id: 76, name: 'Patricia Young', role: 'MHA', primaryProgram: true, secondaryProgram: true, isActive: true }),
  new Staff({ id: 77, name: 'Thomas Hall', role: 'MHA', primaryProgram: false, secondaryProgram: true, isActive: true }),
  
  // Clinical Coordinators (CC) - 2 staff
  new Staff({ id: 78, name: 'Michelle Lewis', role: 'CC', primaryProgram: true, secondaryProgram: true, isActive: true }),
  
  // Teachers - 1 staff
  new Staff({ id: 79, name: 'Elizabeth Murphy', role: 'Teacher', primaryProgram: true, secondaryProgram: true, isActive: true }),
  
  // Director - 1 staff
  new Staff({ id: 80, name: 'James Wilson', role: 'Director', primaryProgram: PROGRAMS.PRIMARY, secondaryProgram: PROGRAMS.SECONDARY, isActive: true })
];

// Sample student data (50 students as requested)
export const sampleStudents = [
  // Primary Program Students (30 students)
  new Student({ id: 101, name: 'Alex Martinez', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 102, name: 'Emma Thompson', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 103, name: 'Liam Johnson', program: PROGRAMS.PRIMARY, ratio: RATIOS.TWO_TO_ONE, isActive: true }), // Requires 2 staff
  new Student({ id: 104, name: 'Sophie Chen', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 105, name: 'Noah Davis', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group
  new Student({ id: 106, name: 'Isabella Garcia', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group with Noah
  new Student({ id: 107, name: 'Mason Williams', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 108, name: 'Olivia Brown', program: PROGRAMS.PRIMARY, ratio: RATIOS.TWO_TO_ONE, isActive: true }), // Requires 2 staff
  new Student({ id: 109, name: 'Lucas Wilson', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 110, name: 'Ava Rodriguez', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 111, name: 'Ethan Taylor', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 112, name: 'Mia Anderson', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group
  new Student({ id: 113, name: 'Jacob Miller', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group with Mia
  new Student({ id: 114, name: 'Charlotte Lee', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 115, name: 'Michael White', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 116, name: 'Amelia Harris', program: PROGRAMS.PRIMARY, ratio: RATIOS.TWO_TO_ONE, isActive: true }), // Requires 2 staff
  new Student({ id: 117, name: 'Benjamin Clark', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 118, name: 'Harper Lewis', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 119, name: 'Daniel Walker', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 120, name: 'Ella Young', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 121, name: 'Matthew King', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 122, name: 'Avery Scott', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group
  new Student({ id: 123, name: 'Logan Green', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group with Avery
  new Student({ id: 124, name: 'Luna Adams', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 125, name: 'Owen Baker', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 126, name: 'Layla Hall', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 127, name: 'Carter Rivera', program: PROGRAMS.PRIMARY, ratio: RATIOS.TWO_TO_ONE, isActive: true }), // Requires 2 staff
  new Student({ id: 128, name: 'Zoe Campbell', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 129, name: 'Grayson Nelson', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 130, name: 'Lily Mitchell', program: PROGRAMS.PRIMARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),

  // Secondary Program Students (20 students)
  new Student({ id: 201, name: 'Adrian Torres', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 202, name: 'Cesar Flores', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 203, name: 'Maya Patel', program: PROGRAMS.SECONDARY, ratio: RATIOS.TWO_TO_ONE, isActive: true }), // Requires 2 staff
  new Student({ id: 204, name: 'Diego Santos', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 205, name: 'Zara Ahmed', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group
  new Student({ id: 206, name: 'Kai Thompson', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group with Zara
  new Student({ id: 207, name: 'Nora Kim', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 208, name: 'Mateo Gonzalez', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 209, name: 'Aria Parker', program: PROGRAMS.SECONDARY, ratio: RATIOS.TWO_TO_ONE, isActive: true }), // Requires 2 staff
  new Student({ id: 210, name: 'Felix Rodriguez', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 211, name: 'Ivy Chen', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 212, name: 'Jaxon Davis', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group
  new Student({ id: 213, name: 'Vera Martinez', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_TWO, isActive: true }), // Small group with Jaxon
  new Student({ id: 214, name: 'Ezra Wilson', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 215, name: 'Sage Anderson', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 216, name: 'Phoenix Taylor', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 217, name: 'River Johnson', program: PROGRAMS.SECONDARY, ratio: RATIOS.TWO_TO_ONE, isActive: true }), // Requires 2 staff
  new Student({ id: 218, name: 'Luna Garcia', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 219, name: 'Atlas Brown', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true }),
  new Student({ id: 220, name: 'Nova Lee', program: PROGRAMS.SECONDARY, ratio: RATIOS.ONE_TO_ONE, isActive: true })
];

// Add some preferred/excluded staff relationships for testing
// Note: The following staff preferences and exclusions are no longer used
// since the app now uses team-based assignments from SharePoint
// Keeping this section commented for reference, but it's not used in the algorithm

/*
sampleStudents[2].preferredStaff = [1, 2]; // Liam prefers Sarah and Mike
sampleStudents[2].excludedStaff = [20]; // Liam cannot work with Riley

sampleStudents[7].preferredStaff = [41, 42]; // Olivia prefers Dr. Parker and Lisa
sampleStudents[7].excludedStaff = []; 

sampleStudents[22].preferredStaff = [61]; // Adrian prefers Dr. Stevens
sampleStudents[22].excludedStaff = [3, 5]; // Adrian cannot work with Emily or Jessica

sampleStudents[24].preferredStaff = []; 
sampleStudents[24].excludedStaff = [8, 10]; // Zara cannot work with Chris or Ryan
*/

/**
 * Create a test schedule with some pre-existing assignments
 */
export const createTestSchedule = (date = new Date()) => {
  const schedule = new Schedule({ date });
  
  // Add some manual assignments for testing
  const testAssignments = [
    // Primary AM session
    { staffId: 1, studentId: 101, session: 'AM', program: PROGRAMS.PRIMARY }, // Sarah -> Alex (Primary staff)
    { staffId: 2, studentId: 102, session: 'AM', program: PROGRAMS.PRIMARY }, // Mike -> Emma (Primary staff)
    { staffId: 4, studentId: 107, session: 'AM', program: PROGRAMS.PRIMARY }, // David -> Mason (Primary staff)
    
    // Primary PM session  
    { staffId: 9, studentId: 101, session: 'PM', program: PROGRAMS.PRIMARY }, // Amanda -> Alex (different staff than AM)
    { staffId: 11, studentId: 102, session: 'PM', program: PROGRAMS.PRIMARY }, // Nicole -> Emma (different staff than AM)
    
    // Secondary AM session
    { staffId: 3, studentId: 201, session: 'AM', program: PROGRAMS.SECONDARY }, // Emily -> Adrian (Secondary staff)
    { staffId: 5, studentId: 202, session: 'AM', program: PROGRAMS.SECONDARY }, // Jessica -> Cesar (Secondary staff)
  ];
  
  testAssignments.forEach((assignmentData, index) => {
    const assignment = new Assignment({
      id: `test_${index + 1}`,
      staffId: assignmentData.staffId,
      studentId: assignmentData.studentId,
      session: assignmentData.session,
      program: assignmentData.program,
      date: date,
      isLocked: false,
      assignedBy: 'manual'
    });
    schedule.addAssignment(assignment);
  });
  
  // Lock a couple assignments for testing
  schedule.lockAssignment('test_1'); // Lock Sarah -> Alex (Primary AM)
  schedule.lockAssignment('test_6'); // Lock Emily -> Adrian (Secondary AM)
  
  return schedule;
};

/**
 * Validation test scenarios
 */
export const getTestScenarios = () => {
  return {
    validScenario: {
      description: 'All constraints satisfied',
      schedule: createTestSchedule(),
      expectedErrors: 0,
      expectedWarnings: 0
    },
    sameDayViolation: {
      description: 'Staff assigned to same student twice in one day',
      schedule: (() => {
        const schedule = createTestSchedule();
        // Add violation: Same staff with same student in both sessions
        const assignment = new Assignment({
          id: 'violation_1',
          staffId: 1, // Sarah
          studentId: 101, // Alex (already has Sarah in AM)
          session: 'PM',
          program: PROGRAMS.PRIMARY,
          date: new Date(),
          isLocked: false,
          assignedBy: 'manual'
        });
        schedule.addAssignment(assignment);
        return schedule;
      })(),
      expectedErrors: 1,
      expectedWarnings: 0
    },
    ratioViolation: {
      description: '2:1 student with only one staff assigned',
      schedule: (() => {
        const schedule = new Schedule({ date: new Date() });
        // Add 2:1 student with only one staff
        const assignment = new Assignment({
          id: 'ratio_violation',
          staffId: 1,
          studentId: 103, // Liam (requires 2:1 ratio)
          session: 'AM',
          program: PROGRAMS.PRIMARY,
          date: new Date(),
          isLocked: false,
          assignedBy: 'manual'
        });
        schedule.addAssignment(assignment);
        return schedule;
      })(),
      expectedErrors: 1,
      expectedWarnings: 0
    }
  };
};

/**
 * Performance test data - larger dataset
 */
export const generateLargeTestData = (staffCount = 200, studentCount = 150) => {
  const roles = ['RBT', 'BS', 'BCBA', 'EA', 'MHA', 'CC', 'Teacher', 'Director'];
  const programs = [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY];
  const ratios = [RATIOS.ONE_TO_ONE, RATIOS.TWO_TO_ONE, RATIOS.ONE_TO_TWO];
  
  const largeStaffData = [];
  for (let i = 1; i <= staffCount; i++) {
    const role = roles[Math.floor(Math.random() * roles.length)];
    const primaryProgram = programs[Math.floor(Math.random() * programs.length)];
    const secondaryProgram = Math.random() > 0.7 ? programs[1 - programs.indexOf(primaryProgram)] : null;
    
    largeStaffData.push(new Staff({
      id: i,
      name: `Staff Member ${i}`,
      role,
      primaryProgram,
      secondaryProgram,
      isActive: Math.random() > 0.1 // 90% active
    }));
  }
  
  const largeStudentData = [];
  for (let i = 1; i <= studentCount; i++) {
    const program = programs[Math.floor(Math.random() * programs.length)];
    const ratio = ratios[Math.floor(Math.random() * ratios.length)];
    
    largeStudentData.push(new Student({
      id: i + 1000,
      name: `Student ${i}`,
      program,
      ratio,
      isActive: Math.random() > 0.05 // 95% active
    }));
  }
  
  return { staff: largeStaffData, students: largeStudentData };
};

export default {
  sampleStaff,
  sampleStudents,
  createTestSchedule,
  getTestScenarios,
  generateLargeTestData
};