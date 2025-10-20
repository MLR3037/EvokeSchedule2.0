import React, { useState, useMemo } from 'react';
import { GraduationCap, CheckCircle, Users, Search, ChevronRight, Star } from 'lucide-react';
import { TRAINING_STATUS } from '../types/index.js';

/**
 * Training Management Component
 * Allows tracking and updating staff training status for each student
 */
const TrainingManagement = ({ students, staff, onUpdateStudentTrainingStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('All');

  // Get unique programs
  const programs = useMemo(() => {
    const uniquePrograms = [...new Set(students.map(s => s.program))];
    return ['All', ...uniquePrograms];
  }, [students]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => s.isActive)
      .filter(s => selectedProgram === 'All' || s.program === selectedProgram)
      .filter(s => 
        searchTerm === '' || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedProgram, searchTerm]);

  // Calculate training statistics
  const stats = useMemo(() => {
    let totalStaffTrainingPairs = 0;
    let needsStaffOverlap = 0;
    let needsBCBAOverlap = 0;
    let trainers = 0;
    let solo = 0;

    students.forEach(student => {
      if (!student.isActive) return;
      
      const team = student.team || [];
      team.forEach(teamMember => {
        totalStaffTrainingPairs++;
        const status = student.getStaffTrainingStatus ? 
          student.getStaffTrainingStatus(teamMember.id) : 
          TRAINING_STATUS.SOLO;
        
        if (status === TRAINING_STATUS.OVERLAP_STAFF) needsStaffOverlap++;
        else if (status === TRAINING_STATUS.OVERLAP_BCBA) needsBCBAOverlap++;
        else if (status === TRAINING_STATUS.TRAINER) trainers++;
        else solo++; // CERTIFIED or SOLO both count as solo/complete
      });
    });

    return {
      total: totalStaffTrainingPairs,
      needsStaffOverlap,
      needsBCBAOverlap,
      trainers,
      solo
    };
  }, [students]);

  const getStaffMemberByEmail = (email) => {
    if (!email) return null;
    return staff.find(s => s.email && s.email.toLowerCase() === email.toLowerCase());
  };

  const getStaffMemberById = (id) => {
    return staff.find(s => s.id === id || s.id == id);
  };

  const handleStatusChange = (student, staffId, newStatus) => {
    if (onUpdateStudentTrainingStatus) {
      onUpdateStudentTrainingStatus(student.id, staffId, newStatus);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case TRAINING_STATUS.OVERLAP_STAFF:
        return 'bg-red-100 text-red-700 border-red-300';
      case TRAINING_STATUS.OVERLAP_BCBA:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case TRAINING_STATUS.TRAINER:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case TRAINING_STATUS.CERTIFIED:
        return 'bg-green-100 text-green-700 border-green-300';
      case TRAINING_STATUS.SOLO:
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case TRAINING_STATUS.OVERLAP_STAFF:
        return 'Staff Overlap';
      case TRAINING_STATUS.OVERLAP_BCBA:
        return 'BCBA Overlap';
      case TRAINING_STATUS.CERTIFIED:
        return 'Certified';
      case TRAINING_STATUS.SOLO:
      default:
        return 'Solo';
    }
  };

  const getRoleColor = (role) => {
    const roleColors = {
      'RBT': 'bg-purple-100 text-purple-800',
      'BS': 'bg-indigo-100 text-indigo-800', 
      'BCBA': 'bg-blue-100 text-blue-800',
      'EA': 'bg-green-100 text-green-800',
      'MHA': 'bg-yellow-100 text-yellow-800',
      'CC': 'bg-orange-100 text-orange-800',
      'Teacher': 'bg-pink-100 text-pink-800',
      'Director': 'bg-gray-100 text-gray-800'
    };
    return roleColors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Staff Training Management</h2>
            <p className="text-sm text-gray-600">Track training progress for staff working with students</p>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Assignments</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-700">{stats.needsStaffOverlap}</div>
            <div className="text-sm text-red-600">Staff Overlap</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700">{stats.needsBCBAOverlap}</div>
            <div className="text-sm text-yellow-600">BCBA Overlap</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-amber-700">{stats.trainers}</div>
            <div className="text-sm text-amber-600">Trainers</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">{stats.solo}</div>
            <div className="text-sm text-blue-600">Solo/Certified</div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Training Workflow:</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span><strong className="text-amber-700">⭐ Trainer:</strong> Designated trainer for this student (shown with star icon on schedule)</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span><strong className="text-red-700">🎓 Staff Overlap:</strong> New staff member needs to complete overlap sessions with existing team members</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span><strong className="text-yellow-700">🎓 BCBA Overlap:</strong> Staff has completed staff overlaps and now needs BCBA oversight sessions</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span><strong className="text-green-700">Certified:</strong> Staff has completed all training and is cleared to work solo with this student</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span><strong className="text-gray-700">Solo:</strong> Staff member already established (no training tracking needed)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search Students
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Program
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {programs.map(program => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Training List */}
      <div className="space-y-4">
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No students found</p>
          </div>
        ) : (
          filteredStudents.map(student => {
            const team = student.team || [];
            
            if (team.length === 0) {
              return null; // Skip students with no team
            }

            return (
              <div key={student.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold">{student.name}</h3>
                      <p className="text-sm text-blue-100">{student.program} Program</p>
                    </div>
                    <div className="text-sm text-blue-100">
                      {team.length} team member{team.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {team.map((teamMember, idx) => {
                    const staffMemberByEmail = getStaffMemberByEmail(teamMember.email);
                    const staffMemberById = getStaffMemberById(teamMember.id);
                    const staffMember = staffMemberByEmail || staffMemberById;
                    
                    const currentStatus = student.getStaffTrainingStatus ? 
                      student.getStaffTrainingStatus(teamMember.id) : 
                      TRAINING_STATUS.SOLO;

                    return (
                      <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <Users className="w-8 h-8 text-gray-400" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{teamMember.name || teamMember.title || 'Unknown'}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {staffMember && (
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(staffMember.role)}`}>
                                    {staffMember.role}
                                  </span>
                                )}
                                {teamMember.email && (
                                  <span className="text-xs text-gray-500">{teamMember.email}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex-1 md:flex-none">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Training Status</label>
                              <select
                                value={currentStatus}
                                onChange={(e) => handleStatusChange(student, teamMember.id, e.target.value)}
                                className={`w-full md:w-48 border rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusColor(currentStatus)}`}
                              >
                                <option value={TRAINING_STATUS.TRAINER}>⭐ Trainer</option>
                                <option value={TRAINING_STATUS.OVERLAP_STAFF}>🔴 Staff Overlap</option>
                                <option value={TRAINING_STATUS.OVERLAP_BCBA}>🟡 BCBA Overlap</option>
                                <option value={TRAINING_STATUS.CERTIFIED}>🟢 Certified</option>
                                <option value={TRAINING_STATUS.SOLO}>Solo</option>
                              </select>
                            </div>

                            {currentStatus === TRAINING_STATUS.TRAINER && (
                              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                            )}
                            {currentStatus === TRAINING_STATUS.CERTIFIED && (
                              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                            )}
                            {currentStatus === TRAINING_STATUS.OVERLAP_STAFF && (
                              <GraduationCap className="w-6 h-6 text-red-600 flex-shrink-0" />
                            )}
                            {currentStatus === TRAINING_STATUS.OVERLAP_BCBA && (
                              <GraduationCap className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrainingManagement;
