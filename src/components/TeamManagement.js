import React, { useState, useMemo, useEffect } from 'react';
import { Users, User, Search, Filter, Edit, Eye, GraduationCap, RefreshCw, Clock } from 'lucide-react';
import { TRAINING_STATUS } from '../types/index.js';

/**
 * Team Management Component - Allows viewing clients by staff and staff by client
 */
export const TeamManagement = ({ 
  staff, 
  students,
  dataLoadedAt,
  loading,
  onEditStudent,
  onEditStaff,
  onCleanupDeletedStaff,
  onUpdateTrainingStatus
}) => {
  // Restore view preferences from localStorage or use defaults
  const [view, setView] = useState(() => {
    return localStorage.getItem('teamManagement_view') || 'clients-by-staff';
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem('teamManagement_searchTerm') || '';
  });
  const [selectedProgram, setSelectedProgram] = useState(() => {
    return localStorage.getItem('teamManagement_selectedProgram') || '';
  });

  // Save view preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('teamManagement_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('teamManagement_searchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('teamManagement_selectedProgram', selectedProgram);
  }, [selectedProgram]);

  // Prepare data for clients by staff view
  const clientsByStaff = useMemo(() => {
    const result = {};
    
    staff.filter(s => s.isActive).forEach(staffMember => {
      const assignedClients = students.filter(student => {
        if (!student.isActive) return false;
        
        if (!student.team || student.team.length === 0) {
          return false;
        }
        
        // Check if this staff member is in the student's team
        const isInTeam = student.team.some(teamMember => {
          // Primary match: by email (most reliable)
          const staffEmail = staffMember.email?.toLowerCase().trim();
          const teamMemberEmail = teamMember.email?.toLowerCase().trim();
          
          if (staffEmail && teamMemberEmail && staffEmail === teamMemberEmail) {
            return true;
          }
          
          // Secondary match: by ID
          if (staffMember.id && teamMember.id && staffMember.id === teamMember.id) {
            return true;
          }
          
          // Tertiary match: by name (less reliable but might be needed)
          const staffName = staffMember.name?.toLowerCase().trim();
          const teamMemberName = teamMember.title?.toLowerCase().trim() || teamMember.name?.toLowerCase().trim();
          
          if (staffName && teamMemberName && staffName === teamMemberName) {
            return true;
          }
          
          return false;
        });
        
        return isInTeam;
      });
      
      result[staffMember.id] = {
        staff: staffMember,
        clients: assignedClients
      };
    });
    
    return result;
  }, [staff, students]);

  // Prepare data for staff by client view
  const staffByClient = useMemo(() => {
    const result = {};
    
    students.filter(s => s.isActive).forEach(student => {
      const teamMembers = student.team.map((teamMember, index) => {
        // Find staff by email, ID, or name
        const staffMember = staff.find(s => {
          // Primary match: by email
          const staffEmail = s.email?.toLowerCase().trim();
          const teamMemberEmail = teamMember.email?.toLowerCase().trim();
          
          if (staffEmail && teamMemberEmail && staffEmail === teamMemberEmail) {
            return true;
          }
          
          // Secondary match: by ID
          if (s.id && teamMember.id && s.id === teamMember.id) {
            return true;
          }
          
          // Tertiary match: by name
          const staffName = s.name?.toLowerCase().trim();
          const teamMemberName = teamMember.title?.toLowerCase().trim() || teamMember.name?.toLowerCase().trim();
          
          if (staffName && teamMemberName && staffName === teamMemberName) {
            return true;
          }
          
          return false;
        });
        
        // Return the team member info with People Picker name, but staff role
        if (staffMember) {
          return {
            id: staffMember.id,
            name: teamMember.title || teamMember.DisplayName || teamMember.LookupValue || staffMember.name, // Use People Picker name
            role: staffMember.role?.name || staffMember.role, // Handle both object and string
            email: staffMember.email
          };
        } else {
          // Return team member even if no staff match - use unique ID based on email or index
          return {
            id: teamMember.id || `unknown-${student.id}-${index}`,
            name: teamMember.title || teamMember.DisplayName || teamMember.LookupValue || 'Unknown',
            role: 'Unknown',
            email: teamMember.email
          };
        }
      }).filter(Boolean);
      
      // Sort team members by role first, then alphabetically
      const rolePriority = {
        'CC': 1,
        'BCBA': 2,
        'Teacher': 3,
        'EA': 4,
        'BS': 5,
        'RBT': 6,
        'MHA': 7,
        'Director': 8
      };
      
      teamMembers.sort((a, b) => {
        const roleA = rolePriority[a.role] || 999;
        const roleB = rolePriority[b.role] || 999;
        
        if (roleA !== roleB) {
          return roleA - roleB;
        }
        return a.name.localeCompare(b.name);
      });

      result[student.id] = {
        student: student,
        teamMembers: teamMembers
      };
    });
    
    return result;
  }, [staff, students]);

  // Filter data based on search and program
  const filteredData = useMemo(() => {
    // Define role priority order (lower number = higher priority)
    const rolePriority = {
      'BCBA': 1,
      'CC': 2,
      'Teacher': 3,
      'EA': 4,
      'BS': 5,
      'RBT': 6,
      'MHA': 7,
      'Director': 8
    };

    let data;
    if (view === 'clients-by-staff') {
      data = Object.values(clientsByStaff).filter(item => {
        const matchesSearch = item.staff.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProgram = !selectedProgram || 
          (selectedProgram === 'Primary' && item.staff.primaryProgram) ||
          (selectedProgram === 'Secondary' && item.staff.secondaryProgram);
        return matchesSearch && matchesProgram;
      });
      // Sort by role first, then alphabetically by name
      data.sort((a, b) => {
        // Extract role string (handle both string and object)
        const getRoleString = (staff) => {
          if (typeof staff.role === 'string') return staff.role;
          if (typeof staff.role === 'object' && staff.role?.name) return staff.role.name;
          return 'Unknown';
        };
        
        const roleA = rolePriority[getRoleString(a.staff)] || 999;
        const roleB = rolePriority[getRoleString(b.staff)] || 999;
        
        if (roleA !== roleB) {
          return roleA - roleB;
        }
        return a.staff.name.localeCompare(b.staff.name);
      });
    } else {
      data = Object.values(staffByClient).filter(item => {
        const matchesSearch = item.student.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProgram = !selectedProgram || item.student.program === selectedProgram;
        return matchesSearch && matchesProgram;
      });
      // Sort alphabetically by student name
      data.sort((a, b) => a.student.name.localeCompare(b.student.name));
    }
    return data;
  }, [view, clientsByStaff, staffByClient, searchTerm, selectedProgram]);

  const getClientCountByRatio = (clients, ratio, session) => {
    return clients.filter(client => client.getSessionRatio(session) === ratio).length;
  };

  const getStaffRoleColor = (role) => {
    const colors = {
      'RBT': 'bg-purple-100 text-purple-700 font-bold',
      'BS': 'bg-blue-100 text-blue-700 font-bold',
      'BCBA': 'bg-orange-100 text-orange-700 font-bold',
      'EA': 'bg-green-100 text-green-700 font-bold',
      'MHA': 'bg-yellow-100 text-yellow-800 font-bold',
      'CC': 'bg-red-100 text-red-700 font-bold',
      'Teacher': 'bg-pink-100 text-pink-700 font-bold',
      'Director': 'bg-gray-100 text-gray-800 font-bold'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 font-bold';
  };

  const getTrainingStatusLabel = (status) => {
    const labels = {
      [TRAINING_STATUS.CERTIFIED]: 'Certified',
      [TRAINING_STATUS.TRAINER]: 'Trainer',
      [TRAINING_STATUS.OVERLAP_BCBA]: 'Overlap BCBA',
      [TRAINING_STATUS.OVERLAP_STAFF]: 'Overlap Staff',
      [TRAINING_STATUS.SOLO]: 'Solo'
    };
    return labels[status] || 'Solo';
  };

  const getTrainingStatusColor = (status) => {
    const colors = {
      [TRAINING_STATUS.CERTIFIED]: 'bg-green-100 text-green-800 border-green-300',
      [TRAINING_STATUS.TRAINER]: 'bg-purple-100 text-purple-800 border-purple-300',
      [TRAINING_STATUS.OVERLAP_BCBA]: 'bg-orange-100 text-orange-800 border-orange-300',
      [TRAINING_STATUS.OVERLAP_STAFF]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      [TRAINING_STATUS.SOLO]: 'bg-green-100 text-green-800 border-green-300 font-bold'
    };
    return colors[status] || 'bg-green-100 text-green-800 border-green-300 font-bold';
  };

  const handleTrainingStatusChange = async (studentId, staffId, newStatus) => {
    if (onUpdateTrainingStatus) {
      await onUpdateTrainingStatus(studentId, staffId, newStatus);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="bg-indigo-600 text-white p-4 rounded-t-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Management
          </h2>
          
          {/* Cleanup Button */}
          {onCleanupDeletedStaff && (
            <button
              onClick={onCleanupDeletedStaff}
              className="px-4 py-2 bg-white text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors text-sm font-medium flex items-center gap-2"
              title="Remove deleted staff from all student teams"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clean Up Teams
            </button>
          )}
        </div>
      </div>

      {/* Data Freshness Indicator */}
      {(loading || dataLoadedAt) && (
        <div className="border-b border-gray-200">
          {loading ? (
            <div className="px-6 py-3 bg-blue-50 flex items-center gap-2 text-blue-700">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Loading team data...</span>
            </div>
          ) : dataLoadedAt && (
            <div className="px-6 py-3 bg-gray-50 flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Last updated: {new Date(dataLoadedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-6">
        {/* View Toggle and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('clients-by-staff')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'clients-by-staff'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Clients by Staff
            </button>
            <button
              onClick={() => setView('staff-by-client')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'staff-by-client'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Staff by Client
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${view === 'clients-by-staff' ? 'staff' : 'clients'}...`}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
              >
                <option value="">All Programs</option>
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No {view === 'clients-by-staff' ? 'staff' : 'clients'} found</p>
            </div>
          ) : (
            filteredData.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                {view === 'clients-by-staff' ? (
                  /* Staff Member Card */
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-medium">
                          {typeof item.staff.name === 'string' ? item.staff.name.charAt(0) : (item.staff.name?.toString?.().charAt(0) || '?')}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{typeof item.staff.name === 'string' ? item.staff.name : (item.staff.name?.toString?.() || JSON.stringify(item.staff.name))}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStaffRoleColor(typeof item.staff.role === 'object' ? item.staff.role.name : item.staff.role)}`}>
                              {typeof item.staff.role === 'object' ? item.staff.role.name : (typeof item.staff.role === 'string' ? item.staff.role : JSON.stringify(item.staff.role))}
                            </span>
                            <div className="flex gap-1">
                              {item.staff.primaryProgram && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Primary</span>
                              )}
                              {item.staff.secondaryProgram && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Secondary</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* No edit button in Clients by Staff view to avoid errors */}
                    </div>

                    <div className="ml-13">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Clients: {item.clients.length}
                        </span>
                        {item.clients.length > 0 && (
                          <>
                            <span className="text-xs text-gray-500">
                              AM: {getClientCountByRatio(item.clients, '1:1', 'AM')} (1:1), 
                              {getClientCountByRatio(item.clients, '2:1', 'AM')} (2:1), 
                              {getClientCountByRatio(item.clients, '1:2', 'AM')} (1:2)
                            </span>
                            <span className="text-xs text-gray-500">
                              PM: {getClientCountByRatio(item.clients, '1:1', 'PM')} (1:1), 
                              {getClientCountByRatio(item.clients, '2:1', 'PM')} (2:1), 
                              {getClientCountByRatio(item.clients, '1:2', 'PM')} (1:2)
                            </span>
                          </>
                        )}
                      </div>

                      {item.clients.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.clients.map(client => (
                            <div key={client.id} className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                              <span className="text-sm">{typeof client.name === 'string' ? client.name : (client.name?.toString?.() || JSON.stringify(client.name))}</span>
                              <div className="flex gap-1">
                                <span className="text-xs bg-blue-200 text-blue-700 px-1 rounded">
                                  AM: {typeof client.ratioAM === 'string' ? client.ratioAM : (client.ratioAM?.toString?.() || JSON.stringify(client.ratioAM))}
                                </span>
                                <span className="text-xs bg-green-200 text-green-700 px-1 rounded">
                                  PM: {typeof client.ratioPM === 'string' ? client.ratioPM : (client.ratioPM?.toString?.() || JSON.stringify(client.ratioPM))}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Client Card */
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-medium">
                          {typeof item.student.name === 'string' ? item.student.name.charAt(0) : (item.student.name?.toString?.().charAt(0) || '?')}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{typeof item.student.name === 'string' ? item.student.name : (item.student.name?.toString?.() || JSON.stringify(item.student.name))}</h3>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {item.student.program}
                            </span>
                            <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded">
                              AM: {item.student.ratioAM}
                            </span>
                            <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded">
                              PM: {item.student.ratioPM}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onEditStudent && onEditStudent(item.student)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="ml-13">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Team Members: {item.teamMembers.length}
                        </span>
                      </div>

                      {item.teamMembers.length > 0 ? (
                        <div className="space-y-2">
                          {item.teamMembers.map(staffMember => {
                            const trainingStatus = item.student.getStaffTrainingStatus ? item.student.getStaffTrainingStatus(staffMember.id) : TRAINING_STATUS.SOLO;
                            
                            return (
                              <div key={staffMember.id} className="flex items-center justify-between bg-indigo-50 rounded-lg px-4 py-3 border border-indigo-200">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                    {typeof staffMember.name === 'string' ? staffMember.name.charAt(0) : (staffMember.name?.toString?.().charAt(0) || '?')}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{typeof staffMember.name === 'string' ? staffMember.name : (staffMember.name?.toString?.() || JSON.stringify(staffMember.name))}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${getStaffRoleColor(typeof staffMember.role === 'object' ? staffMember.role.name : (typeof staffMember.role === 'string' ? staffMember.role : JSON.stringify(staffMember.role)))}`}>
                                        {typeof staffMember.role === 'object' ? staffMember.role.name : (typeof staffMember.role === 'string' ? staffMember.role : JSON.stringify(staffMember.role))}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Training Status Dropdown */}
                                <div className="flex items-center gap-2">
                                  <GraduationCap className="w-4 h-4 text-gray-400" />
                                  <select
                                    value={trainingStatus}
                                    onChange={(e) => handleTrainingStatusChange(item.student.id, staffMember.id, e.target.value)}
                                    className={`text-xs px-3 py-1.5 rounded-md border font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${getTrainingStatusColor(trainingStatus)}`}
                                  >
                                    <option value={TRAINING_STATUS.TRAINER}>⭐ Trainer</option>
                                    <option value={TRAINING_STATUS.OVERLAP_BCBA}>🔶 Overlap BCBA</option>
                                    <option value={TRAINING_STATUS.OVERLAP_STAFF}>🔷 Overlap Staff</option>
                                    <option value={TRAINING_STATUS.SOLO}>✓ Solo</option>
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No team members assigned</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary Statistics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {staff.filter(s => s.isActive).length}
            </div>
            <div className="text-sm text-gray-600">Active Staff</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {students.filter(s => s.isActive).length}
            </div>
            <div className="text-sm text-gray-600">Active Clients</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Object.values(staffByClient).reduce((total, item) => total + item.teamMembers.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Team Assignments</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamManagement;