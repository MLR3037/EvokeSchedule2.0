import { Staff, Student, Assignment, Schedule, PROGRAMS } from '../types/index.js';
import { PublicClientApplication } from '@azure/msal-browser';

/**
 * SharePoint REST API integration service with MSAL authentication
 * For external hosting (GitHub Pages, etc.)
 */
export class SharePointService {
  constructor(config) {
    console.log('🔧 SharePointService constructor received config:', config);
    
    this.config = {
      siteUrl: config?.siteUrl || 'https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators',
      staffListName: config?.staffListName || 'Staff',
      studentsListName: config?.studentsListName || 'Clients',
      scheduleListName: config?.scheduleListName || 'ScheduleHistory',
      clientId: config?.clientId,
      tenantId: config?.tenantId,
      redirectUri: config?.redirectUri
    };
    
    console.log('🔧 SharePointService final config:', this.config);
    
    // Set up direct property access for commonly used config values
    this.siteUrl = this.config.siteUrl;
    
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
    
    // Enhanced error handling
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    
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
   * Check if user is currently authenticated
   */
  isAuthenticated() {
    return !!(this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry);
  }

  /**
   * Retry SharePoint API calls with exponential backoff
   */
  async retryFetch(url, options, retries = this.maxRetries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 API call attempt ${attempt + 1}/${retries + 1}: ${url}`);
        
        const response = await fetch(url, options);
        
        // If successful or client error (4xx), don't retry
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }
        
        // Server error (5xx), retry if attempts remaining
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.log(`⏳ Retrying in ${delay}ms due to server error: ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return response;
      } catch (error) {
        console.error(`❌ API call attempt ${attempt + 1} failed:`, error.message);
        
        // If it's a network error and we have retries left
        if (attempt < retries && (error.name === 'TypeError' || error.message.includes('fetch'))) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.log(`⏳ Retrying in ${delay}ms due to network error`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
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
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please make sure you are logged in and have access to this SharePoint site.');
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
        `$select=Id,StaffPerson/Id,StaffPerson/Title,StaffPerson/EMail,Role,PrimaryProgram,SecondaryProgram,IsActive,AbsentAM,AbsentPM,AbsentFullDay,OutOfSessionAM,OutOfSessionPM,OutOfSessionFullDay&` +
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
          listItemId: item.Id, // List item ID for updating this record
          name: staffName,
          role: item.Role || 'RBT',
          email: staffEmail,
          primaryProgram: item.PrimaryProgram === true,
          secondaryProgram: item.SecondaryProgram === true,
          isActive: item.IsActive !== false,
          absentAM: item.AbsentAM === true,
          absentPM: item.AbsentPM === true,
          absentFullDay: item.AbsentFullDay === true,
          outOfSessionAM: item.OutOfSessionAM === true,
          outOfSessionPM: item.OutOfSessionPM === true,
          outOfSessionFullDay: item.OutOfSessionFullDay === true
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
   * Load client team members from the ClientTeamMembers list
   */
  async loadClientTeamMembers() {
    try {
      console.log('🔍 Loading client team members from ClientTeamMembers list...');

      const headers = await this.getHeaders();
      
      // Load all active team member assignments
      // Client is a Lookup field, so we need to expand it
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('ClientTeamMembers')/items?` +
        `$select=Id,Client/Id,Client/Title,StaffMember/Id,StaffMember/Title,StaffMember/EMail,TrainingStatus,IsActive,DateAdded&` +
        `$expand=Client,StaffMember&` +
        `$filter=IsActive eq true&` +
        `$top=5000`;

      console.log('📋 Fetching team members from:', url);

      const response = await this.makeRequest(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SharePoint ClientTeamMembers API Error:', response.status, errorText);
        
        // If the list doesn't exist, return null (not empty object) to signal fallback to legacy
        if (response.status === 404) {
          console.warn('⚠️ ClientTeamMembers list not found - using legacy Team field instead');
          return null; // ✅ CHANGED: Return null instead of empty object
        }
        
        throw new Error(`Failed to load client team members: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const teamMembers = data.d.results || [];
      console.log(`✅ Found ${teamMembers.length} client team member assignments`);

      // Group by client ID for easier lookup
      const teamsByClient = {};
      teamMembers.forEach(item => {
        if (item.Client) {
          const clientId = item.Client.Id;
          if (!teamsByClient[clientId]) {
            teamsByClient[clientId] = [];
          }
          
          if (item.StaffMember) {
            teamsByClient[clientId].push({
              id: item.StaffMember.Id,
              title: item.StaffMember.Title,
              name: item.StaffMember.Title,
              email: item.StaffMember.EMail || '',
              trainingStatus: item.TrainingStatus || 'solo'
            });
          }
        }
      });

      console.log('📊 Team members grouped by client:', Object.keys(teamsByClient).length, 'clients have teams');
      return teamsByClient;

    } catch (error) {
      console.error('❌ Error loading client team members:', error);
      return null; // ✅ CHANGED: Return null instead of empty object to signal fallback
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
        `$select=Id,Title,Program,RatioAM,RatioPM,IsActive,PairedWith,Team/Id,Team/Title,Team/EMail,AbsentAM,AbsentPM,AbsentFullDay,TeamTrainingStatus&` +
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

      // Load team members from new ClientTeamMembers list
      const teamsByClient = await this.loadClientTeamMembers();

      return this.parseStudents(studentItems, teamsByClient);

    } catch (error) {
      console.error('❌ Error loading students:', error);
      throw error;
    }
  }

  /**
   * Parse student items from SharePoint response
   */
  parseStudents(studentItems, teamsByClient = null) {
    console.log(`🔍 Parsing ${studentItems.length} students`);
    
    // ✅ NEW: Check if ClientTeamMembers list exists (null = doesn't exist, object = exists)
    const useClientTeamMembersList = teamsByClient !== null;
    
    const students = studentItems.map(item => {
      console.log(`🔍 Processing student: ${item.Title}`);
      
      let team = [];
      let teamIds = [];
      let teamTrainingStatus = {};

      // PRIORITY 1: If ClientTeamMembers list exists, use ONLY that data (even if empty)
      if (useClientTeamMembersList) {
        console.log(`  📋 Using ClientTeamMembers list for ${item.Title}`);
        
        // Load team from ClientTeamMembers (may be empty array if no team members)
        team = teamsByClient[item.Id] || [];
        teamIds = team.map(member => member.id);
        
        // Build training status object from team data
        team.forEach(member => {
          teamTrainingStatus[member.id] = member.trainingStatus || 'solo';
        });
        
        if (team.length > 0) {
          console.log(`  ✅ ${item.Title} has ${team.length} team members from ClientTeamMembers list`);
        } else {
          console.log(`  ℹ️ ${item.Title} has no team members in ClientTeamMembers list`);
        }
      }
      // FALLBACK: Use legacy Team field ONLY if ClientTeamMembers list doesn't exist
      else if (item.Team) {
        console.log(`  📋 Using legacy Team field for ${item.Title} (ClientTeamMembers list not available)`);
        
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
        
        // Load training status from JSON field (legacy)
        try {
          teamTrainingStatus = item.TeamTrainingStatus ? JSON.parse(item.TeamTrainingStatus) : {};
        } catch (e) {
          console.warn(`  ⚠️ Failed to parse TeamTrainingStatus for ${item.Title}:`, e);
          teamTrainingStatus = {};
        }
        
        console.log(`  ✅ ${item.Title} has ${team.length} team members from legacy Team field`);
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
        absentFullDay: item.AbsentFullDay === true,
        teamTrainingStatus: teamTrainingStatus
      });

      if (team.length > 0) {
        console.log(`✅ ${item.Title} has ${team.length} team members:`, team.map(t => t.title || t.name));
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
        traineeAssignments: [],
        lockedAssignments: new Set(),
        isFinalized: false 
      });
      
    } catch (error) {
      console.error('Error in loadSchedule:', error);
      return new Schedule({ date, traineeAssignments: [] });
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

      // Use listItemId for updates, fallback to id for backward compatibility
      const itemId = staff.listItemId || staff.id;

      const url = isUpdate 
        ? `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items(${itemId})`
        : `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items`;

      const body = {
        __metadata: { type: 'SP.Data.StaffListItem' },
        // Only update editable fields - StaffPerson is a Person/Group field that can't be modified this way
        // Title and Email are read-only as they come from StaffPerson
        Role: staff.role,
        PrimaryProgram: staff.primaryProgram,
        SecondaryProgram: staff.secondaryProgram,
        IsActive: staff.isActive,
        AbsentAM: staff.absentAM || false,
        AbsentPM: staff.absentPM || false,
        AbsentFullDay: staff.absentFullDay || false,
        OutOfSessionAM: staff.outOfSessionAM || false,
        OutOfSessionPM: staff.outOfSessionPM || false,
        OutOfSessionFullDay: staff.outOfSessionFullDay || false
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

  /**
   * Save client team member to ClientTeamMembers list
   * This replaces the need to save team data as JSON
   */
  async saveClientTeamMember(clientId, clientName, staffMember, trainingStatus = 'solo', isUpdate = false, itemId = null) {
    try {
      const headers = await this.getHeaders(true);
      
      if (isUpdate && itemId) {
        headers['X-HTTP-Method'] = 'MERGE';
        headers['If-Match'] = '*';
      }

      const url = isUpdate && itemId
        ? `${this.config.siteUrl}/_api/web/lists/getbytitle('ClientTeamMembers')/items(${itemId})`
        : `${this.config.siteUrl}/_api/web/lists/getbytitle('ClientTeamMembers')/items`;

      const body = {
        __metadata: { type: 'SP.Data.ClientTeamMembersListItem' },
        Title: `${clientName} - ${staffMember.name}`, // Use Title field for easy identification
        ClientId: clientId, // Lookup field - use "Id" suffix
        StaffMemberId: staffMember.id, // Person picker field
        TrainingStatus: trainingStatus,
        IsActive: true,
        DateAdded: new Date().toISOString()
      };

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to save team member: ${response.status}`, errorText);
        throw new Error(`Failed to save team member: ${response.status}`);
      }

      console.log(`✅ Team member saved: ${staffMember.name} → ${clientName} (${trainingStatus})`);
      return true;
    } catch (error) {
      console.error('Error saving client team member:', error);
      throw error;
    }
  }

  /**
   * Delete a client team member from ClientTeamMembers list
   */
  async deleteClientTeamMember(itemId) {
    try {
      const headers = await this.getHeaders(true);
      headers['X-HTTP-Method'] = 'DELETE';
      headers['If-Match'] = '*';

      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('ClientTeamMembers')/items(${itemId})`;

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to delete team member: ${response.status}`);
      }

      console.log(`✅ Team member deleted: ${itemId}`);
      return true;
    } catch (error) {
      console.error('Error deleting client team member:', error);
      throw error;
    }
  }

  /**
   * Sync student team to ClientTeamMembers list
   * This is called when saving a student from the React app
   */
  async syncStudentTeamToList(student) {
    try {
      console.log(`🔄 Syncing team for ${student.name} to ClientTeamMembers list...`);
      
      // First, get existing team members from the list
      const headers = await this.getHeaders();
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('ClientTeamMembers')/items?` +
        `$filter=Client/Id eq ${student.id} and IsActive eq true&` +
        `$select=Id,Client/Id,StaffMember/Id&` +
        `$expand=Client,StaffMember`;

      const response = await this.makeRequest(url, { headers });
      
      let existingMembers = [];
      if (response.ok) {
        const data = await response.json();
        existingMembers = data.d.results || [];
        console.log(`  Found ${existingMembers.length} existing team members in list`);
      } else {
        console.warn('  ClientTeamMembers list may not exist - skipping sync');
        return false;
      }

      // Determine what to add and what to remove
      const existingStaffIds = existingMembers.map(m => m.StaffMember?.Id).filter(Boolean);
      const newStaffIds = student.teamIds;

      const toAdd = newStaffIds.filter(id => !existingStaffIds.includes(id));
      const toRemove = existingMembers.filter(m => !newStaffIds.includes(m.StaffMember?.Id));

      console.log(`  To add: ${toAdd.length}, To remove: ${toRemove.length}`);

      // Remove team members that are no longer in the team
      for (const member of toRemove) {
        await this.deleteClientTeamMember(member.Id);
      }

      // Add new team members
      for (const staffId of toAdd) {
        const staffMember = student.team.find(t => t.id === staffId);
        if (staffMember) {
          const trainingStatus = student.getStaffTrainingStatus(staffId);
          await this.saveClientTeamMember(
            student.id,
            student.name,
            staffMember,
            trainingStatus
          );
        }
      }

      // Update training status for existing members
      for (const member of existingMembers) {
        if (newStaffIds.includes(member.StaffMember?.Id)) {
          const trainingStatus = student.getStaffTrainingStatus(member.StaffMember.Id);
          // Only update if training status changed
          // We'd need to load the current status to check, so for now just update all
          await this.saveClientTeamMember(
            student.id,
            student.name,
            { id: member.StaffMember.Id, name: member.StaffMember.Title },
            trainingStatus,
            true,
            member.Id
          );
        }
      }

      console.log(`✅ Team sync complete for ${student.name}`);
      return true;
    } catch (error) {
      console.error('Error syncing student team to list:', error);
      return false;
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

      // Prepare team field for SharePoint People Picker (legacy support)
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
        TeamId: { results: teamResults }, // People Picker field (legacy)
        AbsentAM: student.absentAM || false,
        AbsentPM: student.absentPM || false,
        AbsentFullDay: student.absentFullDay || false,
        TeamTrainingStatus: student.teamTrainingStatus ? JSON.stringify(student.teamTrainingStatus) : '{}' // Legacy fallback
      };

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to save student: ${response.status}`);
      }

      // NEW: Sync team data to ClientTeamMembers list (if it exists)
      // This runs in the background and doesn't fail if the list doesn't exist
      if (isUpdate) {
        this.syncStudentTeamToList(student).catch(err => {
          console.warn('⚠️ Failed to sync team to ClientTeamMembers list:', err.message);
          console.log('  → Falling back to legacy Team field storage');
        });
      }

      return response;
    } catch (error) {
      console.error('Error saving student:', error);
      throw error;
    }
  }

  /**
   * Delete a staff member from SharePoint
   */
  async deleteStaff(staffId) {
    try {
      console.log(`🗑️ Deleting staff member with ID: ${staffId}`);
      
      const headers = await this.getHeaders(true);
      headers['X-HTTP-Method'] = 'DELETE';
      headers['If-Match'] = '*';

      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items(${staffId})`;

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to delete staff: ${response.status}`, errorText);
        throw new Error(`Failed to delete staff: ${response.status}`);
      }

      console.log(`✅ Staff member ${staffId} deleted successfully`);
      return true;
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  }

  /**
   * Delete a student from SharePoint
   */
  async deleteStudent(studentId) {
    try {
      console.log(`🗑️ Deleting student with ID: ${studentId}`);
      
      const headers = await this.getHeaders(true);
      headers['X-HTTP-Method'] = 'DELETE';
      headers['If-Match'] = '*';

      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items(${studentId})`;

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to delete student: ${response.status}`, errorText);
        throw new Error(`Failed to delete student: ${response.status}`);
      }

      console.log(`✅ Student ${studentId} deleted successfully`);
      return true;
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  }

  async saveSchedule(schedule) {
    try {
      console.log('🔐 Checking authentication status...');
      
      if (!this.isAuthenticated()) {
        console.error('❌ Cannot save schedule - not authenticated');
        console.log('🔄 Attempting to re-authenticate...');
        
        // Try to re-authenticate
        const authResult = await this.checkAuthentication();
        if (!authResult) {
          console.error('❌ Re-authentication failed');
          throw new Error('Authentication required - please sign in again');
        }
        console.log('✅ Re-authentication successful');
      }

      console.log('💾 Saving schedule to SharePoint...', schedule.date);

      // Enhanced debugging - First list all available lists
      console.log('🔍 Debugging: Listing all available SharePoint lists...');
      console.log('🌐 Site URL:', this.siteUrl);
      console.log('🔗 Full API URL:', `${this.siteUrl}/_api/web/lists`);
      
      try {
        const allListsResponse = await this.retryFetch(
          `${this.siteUrl}/_api/web/lists`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Accept': 'application/json;odata=verbose'
            }
          }
        );

        if (allListsResponse.ok) {
          const allListsData = await allListsResponse.json();
          console.log('📋 Available lists on site:');
          allListsData.d.results.forEach(list => {
            console.log(`  - ${list.Title} (Internal: ${list.EntityTypeName})`);
          });
          
          // Check if our lists exist in the available lists
          const scheduleHistoryList = allListsData.d.results.find(list => 
            list.Title === 'ScheduleHistory' || list.EntityTypeName === 'ScheduleHistory'
          );
          const dailyAssignmentsList = allListsData.d.results.find(list => 
            list.Title === 'DailyAssignments' || list.EntityTypeName === 'DailyAssignments'
          );

          console.log('� ScheduleHistory found in list:', !!scheduleHistoryList);
          console.log('🔍 DailyAssignments found in list:', !!dailyAssignmentsList);

          if (scheduleHistoryList) {
            console.log('✅ ScheduleHistory list details:', {
              Title: scheduleHistoryList.Title,
              EntityTypeName: scheduleHistoryList.EntityTypeName,
              Id: scheduleHistoryList.Id
            });
          }

          if (dailyAssignmentsList) {
            console.log('✅ DailyAssignments list details:', {
              Title: dailyAssignmentsList.Title,
              EntityTypeName: dailyAssignmentsList.EntityTypeName,
              Id: dailyAssignmentsList.Id
            });
          }          // If both lists exist, continue with save operation
          if (scheduleHistoryList && dailyAssignmentsList) {
            console.log('✅ Both required lists found! Proceeding with schedule save...');
          } else {
            console.log('❌ Required lists not found. Cannot save schedule history.');
            return false;
          }
        } else {
          console.error('❌ Failed to retrieve lists:', allListsResponse.status);
          return false;
        }
      } catch (error) {
        console.error('❌ Error retrieving lists:', error);
        return false;
      }

      // Prepare schedule metadata with proper SharePoint REST API format
      const scheduleData = {
        __metadata: { type: 'SP.Data.ABASchedulesListItem' },
        Title: `Schedule_${schedule.date}`,
        ScheduleDate: schedule.date,
        IsFinalized: schedule.isFinalized || false,
        TotalAssignments: schedule.assignments.length,
        CreatedDate: new Date().toISOString(),
        CreatedBy: this.currentUser?.displayName || 'System',
        LastModified: new Date().toISOString(),
        LastModifiedBy: this.currentUser?.displayName || 'System',
        AssignmentsSummary: this.generateAssignmentsSummary(schedule.assignments),
        TraineeAssignments: schedule.traineeAssignments ? JSON.stringify(schedule.traineeAssignments) : '[]'
      };
      
      console.log('💾 Prepared schedule data for SharePoint:', scheduleData);

      // Save schedule record to ScheduleHistory list
      const scheduleResponse = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('ScheduleHistory')/items`,
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
        __metadata: { type: 'SP.Data.ABAAssignmentsListItem' },
        Title: `Assignment_${assignment.staffId}_${assignment.studentId}_${assignment.session}`,
        ScheduleID: scheduleId,
        ScheduleDate: assignment.date || new Date().toISOString().split('T')[0],
        StaffID: assignment.staffId,
        StaffName: assignment.staffName || '',
        StudentID: assignment.studentId,
        StudentName: assignment.studentName || '',
        Session: assignment.session,
        Program: assignment.program,
        AssignmentType: assignment.type || 'Standard',
        CreatedDate: new Date().toISOString(),
        IsLocked: assignment.isLocked || false
      };

      console.log('💾 Saving assignment to DailyAssignments list:', assignmentData);

      const response = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items`,
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

  /**
   * Save daily attendance records to history list
   * This preserves attendance data before clearing it for the next day
   */
  async saveAttendanceHistory(staff, students, date) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot save attendance history - not authenticated');
        return false;
      }

      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      console.log(`💾 Saving attendance history for ${dateStr}...`);

      const attendanceRecords = [];

      // Create records for absent staff
      staff.forEach(staffMember => {
        if (staffMember.absentAM || staffMember.absentPM || staffMember.absentFullDay) {
          attendanceRecords.push({
            __metadata: { type: 'SP.Data.DailyAttendanceListItem' },
            Title: `${staffMember.name}_${dateStr}`,
            AttendanceDate: dateStr,
            PersonType: 'Staff',
            PersonID: staffMember.id,
            PersonName: staffMember.name,
            AbsentAM: staffMember.absentAM || false,
            AbsentPM: staffMember.absentPM || false,
            AbsentFullDay: staffMember.absentFullDay || false,
            CreatedDate: new Date().toISOString()
          });
        }
      });

      // Create records for absent students
      students.forEach(student => {
        if (student.absentAM || student.absentPM || student.absentFullDay) {
          attendanceRecords.push({
            __metadata: { type: 'SP.Data.DailyAttendanceListItem' },
            Title: `${student.name}_${dateStr}`,
            AttendanceDate: dateStr,
            PersonType: 'Student',
            PersonID: student.id,
            PersonName: student.name,
            AbsentAM: student.absentAM || false,
            AbsentPM: student.absentPM || false,
            AbsentFullDay: student.absentFullDay || false,
            CreatedDate: new Date().toISOString()
          });
        }
      });

      if (attendanceRecords.length === 0) {
        console.log('✅ No absences to save for this date');
        return true;
      }

      console.log(`📝 Saving ${attendanceRecords.length} attendance records...`);

      // Get request digest once
      const digest = await this.getRequestDigest();

      // Save all records
      const savePromises = attendanceRecords.map(record =>
        fetch(
          `${this.siteUrl}/_api/web/lists/getbytitle('DailyAttendance')/items`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Accept': 'application/json;odata=verbose',
              'Content-Type': 'application/json;odata=verbose',
              'X-RequestDigest': digest
            },
            body: JSON.stringify(record)
          }
        ).then(response => {
          if (!response.ok) {
            console.error(`Failed to save attendance record for ${record.PersonName}`);
            return { success: false };
          }
          return { success: true };
        }).catch(error => {
          console.error(`Error saving attendance for ${record.PersonName}:`, error);
          return { success: false };
        })
      );

      const results = await Promise.all(savePromises);
      const successCount = results.filter(r => r.success).length;
      
      console.log(`✅ Saved ${successCount}/${attendanceRecords.length} attendance records`);
      return successCount === attendanceRecords.length;
    } catch (error) {
      console.error('Error saving attendance history:', error);
      return false;
    }
  }

  /**
   * Clear attendance flags for all staff and students in SharePoint
   * Should be called after saving attendance history
   */
  async clearAllAttendanceInSharePoint(staff, students) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot clear attendance - not authenticated');
        return false;
      }

      console.log('🧹 Clearing attendance flags in SharePoint for ALL staff and students...');

      const clearPromises = [
        // Clear ALL staff attendance (not just those currently marked absent)
        ...staff.map(async (staffMember) => {
          const clearedStaff = new Staff({
            ...staffMember,
            absentAM: false,
            absentPM: false,
            absentFullDay: false
          });
          return this.saveStaff(clearedStaff, true).catch(err => {
            console.error(`Failed to clear attendance for staff ${staffMember.name}:`, err);
            return { success: false };
          });
        }),
        // Clear ALL student attendance (not just those currently marked absent)
        ...students.map(async (student) => {
          const clearedStudent = new Student({
            ...student,
            absentAM: false,
            absentPM: false,
            absentFullDay: false
          });
          return this.saveStudent(clearedStudent, true).catch(err => {
            console.error(`Failed to clear attendance for student ${student.name}:`, err);
            return { success: false };
          });
        })
      ];

      await Promise.all(clearPromises);
      console.log('✅ Attendance cleared in SharePoint for', staff.length, 'staff and', students.length, 'students');
      return true;
    } catch (error) {
      console.error('Error clearing attendance in SharePoint:', error);
      return false;
    }
  }
}