import { Staff, Student, Assignment, Schedule, PROGRAMS } from '../types/index.js';
import { PublicClientApplication } from '@azure/msal-browser';

/**
 * SharePoint REST API integration service with MSAL authentication
 * For external hosting (GitHub Pages, etc.)
 */
export class SharePointService {
  constructor(config) {
    this.config = {
      siteUrl: config.siteUrl || 'https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators',
      staffListName: config.staffListName || 'Staff',
      studentsListName: config.studentsListName || 'Clients',
      scheduleListName: config.scheduleListName || 'ABASchedules',
      clientId: config.clientId,
      tenantId: config.tenantId,
      redirectUri: config.redirectUri
    };
    
    // MSAL Configuration
    this.msalConfig = {
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        redirectUri: this.config.redirectUri
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      }
    };
    
    this.msalInstance = new PublicClientApplication(this.msalConfig);
    this.isInitialized = false;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.requestDigest = null;
    this.digestExpiry = null;
    
    // ✅ FIXED: Use correct SharePoint domain (not site path)
    this.loginRequest = {
      scopes: ['https://evokebehavioralhealthcom.sharepoint.com/.default'],
      prompt: 'select_account'
    };
    
    console.log('🔧 SharePointService initialized:', {
      siteUrl: this.config.siteUrl,
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      scopes: this.loginRequest.scopes
    });
  }

  /**
   * Initialize MSAL instance
   */
  async initializeMSAL() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Initializing MSAL...');
      await this.msalInstance.initialize();
      this.isInitialized = true;
      console.log('✅ MSAL initialized successfully');
    } catch (error) {
      console.error('❌ MSAL initialization failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Microsoft using MSAL
   */
  async login() {
    try {
      console.log('🔐 Starting MSAL login...');
      
      // Ensure MSAL is initialized
      await this.initializeMSAL();
      
      // Try silent login first
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const response = await this.msalInstance.acquireTokenSilent({
            ...this.loginRequest,
            account: accounts[0]
          });
          
          this.accessToken = response.accessToken;
          this.tokenExpiry = response.expiresOn.getTime();
          console.log('✅ Silent login successful');
          return true;
        } catch (silentError) {
          console.log('⚠️ Silent login failed, will redirect...');
        }
      }

      console.log('🔗 Redirecting to Microsoft login...');
      console.log('📋 Login request:', this.loginRequest);
      
      await this.msalInstance.loginRedirect(this.loginRequest);
      return false; // Will redirect
    } catch (error) {
      console.error('❌ MSAL login failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuthentication() {
    try {
      // Ensure MSAL is initialized
      await this.initializeMSAL();
      
      // Handle redirect response
      const response = await this.msalInstance.handleRedirectPromise();
      
      if (response) {
        console.log('✅ Login redirect handled successfully');
        console.log('📋 Token response:', {
          scopes: response.scopes,
          tokenType: response.tokenType,
          expiresOn: response.expiresOn
        });
        this.accessToken = response.accessToken;
        this.tokenExpiry = response.expiresOn.getTime();
        return true;
      }

      // Check for existing account
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        console.log('✅ Found existing account:', accounts[0].username);
        
        // Try to get token silently
        try {
          const tokenResponse = await this.msalInstance.acquireTokenSilent({
            ...this.loginRequest,
            account: accounts[0]
          });
          
          this.accessToken = tokenResponse.accessToken;
          this.tokenExpiry = tokenResponse.expiresOn.getTime();
          console.log('✅ Token acquired silently');
          return true;
        } catch (error) {
          console.log('⚠️ Silent token acquisition failed:', error.message);
          return false;
        }
      }

      console.log('⚠️ No authenticated accounts found');
      return false;
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Get cached token using MSAL
   */
  async getCachedToken() {
    try {
      // Ensure MSAL is initialized
      await this.initializeMSAL();
      
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length === 0) {
        return null;
      }

      const tokenResponse = await this.msalInstance.acquireTokenSilent({
        ...this.loginRequest,
        account: accounts[0]
      });

      console.log('✅ Retrieved token silently from MSAL');
      this.tokenExpiry = tokenResponse.expiresOn.getTime();
      return tokenResponse.accessToken;
    } catch (error) {
      console.log('⚠️ Could not get token silently:', error.message);
      return null;
    }
  }

  /**
   * Force logout and clear tokens
   */
  forceLogout() {
    console.log('🚪 Logging out with MSAL...');
    this.accessToken = null;
    this.tokenExpiry = null;
    
    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      this.msalInstance.logoutRedirect({
        account: accounts[0]
      });
    }
  }

  /**
   * Get SharePoint request digest for write operations
   */
  async getRequestDigest() {
    if (this.requestDigest && this.digestExpiry && Date.now() < this.digestExpiry) {
      return this.requestDigest;
    }

    try {
      const response = await fetch(`${this.config.siteUrl}/_api/contextinfo`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=verbose',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.requestDigest = data.d.GetContextWebInformation.FormDigestValue;
        this.digestExpiry = Date.now() + (data.d.GetContextWebInformation.FormDigestTimeoutSeconds * 1000) - 60000;
        return this.requestDigest;
      } else {
        throw new Error(`Failed to get request digest: ${response.status}`);
      }
    } catch (error) {
      console.error('Error getting request digest:', error);
      throw error;
    }
  }

  /**
   * Get headers for SharePoint REST API calls
   */
  async getHeaders(isWrite = false) {
    const headers = {
      'Accept': 'application/json;odata=verbose',
      'Authorization': `Bearer ${this.accessToken}`
    };

    if (isWrite) {
      const digest = await this.getRequestDigest();
      headers['X-RequestDigest'] = digest;
      headers['Content-Type'] = 'application/json;odata=verbose';
    }

    return headers;
  }

  /**
   * Make authenticated request to SharePoint
   */
  async makeRequest(url, options = {}) {
    if (!this.accessToken) {
      throw new Error('No access token available. Please login first.');
    }

    try {
      const response = await fetch(url, options);
      
      if (response.status === 401) {
        throw new Error('Authentication failed. Access token may have expired.');
      }
      
      return response;
    } catch (error) {
      console.error('SharePoint request failed:', error);
      throw error;
    }
  }

  /**
   * Load staff data using SharePoint REST API
   */
  async loadStaff() {
    try {
      console.log('🔍 Loading staff from SharePoint REST API...');
      
      const headers = await this.getHeaders();
      
      // Staff list uses Person/Group field, so we need to expand it
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items?` +
        `$select=Id,StaffPerson/Id,StaffPerson/Title,StaffPerson/EMail,Role,PrimaryProgram,SecondaryProgram,IsActive,AbsentAM,AbsentPM,AbsentFullDay&` +
        `$expand=StaffPerson&` +
        `$top=5000`;

      console.log('📋 Fetching staff from:', url);

      const response = await this.makeRequest(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('SharePoint Staff API Error:', response.status, errorText);
        throw new Error(`Failed to load staff: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 Raw SharePoint staff response:', data);

      const staffItems = data.d.results || [];
      console.log(`✅ Found ${staffItems.length} staff members`);

      if (staffItems.length > 0) {
        console.log('📋 First staff item:', staffItems[0]);
      }

      return staffItems.map(item => {
        // Extract staff person info from Person/Group field
        const staffPerson = item.StaffPerson;
        const staffName = staffPerson ? staffPerson.Title : 'Unknown Staff';
        const staffEmail = staffPerson ? staffPerson.EMail : '';
        
        const staff = new Staff({
          id: staffPerson ? staffPerson.Id : item.Id, // Use StaffPerson.Id for consistency with team data
          name: staffName,
          role: item.Role || 'RBT',
          email: staffEmail,
          primaryProgram: item.PrimaryProgram === true,
          secondaryProgram: item.SecondaryProgram === true,
          isActive: item.IsActive !== false,
          absentAM: item.AbsentAM === true,
          absentPM: item.AbsentPM === true,
          absentFullDay: item.AbsentFullDay === true
        });

        console.log(`✅ Loaded staff: ${staff.name} (${staff.role}) - Primary: ${staff.primaryProgram}, Secondary: ${staff.secondaryProgram}`);
        return staff;
      });

    } catch (error) {
      console.error('Error loading staff:', error);
      throw error;
    }
  }

  /**
   * Load student data using SharePoint REST API
   */
  async loadStudents() {
    try {
      console.log('🔍 Loading students from SharePoint REST API...');

      const headers = await this.getHeaders();
      
      // For multi-person picker fields, we need to expand them directly
      // Team is a multi-person picker field that references the Staff list
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items?` +
        `$select=Id,Title,Program,RatioAM,RatioPM,IsActive,PairedWith,Team/Id,Team/Title,Team/EMail,AbsentAM,AbsentPM,AbsentFullDay&` +
        `$expand=Team&` +
        `$top=5000`;

      console.log('📋 Fetching students from:', url);

      const response = await this.makeRequest(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SharePoint Students API Error:', response.status, errorText);
        throw new Error(`Failed to load students: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 Raw SharePoint students response:', data);

      const studentItems = data.d.results || [];
      console.log(`✅ Found ${studentItems.length} students`);

      if (studentItems.length > 0) {
        console.log('📋 First student item:', studentItems[0]);
        console.log('📋 First student team data:', studentItems[0].Team);
      }

      return this.parseStudents(studentItems);

    } catch (error) {
      console.error('❌ Error loading students:', error);
      throw error;
    }
  }

  /**
   * Parse student items from SharePoint response
   */
  parseStudents(studentItems) {
    console.log(`🔍 Parsing ${studentItems.length} students`);
    
    const students = studentItems.map(item => {
      console.log(`🔍 Processing student: ${item.Title}`);
      
      let team = [];
      let teamIds = [];

      // Handle Team field as multi-person picker (User/Group field)
      if (item.Team) {
        if (item.Team.results && Array.isArray(item.Team.results)) {
          // Multi-value person picker format
          console.log(`  📋 Team data for ${item.Title}:`, item.Team.results);
          
          team = item.Team.results.map(person => ({
            id: person.Id,
            title: person.Title,
            name: person.Title,
            email: person.EMail || ''
          }));
          
          teamIds = team.map(member => member.id);
          
        } else if (item.Team.Id) {
          // Single person picker format
          console.log(`  📋 Single team member for ${item.Title}:`, item.Team);
          
          team = [{
            id: item.Team.Id,
            title: item.Team.Title,
            name: item.Team.Title,
            email: item.Team.EMail || ''
          }];
          
          teamIds = [item.Team.Id];
        }
      }

      const student = new Student({
        id: item.Id,
        name: item.Title,
        program: item.Program || PROGRAMS.PRIMARY,
        ratioAM: item.RatioAM || '1:1',
        ratioPM: item.RatioPM || '1:1',
        isActive: item.IsActive !== false,
        team: team,
        teamIds: teamIds,
        pairedWith: item.PairedWith || null,
        absentAM: item.AbsentAM === true,
        absentPM: item.AbsentPM === true,
        absentFullDay: item.AbsentFullDay === true
      });

      if (team.length > 0) {
        console.log(`✅ ${item.Title} has ${team.length} team members:`, team.map(t => t.title));
      } else {
        console.log(`⚠️ ${item.Title} has no team members`);
      }

      return student;
    });

    console.log('📊 STUDENT LOAD SUMMARY:');
    console.log(`  Total students: ${students.length}`);
    console.log(`  Students with teams: ${students.filter(s => s.team && s.team.length > 0).length}`);

    return students;
  }

  /**
   * Load schedule data for a specific date
   */
  async loadSchedule(date) {
    try {
      console.log('📅 Schedule loading temporarily disabled - returning empty schedule');
      
      return new Schedule({ 
        date, 
        assignments: [], 
        lockedAssignments: new Set(),
        isFinalized: false 
      });
      
    } catch (error) {
      console.error('Error in loadSchedule:', error);
      return new Schedule({ date });
    }
  }

  // Save methods remain the same...
  async saveStaff(staff, isUpdate = false) {
    try {
      const headers = await this.getHeaders(true);
      
      if (isUpdate) {
        headers['X-HTTP-Method'] = 'MERGE';
        headers['If-Match'] = '*';
      }

      const url = isUpdate 
        ? `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items(${staff.id})`
        : `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items`;

      const body = {
        __metadata: { type: 'SP.Data.StaffListItem' },
        Title: staff.name,
        Role: staff.role,
        Email: staff.email,
        PrimaryProgram: staff.primaryProgram,
        SecondaryProgram: staff.secondaryProgram,
        IsActive: staff.isActive,
        AbsentAM: staff.absentAM || false,
        AbsentPM: staff.absentPM || false,
        AbsentFullDay: staff.absentFullDay || false
      };

      const response = await this.makeRequest(url, {
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

  async saveStudent(student, isUpdate = false) {
    try {
      const headers = await this.getHeaders(true);
      
      if (isUpdate) {
        headers['X-HTTP-Method'] = 'MERGE';
        headers['If-Match'] = '*';
      }

      const url = isUpdate 
        ? `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items(${student.id})`
        : `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items`;

      // Prepare team field for SharePoint People Picker
      const teamResults = student.team && student.team.length > 0
        ? student.team.map(person => person.id || person.userId).filter(id => id)
        : [];

      const body = {
        __metadata: { type: 'SP.Data.ClientsListItem' },
        Title: student.name,
        Program: student.program,
        RatioAM: student.ratioAM,
        RatioPM: student.ratioPM,
        IsActive: student.isActive,
        TeamId: { results: teamResults }, // People Picker field
        AbsentAM: student.absentAM || false,
        AbsentPM: student.absentPM || false,
        AbsentFullDay: student.absentFullDay || false
      };

      const response = await this.makeRequest(url, {
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

  async saveSchedule(schedule) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot save schedule - not authenticated');
        return false;
      }

      console.log('💾 Saving schedule to SharePoint...', schedule.date);

      // Check if ABASchedules list exists
      console.log('🔍 Checking for ABASchedules list...');
      const listsResponse = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('ABASchedules')`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json;odata=verbose'
          }
        }
      );

      console.log('📋 List check response status:', listsResponse.status);

      if (!listsResponse.ok) {
        if (listsResponse.status === 404) {
          console.warn('📋 ABASchedules list not found (404). Schedule history features are disabled.');
        } else {
          console.error('📋 Error checking for ABASchedules list:', listsResponse.status, listsResponse.statusText);
          const errorText = await listsResponse.text();
          console.error('📋 Error details:', errorText);
        }
        console.log('ℹ️ To enable schedule history, create SharePoint lists using SCHEDULE_HISTORY_SETUP.md');
        return false;
      }

      console.log('✅ ABASchedules list found!');

      // Also check if ABAAssignments list exists
      console.log('🔍 Checking for ABAAssignments list...');
      const assignmentsListResponse = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('ABAAssignments')`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json;odata=verbose'
          }
        }
      );

      if (!assignmentsListResponse.ok) {
        console.error('❌ ABAAssignments list not found:', assignmentsListResponse.status);
        console.log('ℹ️ Both ABASchedules and ABAAssignments lists are required');
        return false;
      }

      console.log('✅ Both SharePoint lists found, proceeding with save...');

      // Prepare schedule metadata
      const scheduleData = {
        ScheduleDate: schedule.date,
        IsFinalized: schedule.isFinalized,
        TotalAssignments: schedule.assignments.length,
        CreatedDate: new Date().toISOString(),
        CreatedBy: this.currentUser?.displayName || 'Unknown',
        AssignmentsSummary: this.generateAssignmentsSummary(schedule.assignments)
      };

      // Save schedule record to ABASchedules list
      const scheduleResponse = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('ABASchedules')/items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': await this.getRequestDigest()
          },
          body: JSON.stringify(scheduleData)
        }
      );

      if (!scheduleResponse.ok) {
        const errorText = await scheduleResponse.text();
        console.error('Failed to save schedule metadata:', errorText);
        return false;
      }

      const scheduleResult = await scheduleResponse.json();
      const scheduleId = scheduleResult.d.ID;
      console.log('✅ Schedule metadata saved with ID:', scheduleId);

      // Save individual assignments to ABAAssignments list
      const assignmentPromises = schedule.assignments.map(assignment => 
        this.saveAssignmentToHistory(assignment, scheduleId)
      );

      const assignmentResults = await Promise.allSettled(assignmentPromises);
      const successfulAssignments = assignmentResults.filter(result => result.status === 'fulfilled');
      const failedAssignments = assignmentResults.filter(result => result.status === 'rejected');

      console.log(`✅ Saved ${successfulAssignments.length} assignments, ${failedAssignments.length} failed`);

      if (failedAssignments.length > 0) {
        console.warn('Some assignments failed to save:', failedAssignments);
      }

      return true;
    } catch (error) {
      console.error('Error saving schedule:', error);
      return false;
    }
  }

  generateAssignmentsSummary(assignments) {
    const summary = {
      totalAssignments: assignments.length,
      byProgram: {},
      bySession: {},
      staffCount: new Set(assignments.map(a => a.staffId)).size,
      studentCount: new Set(assignments.map(a => a.studentId)).size
    };

    assignments.forEach(assignment => {
      // Count by program
      summary.byProgram[assignment.program] = (summary.byProgram[assignment.program] || 0) + 1;
      
      // Count by session
      summary.bySession[assignment.session] = (summary.bySession[assignment.session] || 0) + 1;
    });

    return JSON.stringify(summary);
  }

  async saveAssignmentToHistory(assignment, scheduleId) {
    try {
      const assignmentData = {
        ScheduleID: scheduleId,
        ScheduleDate: assignment.date || new Date().toISOString().split('T')[0],
        StaffID: assignment.staffId,
        StudentID: assignment.studentId,
        Session: assignment.session,
        Program: assignment.program,
        AssignmentType: assignment.type || 'Standard',
        CreatedDate: new Date().toISOString(),
        IsLocked: assignment.isLocked || false
      };

      console.log('💾 Saving assignment to ABAAssignments list:', assignmentData);

      const response = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('ABAAssignments')/items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': await this.getRequestDigest()
          },
          body: JSON.stringify(assignmentData)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to save assignment to ABAAssignments list:', response.status, errorText);
        return { success: false, assignment, error: errorText };
      }

      const result = await response.json();
      console.log('✅ Assignment saved successfully, ID:', result.d.ID);
      return { success: true, id: result.d.ID, assignment };
    } catch (error) {
      console.error('❌ Error saving assignment:', error);
      return { success: false, assignment, error: error.message };
    }
  }

  // Method to load schedule history for rule checking
  async getScheduleHistory(staffId, studentId, days = 7) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot load schedule history - not authenticated');
        return [];
      }

      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      const filter = `StaffID eq ${staffId} and StudentID eq ${studentId} and ScheduleDate ge '${startDate.toISOString().split('T')[0]}' and ScheduleDate le '${endDate.toISOString().split('T')[0]}'`;
      
      const response = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('ABAAssignments')/items?$filter=${encodeURIComponent(filter)}&$orderby=ScheduleDate desc`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json;odata=verbose'
          }
        }
      );

      if (!response.ok) {
        console.error('Failed to load schedule history');
        return [];
      }

      const data = await response.json();
      return data.d.results.map(item => ({
        date: item.ScheduleDate,
        staffId: item.StaffID,
        studentId: item.StudentID,
        session: item.Session,
        program: item.Program
      }));
    } catch (error) {
      console.error('Error loading schedule history:', error);
      return [];
    }
  }

  // Method to check consecutive days rule
  async checkConsecutiveDaysRule(staffId, studentId, maxDays = 3) {
    try {
      const history = await this.getScheduleHistory(staffId, studentId, maxDays + 2);
      
      if (history.length === 0) return { allowed: true, consecutiveDays: 0 };

      // Sort by date and check for consecutive days
      const sortedHistory = history.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let consecutiveDays = 0;
      let currentStreak = 0;
      const today = new Date().toISOString().split('T')[0];
      
      for (let i = sortedHistory.length - 1; i >= 0; i--) {
        const historyDate = sortedHistory[i].date;
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - (consecutiveDays + 1));
        
        if (historyDate === expectedDate.toISOString().split('T')[0]) {
          consecutiveDays++;
        } else {
          break;
        }
      }

      return {
        allowed: consecutiveDays < maxDays,
        consecutiveDays,
        message: consecutiveDays >= maxDays ? 
          `${staffId} has worked with ${studentId} for ${consecutiveDays} consecutive days. Consider assigning different staff.` : 
          null
      };
    } catch (error) {
      console.error('Error checking consecutive days rule:', error);
      return { allowed: true, consecutiveDays: 0, error: error.message };
    }
  }
}