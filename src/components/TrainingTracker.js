import React, { useState, useEffect } from 'react';
import { GraduationCap, Calendar, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { TRAINING_STATUS } from '../types/index.js';

/**
 * Training Tracker Component
 * Shows staff members in training with their training history
 */
export const TrainingTracker = ({ staff, students, sharePointService }) => {
  const [trainingData, setTrainingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProgram, setFilterProgram] = useState('All');
  const [sortBy, setSortBy] = useState('name'); // name, sessions, date

  useEffect(() => {
    loadTrainingData();
  }, [staff, students]);

  const loadTrainingData = async () => {
    setLoading(true);
    try {
      console.log('📚 Loading training data...');
      
      // Get training history from SharePoint (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const trainingHistory = await sharePointService.getTrainingHistory(ninetyDaysAgo, new Date());
      
      // Build training data for each staff member
      const trainingMap = {};
      
      // Process each staff member
      staff.forEach(staffMember => {
        if (!staffMember.isActive) return;
        
        // Find all students where this staff is in training
        const trainingClients = [];
        
        students.forEach(student => {
          if (!student.isActive) return;
          
          const trainingStatus = student.getStaffTrainingStatus ? 
            student.getStaffTrainingStatus(staffMember.id) : TRAINING_STATUS.SOLO;
          
          if (trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || trainingStatus === TRAINING_STATUS.OVERLAP_BCBA) {
            // Get training history for this staff-student pair
            const sessions = trainingHistory.filter(
              h => h.StaffId === staffMember.id && h.StudentId === student.id
            );
            
            if (sessions.length > 0 || trainingStatus === TRAINING_STATUS.OVERLAP_STAFF || trainingStatus === TRAINING_STATUS.OVERLAP_BCBA) {
              // Find first training session date
              const sortedSessions = sessions.sort((a, b) => 
                new Date(a.ScheduleDate) - new Date(b.ScheduleDate)
              );
              
              const firstSession = sortedSessions.length > 0 ? new Date(sortedSessions[0].ScheduleDate) : null;
              
              trainingClients.push({
                studentId: student.id,
                studentName: student.name,
                program: student.program,
                trainingStatus: trainingStatus,
                firstSession: firstSession,
                sessionsCompleted: sessions.length,
                sessions: sortedSessions
              });
            }
          }
        });
        
        if (trainingClients.length > 0) {
          trainingMap[staffMember.id] = {
            staffId: staffMember.id,
            staffName: staffMember.name,
            role: staffMember.role,
            clients: trainingClients
          };
        }
      });
      
      setTrainingData(Object.values(trainingMap));
      console.log('✅ Training data loaded:', Object.keys(trainingMap).length, 'staff in training');
    } catch (error) {
      console.error('Error loading training data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    let filtered = trainingData;
    
    // Filter by program
    if (filterProgram !== 'All') {
      filtered = filtered.map(staff => ({
        ...staff,
        clients: staff.clients.filter(c => c.program === filterProgram)
      })).filter(staff => staff.clients.length > 0);
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.staffName.localeCompare(b.staffName);
        case 'sessions':
          const aSessions = a.clients.reduce((sum, c) => sum + c.sessionsCompleted, 0);
          const bSessions = b.clients.reduce((sum, c) => sum + c.sessionsCompleted, 0);
          return bSessions - aSessions;
        case 'date':
          const aFirst = Math.min(...a.clients.map(c => c.firstSession?.getTime() || Infinity));
          const bFirst = Math.min(...b.clients.map(c => c.firstSession?.getTime() || Infinity));
          return aFirst - bFirst;
        default:
          return 0;
      }
    });
    
    return sorted;
  };

  const getRoleColor = (role) => {
    const colors = {
      'RBT': 'bg-purple-100 text-purple-800',
      'BS': 'bg-blue-100 text-blue-800',
      'BCBA': 'bg-orange-100 text-orange-800',
      'EA': 'bg-green-100 text-green-800',
      'MHA': 'bg-yellow-100 text-yellow-800',
      'CC': 'bg-red-100 text-red-800',
      'Teacher': 'bg-pink-100 text-pink-800',
      'Director': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getTrainingStatusBadge = (status) => {
    if (status === TRAINING_STATUS.OVERLAP_STAFF) {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium flex items-center gap-1">
          <GraduationCap className="w-3 h-3" />
          Staff Overlap
        </span>
      );
    }
    if (status === TRAINING_STATUS.OVERLAP_BCBA) {
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium flex items-center gap-1">
          <GraduationCap className="w-3 h-3" />
          BCBA Overlap
        </span>
      );
    }
    return null;
  };

  const filteredData = getFilteredData();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading training data...</span>
        </div>
      </div>
    );
  }

  if (trainingData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <GraduationCap className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Staff in Training</h3>
        <p className="text-gray-600">
          There are currently no staff members with training status (overlap-staff or overlap-bcba).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Training Tracker</h2>
              <p className="text-sm text-gray-600">
                {trainingData.length} staff member{trainingData.length !== 1 ? 's' : ''} currently in training
              </p>
            </div>
          </div>
          
          <button
            onClick={loadTrainingData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Refresh Data
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <label className="text-sm font-medium text-gray-700">Filter by Program:</label>
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="All">All Programs</option>
            <option value="Primary">Primary</option>
            <option value="Secondary">Secondary</option>
          </select>

          <label className="text-sm font-medium text-gray-700 ml-4">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="name">Staff Name</option>
            <option value="sessions">Total Sessions</option>
            <option value="date">First Training Date</option>
          </select>
        </div>
      </div>

      {/* Training Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Staff Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Training On
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Training Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                First Training Session
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sessions Completed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.map(staffData => (
              staffData.clients.map((client, idx) => (
                <tr key={`${staffData.staffId}-${client.studentId}`} className="hover:bg-gray-50">
                  {idx === 0 && (
                    <td 
                      className="px-6 py-4 whitespace-nowrap border-r bg-gray-50" 
                      rowSpan={staffData.clients.length}
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {staffData.staffName}
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(staffData.role)}`}>
                          {staffData.role}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{client.studentName}</div>
                      <div className="text-xs text-gray-500">{client.program}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getTrainingStatusBadge(client.trainingStatus)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.firstSession ? (
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {client.firstSession.toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No sessions yet</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        client.sessionsCompleted === 0 ? 'text-gray-400' :
                        client.sessionsCompleted < 3 ? 'text-yellow-600' :
                        client.sessionsCompleted < 6 ? 'text-blue-600' :
                        'text-green-600'
                      }`}>
                        {client.sessionsCompleted}
                      </span>
                      {client.sessionsCompleted >= 6 && (
                        <CheckCircle className="w-4 h-4 text-green-600" title="6+ sessions completed" />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-3">
              <GraduationCap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Staff in Training</div>
              <div className="text-2xl font-bold text-gray-900">{filteredData.length}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-lg p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Training Sessions</div>
              <div className="text-2xl font-bold text-gray-900">
                {filteredData.reduce((sum, staff) => 
                  sum + staff.clients.reduce((clientSum, client) => clientSum + client.sessionsCompleted, 0), 
                0)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 rounded-lg p-3">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Clients in Training</div>
              <div className="text-2xl font-bold text-gray-900">
                {new Set(filteredData.flatMap(staff => staff.clients.map(c => c.studentId))).size}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
