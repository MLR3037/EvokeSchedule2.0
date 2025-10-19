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
    this.debugMode = false; // Enhanced debug mode
    this.maxIterations = 50; // Ultimate iteration limit
    this.maxChainDepth = 5; // How deep to search for swap chains
  }

  /**
     * Get staff priority score - LOWER is BETTER
     * RBT/BS should always be preferred over EAs
     */
  getStaffPriorityScore(staffMember) {
    const hierarchy = {
      'RBT': 1,
      'BS': 2,
      'EA': 10,      // Large gap - use EAs only as last resort
      'BCBA': 20,    // Even lower priority
      'CC': 21,
      'MHA': 22,
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
   * Sort staff with STRICT preference for RBTs/BSs over EAs
   */
  sortStaffForStudentStrict(student, availableStaff, session) {
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

      // 3. For PM sessions, add slight randomization within same priority level
      if (session === 'PM' && aScore === bScore) {
        return Math.random() - 0.5;
      }

      // 4. Alphabetically for consistency
      return a.name.localeCompare(b.name);
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
      if (!s.isAvailableForSession(session)) return false; // Check attendance
      if (!s.canWorkProgram(program)) return false;
      if (excludeIds.includes(s.id)) return false;
      if (!student.teamIds.includes(s.id)) return false;
      if (!this.canStaffDoDirectService(s)) return false;
      if (!schedule.isStaffAvailable(s.id, session, program)) return false;
      if (schedule.hasStaffWorkedWithStudentToday(s.id, student.id)) return false;
      return true;
    });

    if (availableStaff.length === 0) return null;

    // Prefer RBT/BS over EA
    const sorted = this.sortStaffForStudentStrict(student, availableStaff, session);
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
      if (targetStudent.teamIds.includes(s.id)) return false; // Not on Lydia's team
      return schedule.isStaffAvailable(s.id, targetSession, targetProgram);
    });

    console.log(`    📊 Found ${unassignedRbtBs.length} unassigned RBT/BS not on ${targetStudent.name}'s team in ${targetProgram} ${targetSession}`);

    // For each of target student's busy team members
    const targetTeam = staff.filter(s =>
      targetStudent.teamIds.includes(s.id) &&
      this.canStaffDoDirectService(s)
    );


    for (const busyTeamMember of targetTeam) {
      // Skip if already available
      if (schedule.isStaffAvailable(busyTeamMember.id, targetSession, targetProgram)) {
        console.log(`    ⏭️ ${busyTeamMember.name} is already available in ${targetSession} ${targetProgram}`);
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
            studentId: currentStudent.id,
            session: targetSession,
            program: targetProgram,
            date: schedule.date,
            isLocked: false,
            assignedBy: 'smart-swap'
          });

          const newAssignment = new Assignment({
            id: SchedulingUtils.generateAssignmentId(),
            staffId: busyTeamMember.id,
            studentId: targetStudent.id,
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

    // Get ALL of target student's team members (even if busy)
    const teamStaff = staff.filter(s =>
      targetStudent.teamIds.includes(s.id) &&
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
        console.log(`      ✅ ${teamMember.name} is already available!`);

        // Create direct assignment
        const assignment = new Assignment({
          id: SchedulingUtils.generateAssignmentId(),
          staffId: teamMember.id,
          studentId: targetStudent.id,
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
      if (!s.canWorkProgram(program)) return false;
      if (excludeIds.includes(s.id)) return false;
      if (!student.teamIds.includes(s.id)) return false;
      if (!this.canStaffDoDirectService(s)) return false;
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

    // Create replacement assignment
    const replacementAssignment = new Assignment({
      id: SchedulingUtils.generateAssignmentId(),
      staffId: replacementStaff.id,
      studentId: currentStudent.id,
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
      studentId: finalStudent.id,
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
   * Auto-assign all unassigned students for a given date
   * @param {Schedule} schedule - Current schedule
   * @param {Staff[]} staff - Array of staff members
   * @param {Student[]} students - Array of students
   * @returns {Assignment[]} Array of new assignments created
   */
  async autoAssignSchedule(schedule, staff, students) {
    const newAssignments = [];
    const errors = [];

    console.log('\n🚀 ========== STARTING AUTO-ASSIGNMENT ==========');

    const activeStaff = staff.filter(s => s.isActive);
    const activeStudents = students.filter(s => s.isActive);

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
                  student, pairedStudent, session, program, activeStaff, schedule
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
              student, session, program, activeStaff, schedule
            );

            if (assignments.length > 0) {
              newAssignments.push(...assignments);
              assignments.forEach(a => schedule.addAssignment(a));
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
   * @returns {Assignment[]} Array of assignments created
   */
  async assignStudent(student, session, program, staff, schedule) {
    const assignments = [];
    const staffCount = this.getRequiredStaffCount(student, session);

    console.log(`\n🎯 Assigning ${student.name} for ${program} ${session} (needs ${staffCount} staff)`);

    if (student.isSmallGroup(session)) {
      return this.assignSmallGroupStudent(student, session, program, staff, schedule);
    }

    // Get available staff
    const availableStaff = SchedulingUtils.getAvailableStaffForStudent(
      student, session, program, staff, schedule
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
        console.log(`  🚫 BLOCKING ${staffMember.name}: ${staffMember.role} cannot do direct service`);
        return false;
      }

      if (!staffMember.canDoDirectSessions()) {
        console.log(`  🚫 BLOCKING ${staffMember.name}: Cannot do direct sessions`);
        return false;
      }

      return true;
    });

    console.log(`  📊 Team staff breakdown:`);
    console.log(`    Total available: ${availableStaff.length}`);
    console.log(`    Team members: ${teamStaff.length}`);

    // Separate by role preference
    const rbtBsStaff = teamStaff.filter(s => s.role === 'RBT' || s.role === 'BS');
    const eaStaff = teamStaff.filter(s => s.role === 'EA');
    const otherStaff = teamStaff.filter(s => s.role !== 'RBT' && s.role !== 'BS' && s.role !== 'EA');

    console.log(`    RBT/BS: ${rbtBsStaff.length}`);
    console.log(`    EA: ${eaStaff.length}`);
    console.log(`    Other: ${otherStaff.length}`);

    // STRICT PRIORITY: Use RBT/BS first, EAs only if necessary
    let finalTeamStaff;
    if (rbtBsStaff.length >= staffCount) {
      finalTeamStaff = rbtBsStaff;
      console.log(`  ✅ Using ONLY RBT/BS staff`);
    } else if (rbtBsStaff.length + eaStaff.length >= staffCount) {
      finalTeamStaff = [...rbtBsStaff, ...eaStaff];
      console.log(`  ⚠️ Using RBT/BS + EA staff (${rbtBsStaff.length} RBT/BS + ${Math.min(eaStaff.length, staffCount - rbtBsStaff.length)} EA)`);
    } else {
      finalTeamStaff = teamStaff;
      console.log(`  🚨 Using all available team staff (still short)`);
    }

    if (finalTeamStaff.length < staffCount) {
      console.log(`  ❌ INSUFFICIENT: Need ${staffCount}, have ${finalTeamStaff.length} team members`);
      return [];
    }

    // Sort with hierarchy but add randomization for better distribution
    const sortedStaff = this.sortStaffForStudentWithShuffling(student, finalTeamStaff, session);

    console.log(`  📋 Assignment order:`);
    sortedStaff.slice(0, staffCount).forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.name} (${s.role})`);
    });

    // Assign exactly the number needed
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

      const validationErrors = SchedulingRules.validateAssignment(
        assignment, schedule, staff, [student]
      );

      if (validationErrors.length === 0) {
        assignments.push(assignment);
        console.log(`  ✅ Assigned ${sortedStaff[i].name} (${sortedStaff[i].role})`);
      } else {
        console.log(`  ❌ Cannot assign ${sortedStaff[i].name}: ${validationErrors.join(', ')}`);
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

    // For AM sessions, use standard hierarchy-based sorting with LIGHT randomization
    // For PM sessions, use MORE randomization to distribute workload
    const randomizationFactor = session === 'PM' ? 2.0 : 0.8;

    const staffWithPriority = [...staffToUse].map(staff => ({
      staff,
      isTeamMember: student.teamIds.includes(staff.id),
      roleLevel: staff.getRoleLevel(),
      isPreferred: staff.isPreferredDirectService(),
      // Add randomization that scales with session
      randomFactor: Math.random() * randomizationFactor
    }));

    return staffWithPriority.sort((a, b) => {
      // Team members first (always strict)
      if (a.isTeamMember && !b.isTeamMember) return -1;
      if (!a.isTeamMember && b.isTeamMember) return 1;

      // Preferred direct service providers first (RBTs/BSs over EAs)
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;

      // Within same preference level, mix hierarchy with randomization
      const aScore = a.roleLevel + a.randomFactor;
      const bScore = b.roleLevel + b.randomFactor;

      // For PM, allow more variance
      const threshold = session === 'PM' ? 1.5 : 0.3;

      if (Math.abs(aScore - bScore) > threshold) {
        return aScore - bScore;
      }

      // If very close, alphabetical for consistency
      return a.staff.name.localeCompare(b.staff.name);
    }).map(item => item.staff);
  }

  /**
   * Prioritize students for assignment (2:1 ratio first, etc.)
   * @param {Student[]} students - Students to prioritize
   * @param {string} session - 'AM' or 'PM' session to check ratios for
   * @returns {Student[]} Sorted students array
   */
  prioritizeStudents(students, session = 'AM') {
    return [...students].sort((a, b) => {
      // 2:1 ratio students first (they need more staff) - session-specific
      if (a.requiresMultipleStaff(session) && !b.requiresMultipleStaff(session)) return -1;
      if (!a.requiresMultipleStaff(session) && b.requiresMultipleStaff(session)) return 1;

      // Then by team size (students with smaller teams get priority to ensure coverage)
      const aTeamSize = a.teamIds.length;
      const bTeamSize = b.teamIds.length;
      if (aTeamSize !== bTeamSize) return aTeamSize - bTeamSize;

      // Then alphabetically for consistency
      return a.name.localeCompare(b.name);
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
    const student1StaffCount = this.getRequiredStaffCount(student1, session);
    const student2StaffCount = this.getRequiredStaffCount(student2, session);
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
}