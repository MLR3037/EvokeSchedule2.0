import React, { useState, useEffect } from 'react';
import { ExternalLink, Filter } from 'lucide-react';

/**
 * Live Schedule View Component
 * Displays a pretty, editable version of the schedule with lunch coverage
 * Can be opened in a new window for display/sharing
 */
const LiveScheduleView = ({ schedule, students, staff, currentDate, onUpdateScheduleData }) => {
  const [scheduleData, setScheduleData] = useState([]);
  const [editableData, setEditableData] = useState({});
  const [programFilter, setProgramFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'program'

  // Generate schedule rows from assignments
  useEffect(() => {
    if (!schedule || !students || !staff) return;

    const rows = [];
    let activeStudents = students.filter(s => s.isActive);
    
    // Apply program filter
    if (programFilter !== 'All') {
      activeStudents = activeStudents.filter(s => s.program === programFilter);
    }
    
    // Apply sorting
    if (sortBy === 'program') {
      activeStudents.sort((a, b) => {
        if (a.program === b.program) {
          return a.name.localeCompare(b.name);
        }
        return a.program.localeCompare(b.program);
      });
    } else {
      activeStudents.sort((a, b) => a.name.localeCompare(b.name));
    }

    activeStudents.forEach(student => {
      // Get assignments for this student
      const amAssignments = schedule.assignments.filter(
        a => a.studentId === student.id && a.session === 'AM'
      );
      const pmAssignments = schedule.assignments.filter(
        a => a.studentId === student.id && a.session === 'PM'
      );

      // Get staff names
      const amStaffNames = amAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        return staffMember ? staffMember.name : 'Unknown';
      });
      const pmStaffNames = pmAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        return staffMember ? staffMember.name : 'Unknown';
      });

      // Remove duplicates
      const uniqueAmStaff = [...new Set(amStaffNames)];
      const uniquePmStaff = [...new Set(pmStaffNames)];

      // Check if student is absent/unavailable
      const isAbsentAM = !student.isAvailableForSession('AM');
      const isAbsentPM = !student.isAvailableForSession('PM');

      // Determine default times based on program
      const isPrimary = student.program === 'Primary';
      const defaultAmStart = '8:45 AM';
      const defaultAmEnd = isPrimary ? '12:05 PM' : '11:30 AM';
      const defaultPmStart = isPrimary ? '12:35 PM' : '12:00 PM';
      const defaultPmEnd = '3:00 PM';

      // Get stored editable data or use defaults
      const rowKey = `${student.id}`;
      const existingData = editableData[rowKey] || {};

      const maxRows = Math.max(
        isAbsentAM ? 1 : uniqueAmStaff.length,
        isAbsentPM ? 1 : uniquePmStaff.length,
        1
      );

      for (let i = 0; i < maxRows; i++) {
        const rowAmStaff = isAbsentAM && i === 0 
          ? (student.outOfSessionAM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT')
          : (uniqueAmStaff[i] || '');
        const rowPmStaff = isAbsentPM && i === 0 
          ? (student.outOfSessionPM || student.outOfSessionFullDay ? 'OUT' : 'ABSENT')
          : (uniquePmStaff[i] || '');

        if (i === 0 || rowAmStaff || rowPmStaff) {
          rows.push({
            id: `${student.id}-${i}`,
            studentId: student.id,
            studentName: student.name,
            program: student.program,
            amStaff: rowAmStaff,
            pmStaff: rowPmStaff,
            amStart: existingData.amStart || (rowAmStaff ? defaultAmStart : ''),
            amEnd: existingData.amEnd || (rowAmStaff ? defaultAmEnd : ''),
            lunch1Cov: existingData.lunch1Cov || '',
            lunch2Cov: existingData.lunch2Cov || '',
            pmStart: existingData.pmStart || (rowPmStaff ? defaultPmStart : ''),
            pmEnd: existingData.pmEnd || (rowPmStaff ? defaultPmEnd : ''),
            rowIndex: i
          });
        }
      }

      // Add trainee rows - CONSOLIDATED: AM and PM trainees on same line
      const amTrainee = schedule.traineeAssignments?.find(
        t => t.studentId === student.id && t.session === 'AM'
      );
      const pmTrainee = schedule.traineeAssignments?.find(
        t => t.studentId === student.id && t.session === 'PM'
      );

      // If either AM or PM trainee exists, create ONE row with both
      if ((amTrainee && !isAbsentAM) || (pmTrainee && !isAbsentPM)) {
        const traineeKey = `${student.id}-trainee`;
        const traineeData = editableData[traineeKey] || {};
        
        const amTraineeStaff = amTrainee && !isAbsentAM ? staff.find(s => s.id === amTrainee.staffId) : null;
        const pmTraineeStaff = pmTrainee && !isAbsentPM ? staff.find(s => s.id === pmTrainee.staffId) : null;
        
        rows.push({
          id: traineeKey,
          studentId: student.id,
          studentName: `${student.name} (Trainee)`,
          program: student.program,
          amStaff: amTraineeStaff ? amTraineeStaff.name : '',
          pmStaff: pmTraineeStaff ? pmTraineeStaff.name : '',
          amStart: traineeData.amStart || (amTraineeStaff ? defaultAmStart : ''),
          amEnd: traineeData.amEnd || (amTraineeStaff ? defaultAmEnd : ''),
          lunch1Cov: traineeData.lunch1Cov || '',
          lunch2Cov: traineeData.lunch2Cov || '',
          pmStart: traineeData.pmStart || (pmTraineeStaff ? defaultPmStart : ''),
          pmEnd: traineeData.pmEnd || (pmTraineeStaff ? defaultPmEnd : ''),
          isTrainee: true
        });
      }
    });

    setScheduleData(rows);
  }, [schedule, students, staff, editableData, programFilter, sortBy]);

  // Handle field changes
  const handleFieldChange = (rowId, field, value) => {
    setEditableData(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: value
      }
    }));

    // Notify parent component of changes
    if (onUpdateScheduleData) {
      onUpdateScheduleData({ rowId, field, value });
    }
  };

  // Open in new window
  const openInNewWindow = () => {
    const newWindow = window.open('', 'LiveSchedule', 'width=1400,height=800,scrollbars=yes');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Live Schedule - ${currentDate.toLocaleDateString()}</title>
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
            select:focus {
              outline: none;
              border-color: #2563eb;
              box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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
            input {
              width: 100%;
              padding: 6px 8px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              font-size: 14px;
            }
            input:focus {
              outline: none;
              border-color: #2563eb;
              box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            }
            .read-only {
              background: #f3f4f6;
              color: #374151;
            }
            .trainee-row {
              background: #fef3c7;
            }
            .absent-text {
              color: #dc2626;
              font-weight: 600;
            }
            .out-text {
              color: #f59e0b;
              font-weight: 600;
            }
            @media print {
              .filters {
                display: none;
              }
              input {
                border: none;
                padding: 0;
              }
              tr:hover {
                background: white;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Daily Schedule - ${currentDate.toLocaleDateString()}</h1>
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
          <div id="schedule-container"></div>
          <script>
            // Store all rows data
            let allRows = ${JSON.stringify(scheduleData)};
            let currentFilter = '${programFilter}';
            let currentSort = '${sortBy}';
            
            function updateFilter() {
              currentFilter = document.getElementById('programFilter').value;
              renderTable();
            }
            
            function updateSort() {
              currentSort = document.getElementById('sortBy').value;
              renderTable();
            }
            
            function renderTable() {
              let filteredRows = [...allRows];
              
              // Apply filter
              if (currentFilter !== 'All') {
                filteredRows = filteredRows.filter(row => row.program === currentFilter);
              }
              
              // Apply sort
              if (currentSort === 'program') {
                filteredRows.sort((a, b) => {
                  if (a.program === b.program) {
                    return a.studentName.localeCompare(b.studentName);
                  }
                  return a.program.localeCompare(b.program);
                });
              } else {
                filteredRows.sort((a, b) => a.studentName.localeCompare(b.studentName));
              }
              
              // Generate HTML
              let html = \`
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Program</th>
                      <th>AM Staff</th>
                      <th>AM Start</th>
                      <th>AM End</th>
                      <th>Lunch 1 Cov</th>
                      <th>Lunch 2 Cov</th>
                      <th>PM Staff</th>
                      <th>PM Start</th>
                      <th>PM End</th>
                    </tr>
                  </thead>
                  <tbody>
              \`;
              
              filteredRows.forEach(row => {
                const rowClass = row.isTrainee ? 'trainee-row' : '';
                const amStaffClass = row.amStaff === 'ABSENT' ? 'absent-text' : (row.amStaff === 'OUT' ? 'out-text' : '');
                const pmStaffClass = row.pmStaff === 'ABSENT' ? 'absent-text' : (row.pmStaff === 'OUT' ? 'out-text' : '');
                
                html += \`
                  <tr class="\${rowClass}">
                    <td>\${row.studentName}</td>
                    <td class="read-only">\${row.program}</td>
                    <td class="read-only \${amStaffClass}">\${row.amStaff}</td>
                    <td>
                      <input 
                        type="text" 
                        value="\${row.amStart}" 
                        data-editable="true"
                        data-rowid="\${row.id}"
                        data-field="amStart"
                        placeholder="8:45 AM"
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value="\${row.amEnd}" 
                        data-editable="true"
                        data-rowid="\${row.id}"
                        data-field="amEnd"
                        placeholder="12:05 PM"
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value="\${row.lunch1Cov}" 
                        data-editable="true"
                        data-rowid="\${row.id}"
                        data-field="lunch1Cov"
                        placeholder=""
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value="\${row.lunch2Cov}" 
                        data-editable="true"
                        data-rowid="\${row.id}"
                        data-field="lunch2Cov"
                        placeholder=""
                      />
                    </td>
                    <td class="read-only \${pmStaffClass}">\${row.pmStaff}</td>
                    <td>
                      <input 
                        type="text" 
                        value="\${row.pmStart}" 
                        data-editable="true"
                        data-rowid="\${row.id}"
                        data-field="pmStart"
                        placeholder="12:35 PM"
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value="\${row.pmEnd}" 
                        data-editable="true"
                        data-rowid="\${row.id}"
                        data-field="pmEnd"
                        placeholder="3:00 PM"
                      />
                    </td>
                  </tr>
                \`;
              });
              
              html += \`
                  </tbody>
                </table>
              \`;
              
              document.getElementById('schedule-container').innerHTML = html;
              
              // Re-attach event listeners
              const inputs = document.querySelectorAll('input[data-editable]');
              inputs.forEach(input => {
                input.addEventListener('change', handleInputChange);
              });
            }
            
            function handleInputChange(e) {
              const rowId = e.target.dataset.rowid;
              const field = e.target.dataset.field;
              const value = e.target.value;
              
              // Update the row data
              const row = allRows.find(r => r.id === rowId);
              if (row) {
                row[field] = value;
              }
              
              // Notify parent window
              if (window.opener && window.opener.handlePopupFieldChange) {
                window.opener.handlePopupFieldChange(rowId, field, value);
              }
            }
            
            // Initial render
            renderTable();
          </script>
        </body>
        </html>
      `);

      // No need to render table content here - the script does it
      
      // Make handleFieldChange available to popup
      newWindow.opener.handlePopupFieldChange = handleFieldChange;
    }
  };

  // Generate HTML table
  const generateTableHTML = (rows) => {
    let html = `
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Program</th>
            <th>AM Staff</th>
            <th>AM Start</th>
            <th>AM End</th>
            <th>Lunch 1 Cov</th>
            <th>Lunch 2 Cov</th>
            <th>PM Staff</th>
            <th>PM Start</th>
            <th>PM End</th>
          </tr>
        </thead>
        <tbody>
    `;

    rows.forEach(row => {
      const rowClass = row.isTrainee ? 'trainee-row' : '';
      const amStaffClass = row.amStaff === 'ABSENT' ? 'absent-text' : (row.amStaff === 'OUT' ? 'out-text' : '');
      const pmStaffClass = row.pmStaff === 'ABSENT' ? 'absent-text' : (row.pmStaff === 'OUT' ? 'out-text' : '');

      html += `
        <tr class="${rowClass}">
          <td>${row.studentName}</td>
          <td class="read-only">${row.program}</td>
          <td class="read-only ${amStaffClass}">${row.amStaff}</td>
          <td>
            <input 
              type="text" 
              value="${row.amStart}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="amStart"
              placeholder="8:45 AM"
            />
          </td>
          <td>
            <input 
              type="text" 
              value="${row.amEnd}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="amEnd"
              placeholder="12:05 PM"
            />
          </td>
          <td>
            <input 
              type="text" 
              value="${row.lunch1Cov}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="lunch1Cov"
              placeholder=""
            />
          </td>
          <td>
            <input 
              type="text" 
              value="${row.lunch2Cov}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="lunch2Cov"
              placeholder=""
            />
          </td>
          <td class="read-only ${pmStaffClass}">${row.pmStaff}</td>
          <td>
            <input 
              type="text" 
              value="${row.pmStart}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="pmStart"
              placeholder="12:35 PM"
            />
          </td>
          <td>
            <input 
              type="text" 
              value="${row.pmEnd}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="pmEnd"
              placeholder="3:00 PM"
            />
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Live Schedule View</h2>
          <p className="text-sm text-gray-600 mt-1">
            Interactive schedule with editable times and lunch coverage
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">AM Staff</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">AM Start</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">AM End</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Lunch 1 Cov</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Lunch 2 Cov</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">PM Staff</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">PM Start</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">PM End</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {scheduleData.map(row => (
              <tr 
                key={row.id}
                className={`hover:bg-gray-50 ${row.isTrainee ? 'bg-yellow-50' : ''}`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {row.studentName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 bg-gray-50">
                  {row.program}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm ${
                  row.amStaff === 'ABSENT' ? 'text-red-600 font-semibold' : 
                  row.amStaff === 'OUT' ? 'text-orange-600 font-semibold' : 
                  'text-gray-900'
                } bg-gray-50`}>
                  {row.amStaff}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.amStart}
                    onChange={(e) => handleFieldChange(row.id, 'amStart', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="8:45 AM"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.amEnd}
                    onChange={(e) => handleFieldChange(row.id, 'amEnd', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12:05 PM"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.lunch1Cov}
                    onChange={(e) => handleFieldChange(row.id, 'lunch1Cov', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.lunch2Cov}
                    onChange={(e) => handleFieldChange(row.id, 'lunch2Cov', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm ${
                  row.pmStaff === 'ABSENT' ? 'text-red-600 font-semibold' : 
                  row.pmStaff === 'OUT' ? 'text-orange-600 font-semibold' : 
                  'text-gray-900'
                } bg-gray-50`}>
                  {row.pmStaff}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.pmStart}
                    onChange={(e) => handleFieldChange(row.id, 'pmStart', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12:35 PM"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    value={row.pmEnd}
                    onChange={(e) => handleFieldChange(row.id, 'pmEnd', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="3:00 PM"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How to Use:</h3>
        <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
          <li>Staff assignments are <strong>read-only</strong> and sync automatically with your schedule</li>
          <li>Times and lunch coverage fields are <strong>editable</strong> - changes save automatically</li>
          <li>Click "Open in New Window" to view on a separate screen for sharing/display</li>
          <li>Trainee rows are highlighted in yellow</li>
          <li>The popup window updates when you make changes in the app</li>
        </ul>
      </div>
    </div>
  );
};

export default LiveScheduleView;
