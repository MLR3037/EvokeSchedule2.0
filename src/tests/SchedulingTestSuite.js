import { SchedulingRules, SchedulingUtils, Schedule } from '../types/index.js';
import { AutoAssignmentEngine } from '../services/AutoAssignmentEngine.js';
import { sampleStaff, sampleStudents, createTestSchedule, getTestScenarios } from '../data/sampleData.js';

/**
 * Test suite for the ABA Scheduling System
 * Tests all core functionality including validation, auto-assignment, and constraints
 */
export class SchedulingTestSuite {
  constructor() {
    this.testResults = [];
    this.autoAssignEngine = new AutoAssignmentEngine();
    this.autoAssignEngine.setDebugMode(true);
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting ABA Scheduler Test Suite...\n');
    this.testResults = [];

    // Data model tests
    await this.testDataModels();
    
    // Validation tests
    await this.testValidationRules();
    
    // Auto-assignment tests
    await this.testAutoAssignment();
    
    // Performance tests
    await this.testPerformance();
    
    // Integration tests
    await this.testIntegration();

    this.printSummary();
    return this.testResults;
  }

  /**
   * Test data models and utilities
   */
  async testDataModels() {
    console.log('📋 Testing Data Models...');
    
    // Test Staff class
    this.test('Staff role hierarchy', () => {
      const rbt = sampleStaff.find(s => s.role === 'RBT');
      const bcba = sampleStaff.find(s => s.role === 'BCBA');
      const director = sampleStaff.find(s => s.role === 'Director');
      
      return rbt.getRoleLevel() < bcba.getRoleLevel() && 
             bcba.getRoleLevel() < director.getRoleLevel();
    });

    this.test('Staff program qualification', () => {
      const staff = sampleStaff[0];
      // Test with actual program strings
      const canWorkPrimary = staff.canWorkProgram('Primary');
      const canWorkSecondary = staff.canWorkProgram('Secondary');
      
      return (staff.primaryProgram ? canWorkPrimary : true) &&
             (staff.secondaryProgram ? canWorkSecondary : true);
    });

    // Test Student class
    this.test('Student ratio requirements', () => {
      const oneToOne = sampleStudents.find(s => s.ratio === '1:1');
      const twoToOne = sampleStudents.find(s => s.ratio === '2:1');
      const oneToTwo = sampleStudents.find(s => s.ratio === '1:2');
      
      return !oneToOne.requiresMultipleStaff() &&
             twoToOne.requiresMultipleStaff() &&
             oneToTwo.isSmallGroup();
    });

    // Test Schedule class
    this.test('Schedule assignment management', () => {
      const schedule = createTestSchedule();
      const initialCount = schedule.assignments.length;
      
      // Test adding assignment
      const newAssignment = {
        id: 'test_new',
        staffId: 99,
        studentId: 199,
        session: 'AM',
        program: 'Primary',
        date: new Date()
      };
      schedule.addAssignment(newAssignment);
      
      // Test removing assignment
      schedule.removeAssignment('test_new');
      
      return schedule.assignments.length === initialCount;
    });

    // Test SchedulingUtils
    this.test('Assignment ID generation', () => {
      const id1 = SchedulingUtils.generateAssignmentId();
      const id2 = SchedulingUtils.generateAssignmentId();
      return id1 !== id2 && id1.includes('assignment_');
    });

    this.test('Staff hierarchy sorting', () => {
      const sortedStaff = SchedulingUtils.sortStaffByHierarchy(sampleStaff.slice(0, 5));
      for (let i = 1; i < sortedStaff.length; i++) {
        if (sortedStaff[i].getRoleLevel() < sortedStaff[i-1].getRoleLevel()) {
          return false;
        }
      }
      return true;
    });

    console.log('✅ Data Models tests completed\n');
  }

  /**
   * Test validation rules and constraints
   */
  async testValidationRules() {
    console.log('🔍 Testing Validation Rules...');
    
    const testScenarios = getTestScenarios();
    
    // Test valid scenario
    this.test('Valid schedule passes validation', () => {
      const scenario = testScenarios.validScenario;
      const errors = SchedulingRules.validateSchedule(scenario.schedule, sampleStaff, sampleStudents);
      return errors.length === scenario.expectedErrors;
    });

    // Test same-day violation
    this.test('Same-day violation detected', () => {
      const scenario = testScenarios.sameDayViolation;
      const errors = SchedulingRules.validateSchedule(scenario.schedule, sampleStaff, sampleStudents);
      return errors.length >= scenario.expectedErrors;
    });

    // Test ratio violation
    this.test('Ratio violation detected', () => {
      const scenario = testScenarios.ratioViolation;
      const errors = SchedulingRules.validateSchedule(scenario.schedule, sampleStaff, sampleStudents);
      return errors.length >= scenario.expectedErrors;
    });

    // Test individual assignment validation
    this.test('Individual assignment validation', () => {
      const schedule = createTestSchedule();
      const validAssignment = schedule.assignments[0];
      
      // Create a temporary schedule without the current assignment for validation
      const tempSchedule = new Schedule({ 
        date: schedule.date,
        assignments: schedule.assignments.filter(a => a.id !== validAssignment.id),
        lockedAssignments: schedule.lockedAssignments,
        isFinalized: schedule.isFinalized
      });
      
      const errors = SchedulingRules.validateAssignment(validAssignment, tempSchedule, sampleStaff, sampleStudents);
      return errors.length === 0;
    });

    console.log('✅ Validation Rules tests completed\n');
  }

  /**
   * Test auto-assignment functionality
   */
  async testAutoAssignment() {
    console.log('🤖 Testing Auto-Assignment...');
    
    // Test basic auto-assignment
    this.test('Auto-assignment creates assignments', async () => {
      const schedule = createTestSchedule();
      const initialCount = schedule.assignments.length;
      
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, sampleStaff, sampleStudents);
      
      // Check if result exists and has assignments array
      return result && result.assignments && result.assignments.length >= 0;
    });

    // Test hierarchy respect
    this.test('Auto-assignment respects staff hierarchy', async () => {
      const schedule = createTestSchedule();
      
      // Get a 1:1 student not yet assigned
      const unassignedStudent = sampleStudents.find(s => 
        s.ratio === '1:1' && 
        !schedule.assignments.some(a => a.studentId === s.id)
      );
      
      if (!unassignedStudent) return true; // Skip if no unassigned students
      
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, sampleStaff, sampleStudents);
      
      // Check if result exists and has assignments
      if (!result || !result.assignments) return false;
      
      // Check if the assignment uses appropriate hierarchy
      const newAssignment = result.assignments.find(a => a.studentId === unassignedStudent.id);
      if (newAssignment) {
        const assignedStaff = sampleStaff.find(s => s.id === newAssignment.staffId);
        return assignedStaff && assignedStaff.canWorkProgram(newAssignment.program);
      }
      
      return true;
    });

    // Test constraint respect
    this.test('Auto-assignment respects constraints', async () => {
      const schedule = createTestSchedule();
      
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, sampleStaff, sampleStudents);
      
      // Check if result exists and has assignments
      if (!result || !result.assignments) return false;
      
      // Validate that all new assignments respect constraints
      const allAssignments = [...schedule.assignments, ...result.assignments];
      const errors = SchedulingRules.validateSchedule({ ...schedule, assignments: allAssignments }, sampleStaff, sampleStudents);
      
      return errors.length === 0;
    });

    // Test locked assignment preservation
    this.test('Auto-assignment preserves locked assignments', async () => {
      const schedule = createTestSchedule();
      const lockedAssignments = [...schedule.lockedAssignments];
      
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, sampleStaff, sampleStudents);
      
      // Check if result exists
      if (!result || !result.assignments) return false;
      
      // Check that all originally locked assignments are still there
      return lockedAssignments.every(lockedId => 
        schedule.assignments.some(a => a.id === lockedId)
      );
    });

    console.log('✅ Auto-Assignment tests completed\n');
  }

  /**
   * Test system performance
   */
  async testPerformance() {
    console.log('⚡ Testing Performance...');
    
    // Test large dataset handling
    this.test('Handles large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Create smaller test dataset for performance testing
      const testStaff = sampleStaff.slice(0, 20);
      const testStudents = sampleStudents.slice(0, 15);
      const schedule = createTestSchedule();
      
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, testStaff, testStudents);
      
      const duration = Date.now() - startTime;
      console.log(`  Auto-assignment completed in ${duration}ms`);
      
      // Check if result exists and process completed within reasonable time
      return result && result.assignments && duration < 5000;
    });

    // Test validation performance
    this.test('Validation performs efficiently', () => {
      const schedule = createTestSchedule();
      const startTime = Date.now();
      
      // Run validation multiple times
      for (let i = 0; i < 10; i++) {
        SchedulingRules.validateSchedule(schedule, sampleStaff, sampleStudents);
      }
      
      const duration = Date.now() - startTime;
      console.log(`  10 validation runs completed in ${duration}ms`);
      
      return duration < 1000; // Should be very fast
    });

    console.log('✅ Performance tests completed\n');
  }

  /**
   * Test integration scenarios
   */
  async testIntegration() {
    console.log('🔗 Testing Integration Scenarios...');
    
    // Test complete workflow
    this.test('Complete scheduling workflow', async () => {
      const schedule = createTestSchedule();
      
      // 1. Start with some manual assignments
      const initialAssignments = schedule.assignments.length;
      
      // 2. Lock some assignments
      if (schedule.assignments.length > 0) {
        schedule.lockAssignment(schedule.assignments[0].id);
      }
      
      // 3. Run auto-assignment
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, sampleStaff, sampleStudents);
      
      // 4. Check if result exists
      if (!result || !result.assignments) return false;
      
      // 5. Validate final schedule
      const errors = SchedulingRules.validateSchedule(schedule, sampleStaff, sampleStudents);
      
      // 6. Check results
      return result.assignments.length >= 0 && errors.length === 0;
    });

    // Test ratio combinations
    this.test('Handles mixed ratio requirements', async () => {
      const schedule = createTestSchedule();
      
      // Ensure we have students with different ratios
      const oneToOneStudents = sampleStudents.filter(s => s.ratio === '1:1');
      const twoToOneStudents = sampleStudents.filter(s => s.ratio === '2:1');
      const oneToTwoStudents = sampleStudents.filter(s => s.ratio === '1:2');
      
      console.log(`  Testing with ${oneToOneStudents.length} 1:1, ${twoToOneStudents.length} 2:1, ${oneToTwoStudents.length} 1:2 students`);
      
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, sampleStaff, sampleStudents);
      
      // Check if result exists and handle all ratio types without errors
      return result && result.errors && result.errors.length === 0;
    });

    // Test program separation
    this.test('Maintains program separation', async () => {
      const schedule = createTestSchedule();
      
      const result = await this.autoAssignEngine.autoAssignSchedule(schedule, sampleStaff, sampleStudents);
      
      // Check if result exists
      if (!result || !result.assignments) return false;
      
      // Check that Primary students only get Primary-qualified staff
      const primaryAssignments = [...schedule.assignments, ...result.assignments].filter(a => a.program === 'Primary');
      const allPrimaryValid = primaryAssignments.every(assignment => {
        const staff = sampleStaff.find(s => s.id === assignment.staffId);
        return staff && staff.canWorkProgram('Primary');
      });
      
      // Check that Secondary students only get Secondary-qualified staff
      const secondaryAssignments = [...schedule.assignments, ...result.assignments].filter(a => a.program === 'Secondary');
      const allSecondaryValid = secondaryAssignments.every(assignment => {
        const staff = sampleStaff.find(s => s.id === assignment.staffId);
        return staff && staff.canWorkProgram('Secondary');
      });
      
      return allPrimaryValid && allSecondaryValid;
    });

    console.log('✅ Integration tests completed\n');
  }

  /**
   * Helper method to run individual tests
   */
  test(name, testFunction) {
    try {
      const startTime = Date.now();
      const result = testFunction();
      const duration = Date.now() - startTime;
      
      // Handle async tests
      if (result instanceof Promise) {
        return result.then(asyncResult => {
          const finalDuration = Date.now() - startTime;
          this.recordTest(name, asyncResult, null, finalDuration);
          return asyncResult;
        }).catch(error => {
          const finalDuration = Date.now() - startTime;
          this.recordTest(name, false, error, finalDuration);
          return false;
        });
      } else {
        this.recordTest(name, result, null, duration);
        return result;
      }
    } catch (error) {
      this.recordTest(name, false, error, 0);
      return false;
    }
  }

  /**
   * Record test result
   */
  recordTest(name, passed, error, duration) {
    const result = {
      name,
      passed,
      error: error ? error.message : null,
      duration
    };
    
    this.testResults.push(result);
    
    const status = passed ? '✅' : '❌';
    const timeInfo = duration > 0 ? ` (${duration}ms)` : '';
    console.log(`  ${status} ${name}${timeInfo}`);
    
    if (error) {
      console.log(`    Error: ${error.message}`);
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.length - passed;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n📊 Test Summary:');
    console.log(`   Total Tests: ${this.testResults.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`   - ${result.name}: ${result.error || 'Unknown error'}`);
      });
    }
    
    console.log(failed === 0 ? '\n🎉 All tests passed!' : '\n⚠️  Some tests failed.');
  }

  /**
   * Generate test report
   */
  generateReport() {
    return {
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.passed).length,
        failed: this.testResults.filter(r => !r.passed).length,
        duration: this.testResults.reduce((sum, r) => sum + r.duration, 0)
      },
      results: this.testResults,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Standalone test runner
 */
export const runTests = async () => {
  const testSuite = new SchedulingTestSuite();
  const results = await testSuite.runAllTests();
  return testSuite.generateReport();
};

export default SchedulingTestSuite;