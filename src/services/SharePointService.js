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
      studentsListName: config.studentsListName || 'Clients', // Points to 'Clients' list in SharePoint
      scheduleListName: config.scheduleListName || 'ABASchedules', // New list name
      clientId: config.clientId,
      tenantId: config.tenantId,
      redirectUri: config.redirectUri
    };
    this.accessToken = null;
    this.tokenExpiry = null;
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
      `scope=${encodeURIComponent('https://graph.microsoft.com/Sites.ReadWrite.All https://graph.microsoft.com/User.Read')}&` +
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
        this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000); // Convert seconds to milliseconds
        localStorage.setItem('sp_access_token', this.accessToken);
        localStorage.setItem('sp_token_expiry', this.tokenExpiry.toString());
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
    this.tokenExpiry = null;
    localStorage.removeItem('sp_access_token');
    localStorage.removeItem('sp_token_expiry');
    localStorage.removeItem('code_verifier');
    console.log('🚪 Logged out - all tokens cleared');
  }

  /**
   * Force logout and clear all authentication data
   */
  forceLogout() {
    this.logout();
    // Also clear any other auth-related data
    localStorage.clear();
    sessionStorage.clear();
    console.log('🧹 Force logout - all storage cleared');
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
    const savedExpiry = localStorage.getItem('sp_token_expiry');
    
    if (savedToken && savedExpiry) {
      const expiryTime = parseInt(savedExpiry);
      const now = Date.now();
      
      // Check if token is still valid (give 5 minute buffer)
      if (now < (expiryTime - 300000)) {
        this.accessToken = savedToken;
        this.tokenExpiry = expiryTime;
        return true;
      } else {
        // Token expired, clear it
        console.log('🔄 Token expired, clearing cached token');
        localStorage.removeItem('sp_access_token');
        localStorage.removeItem('sp_token_expiry');
      }
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
   * Get headers for Microsoft Graph API calls
   */
  getGraphHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make API call with automatic re-authentication on 401
   */
  async makeAuthenticatedRequest(url, options = {}) {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please log in first.');
    }

    try {
      const response = await fetch(url, options);
      
      if (response.status === 401) {
        console.log('🔄 401 Unauthorized - Token expired, attempting silent refresh...');
        
        // For production: attempt silent token refresh
        // For now: clear expired token and prompt re-auth
        this.logout();
        
        // In production, you could implement silent refresh here:
        // const refreshed = await this.silentRefresh();
        // if (refreshed) return await fetch(url, options);
        
        throw new Error('Your session has expired. Please log in again.');
      }
      
      return response;
    } catch (error) {
      if (error.message.includes('session has expired')) {
        // Auto-trigger re-authentication UI
        if (typeof window !== 'undefined' && window.location) {
          // Could trigger a modal or redirect to login
          console.log('🔄 Triggering re-authentication...');
        }
        throw error;
      }
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Load staff data from SharePoint using Microsoft Graph API
   */
  async loadStaff() {
    try {
      console.log('🔍 Loading staff using Microsoft Graph API...');
      
      // First, get the site ID
      const siteResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/evokebehavioralhealthcom.sharepoint.com:/sites/Clinistrators`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!siteResponse.ok) {
        throw new Error(`Failed to get site: ${siteResponse.status}`);
      }
      
      const siteData = await siteResponse.json();
      const siteId = siteData.id;
      console.log('✅ Got site ID:', siteId);
      
      // Get the Staff list
      const listsResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$filter=displayName eq 'Staff'`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!listsResponse.ok) {
        throw new Error(`Failed to get Staff list: ${listsResponse.status}`);
      }
      
      const listsData = await listsResponse.json();
      if (listsData.value.length === 0) {
        throw new Error('Staff list not found');
      }
      
      const listId = listsData.value[0].id;
      console.log('✅ Got Staff list ID:', listId);
      
      // Get list items
      const itemsResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!itemsResponse.ok) {
        throw new Error(`Failed to load staff items: ${itemsResponse.status}`);
      }
      
      const itemsData = await itemsResponse.json();
      console.log('✅ Successfully loaded staff data via Graph API');
      
      return itemsData.value.map(item => {
        const fields = item.fields;
        const staffMember = new Staff({
          id: item.id,
          name: fields.Title,
          role: fields.Role,
          email: fields.Email || '',
          primaryProgram: fields.PrimaryProgram === true,
          secondaryProgram: fields.SecondaryProgram === true,
          isActive: fields.IsActive !== false
        });
        
        // Log staff details for debugging
        if (fields.Title.toLowerCase().includes('sam')) {
          console.log(`🔍 SAM STAFF DETAILS:`, {
            name: fields.Title,
            role: fields.Role,
            primaryProgram: fields.PrimaryProgram,
            secondaryProgram: fields.SecondaryProgram,
            isActive: fields.IsActive,
            allFields: Object.keys(fields).filter(k => !k.startsWith('_') && !k.startsWith('@'))
          });
        }
        
        console.log(`  Staff: ${staffMember.name} (ID: ${staffMember.id}, Role: ${staffMember.role})`, {
          id: staffMember.id,
          email: staffMember.email,
          userId: staffMember.userId,
          allFields: fields
        });
        
        return staffMember;
      });
    } catch (error) {
      console.error('Error loading staff:', error);
      throw error;
    }
  }

  /**
   * Load student data from SharePoint using Microsoft Graph API
   */
  async loadStudents() {
    try {
      console.log('🔍 Loading students using Microsoft Graph API...');
      
      // First, get the site ID
      const siteResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/evokebehavioralhealthcom.sharepoint.com:/sites/Clinistrators`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!siteResponse.ok) {
        throw new Error(`Failed to get site: ${siteResponse.status}`);
      }
      
      const siteData = await siteResponse.json();
      const siteId = siteData.id;
      console.log('✅ Got site ID:', siteId);
      
      // Get the Clients list
      const listsResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$filter=displayName eq 'Clients'`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!listsResponse.ok) {
        throw new Error(`Failed to get Clients list: ${listsResponse.status}`);
      }
      
      const listsData = await listsResponse.json();
      if (listsData.value.length === 0) {
        throw new Error('Clients list not found');
      }
      
      const listId = listsData.value[0].id;
      console.log('✅ Got Clients list ID:', listId);
      
      // Get list items
      const itemsResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!itemsResponse.ok) {
        throw new Error(`Failed to load client items: ${itemsResponse.status}`);
      }
      
      const itemsData = await itemsResponse.json();
      console.log('✅ Successfully loaded students data via Graph API');
      
      return itemsData.value.map((item, index) => {
        const fields = item.fields;
        
        // Debug: log the first few students' ratio fields
        if (index < 5 || fields.Title.toLowerCase().includes('tejas')) {
          console.log(`Student ${fields.Title} ratios:`, {
            RatioAM: fields.RatioAM,
            RatioPM: fields.RatioPM,
            allRatioFields: Object.keys(fields).filter(k => k.toLowerCase().includes('ratio'))
          });
        }
        
        // Handle team members - look for common People Picker field names
        let teamIds = [];
        let team = [];
        
        // Try different possible field names for team members
        const teamFieldNames = [
          'TeamStaffPeopleId', 'Team', 'TeamMembers', 'AssignedStaff', 
          'StaffTeam', 'TeamStaff', 'TeamStaffPeople'
        ];
        
        for (const fieldName of teamFieldNames) {
          if (fields[fieldName]) {
            console.log(`Found team field: ${fieldName}`, fields[fieldName]);
            
            // Handle different formats of People Picker data
            if (Array.isArray(fields[fieldName])) {
              teamIds = fields[fieldName].map(person => person.LookupId || person.Id || person);
              team = fields[fieldName].map(person => ({
                id: person.LookupId || person.Id || person,
                title: person.LookupValue || person.Title || person.title,
                email: person.Email || person.email
              }));
            } else if (fields[fieldName].results) {
              teamIds = fields[fieldName].results.map(person => person.LookupId || person.Id || person);
              team = fields[fieldName].results.map(person => ({
                id: person.LookupId || person.Id || person,
                title: person.LookupValue || person.Title || person.title,
                email: person.Email || person.email
              }));
            }
            
            // Log the processed team data for debugging
            if (team.length > 0) {
              console.log(`  Student ${fields.Title} team:`, team);
              console.log(`  Team IDs:`, teamIds);
              console.log(`  First team member details:`, team[0]);
            }
            break;
          }
        }
        
        return new Student({
          id: item.id,
          name: fields.Title,
          program: fields.Program || PROGRAMS.PRIMARY,
          ratioAM: fields.RatioAM || '1:1',
          ratioPM: fields.RatioPM || '1:1',
          isActive: fields.IsActive !== false,
          team: team,
          teamIds: teamIds // Add this for backward compatibility
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
      console.log('📅 Loading schedule for date:', date);
      
      // First, get the site ID
      const siteResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/evokebehavioralhealthcom.sharepoint.com:/sites/Clinistrators`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!siteResponse.ok) {
        throw new Error(`Failed to get site: ${siteResponse.status}`);
      }
      
      const siteData = await siteResponse.json();
      const siteId = siteData.id;
      
      // Get the ABASchedules list
      const listsResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$filter=displayName eq '${this.config.scheduleListName}'`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!listsResponse.ok) {
        throw new Error(`Failed to get schedule list: ${listsResponse.status}`);
      }
      
      const listsData = await listsResponse.json();
      if (listsData.value.length === 0) {
        console.log('📅 Schedule list not found, returning empty schedule');
        return new Schedule({ date, assignments: [] });
      }
      
      const listId = listsData.value[0].id;
      
      // Get schedule items for the specific date
      const dateStr = date.toISOString().split('T')[0];
      const itemsResponse = await this.makeAuthenticatedRequest(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$filter=fields/ScheduleDate eq '${dateStr}'`,
        { headers: this.getGraphHeaders() }
      );

      if (!itemsResponse.ok) {
        throw new Error(`Failed to load schedule items: ${itemsResponse.status}`);
      }

      const itemsData = await itemsResponse.json();
      const assignments = itemsData.value.map(item => {
        const fields = item.fields;
        return new Assignment({
          id: item.id,
          staffId: fields.StaffId,
          studentId: fields.StudentId,
          session: fields.Session,
          program: fields.Program,
          date: new Date(fields.ScheduleDate),
          isLocked: fields.IsLocked || false,
          assignedBy: fields.AssignedBy || 'auto'
        });
      });

      // Create locked assignments set
      const lockedAssignments = new Set(
        assignments.filter(a => a.isLocked).map(a => a.id)
      );

      return new Schedule({
        date,
        assignments,
        lockedAssignments,
        isFinalized: assignments.some(a => a.fields?.IsFinalized || false)
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
        __metadata: { type: 'SP.Data.ClientsListItem' }, // Updated to match SharePoint list name
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

  /**
   * Debug method to list all available lists in the SharePoint site using Graph API
   */
  async debugListAllLists() {
    try {
      console.log('🔍 Fetching all lists from SharePoint site using Graph API...');
      
      // First, get the site ID
      const siteResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/evokebehavioralhealthcom.sharepoint.com:/sites/Clinistrators`,
        { headers: this.getGraphHeaders() }
      );
      
      if (!siteResponse.ok) {
        throw new Error(`Failed to get site: ${siteResponse.status}`);
      }
      
      const siteData = await siteResponse.json();
      const siteId = siteData.id;
      console.log('✅ Got site ID:', siteId);
      
      // Get all lists
      const listsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`,
        { headers: this.getGraphHeaders() }
      );

      if (!listsResponse.ok) {
        throw new Error(`Failed to fetch lists: ${listsResponse.status}`);
      }

      const data = await listsResponse.json();
      console.log('📋 Available SharePoint Lists:');
      console.table(data.value.map(list => ({
        DisplayName: list.displayName,
        Name: list.name,
        ID: list.id,
        WebUrl: list.webUrl
      })));
      
      return data.value;
    } catch (error) {
      console.error('Error fetching lists:', error);
      throw error;
    }
  }
}