import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, RefreshCw } from 'lucide-react';
import { SchedulingRules, RATIOS } from '../types/index.js';

/**
 * Validation Panel Component - Shows scheduling validation results and constraints
 */
export const ValidationPanel = ({ schedule, staff, students, onValidationChange }) => {
  const [validationResults, setValidationResults] = useState({
    errors: [],
    warnings: [],
    isValid: true,
    lastValidated: null
  });
  const [isValidating, setIsValidating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Run validation when schedule, staff, or students change
  useEffect(() => {
    validateSchedule();
  }, [schedule, staff, students]);

  const validateSchedule = async () => {
    setIsValidating(true);
    
    try {
      const errors = [];
      const warnings = [];

      // Run comprehensive validation
      const scheduleErrors = SchedulingRules.validateSchedule(schedule, staff, students);
      errors.push(...scheduleErrors);

      // Additional constraint checks
      const constraintResults = validateConstraints();
      errors.push(...constraintResults.errors);
      warnings.push(...constraintResults.warnings);

      const results = {
        errors,
        warnings,
        isValid: errors.length === 0,
        lastValidated: new Date()
      };

      setValidationResults(results);
      
      // Notify parent component of validation status
      if (onValidationChange) {
        onValidationChange(results);
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResults({
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        isValid: false,
        lastValidated: new Date()
      });
    } finally {
      setIsValidating(false);
    }
  };

  const validateConstraints = () => {
    const errors = [];
    const warnings = [];
    const activeStudents = students.filter(s => s.isActive);
    const activeStaff = staff.filter(s => s.isActive);

    // Check ratio requirements
    const ratioViolations = checkRatioRequirements();
    errors.push(...ratioViolations);

    // Check same-day restrictions
    const sameDayViolations = checkSameDayRestrictions();
    errors.push(...sameDayViolations);

    // Check staff availability and capacity
    const capacityIssues = checkStaffCapacity();
    warnings.push(...capacityIssues);

    // Check program assignments
    const programIssues = checkProgramAssignments();
    errors.push(...programIssues);

    // Check for unassigned students
    const unassignedIssues = checkUnassignedStudents();
    warnings.push(...unassignedIssues);

    // Check staff workload balance
    const workloadWarnings = checkWorkloadBalance();
    warnings.push(...workloadWarnings);

    return { errors, warnings };
  };

  const checkRatioRequirements = () => {
    const errors = [];
    const activeStudents = students.filter(s => s.isActive);

    for (const student of activeStudents) {
      const studentAssignments = schedule.getStudentAssignments(student.id);
      
      for (const session of ['AM', 'PM']) {
        const sessionAssignments = studentAssignments.filter(a => a.session === session);
        const requiredStaff = student.ratio === RATIOS.TWO_TO_ONE ? 2 : 1;
        
        if (sessionAssignments.length > 0 && sessionAssignments.length < requiredStaff) {
          errors.push(
            `${student.name} requires ${requiredStaff} staff but has only ${sessionAssignments.length} assigned in ${session} session`
          );
        }
      }
    }

    return errors;
  };

  const checkSameDayRestrictions = () => {
    const errors = [];
    const activeStudents = students.filter(s => s.isActive);

    for (const student of activeStudents) {
      const studentAssignments = schedule.getStudentAssignments(student.id);
      const staffIds = studentAssignments.map(a => a.staffId);
      const uniqueStaffIds = [...new Set(staffIds)];
      
      if (staffIds.length !== uniqueStaffIds.length) {
        const duplicateStaff = staffIds.filter((id, index) => staffIds.indexOf(id) !== index);
        const duplicateStaffNames = duplicateStaff.map(id => {
          const staffMember = staff.find(s => s.id === id);
          return staffMember ? staffMember.name : `Staff ID ${id}`;
        });
        
        errors.push(
          `${student.name} has the same staff member(s) assigned multiple times: ${[...new Set(duplicateStaffNames)].join(', ')}`
        );
      }
    }

    return errors;
  };

  const checkStaffCapacity = () => {
    const warnings = [];
    const activeStaff = staff.filter(s => s.isActive);

    for (const staffMember of activeStaff) {
      const assignments = schedule.getStaffAssignments(staffMember.id);
      
      // Check for overallocation
      const sessionCounts = { AM: 0, PM: 0 };
      assignments.forEach(assignment => {
        sessionCounts[assignment.session]++;
      });

      Object.entries(sessionCounts).forEach(([session, count]) => {
        if (count > staffMember.maxStudents) {
          warnings.push(
            `${staffMember.name} is assigned to ${count} students in ${session} session (max: ${staffMember.maxStudents})`
          );
        }
      });

      // Check for underutilization
      if (assignments.length === 0) {
        warnings.push(`${staffMember.name} has no assignments`);
      }
    }

    return warnings;
  };

  const checkProgramAssignments = () => {
    const errors = [];

    for (const assignment of schedule.assignments) {
      const staffMember = staff.find(s => s.id === assignment.staffId);
      const student = students.find(s => s.id === assignment.studentId);

      if (staffMember && student) {
        if (!staffMember.canWorkProgram(assignment.program)) {
          errors.push(
            `${staffMember.name} is assigned to ${student.name} in ${assignment.program} program, but is not qualified for this program`
          );
        }

        if (student.program !== assignment.program) {
          errors.push(
            `${student.name} is assigned to ${assignment.program} program but belongs to ${student.program} program`
          );
        }
      }
    }

    return errors;
  };

  const checkUnassignedStudents = () => {
    const warnings = [];
    const activeStudents = students.filter(s => s.isActive);

    for (const student of activeStudents) {
      const assignments = schedule.getStudentAssignments(student.id);
      const sessions = ['AM', 'PM'];
      
      for (const session of sessions) {
        const sessionAssignments = assignments.filter(a => a.session === session);
        if (sessionAssignments.length === 0) {
          warnings.push(`${student.name} has no assignment for ${session} session`);
        }
      }
    }

    return warnings;
  };

  const checkWorkloadBalance = () => {
    const warnings = [];
    const activeStaff = staff.filter(s => s.isActive);
    const assignmentCounts = activeStaff.map(staffMember => ({
      name: staffMember.name,
      count: schedule.getStaffAssignments(staffMember.id).length
    }));

    if (assignmentCounts.length > 0) {
      const maxAssignments = Math.max(...assignmentCounts.map(s => s.count));
      const minAssignments = Math.min(...assignmentCounts.map(s => s.count));
      
      if (maxAssignments - minAssignments > 2) {
        warnings.push(
          `Uneven workload distribution: some staff have ${maxAssignments} assignments while others have ${minAssignments}`
        );
      }
    }

    return warnings;
  };

  const getValidationIcon = () => {
    if (isValidating) return <RefreshCw className="w-5 h-5 animate-spin" />;
    if (validationResults.isValid && validationResults.warnings.length === 0) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (validationResults.errors.length > 0) {
      return <XCircle className="w-5 h-5 text-red-600" />;
    }
    return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
  };

  const getValidationStatus = () => {
    if (isValidating) return 'Validating...';
    if (validationResults.isValid && validationResults.warnings.length === 0) {
      return 'All constraints satisfied';
    }
    if (validationResults.errors.length > 0) {
      return `${validationResults.errors.length} error(s) found`;
    }
    return `${validationResults.warnings.length} warning(s)`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getValidationIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Schedule Validation
              </h3>
              <p className="text-sm text-gray-600">{getValidationStatus()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={validateSchedule}
              disabled={isValidating}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
              Revalidate
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="p-4 space-y-4">
          {/* Validation Summary */}
          <ValidationSummary 
            schedule={schedule} 
            staff={staff} 
            students={students} 
          />

          {/* Errors */}
          {validationResults.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-red-900 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Errors ({validationResults.errors.length})
              </h4>
              <div className="space-y-1">
                {validationResults.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {validationResults.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-yellow-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Warnings ({validationResults.warnings.length})
              </h4>
              <div className="space-y-1">
                {validationResults.warnings.map((warning, index) => (
                  <div key={index} className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success message */}
          {validationResults.isValid && validationResults.warnings.length === 0 && (
            <div className="text-sm text-green-700 bg-green-50 p-3 rounded flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Schedule passes all validation checks
            </div>
          )}

          {/* Last validated timestamp */}
          {validationResults.lastValidated && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Last validated: {validationResults.lastValidated.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Validation Summary Component - Shows high-level validation statistics
 */
const ValidationSummary = ({ schedule, staff, students }) => {
  const activeStudents = students.filter(s => s.isActive);
  const activeStaff = staff.filter(s => s.isActive);
  
  const totalAssignments = schedule.assignments.length;
  const assignedStudents = new Set(schedule.assignments.map(a => a.studentId)).size;
  const usedStaff = new Set(schedule.assignments.map(a => a.staffId)).size;
  
  const lockedAssignments = schedule.assignments.filter(a => 
    schedule.isAssignmentLocked(a.id)
  ).length;

  // Calculate completion rates
  const studentCompletionRate = activeStudents.length > 0 
    ? (assignedStudents / activeStudents.length) * 100 
    : 0;
  
  const staffUtilizationRate = activeStaff.length > 0 
    ? (usedStaff / activeStaff.length) * 100 
    : 0;

  const summaryItems = [
    {
      label: 'Total Assignments',
      value: totalAssignments,
      color: 'text-blue-600'
    },
    {
      label: 'Students Assigned',
      value: `${assignedStudents}/${activeStudents.length}`,
      percentage: studentCompletionRate,
      color: studentCompletionRate === 100 ? 'text-green-600' : 'text-yellow-600'
    },
    {
      label: 'Staff Utilized',
      value: `${usedStaff}/${activeStaff.length}`,
      percentage: staffUtilizationRate,
      color: 'text-blue-600'
    },
    {
      label: 'Locked Assignments',
      value: lockedAssignments,
      color: 'text-yellow-600'
    }
  ];

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Summary</h4>
      <div className="grid grid-cols-2 gap-4">
        {summaryItems.map((item, index) => (
          <div key={index} className="text-center p-3 bg-gray-50 rounded">
            <div className={`text-lg font-semibold ${item.color}`}>
              {item.value}
              {item.percentage !== undefined && (
                <span className="text-sm ml-1">({item.percentage.toFixed(0)}%)</span>
              )}
            </div>
            <div className="text-xs text-gray-600">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Constraint Rules Display Component - Shows the rules being enforced
 */
export const ConstraintRulesDisplay = () => {
  const rules = [
    {
      title: 'Staff-Student Ratios',
      description: 'Each student must have the correct number of staff assigned based on their ratio requirement',
      examples: ['1:1 ratio = 1 staff member', '2:1 ratio = 2 staff members', '1:2 ratio = 1 staff for up to 2 students']
    },
    {
      title: 'Same-Day Restriction',
      description: 'No staff member can be assigned to the same student for both AM and PM sessions',
      examples: ['If John works with Student A in AM, he cannot work with Student A in PM']
    },
    {
      title: 'Program Qualifications',
      description: 'Staff can only be assigned to programs they are qualified for',
      examples: ['Primary program staff cannot be assigned to Secondary program students']
    },
    {
      title: 'Role Hierarchy',
      description: 'Staff assignments follow the established hierarchy for optimal matches',
      examples: ['RBT → BS → BCBA → EA → MHA → CC → Teacher → Director']
    },
    {
      title: 'Session Times',
      description: 'Assignments must respect program-specific session times',
      examples: [
        'Primary AM: 8:45-11:30, PM: 12:00-15:00',
        'Secondary AM: 8:45-12:00, PM: 12:30-15:00'
      ]
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Info className="w-5 h-5" />
        Scheduling Rules & Constraints
      </h3>
      
      <div className="space-y-6">
        {rules.map((rule, index) => (
          <div key={index} className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-gray-900 mb-2">{rule.title}</h4>
            <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
            <ul className="text-xs text-gray-500 space-y-1">
              {rule.examples.map((example, exIndex) => (
                <li key={exIndex} className="flex items-start gap-1">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{example}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};