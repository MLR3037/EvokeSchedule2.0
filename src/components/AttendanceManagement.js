import React, { useState, useMemo } from 'react';
import { Calendar, UserX, Users, User, AlertCircle, Check } from 'lucide-react';

/**
 * Attendance Management Component
 * Allows marking staff and clients as absent for AM, PM, or full day
 */
export const AttendanceManagement = ({ 
  staff, 
  students, 
  currentDate,
  onUpdateStaffAttendance,
  onUpdateStudentAttendance,
  onResetAllAttendance
}) => {
  const [view, setView] = useState('staff'); // 'staff' or 'clients'
  const [searchTerm, setSearchTerm] = useState('');

  // Filter active staff and students
  const activeStaff = useMemo(() => 
    staff.filter(s => s.isActive && 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [staff, searchTerm]
  );

  const activeStudents = useMemo(() => 
    students.filter(s => s.isActive && 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [students, searchTerm]
  );

  // Count absences
  const counts = useMemo(() => {
    const staffAbsentAM = activeStaff.filter(s => s.absentAM || s.absentFullDay).length;
    const staffAbsentPM = activeStaff.filter(s => s.absentPM || s.absentFullDay).length;
    const clientsAbsentAM = activeStudents.filter(s => s.absentAM || s.absentFullDay).length;
    const clientsAbsentPM = activeStudents.filter(s => s.absentPM || s.absentFullDay).length;

    return {
      staffAbsentAM,
      staffAbsentPM,
      clientsAbsentAM,
      clientsAbsentPM,
      staffPresent: activeStaff.length - staffAbsentAM - staffAbsentPM + activeStaff.filter(s => s.absentFullDay).length,
      clientsPresent: activeStudents.length - clientsAbsentAM - clientsAbsentPM + activeStudents.filter(s => s.absentFullDay).length
    };
  }, [activeStaff, activeStudents]);

  const handleStaffAttendanceChange = (staffMember, field, value) => {
    // Create attendance update object with only the fields we need
    const updates = {
      absentAM: staffMember.absentAM || false,
      absentPM: staffMember.absentPM || false,
      absentFullDay: staffMember.absentFullDay || false,
      outOfSessionAM: staffMember.outOfSessionAM || false,
      outOfSessionPM: staffMember.outOfSessionPM || false,
      outOfSessionFullDay: staffMember.outOfSessionFullDay || false
    };
    
    if (field === 'absentFullDay') {
      updates.absentFullDay = value;
      updates.absentAM = value;
      updates.absentPM = value;
    } else if (field === 'absentAM') {
      updates.absentAM = value;
      if (!value && !updates.absentPM) {
        updates.absentFullDay = false;
      }
    } else if (field === 'absentPM') {
      updates.absentPM = value;
      if (!value && !updates.absentAM) {
        updates.absentFullDay = false;
      }
    } else if (field === 'outOfSessionFullDay') {
      updates.outOfSessionFullDay = value;
      updates.outOfSessionAM = value;
      updates.outOfSessionPM = value;
    } else if (field === 'outOfSessionAM') {
      updates.outOfSessionAM = value;
      if (!value && !updates.outOfSessionPM) {
        updates.outOfSessionFullDay = false;
      }
    } else if (field === 'outOfSessionPM') {
      updates.outOfSessionPM = value;
      if (!value && !updates.outOfSessionAM) {
        updates.outOfSessionFullDay = false;
      }
    }

    onUpdateStaffAttendance(staffMember.id, updates);
  };

  const handleStudentAttendanceChange = (student, field, value) => {
    // Create attendance update object with only the fields we need
    const updates = {
      absentAM: student.absentAM || false,
      absentPM: student.absentPM || false,
      absentFullDay: student.absentFullDay || false
    };
    
    if (field === 'absentFullDay') {
      updates.absentFullDay = value;
      updates.absentAM = value;
      updates.absentPM = value;
    } else if (field === 'absentAM') {
      updates.absentAM = value;
      if (!value && !updates.absentPM) {
        updates.absentFullDay = false;
      }
    } else if (field === 'absentPM') {
      updates.absentPM = value;
      if (!value && !updates.absentAM) {
        updates.absentFullDay = false;
      }
    }

    onUpdateStudentAttendance(student.id, updates);
  };

  const getStatusBadge = (person) => {
    const status = person.getAttendanceStatus();
    
    if (status === 'Present') {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
          <Check className="w-3 h-3" />
          Present
        </span>
      );
    } else if (status === 'Absent Full Day') {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
          <UserX className="w-3 h-3" />
          Absent Full Day
        </span>
      );
    } else if (status === 'Absent AM') {
      return (
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Absent AM
        </span>
      );
    } else if (status === 'Absent PM') {
      return (
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Absent PM
        </span>
      );
    } else if (status === 'Out Full Day') {
      return (
        <span className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Out Full Day
        </span>
      );
    } else if (status === 'Out AM') {
      return (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Out AM
        </span>
      );
    } else if (status === 'Out PM') {
      return (
        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Out PM
        </span>
      );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="bg-purple-600 text-white p-4 rounded-t-lg">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Attendance Management
        </h2>
        <p className="text-purple-100 text-sm mt-1">
          {new Date(currentDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{activeStaff.length}</div>
            <div className="text-sm text-blue-800">Total Staff</div>
            <div className="text-xs text-blue-600 mt-1">
              {counts.staffAbsentAM + counts.staffAbsentPM} absent today
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{activeStudents.length}</div>
            <div className="text-sm text-green-800">Total Clients</div>
            <div className="text-xs text-green-600 mt-1">
              {counts.clientsAbsentAM + counts.clientsAbsentPM} absent today
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {counts.staffAbsentAM + counts.clientsAbsentAM}
            </div>
            <div className="text-sm text-orange-800">Absent AM</div>
            <div className="text-xs text-orange-600 mt-1">
              {counts.staffAbsentAM} staff, {counts.clientsAbsentAM} clients
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {counts.staffAbsentPM + counts.clientsAbsentPM}
            </div>
            <div className="text-sm text-purple-800">Absent PM</div>
            <div className="text-xs text-purple-600 mt-1">
              {counts.staffAbsentPM} staff, {counts.clientsAbsentPM} clients
            </div>
          </div>
        </div>

        {/* View Toggle, Search, and Reset */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('staff')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'staff'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Staff ({activeStaff.length})
            </button>
            <button
              onClick={() => setView('clients')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'clients'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Clients ({activeStudents.length})
            </button>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {onResetAllAttendance && (
            <button
              onClick={() => {
                if (window.confirm('Clear all attendance for all staff and clients? This will mark everyone as present.')) {
                  onResetAllAttendance();
                }
              }}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 transition-colors font-medium whitespace-nowrap"
            >
              Reset All
            </button>
          )}
        </div>

        {/* Staff View */}
        {view === 'staff' && (
          <div className="space-y-3">
            {activeStaff.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No staff members found
              </div>
            ) : (
              activeStaff.map(staffMember => (
                <div
                  key={staffMember.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {staffMember.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{staffMember.name}</h3>
                        <span className="text-sm text-gray-600">{staffMember.role}</span>
                      </div>
                    </div>
                    {getStatusBadge(staffMember)}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffMember.absentAM || staffMember.absentFullDay}
                        onChange={(e) => handleStaffAttendanceChange(staffMember, 'absentAM', e.target.checked)}
                        disabled={staffMember.absentFullDay}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">Absent AM</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffMember.absentPM || staffMember.absentFullDay}
                        onChange={(e) => handleStaffAttendanceChange(staffMember, 'absentPM', e.target.checked)}
                        disabled={staffMember.absentFullDay}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Absent PM</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffMember.absentFullDay}
                        onChange={(e) => handleStaffAttendanceChange(staffMember, 'absentFullDay', e.target.checked)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Full Day</span>
                    </label>
                  </div>

                  {/* Out of Session Section */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 font-medium mb-2">Out of Session (Meetings, etc.)</div>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={staffMember.outOfSessionAM || staffMember.outOfSessionFullDay}
                          onChange={(e) => handleStaffAttendanceChange(staffMember, 'outOfSessionAM', e.target.checked)}
                          disabled={staffMember.outOfSessionFullDay || staffMember.absentAM || staffMember.absentFullDay}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Out AM</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={staffMember.outOfSessionPM || staffMember.outOfSessionFullDay}
                          onChange={(e) => handleStaffAttendanceChange(staffMember, 'outOfSessionPM', e.target.checked)}
                          disabled={staffMember.outOfSessionFullDay || staffMember.absentPM || staffMember.absentFullDay}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">Out PM</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={staffMember.outOfSessionFullDay}
                          onChange={(e) => handleStaffAttendanceChange(staffMember, 'outOfSessionFullDay', e.target.checked)}
                          disabled={staffMember.absentFullDay}
                          className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="text-sm text-gray-700 font-medium">Out Full Day</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Clients View */}
        {view === 'clients' && (
          <div className="space-y-3">
            {activeStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No clients found
              </div>
            ) : (
              activeStudents.map(student => (
                <div
                  key={student.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-medium">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{student.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{student.program}</span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            AM: {student.ratioAM}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            PM: {student.ratioPM}
                          </span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(student)}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={student.absentAM || student.absentFullDay}
                        onChange={(e) => handleStudentAttendanceChange(student, 'absentAM', e.target.checked)}
                        disabled={student.absentFullDay}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">Absent AM</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={student.absentPM || student.absentFullDay}
                        onChange={(e) => handleStudentAttendanceChange(student, 'absentPM', e.target.checked)}
                        disabled={student.absentFullDay}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Absent PM</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={student.absentFullDay}
                        onChange={(e) => handleStudentAttendanceChange(student, 'absentFullDay', e.target.checked)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">Full Day</span>
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Attendance Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Marking "Full Day" will automatically mark both AM and PM as absent</li>
                <li>Absent staff will be excluded from auto-scheduling</li>
                <li>Absent clients will not be assigned staff in auto-scheduling</li>
                <li>Attendance changes are saved immediately</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceManagement;
