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
  const [popupWindow, setPopupWindow] = useState(null); // Track popup window reference

  // Helper function to format staff names as "FirstName L."
  const formatStaffNameShort = (fullName) => {
    if (!fullName || fullName === 'ABSENT' || fullName === 'OUT' || fullName === 'Unknown') {
      return fullName;
    }
    
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
      return fullName; // No last name, return as is
    }
    
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0);
    return `${firstName} ${lastInitial}.`;
  };

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
      let amAssignments = schedule.assignments.filter(
        a => a.studentId === student.id && a.session === 'AM'
      );
      let pmAssignments = schedule.assignments.filter(
        a => a.studentId === student.id && a.session === 'PM'
      );
      
      // PAIRED STUDENT FIX: If student is paired and has no assignments, check paired partner's assignments
      if (amAssignments.length === 0 && student.isPaired && student.isPaired()) {
        const ratio = student.ratioAM;
        if (ratio === '1:2') {
          const pairedStudent = student.getPairedStudent(students);
          if (pairedStudent) {
            const pairedRatio = pairedStudent.ratioAM;
            if (pairedRatio === '1:2') {
              const pairedAssignments = schedule.assignments.filter(
                a => a.studentId === pairedStudent.id && a.session === 'AM'
              );
              if (pairedAssignments.length > 0) {
                console.log(`� PAIRED FIX AM: ${student.name} using ${pairedStudent.name}'s assignments`);
                amAssignments = pairedAssignments;
              }
            }
          }
        }
      }
      
      if (pmAssignments.length === 0 && student.isPaired && student.isPaired()) {
        const ratio = student.ratioPM;
        if (ratio === '1:2') {
          const pairedStudent = student.getPairedStudent(students);
          if (pairedStudent) {
            const pairedRatio = pairedStudent.ratioPM;
            if (pairedRatio === '1:2') {
              const pairedAssignments = schedule.assignments.filter(
                a => a.studentId === pairedStudent.id && a.session === 'PM'
              );
              if (pairedAssignments.length > 0) {
                console.log(`🔗 PAIRED FIX PM: ${student.name} using ${pairedStudent.name}'s assignments`);
                pmAssignments = pairedAssignments;
              }
            }
          }
        }
      }

      // Get staff names (formatted as "FirstName L.")
      const amStaffNames = amAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        const fullName = staffMember ? staffMember.name : 'Unknown';
        return formatStaffNameShort(fullName);
      });
      const pmStaffNames = pmAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        const fullName = staffMember ? staffMember.name : 'Unknown';
        return formatStaffNameShort(fullName);
      });

      // Remove duplicates
      const uniqueAmStaff = [...new Set(amStaffNames)];
      const uniquePmStaff = [...new Set(pmStaffNames)];

      // Check if student is absent/unavailable (pass currentDate to check day-of-week schedule)
      const isAbsentAM = !student.isAvailableForSession('AM', currentDate);
      const isAbsentPM = !student.isAvailableForSession('PM', currentDate);

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
          amStaff: amTraineeStaff ? formatStaffNameShort(amTraineeStaff.name) : '',
          pmStaff: pmTraineeStaff ? formatStaffNameShort(pmTraineeStaff.name) : '',
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

    console.log('📊 Generated', rows.length, 'schedule rows from', schedule.assignments.length, 'assignments');
    setScheduleData(rows);
  }, [schedule, students, staff, editableData, programFilter, sortBy]);

  // Auto-update popup window when schedule data changes
  useEffect(() => {
    console.log('🔄 Auto-update effect triggered. Popup:', !!popupWindow, 'Closed:', popupWindow?.closed, 'Data length:', scheduleData.length);
    
    if (popupWindow && !popupWindow.closed && scheduleData.length > 0) {
      try {
        // Update the popup window's data
        if (popupWindow.updateScheduleData) {
          console.log('📤 Updating popup with', scheduleData.length, 'rows');
          popupWindow.updateScheduleData(scheduleData, programFilter, sortBy);
        } else {
          console.warn('⚠️ Popup window exists but updateScheduleData function not found');
        }
      } catch (error) {
        console.error('❌ Error updating popup:', error);
      }
    } else if (popupWindow && !popupWindow.closed && scheduleData.length === 0) {
      console.log('⏸️ Skipping popup update - scheduleData is empty');
    }
  }, [scheduleData, popupWindow, programFilter, sortBy]);

  // Check if popup window is closed and clean up
  useEffect(() => {
    if (!popupWindow) return;

    const checkInterval = setInterval(() => {
      if (popupWindow.closed) {
        setPopupWindow(null);
        delete window._liveSchedulePopupRef;
        clearInterval(checkInterval);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [popupWindow]);

  // Expose update function to window object so popup can call it
  useEffect(() => {
    window.updateLiveSchedulePopup = () => {
      console.log('🔄 Popup requested update via button, data rows:', scheduleData.length);
      
      // Use the global reference as fallback if React state hasn't updated yet
      const targetPopup = popupWindow || window._liveSchedulePopupRef;
      
      if (!targetPopup || targetPopup.closed) {
        console.error('❌ Popup window is not available');
        return;
      }
      
      if (!targetPopup.updateScheduleData) {
        console.error('❌ Popup window does not have updateScheduleData function');
        return;
      }
      
      try {
        targetPopup.updateScheduleData(scheduleData, programFilter, sortBy);
        console.log('✅ Update sent to popup successfully');
      } catch (error) {
        console.error('❌ Error sending update to popup:', error);
      }
    };

    return () => {
      delete window.updateLiveSchedulePopup;
      if (window._liveSchedulePopupRef && window._liveSchedulePopupRef.closed) {
        delete window._liveSchedulePopupRef;
      }
    };
  }, [popupWindow, scheduleData, programFilter, sortBy]);

  // Handle field changes
  const handleFieldChange = (rowId, field, value) => {
    setEditableData(prev => {
      const updated = {
        ...prev,
        [rowId]: {
          ...(prev[rowId] || {}),
          [field]: value
        }
      };
      
      // Immediately update popup window with the new editable data
      if (popupWindow && !popupWindow.closed && popupWindow.updateEditableField) {
        popupWindow.updateEditableField(rowId, field, value);
      }
      
      return updated;
    });

    // Notify parent component of changes
    if (onUpdateScheduleData) {
      onUpdateScheduleData({ rowId, field, value });
    }
  };

  // Open in new window
  const openInNewWindow = () => {
    console.log('🔷 Opening Live Schedule popup, current scheduleData has', scheduleData.length, 'rows');
    
    // Check if popup already exists and is open
    if (popupWindow && !popupWindow.closed) {
      console.log('✅ Popup already open, updating with current data');
      // Update existing popup with current data before focusing
      if (popupWindow.updateScheduleData) {
        popupWindow.updateScheduleData(scheduleData, programFilter, sortBy);
      }
      popupWindow.focus();
      return;
    }
    
    // Close any existing popup with same name
    const existingWindow = window.open('', 'LiveSchedule');
    if (existingWindow && !existingWindow.closed) {
      console.log('🗑️ Closing stale popup window');
      existingWindow.close();
    }
    
    console.log('🆕 Creating new popup window with', scheduleData.length, 'rows');
    const newWindow = window.open('', 'LiveSchedule', 'width=1400,height=800,scrollbars=yes');
    if (newWindow) {
      // Store reference to popup window immediately for React state
      setPopupWindow(newWindow);
      
      // ALSO store in a module-level variable for immediate access in updateLiveSchedulePopup
      window._liveSchedulePopupRef = newWindow;
      
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
            .update-indicator {
              position: fixed;
              top: 10px;
              right: 10px;
              background: #10b981;
              color: white;
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              opacity: 0;
              transition: opacity 0.3s;
              z-index: 1000;
            }
            .update-indicator.show {
              opacity: 1;
            }
            .update-button {
              background: #2563eb;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
              transition: background 0.2s;
            }
            .update-button:hover {
              background: #1d4ed8;
            }
            .update-button:active {
              transform: scale(0.98);
            }
            .last-update {
              font-size: 12px;
              color: #6b7280;
              font-style: italic;
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
              padding: 8px 6px;
              text-align: left;
              font-weight: 600;
              font-size: 12px;
              position: sticky;
              top: 0;
              z-index: 10;
            }
            td {
              padding: 4px 6px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 12px;
            }
            tr:hover {
              background: #f9fafb;
            }
            input {
              width: 100%;
              max-width: 65px;
              padding: 2px 4px;
              border: 1px solid #d1d5db;
              border-radius: 3px;
              font-size: 11px;
            }
            input:focus {
              outline: none;
              border-color: #2563eb;
              box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
            }
            .read-only {
              background: #f3f4f6;
              color: #374151;
            }
            .trainee-row {
              background: #fef3c7;
            }
            .absent-row {
              background: #9ca3af;
            }
            .absent-row td {
              background: #9ca3af;
              color: #374151;
            }
            .absent-row input {
              background: #9ca3af;
              border-color: #6b7280;
            }
            .absent-text {
              color: #dc2626 !important;
              font-weight: 600;
            }
            .out-text {
              color: #f59e0b !important;
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
          <div class="update-indicator" id="updateIndicator">
            🔄 Schedule Updated
          </div>
          <div class="header">
            <div>
              <h1>Daily Schedule - ${currentDate.toLocaleDateString()}</h1>
              <div class="last-update" id="lastUpdate">Last updated: ${new Date().toLocaleTimeString()}</div>
            </div>
            <div class="filters">
              <button class="update-button" onclick="requestUpdateFromParent()">
                🔄 Update Schedule
              </button>
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
            // Initialize the schedule state (only if not already defined)
            if (!window.scheduleState) {
              window.scheduleState = {};
            }
            window.scheduleState.allRows = ${JSON.stringify(scheduleData)};
            window.scheduleState.currentFilter = '${programFilter}';
            window.scheduleState.currentSort = '${sortBy}';
            
            // Function to update schedule data from parent window
            if (!window.updateScheduleData) {
              window.updateScheduleData = function(newRows, newFilter, newSort) {
              console.log('📥 Popup received update:', newRows.length, 'rows');
              window.scheduleState.allRows = newRows;
              if (newFilter !== undefined) window.scheduleState.currentFilter = newFilter;
              if (newSort !== undefined) window.scheduleState.currentSort = newSort;
              
              // Update filter/sort dropdowns
              if (document.getElementById('programFilter')) {
                document.getElementById('programFilter').value = window.scheduleState.currentFilter;
              }
              if (document.getElementById('sortBy')) {
                document.getElementById('sortBy').value = window.scheduleState.currentSort;
              }
              
              // Update timestamp
              const lastUpdate = document.getElementById('lastUpdate');
              if (lastUpdate) {
                lastUpdate.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
              }
              
              // Show update indicator
              showUpdateIndicator();
              
              renderTable();
              };
            }
            
            // Function to update a single editable field from parent window
            if (!window.updateEditableField) {
              window.updateEditableField = function(rowId, field, value) {
              // Find the input element and update its value
              const input = document.querySelector(\`input[data-rowid="\${rowId}"][data-field="\${field}"]\`);
              if (input) {
                input.value = value;
                
                // Also update the row data
                const row = window.scheduleState.allRows.find(r => r.id === rowId);
                if (row) {
                  row[field] = value;
                }
              }
              };
            }
            
            // Show update indicator temporarily
            function showUpdateIndicator() {
              const indicator = document.getElementById('updateIndicator');
              if (indicator) {
                indicator.classList.add('show');
                setTimeout(() => {
                  indicator.classList.remove('show');
                }, 2000);
              }
            }
            
            // Request update from parent window
            function requestUpdateFromParent() {
              console.log('🔵 Update button clicked');
              
              // Disable button temporarily
              const button = event.target;
              const originalText = button.innerHTML;
              button.disabled = true;
              button.innerHTML = '⏳ Updating...';
              
              if (window.opener && !window.opener.closed) {
                try {
                  // Access the parent window's LiveScheduleView component
                  // The parent should expose a function to get current schedule data
                  if (window.opener.updateLiveSchedulePopup) {
                    console.log('🔄 Requesting update from parent window...');
                    window.opener.updateLiveSchedulePopup();
                    
                    // Re-enable button after a short delay
                    setTimeout(() => {
                      button.disabled = false;
                      button.innerHTML = originalText;
                      console.log('✅ Update complete');
                    }, 500);
                  } else {
                    console.warn('⚠️ Parent window does not have updateLiveSchedulePopup function');
                    button.disabled = false;
                    button.innerHTML = originalText;
                    
                    // Show a more helpful message
                    const shouldReopen = confirm(
                      'This popup window is outdated and needs to be refreshed.\\n\\n' +
                      'Click OK to close this window, then click "Open in New Window" again in the main app to get the latest version with the Update button.'
                    );
                    if (shouldReopen) {
                      window.close();
                    }
                  }
                } catch (error) {
                  console.error('❌ Error requesting update from parent:', error);
                  button.disabled = false;
                  button.innerHTML = originalText;
                  alert('Unable to connect to main window.\\n\\nPlease close this popup and click "Open in New Window" again.');
                }
              } else {
                button.disabled = false;
                button.innerHTML = originalText;
                alert('Main window is closed.\\n\\nPlease reopen this popup from the main app.');
              }
            }
            
            function updateFilter() {
              window.scheduleState.currentFilter = document.getElementById('programFilter').value;
              renderTable();
            }
            
            function updateSort() {
              window.scheduleState.currentSort = document.getElementById('sortBy').value;
              renderTable();
            }
            
            function renderTable() {
              let filteredRows = [...window.scheduleState.allRows];
              
              // Debug: Show all Milo rows
              const miloRows = window.scheduleState.allRows.filter(r => r.studentName === 'Milo' || r.studentName.includes('Milo'));
              if (miloRows.length > 0) {
                console.log('🔍 All Milo rows in data:', miloRows.map(r => 'AM: "' + r.amStaff + '" PM: "' + r.pmStaff + '"'));
              }
              
              // Apply filter
              if (window.scheduleState.currentFilter !== 'All') {
                filteredRows = filteredRows.filter(row => row.program === window.scheduleState.currentFilter);
              }
              
              // Apply sort
              if (window.scheduleState.currentSort === 'program') {
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
                // Debug logging for specific students
                if (row.studentName === 'Milo' || row.studentName.includes('Milo')) {
                  console.log('🔍 Rendering Milo:', 'AM:', row.amStaff, 'PM:', row.pmStaff);
                }
                
                // Check if student is fully absent (both AM and PM)
                const isAbsent = (row.amStaff === 'ABSENT' || row.amStaff === 'OUT') && 
                                 (row.pmStaff === 'ABSENT' || row.pmStaff === 'OUT');
                
                const rowClass = isAbsent ? 'absent-row' : (row.isTrainee ? 'trainee-row' : '');
                const amStaffClass = row.amStaff === 'ABSENT' ? 'absent-text' : (row.amStaff === 'OUT' ? 'out-text' : '');
                const pmStaffClass = row.pmStaff === 'ABSENT' ? 'absent-text' : (row.pmStaff === 'OUT' ? 'out-text' : '');
                
                // Debug logging for ABSENT text
                if (row.amStaff === 'ABSENT' || row.pmStaff === 'ABSENT') {
                  console.log('Popup rendering ABSENT:', row.studentName, 'AM:', row.amStaff, 'class:', amStaffClass, 'PM:', row.pmStaff, 'class:', pmStaffClass);
                }
                
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
              const row = window.scheduleState.allRows.find(r => r.id === rowId);
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
      
      // Close the document to finalize it
      newWindow.document.close();
      
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
      const isAbsentAMOnly = (row.amStaff === 'ABSENT' || row.amStaff === 'OUT') && row.pmStaff && row.pmStaff !== 'ABSENT' && row.pmStaff !== 'OUT';
      const isAbsentPMOnly = (row.pmStaff === 'ABSENT' || row.pmStaff === 'OUT') && row.amStaff && row.amStaff !== 'ABSENT' && row.amStaff !== 'OUT';
      const amCellBg = isAbsentAMOnly ? ' style="background-color: #9ca3af;"' : '';
      const pmCellBg = isAbsentPMOnly ? ' style="background-color: #9ca3af;"' : '';

      html += `
        <tr class="${rowClass}">
          <td>${row.studentName}</td>
          <td class="read-only">${row.program}</td>
          <td class="read-only ${amStaffClass}"${amCellBg}>${row.amStaff}</td>
          <td${amCellBg}>
            <input 
              type="text" 
              value="${row.amStart}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="amStart"
              placeholder="8:45 AM"
              ${isAbsentAMOnly ? 'style="background-color: #9ca3af; border-color: #6b7280;"' : ''}
            />
          </td>
          <td${amCellBg}>
            <input 
              type="text" 
              value="${row.amEnd}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="amEnd"
              placeholder="12:05 PM"
              ${isAbsentAMOnly ? 'style="background-color: #9ca3af; border-color: #6b7280;"' : ''}
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
          <td class="read-only ${pmStaffClass}"${pmCellBg}>${row.pmStaff}</td>
          <td${pmCellBg}>
            <input 
              type="text" 
              value="${row.pmStart}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="pmStart"
              placeholder="12:35 PM"
              ${isAbsentPMOnly ? 'style="background-color: #9ca3af; border-color: #6b7280;"' : ''}
            />
          </td>
          <td${pmCellBg}>
            <input 
              type="text" 
              value="${row.pmEnd}" 
              data-editable="true"
              data-rowid="${row.id}"
              data-field="pmEnd"
              placeholder="3:00 PM"
              ${isAbsentPMOnly ? 'style="background-color: #9ca3af; border-color: #6b7280;"' : ''}
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
      {/* Popup Status Indicator */}
      {popupWindow && !popupWindow.closed && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                ✅ Live Schedule window is open and will auto-update when you make changes on the Schedule tab
              </p>
            </div>
          </div>
        </div>
      )}
      
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">Client</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">Program</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">AM Staff</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">AM Start</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">AM End</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">Lunch 1 Cov</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">Lunch 2 Cov</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">PM Staff</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">PM Start</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">PM End</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {scheduleData.map((row, index) => {
              // Check if student is absent (both AM and PM absent = fully absent)
              const isAbsent = (row.amStaff === 'ABSENT' || row.amStaff === 'OUT') && 
                               (row.pmStaff === 'ABSENT' || row.pmStaff === 'OUT');
              const isAbsentAMOnly = (row.amStaff === 'ABSENT' || row.amStaff === 'OUT') && 
                                      row.pmStaff && row.pmStaff !== 'ABSENT' && row.pmStaff !== 'OUT';
              const isAbsentPMOnly = (row.pmStaff === 'ABSENT' || row.pmStaff === 'OUT') && 
                                      row.amStaff && row.amStaff !== 'ABSENT' && row.amStaff !== 'OUT';
              
              return (
              <tr 
                key={`${row.id}-${index}`}
                className={`${
                  isAbsent 
                    ? 'bg-gray-400' 
                    : row.isTrainee 
                      ? 'bg-yellow-50 hover:bg-yellow-100' 
                      : 'hover:bg-gray-50'
                }`}
              >
                <td className={`px-3 py-1 whitespace-nowrap text-xs ${isAbsent ? 'text-gray-700' : 'text-gray-900'}`}>
                  {row.studentName}
                </td>
                <td className={`px-3 py-1 whitespace-nowrap text-xs ${isAbsent ? 'text-gray-700 bg-gray-400' : 'text-gray-900 bg-gray-50'}`}>
                  {row.program}
                </td>
                <td className={`px-3 py-1 whitespace-nowrap text-xs ${
                  row.amStaff === 'ABSENT' ? 'text-red-600 font-semibold' : 
                  row.amStaff === 'OUT' ? 'text-orange-600 font-semibold' : 
                  'text-gray-900'
                } ${isAbsent || isAbsentAMOnly ? 'bg-gray-400' : 'bg-gray-50'}`}>
                  {row.amStaff}
                </td>
                <td className={`px-2 py-1 whitespace-nowrap ${isAbsent || isAbsentAMOnly ? 'bg-gray-400' : ''}`}>
                  <input
                    type="text"
                    value={row.amStart}
                    onChange={(e) => handleFieldChange(row.id, 'amStart', e.target.value)}
                    className={`w-full max-w-[65px] px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isAbsent || isAbsentAMOnly ? 'bg-gray-400 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                    placeholder="8:45 AM"
                  />
                </td>
                <td className={`px-2 py-1 whitespace-nowrap ${isAbsent || isAbsentAMOnly ? 'bg-gray-400' : ''}`}>
                  <input
                    type="text"
                    value={row.amEnd}
                    onChange={(e) => handleFieldChange(row.id, 'amEnd', e.target.value)}
                    className={`w-full max-w-[65px] px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isAbsent || isAbsentAMOnly ? 'bg-gray-400 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                    placeholder="12:05 PM"
                  />
                </td>
                <td className={`px-2 py-1 whitespace-nowrap ${isAbsent ? 'bg-gray-400' : ''}`}>
                  <input
                    type="text"
                    value={row.lunch1Cov}
                    onChange={(e) => handleFieldChange(row.id, 'lunch1Cov', e.target.value)}
                    className={`w-full max-w-[65px] px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isAbsent ? 'bg-gray-400 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                </td>
                <td className={`px-2 py-1 whitespace-nowrap ${isAbsent ? 'bg-gray-400' : ''}`}>
                  <input
                    type="text"
                    value={row.lunch2Cov}
                    onChange={(e) => handleFieldChange(row.id, 'lunch2Cov', e.target.value)}
                    className={`w-full max-w-[65px] px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isAbsent ? 'bg-gray-400 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                  />
                </td>
                <td className={`px-3 py-1 whitespace-nowrap text-xs ${
                  row.pmStaff === 'ABSENT' ? 'text-red-600 font-semibold' : 
                  row.pmStaff === 'OUT' ? 'text-orange-600 font-semibold' : 
                  'text-gray-900'
                } ${isAbsent || isAbsentPMOnly ? 'bg-gray-400' : 'bg-gray-50'}`}>
                  {row.pmStaff}
                </td>
                <td className={`px-2 py-1 whitespace-nowrap ${isAbsent || isAbsentPMOnly ? 'bg-gray-400' : ''}`}>
                  <input
                    type="text"
                    value={row.pmStart}
                    onChange={(e) => handleFieldChange(row.id, 'pmStart', e.target.value)}
                    className={`w-full max-w-[65px] px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isAbsent || isAbsentPMOnly ? 'bg-gray-400 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                    placeholder="12:35 PM"
                  />
                </td>
                <td className={`px-2 py-1 whitespace-nowrap ${isAbsent || isAbsentPMOnly ? 'bg-gray-400' : ''}`}>
                  <input
                    type="text"
                    value={row.pmEnd}
                    onChange={(e) => handleFieldChange(row.id, 'pmEnd', e.target.value)}
                    className={`w-full max-w-[65px] px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isAbsent || isAbsentPMOnly ? 'bg-gray-400 border-gray-500' : 'bg-white border-gray-300'
                    }`}
                    placeholder="3:00 PM"
                  />
                </td>
              </tr>
              );
            })}
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
          <li><strong>✨ NEW: The popup window auto-updates in real-time</strong> when you:
            <ul className="ml-6 mt-1 space-y-1">
              <li>• Make assignments on the Schedule tab</li>
              <li>• Run Auto Assign or Smart Swap</li>
              <li>• Add/remove staff or students</li>
              <li>• Mark attendance changes</li>
            </ul>
          </li>
          <li>Use this to display the live schedule on a TV/monitor while building the schedule</li>
        </ul>
      </div>
    </div>
  );
};

export default LiveScheduleView;
