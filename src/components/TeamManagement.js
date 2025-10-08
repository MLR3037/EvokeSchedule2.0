import React, { useState, useMemo } from 'react';
import { Users, User, Search, Filter, Edit, Eye } from 'lucide-react';

/**
 * Team Management Component - Allows viewing clients by staff and staff by client
 */
export const TeamManagement = ({ 
  staff, 
  students, 
  onEditStudent,
  onEditStaff 
}) => {
  const [view, setView] = useState('clients-by-staff'); // or 'staff-by-client'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');

  // Prepare data for clients by staff view
  const clientsByStaff = useMemo(() => {
    const result = {};
    
    staff.filter(s => s.isActive).forEach(staffMember => {
      result[staffMember.id] = {
        staff: staffMember,
        clients: students.filter(student => 
          student.isActive && 
          student.team.some(teamMember => {
            // Match by name since the IDs are different systems
            const staffName = staffMember.name?.toLowerCase().trim();
            const teamMemberName = teamMember.title?.toLowerCase().trim();
            
            // Also try matching by email if available
            const staffEmail = staffMember.email?.toLowerCase().trim();
            const teamMemberEmail = teamMember.email?.toLowerCase().trim();
            
            // Exact name match
            if (staffName && teamMemberName && staffName === teamMemberName) {
              return true;
            }
            
            // Email match
            if (staffEmail && teamMemberEmail && staffEmail === teamMemberEmail) {
              return true;
            }
            
            // Partial name match (first name match)
            if (staffName && teamMemberName) {
              const staffFirstName = staffName.split(' ')[0];
              const teamMemberFirstName = teamMemberName.split(' ')[0];
              if (staffFirstName === teamMemberFirstName && staffFirstName.length > 2) {
                return true;
              }
            }
            
            return false;
          })
        )
      };
    });
    
    return result;
  }, [staff, students]);

  // Prepare data for staff by client view
  const staffByClient = useMemo(() => {
    const result = {};
    
    students.filter(s => s.isActive).forEach(student => {
      result[student.id] = {
        student: student,
        teamMembers: student.team.map(teamMember => {
          // Find staff by matching name or email instead of ID
          return staff.find(s => {
            const staffName = s.name?.toLowerCase().trim();
            const teamMemberName = teamMember.title?.toLowerCase().trim();
            const staffEmail = s.email?.toLowerCase().trim();
            const teamMemberEmail = teamMember.email?.toLowerCase().trim();
            
            // Exact name match
            if (staffName && teamMemberName && staffName === teamMemberName) {
              return true;
            }
            
            // Email match
            if (staffEmail && teamMemberEmail && staffEmail === teamMemberEmail) {
              return true;
            }
            
            // Partial name match (first name match)
            if (staffName && teamMemberName) {
              const staffFirstName = staffName.split(' ')[0];
              const teamMemberFirstName = teamMemberName.split(' ')[0];
              if (staffFirstName === teamMemberFirstName && staffFirstName.length > 2) {
                return true;
              }
            }
            
            return false;
          });
        }).filter(Boolean)
      };
    });
    
    return result;
  }, [staff, students]);

  // Filter data based on search and program
  const filteredData = useMemo(() => {
    if (view === 'clients-by-staff') {
      return Object.values(clientsByStaff).filter(item => {
        const matchesSearch = item.staff.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProgram = !selectedProgram || 
          (selectedProgram === 'Primary' && item.staff.primaryProgram) ||
          (selectedProgram === 'Secondary' && item.staff.secondaryProgram);
        return matchesSearch && matchesProgram;
      });
    } else {
      return Object.values(staffByClient).filter(item => {
        const matchesSearch = item.student.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProgram = !selectedProgram || item.student.program === selectedProgram;
        return matchesSearch && matchesProgram;
      });
    }
  }, [view, clientsByStaff, staffByClient, searchTerm, selectedProgram]);

  const getClientCountByRatio = (clients, ratio, session) => {
    return clients.filter(client => client.getSessionRatio(session) === ratio).length;
  };

  const getStaffRoleColor = (role) => {
    const colors = {
      'RBT': 'bg-blue-100 text-blue-800',
      'Senior RBT': 'bg-green-100 text-green-800',
      'Lead': 'bg-purple-100 text-purple-800',
      'Supervisor': 'bg-orange-100 text-orange-800',
      'Director': 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="bg-indigo-600 text-white p-4 rounded-t-lg">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Team Management
        </h2>
      </div>

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
                          {item.staff.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.staff.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStaffRoleColor(item.staff.role)}`}>
                              {item.staff.role}
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
                      <button
                        onClick={() => onEditStaff && onEditStaff(item.staff)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
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
                              <span className="text-sm">{client.name}</span>
                              <div className="flex gap-1">
                                <span className="text-xs bg-blue-200 text-blue-700 px-1 rounded">
                                  AM: {client.ratioAM}
                                </span>
                                <span className="text-xs bg-green-200 text-green-700 px-1 rounded">
                                  PM: {client.ratioPM}
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
                          {item.student.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.student.name}</h3>
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
                        <div className="flex flex-wrap gap-2">
                          {item.teamMembers.map(staffMember => (
                            <div key={staffMember.id} className="flex items-center gap-2 bg-indigo-100 rounded-full px-3 py-1">
                              <span className="text-sm">{staffMember.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${getStaffRoleColor(staffMember.role)}`}>
                                {staffMember.role}
                              </span>
                            </div>
                          ))}
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