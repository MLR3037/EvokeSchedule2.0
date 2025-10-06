import { Staff, Student, Assignment, Schedule, PROGRAMS } from '../types/index.js';

/**
 * SharePoint integration service for ABA Scheduling
 * Handles authentication and data operations with SharePoint lists
 */
export class SharePointService {
  constructor(config) {
    this.config = {
      siteUrl: config.siteUrl || 'https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators',
      staffListName: config.staffListName || 'Staff',
      studentsListName: config.studentsListName || 'Students', // Renamed from Clients
      scheduleListName: config.scheduleListName || 'ABASchedules', // New list name
      clientId: config.clientId,
      tenantId: config.tenantId,
      redirectUri: config.redirectUri
    };
    this.accessToken = null;
  }

  /**
   * Authentication methods
   */
  generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async login() {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    localStorage.setItem('code_verifier', codeVerifier);
    
    const authUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${this.config.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(this.config.redirectUri)}&` +
      `scope=${encodeURIComponent('https://graph.microsoft.com/Sites.ReadWrite.All')}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`;
    
    window.location.href = authUrl;
  }

  async exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');
    
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
      const body = new URLSearchParams({
        client_id: this.config.clientId,
        scope: 'https://graph.microsoft.com/Sites.ReadWrite.All',
        code: code,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });

      if (response.ok) {
        const tokenData = await response.json();
        this.accessToken = tokenData.access_token;
        localStorage.setItem('sp_access_token', this.accessToken);
        localStorage.removeItem('code_verifier');
        return this.accessToken;
      } else {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error_description}`);
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  logout() {
    this.accessToken = null;
    localStorage.removeItem('sp_access_token');
    localStorage.removeItem('code_verifier');
  }

  /**
   * Check authentication status and handle token refresh
   */
  async checkAuthentication() {
    // Check for authorization code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      await this.exchangeCodeForToken(code);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }

    // Check for existing token
    const savedToken = localStorage.getItem('sp_access_token');
    if (savedToken) {
      this.accessToken = savedToken;
      return true;
    }

    return false;
  }

  /**
   * Get headers for SharePoint API calls
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose'
    };
  }

  /**
   * Load staff data from SharePoint
   */
  async loadStaff() {
    try {
      // Expand Person fields to get full user information
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items?$select=*,StaffPerson/Title,StaffPerson/EMail,StaffPerson/Id&$expand=StaffPerson`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to load staff: ${response.status}`);
      }

      const data = await response.json();
      
      return data.d.results.map(item => new Staff({
        id: item.ID,
        name: item.StaffPerson ? item.StaffPerson.Title : item.Title,
        email: item.StaffPerson ? item.StaffPerson.EMail : '',
        userId: item.StaffPerson ? item.StaffPerson.Id : null,
        staffPerson: item.StaffPerson,
        role: item.Position || item.Role,
        primaryProgram: item.PrimaryProgram === true, // Yes/No field
        secondaryProgram: item.SecondaryProgram === true, // Yes/No field
        isActive: item.IsActive !== false // Default to true if not specified
      }));
    } catch (error) {
      console.error('Error loading staff:', error);
      throw error;
    }
  }

  /**
   * Load student data from SharePoint
   */
  async loadStudents() {
    try {
      // Expand Person fields for team members (previously preferred staff)
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items?$select=*,Team/Title,Team/Id,Team/EMail&$expand=Team`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to load students: ${response.status}`);
      }

      const data = await response.json();
      
      return data.d.results.map(item => {
        // Extract team members from People Picker field
        let team = [];
        if (item.Team && item.Team.results) {
          team = item.Team.results.map(person => ({
            id: person.Id,
            title: person.Title,
            email: person.EMail
          }));
        }

        return new Student({
          id: item.ID,
          name: item.Title,
          program: item.Program || PROGRAMS.PRIMARY,
          ratioAM: item.RatioAM || '1:1',
          ratioPM: item.RatioPM || '1:1',
          isActive: item.IsActive !== false,
          team
        });
      });
    } catch (error) {
      console.error('Error loading students:', error);
      throw error;
    }
  }

  /**
   * Load schedule data for a specific date
   */
  async loadSchedule(date) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.scheduleListName}')/items?$filter=ScheduleDate eq '${dateStr}'`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to load schedule: ${response.status}`);
      }

      const data = await response.json();
      const assignments = data.d.results.map(item => new Assignment({
        id: item.ID,
        staffId: item.StaffId,
        studentId: item.StudentId,
        session: item.Session,
        program: item.Program,
        date: new Date(item.ScheduleDate),
        isLocked: item.IsLocked || false,
        assignedBy: item.AssignedBy || 'auto'
      }));

      // Create locked assignments set
      const lockedAssignments = new Set(
        assignments.filter(a => a.isLocked).map(a => a.id)
      );

      return new Schedule({
        date,
        assignments,
        lockedAssignments,
        isFinalized: data.d.results.some(item => item.IsFinalized)
      });
    } catch (error) {
      console.error('Error loading schedule:', error);
      // Return empty schedule if none exists
      return new Schedule({ date });
    }
  }

  /**
   * Save staff member to SharePoint
   */
  async saveStaff(staff, isUpdate = false) {
    try {
      const url = isUpdate 
        ? `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items(${staff.id})`
        : `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items`;

      const body = {
        __metadata: { type: 'SP.Data.StaffListItem' },
        Title: staff.name,
        Position: staff.role,
        PrimaryProgram: staff.primaryProgram, // Yes/No field
        SecondaryProgram: staff.secondaryProgram, // Yes/No field
        IsActive: staff.isActive
      };

      // Add People Picker field for staff person
      if (staff.userId) {
        body.StaffPersonId = staff.userId;
      }

      const headers = {
        ...this.getHeaders(),
        'X-HTTP-Method': isUpdate ? 'MERGE' : 'POST',
        'If-Match': isUpdate ? '*' : undefined
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to save staff: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Error saving staff:', error);
      throw error;
    }
  }

  /**
   * Save student to SharePoint
   */
  async saveStudent(student, isUpdate = false) {
    try {
      const url = isUpdate 
        ? `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items(${student.id})`
        : `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items`;

      const body = {
        __metadata: { type: 'SP.Data.StudentsListItem' },
        Title: student.name,
        Program: student.program,
        RatioAM: student.ratioAM,
        RatioPM: student.ratioPM,
        IsActive: student.isActive
      };

      // Handle People Picker field for team members
      if (student.team && student.team.length > 0) {
        // Convert team member objects to People Picker ID format
        const teamIds = student.team.map(member => member.id || member.Id);
        body.TeamId = { results: teamIds };
      }

      const headers = {
        ...this.getHeaders(),
        'X-HTTP-Method': isUpdate ? 'MERGE' : 'POST',
        'If-Match': isUpdate ? '*' : undefined
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to save student: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Error saving student:', error);
      throw error;
    }
  }

  /**
   * Save complete schedule to SharePoint
   */
  async saveSchedule(schedule) {
    try {
      // First, delete existing assignments for this date
      const dateStr = schedule.date.toISOString().split('T')[0];
      await this.deleteScheduleForDate(dateStr);

      // Then save all assignments
      const promises = schedule.assignments.map(assignment => 
        this.saveAssignment(assignment)
      );

      await Promise.all(promises);
      
      return true;
    } catch (error) {
      console.error('Error saving schedule:', error);
      throw error;
    }
  }

  /**
   * Save individual assignment
   */
  async saveAssignment(assignment) {
    try {
      const body = {
        __metadata: { type: 'SP.Data.ABASchedulesListItem' },
        StaffId: assignment.staffId,
        StudentId: assignment.studentId,
        Session: assignment.session,
        Program: assignment.program,
        ScheduleDate: assignment.date.toISOString().split('T')[0],
        IsLocked: assignment.isLocked,
        AssignedBy: assignment.assignedBy
      };

      const response = await fetch(
        `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.scheduleListName}')/items`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save assignment: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Error saving assignment:', error);
      throw error;
    }
  }

  /**
   * Delete schedule for a specific date
   */
  async deleteScheduleForDate(dateStr) {
    try {
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.scheduleListName}')/items?$filter=ScheduleDate eq '${dateStr}'`,
        { headers: this.getHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        const deletePromises = data.d.results.map(item => 
          fetch(
            `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.scheduleListName}')/items(${item.ID})`,
            {
              method: 'POST',
              headers: {
                ...this.getHeaders(),
                'X-HTTP-Method': 'DELETE',
                'If-Match': '*'
              }
            }
          )
        );

        await Promise.all(deletePromises);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      // Don't throw here, as this might be expected if no schedule exists
    }
  }

  /**
   * Delete staff member
   */
  async deleteStaff(staffId) {
    try {
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items(${staffId})`,
        {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'X-HTTP-Method': 'DELETE',
            'If-Match': '*'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete staff: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  }

  /**
   * Delete student
   */
  async deleteStudent(studentId) {
    try {
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items(${studentId})`,
        {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'X-HTTP-Method': 'DELETE',
            'If-Match': '*'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete student: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  }
}