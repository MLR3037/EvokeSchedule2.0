import * as XLSX from 'xlsx';

/**
 * Excel Export Service for Schedule
 * Exports schedule data and absences to Excel format
 */
export class ExcelExportService {
  /**
   * Format staff name as First Name + Last Initial
   * @param {string} fullName - Full name of staff member
   * @returns {string} Formatted name (e.g., "John D.")
   */
  static formatStaffName(fullName) {
    // Return full name as-is
    return fullName || 'Unknown';
  }

  /**
   * Export schedule to Excel with assignments and absences
   * @param {Object} schedule - Schedule object with assignments
   * @param {Array} students - Array of Student objects
   * @param {Array} staff - Array of Staff objects
   * @param {Date} date - Schedule date
   */
  static exportSchedule(schedule, students, staff, date) {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Generate schedule data
      const scheduleData = this.generateScheduleData(schedule, students, staff, date);
      
      // Generate absences data
      const absencesData = this.generateAbsencesData(students, staff);
      
      // Generate client attendance data
      const clientAttendanceData = this.generateClientAttendanceData(students);

      // Create worksheets
      const scheduleSheet = XLSX.utils.aoa_to_sheet(scheduleData);
      const absencesSheet = XLSX.utils.aoa_to_sheet(absencesData);
      const clientAttendanceSheet = XLSX.utils.aoa_to_sheet(clientAttendanceData);

      // Set column widths for better readability
      scheduleSheet['!cols'] = [
        { wch: 25 }, // Client
        { wch: 15 }, // Program
        { wch: 30 }, // AM Staff
        { wch: 30 }  // PM Staff
      ];

      absencesSheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 15 }, // Role
        { wch: 20 }  // Status
      ];

      clientAttendanceSheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 15 }, // Program
        { wch: 20 }  // Status
      ];

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');
      XLSX.utils.book_append_sheet(workbook, absencesSheet, 'Staff Attendance');
      XLSX.utils.book_append_sheet(workbook, clientAttendanceSheet, 'Client Attendance');

      // Format the date for filename
      const dateStr = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).replace(/\//g, '-');

      // Generate and download the file
      const fileName = `Schedule_${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      console.log(`✅ Exported schedule to ${fileName}`);
      return true;
    } catch (error) {
      console.error('Error exporting schedule:', error);
      throw new Error(`Failed to export schedule: ${error.message}`);
    }
  }

  /**
   * Generate schedule data array for Excel
   * @param {Object} schedule - Schedule object
   * @param {Array} students - Array of students
   * @param {Array} staff - Array of staff
   * @param {Date} date - Schedule date for day-of-week checking
   * @returns {Array} 2D array for Excel sheet
   */
  static generateScheduleData(schedule, students, staff, date) {
    const data = [];
    
    // Header row with time columns
    data.push([
      'Client',
      'Program',
      'AM Staff',
      'ExpAM Start',
      'ExpAM End',
      'Lunch1Cov',
      'Lunch2Cov',
      'PM Staff',
      'ExpPM Start',
      'ExpPM End',
      'AMStartOR',
      'AMEndOR',
      'PMStartOR',
      'PMEndOR2'
    ]);


    // Get all active students, sorted by name
    const activeStudents = students
      .filter(s => s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Process each student
    activeStudents.forEach(student => {
      // Get assignments for this student
      const amAssignments = schedule.assignments.filter(
        a => a.studentId === student.id && a.session === 'AM'
      );
      const pmAssignments = schedule.assignments.filter(
        a => a.studentId === student.id && a.session === 'PM'
      );
      
      // Log if we have more assignments than expected based on ratio
      const expectedAM = student.ratioAM === '2:1' ? 2 : 1;
      const expectedPM = student.ratioPM === '2:1' ? 2 : 1;
      
      if (amAssignments.length > expectedAM) {
        console.log(`⚠️ ${student.name} has ${amAssignments.length} AM assignments but ratio is ${student.ratioAM} (expected ${expectedAM})`);
        console.log('  AM assignments:', amAssignments.map(a => ({ staffId: a.staffId, staffName: staff.find(s => s.id === a.staffId)?.name })));
      }
      if (pmAssignments.length > expectedPM) {
        console.log(`⚠️ ${student.name} has ${pmAssignments.length} PM assignments but ratio is ${student.ratioPM} (expected ${expectedPM})`);
        console.log('  PM assignments:', pmAssignments.map(a => ({ staffId: a.staffId, staffName: staff.find(s => s.id === a.staffId)?.name })));
      }

      // Get trainee assignments
      const amTrainee = schedule.traineeAssignments?.find(
        t => t.studentId === student.id && t.session === 'AM'
      );
      const pmTrainee = schedule.traineeAssignments?.find(
        t => t.studentId === student.id && t.session === 'PM'
      );

      // Get staff names (formatted as First Name + Last Initial)
      const amStaffNames = amAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        return staffMember ? this.formatStaffName(staffMember.name) : 'Unknown';
      });
      
      // Remove duplicates (keep as array for 2:1 handling)
      const uniqueAmStaff = [...new Set(amStaffNames)];

      const pmStaffNames = pmAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        return staffMember ? this.formatStaffName(staffMember.name) : 'Unknown';
      });
      
      // Remove duplicates (keep as array for 2:1 handling)
      const uniquePmStaff = [...new Set(pmStaffNames)];

      // Check if student is absent (pass date to check day-of-week schedule)
      const isAbsentAM = !student.isAvailableForSession('AM', date);
      const isAbsentPM = !student.isAvailableForSession('PM', date);

      // Determine absence status
      let amStatus = '';
      let pmStatus = '';
      
      if (isAbsentAM) {
        // Check if out of session or absent
        if (student.outOfSessionAM || student.outOfSessionFullDay) {
          amStatus = 'OUT';
        } else {
          amStatus = 'ABSENT';
        }
      }
      
      if (isAbsentPM) {
        // Check if out of session or absent
        if (student.outOfSessionPM || student.outOfSessionFullDay) {
          pmStatus = 'OUT';
        } else {
          pmStatus = 'ABSENT';
        }
      }

      // NEW: For 2:1 ratios, create separate rows for each staff member
      const maxStaffAM = Math.max(uniqueAmStaff.length, isAbsentAM ? 1 : 0);
      const maxStaffPM = Math.max(uniquePmStaff.length, isAbsentPM ? 1 : 0);
      const maxRows = Math.max(maxStaffAM, maxStaffPM, 1); // At least 1 row

      // Determine times based on program
      const isPrimary = student.program === 'Primary';
      const amStart = '8:45 AM';
      const amEnd = isPrimary ? '12:05 PM' : '11:30 AM';
      const pmStart = isPrimary ? '12:35 PM' : '12:00 PM';
      const pmEnd = '3:00 PM';

      for (let i = 0; i < maxRows; i++) {
        const rowAmStaff = isAbsentAM && i === 0 ? amStatus : (uniqueAmStaff[i] || '');
        const rowPmStaff = isAbsentPM && i === 0 ? pmStatus : (uniquePmStaff[i] || '');
        
        // Only add row if there's content or it's the first row
        if (i === 0 || rowAmStaff || rowPmStaff) {
          data.push([
            student.name, // Client
            student.program, // Program
            rowAmStaff, // AM Staff
            rowAmStaff ? amStart : '', // AM Start (only if staff assigned)
            rowAmStaff ? amEnd : '', // AM End (only if staff assigned)
            '', // Lunch1Cov BLANK
            '', // Lunch2Cov BLANK
            rowPmStaff, // PM Staff
            rowPmStaff ? pmStart : '', // PM Start (only if staff assigned)
            rowPmStaff ? pmEnd : '', // PM End (only if staff assigned)
            '', // AMStartOR BLANK
            '', // AMEndOR BLANK
            '', // PMStartOR BLANK
            ''  // PMEndOR2 BLANK
          ]);
        }
      }

      // Add trainee rows if applicable - ALWAYS add as separate row
      if (amTrainee && !isAbsentAM) {
        const traineeStaff = staff.find(s => s.id === amTrainee.staffId);
        if (traineeStaff) {
          const isPrimary = student.program === 'Primary';
          const amStart = '8:45 AM';
          const amEnd = isPrimary ? '12:05 PM' : '11:30 AM';
          
          data.push([
            student.name + ' (Trainee)',
            student.program,
            this.formatStaffName(traineeStaff.name), // AM Staff
            amStart, // AM Start
            amEnd, // AM End
            '', // Lunch1Cov BLANK
            '', // Lunch2Cov BLANK
            '', // PM Staff (trainee is AM only)
            '', // PM Start
            '', // PM End
            '', // AMStartOR BLANK
            '', // AMEndOR BLANK
            '', // PMStartOR BLANK
            ''  // PMEndOR2 BLANK
          ]);
        }
      }

      if (pmTrainee && !isAbsentPM) {
        const traineeStaff = staff.find(s => s.id === pmTrainee.staffId);
        if (traineeStaff) {
          const isPrimary = student.program === 'Primary';
          const pmStart = isPrimary ? '12:35 PM' : '12:00 PM';
          const pmEnd = '3:00 PM';
          
          data.push([
            student.name + ' (Trainee)',
            student.program,
            '', // AM Staff (trainee is PM only)
            '', // AM Start
            '', // AM End
            '', // Lunch1Cov BLANK
            '', // Lunch2Cov BLANK
            this.formatStaffName(traineeStaff.name), // PM Staff
            pmStart, // PM Start
            pmEnd, // PM End
            '', // AMStartOR BLANK
            '', // AMEndOR BLANK
            '', // PMStartOR BLANK
            ''  // PMEndOR2 BLANK
          ]);
        }
      }
    });

    // Add OUT rows for staff with out-of-session assignments
    // Create one row per staff member (separate rows for AM and PM if needed)
    if (schedule.outOfSessionAssignments && schedule.outOfSessionAssignments.length > 0) {
      // Group by staff ID, tracking which sessions they have
      const outStaffMap = new Map();

      schedule.outOfSessionAssignments.forEach(outAssignment => {
        const staffMember = staff.find(s => s.id === outAssignment.staffId);
        if (staffMember && outAssignment.session) {
          const staffName = this.formatStaffName(staffMember.name);
          
          if (!outStaffMap.has(outAssignment.staffId)) {
            outStaffMap.set(outAssignment.staffId, {
              name: staffName,
              AM: false,
              PM: false
            });
          }
          
          outStaffMap.get(outAssignment.staffId)[outAssignment.session] = true;
        }
      });

      // Convert to array and sort by name
      const outStaffList = Array.from(outStaffMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      // Add one row per staff member
      outStaffList.forEach((staffInfo, index) => {
        data.push([
          index === 0 ? 'OUT' : '', // Only show "OUT" on first row
          index === 0 ? '-' : '',   // Only show "-" on first row
          staffInfo.AM ? staffInfo.name : '', // AM Staff
          '', // AM Start
          '', // AM End
          '', // Lunch1Cov BLANK
          '', // Lunch2Cov BLANK
          staffInfo.PM ? staffInfo.name : '', // PM Staff
          '', // PM Start
          '', // PM End
          '', // AMStartOR BLANK
          '', // AMEndOR BLANK
          '', // PMStartOR BLANK
          ''  // PMEndOR2 BLANK
        ]);
      });
    }

    return data;
  }

  /**
   * Generate absences data array for Excel
   * @param {Array} students - Array of students
   * @param {Array} staff - Array of staff
   * @returns {Array} 2D array for Excel sheet
   */
  static generateAbsencesData(students, staff) {
    const data = [];
    
    // Header row
    data.push([
      'Name',
      'Role',
      'Status'
    ]);

    // Collect all staff with their status
    const staffList = [];

    // Process all active staff
    staff.forEach(staffMember => {
      if (!staffMember.isActive) return;
      
      // Determine status based on attendance flags
      let status = 'Present';
      
      if (staffMember.absentFullDay) {
        status = 'Absent Full Day';
      } else if (staffMember.absentAM && staffMember.absentPM) {
        status = 'Absent Full Day';
      } else if (staffMember.absentAM) {
        status = 'Absent AM';
      } else if (staffMember.absentPM) {
        status = 'Absent PM';
      } else if (staffMember.outOfSessionFullDay) {
        status = 'Out Session Full Day';
      } else if (staffMember.outOfSessionAM && staffMember.outOfSessionPM) {
        status = 'Out Session Full Day';
      } else if (staffMember.outOfSessionAM) {
        status = 'Out Session AM';
      } else if (staffMember.outOfSessionPM) {
        status = 'Out Session PM';
      }
      
      staffList.push({
        name: this.formatStaffName(staffMember.name),
        role: staffMember.role,
        status: status
      });
    });

    // Sort staff by name
    staffList.sort((a, b) => a.name.localeCompare(b.name));

    // Add to data array
    staffList.forEach(staff => {
      data.push([
        staff.name,
        staff.role,
        staff.status
      ]);
    });

    // Add a row if no staff
    if (staffList.length === 0) {
      data.push(['No active staff found', '', '']);
    }

    return data;
  }

  /**
   * Generate client attendance data array for Excel
   * @param {Array} students - Array of students
   * @returns {Array} 2D array for Excel sheet
   */
  static generateClientAttendanceData(students) {
    const data = [];
    
    // Header row
    data.push([
      'Name',
      'Program',
      'Status'
    ]);

    // Collect all students with their status
    const clientList = [];

    // Process all active students
    students.forEach(student => {
      if (!student.isActive) return;
      
      // Determine status based on attendance flags
      let status = 'Present';
      
      // Check for absences first
      const isAbsentAM = student.absentAM;
      const isAbsentPM = student.absentPM;
      const isAbsentFullDay = student.absentFullDay;
      
      // Check for out of session
      const outOfSessionAM = student.outOfSessionAM;
      const outOfSessionPM = student.outOfSessionPM;
      const outOfSessionFullDay = student.outOfSessionFullDay;
      
      if (isAbsentFullDay) {
        status = 'Absent Full Day';
      } else if (isAbsentAM && isAbsentPM) {
        status = 'Absent Full Day';
      } else if (outOfSessionFullDay) {
        status = 'Out Session Full Day';
      } else if (outOfSessionAM && outOfSessionPM) {
        status = 'Out Session Full Day';
      } else if (isAbsentAM && outOfSessionPM) {
        status = 'Absent AM / Out Session PM';
      } else if (outOfSessionAM && isAbsentPM) {
        status = 'Out Session AM / Absent PM';
      } else if (isAbsentAM) {
        status = 'Absent AM';
      } else if (isAbsentPM) {
        status = 'Absent PM';
      } else if (outOfSessionAM) {
        status = 'Out Session AM';
      } else if (outOfSessionPM) {
        status = 'Out Session PM';
      }
      
      clientList.push({
        name: student.name,
        program: student.program,
        status: status
      });
    });

    // Sort clients by name
    clientList.sort((a, b) => a.name.localeCompare(b.name));

    // Add to data array
    clientList.forEach(client => {
      data.push([
        client.name,
        client.program,
        client.status
      ]);
    });

    // Add a row if no clients
    if (clientList.length === 0) {
      data.push(['No active clients found', '', '']);
    }

    return data;
  }
}
