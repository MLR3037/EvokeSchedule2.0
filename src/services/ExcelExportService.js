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
        { wch: 20 }, // Client Name
        { wch: 12 }, // Program
        { wch: 25 }, // AM Staff
        { wch: 10 }, // AM Start
        { wch: 10 }, // AM End
        { wch: 15 }, // Lunch 1 Cov
        { wch: 15 }, // Lunch 2 Cov
        { wch: 25 }, // PM Staff
        { wch: 10 }, // PM Start
        { wch: 10 }  // PM End
      ];

      absencesSheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 15 }, // Staff/Student
        { wch: 12 }, // Absent AM
        { wch: 12 }  // Absent PM
      ];

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');
      XLSX.utils.book_append_sheet(workbook, absencesSheet, 'Absences');

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
      'Client Name',
      'Program',
      'AM Staff',
      'AM Start',
      'AM End',
      'Lunch 1 Cov',
      'Lunch 2 Cov',
      'PM Staff',
      'PM Start',
      'PM End'
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

      // Add main row for student
      if (!isAbsentAM || !isAbsentPM) {
        data.push([
          student.name,
          student.program,
          isAbsentAM ? 'ABSENT' : uniqueAmStaff || '',
          '', // AM Start (to be filled in)
          '', // AM End (to be filled in)
          '', // Lunch 1 Cov
          '', // Lunch 2 Cov
          isAbsentPM ? 'ABSENT' : uniquePmStaff || '',
          '', // PM Start (to be filled in)
          ''  // PM End (to be filled in)
        ]);
      }

      // Add trainee rows if applicable - ALWAYS add as separate row
      if (amTrainee && !isAbsentAM) {
        const traineeStaff = staff.find(s => s.id === amTrainee.staffId);
        if (traineeStaff) {
          data.push([
            student.name + ' (Trainee)',
            student.program,
            traineeStaff.name,
            '', // AM Start
            '', // AM End
            '', // Lunch 1 Cov
            '', // Lunch 2 Cov
            '', // PM Staff (trainee is AM only)
            '', // PM Start
            ''  // PM End
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
            '', // AM Start
            '', // AM End
            '', // Lunch 1 Cov
            '', // Lunch 2 Cov
            traineeStaff.name,
            '', // PM Start
            ''  // PM End
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
      'Staff/Student',
      'Absent AM',
      'Absent PM'
    ]);

    // Collect all absences
    const absences = [];

    // Student absences
    students.forEach(student => {
      if (!student.isActive) return;
      
      const absentAM = !student.isAvailableForSession('AM');
      const absentPM = !student.isAvailableForSession('PM');
      
      if (absentAM || absentPM) {
        absences.push({
          name: student.name,
          type: 'Student',
          absentAM: absentAM ? 'Yes' : 'No',
          absentPM: absentPM ? 'Yes' : 'No'
        });
      }
    });

    // Staff absences
    staff.forEach(staffMember => {
      if (!staffMember.isActive) return;
      
      const absentAM = !staffMember.isAvailableForSession('AM');
      const absentPM = !staffMember.isAvailableForSession('PM');
      
      if (absentAM || absentPM) {
        absences.push({
          name: staffMember.name,
          type: 'Staff',
          absentAM: absentAM ? 'Yes' : 'No',
          absentPM: absentPM ? 'Yes' : 'No'
        });
      }
    });

    // Sort absences by name
    absences.sort((a, b) => a.name.localeCompare(b.name));

    // Add to data array
    absences.forEach(absence => {
      data.push([
        absence.name,
        absence.type,
        absence.absentAM,
        absence.absentPM
      ]);
    });

    // Add a row if no absences
    if (absences.length === 0) {
      data.push(['No absences recorded', '', '', '']);
    }

    return data;
  }
}
