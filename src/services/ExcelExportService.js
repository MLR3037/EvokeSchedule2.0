import * as XLSX from 'xlsx';

/**
 * Excel Export Service for Schedule
 * Exports schedule data and absences to Excel format
 */
export class ExcelExportService {
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
      const scheduleData = this.generateScheduleData(schedule, students, staff);
      
      // Generate absences data
      const absencesData = this.generateAbsencesData(students, staff);

      // Create worksheets
      const scheduleSheet = XLSX.utils.aoa_to_sheet(scheduleData);
      const absencesSheet = XLSX.utils.aoa_to_sheet(absencesData);

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

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');
      XLSX.utils.book_append_sheet(workbook, absencesSheet, 'Staff Attendance');

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
   * @returns {Array} 2D array for Excel sheet
   */
  static generateScheduleData(schedule, students, staff) {
    const data = [];
    
    // Header row
    data.push([
      'Client',
      'Program',
      'AM Staff',
      'PM Staff'
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

      // Get staff names
      const amStaffNames = amAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        return staffMember ? staffMember.name : 'Unknown';
      });
      
      // Remove duplicates and join
      const uniqueAmStaff = [...new Set(amStaffNames)].join(', ');

      const pmStaffNames = pmAssignments.map(a => {
        const staffMember = staff.find(s => s.id === a.staffId);
        return staffMember ? staffMember.name : 'Unknown';
      });
      
      // Remove duplicates and join
      const uniquePmStaff = [...new Set(pmStaffNames)].join(', ');

      // Check if student is absent
      const isAbsentAM = !student.isAvailableForSession('AM');
      const isAbsentPM = !student.isAvailableForSession('PM');

      // Determine absence status text
      let amStatus = '';
      let pmStatus = '';
      
      if (isAbsentAM) {
        // Check if out of session or absent
        if (student.outOfSessionAM || student.outOfSessionFullDay) {
          amStatus = 'OUT';
        } else {
          amStatus = 'ABSENT';
        }
      } else {
        amStatus = uniqueAmStaff || '';
      }
      
      if (isAbsentPM) {
        // Check if out of session or absent
        if (student.outOfSessionPM || student.outOfSessionFullDay) {
          pmStatus = 'OUT';
        } else {
          pmStatus = 'ABSENT';
        }
      } else {
        pmStatus = uniquePmStaff || '';
      }

      // Always add row for student (show ABSENT/OUT even if no assignments)
      data.push([
        student.name,
        student.program,
        amStatus,
        pmStatus
      ]);

      // Add trainee rows if applicable - ALWAYS add as separate row
      if (amTrainee && !isAbsentAM) {
        const traineeStaff = staff.find(s => s.id === amTrainee.staffId);
        if (traineeStaff) {
          data.push([
            student.name + ' (Trainee)',
            student.program,
            traineeStaff.name,
            '' // PM Staff (trainee is AM only)
          ]);
        }
      }

      if (pmTrainee && !isAbsentPM) {
        const traineeStaff = staff.find(s => s.id === pmTrainee.staffId);
        if (traineeStaff) {
          data.push([
            student.name + ' (Trainee)',
            student.program,
            '', // AM Staff (trainee is PM only)
            traineeStaff.name
          ]);
        }
      }
    });

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
        name: staffMember.name,
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
}
