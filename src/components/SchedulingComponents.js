import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Users, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { PROGRAMS, SESSION_TIMES, RATIOS } from '../types/index.js';
import { PeoplePicker, SinglePeoplePicker, StaffPeoplePicker } from './PeoplePicker.js';

/**
 * Schedule Grid Component - Shows the main scheduling grid with sessions and assignments
 */
export const ScheduleGrid = ({ 
  schedule, 
  staff, 
  students, 
  onAssignmentLock, 
  onAssignmentUnlock,
  onManualAssignment,
  onAssignmentRemove,
  selectedDate 
}) => {
  const [selectedCell, setSelectedCell] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Get unique programs from students
  const programs = [...new Set(students.map(s => s.program))];
  const sessions = ['AM', 'PM'];

  const getSessionAssignments = (session, program) => {
    return schedule.getAssignmentsForSession(session, program);
  };

  const getStudentsForProgram = (program) => {
    return students.filter(s => s.program === program && s.isActive);
  };

  const getAssignmentDisplay = (assignment) => {
    const staffMember = staff.find(s => s.id === assignment.staffId);
    const student = students.find(s => s.id === assignment.studentId);
    
    if (!staffMember || !student) return null;

    return {
      id: assignment.id,
      staffName: staffMember.name,
      studentName: student.name,
      staffRole: staffMember.role,
      ratio: student.ratio,
      isLocked: schedule.isAssignmentLocked(assignment.id),
      assignedBy: assignment.assignedBy
    };
  };

  const handleCellClick = (session, program) => {
    setSelectedCell({ session, program });
    setShowAssignmentModal(true);
  };

  const getSessionTimeDisplay = (session, program) => {
    const times = SESSION_TIMES[program.toUpperCase()]?.[session];
    return times ? `${times.start} - ${times.end}` : '';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-blue-600 text-white p-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Schedule for {selectedDate.toLocaleDateString()}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Program</th>
              {sessions.map(session => (
                <th key={session} className="px-4 py-3 text-center font-semibold text-gray-700 min-w-80">
                  {session} Session
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map(program => (
              <tr key={program} className="border-b hover:bg-gray-50">
                <td className="px-4 py-6 font-medium text-gray-900 bg-gray-50">
                  <div className="flex flex-col">
                    <span className="text-lg">{program}</span>
                    <span className="text-sm text-gray-500">
                      {getStudentsForProgram(program).length} students
                    </span>
                  </div>
                </td>
                {sessions.map(session => {
                  const assignments = getSessionAssignments(session, program);
                  const timeDisplay = getSessionTimeDisplay(session, program);
                  
                  return (
                    <td key={`${program}-${session}`} className="px-4 py-6 align-top">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium text-gray-600">
                            {timeDisplay}
                          </span>
                          <button
                            onClick={() => handleCellClick(session, program)}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                          >
                            + Add Assignment
                          </button>
                        </div>
                        
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {assignments.map(assignment => {
                            const display = getAssignmentDisplay(assignment);
                            if (!display) return null;

                            return (
                              <AssignmentCard
                                key={assignment.id}
                                assignment={display}
                                onLock={() => onAssignmentLock(assignment.id)}
                                onUnlock={() => onAssignmentUnlock(assignment.id)}
                                onRemove={() => onAssignmentRemove(assignment.id)}
                              />
                            );
                          })}
                          
                          {assignments.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No assignments</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAssignmentModal && (
        <ManualAssignmentModal
          session={selectedCell.session}
          program={selectedCell.program}
          staff={staff}
          students={students}
          schedule={schedule}
          onAssign={onManualAssignment}
          onClose={() => setShowAssignmentModal(false)}
        />
      )}
    </div>
  );
};

/**
 * Assignment Card Component - Shows individual staff-student assignments
 */
const AssignmentCard = ({ assignment, onLock, onUnlock, onRemove }) => {
  const getRatioColor = (ratio) => {
    switch (ratio) {
      case RATIOS.TWO_TO_ONE: return 'bg-red-100 text-red-800';
      case RATIOS.ONE_TO_TWO: return 'bg-green-100 text-green-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      'RBT': 'bg-purple-100 text-purple-800',
      'BS': 'bg-indigo-100 text-indigo-800',
      'BCBA': 'bg-blue-100 text-blue-800',
      'EA': 'bg-green-100 text-green-800',
      'MHA': 'bg-yellow-100 text-yellow-800',
      'CC': 'bg-orange-100 text-orange-800',
      'Teacher': 'bg-pink-100 text-pink-800',
      'Director': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`border rounded-lg p-3 transition-all hover:shadow-md ${
      assignment.isLocked ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-medium text-gray-900">{assignment.studentName}</div>
          <div className="text-sm text-gray-600">{assignment.staffName}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={assignment.isLocked ? onUnlock : onLock}
            className={`p-1 rounded ${
              assignment.isLocked 
                ? 'text-yellow-600 hover:bg-yellow-100' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={assignment.isLocked ? 'Unlock assignment' : 'Lock assignment'}
          >
            {assignment.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded text-red-400 hover:bg-red-50"
            title="Remove assignment"
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(assignment.staffRole)}`}>
          {assignment.staffRole}
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRatioColor(assignment.ratio)}`}>
          {assignment.ratio}
        </span>
        {assignment.assignedBy === 'manual' && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Manual
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Manual Assignment Modal - Allows manual staff-student assignments
 */
const ManualAssignmentModal = ({ 
  session, 
  program, 
  staff, 
  students, 
  schedule, 
  onAssign, 
  onClose 
}) => {
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  // Get available staff and students for this session/program
  const availableStaff = staff.filter(s => 
    s.isActive && 
    s.canWorkProgram(program) &&
    schedule.isStaffAvailable(s.id, session, program)
  );

  const availableStudents = students.filter(s => 
    s.isActive && 
    s.program === program &&
    !schedule.getAssignmentsForSession(session, program).some(a => a.studentId === s.id)
  );

  const handleAssign = () => {
    if (!selectedStaff || !selectedStudent) {
      setValidationErrors(['Please select both staff and student']);
      return;
    }

    // Additional validation could be added here
    setValidationErrors([]);
    
    onAssign({
      staffId: parseInt(selectedStaff),
      studentId: parseInt(selectedStudent),
      session,
      program
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold mb-4">
          Manual Assignment - {program} {session}
        </h3>

        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            {validationErrors.map((error, index) => (
              <p key={index} className="text-red-700 text-sm">{error}</p>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Student
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a student...</option>
              {availableStudents.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.ratio})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Staff
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose staff member...</option>
              {availableStaff.map(staffMember => (
                <option key={staffMember.id} value={staffMember.id}>
                  {staffMember.name} ({staffMember.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Session Summary Component - Shows summary statistics for a session
 */
export const SessionSummary = ({ schedule, staff, students, session, program }) => {
  const assignments = schedule.getAssignmentsForSession(session, program);
  const programStudents = students.filter(s => s.program === program && s.isActive);
  const assignedStudents = new Set(assignments.map(a => a.studentId));
  const unassignedCount = programStudents.length - assignedStudents.size;
  
  const staffUtilization = {};
  assignments.forEach(assignment => {
    const staffMember = staff.find(s => s.id === assignment.staffId);
    if (staffMember) {
      staffUtilization[staffMember.name] = (staffUtilization[staffMember.name] || 0) + 1;
    }
  });

  const getCompletionColor = () => {
    if (unassignedCount === 0) return 'text-green-600';
    if (unassignedCount <= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-900 mb-3">
        {program} {session} Summary
      </h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Total Students:</span>
          <span className="font-medium">{programStudents.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Assigned:</span>
          <span className="font-medium">{assignedStudents.size}</span>
        </div>
        <div className="flex justify-between">
          <span>Unassigned:</span>
          <span className={`font-medium ${getCompletionColor()}`}>
            {unassignedCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Staff Used:</span>
          <span className="font-medium">{Object.keys(staffUtilization).length}</span>
        </div>
      </div>

      {unassignedCount === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Complete</span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Incomplete</span>
        </div>
      )}
    </div>
  );
};