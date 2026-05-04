import { 
  Assignment, 
  PROGRAMS, 
  RATIOS, 
  TRAINING_STATUS,
  SchedulingUtils, 
  SchedulingRules 
} from '../types/index.js';

/**
 * ULTIMATE Auto-assignment algorithm for ABA scheduling
 * Features:
 * - Deep cascading multi-level iteration until all students assigned
 * - Strong randomization for staff selection to create rotation/variability
 * - Caseload balancing to distribute work evenly
 * - Team membership and role hierarchy enforcement
 * 
 * CONSOLE LOGGING:
 * - Critical logs (eligibility, blocking, assignments) always show
 * - Verbose logs (detailed breakdowns) can be toggled with this.verboseLogging
 * - To enable verbose logging: Set this.verboseLogging = true in constructor
 */
export class AutoAssignmentEngine {
  constructor() {
    this.debugMode = false; // Enhanced debug mode
    this.maxIterations = 50; // Ultimate iteration limit
    this.maxChainDepth = 5; // How deep to search for swap chains
    this.verboseLogging = false; // Set to TRUE to see detailed assignment logs
  }
  
  /**
   * Conditional logging - only logs if verbose mode is enabled
   * Critical logs always show regardless
   */
  verboseLog(...args) {
    if (this.verboseLogging) {
      console.log(...args);
    }
  }

  /**
     * Get staff priority score - LOWER is BETTER
     * RBT should be strongly preferred over BS, both preferred over BCBAs/EAs
     * Hierarchy: RBT > BS > BCBA > EA > MH Specialist/Coordinator/Clinician > CC
     */
  getStaffPriorityScore(staffMember) {
    const hierarchy = {
      'RBT': 1,
      'BS': 50,      // Much lower priority — only used when no RBTs available
      'BCBA': 999,   // Never used in auto-assign
      'EA': 999,     // Never used in auto-assign
      'CC': 999,
      'MH Specialist': 21,
      'MH Coordinator': 21,
      'MH Clinician': 21,
      'Teacher': 999,   // Should never be used
      'Director': 999,  // Should never be used
      'TEACHER': 999,
      'DIRECTOR': 999
    };

    return hierarchy[staffMember.role] || 50;
  }

  /**
   * Check if staff can do direct service (blocks Teachers/Directors completely)
   */
  canStaffDoDirectService(staffMember) {
    const blockedRoles = ['Teacher', 'Director', 'TEACHER', 'DIRECTOR'];
    return !blockedRoles.includes(staffMember.role) && staffMember.canDoDirectSessions();
  }

  /**
   * Check if staff is currently in training for a specific student
   * Staff in training (overlap-staff or overlap-bcba) should NOT be auto-assigned as main staff
   * They should only appear in the trainee dropdown
   */
  isStaffInTrainingForStudent(staffMember, student) {
    if (!student.getStaffTrainingStatus) {
      console.log(`  ⚠️ No getStaffTrainingStatus method for ${student.name} - cannot check training status for ${staffMember.name}`);
      return false; // No training status tracking for this student
    }
    
    const trainingStatus = student.getStaffTrainingStatus(staffMember.id);
    const isInTraining = trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || 
                         trainingStatus === TRAINING_STATUS.OVERLAP_BCBA;
    
    if (isInTraining) {
      console.log(`  🎓 BLOCKING: ${staffMember.name} is in training for ${student.name} (${trainingStatus}) - CANNOT be main staff`);
    }
    
    return isInTraining;
  }

  /**
   * Check if staff has at least ONE solo/certified case with ANY student
   * Training-only staff (who have NO solo cases) should NEVER be auto-assigned
   * They can only be manually assigned via the trainee dropdown
   */
  staffHasAnySoloCase(staffMember, students) {
    const activeStudents = students.filter(s => s.isActive);
    
    for (const student of activeStudents) {
      // Check if staff is on this student's team
      if (student.teamIds && student.teamIds.includes(staffMember.id)) {
        const trainingStatus = student.getStaffTrainingStatus ? 
          student.getStaffTrainingStatus(staffMember.id) : TRAINING_STATUS.SOLO;
        
        // They have a solo case if status is 'solo' or 'trainer'
        if (trainingStatus === TRAINING_STATUS.SOLO || trainingStatus === TRAINING_STATUS.TRAINER) {
           return true; // Found at least one solo case
        }
      }
    }
    
    return false; // No solo cases found - training-only staff
  }

  /**
   * Sort staff with STRICT preference for RBTs/BSs over EAs
   */
  sortStaffForStudentStrict(student, availableStaff, session, schedule = null) {
    return [...availableStaff].sort((a, b) => {
      // 1. Team members first
      const aIsTeamMember = student.teamIds.includes(a.id);
      const bIsTeamMember = student.teamIds.includes(b.id);
      if (aIsTeamMember && !bIsTeamMember) return -1;
      if (!aIsTeamMember && bIsTeamMember) return 1;

      // 2. Strict role hierarchy (RBT/BS >> EA >> others)
      const aScore = this.getStaffPriorityScore(a);
      const bScore = this.getStaffPriorityScore(b);
      if (aScore !== bScore) return aScore - bScore;

      // 3. NEW: Prioritize staff with smaller caseloads (fewer current assignments)
      if (schedule) {
        const aAssignments = schedule.getStaffAssignments(a.id).length;
        const bAssignments = schedule.getStaffAssignments(b.id).length;
        if (aAssignments !== bAssignments) return aAssignments - bAssignments;
      }

      // 4. For PM sessions, add slight randomization within same priority level
      if (session === 'PM' && aScore === bScore) {
        return Math.random() - 0.5;
      }

      // 5. Alphabetically for consistency
      return (a?.name || '').localeCompare(b?.name || '');
    });
  }

  /**
   * Helper: Count unassigned students
   */
  countUnassignedStudents(schedule, students) {
    let count = 0;
    const sessions = ['AM', 'PM'];

    students.filter(s => s.isActive).forEach(student => {
      sessions.forEach(session => {
        // Skip if student is absent for this session
        if (!student.isAvailableForSession(session)) {
          return;
        }
        
        if (!this.isStudentAssigned(student.id, session, student.program, schedule)) {
          count++;
        }
      });
    });

    return count;
  }

  /**
   * Find replacement staff for a student (excluding certain staff)
   */
  findReplacementStaff(student, session, program, staff, schedule, excludeIds = []) {
    const availableStaff = staff.filter(s => {
      if (!s.isActive) return false;
      if (!['RBT', 'BS'].includes(s.role)) return false; // Only RBT/BS in auto-assign/swap
      if (!s.isAvailableForSession(session)) return false; // Check attendance
      if (!s.canWorkProgram(program)) return false;
      if (excludeIds.includes(s.id)) return false;
      if (!student.teamIds.includes(s.id)) return false;
      if (!this.canStaffDoDirectService(s)) return false;
      if (!schedule.isStaffAvailable(s.id, session, program)) return false;
      if (schedule.hasStaffWorkedWithStudentToday(s.id, student.id)) return false;
      
      // EXCLUDE staff who are in training for this student
      if (this.isStaffInTrainingForStudent(s, student)) return false;
      
      return true;
    });

    if (availableStaff.length === 0) return null;

    // Prefer RBT/BS over EA and staff with smaller caseloads
    const sorted = this.sortStaffForStudentStrict(student, availableStaff, session, schedule);
    return sorted[0];
  }
  /**
     * NEW STRATEGY: Find unassigned staff who can enable a simple swap
     * This is more efficient than deep chain recursion
     */
  async findSimpleSwapWithUnassignedStaff(targetStudent, targetSession, targetProgram, staff, students, schedule) {
    console.log(`    💡 SMART STRATEGY: Looking for unassigned staff who can enable swaps...`);

    // Find ALL unassigned RBT/BS staff in the target session/program who are NOT on the target student's team
    const unassignedRbtBs = staff.filter(s => {
      if (!s.isActive) return false;
      if (!s.canWorkProgram(targetProgram)) return false;
      if (!this.canStaffDoDirectService(s)) return false;
      if (!['RBT', 'BS'].includes(s.role)) return false;
      if (targetStudent.teamIds.includes(s.id)) return false; // Not on target student's team
      if (this.isStaffInTrainingForStudent(s, targetStudent)) return false; // Not in training for target student
      
      // Check if available in regular assignments
      if (!schedule.isStaffAvailable(s.id, targetSession, targetProgram)) return false;
      
      // CRITICAL: Also check if assigned as trainee in this session
      const isAssignedAsTrainee = schedule.traineeAssignments && schedule.traineeAssignments.some(
        ta => ta.staffId === s.id && ta.session === targetSession
      );
      
      if (isAssignedAsTrainee) {
        console.log(`    🎓 Excluding ${s.name} - assigned as trainee in ${targetSession}`);
        return false;
      }
      
      return true;
    });

    console.log(`    📊 Found ${unassignedRbtBs.length} unassigned RBT/BS not on ${targetStudent.name}'s team in ${targetProgram} ${targetSession}`);

    // For each of target student's busy team members
    const targetTeam = staff.filter(s =>
      targetStudent.teamIds.includes(s.id) &&
      this.canStaffDoDirectService(s) &&
      !this.isStaffInTrainingForStudent(s, targetStudent) // Don't try to free staff who are in training
    );


    for (const busyTeamMember of targetTeam) {
      // Skip if already available
      if (schedule.isStaffAvailable(busyTeamMember.id, targetSession, targetProgram)) {
        console.log(`    ⏭️ ${busyTeamMember.name} is already available in ${targetSession} ${targetProgram}`);
        continue;
      }

      // CRITICAL: Skip if this staff is already assigned to targetStudent in ANY session
      // We don't want to pull them into both AM and PM with the same student
      const alreadyWithTargetStudent = schedule.assignments.some(a =>
        a.staffId === busyTeamMember.id &&
        a.studentId === targetStudent.id
      );
      
      if (alreadyWithTargetStudent) {
        console.log(`    🚫 ${busyTeamMember.name} is already assigned to ${targetStudent.name} in another session - skipping to avoid double assignment`);
        continue;
      }

      // Find ALL assignments for this team member in the target session/program
      const currentAssignments = schedule.assignments.filter(a =>
        a.staffId === busyTeamMember.id &&
        a.session === targetSession &&
        a.program === targetProgram
      );

      if (currentAssignments.length === 0) {
        console.log(`    ⚠️ No assignments found for ${busyTeamMember.name} in ${targetSession} ${targetProgram}`);
        continue;
      }

      for (const currentAssignment of currentAssignments) {
        // CRITICAL CHECK: Skip locked assignments - they should NOT be swapped
        if (currentAssignment.isLocked || schedule.isAssignmentLocked(currentAssignment.id)) {
          console.log(`    🔒 BLOCKED - Assignment is locked, skipping ${busyTeamMember.name} with student ID ${currentAssignment.studentId}`);
          continue;
        }

        const currentStudent = students.find(s => s.id === currentAssignment.studentId);
        if (!currentStudent) {
          console.log(`    ⚠️ Could not find student with id ${currentAssignment.studentId}`);
          continue;
        }

        console.log(`    🔍 ${busyTeamMember.name} is with ${currentStudent.name}`);

        // Check if any unassigned RBT/BS (not on targetStudent's team) is on currentStudent's team
        let foundEligible = false;
        for (const unassignedStaffMember of unassignedRbtBs) {
          if (!currentStudent.teamIds.includes(unassignedStaffMember.id)) {
            console.log(`      ⏭️ ${unassignedStaffMember.name} is NOT on ${currentStudent.name}'s team`);
            continue;
          }

          // CRITICAL: Don't use staff who are in training for currentStudent
          // They should only be assigned as trainees, not primary staff
          if (this.isStaffInTrainingForStudent(unassignedStaffMember, currentStudent)) {
            console.log(`      🎓 EXCLUDING ${unassignedStaffMember.name} - in training for ${currentStudent.name} (trainee only)`);
            continue;
          }

          foundEligible = true;
          console.log(`      💡 ${unassignedStaffMember.name} (unassigned, not on ${targetStudent.name}'s team) IS on ${currentStudent.name}'s team! Attempting swap...`);

          // CRITICAL: Before validating, temporarily remove conflicting assignments
          // We need to simulate the swap to validate properly
          const tempRemovals = [];

          // 1. Remove the busy team member's current assignment (we're moving them to targetStudent)
          tempRemovals.push(currentAssignment);

          // 2. Check if busy team member has OTHER assignments in this session that would conflict
          const busyMemberOtherConflicts = schedule.assignments.filter(a =>
            a.staffId === busyTeamMember.id &&
            a.session === targetSession &&
            a.program === targetProgram &&
            a.id !== currentAssignment.id // Don't double-count the one we already added
          );
          tempRemovals.push(...busyMemberOtherConflicts);

          // 3. Store original assignments for restoration
          const originalAssignments = [...schedule.assignments];

          // 4. Temporarily remove all conflicts from schedule
          tempRemovals.forEach(conflict => {
            const index = schedule.assignments.findIndex(a => a.id === conflict.id);
            if (index > -1) {
              schedule.assignments.splice(index, 1);
            }
          });

          console.log(`      🔧 Temporarily removed ${tempRemovals.length} conflicting assignment(s) for validation`);

          // Create the simple swap
          const replacementAssignment = new Assignment({
            id: SchedulingUtils.generateAssignmentId(),
            staffId: unassignedStaffMember.id,
            staffName: unassignedStaffMember.name,
            studentId: currentStudent.id,
            studentName: currentStudent.name,
            session: targetSession,
            program: targetProgram,
            date: schedule.date,
            isLocked: false,
            assignedBy: 'smart-swap'
          });

          const newAssignment = new Assignment({
            id: SchedulingUtils.generateAssignmentId(),
            staffId: busyTeamMember.id,
            staffName: busyTeamMember.name,
            studentId: targetStudent.id,
            studentName: targetStudent.name,
            session: targetSession,
            program: targetProgram,
            date: schedule.date,
            isLocked: false,
            assignedBy: 'smart-swap'
          });

          // Validate both with conflicts removed
          console.log(`      🔍 Validating: ${unassignedStaffMember.name} → ${currentStudent.name}`);
          const errors1 = SchedulingRules.validateAssignment(replacementAssignment, schedule, staff, [currentStudent]);

          console.log(`      🔍 Validating: ${busyTeamMember.name} → ${targetStudent.name}`);
          const errors2 = SchedulingRules.validateAssignment(newAssignment, schedule, staff, [targetStudent]);

          // ALWAYS restore original assignments after validation
          schedule.assignments = originalAssignments;

          if (errors1.length === 0 && errors2.length === 0) {
            console.log(`      ✅ SMART SWAP SUCCESS! ${unassignedStaffMember.name} → ${currentStudent.name}, ${busyTeamMember.name} → ${targetStudent.name}`);

            return {
              success: true,
              swaps: [{
                description: `Smart swap: ${unassignedStaffMember.name} covers ${currentStudent.name}, freeing ${busyTeamMember.name} for ${targetStudent.name}`
              }],
              newAssignments: [replacementAssignment, newAssignment],
              changes: [
                ...tempRemovals.map(a => ({ type: 'remove', assignmentId: a.id })),
                { type: 'add', assignment: replacementAssignment },
                { type: 'add', assignment: newAssignment }
              ],
              description: `${unassignedStaffMember.name} → ${currentStudent.name}, ${busyTeamMember.name} → ${targetStudent.name}`
            };
          } else {
            console.log(`      ❌ Validation failed: ${[...errors1, ...errors2].join(', ')}`);
          }
        }

        if (!foundEligible) {
          console.log(`      ❌ No eligible unassigned RBT/BS found for ${currentStudent.name}`);
        }
      }
    }

    console.log(`    ❌ No simple swaps found with unassigned RBT/BS not on ${targetStudent.name}'s team`);
    return { success: false };
  }
  /**
   * Find staff who are underutilized and could be swapped
   */
  /**
     * Enhanced swap finder with multi-level cascading
     * Tries to free up staff for unassigned students through chain reactions
     */
  async findAndSwapUnderutilizedStaff(targetStudent, targetSession, targetProgram, staff, students, schedule) {
    console.log(`    🔍 ULTRA-AGGRESSIVE: Looking for swap chains for ${targetStudent.name}...`);

    const requiredStaffCount = this.getRequiredStaffCount(targetStudent, targetSession);

    // Get ALL of target student's team members (even if busy) — RBT/BS only
    const teamStaff = staff.filter(s =>
      targetStudent.teamIds.includes(s.id) &&
      ['RBT', 'BS'].includes(s.role) &&
      this.canStaffDoDirectService(s)
    );

    console.log(`    📊 ${targetStudent.name} has ${teamStaff.length} team members total`);

    if (teamStaff.length === 0) {
      console.log(`    ❌ No team members at all - cannot proceed`);
      return { success: false };
    }

    // Try each team member systematically
    for (const teamMember of teamStaff) {
      console.log(`\n    🔄 Trying to free up: ${teamMember.name} (${teamMember.role})`);

      // Check if this team member is available in target session
      if (schedule.isStaffAvailable(teamMember.id, targetSession, targetProgram)) {
        // Skip if they already worked with this student in the other session (no same-student all day)
        if (schedule.hasStaffWorkedWithStudentToday(teamMember.id, targetStudent.id)) {
          console.log(`      ⛔ ${teamMember.name} already worked with ${targetStudent.name} today — skipping`);
          continue;
        }
        console.log(`      ✅ ${teamMember.name} is already available!`);

        // Create direct assignment
        const assignment = new Assignment({
          id: SchedulingUtils.generateAssignmentId(),
          staffId: teamMember.id,
          staffName: teamMember.name,
          studentId: targetStudent.id,
          studentName: targetStudent.name,
          session: targetSession,
          program: targetProgram,
          date: schedule.date,
          isLocked: false,
          assignedBy: 'reshuffle-direct'
        });

        const errors = SchedulingRules.validateAssignment(assignment, schedule, staff, [targetStudent]);
        if (errors.length === 0) {
          console.log(`      ✅ DIRECT ASSIGNMENT SUCCESS!`);
          return {
            success: true,
            swaps: [{ description: `Direct assignment: ${teamMember.name} → ${targetStudent.name}` }],
            newAssignments: [assignment],
            changes: [{ type: 'add', assignment }],
            description: `${teamMember.name} directly assigned to ${targetStudent.name}`
          };
        }
      }

      // Team member is busy - try to find a swap chain
      const swapChainResult = await this.findSwapChain(
        teamMember,
        targetStudent,
        targetSession,
        targetProgram,
        staff,
        students,
        schedule,
        3 // Max chain depth
      );

      if (swapChainResult.success) {
        console.log(`      ✅ SWAP CHAIN SUCCESS! Chain length: ${swapChainResult.chain.length}`);
        return swapChainResult;
      }
    }

    console.log(`    ❌ Could not free any of ${teamStaff.length} team members`);
    return { success: false };
  }

  /**
   * NEW: Find a chain of swaps to free up a specific staff member
   * Uses recursive depth-first search to find valid swap chains
   */
  async findSwapChain(targetStaff, finalStudent, finalSession, finalProgram, staff, students, schedule, maxDepth, visited = new Set()) {
    console.log(`      🔗 Finding swap chain for ${targetStaff.name} (depth ${maxDepth})`);

    // Prevent infinite loops
    if (visited.has(targetStaff.id) || maxDepth <= 0) {
      return { success: false };
    }
    visited.add(targetStaff.id);

    // Find what this staff member is currently doing
    const currentAssignments = schedule.assignments.filter(a => a.staffId === targetStaff.id);

    if (currentAssignments.length === 0) {
      // Staff is free - can assign directly
      return { success: false }; // Should have been caught earlier
    }

    // Try each current assignment
    for (const currentAssignment of currentAssignments) {
      const currentStudent = students.find(s => s.id === currentAssignment.studentId);
      if (!currentStudent) continue;

      // Skip if this is already in the target session/program (no point swapping)
      if (currentAssignment.session === finalSession && currentAssignment.program === finalProgram) {
        console.log(`        ⏭️ ${targetStaff.name} already in ${finalSession} ${finalProgram}, checking next...`);
        continue;
      }

      console.log(`        📌 ${targetStaff.name} currently with ${currentStudent.name} (${currentAssignment.program} ${currentAssignment.session})`);

      // Find replacement for current student
      const replacements = this.findPotentialReplacements(
        currentStudent,
        currentAssignment.session,
        currentAssignment.program,
        staff,
        schedule,
        [targetStaff.id] // Exclude the staff we're trying to free
      );

      console.log(`        🔍 Found ${replacements.length} potential replacements for ${currentStudent.name}`);

      for (const replacement of replacements) {
        console.log(`          💡 Trying ${replacement.name} (${replacement.role}) as replacement`);

        // Check if replacement is available
        if (schedule.isStaffAvailable(replacement.id, currentAssignment.session, currentAssignment.program)) {
          // Direct swap possible!
          console.log(`          ✅ Direct swap available!`);

          const chain = this.createSwapChain(
            targetStaff,
            finalStudent,
            finalSession,
            finalProgram,
            currentStudent,
            currentAssignment,
            replacement,
            schedule,
            staff,
            students
          );

          if (chain.success) {
            return chain;
          }
        } else {
          // Replacement is also busy - try recursive chain
          console.log(`          🔄 ${replacement.name} is busy, trying recursive chain...`);

          const subChain = await this.findSwapChain(
            replacement,
            currentStudent,
            currentAssignment.session,
            currentAssignment.program,
            staff,
            students,
            schedule,
            maxDepth - 1,
            new Set(visited)
          );

          if (subChain.success) {
            // Combine chains
            console.log(`          ✅ Recursive chain found! Combining...`);

            // Add our swap to the chain
            const ourSwap = this.createSwapChain(
              targetStaff,
              finalStudent,
              finalSession,
              finalProgram,
              currentStudent,
              currentAssignment,
              replacement,
              schedule,
              staff,
              students
            );

            if (ourSwap.success) {
              return {
                success: true,
                chain: [...subChain.chain, ...ourSwap.chain],
                swaps: [...subChain.swaps, ...ourSwap.swaps],
                newAssignments: [...subChain.newAssignments, ...ourSwap.newAssignments],
                changes: [...subChain.changes, ...ourSwap.changes],
                description: `Multi-level chain: ${subChain.description} → ${ourSwap.description}`
              };
            }
          }
        }
      }
    }

    return { success: false };
  }

  /**
   * NEW: Find all potential replacement staff for a student
   */
  findPotentialReplacements(student, session, program, staff, schedule, excludeIds = []) {
    const replacements = staff.filter(s => {
      if (!s.isActive) return false;
      if (!['RBT', 'BS'].includes(s.role)) return false; // Only RBT/BS in auto-assign/swap
      if (!s.canWorkProgram(program)) return false;
      if (excludeIds.includes(s.id)) return false;
      if (!student.teamIds.includes(s.id)) return false;
      if (!this.canStaffDoDirectService(s)) return false;
      if (schedule.hasStaffWorkedWithStudentToday(s.id, student.id)) return false; // No same-student all day
      // Don't check availability here - we want ALL team members
      return true;
    });

    // Sort by priority (RBT/BS first)
    return this.sortStaffForStudentStrict(student, replacements, session);
  }

  /**
   * NEW: Create a swap chain structure
   */
  createSwapChain(targetStaff, finalStudent, finalSession, finalProgram, currentStudent, currentAssignment, replacementStaff, schedule, staff, students) {
    console.log(`          🔨 Creating swap chain:`);
    console.log(`             1. ${replacementStaff.name} → ${currentStudent.name} (${currentAssignment.program} ${currentAssignment.session})`);
    console.log(`             2. ${targetStaff.name} → ${finalStudent.name} (${finalProgram} ${finalSession})`);

    // CRITICAL: Check if targetStaff is already assigned to finalStudent in ANY session
    const alreadyWithFinalStudent = schedule.assignments.some(a =>
      a.staffId === targetStaff.id &&
      a.studentId === finalStudent.id
    );
    
    if (alreadyWithFinalStudent) {
      console.log(`          🚫 BLOCKED: ${targetStaff.name} is already assigned to ${finalStudent.name} in another session`);
      return { success: false };
    }

    // Create replacement assignment
    const replacementAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: replacementStaff.id,
      staffName: replacementStaff.name,
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      session: currentAssignment.session,
      program: currentAssignment.program,
      date: schedule.date,
      isLocked: false,
      assignedBy: 'chain-swap'
    });

    // Create final assignment
    const finalAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: targetStaff.id,
      staffName: targetStaff.name,
      studentId: finalStudent.id,
      studentName: finalStudent.name,
      session: finalSession,
      program: finalProgram,
      date: schedule.date,
      isLocked: false,
      assignedBy: 'chain-swap'
    });

    // Validate both
    const errors1 = SchedulingRules.validateAssignment(replacementAssignment, schedule, staff, [currentStudent]);
    const errors2 = SchedulingRules.validateAssignment(finalAssignment, schedule, staff, [finalStudent]);

    if (errors1.length > 0) {
      console.log(`          ❌ Replacement validation failed: ${errors1.join(', ')}`);
      return { success: false };
    }

    if (errors2.length > 0) {
      console.log(`          ❌ Final validation failed: ${errors2.join(', ')}`);
      return { success: false };
    }

    return {
      success: true,
      chain: [
        { from: replacementStaff.name, to: currentStudent.name },
        { from: targetStaff.name, to: finalStudent.name }
      ],
      swaps: [{
        description: `Chain: ${replacementStaff.name} → ${currentStudent.name}, ${targetStaff.name} → ${finalStudent.name}`
      }],
      newAssignments: [replacementAssignment, finalAssignment],
      changes: [
        { type: 'remove', assignmentId: currentAssignment.id },
        { type: 'add', assignment: replacementAssignment },
        { type: 'add', assignment: finalAssignment }
      ],
      description: `${replacementStaff.name} covers ${currentStudent.name}, freeing ${targetStaff.name} for ${finalStudent.name}`
    };
  }

  /**
   * Redistribute from students who have more staff than needed
   */
  async redistributeFromOverAssigned(targetStudent, targetSession, targetProgram, staff, students, schedule) {
    console.log(`    🔍 Looking for over-assigned students...`);

    // This would handle cases where a 1:1 student somehow has 2 staff, etc.
    // For now, return failure as this is less common
    return { success: false };
  }

  /**
   * Complete schedule reshuffle - tries to reassign EVERYTHING to fill gaps
   */
  async performFullScheduleReshuffle(schedule, staff, students) {
    console.log('\n🔄 ========== FULL SCHEDULE RESHUFFLE ==========');
    console.log('📊 Starting comprehensive reassignment to eliminate all gaps...');

    const sessions = ['AM', 'PM'];
    const programs = [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY];

    // First, identify all unassigned students
    const unassignedStudents = [];
    for (const program of programs) {
      for (const session of sessions) {
        students.filter(s => s.isActive && s.program === program).forEach(student => {
          // Skip students who are absent for this session
          if (!student.isAvailableForSession(session)) {
            return;
          }
          
          if (!this.isStudentAssigned(student.id, session, program, schedule)) {
            unassignedStudents.push({ student, session, program });
          }
        });
      }
    }

    if (unassignedStudents.length === 0) {
      console.log('✅ No unassigned students - schedule is complete!');
      return { success: true, swaps: [] };
    }

    console.log(`📋 Found ${unassignedStudents.length} unassigned student-sessions`);
    unassignedStudents.forEach(u => {
      console.log(`  - ${u.student.name} (${u.program} ${u.session})`);
    });

    // For each unassigned student, try increasingly aggressive strategies
    const allSwaps = [];
    const allNewAssignments = [];
    let iteration = 0;
    const maxIterations = 20;

    while (unassignedStudents.length > 0 && iteration < maxIterations) {
      iteration++;
      console.log(`\n🔄 Reshuffle Iteration ${iteration}/${maxIterations}`);

      const currentUnassigned = { ...unassignedStudents[0] };
      const { student, session, program } = currentUnassigned;

      console.log(`\n🎯 Attempting to assign: ${student.name} (${program} ${session})`);

      // NEW Strategy 1: Try simple swap with unassigned staff FIRST
      const smartSwap = await this.findSimpleSwapWithUnassignedStaff(
        student, session, program, staff, students, schedule
      );

      if (smartSwap.success) {
        console.log(`  ✅ SUCCESS via smart swap: ${smartSwap.description}`);
        allSwaps.push(...smartSwap.swaps);
        allNewAssignments.push(...smartSwap.newAssignments);

        smartSwap.changes.forEach(change => {
          if (change.type === 'add') schedule.addAssignment(change.assignment);
          else if (change.type === 'remove') schedule.removeAssignment(change.assignmentId);
        });

        unassignedStudents.shift();
        continue;
      }

      // Strategy 2: Find underutilized team members (existing complex chain logic)
      const swapResult = await this.findAndSwapUnderutilizedStaff(
        student, session, program, staff, students, schedule
      );

      if (swapResult.success) {
        console.log(`  ✅ SUCCESS via swap: ${swapResult.description}`);
        allSwaps.push(...swapResult.swaps);
        allNewAssignments.push(...swapResult.newAssignments);

        // Apply changes
        swapResult.changes.forEach(change => {
          if (change.type === 'add') schedule.addAssignment(change.assignment);
          else if (change.type === 'remove') schedule.removeAssignment(change.assignmentId);
        });

        // Remove from unassigned list
        unassignedStudents.shift();
        continue;
      }

      // Strategy 2: Find over-assigned students who could share staff
      const redistributeResult = await this.redistributeFromOverAssigned(
        student, session, program, staff, students, schedule
      );

      if (redistributeResult.success) {
        console.log(`  ✅ SUCCESS via redistribution: ${redistributeResult.description}`);
        allSwaps.push(...redistributeResult.swaps);
        allNewAssignments.push(...redistributeResult.newAssignments);

        redistributeResult.changes.forEach(change => {
          if (change.type === 'add') schedule.addAssignment(change.assignment);
          else if (change.type === 'remove') schedule.removeAssignment(change.assignmentId);
        });

        unassignedStudents.shift();
        continue;
      }

      // If we get here, this student truly cannot be assigned
      console.log(`  ❌ Cannot assign ${student.name} - moving to end of queue`);
      unassignedStudents.push(unassignedStudents.shift());

      // If we've cycled through all students without progress, break
      if (iteration % unassignedStudents.length === 0) {
        console.log(`  🛑 No progress after full cycle - stopping reshuffle`);
        break;
      }
    }

    console.log(`\n🎯 RESHUFFLE COMPLETE:`);
    console.log(`  Iterations: ${iteration}`);
    console.log(`  Swaps made: ${allSwaps.length}`);
    console.log(`  New assignments: ${allNewAssignments.length}`);
    console.log(`  Remaining unassigned: ${unassignedStudents.length}`);

    return {
      success: unassignedStudents.length === 0,
      swaps: allSwaps,
      newAssignments: allNewAssignments,
      remainingUnassigned: unassignedStudents
    };
  }

  /**
   * Phase 0: Place a single training pair (trainee + trainer) into the schedule and lock both.
   * Adds the trainee to schedule.traineeAssignments and the trainer to schedule.assignments.
   * Returns true on success, false if the trainer slot is no longer available.
   */
  placeTrainingPair(trainee, trainer, student, session, schedule) {
    // Re-check trainer availability at placement time (state may have changed during loop)
    if (!schedule.isStaffAvailable(trainer.id, session, student.program)) {
      console.log(`  ⚠️ Trainer ${trainer.name} no longer available for ${session} — skipping`);
      return false;
    }

    // Add trainee as a locked trainee assignment
    const traineeAssignmentId = `trainee_auto_${student.id}_${session}_${trainee.id}_${Date.now()}`;
    schedule.addTraineeAssignment({
      id: traineeAssignmentId,
      staffId: trainee.id,
      staffName: trainee.name,
      studentId: student.id,
      studentName: student.name,
      session,
      program: student.program,
      date: schedule.date,
      isLocked: true,
      isTrainee: true,
      assignedBy: 'auto-training'
    });

    // Add trainer as a locked main-staff assignment
    const trainerAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: trainer.id,
      staffName: trainer.name,
      studentId: student.id,
      studentName: student.name,
      session,
      program: student.program,
      date: schedule.date,
      isLocked: true,
      assignedBy: 'auto-training'
    });
    schedule.addAssignment(trainerAssignment);
    schedule.lockAssignment(trainerAssignment.id);

    console.log(`  ✅ Locked pair: ${trainee.name} (trainee) + ${trainer.name} (trainer) → ${student.name} ${session}`);
    return true;
  }

  /**
   * Phase 0: Auto-assign training pairs before regular scheduling.
   *
   * Rules enforced:
   * - Trainees with NO solo cases MUST be placed with a trainer every available session.
   * - Trainees WITH solo cases get placed with a trainer when possible; can work solo otherwise.
   * - Trainers (and all solo staff) may NOT work with the same student in both AM and PM.
   * - A trainer-trainee pair CAN follow each other across students all day
   *   (e.g. Student A AM → Student B PM with the same trainer).
   * - Any manually pre-placed training assignments are respected and not overridden.
   * - All placed pairs are locked.
   *
   * Priority for trainer selection:
   *   1. Same trainer the trainee is already paired with today (keeps pairs together cross-session)
   *   2. Designated trainer (TRAINER status) for that specific training student
   *   3. Any staff with TRAINER status who is on the training student's team and available
   */
  autoAssignTrainingPairs(schedule, staff, students, selectedDate = new Date()) {
    console.log('\n🎓 ========== PHASE 0: TRAINING PAIR ASSIGNMENT ==========');

    const activeStaff = staff.filter(s => s.isActive);
    const activeStudents = students.filter(s => s.isActive && s.isScheduledForDay(selectedDate));

    // Identify all trainees: staff who are overlap-staff or overlap-bcba for at least one student
    const trainees = activeStaff.filter(trainee =>
      activeStudents.some(student => {
        const status = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(trainee.id) : null;
        return status === TRAINING_STATUS.OVERLAP_STAFF || status === TRAINING_STATUS.OVERLAP_BCBA;
      })
    );

    if (trainees.length === 0) {
      console.log('  ℹ️ No trainees found — skipping Phase 0');
      return { placed: [], skipped: [] };
    }

    console.log(`  📊 Found ${trainees.length} trainee(s)`);

    // Sort: trainees with NO solo cases first — they have stricter requirements
    trainees.sort((a, b) => {
      const aHasSolo = this.staffHasAnySoloCase(a, students);
      const bHasSolo = this.staffHasAnySoloCase(b, students);
      if (!aHasSolo && bHasSolo) return -1;
      if (aHasSolo && !bHasSolo) return 1;
      return 0;
    });

    const placed = [];
    const skipped = [];

    for (const trainee of trainees) {
      const hasSoloCases = this.staffHasAnySoloCase(trainee, students);
      console.log(`\n  👤 ${trainee.name} (has solo cases: ${hasSoloCases})`);

      for (const session of ['AM', 'PM']) {
        if (!trainee.isAvailableForSession(session)) {
          console.log(`    ⏭️ Unavailable for ${session}`);
          continue;
        }

        // Skip if already placed as trainee in this session (manual or prior Phase 0 run)
        const alreadyPlaced = schedule.traineeAssignments &&
          schedule.traineeAssignments.some(ta => ta.staffId === trainee.id && ta.session === session);
        if (alreadyPlaced) {
          console.log(`    ✅ Already placed as trainee in ${session} — skipping`);
          continue;
        }

        // Find students where this trainee has overlap status AND student is available this session
        const trainingCandidates = activeStudents.filter(student => {
          const status = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(trainee.id) : null;
          if (status !== TRAINING_STATUS.OVERLAP_STAFF && status !== TRAINING_STATUS.OVERLAP_BCBA) return false;
          if (!student.isAvailableForSession(session, selectedDate)) return false;
          // Skip if student already has a main-staff assignment this session
          if (schedule.assignments.some(a => a.studentId === student.id && a.session === session)) return false;
          return true;
        });

        console.log(`    🔍 ${session}: ${trainingCandidates.length} training candidate(s)`);

        if (trainingCandidates.length === 0) {
          if (!hasSoloCases) {
            console.log(`    ⚠️ No candidates and no solo cases — ${trainee.name} unplaceable in ${session}`);
            skipped.push({ trainee: trainee.name, session, reason: 'No training candidates available' });
          }
          continue;
        }

        let placedThisSession = false;

        // ── Priority 1: Designated trainer (TRAINER status) for this specific student ──
        // Trainer-trainee pairing is per student, not per day.
        // Each student has its own designated trainer(s); we always use that student's trainer.
        for (const student of trainingCandidates) {
          const designatedTrainers = activeStaff.filter(s => {
            const trainerStatus = student.getStaffTrainingStatus ? student.getStaffTrainingStatus(s.id) : null;
            if (trainerStatus !== TRAINING_STATUS.TRAINER) return false;
            if (!s.isAvailableForSession(session)) return false;
            if (!schedule.isStaffAvailable(s.id, session, student.program)) return false;
            // Trainer cannot work with the same student AM + PM
            if (schedule.hasStaffWorkedWithStudentToday(s.id, student.id)) return false;
            return true;
          });

          if (designatedTrainers.length === 0) continue;

          // Pick trainer with the lightest current load
          designatedTrainers.sort((a, b) =>
            schedule.getStaffAssignments(a.id).length - schedule.getStaffAssignments(b.id).length
          );

          const success = this.placeTrainingPair(trainee, designatedTrainers[0], student, session, schedule);
          if (success) {
            placed.push({ trainee: trainee.name, trainer: designatedTrainers[0].name, student: student.name, session });
            placedThisSession = true;
            break;
          }
        }
        if (placedThisSession) continue;

        // ── Priority 2: Any staff with TRAINER status on the training student's team ──
        // Used as fallback — especially critical when trainee has no solo cases.
        if (!hasSoloCases) {
          for (const student of trainingCandidates) {
            const anyTrainer = activeStaff.find(s => {
              // Must have TRAINER designation for at least one active student
              const isTrainer = activeStudents.some(st => {
                const st_status = st.getStaffTrainingStatus ? st.getStaffTrainingStatus(s.id) : null;
                return st_status === TRAINING_STATUS.TRAINER;
              });
              if (!isTrainer) return false;
              if (!student.teamIds.includes(s.id)) return false;
              if (!s.isAvailableForSession(session)) return false;
              if (!schedule.isStaffAvailable(s.id, session, student.program)) return false;
              if (schedule.hasStaffWorkedWithStudentToday(s.id, student.id)) return false;
              return true;
            });

            if (anyTrainer) {
              const success = this.placeTrainingPair(trainee, anyTrainer, student, session, schedule);
              if (success) {
                placed.push({ trainee: trainee.name, trainer: anyTrainer.name, student: student.name, session, note: 'non-usual trainer' });
                placedThisSession = true;
                break;
              }
            }
          }
        }

        if (!placedThisSession) {
          if (!hasSoloCases) {
            console.log(`    ⚠️ UNPLACED: ${trainee.name} has no solo cases and no trainer found for ${session}`);
            skipped.push({ trainee: trainee.name, session, reason: 'No trainer available' });
          } else {
            console.log(`    ℹ️ ${trainee.name} not placed in training for ${session} — has solo cases, can work solo`);
          }
        }
      }
    }

    console.log(`\n  ✅ PHASE 0 COMPLETE: ${placed.length} training pair(s) placed`);
    placed.forEach(p =>
      console.log(`    🎓 ${p.trainee} + ${p.trainer} → ${p.student} ${p.session}${p.note ? ` (${p.note})` : ''}`)
    );
    if (skipped.length > 0) {
      console.log(`  ⚠️ ${skipped.length} trainee(s) could not be placed:`);
      skipped.forEach(s => console.log(`    ❌ ${s.trainee} ${s.session}: ${s.reason}`));
    }

    return { placed, skipped };
  }

  /**
   * Auto-assign all unassigned students for a given date
   * @param {Schedule} schedule - Current schedule
   * @param {Staff[]} staff - Array of staff members
   * @param {Student[]} students - Array of students
   * @returns {Assignment[]} Array of new assignments created
   */
  async autoAssignSchedule(schedule, staff, students, selectedDate = new Date()) {
    const newAssignments = [];
    const errors = [];

    console.log('\n🚀 ========== STARTING AUTO-ASSIGNMENT ==========');

    const activeStaff = staff.filter(s => s.isActive);
    const activeStudents = students.filter(s => s.isActive && s.isScheduledForDay(selectedDate));
    
    // Store students for use in isStudentAssigned
    this.currentStudents = activeStudents;

    console.log(`📊 Active: ${activeStaff.length} staff, ${activeStudents.length} students`);
    console.log(`📊 Attendance - Staff absent AM: ${activeStaff.filter(s => s.absentAM || s.absentFullDay).length}, PM: ${activeStaff.filter(s => s.absentPM || s.absentFullDay).length}`);
    console.log(`📊 Attendance - Students absent AM: ${activeStudents.filter(s => s.absentAM || s.absentFullDay).length}, PM: ${activeStudents.filter(s => s.absentPM || s.absentFullDay).length}`);

    // PHASE 1: Initial assignment pass
    const sessions = ['AM', 'PM'];
    const programs = [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY];

    for (const program of programs) {
      for (const session of sessions) {
        console.log(`\n📋 ===== ${program} ${session} =====`);

        const programStudents = activeStudents.filter(student =>
          student.program === program &&
          student.isAvailableForSession(session) && // Check attendance
          !this.isStudentAssigned(student.id, session, program, schedule)
        );

        const prioritizedStudents = this.prioritizeStudents(programStudents, session);

        for (const student of prioritizedStudents) {
          try {
            if (student.isPaired()) {
              const pairedStudent = student.getPairedStudent(activeStudents);
              if (pairedStudent && programStudents.includes(pairedStudent)) {
                const assignments = await this.assignPairedStudents(
                  student, pairedStudent, session, program, activeStaff, schedule, activeStudents
                );

                if (assignments.length > 0) {
                  newAssignments.push(...assignments);
                  assignments.forEach(a => schedule.addAssignment(a));

                  const pairedIndex = prioritizedStudents.indexOf(pairedStudent);
                  if (pairedIndex > -1) prioritizedStudents.splice(pairedIndex, 1);
                } else {
                  errors.push(`Could not assign paired: ${student.name} & ${pairedStudent.name}`);
                }
                continue;
              }
            }

            const assignments = await this.assignStudent(
              student, session, program, activeStaff, schedule, activeStudents
            );

            if (assignments.length > 0) {
              // Validate each assignment before adding to schedule
              const validAssignments = [];
              for (const assignment of assignments) {
                const validationErrors = SchedulingRules.validateAssignment(
                  assignment, schedule, activeStaff, activeStudents
                );
                
                if (validationErrors.length === 0) {
                  schedule.addAssignment(assignment);
                  validAssignments.push(assignment);
                } else {
                  console.log(`  🚫 BLOCKED assignment of ${assignment.staffName} to ${assignment.studentName}: ${validationErrors.join(', ')}`);
                }
              }
              
              newAssignments.push(...validAssignments);
              
              if (validAssignments.length === 0) {
                errors.push(`Could not assign: ${student.name} in ${program} ${session} (validation failed)`);
              }
            } else {
              errors.push(`Could not assign: ${student.name} in ${program} ${session}`);
            }
          } catch (error) {
            errors.push(`Error: ${student.name} - ${error.message}`);
          }
        }
      }
    }

    console.log(`\n✅ PHASE 1 COMPLETE: ${newAssignments.length} assignments created`);

    // PHASE 2: Check for gaps and perform FULL RESHUFFLE if needed
    const unassignedCount = this.countUnassignedStudents(schedule, students);

    if (unassignedCount > 0) {
      console.log(`\n🔄 PHASE 2: ${unassignedCount} gaps found - initiating FULL RESHUFFLE`);

      const reshuffleResults = await this.performFullScheduleReshuffle(
        schedule, staff, students
      );

      if (reshuffleResults.success) {
        console.log(`\n🎉 RESHUFFLE SUCCESS: All students assigned!`);
        newAssignments.push(...reshuffleResults.newAssignments);
      } else {
        console.log(`\n⚠️ RESHUFFLE INCOMPLETE: ${reshuffleResults.remainingUnassigned.length} still unassigned`);
        reshuffleResults.remainingUnassigned.forEach(u => {
          errors.push(`Final gap: ${u.student.name} in ${u.program} ${u.session}`);
        });
      }
    } else {
      console.log(`\n✅ PHASE 2: No gaps found - schedule is perfect!`);
    }

    // PHASE 3: Swap Optimization - Try to fill remaining gaps by swapping available staff
    const remainingUnassignedCount = this.countUnassignedStudents(schedule, students);
    
    if (remainingUnassignedCount > 0) {
      console.log(`\n🔀 PHASE 3: ${remainingUnassignedCount} gaps remain - attempting SWAP OPTIMIZATION`);
      
      const swapResults = await this.performSwapOptimization(schedule, staff, students);
      
      if (swapResults.swapsMade > 0) {
        console.log(`\n✅ SWAP OPTIMIZATION: Made ${swapResults.swapsMade} swaps, filled ${swapResults.gapsFilled} gaps`);
        newAssignments.push(...swapResults.newAssignments);
        swapResults.swaps.forEach(swap => {
          console.log(`  ✓ ${swap.description}`);
        });
      } else {
        console.log(`\n⚠️ SWAP OPTIMIZATION: No beneficial swaps found`);
      }
    }

    console.log(`\n🎯 ========== AUTO-ASSIGNMENT COMPLETE ==========`);
    console.log(`📊 Total assignments: ${newAssignments.length}`);
    console.log(`❌ Errors: ${errors.length}`);

    return { assignments: newAssignments, errors };
  }

  /**
   * Assign staff to a specific student
   * @param {Student} student - Student to assign
   * @param {string} session - AM or PM
   * @param {string} program - Primary or Secondary
   * @param {Staff[]} staff - Available staff
   * @param {Schedule} schedule - Current schedule
   * @param {Student[]} students - All students (for training-only check)
   * @returns {Assignment[]} Array of assignments created
   */
  async assignStudent(student, session, program, staff, schedule, students) {
    const assignments = [];
    const staffCount = this.getRequiredStaffCount(student, session);

    console.log(`\n🎯 Assigning ${student.name} for ${program} ${session} (needs ${staffCount} staff)`);

    if (student.isSmallGroup(session)) {
      return this.assignSmallGroupStudent(student, session, program, staff, schedule, students);
    }

    // Get available staff
    const availableStaff = SchedulingUtils.getAvailableStaffForStudent(
      student, session, program, staff, schedule, students
    );

    // STRICT FILTER: Only team members who can do direct service
    let teamStaff = availableStaff.filter(staffMember => {
      const isInTeam = student.teamIds.includes(staffMember.id) ||
        (staffMember.email && student.team?.some(tm =>
          tm.email?.toLowerCase() === staffMember.email?.toLowerCase()
        )) ||
        (student.team?.some(tm =>
          (tm.title || tm.name)?.toLowerCase() === staffMember.name?.toLowerCase()
        ));

      if (!isInTeam) return false;

      // Block Teachers and Directors completely
      const blockedRoles = ['Teacher', 'Director', 'TEACHER', 'DIRECTOR'];
      if (blockedRoles.includes(staffMember.role)) {
        this.verboseLog(`  🚫 BLOCKING ${staffMember.name}: ${staffMember.role} cannot do direct service`);
        return false;
      }

      if (!staffMember.canDoDirectSessions()) {
        this.verboseLog(`  🚫 BLOCKING ${staffMember.name}: Cannot do direct sessions`);
        return false;
      }

      // EXCLUDE staff who are in training for this student
      // They should only be assigned as trainees, not main staff
      if (this.isStaffInTrainingForStudent(staffMember, student)) {
        const trainingStatus = student.getStaffTrainingStatus(staffMember.id);
        console.log(`  🚫 EXCLUDING ${staffMember.name}: In training for ${student.name} (status: ${trainingStatus}) - trainee only`);
        return false;
      }

      // CRITICAL: EXCLUDE staff who have NO solo cases at all (training-only staff)
      // Check if this staff member has at least ONE solo/certified case with ANY student
      const hasAnySoloCase = this.staffHasAnySoloCase(staffMember, students);
      if (!hasAnySoloCase) {
        console.log(`  🚫 BLOCKING ${staffMember.name}: NO SOLO CASES - training-only staff cannot be auto-assigned`);
        console.log(`     Staff ${staffMember.name} team assignments:`, students
          .filter(s => s.teamIds && s.teamIds.includes(staffMember.id))
          .map(s => `${s.name}:${s.getStaffTrainingStatus(staffMember.id)}`)
          .join(', '));
        return false;
      }
      
      // Log for staff who PASSED all checks
      const trainingStatus = student.getStaffTrainingStatus(staffMember.id);
      console.log(`  ✅ ${staffMember.name} ELIGIBLE for ${student.name} (status: ${trainingStatus})`);

      return true;
    });

    this.verboseLog(`  📊 Team staff breakdown:`);
    this.verboseLog(`    Total available: ${availableStaff.length}`);
    console.log(`  📊 Team members available for ${student.name} ${session}: ${teamStaff.length}`);

    // STRICT ROLE FILTER: Only RBT and BS are eligible for auto-assign
    const finalTeamStaff = teamStaff.filter(s => s.role === 'RBT' || s.role === 'BS');

    this.verboseLog(`    RBT: ${finalTeamStaff.filter(s => s.role === 'RBT').length}`);
    this.verboseLog(`    BS (fallback): ${finalTeamStaff.filter(s => s.role === 'BS').length}`);
    this.verboseLog(`    Excluded (non-RBT/BS): ${teamStaff.length - finalTeamStaff.length}`);

    if (finalTeamStaff.length < staffCount) {
      console.log(`  ❌ INSUFFICIENT for ${student.name}: Need ${staffCount}, have ${finalTeamStaff.length} team members`);
      return [];
    }

    // Sort with hierarchy but add randomization for better distribution
    const sortedStaff = this.sortStaffForStudentWithShuffling(student, finalTeamStaff, session, schedule);

    this.verboseLog(`  📋 Assignment order:`);
    sortedStaff.slice(0, staffCount).forEach((s, i) => {
      this.verboseLog(`    ${i + 1}. ${s.name} (${s.role})`);
    });

    // CRITICAL: Before we start assigning, filter out any staff already with this student in the other session
    const otherSession = session === 'AM' ? 'PM' : 'AM';
    const staffAlreadyWithStudentInOtherSession = new Set(
      schedule.assignments
        .filter(a => a.studentId === student.id && a.session === otherSession)
        .map(a => a.staffId)
    );
    
    if (staffAlreadyWithStudentInOtherSession.size > 0) {
      const blockedStaffNames = staff
        .filter(s => staffAlreadyWithStudentInOtherSession.has(s.id))
        .map(s => s.name)
        .join(', ');
      console.log(`  🚫 PRE-FILTERING: ${blockedStaffNames} already with ${student.name} in ${otherSession}`);
    }

    // Assign exactly the number needed
    let assignedCount = 0;
    let staffIndex = 0;
    
    while (assignedCount < staffCount && staffIndex < sortedStaff.length) {
      const currentStaff = sortedStaff[staffIndex];
      staffIndex++;
      
      // CRITICAL: Check if this staff is already assigned to this student in the OTHER session
      // We don't want the same staff working with the same student all day
      // This check ensures rotation and prevents burnout
      const otherSession = session === 'AM' ? 'PM' : 'AM';
      
      // Skip if already filtered out
      if (staffAlreadyWithStudentInOtherSession.has(currentStaff.id)) {
        console.log(`  🚫 SAME-DAY SKIP: ${currentStaff.name} already with ${student.name} in ${otherSession} (pre-filtered)`);
        continue;
      }
      
      // Double-check both schedule assignments AND assignments we're creating in this function call
      const alreadyWithStudentInOtherSessionInSchedule = schedule.assignments.some(a =>
        a.staffId === currentStaff.id &&
        a.studentId === student.id &&
        a.session === otherSession
      );
      
      const alreadyWithStudentInOtherSessionInCurrentRun = assignments.some(a =>
        a.staffId === currentStaff.id &&
        a.studentId === student.id &&
        a.session === otherSession
      );
      
      const alreadyWithStudentInOtherSession = alreadyWithStudentInOtherSessionInSchedule || alreadyWithStudentInOtherSessionInCurrentRun;
      
      if (alreadyWithStudentInOtherSession) {
        console.log(`  🚫 SAME-DAY SKIP: ${currentStaff.name} already with ${student.name} in ${otherSession}`);
        continue; // Skip this staff, try the next one
      }
      
      const assignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        studentId: student.id,
        studentName: student.name,
        session,
        program,
        date: schedule.date,
        isLocked: false,
        assignedBy: 'auto'
      });
      
      assignedCount++;

      const validationErrors = SchedulingRules.validateAssignment(
        assignment, schedule, staff, [student]
      );

      if (validationErrors.length === 0) {
        assignments.push(assignment);
        this.verboseLog(`  ✅ Assigned ${currentStaff.name} (${currentStaff.role})`);
      } else {
        this.verboseLog(`  ❌ Cannot assign ${currentStaff.name}: ${validationErrors.join(', ')}`);
      }
    }
    
    // Summary log after all assignments
    if (assignments.length === 0) {
      console.log(`  ❌ NO STAFF assigned to ${student.name} ${session} (needed ${staffCount})`);
    } else if (assignedCount < staffCount) {
      console.log(`  ⚠️ PARTIAL ${student.name} ${session}: ${assignments.length}/${staffCount} - ${assignments.map(a => a.staffName).join(', ')}`);
    } else {
      console.log(`  ✅ ${student.name} ${session}: ${assignments.map(a => a.staffName).join(', ')}`);
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
   * @param {Student[]} students - All students (for training-only check)
   * @returns {Assignment[]} Array of assignments created
   */
  assignSmallGroupStudent(student, session, program, staff, schedule, students) {
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
      if (assignedStudent && assignedStudent.isSmallGroup(session)) {
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
              staffName: staffMember.name,
              studentId: student.id,
              studentName: student.name,
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
      student, session, program, staff, schedule, students
    );

    // FILTER TO ONLY TEAM MEMBERS - this ensures dropdown compatibility
    let teamStaff = availableStaff.filter(staffMember => {
      // Must be on the student's team
      if (!student.teamIds.includes(staffMember.id)) return false;
      
      // EXCLUDE staff who are in training for this student
      if (this.isStaffInTrainingForStudent(staffMember, student)) {
        return false;
      }
      
      // CRITICAL: EXCLUDE staff who have NO solo cases at all (training-only staff)
      const hasAnySoloCase = this.staffHasAnySoloCase(staffMember, students);
      if (!hasAnySoloCase) {
        console.log(`  🚫 BLOCKING ${staffMember.name}: NO SOLO CASES - training-only staff cannot be auto-assigned`);
        return false;
      }
      
      return true;
    });

    // ADDITIONAL FILTERING: Only use preferred direct service staff (RBTs/BSs)
    const preferredTeamStaff = teamStaff.filter(staffMember => staffMember.isPreferredDirectService());
    
    // Use preferred staff if available, otherwise fall back to all team staff who can do direct sessions
    teamStaff = preferredTeamStaff.length > 0 ? preferredTeamStaff : teamStaff.filter(staffMember => staffMember.canDoDirectSessions());

    if (teamStaff.length > 0) {
      const sortedStaff = this.sortStaffForStudentWithShuffling(student, teamStaff, session, schedule);
      const assignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: sortedStaff[0].id,
        staffName: sortedStaff[0].name,
        studentId: student.id,
        studentName: student.name,
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
      return (a?.name || '').localeCompare(b?.name || '');
    });
  }

  /**
   * Enhanced staff sorting with session-based shuffling for better PM distribution
   * IMPORTANT: This should ONLY receive team members - non-team members must be filtered out before calling
   * @param {Student} student - Student to assign
   * @param {Staff[]} availableStaff - Available TEAM MEMBER staff (already filtered)
   * @param {string} session - 'AM' or 'PM'
   * @param {Schedule} schedule - Current schedule for caseload calculation
   * @returns {Staff[]} Sorted staff array
   */
  sortStaffForStudentWithShuffling(student, availableStaff, session, schedule = null) {
    // PRIORITY 1: Only use preferred direct service providers (RBTs, BSs) if available
    const preferredStaff = availableStaff.filter(staff => staff.isPreferredDirectService());

    // Use preferred staff if available, otherwise fall back to all available staff
    const staffToUse = preferredStaff.length > 0 ? preferredStaff : availableStaff;

    // ENHANCED: Much stronger randomization to create significant variation between auto-assign runs
    // This ensures different staff are selected each time, creating better rotation
    const randomizationFactor = session === 'PM' ? 8.0 : 6.0; // Increased for more variability

    const staffWithPriority = [...staffToUse].map(staff => ({
      staff,
      roleLevel: staff.getRoleLevel(),
      isPreferred: staff.isPreferredDirectService(),
      caseload: schedule ? schedule.getStaffAssignments(staff.id).length : 0,
      // Much stronger random factor for significant variation between runs
      randomFactor: Math.random() * randomizationFactor
    }));

    return staffWithPriority.sort((a, b) => {
      // Preferred direct service providers first (RBTs/BSs over EAs)
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;

      // Balance caseload but with flexibility
      // Only strongly prefer lower caseload if the difference is significant (2+ assignments)
      if (schedule && Math.abs(a.caseload - b.caseload) >= 2) {
        return a.caseload - b.caseload;
      }

      // ENHANCED: Use STRONG randomization to create variation
      // The large randomization factor means staff order changes significantly on each run
      // This creates natural rotation without being completely random
      const aScore = (a.roleLevel * 0.5) + a.randomFactor; // Reduced role weight, increased random weight
      const bScore = (b.roleLevel * 0.5) + b.randomFactor;

      return aScore - bScore;
    }).map(item => item.staff);
  }

  /**
   * Prioritize students for assignment (2:1 ratio first, etc.)
   * @param {Student[]} students - Students to prioritize
   * @param {string} session - 'AM' or 'PM' session to check ratios for
   * @returns {Student[]} Sorted students array
   */
  prioritizeStudents(students, session = 'AM') {
    // Get staff reference from the first student if available
    const allStaff = this.currentStudents && this.currentStudents.length > 0 
      ? this.currentStudents[0].staff || [] 
      : [];
    
    return [...students].sort((a, b) => {
      // 0. HIGHEST PRIORITY: Paired students (1:2 ratio) - they must be assigned together
      const aIsPaired = a.isPaired && a.isPaired();
      const bIsPaired = b.isPaired && b.isPaired();
      if (aIsPaired && !bIsPaired) return -1;
      if (!aIsPaired && bIsPaired) return 1;
      
      // 1. SECOND PRIORITY: 2:1 ratio students (they need 2 staff) - session-specific
      const aIs2to1 = a.requiresMultipleStaff(session);
      const bIs2to1 = b.requiresMultipleStaff(session);
      if (aIs2to1 && !bIs2to1) return -1;
      if (!aIs2to1 && bIs2to1) return 1;
      
      // 2. THIRD PRIORITY: Students with more absent team members first (harder to staff)
      // Count how many of their team members are absent for this session
      const aAbsentCount = a.teamIds.filter(staffId => {
        const staffMember = allStaff.find(s => s.id === staffId);
        return staffMember && !staffMember.isAvailableForSession(session);
      }).length;
      
      const bAbsentCount = b.teamIds.filter(staffId => {
        const staffMember = allStaff.find(s => s.id === staffId);
        return staffMember && !staffMember.isAvailableForSession(session);
      }).length;
      
      // More absences = higher priority (harder to staff)
      if (aAbsentCount !== bAbsentCount) return bAbsentCount - aAbsentCount;

      // 3. Students with fewer team members first (harder to staff)
      const aTeamSize = a.teamIds.length;
      const bTeamSize = b.teamIds.length;
      if (aTeamSize !== bTeamSize) return aTeamSize - bTeamSize;

      // 4. Then alphabetically for consistency
      return (a?.name || '').localeCompare(b?.name || '');
    });
  }

  /**
   * Get the number of staff required for a student based on their ratio for a specific session
   * @param {Student} student - Student to check
   * @param {string} session - 'AM' or 'PM'
   * @returns {number} Number of staff needed
   */
  getRequiredStaffCount(student, session = 'AM') {
    const ratio = session === 'AM' ? student.ratioAM : student.ratioPM;
    switch (ratio) {
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
    // CRITICAL: Only count main staff assignments, NOT trainee assignments
    // Trainees don't provide coverage, so student still needs main staff
    let studentAssignments = sessionAssignments.filter(assignment => 
      assignment.studentId === studentId && !assignment.isTrainee
    );
    
    // CRITICAL: Also check pending swap assignments being created in current pass
    if (this._pendingSwapAssignments) {
      const pendingForStudent = this._pendingSwapAssignments.filter(assignment =>
        assignment.studentId === studentId && 
        assignment.session === session && 
        assignment.program === program &&
        !assignment.isTrainee
      );
      studentAssignments = [...studentAssignments, ...pendingForStudent];
    }
    
    if (studentAssignments.length === 0) return false;
    
    // For 2:1 students, check if they have the required number of staff
    // Find the student to check their ratio
    const student = this.currentStudents?.find(s => s.id === studentId);
    if (student) {
      const requiredStaff = this.getRequiredStaffCount(student, session);
      return studentAssignments.length >= requiredStaff;
    }
    
    // If we can't find the student, just check for any assignment
    return studentAssignments.length > 0;
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
   * @param {Student[]} students - All students (for training-only check)
   * @returns {Assignment[]} Array of assignments created
   */
  async assignPairedStudents(student1, student2, session, program, staff, schedule, students) {
    const assignments = [];
    this.log(`\n🔗 Assigning paired students: ${student1.name} and ${student2.name} (${program} ${session})`);

    // Check if either student is already assigned in this session
    if (this.isStudentAssigned(student1.id, session, program, schedule) ||
        this.isStudentAssigned(student2.id, session, program, schedule)) {
      this.log(`  ⚠️ One of the paired students is already assigned`);
      return [];
    }

    // Get the combined staff requirements for both students
    const student1StaffCount = this.getRequiredStaffCount(student1, session);
    const student2StaffCount = this.getRequiredStaffCount(student2, session);
    
    // SPECIAL CASE: For paired 1:2 students, they share the SAME staff (not additive)
    // Example: Henry (1:2) + Sebastian (1:2) = 1 staff total (not 2)
    const bothAre1to2 = student1.isSmallGroup(session) && student2.isSmallGroup(session);
    const totalStaffNeeded = bothAre1to2 ? 1 : (student1StaffCount + student2StaffCount);

    this.log(`  Need: ${student1.name}=${student1StaffCount} staff, ${student2.name}=${student2StaffCount} staff, total=${totalStaffNeeded}${bothAre1to2 ? ' (shared for 1:2 pair)' : ''}`);
    this.log(`  ${student1.name} team (${student1.teamIds.length}): ${staff.filter(s => student1.teamIds.includes(s.id)).map(s => s.name).join(', ')}`);
    this.log(`  ${student2.name} team (${student2.teamIds.length}): ${staff.filter(s => student2.teamIds.includes(s.id)).map(s => s.name).join(', ')}`);

    // Get available staff that can work with BOTH students
    // Must be on both students' teams
    const availableStaff = SchedulingUtils.getAvailableStaffForStudent(
      student1, session, program, staff, schedule, students
    ).filter(staffMember => {
      // Staff must be able to work with student2's program
      if (!this.canStaffWorkWithStudent(staffMember, student2, schedule)) {
        this.log(`  ❌ ${staffMember.name} already worked with ${student2.name} today`);
        return false;
      }
      
      // CRITICAL: Staff must be on BOTH students' teams (for paired students)
      if (!student2.teamIds.includes(staffMember.id)) {
        this.log(`  ❌ ${staffMember.name} is on ${student1.name}'s team but NOT on ${student2.name}'s team`);
        return false;
      }
      
      // CRITICAL: Check if staff is already assigned to student1 in the OTHER session
      // We don't want the same staff working with the same student all day
      const otherSession = session === 'AM' ? 'PM' : 'AM';
      const alreadyWithStudent1InOtherSession = schedule.assignments.some(a =>
        a.staffId === staffMember.id &&
        a.studentId === student1.id &&
        a.session === otherSession
      );
      
      if (alreadyWithStudent1InOtherSession) {
        this.log(`  🚫 SAME-DAY SKIP: ${staffMember.name} already with ${student1.name} in ${otherSession}`);
        return false;
      }
      
      // CRITICAL: Check if staff is already assigned to student2 in the OTHER session
      const alreadyWithStudent2InOtherSession = schedule.assignments.some(a =>
        a.staffId === staffMember.id &&
        a.studentId === student2.id &&
        a.session === otherSession
      );
      
      if (alreadyWithStudent2InOtherSession) {
        this.log(`  🚫 SAME-DAY SKIP: ${staffMember.name} already with ${student2.name} in ${otherSession}`);
        return false;
      }
      
      return true;
    });

    this.log(`  ✅ Shared team members available (${availableStaff.length}): ${availableStaff.map(s => s.name).join(', ')}`);

    if (availableStaff.length < totalStaffNeeded) {
      this.log(`  ❌ INSUFFICIENT STAFF: Need ${totalStaffNeeded}, have ${availableStaff.length}`);
      return [];
    }

    // Sort staff by hierarchy and preferences
    const sortedStaff = this.sortStaffForStudent(student1, availableStaff);

    // For paired students, they should share the same staff
    // This is different from the regular assignment where each student gets their own staff
    let staffIndex = 0;

    // Check if both students have 1:2 ratio (small group)
    if (student1.isSmallGroup(session) && student2.isSmallGroup(session)) {
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
        staffName: sharedStaffMember.name,
        studentId: student1.id,
        studentName: student1.name,
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
        staffName: sharedStaffMember.name,
        studentId: student2.id,
        studentName: student2.name,
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
            staffName: staffMember.name,
            studentId: student1.id,
            studentName: student1.name,
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
            staffName: staffMember.name,
            studentId: student2.id,
            studentName: student2.name,
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
      staffName: replacementStaff.name,
      studentId: assignedStudent.id,
      studentName: assignedStudent.name,
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
      staffName: currentStaff.name,
      studentId: unassignedStudent.id,
      studentName: unassignedStudent.name,
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
      const assignedStudentName = originalAssignment.studentName || '';
      
      // Create replacement assignment
      const replacementAssignment = new Assignment({
        id: SchedulingUtils.generateAssignmentId(),
        staffId: replacementStaff.id,
        staffName: replacementStaff.name,
        studentId: assignedStudentId,
        studentName: assignedStudentName,
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
        staffName: currentStaff.name,
        studentId: unassignedStudent.id,
        studentName: unassignedStudent.name,
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
   * Generate ultimate final report showing all assignments and gaps
   */
  generateUltimateFinalReport(schedule, staff, students) {
    const sessions = ['AM', 'PM'];
    const programs = [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY];
    const unassigned = [];
    let totalAssignments = 0;

    students.forEach(student => {
      const missingSessions = [];
      sessions.forEach(session => {
        if (student.program) { // Only check if student has a program
          const isAssigned = this.isStudentAssigned(student.id, session, student.program, schedule);
          if (isAssigned) {
            totalAssignments++;
          } else {
            missingSessions.push(`${student.program} ${session}`);
          }
        }
      });

      if (missingSessions.length > 0) {
        unassigned.push({ name: student.name, missingSessions });
      }
    });

    return {
      totalStudents: students.length,
      assignedStudents: students.length - unassigned.length,
      unassignedStudents: unassigned,
      totalAssignments: totalAssignments
    };
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

  /**
   * Helper to check if staff has already worked with student today (including pending swap assignments)
   */
  hasStaffWorkedWithStudentIncludingPending(schedule, staffId, studentId) {
    // Check existing schedule
    if (schedule.hasStaffWorkedWithStudentToday(staffId, studentId)) return true;
    // Check pending swap assignments from current optimization pass
    if (this._pendingSwapAssignments) {
      return this._pendingSwapAssignments.some(a => a.staffId === staffId && a.studentId === studentId);
    }
    return false;
  }

  /**
   * Try to fill a gap by finding a cascading chain of reassignments
   * This method aggressively tries to redistribute staff to fill gaps
   * 
   * @param {Student} gapStudent - Student with no assignment (gap)
   * @param {string} session - AM or PM
   * @param {string} program - Primary or Secondary
   * @param {Staff[]} staff - All active staff
   * @param {Student[]} students - All active students
   * @param {Schedule} schedule - Current schedule
   * @param {number} depth - Current recursion depth (max 3)
   * @returns {Object} { success: boolean, assignments: Array, removals: Array }
   */
  async tryCascadingReassignment(gapStudent, session, program, staff, students, schedule, depth = 0) {
    const MAX_DEPTH = 3;
    if (depth >= MAX_DEPTH) {
      console.log(`      ⚠️ Max cascade depth reached for ${gapStudent.name}`);
      return { success: false, assignments: [], removals: [] };
    }

    console.log(`${'  '.repeat(depth)}🔗 CASCADE LEVEL ${depth + 1}: Finding assignment for ${gapStudent.name}`);

    // Find team members of gap student
    const gapTeamMembers = staff.filter(s => 
      gapStudent.teamIds.includes(s.id) &&
      s.isAvailableForSession(session) &&
      s.canWorkProgram(program) &&
      this.canStaffDoDirectService(s) &&
      !this.isStaffInTrainingForStudent(s, gapStudent) &&
      !this.hasStaffWorkedWithStudentIncludingPending(schedule, s.id, gapStudent.id)
    );

    console.log(`${'  '.repeat(depth)}   Team members available: ${gapTeamMembers.length}`);

    // Try each team member
    for (const teamStaff of gapTeamMembers) {
      // Check if this staff is currently assigned
      const currentAssignment = schedule.assignments.find(a =>
        a.staffId === teamStaff.id &&
        a.session === session &&
        !a.isLocked &&
        a.assignedBy !== 'manual'
      );

      if (!currentAssignment) {
        // Staff is free - direct assignment!
        console.log(`${'  '.repeat(depth)}   ✅ DIRECT: ${teamStaff.name} is free → ${gapStudent.name}`);
        
        const newAssignment = new Assignment({
          id: SchedulingUtils.generateAssignmentId(),
          staffId: teamStaff.id,
          staffName: teamStaff.name,
          studentId: gapStudent.id,
          studentName: gapStudent.name,
          session: session,
          program: program,
          date: schedule.date,
          isLocked: false,
          assignedBy: 'auto-swap-cascade'
        });

        return {
          success: true,
          assignments: [newAssignment],
          removals: []
        };
      }

      // Staff is assigned - need to find replacement
      const currentStudent = students.find(s => s.id === currentAssignment.studentId);
      if (!currentStudent) continue;

      // Don't break paired students
      if (currentStudent.isPaired && currentStudent.isPaired()) {
        console.log(`${'  '.repeat(depth)}   ⚠️ Skip ${currentStudent.name} - paired student`);
        continue;
      }

      console.log(`${'  '.repeat(depth)}   🔄 ${teamStaff.name} currently with ${currentStudent.name}, need replacement...`);

      // Try to recursively fill the current student's spot
      const cascadeResult = await this.tryCascadingReassignment(
        currentStudent, session, program, staff, students, schedule, depth + 1
      );

      if (cascadeResult.success) {
        console.log(`${'  '.repeat(depth)}   ✅ CASCADE SUCCESS: ${teamStaff.name} → ${gapStudent.name}`);
        
        // Create the assignment for gap student
        const newAssignment = new Assignment({
          id: SchedulingUtils.generateAssignmentId(),
          staffId: teamStaff.id,
          staffName: teamStaff.name,
          studentId: gapStudent.id,
          studentName: gapStudent.name,
          session: session,
          program: program,
          date: schedule.date,
          isLocked: false,
          assignedBy: 'auto-swap-cascade'
        });

        return {
          success: true,
          assignments: [...cascadeResult.assignments, newAssignment],
          removals: [...cascadeResult.removals, currentAssignment]
        };
      }
    }

    console.log(`${'  '.repeat(depth)}   ❌ No cascade solution found for ${gapStudent.name}`);
    return { success: false, assignments: [], removals: [] };
  }

  /**
   * PHASE 3: Swap Optimization - Fill gaps by swapping available staff
   * 
   * Strategy:
   * 1. Find unassigned students (gaps)
   * 2. For each gap, find UNASSIGNED staff who are available
   * 3. Look for students who have staff that COULD work with the unassigned staff's students
   * 4. Execute swaps: Unassigned staff → assigned student, their staff → gap student
   * 5. NEW: Try aggressive cascading reassignments for stubborn gaps
   * 
   * Example:
   * - Lydia (gap) has team members: [Amy, Bob]
   * - Carol (unassigned) is available and has team members: [Dave]
   * - Dave is currently assigned to Student X
   * - Can Carol work with Student X? Check if X.teamIds.includes(Carol.id)
   * - If yes: Swap Carol → X, Dave → Lydia
   */
  async performSwapOptimization(schedule, staff, students, selectedDate = new Date()) {
    const swaps = [];
    const newAssignments = [];
    let totalSwapsMade = 0;
    let totalGapsFilled = 0;

    const activeStaff = staff.filter(s => s.isActive);
    const activeStudents = students.filter(s => s.isActive && s.isScheduledForDay(selectedDate));

    // Store newAssignments on instance so cascade function can access it
    this._pendingSwapAssignments = newAssignments;

    // Find all unassigned students (gaps)
    const sessions = ['AM', 'PM'];
    const programs = [PROGRAMS.PRIMARY, PROGRAMS.SECONDARY];

    // Perform one pass of swap optimization
    // User can click Smart Swap again if they want more improvements
    let swapsMade = 0;
    let gapsFilled = 0;

    console.log(`\n🔄 SMART SWAP: Starting optimization pass...`);

      for (const program of programs) {
        for (const session of sessions) {
          console.log(`\n🔍 SMART SWAP: Checking ${program} ${session} for swap opportunities...`);

        const programStudents = activeStudents.filter(s => 
          s.program === program && 
          s.isAvailableForSession(session)
        );

        for (const gapStudent of programStudents) {
          // Check if this student has a gap
          if (this.isStudentAssigned(gapStudent.id, session, program, schedule)) {
            continue; // Student already assigned
          }

          console.log(`\n🔀 GAP DETECTED: ${gapStudent.name} (${program} ${session})`);
          console.log(`   Team: ${gapStudent.teamIds.length} members`);

          // CRITICAL CHECK: If gap student is paired, skip individual gap filling
          // Paired students must be assigned together with the same staff
          if (gapStudent.isPaired && gapStudent.isPaired()) {
            console.log(`   ⚠️ Skipping ${gapStudent.name} - paired student (must be assigned with partner)`);
            continue;
          }

          // STEP 1: Find ALL unassigned staff who are available this session
          const unassignedStaff = activeStaff.filter(staffMember => {
            // Must be available for this session
            if (!staffMember.isAvailableForSession(session)) return false;
            
            // Must be able to work this program
            if (!staffMember.canWorkProgram(program)) return false;

            // Must be able to do direct sessions
            if (!this.canStaffDoDirectService(staffMember)) return false;
            
            // Must not already be assigned in this session (regular assignments)
            const alreadyAssigned = schedule.assignments.some(a => 
              a.staffId === staffMember.id && a.session === session
            );
            
            if (alreadyAssigned) return false;
            
            // CRITICAL: Must not be assigned in pending swap assignments either
            const assignedInPending = this._pendingSwapAssignments && this._pendingSwapAssignments.some(a =>
              a.staffId === staffMember.id && a.session === session
            );
            
            if (assignedInPending) return false;
            
            // CRITICAL: Must not be assigned as a trainee in this session
            const isAssignedAsTrainee = schedule.traineeAssignments && schedule.traineeAssignments.some(
              ta => ta.staffId === staffMember.id && ta.session === session
            );
            
            if (isAssignedAsTrainee) {
              console.log(`   🎓 Excluding ${staffMember.name} - assigned as trainee in ${session}`);
              return false;
            }
            
            return true;
          });

          // STEP 2: First try DIRECT ASSIGNMENT (no swap needed) if there are unassigned staff
          let gapFilled = false;
          
          if (unassignedStaff.length > 0) {
            console.log(`   ✓ Found ${unassignedStaff.length} unassigned staff:`, unassignedStaff.map(s => s.name).join(', '));
            
            for (const unassignedStaffMember of unassignedStaff) {
              // Check if this unassigned staff is on the gap student's team
              const isOnGapTeam = gapStudent.teamIds.includes(unassignedStaffMember.id);

              if (isOnGapTeam) {
                // CRITICAL CHECK: Don't use staff who are in training for gap student
                if (this.isStaffInTrainingForStudent(unassignedStaffMember, gapStudent)) {
                  console.log(`   🚫 EXCLUDING ${unassignedStaffMember.name} - in training for ${gapStudent.name} (trainee only)`);
                  continue;
                }
                
                // DIRECT ASSIGNMENT - no swap needed!
                console.log(`\n   ✅ DIRECT ASSIGNMENT: ${unassignedStaffMember.name} → ${gapStudent.name} (on team, available)`);
                
                const newAssignment = new Assignment({
                  id: SchedulingUtils.generateAssignmentId(),
                  staffId: unassignedStaffMember.id,
                  staffName: unassignedStaffMember.name,
                  studentId: gapStudent.id,
                  studentName: gapStudent.name,
                  session: session,
                  program: program,
                  date: schedule.date,
                  isLocked: false,
                  assignedBy: 'auto-swap'
                });
                
                // Don't add to schedule here - let handleSmartSwap do it
                // This prevents duplicates when the same assignments are in both
                // schedule.assignments and result.newAssignments
                // schedule.addAssignment(newAssignment);
                newAssignments.push(newAssignment);
                gapsFilled++;
                gapFilled = true;
                break; // Move to next gap
              }
            }
            
            if (gapFilled) {
              continue; // Move to next gap student
            }
          } else {
            console.log(`   ℹ️ No unassigned staff - will try swap opportunities`);
          }

          // STEP 3: If direct assignment not possible, look for swap opportunities
          let swapFound = false;
          
          // ENHANCED LOGGING: Show gap student's team for debugging
          const gapStudentTeam = activeStaff.filter(s => gapStudent.teamIds.includes(s.id));
          console.log(`\n   📋 ${gapStudent.name}'s team (${gapStudentTeam.length}):`, gapStudentTeam.map(s => s.name).join(', '));
          
          // TRY 3A: Look for swaps using unassigned staff
          for (const unassignedStaffMember of unassignedStaff) {
            console.log(`\n   🔍 Checking if ${unassignedStaffMember.name} can enable a swap for ${gapStudent.name}...`);
            console.log(`      ${unassignedStaffMember.name} is ${gapStudent.teamIds.includes(unassignedStaffMember.id) ? 'ON' : 'NOT on'} ${gapStudent.name}'s team`);

            // CRITICAL CHECK: Don't use staff who are in training for gap student
            // They should only be assigned as trainees, not primary staff
            if (this.isStaffInTrainingForStudent(unassignedStaffMember, gapStudent)) {
              console.log(`   🚫 EXCLUDING ${unassignedStaffMember.name} - in training for ${gapStudent.name} (trainee only)`);
              continue;
            }

            // Find students who have staff members on the gap student's team
            for (const otherStudent of programStudents) {
              if (otherStudent.id === gapStudent.id) continue;

              // Find this student's current assignment
              const currentAssignment = schedule.assignments.find(a => 
                a.studentId === otherStudent.id && 
                a.session === session &&
                a.program === program &&
                !a.isLocked && // Don't swap locked assignments
                a.assignedBy !== 'manual' // Don't swap manual assignments
              );

              if (!currentAssignment) continue;

              const currentStaff = activeStaff.find(s => s.id === currentAssignment.staffId);
              if (!currentStaff) continue;

              // CRITICAL CHECK: Don't swap staff who are in training for gap student
              // They should only be assigned as trainees, not primary staff
              if (this.isStaffInTrainingForStudent(currentStaff, gapStudent)) {
                console.log(`      🚫 EXCLUDING ${currentStaff.name} - in training for ${gapStudent.name} (trainee only)`);
                continue;
              }

              // CRITICAL CHECK: Is the current staff on the gap student's team?
              const isCurrentStaffOnGapTeam = gapStudent.teamIds.includes(currentStaff.id);

              // CRITICAL CHECK: Can the unassigned staff work with this other student?
              const canUnassignedWorkWithOther = otherStudent.teamIds.includes(unassignedStaffMember.id);

              // ENHANCED LOGGING: Show why this swap is being considered or rejected
              console.log(`      📊 Evaluating swap: ${unassignedStaffMember.name} → ${otherStudent.name}, ${currentStaff.name} → ${gapStudent.name}`);
              console.log(`         • ${currentStaff.name} on ${gapStudent.name}'s team? ${isCurrentStaffOnGapTeam ? '✓' : '✗'}`);
              console.log(`         • ${unassignedStaffMember.name} on ${otherStudent.name}'s team? ${canUnassignedWorkWithOther ? '✓' : '✗'}`);

              // CRITICAL CHECK: Don't break paired students (1:2 ratio)
              const isPairedStudent = otherStudent.isPaired && otherStudent.isPaired();
              if (isPairedStudent) {
                console.log(`      ⚠️ Skipping ${otherStudent.name} - paired student (1:2 ratio), can't swap`);
                continue;
              }

              // CRITICAL CHECK: Has staff already worked with this student today?
              const hasWorkedTogether = this.hasStaffWorkedWithStudentIncludingPending(schedule, unassignedStaffMember.id, otherStudent.id);
              if (hasWorkedTogether) {
                console.log(`      ⚠️ Skipping - ${unassignedStaffMember.name} already worked with ${otherStudent.name} today`);
                continue;
              }

              // CRITICAL CHECK: Has freed staff already worked with gap student today?
              const freedStaffWorkedWithGap = this.hasStaffWorkedWithStudentIncludingPending(schedule, currentStaff.id, gapStudent.id);
              if (freedStaffWorkedWithGap) {
                console.log(`      ⚠️ Skipping - ${currentStaff.name} already worked with ${gapStudent.name} today`);
                continue;
              }

              if (isCurrentStaffOnGapTeam && canUnassignedWorkWithOther) {
                // FINAL SAFETY CHECK: Ensure assignment is not locked before swapping
                if (currentAssignment.isLocked || schedule.isAssignmentLocked(currentAssignment.id)) {
                  console.log(`      🔒 BLOCKED - Assignment is locked, cannot swap ${currentStaff.name} from ${otherStudent.name}`);
                  continue;
                }

                // SWAP OPPORTUNITY FOUND!
                console.log(`\n   ✅ SWAP OPPORTUNITY:`);
                console.log(`      • ${unassignedStaffMember.name} can work with ${otherStudent.name}`);
                console.log(`      • ${currentStaff.name} (currently with ${otherStudent.name}) can work with ${gapStudent.name}`);
                console.log(`      SWAP: ${unassignedStaffMember.name} → ${otherStudent.name}, ${currentStaff.name} → ${gapStudent.name}`);

                // Execute the swap
                // Don't mutate schedule here - let handleSmartSwap handle it
                // schedule.removeAssignment(currentAssignment.id);

                // Create new assignment: unassigned staff → other student
                const newAssignment1 = new Assignment({
                  id: SchedulingUtils.generateAssignmentId(),
                  staffId: unassignedStaffMember.id,
                  staffName: unassignedStaffMember.name,
                  studentId: otherStudent.id,
                  studentName: otherStudent.name,
                  session: session,
                  program: program,
                  date: schedule.date,
                  isLocked: false,
                  assignedBy: 'auto-swap'
                });

                // Create new assignment: freed staff → gap student
                const newAssignment2 = new Assignment({
                  id: SchedulingUtils.generateAssignmentId(),
                  staffId: currentStaff.id,
                  staffName: currentStaff.name,
                  studentId: gapStudent.id,
                  studentName: gapStudent.name,
                  session: session,
                  program: program,
                  date: schedule.date,
                  isLocked: false,
                  assignedBy: 'auto-swap'
                });

                // Don't add to schedule here - let handleSmartSwap handle it
                // schedule.addAssignment(newAssignment1);
                // schedule.addAssignment(newAssignment2);
                newAssignments.push(newAssignment1, newAssignment2);

                swaps.push({
                  oldAssignment: currentAssignment,
                  description: `${unassignedStaffMember.name} → ${otherStudent.name}, ${currentStaff.name} → ${gapStudent.name}`
                });

                swapsMade++;
                gapsFilled++;
                swapFound = true;
                break; // Move to next gap
              }
            }

            if (swapFound) break; // Found a swap for this gap
          }

          // TRY 3B: If no unassigned staff can help, try DIRECT STAFF SWAPS
          // Look for staff currently assigned who could swap positions
          if (!swapFound) {
            console.log(`\n   🔍 Trying direct staff-to-staff swaps for ${gapStudent.name}...`);
            
            // Find all staff on gap student's team
            const gapTeamMembers = activeStaff.filter(s => 
              gapStudent.teamIds.includes(s.id) &&
              !this.isStaffInTrainingForStudent(s, gapStudent)
            );
            
            for (const gapTeamStaff of gapTeamMembers) {
              // Find where this team member is currently assigned
              const gapTeamStaffAssignment = schedule.assignments.find(a =>
                a.staffId === gapTeamStaff.id &&
                a.session === session &&
                !a.isLocked &&
                a.assignedBy !== 'manual'
              );
              
              if (!gapTeamStaffAssignment) continue; // Not assigned or locked
              
              const currentStudent = programStudents.find(s => s.id === gapTeamStaffAssignment.studentId);
              if (!currentStudent) continue;
              
              // Don't break paired students
              if (currentStudent.isPaired && currentStudent.isPaired()) continue;
              
              // Check if this staff already worked with gap student today
              if (schedule.hasStaffWorkedWithStudentToday(gapTeamStaff.id, gapStudent.id)) continue;
              
              console.log(`   🔍 ${gapTeamStaff.name} is on gap team, currently with ${currentStudent.name}`);
              
              // Find someone on current student's team who could take their place
              const replacementCandidates = activeStaff.filter(s =>
                currentStudent.teamIds.includes(s.id) &&
                !this.isStaffInTrainingForStudent(s, currentStudent) &&
                s.id !== gapTeamStaff.id &&
                s.isAvailableForSession(session) &&
                this.canStaffDoDirectService(s) &&
                !schedule.assignments.some(a => a.staffId === s.id && a.session === session) &&
                !(schedule.traineeAssignments && schedule.traineeAssignments.some(ta => ta.staffId === s.id && ta.session === session)) &&
                !this.hasStaffWorkedWithStudentIncludingPending(schedule, s.id, currentStudent.id)
              );
              
              if (replacementCandidates.length > 0) {
                const replacement = replacementCandidates[0];
                
                console.log(`   ✅ DIRECT SWAP FOUND:`);
                console.log(`      • ${replacement.name} can replace ${gapTeamStaff.name} at ${currentStudent.name}`);
                console.log(`      • ${gapTeamStaff.name} can move to ${gapStudent.name}`);
                
                // Execute swap
                // Don't mutate schedule here - let handleSmartSwap handle it
                // schedule.removeAssignment(gapTeamStaffAssignment.id);
                
                const newAssignment1 = new Assignment({
                  id: SchedulingUtils.generateAssignmentId(),
                  staffId: replacement.id,
                  staffName: replacement.name,
                  studentId: currentStudent.id,
                  studentName: currentStudent.name,
                  session: session,
                  program: program,
                  date: schedule.date,
                  isLocked: false,
                  assignedBy: 'auto-swap'
                });
                
                const newAssignment2 = new Assignment({
                  id: SchedulingUtils.generateAssignmentId(),
                  staffId: gapTeamStaff.id,
                  staffName: gapTeamStaff.name,
                  studentId: gapStudent.id,
                  studentName: gapStudent.name,
                  session: session,
                  program: program,
                  date: schedule.date,
                  isLocked: false,
                  assignedBy: 'auto-swap'
                });
                
                // Don't add to schedule here - let handleSmartSwap handle it
                // schedule.addAssignment(newAssignment1);
                // schedule.addAssignment(newAssignment2);
                newAssignments.push(newAssignment1, newAssignment2);
                
                swaps.push({
                  oldAssignment: gapTeamStaffAssignment,
                  description: `${replacement.name} → ${currentStudent.name}, ${gapTeamStaff.name} → ${gapStudent.name}`
                });
                
                swapsMade++;
                gapsFilled++;
                swapFound = true;
                break;
              }
            }
          }

          if (!swapFound) {
            console.log(`   ❌ No simple swap found to fill ${gapStudent.name}'s gap`);
            
            // TRY 3C: AGGRESSIVE CASCADING REASSIGNMENT
            console.log(`\n   🔗 Attempting CASCADING REASSIGNMENT for ${gapStudent.name}...`);
            
            const cascadeResult = await this.tryCascadingReassignment(
              gapStudent, session, program, activeStaff, activeStudents, schedule, 0
            );
            
            if (cascadeResult.success) {
              console.log(`\n   ✅ CASCADE SUCCESS for ${gapStudent.name}!`);
              console.log(`      Removing ${cascadeResult.removals.length} old assignments`);
              console.log(`      Adding ${cascadeResult.assignments.length} new assignments`);
              
              // Remove old assignments
              for (const removal of cascadeResult.removals) {
                // Don't mutate schedule here - let handleSmartSwap handle it
                // schedule.removeAssignment(removal.id);
                swaps.push({
                  oldAssignment: removal,
                  description: `Cascaded removal for ${gapStudent.name}`
                });
              }
              
              // Add new assignments
              for (const assignment of cascadeResult.assignments) {
                // Don't add to schedule here - let handleSmartSwap handle it
                // schedule.addAssignment(assignment);
                newAssignments.push(assignment);
              }
              
              // Count as 1 swap (not one per removal)
              swapsMade++;
              gapsFilled++;
              swapFound = true;
            } else {
              console.log(`   ❌ CASCADE FAILED for ${gapStudent.name}`);
              console.log(`   📋 DIAGNOSTIC INFO:`);
              console.log(`      • Gap student's team: ${gapStudentTeam.map(s => s.name).join(', ')}`);
              console.log(`      • Available unassigned staff: ${unassignedStaff.map(s => s.name).join(', ')}`);
              
              // TRY DEEPER ANALYSIS: Show WHERE each team member is currently assigned
              console.log(`\n   🔎 DEEP ANALYSIS: Where are ${gapStudent.name}'s team members?`);
              for (const teamMember of gapStudentTeam) {
                const assignment = schedule.assignments.find(a => 
                  a.staffId === teamMember.id && 
                  a.session === session &&
                  a.program === program
                );
                
                if (assignment) {
                  const assignedStudent = programStudents.find(s => s.id === assignment.studentId);
                  console.log(`      • ${teamMember.name} → ${assignedStudent ? assignedStudent.name : 'Unknown'} (${assignment.isLocked ? 'LOCKED' : 'unlocked'})`);
                  
                  if (assignedStudent && !assignment.isLocked) {
                    // Check who could replace this team member
                    const potentialReplacements = unassignedStaff.filter(us => 
                      assignedStudent.teamIds.includes(us.id) &&
                      !this.isStaffInTrainingForStudent(us, assignedStudent) &&
                      !schedule.hasStaffWorkedWithStudentToday(us.id, assignedStudent.id)
                    );
                    
                    if (potentialReplacements.length > 0) {
                      console.log(`         ✓ Could be replaced by: ${potentialReplacements.map(p => p.name).join(', ')}`);
                    } else {
                      console.log(`         ✗ No available replacements on ${assignedStudent.name}'s team`);
                    }
                  }
                } else {
                  console.log(`      • ${teamMember.name} → Available (not assigned in this session)`);
                }
              }
            }
          }
        }
      }
    }

    console.log(`\n✅ SMART SWAP COMPLETE: ${swapsMade} swaps made, ${gapsFilled} gaps filled`);

    return {
      swapsMade: swapsMade,
      gapsFilled: gapsFilled,
      swaps,
      newAssignments
    };
  }
}