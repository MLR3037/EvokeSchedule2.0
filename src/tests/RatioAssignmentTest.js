// Test for session-specific ratio assignments
// Run this in the browser console to test ratio assignment logic

function testRatioAssignments() {
  console.log('🧪 Testing Session-Specific Ratio Assignments');
  
  // Create test students with different AM/PM ratios
  const student1 = new Student({
    id: 'test1',
    name: 'Student 1 - 2:1 Full Day',
    ratioAM: '2:1',
    ratioPM: '2:1',
    program: 'Primary',
    isActive: true,
    teamIds: ['staff1', 'staff2', 'staff3']
  });
  
  const student2 = new Student({
    id: 'test2', 
    name: 'Student 2 - 2:1 PM Only',
    ratioAM: '1:1',
    ratioPM: '2:1',
    program: 'Primary',
    isActive: true,
    teamIds: ['staff4', 'staff5', 'staff6']
  });
  
  const student3 = new Student({
    id: 'test3',
    name: 'Student 3 - 1:1 Both Sessions',
    ratioAM: '1:1',
    ratioPM: '1:1',
    program: 'Primary',
    isActive: true,
    teamIds: ['staff7', 'staff8']
  });
  
  console.log('\n📊 Testing requiresMultipleStaff():');
  console.log(`${student1.name}:`);
  console.log(`  AM: ${student1.requiresMultipleStaff('AM')} (should be true)`);
  console.log(`  PM: ${student1.requiresMultipleStaff('PM')} (should be true)`);
  
  console.log(`${student2.name}:`);
  console.log(`  AM: ${student2.requiresMultipleStaff('AM')} (should be false)`);
  console.log(`  PM: ${student2.requiresMultipleStaff('PM')} (should be true)`);
  
  console.log(`${student3.name}:`);
  console.log(`  AM: ${student3.requiresMultipleStaff('AM')} (should be false)`);
  console.log(`  PM: ${student3.requiresMultipleStaff('PM')} (should be false)`);
  
  console.log('\n📊 Testing getSessionRatio():');
  console.log(`${student1.name}:`);
  console.log(`  AM: ${student1.getSessionRatio('AM')} (should be 2:1)`);
  console.log(`  PM: ${student1.getSessionRatio('PM')} (should be 2:1)`);
  
  console.log(`${student2.name}:`);
  console.log(`  AM: ${student2.getSessionRatio('AM')} (should be 1:1)`);
  console.log(`  PM: ${student2.getSessionRatio('PM')} (should be 2:1)`);
  
  // Test AutoAssignmentEngine functions if available
  if (typeof AutoAssignmentEngine !== 'undefined') {
    const engine = new AutoAssignmentEngine();
    
    console.log('\n📊 Testing getRequiredStaffCount():');
    console.log(`${student1.name}:`);
    console.log(`  AM: ${engine.getRequiredStaffCount(student1, 'AM')} staff (should be 2)`);
    console.log(`  PM: ${engine.getRequiredStaffCount(student1, 'PM')} staff (should be 2)`);
    
    console.log(`${student2.name}:`);
    console.log(`  AM: ${engine.getRequiredStaffCount(student2, 'AM')} staff (should be 1)`);
    console.log(`  PM: ${engine.getRequiredStaffCount(student2, 'PM')} staff (should be 2)`);
    
    console.log(`${student3.name}:`);
    console.log(`  AM: ${engine.getRequiredStaffCount(student3, 'AM')} staff (should be 1)`);
    console.log(`  PM: ${engine.getRequiredStaffCount(student3, 'PM')} staff (should be 1)`);
    
    console.log('\n📊 Testing prioritizeStudents():');
    const students = [student3, student1, student2]; // Mix up the order
    
    const amPriority = engine.prioritizeStudents(students, 'AM');
    console.log('AM Priority Order (2:1 ratios first):');
    amPriority.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.name} (${s.getSessionRatio('AM')})`);
    });
    
    const pmPriority = engine.prioritizeStudents(students, 'PM');
    console.log('PM Priority Order (2:1 ratios first):');
    pmPriority.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.name} (${s.getSessionRatio('PM')})`);
    });
  }
  
  console.log('\n✅ Test completed! Check results above.');
}

// Instructions for running:
console.log('📝 To test ratio assignments, run: testRatioAssignments()');
console.log('   This will verify that students requiring 2:1 ratios are properly detected for each session.');