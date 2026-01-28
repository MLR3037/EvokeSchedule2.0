import React, { useState } from 'react';
import { ExternalLink, Users, Filter } from 'lucide-react';

/**
 * Teams Grid View Component
 * Displays all clients with their assigned team members in a grid format
 * Can be opened in a new window for display/sharing
 */
const TeamsGridView = ({ students, staff, selectedDate }) => {
  const [programFilter, setProgramFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'program'

  // Filter and sort students
  let filteredStudents = students.filter(s => s.isActive);
  
  if (programFilter !== 'All') {
    filteredStudents = filteredStudents.filter(s => s.program === programFilter);
  }
  
  if (sortBy === 'program') {
    filteredStudents.sort((a, b) => {
      if (a.program === b.program) {
        return a.name.localeCompare(b.name);
      }
      return a.program.localeCompare(b.program);
    });
  } else {
    filteredStudents.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Open in new window
  const openInNewWindow = () => {
    const newWindow = window.open('', 'TeamsGrid', 'width=1200,height=800,scrollbars=yes');
    if (newWindow) {
      const htmlContent = generatePopupHTML(filteredStudents, staff);
      newWindow.document.write(htmlContent);
    }
  };

  // Generate HTML for popup
  const generatePopupHTML = (studentsData, staffData) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Teams Grid - ${selectedDate.toLocaleDateString()}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #f5f5f5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          h1 {
            color: #2563eb;
            margin: 0;
          }
          .filters {
            display: flex;
            gap: 12px;
            align-items: center;
          }
          .filter-label {
            font-size: 14px;
            color: #374151;
            font-weight: 500;
          }
          select {
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            background: white;
            cursor: pointer;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          th {
            background: #2563eb;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          tr:hover {
            background: #f9fafb;
          }
          .read-only {
            background: #f3f4f6;
            color: #374151;
          }
          .team-member {
            display: inline-block;
            padding: 4px 8px;
            margin: 2px;
            border-radius: 4px;
            font-size: 13px;
            background: #e5e7eb;
            color: #374151;
          }
          .team-member.rbt {
            background: #ddd6fe;
            color: #5b21b6;
            font-weight: 600;
          }
          .team-member.bs {
            background: #bfdbfe;
            color: #1e40af;
            font-weight: 600;
          }
          .team-member.bcba {
            background: #fed7aa;
            color: #9a3412;
            font-weight: 600;
          }
          .team-member.ea {
            background: #bbf7d0;
            color: #15803d;
            font-weight: 600;
          }
          .team-member.mha {
            background: #fef08a;
            color: #854d0e;
            font-weight: 600;
          }
          .team-member.cc {
            background: #fecaca;
            color: #991b1b;
            font-weight: 600;
          }
          .team-member.teacher {
            background: #fbcfe8;
            color: #9f1239;
            font-weight: 600;
          }
          .team-member.trainer {
            border: 2px solid #fbbf24;
          }
          .team-member.overlap {
            border: 2px dashed #f97316;
          }
          @media print {
            .filters {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Teams Grid - ${selectedDate.toLocaleDateString()}</h1>
          <div class="filters">
            <label class="filter-label">Filter:</label>
            <select id="programFilter" onchange="updateFilter()">
              <option value="All" ${programFilter === 'All' ? 'selected' : ''}>All Programs</option>
              <option value="Primary" ${programFilter === 'Primary' ? 'selected' : ''}>Primary</option>
              <option value="Secondary" ${programFilter === 'Secondary' ? 'selected' : ''}>Secondary</option>
            </select>
            <label class="filter-label">Sort:</label>
            <select id="sortBy" onchange="updateSort()">
              <option value="name" ${sortBy === 'name' ? 'selected' : ''}>By Name</option>
              <option value="program" ${sortBy === 'program' ? 'selected' : ''}>By Program</option>
            </select>
          </div>
        </div>
        <div id="grid-container"></div>
        <script>
          let allStudents = ${JSON.stringify(studentsData)};
          let allStaff = ${JSON.stringify(staffData)};
          let currentFilter = '${programFilter}';
          let currentSort = '${sortBy}';
          
          function updateFilter() {
            currentFilter = document.getElementById('programFilter').value;
            renderGrid();
          }
          
          function updateSort() {
            currentSort = document.getElementById('sortBy').value;
            renderGrid();
          }
          
          function getTrainingBadge(status) {
            if (status === 'trainer') return ' <span class="team-member trainer">Trainer</span>';
            if (status === 'overlap-staff' || status === 'overlap-bcba') return ' <span class="team-member overlap">In Training</span>';
            return '';
          }
          
          function renderGrid() {
            let filtered = [...allStudents];
            
            if (currentFilter !== 'All') {
              filtered = filtered.filter(s => s.program === currentFilter);
            }
            
            if (currentSort === 'program') {
              filtered.sort((a, b) => {
                if (a.program === b.program) return a.name.localeCompare(b.name);
                return a.program.localeCompare(b.program);
              });
            } else {
              filtered.sort((a, b) => a.name.localeCompare(b.name));
            }
            
            let html = \`
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Program</th>
                    <th>Ratio AM</th>
                    <th>Ratio PM</th>
                    <th>Direct Care Staff</th>
                    <th>Support Staff</th>
                  </tr>
                </thead>
                <tbody>
            \`;
            
            filtered.forEach(student => {
              const teamMembers = student.team || [];
              const supportRoles = ['BCBA', 'CC', 'Teacher', 'EA'];
              
              // Separate direct care staff from support staff
              const directCareStaff = [];
              const supportStaff = [];
              
              teamMembers.forEach(member => {
                const staffMember = allStaff.find(s => s.email && member.email && s.email.toLowerCase() === member.email.toLowerCase());
                const role = staffMember ? staffMember.role : null;
                
                const trainingStatus = student.teamTrainingStatus && student.teamTrainingStatus[member.id] 
                  ? student.teamTrainingStatus[member.id] 
                  : 'solo';
                
                // Color by role type
                let badgeClass = 'team-member';
                if (role === 'RBT') badgeClass = 'team-member rbt';
                else if (role === 'BS') badgeClass = 'team-member bs';
                else if (role === 'BCBA') badgeClass = 'team-member bcba';
                else if (role === 'EA') badgeClass = 'team-member ea';
                else if (role === 'MHA') badgeClass = 'team-member mha';
                else if (role === 'CC') badgeClass = 'team-member cc';
                else if (role === 'Teacher') badgeClass = 'team-member teacher';
                
                const badge = \`<span class="\${badgeClass}">\${member.name || member.title}\${getTrainingBadge(trainingStatus)}</span>\`;
                
                if (role && supportRoles.includes(role)) {
                  supportStaff.push(badge);
                } else {
                  directCareStaff.push(badge);
                }
              });
              
              const directCareHtml = directCareStaff.join('') || '<span style="color: #9ca3af;">None</span>';
              const supportHtml = supportStaff.join('') || '<span style="color: #9ca3af;">None</span>';
              
              html += \`
                <tr>
                  <td>\${student.name}</td>
                  <td class="read-only">\${student.program}</td>
                  <td class="read-only">\${student.ratioAM}</td>
                  <td class="read-only">\${student.ratioPM}</td>
                  <td>\${directCareHtml}</td>
                  <td>\${supportHtml}</td>
                </tr>
              \`;
            });
            
            html += \`
                </tbody>
              </table>
            \`;
            
            document.getElementById('grid-container').innerHTML = html;
          }
          
          renderGrid();
        </script>
      </body>
      </html>
    `;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Teams Grid</h2>
          <p className="text-sm text-gray-600 mt-1">
            View all clients and their assigned team members
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter by Program */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Programs</option>
              <option value="Primary">Primary</option>
              <option value="Secondary">Secondary</option>
            </select>
          </div>
          
          {/* Sort by */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="program">Sort by Program</option>
          </select>
          
          <button
            onClick={openInNewWindow}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Window
          </button>
        </div>
      </div>

      {/* Preview table in the app */}
      <div className="bg-white rounded-lg shadow overflow-auto max-h-[600px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-blue-600 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Program</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Ratio AM</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Ratio PM</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Direct Care Staff</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Support Staff</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStudents.map(student => {
              const teamMembers = student.team || [];
              const supportRoles = ['BCBA', 'CC', 'Teacher', 'EA'];
              
              // Separate direct care staff from support staff
              const directCareStaff = [];
              const supportStaff = [];
              
              teamMembers.forEach(member => {
                const staffMember = staff.find(s => s.email && member.email && s.email.toLowerCase() === member.email.toLowerCase());
                const role = staffMember ? staffMember.role : null;
                
                const trainingStatus = student.teamTrainingStatus && student.teamTrainingStatus[member.id] 
                  ? student.teamTrainingStatus[member.id] 
                  : 'solo';
                
                // Color by role type
                let badgeColor = 'bg-gray-200 text-gray-700';
                if (role === 'RBT') badgeColor = 'bg-purple-200 text-purple-800';
                else if (role === 'BS') badgeColor = 'bg-blue-200 text-blue-800';
                else if (role === 'BCBA') badgeColor = 'bg-orange-200 text-orange-900';
                else if (role === 'EA') badgeColor = 'bg-green-200 text-green-800';
                else if (role === 'MHA') badgeColor = 'bg-yellow-200 text-yellow-900';
                else if (role === 'CC') badgeColor = 'bg-red-200 text-red-800';
                else if (role === 'Teacher') badgeColor = 'bg-pink-200 text-pink-800';
                
                // Add border for training status
                let borderClass = '';
                if (trainingStatus === 'trainer') borderClass = 'border-2 border-yellow-500';
                else if (trainingStatus === 'overlap-staff' || trainingStatus === 'overlap-bcba') borderClass = 'border-2 border-dashed border-orange-500';
                
                const badge = (
                  <span
                    key={member.id}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${badgeColor} ${borderClass}`}
                  >
                    {member.name || member.title}
                    {trainingStatus === 'trainer' && ' ⭐'}
                    {(trainingStatus === 'overlap-staff' || trainingStatus === 'overlap-bcba') && ' 🎓'}
                  </span>
                );
                
                if (role && supportRoles.includes(role)) {
                  supportStaff.push(badge);
                } else {
                  directCareStaff.push(badge);
                }
              });
              
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {student.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 bg-gray-50">
                    {student.program}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 bg-gray-50">
                    {student.ratioAM}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 bg-gray-50">
                    {student.ratioPM}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {directCareStaff.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {directCareStaff}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {supportStaff.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {supportStaff}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ About Teams Grid:</h3>
        <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
          <li>View all clients and their permanent team member assignments</li>
          <li><strong>Badge colors indicate staff role:</strong> Purple (RBT), Blue (BS), Orange (BCBA), Green (EA), Yellow (MHA), Red (CC), Pink (Teacher)</li>
          <li>⭐ with gold border = trainer (can train others on this client)</li>
          <li>🎓 with dashed border = staff in training (needs overlap/supervision)</li>
          <li>Use the Teams tab to edit team assignments</li>
          <li>Click "Open in New Window" to view on a separate screen for sharing</li>
        </ul>
      </div>
    </div>
  );
};

export default TeamsGridView;
