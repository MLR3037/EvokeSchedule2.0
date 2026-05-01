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
    
    // Cache for team members data to avoid repeated API calls
    this.teamMembersCache = null;
    this.teamMembersCacheExpiry = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
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
      
      // Staff list uses Person/Group field, so we need to expand it.
      // New partial-day time columns may not exist in every environment yet,
      // so we try the extended select first, then fall back to legacy fields.
      const extendedSelect = 'Id,StaffPerson/Id,StaffPerson/Title,StaffPerson/EMail,Role,PrimaryProgram,SecondaryProgram,IsActive,AbsentAM,AbsentPM,AbsentFullDay,AbsentAMArrivalTime,AbsentPMDepartureTime,OutOfSessionAM,OutOfSessionPM,OutOfSessionFullDay';
      const legacySelect = 'Id,StaffPerson/Id,StaffPerson/Title,StaffPerson/EMail,Role,PrimaryProgram,SecondaryProgram,IsActive,AbsentAM,AbsentPM,AbsentFullDay,OutOfSessionAM,OutOfSessionPM,OutOfSessionFullDay';
      const makeUrl = (selectFields) => `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items?` +
        `$select=${selectFields}&` +
        `$expand=StaffPerson&` +
        `$top=5000`;

      let url = makeUrl(extendedSelect);
      console.log('📋 Fetching staff from:', url);

      let response = await this.makeRequest(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        const missingNewColumns = /AbsentAMArrivalTime|AbsentPMDepartureTime|does not exist/i.test(errorText);
        if (missingNewColumns) {
          console.warn('⚠️ Staff time columns not found; retrying with legacy staff fields.');
          url = makeUrl(legacySelect);
          response = await this.makeRequest(url, { headers });
        } else {
          console.error('SharePoint Staff API Error:', response.status, errorText);
          throw new Error(`Failed to load staff: ${response.status} - ${errorText}`);
        }
      }

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
          absentAMArrivalTime: item.AbsentAMArrivalTime || '',
          absentPMDepartureTime: item.AbsentPMDepartureTime || '',
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
   * Normalize training status from SharePoint to match app constants
   * SharePoint stores: "Solo", "Trainer", "Overlap BCBA", "Overlap Staff"
   * App expects: "solo", "trainer", "overlap-bcba", "overlap-staff"
   */
  normalizeTrainingStatus(spValue) {
    if (!spValue) {
      console.warn(`⚠️ Training status is empty/null - defaulting to 'solo'. This may cause staff in training to be incorrectly assigned!`);
      return 'solo';
    }
    
    const normalized = spValue.toLowerCase().trim();
    
    // Map SharePoint values to app constants
    const mappings = {
      'solo': 'solo',
      'trainer': 'trainer',
      'overlap bcba': 'overlap-bcba',
      'overlap staff': 'overlap-staff',
      'overlap-bcba': 'overlap-bcba',
      'overlap-staff': 'overlap-staff'
    };
    
    const result = mappings[normalized];
    if (!result) {
      console.warn(`⚠️ Unknown training status '${spValue}' - defaulting to 'solo'. This may cause issues!`);
      return 'solo';
    }
    
    return result;
  }

  /**
   * Convert app training status to SharePoint format
   * App uses: "solo", "trainer", "overlap-bcba", "overlap-staff"
   * SharePoint needs: "Solo", "Trainer", "Overlap BCBA", "Overlap Staff"
   */
  toSharePointTrainingStatus(appValue) {
    const mappings = {
      'solo': 'Solo',
      'trainer': 'Trainer',
      'overlap-bcba': 'Overlap BCBA',
      'overlap-staff': 'Overlap Staff'
    };
    
    return mappings[appValue] || 'Solo';
  }

  /**
   * Load client team members from the ClientTeamMembers list
   * Uses caching to improve performance
   */
  async loadClientTeamMembers(forceRefresh = false) {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh && this.teamMembersCache && this.teamMembersCacheExpiry && Date.now() < this.teamMembersCacheExpiry) {
        console.log('📦 Using cached team members data');
        return this.teamMembersCache;
      }
      
      console.log('🔍 Loading client team members from ClientTeamMembers list...');

      const headers = await this.getHeaders();
      
      // Optimize: Only load essential fields
      // For Lookup fields: Use ClientId to get the ID value directly (no expand needed)
      // For Person fields: Expand StaffMember to get full details
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('ClientTeamMembers')/items?` +
        `$select=ClientId,StaffMember/Id,StaffMember/Title,StaffMember/EMail,TrainingStatus&` +
        `$expand=StaffMember&` +
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
        // For Lookup fields, SharePoint returns the ID as ClientId (not Client.Id)
        if (item.ClientId && item.StaffMember) {
          const clientId = item.ClientId;
          if (!teamsByClient[clientId]) {
            teamsByClient[clientId] = [];
          }
          
          // Log raw SharePoint training status value for debugging
          console.log(`  📋 Staff ${item.StaffMember.Title} (ID: ${item.StaffMember.Id}) for Client ${clientId}: TrainingStatus = '${item.TrainingStatus}'`);
          
          teamsByClient[clientId].push({
            id: item.StaffMember.Id,
            title: item.StaffMember.Title,
            name: item.StaffMember.Title,
            email: item.StaffMember.EMail || '',
            trainingStatus: this.normalizeTrainingStatus(item.TrainingStatus)
          });
        }
      });

      console.log('📊 Team members grouped by client:', Object.keys(teamsByClient).length, 'clients have teams');
      console.log('📊 Client IDs with teams:', Object.keys(teamsByClient).sort((a, b) => a - b).join(', '));
      
      // Cache the result
      this.teamMembersCache = teamsByClient;
      this.teamMembersCacheExpiry = Date.now() + this.CACHE_DURATION;
      
      return teamsByClient;

    } catch (error) {
      console.error('❌ Error loading client team members:', error);
      return null; // Return null to signal fallback to legacy method
    }
  }
  
  /**
   * Clear the team members cache
   * Call this after updating team data to force a refresh
   */
  clearTeamMembersCache() {
    this.teamMembersCache = null;
    this.teamMembersCacheExpiry = null;
    console.log('🧹 Team members cache cleared');
  }

  /**
   * Load student data using SharePoint REST API
   */
  async loadStudents() {
    try {
      console.log('🔍 Loading students from SharePoint REST API...');

      const headers = await this.getHeaders();
      
      // Load students WITHOUT Team field (now using ClientTeamMembers list instead)
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items?` +
        `$select=Id,Title,Program,RatioAM,RatioPM,IsActive,PairedWith,AbsentAM,AbsentPM,AbsentFullDay,ScheduledMonday,ScheduledTuesday,ScheduledWednesday,ScheduledThursday,ScheduledFriday,AMStartTime,AMEndTime,PMStartTime,PMEndTime&` +
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
    
    // Check if ClientTeamMembers list exists (null = doesn't exist, object = exists)
    const useClientTeamMembersList = teamsByClient !== null;
    
    const students = studentItems.map(item => {
      console.log(`🔍 Processing student: ${item.Title}`);
      
      let team = [];
      let teamIds = [];
      let teamTrainingStatus = {};

      // Load team from ClientTeamMembers list (should always exist now)
      if (useClientTeamMembersList) {
        console.log(`  📋 Using ClientTeamMembers list for ${item.Title} (ID: ${item.Id})`);
        
        // Load team from ClientTeamMembers (may be empty array if no team members)
        team = teamsByClient[item.Id] || [];
        teamIds = team.map(member => member.id);
        
        // Build training status object from team data
        team.forEach(member => {
          const status = member.trainingStatus || 'solo';
          teamTrainingStatus[member.id] = status;
          
          // Log when defaulting to 'solo' for missing training status
          if (!member.trainingStatus) {
            console.warn(`  ⚠️ ${member.name} (ID: ${member.id}) on ${item.Title}'s team has NO training status - defaulting to 'solo'`);
          } else {
            console.log(`  ✅ ${member.name} (ID: ${member.id}) training status: ${status}`);
          }
        });
        
        if (team.length > 0) {
          console.log(`  ✅ ${item.Title} (ID: ${item.Id}) has ${team.length} team members from ClientTeamMembers list`);
        } else {
          console.log(`  ⚠️ ${item.Title} (ID: ${item.Id}) has no team members in ClientTeamMembers list`);
        }
      }
      // ERROR: ClientTeamMembers list doesn't exist!
      else {
        console.error(`  ❌ ClientTeamMembers list not found! Cannot load team data for ${item.Title}.`);
        console.error(`  ❌ Please ensure the ClientTeamMembers SharePoint list exists.`);
      }

      const normalizedName = typeof item.Title === 'string' && item.Title.trim().length > 0
        ? item.Title.trim()
        : `Client ${item.Id}`;
      const normalizedProgram = item.Program === PROGRAMS.SECONDARY ? PROGRAMS.SECONDARY : PROGRAMS.PRIMARY;
      const normalizedRatioAM = ['1:1', '2:1', '1:2'].includes(item.RatioAM) ? item.RatioAM : '1:1';
      const normalizedRatioPM = ['1:1', '2:1', '1:2'].includes(item.RatioPM) ? item.RatioPM : '1:1';
      const normalizedPairedWith = Number.isFinite(Number(item.PairedWith)) ? Number(item.PairedWith) : null;

      const student = new Student({
        id: item.Id,
        name: normalizedName,
        program: normalizedProgram,
        ratioAM: normalizedRatioAM,
        ratioPM: normalizedRatioPM,
        isActive: item.IsActive !== false,
        team: team,
        teamIds: teamIds,
        pairedWith: normalizedPairedWith,
        absentAM: item.AbsentAM === true,
        absentPM: item.AbsentPM === true,
        absentFullDay: item.AbsentFullDay === true,
        teamTrainingStatus: teamTrainingStatus,
        // Days of week schedule (default to true if not set)
        scheduledMonday: item.ScheduledMonday !== false,
        scheduledTuesday: item.ScheduledTuesday !== false,
        scheduledWednesday: item.ScheduledWednesday !== false,
        scheduledThursday: item.ScheduledThursday !== false,
        scheduledFriday: item.ScheduledFriday !== false,
        // Custom schedule times (null if not set = use program defaults)
        amStartTime: item.AMStartTime || null,
        amEndTime: item.AMEndTime || null,
        pmStartTime: item.PMStartTime || null,
        pmEndTime: item.PMEndTime || null
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
      // Format date in LOCAL timezone to avoid UTC conversion issues
      const dateString = typeof date === 'string' 
        ? date 
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      console.log('📅 Loading schedule for date:', dateString);
      console.log('🔍 Date object received:', date);
      console.log('🔍 Date string formatted (local timezone):', dateString);

      // Check authentication
      if (!this.isAuthenticated()) {
        console.error('❌ Cannot load schedule - not authenticated');
        throw new Error('Authentication required');
      }

      // Step 1: Find the schedule record in ScheduleHistory for this date
      const { start: scheduleStart, end: scheduleEnd } = this.getDateRangeForDay(dateString);
      const scheduleUrl = `${this.siteUrl}/_api/web/lists/getbytitle('ScheduleHistory')/items?` +
        `$filter=ScheduleDate ge datetime'${scheduleStart}' and ScheduleDate le datetime'${scheduleEnd}'&` +
        `$orderby=Created desc&` +
        `$top=1`;

      console.log('🔍 Fetching schedule metadata from:', scheduleUrl);
      console.log('🔍 Full request URL:', scheduleUrl);

      const scheduleResponse = await this.retryFetch(scheduleUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json;odata=verbose'
        }
      });

      if (!scheduleResponse.ok) {
        const errorText = await scheduleResponse.text();
        console.warn(`⚠️ No schedule found for ${dateString}`);
        console.warn(`Response status: ${scheduleResponse.status}`);
        console.warn(`Response details:`, errorText);
        return new Schedule({ 
          date: dateString, 
          assignments: [], 
          traineeAssignments: [],
          lockedAssignments: new Set(),
          isFinalized: false 
        });
      }

      const scheduleData = await scheduleResponse.json();
      console.log('📦 Raw schedule data from SharePoint:', scheduleData);
      
      if (!scheduleData.d.results || scheduleData.d.results.length === 0) {
        console.log(`ℹ️ No schedule record found for ${dateString}`);
        return new Schedule({ 
          date: dateString, 
          assignments: [], 
          traineeAssignments: [],
          lockedAssignments: new Set(),
          isFinalized: false 
        });
      }

      const scheduleRecord = scheduleData.d.results[0];
      const scheduleId = scheduleRecord.ID;
      console.log('✅ Found schedule record:', scheduleId, scheduleRecord);

      // Step 2: Load all assignments for this schedule from DailyAssignments
      const assignmentsUrl = `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items?` +
        `$filter=ScheduleID eq ${scheduleId}`;

      console.log('🔍 Fetching assignments from:', assignmentsUrl);

      const assignmentsResponse = await this.retryFetch(assignmentsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json;odata=verbose'
        }
      });

      if (!assignmentsResponse.ok) {
        const errorText = await assignmentsResponse.text();
        console.error('❌ Failed to load assignments');
        console.error(`Response status: ${assignmentsResponse.status}`);
        console.error(`Response details:`, errorText);
        throw new Error(`Failed to load assignments from SharePoint: ${assignmentsResponse.status}`);
      }

      const assignmentsData = await assignmentsResponse.json();
      console.log('📦 Raw assignments data from SharePoint:', assignmentsData);
      const assignmentItems = assignmentsData.d.results || [];

      console.log(`✅ Loaded ${assignmentItems.length} assignments from SharePoint`);

      // Step 3: Convert SharePoint items to Assignment objects
      const assignments = assignmentItems.map(item => {
        const normalizedStaffId = Number.isFinite(Number(item.StaffID)) ? Number(item.StaffID) : item.StaffID;
        const normalizedStudentId = Number.isFinite(Number(item.StudentID)) ? Number(item.StudentID) : item.StudentID;
        const normalizedSession = this.normalizeAssignmentSession(item.Session);
        const normalizedProgram = this.normalizeAssignmentProgram(item.Program);

        return new Assignment({
          id: `${normalizedStaffId}_${normalizedStudentId}_${normalizedSession}_${normalizedProgram}`,
          staffId: normalizedStaffId,
          staffName: item.StaffName,
          studentId: normalizedStudentId,
          studentName: item.StudentName,
          session: normalizedSession,
          program: normalizedProgram,
          date: item.ScheduleDate,
          isLocked: item.IsLocked || false,
          assignedBy: 'loaded',
          isTempStaff: item.IsTempStaff || false // NEW: Load temp staff flag
        });
      });

      // Step 4: Parse trainee assignments if available
      let traineeAssignments = [];
      if (scheduleRecord.traineeAssignments) {
        try {
          traineeAssignments = JSON.parse(scheduleRecord.traineeAssignments);
          console.log(`✅ Loaded ${traineeAssignments.length} trainee assignments`);
        } catch (error) {
          console.warn('⚠️ Failed to parse trainee assignments:', error);
        }
      }

      // Step 5: Create and return the Schedule object
      const schedule = new Schedule({
        date: dateString,
        assignments: assignments,
        traineeAssignments: traineeAssignments,
        lockedAssignments: new Set(),
        isFinalized: scheduleRecord.IsFinalized || false,
        lastModified: scheduleRecord.LastModified,
        lastModifiedBy: scheduleRecord.LastModifiedBy
      });

      console.log('✅ Schedule loaded successfully:', {
        date: dateString,
        assignments: assignments.length,
        traineeAssignments: traineeAssignments.length,
        isFinalized: schedule.isFinalized
      });

      return schedule;
      
    } catch (error) {
      console.error('Error in loadSchedule:', error);
      // Return empty schedule on error
      const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      return new Schedule({ 
        date: dateString, 
        assignments: [], 
        traineeAssignments: [],
        lockedAssignments: new Set(),
        isFinalized: false 
      });
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
        AbsentAMArrivalTime: staff.absentAMArrivalTime || '',
        AbsentPMDepartureTime: staff.absentPMDepartureTime || '',
        OutOfSessionAM: staff.outOfSessionAM || false,
        OutOfSessionPM: staff.outOfSessionPM || false,
        OutOfSessionFullDay: staff.outOfSessionFullDay || false
      };

      let response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const missingNewColumns = /AbsentAMArrivalTime|AbsentPMDepartureTime|does not exist/i.test(errorText);

        if (missingNewColumns) {
          console.warn('⚠️ Staff time columns not found; saving without partial-day time fields.');
          const fallbackBody = { ...body };
          delete fallbackBody.AbsentAMArrivalTime;
          delete fallbackBody.AbsentPMDepartureTime;

          response = await this.makeRequest(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(fallbackBody)
          });
        } else {
          throw new Error(`Failed to save staff: ${response.status} - ${errorText}`);
        }
      }

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
        TrainingStatus: this.toSharePointTrainingStatus(trainingStatus), // Convert to SharePoint format
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
        `$filter=ClientId eq ${student.id}&` +
        `$select=Id,ClientId,StaffMember/Id,StaffMember/Title&` +
        `$expand=StaffMember`;

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
      
      // Clear cache so next load gets fresh data
      this.clearTeamMembersCache();
      
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

      // Team data is now stored in ClientTeamMembers list, not in the Clients list
      const body = {
        __metadata: { type: 'SP.Data.ClientsListItem' },
        Title: student.name,
        Program: student.program,
        RatioAM: student.ratioAM,
        RatioPM: student.ratioPM,
        IsActive: student.isActive,
        AbsentAM: student.absentAM || false,
        AbsentPM: student.absentPM || false,
        AbsentFullDay: student.absentFullDay || false,
        // Days of week schedule
        ScheduledMonday: student.scheduledMonday !== false,
        ScheduledTuesday: student.scheduledTuesday !== false,
        ScheduledWednesday: student.scheduledWednesday !== false,
        ScheduledThursday: student.scheduledThursday !== false,
        ScheduledFriday: student.scheduledFriday !== false
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
      // For new students, we need to get the newly created ID from the response
      let studentToSync = student;
      if (!isUpdate) {
        // Get the newly created student ID from the response
        const responseData = await response.json();
        studentToSync = new Student({
          ...student,
          id: responseData.d.Id
        });
        console.log(`✅ New student created with ID: ${studentToSync.id}`);
      }
      
      // Sync team members to ClientTeamMembers list (for both new and updated students)
      this.syncStudentTeamToList(studentToSync).catch(err => {
        console.warn('⚠️ Failed to sync team to ClientTeamMembers list:', err.message);
        console.log('  → Falling back to legacy Team field storage');
      });

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

  async saveSchedule(schedule, staff = null, students = null) {
    // Cache staff and students for use in saveAttendanceForDate
    this.cachedStaff = staff;
    this.cachedStudents = students;
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
            
            // Store entity type names for use in save operations
            this.scheduleHistoryEntityType = scheduleHistoryList.ListItemEntityTypeFullName;
            this.dailyAssignmentsEntityType = dailyAssignmentsList.ListItemEntityTypeFullName;
            
            console.log('📋 ScheduleHistory EntityType:', this.scheduleHistoryEntityType);
            console.log('📋 DailyAssignments EntityType:', this.dailyAssignmentsEntityType);
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

      // ✅ NEW: Check if schedule already exists for this date
      console.log('🔍 Checking for existing schedule record for', schedule.date);
      const { start: existingStart, end: existingEnd } = this.getDateRangeForDay(schedule.date);
      const existingScheduleUrl = `${this.siteUrl}/_api/web/lists/getbytitle('ScheduleHistory')/items?` +
        `$filter=ScheduleDate ge datetime'${existingStart}' and ScheduleDate le datetime'${existingEnd}'&` +
        `$orderby=Created desc&` +
        `$top=1`;

      const existingScheduleResponse = await this.retryFetch(existingScheduleUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json;odata=verbose'
        }
      });

      let scheduleId = null;
      let isUpdate = false;

      if (existingScheduleResponse.ok) {
        const existingData = await existingScheduleResponse.json();
        if (existingData.d.results && existingData.d.results.length > 0) {
          scheduleId = existingData.d.results[0].ID;
          isUpdate = true;
          console.log('📝 Found existing schedule record, will UPDATE ID:', scheduleId);
          console.log('📝 Existing record details:', {
            Created: existingData.d.results[0].Created,
            Modified: existingData.d.results[0].Modified,
            TotalAssignments: existingData.d.results[0].TotalAssignments
          });
        } else {
          console.log('✨ No existing schedule found - will CREATE new record');
        }
      }

      // Prepare schedule metadata with proper SharePoint REST API format
      const scheduleData = {
        __metadata: { type: this.scheduleHistoryEntityType },
        Title: `Schedule_${schedule.date}`,
        ScheduleDate: schedule.date,
        IsFinalized: schedule.isFinalized || false,
        TotalAssignments: schedule.assignments.length,
        AssignmentsSummary: this.generateAssignmentsSummary(schedule.assignments),
        traineeAssignments: schedule.traineeAssignments ? JSON.stringify(schedule.traineeAssignments) : '[]'
      };
      
      console.log('💾 Prepared schedule data for SharePoint:', scheduleData);

      // Save or update schedule record in ScheduleHistory list
      if (isUpdate) {
        // UPDATE existing record
        const updateResponse = await fetch(
          `${this.siteUrl}/_api/web/lists/getbytitle('ScheduleHistory')/items(${scheduleId})`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Accept': 'application/json;odata=verbose',
              'Content-Type': 'application/json;odata=verbose',
              'X-RequestDigest': await this.getRequestDigest(),
              'X-HTTP-Method': 'MERGE',
              'If-Match': '*'
            },
            body: JSON.stringify(scheduleData)
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('Failed to update schedule metadata:', errorText);
          return false;
        }

        console.log('✅ Schedule metadata UPDATED for ID:', scheduleId);
        console.log('✅ Check the "Modified" column in ScheduleHistory to see the update timestamp');
      } else {
        // CREATE new record
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
        scheduleId = scheduleResult.d.ID;
        console.log('✅ Schedule metadata saved with ID:', scheduleId);
      }

      // Synchronize DailyAssignments in-place so we don't delete everything up front.
      // This prevents data loss when only some writes fail.
      const cleanupResult = await this.cleanupAssignmentsForDate(schedule.date, scheduleId);
      if (!cleanupResult.success) {
        console.error('❌ Pre-sync assignment cleanup failed; schedule save aborted.');
        return false;
      }

      const assignmentSyncResult = await this.syncAssignmentsForSchedule(
        scheduleId,
        schedule.assignments,
        schedule.date
      );

      if (!assignmentSyncResult.success) {
        console.error('❌ Assignment sync failed; schedule save aborted to avoid partial state.');
        return false;
      }

      console.log(
        `✅ Assignment sync complete (created: ${assignmentSyncResult.created}, ` +
        `updated: ${assignmentSyncResult.updated}, deleted: ${assignmentSyncResult.deleted})`
      );

      // ✅ NEW: Save attendance data to DailyAttendance
      // Note: This will save whatever attendance state is currently in SharePoint
      // The actual attendance state should be passed from App.js during save
      console.log('💾 Saving attendance data for', schedule.date);
      await this.saveAttendanceForDate(schedule.date, this.cachedStaff, this.cachedStudents);

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

  async saveAssignmentToHistory(assignment, scheduleId, scheduleDate) {
    try {
      const normalizedSession = this.normalizeAssignmentSession(assignment.session);
      const normalizedProgram = this.normalizeAssignmentProgram(assignment.program);

      const assignmentData = {
        __metadata: { type: this.dailyAssignmentsEntityType || 'SP.Data.DailyAssignmentsListItem' },
        Title: `Assignment_${assignment.staffId}_${assignment.studentId}_${normalizedSession}`,
        ScheduleID: scheduleId,
        ScheduleDate: scheduleDate,
        StaffID: assignment.staffId,
        StaffName: assignment.staffName || '',
        StudentID: assignment.studentId,
        StudentName: assignment.studentName || '',
        Session: normalizedSession,
        Program: normalizedProgram,
        AssignmentType: assignment.type || 'Standard',
        IsLocked: assignment.isLocked || false,
        IsTempStaff: assignment.isTempStaff || false // NEW: Save temp staff flag
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
        console.error('❌ Failed to save assignment to DailyAssignments list:', response.status, errorText);
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

  async updateAssignmentInHistory(itemId, assignment, scheduleId, scheduleDate) {
    try {
      const normalizedSession = this.normalizeAssignmentSession(assignment.session);
      const normalizedProgram = this.normalizeAssignmentProgram(assignment.program);

      const assignmentData = {
        __metadata: { type: this.dailyAssignmentsEntityType || 'SP.Data.DailyAssignmentsListItem' },
        Title: `Assignment_${assignment.staffId}_${assignment.studentId}_${normalizedSession}`,
        ScheduleID: scheduleId,
        ScheduleDate: scheduleDate,
        StaffID: assignment.staffId,
        StaffName: assignment.staffName || '',
        StudentID: assignment.studentId,
        StudentName: assignment.studentName || '',
        Session: normalizedSession,
        Program: normalizedProgram,
        AssignmentType: assignment.type || 'Standard',
        IsLocked: assignment.isLocked || false,
        IsTempStaff: assignment.isTempStaff || false
      };

      const response = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items(${itemId})`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': await this.getRequestDigest(),
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*'
          },
          body: JSON.stringify(assignmentData)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to update assignment ${itemId}:`, response.status, errorText);
        return { success: false, assignment, error: errorText };
      }

      return { success: true, id: itemId, assignment };
    } catch (error) {
      console.error(`❌ Error updating assignment ${itemId}:`, error);
      return { success: false, assignment, error: error.message };
    }
  }

  async deleteAssignmentById(itemId) {
    try {
      const response = await fetch(
        `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items(${itemId})`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-RequestDigest': await this.getRequestDigest(),
            'X-HTTP-Method': 'DELETE',
            'If-Match': '*'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to delete assignment ${itemId}:`, response.status, errorText);
        return { success: false, id: itemId, error: errorText };
      }

      return { success: true, id: itemId };
    } catch (error) {
      console.error(`❌ Error deleting assignment ${itemId}:`, error);
      return { success: false, id: itemId, error: error.message };
    }
  }

  normalizeAssignmentId(id) {
    const numericId = Number(id);
    if (Number.isFinite(numericId)) {
      return String(numericId);
    }

    return String(id || '').trim();
  }

  normalizeAssignmentSession(session) {
    return String(session || '').trim().toUpperCase();
  }

  normalizeAssignmentProgram(program) {
    const normalized = String(program || '').trim().toLowerCase();
    if (normalized === 'primary') {
      return 'Primary';
    }
    if (normalized === 'secondary') {
      return 'Secondary';
    }

    return String(program || '').trim();
  }

  getDateRangeForDay(date) {
    const dateStr = typeof date === 'string'
      ? date
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
      start: `${dateStr}T00:00:00`,
      end: `${dateStr}T23:59:59`,
      dateStr
    };
  }

  buildAssignmentSyncKey(data) {
    const staffId = this.normalizeAssignmentId(data.staffId);
    const studentId = this.normalizeAssignmentId(data.studentId);
    const session = this.normalizeAssignmentSession(data.session);
    const program = this.normalizeAssignmentProgram(data.program);

    return `${staffId}__${studentId}__${session}__${program}`;
  }

  async loadAssignmentsForDate(scheduleDate) {
    const { start, end } = this.getDateRangeForDay(scheduleDate);

    const assignmentsUrl = `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items?` +
      `$filter=ScheduleDate ge datetime'${start}' and ScheduleDate le datetime'${end}'&` +
      `$select=ID,ScheduleID,ScheduleDate,StaffID,StaffName,StudentID,StudentName,Session,Program,AssignmentType,IsLocked,IsTempStaff`;

    const response = await this.retryFetch(assignmentsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json;odata=verbose'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load assignments for date ${scheduleDate}: ${response.status}`);
    }

    const data = await response.json();
    return data.d.results || [];
  }

  async cleanupAssignmentsForDate(scheduleDate, keepScheduleId) {
    try {
      const rows = await this.loadAssignmentsForDate(scheduleDate);
      if (rows.length === 0) {
        return { success: true, deleted: 0 };
      }

      // Keep only rows for the active schedule ID, and dedupe by assignment key within that schedule.
      const toDelete = [];
      const seenKeys = new Set();

      rows.forEach(row => {
        if (Number(row.ScheduleID) !== Number(keepScheduleId)) {
          toDelete.push(row.ID);
          return;
        }

        const key = this.buildAssignmentSyncKey({
          staffId: row.StaffID,
          studentId: row.StudentID,
          session: row.Session,
          program: row.Program
        });

        if (seenKeys.has(key)) {
          toDelete.push(row.ID);
          return;
        }

        seenKeys.add(key);
      });

      if (toDelete.length === 0) {
        return { success: true, deleted: 0 };
      }

      const deleteResults = await Promise.all(toDelete.map(itemId => this.deleteAssignmentById(itemId)));
      const failedDeletes = deleteResults.filter(r => !r.success);

      if (failedDeletes.length > 0) {
        console.error('❌ Failed to cleanup some assignment duplicates/legacy rows:', failedDeletes);
        return {
          success: false,
          deleted: deleteResults.filter(r => r.success).length,
          failedDeletes
        };
      }

      return { success: true, deleted: deleteResults.length };
    } catch (error) {
      console.error('❌ Error in cleanupAssignmentsForDate:', error);
      return { success: false, deleted: 0, failedDeletes: [{ error: error.message }] };
    }
  }

  async loadAssignmentsForSchedule(scheduleId) {
    const assignmentsUrl = `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items?` +
      `$filter=ScheduleID eq ${scheduleId}&` +
      `$select=ID,ScheduleID,ScheduleDate,StaffID,StaffName,StudentID,StudentName,Session,Program,AssignmentType,IsLocked,IsTempStaff`;

    const response = await this.retryFetch(assignmentsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json;odata=verbose'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load existing assignments for schedule ${scheduleId}: ${response.status}`);
    }

    const data = await response.json();
    return data.d.results || [];
  }

  async syncAssignmentsForSchedule(scheduleId, assignments, scheduleDate) {
    try {
      const existingItems = await this.loadAssignmentsForSchedule(scheduleId);

      const existingByKey = new Map();
      const duplicateExistingIds = [];
      existingItems.forEach(item => {
        const key = this.buildAssignmentSyncKey({
          staffId: item.StaffID,
          studentId: item.StudentID,
          session: item.Session,
          program: item.Program
        });
        if (!existingByKey.has(key)) {
          existingByKey.set(key, item);
        } else {
          duplicateExistingIds.push(item.ID);
        }
      });

      const desiredByKey = new Map();
      assignments.forEach(assignment => {
        const key = this.buildAssignmentSyncKey(assignment);
        if (!desiredByKey.has(key)) {
          desiredByKey.set(key, assignment);
        } else {
          console.warn(`⚠️ Duplicate assignment key in schedule payload ignored: ${key}`);
        }
      });

      const toCreate = [];
      const toUpdate = [];
      const toDelete = [];

      desiredByKey.forEach((assignment, key) => {
        const existing = existingByKey.get(key);
        if (!existing) {
          toCreate.push(assignment);
          return;
        }

        const needsUpdate =
          (existing.StaffName || '') !== (assignment.staffName || '') ||
          (existing.StudentName || '') !== (assignment.studentName || '') ||
          (existing.AssignmentType || 'Standard') !== (assignment.type || 'Standard') ||
          !!existing.IsLocked !== !!assignment.isLocked ||
          !!existing.IsTempStaff !== !!assignment.isTempStaff;

        if (needsUpdate) {
          toUpdate.push({ itemId: existing.ID, assignment });
        }
      });

      existingByKey.forEach((item, key) => {
        if (!desiredByKey.has(key)) {
          toDelete.push(item.ID);
        }
      });

      duplicateExistingIds.forEach(itemId => {
        toDelete.push(itemId);
      });

      const createResults = await Promise.all(toCreate.map(a => this.saveAssignmentToHistory(a, scheduleId, scheduleDate)));
      const updateResults = await Promise.all(toUpdate.map(entry => this.updateAssignmentInHistory(entry.itemId, entry.assignment, scheduleId, scheduleDate)));
      const deleteResults = await Promise.all(toDelete.map(itemId => this.deleteAssignmentById(itemId)));

      const failedCreates = createResults.filter(r => !r.success);
      const failedUpdates = updateResults.filter(r => !r.success);
      const failedDeletes = deleteResults.filter(r => !r.success);

      const hasFailures = failedCreates.length > 0 || failedUpdates.length > 0 || failedDeletes.length > 0;

      if (hasFailures) {
        console.error('❌ Assignment sync failures:', {
          failedCreates,
          failedUpdates,
          failedDeletes
        });
      }

      return {
        success: !hasFailures,
        created: createResults.filter(r => r.success).length,
        updated: updateResults.filter(r => r.success).length,
        deleted: deleteResults.filter(r => r.success).length,
        failedCreates,
        failedUpdates,
        failedDeletes
      };
    } catch (error) {
      console.error('❌ Error in syncAssignmentsForSchedule:', error);
      return {
        success: false,
        created: 0,
        updated: 0,
        deleted: 0,
        failedCreates: [],
        failedUpdates: [],
        failedDeletes: [{ error: error.message }]
      };
    }
  }

  /**
   * Delete all assignments for a specific schedule ID
   */
  async deleteAssignmentsForSchedule(scheduleId) {
    try {
      console.log('🔍 Finding assignments to delete for schedule ID:', scheduleId);
      
      const assignmentsUrl = `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items?` +
        `$filter=ScheduleID eq ${scheduleId}&` +
        `$select=ID,Title,StaffName,StudentName`;

      const response = await this.retryFetch(assignmentsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json;odata=verbose'
        }
      });

      if (!response.ok) {
        console.warn('Could not find assignments to delete');
        return;
      }

      const data = await response.json();
      const assignments = data.d.results || [];
      
      console.log(`🗑️ Found ${assignments.length} assignments to delete for schedule ${scheduleId}`);
      if (assignments.length > 0) {
        console.log('   Assignments to delete:', assignments.map(a => `${a.StaffName} → ${a.StudentName} (ID: ${a.ID})`));
      }

      if (assignments.length === 0) {
        console.log('✅ No existing assignments to delete');
        return;
      }

      // Get digest once for all deletes
      const digest = await this.getRequestDigest();

      // Delete each assignment with better error handling
      const deletePromises = assignments.map(async assignment => {
        try {
          const deleteResponse = await fetch(
            `${this.siteUrl}/_api/web/lists/getbytitle('DailyAssignments')/items(${assignment.ID})`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'X-RequestDigest': digest,
                'X-HTTP-Method': 'DELETE',
                'If-Match': '*'
              }
            }
          );
          
          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            console.error(`❌ Failed to delete assignment ${assignment.ID} (${assignment.StaffName} → ${assignment.StudentName}):`, errorText);
            return { success: false, id: assignment.ID, error: errorText };
          }
          
          console.log(`✅ Deleted assignment ${assignment.ID} (${assignment.StaffName} → ${assignment.StudentName})`);
          return { success: true, id: assignment.ID };
        } catch (error) {
          console.error(`❌ Error deleting assignment ${assignment.ID}:`, error);
          return { success: false, id: assignment.ID, error: error.message };
        }
      });

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log(`✅ Deleted ${successCount}/${assignments.length} assignments (${failCount} failed)`);
      
      if (failCount > 0) {
        console.warn(`⚠️ ${failCount} assignments failed to delete - duplicates may occur`);
      }
    } catch (error) {
      console.error('❌ Error in deleteAssignmentsForSchedule:', error);
      // Don't throw - allow save to continue even if delete fails
    }
  }

  /**
   * Save attendance data for all staff and students for a specific date
   * This replaces the old saveAttendanceHistory method
   */
  async saveAttendanceForDate(date, staff = null, students = null) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot save attendance - not authenticated');
        return false;
      }

      // Use date string as-is (already formatted in local timezone from App.js)
      const dateStr = typeof date === 'string' ? date : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      console.log(`💾 Saving attendance for ${dateStr}...`);

      // CRITICAL: Delete existing attendance records for this date FIRST
      console.log(`🗑️ Deleting existing attendance records for ${dateStr} before saving new ones...`);
      const deleteResult = await this.deleteAttendanceForDate(dateStr);
      
      if (!deleteResult.success) {
        console.error(`❌ Failed to delete old attendance records for ${dateStr}`);
        throw new Error(`Cannot save attendance: Failed to delete existing records for ${dateStr}. ${deleteResult.error || 'Unknown error'}`);
      }
      
      if (deleteResult.failed > 0) {
        throw new Error(
          `Cannot save attendance: ${deleteResult.failed} existing DailyAttendance record(s) failed to delete for ${dateStr}`
        );
      }
      
      console.log(`✅ Deletion complete (${deleteResult.deleted} records removed), now saving new attendance records...`);

      // Use provided staff/students if available, otherwise load fresh
      // If passed from App.js, these will have the current attendance flags
      if (!staff || !students) {
        console.log('⚠️ No staff/students provided, loading fresh from SharePoint (attendance data may be lost)');
        staff = await this.loadStaff();
        students = await this.loadStudents();
      } else {
        console.log(`✅ Using provided staff (${staff.length}) and students (${students.length}) with current attendance data`);
      }

      const attendanceRecords = [];

      // Create records for ALL staff (not just absent)
      staff.forEach(staffMember => {
        if (!staffMember.isActive) return;
        
        let status = 'Present';
        
        if (staffMember.absentFullDay) {
          status = 'Absent Full Day';
        } else if (staffMember.absentAM && staffMember.absentPM) {
          status = 'Absent Full Day';
        } else if (staffMember.outOfSessionFullDay) {
          status = 'Out Session Full Day';
        } else if (staffMember.outOfSessionAM && staffMember.outOfSessionPM) {
          status = 'Out Session Full Day';
        } else if (staffMember.absentAM && staffMember.outOfSessionPM) {
          status = 'Absent AM / Out Session PM';
        } else if (staffMember.outOfSessionAM && staffMember.absentPM) {
          status = 'Out Session AM / Absent PM';
        } else if (staffMember.absentAM) {
          status = 'Absent AM';
        } else if (staffMember.absentPM) {
          status = 'Absent PM';
        } else if (staffMember.outOfSessionAM) {
          status = 'Out Session AM';
        } else if (staffMember.outOfSessionPM) {
          status = 'Out Session PM';
        }

        attendanceRecords.push({
          __metadata: { type: 'SP.Data.DailyAttendanceListItem' },
          Title: `${staffMember.name}_${dateStr}`,
          AttendanceDate: dateStr,
          PersonType: 'Staff',
          PersonID: staffMember.id,
          PersonName: staffMember.name,
          Status: status,
          AbsentAM: staffMember.absentAM || false,
          AbsentPM: staffMember.absentPM || false,
          AbsentFullDay: staffMember.absentFullDay || false,
          OutOfSessionAM: staffMember.outOfSessionAM || false,
          OutOfSessionPM: staffMember.outOfSessionPM || false,
          OutOfSessionFullDay: staffMember.outOfSessionFullDay || false,
          CreatedDate: new Date().toISOString()
        });
      });

      // Create records for ALL students (not just absent)
      students.forEach(student => {
        if (!student.isActive) return;

        let status = 'Present';
        
        if (student.absentFullDay) {
          status = 'Absent Full Day';
        } else if (student.absentAM && student.absentPM) {
          status = 'Absent Full Day';
        } else if (student.outOfSessionFullDay) {
          status = 'Out Session Full Day';
        } else if (student.outOfSessionAM && student.outOfSessionPM) {
          status = 'Out Session Full Day';
        } else if (student.absentAM && student.outOfSessionPM) {
          status = 'Absent AM / Out Session PM';
        } else if (student.outOfSessionAM && student.absentPM) {
          status = 'Out Session AM / Absent PM';
        } else if (student.absentAM) {
          status = 'Absent AM';
        } else if (student.absentPM) {
          status = 'Absent PM';
        } else if (student.outOfSessionAM) {
          status = 'Out Session AM';
        } else if (student.outOfSessionPM) {
          status = 'Out Session PM';
        }

        attendanceRecords.push({
          __metadata: { type: 'SP.Data.DailyAttendanceListItem' },
          Title: `${student.name}_${dateStr}`,
          AttendanceDate: dateStr,
          PersonType: 'Client',
          PersonID: student.id,
          PersonName: student.name,
          Status: status,
          AbsentAM: student.absentAM || false,
          AbsentPM: student.absentPM || false,
          AbsentFullDay: student.absentFullDay || false,
          OutOfSessionAM: student.outOfSessionAM || false,
          OutOfSessionPM: student.outOfSessionPM || false,
          OutOfSessionFullDay: student.outOfSessionFullDay || false,
          CreatedDate: new Date().toISOString()
        });
      });

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
      console.error('Error saving attendance:', error);
      return false;
    }
  }

  /**
   * Delete attendance records for a specific date
   */
  async deleteAttendanceForDate(date) {
    // Use date string as-is (already formatted in local timezone from App.js)
    const dateStr = typeof date === 'string' ? date : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    try {
      console.log('🔍 Finding attendance records to delete for', dateStr);
      
      // First, let's see what dates are actually in the list to debug the filter
      const debugUrl = `${this.siteUrl}/_api/web/lists/getbytitle('DailyAttendance')/items?` +
        `$select=ID,AttendanceDate,PersonName&$top=100&$orderby=Created desc`;
      
      try {
        const debugResponse = await this.retryFetch(debugUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json;odata=verbose'
          }
        });
        
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          const recentRecords = debugData.d.results.slice(0, 5);
          console.log('📋 Recent attendance records in list:', recentRecords.map(r => 
            `${r.PersonName}: ${r.AttendanceDate} (ID: ${r.ID})`
          ));
          console.log('🔍 Looking for records matching:', dateStr);
        }
      } catch (debugError) {
        console.warn('Could not fetch debug info:', debugError);
      }
      
      const start = `${dateStr}T00:00:00Z`;
      const end = `${dateStr}T23:59:59Z`;
      const attendanceUrl = `${this.siteUrl}/_api/web/lists/getbytitle('DailyAttendance')/items?` +
        `$filter=AttendanceDate ge datetime'${start}' and AttendanceDate le datetime'${end}'&` +
        `$select=ID,PersonName,AttendanceDate`;

      const response = await this.retryFetch(attendanceUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json;odata=verbose'
        }
      });

      if (!response.ok) {
        console.warn('Could not find attendance records to delete');
        return;
      }

      const data = await response.json();
      const records = data.d.results || [];
      
      console.log(`🗑️ Found ${records.length} attendance records to delete`);
      if (records.length > 0) {
        console.log('   Records to delete:', records.map(r => `${r.PersonName} (ID: ${r.ID}, Date: ${r.AttendanceDate})`));
      }

      if (records.length === 0) {
        console.log('✅ No existing attendance records to delete');
        return;
      }

      // Get digest once for all deletes
      const digest = await this.getRequestDigest();

      // Delete each record with better error handling
      const deletePromises = records.map(async record => {
        try {
          const deleteResponse = await fetch(
            `${this.siteUrl}/_api/web/lists/getbytitle('DailyAttendance')/items(${record.ID})`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'X-RequestDigest': digest,
                'X-HTTP-Method': 'DELETE',
                'If-Match': '*'
              }
            }
          );
          
          if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            console.error(`❌ Failed to delete attendance record ${record.ID}:`, errorText);
            return { success: false, id: record.ID, error: errorText };
          }
          
          console.log(`✅ Deleted attendance record ${record.ID}`);
          return { success: true, id: record.ID };
        } catch (error) {
          console.error(`❌ Error deleting attendance record ${record.ID}:`, error);
          return { success: false, id: record.ID, error: error.message };
        }
      });

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log(`✅ Deleted ${successCount}/${records.length} attendance records for ${dateStr}`);
      
      if (failCount > 0) {
        console.warn(`⚠️ ${failCount} attendance records failed to delete:`, 
          results.filter(r => !r.success).map(r => `ID ${r.id}: ${r.error}`));
      }
      
      return { success: failCount === 0, deleted: successCount, failed: failCount };
    } catch (error) {
      console.error(`❌ Error in deleteAttendanceForDate for ${dateStr}:`, error);
      return { success: false, deleted: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Load attendance data for a specific date
   * Returns attendance records grouped by person type
   */
  async loadAttendanceForDate(date) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot load attendance - not authenticated');
        return null;
      }

      // Use date string as-is (already formatted in local timezone from App.js)
      const dateStr = typeof date === 'string' ? date : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      console.log(`📥 Loading attendance for ${dateStr}...`);

      const attendanceUrl = `${this.siteUrl}/_api/web/lists/getbytitle('DailyAttendance')/items?` +
        `$filter=AttendanceDate eq '${dateStr}'&` +
        `$select=PersonType,PersonID,PersonName,Status,AbsentAM,AbsentPM,AbsentFullDay,OutOfSessionAM,OutOfSessionPM,OutOfSessionFullDay`;

      const response = await this.retryFetch(attendanceUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json;odata=verbose'
        }
      });

      if (!response.ok) {
        console.warn(`No attendance records found for ${dateStr}`);
        return null;
      }

      const data = await response.json();
      const records = data.d.results || [];
      
      console.log(`✅ Found ${records.length} attendance records for ${dateStr}`);

      // Group by person type
      const attendance = {
        staff: {},
        students: {}
      };

      records.forEach(record => {
        const personData = {
          absentAM: record.AbsentAM || false,
          absentPM: record.AbsentPM || false,
          absentFullDay: record.AbsentFullDay || false,
          outOfSessionAM: record.OutOfSessionAM || false,
          outOfSessionPM: record.OutOfSessionPM || false,
          outOfSessionFullDay: record.OutOfSessionFullDay || false,
          status: record.Status
        };

        if (record.PersonType === 'Staff') {
          attendance.staff[record.PersonID] = personData;
        } else if (record.PersonType === 'Client') {
          attendance.students[record.PersonID] = personData;
        }
      });

      console.log(`📊 Loaded attendance: ${Object.keys(attendance.staff).length} staff, ${Object.keys(attendance.students).length} clients`);
      return attendance;
    } catch (error) {
      console.error('Error loading attendance:', error);
      return null;
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
            absentFullDay: false,
            absentAMArrivalTime: '',
            absentPMDepartureTime: ''
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

  /**
   * Get training history for staff members
   * Retrieves all trainee assignments from historical schedules
   */
  async getTrainingHistory(startDate = null, endDate = null) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot get training history - not authenticated');
        return [];
      }

      console.log('📚 Fetching training history from SharePoint...');

      // Build date filter if provided
      const dateFilters = [];
      if (startDate) {
        const startISO = new Date(startDate).toISOString();
        dateFilters.push(`ScheduleDate ge datetime'${startISO}'`);
      }
      if (endDate) {
        const endISO = new Date(endDate).toISOString();
        dateFilters.push(`ScheduleDate le datetime'${endISO}'`);
      }
      
      const filterClause = dateFilters.length > 0 ? `&$filter=${dateFilters.join(' and ')}` : '';

      // Get all schedule records with trainee assignments JSON
      // Note: Include all saved schedules, not just finalized ones, so training sessions count even from daily saves
      const scheduleUrl = `${this.siteUrl}/_api/web/lists/getbytitle('ScheduleHistory')/items?` +
        `$select=Id,ScheduleDate,traineeAssignments${filterClause}&$orderby=ScheduleDate desc&$top=5000`;

      const scheduleResponse = await this.makeRequest(scheduleUrl, {
        headers: await this.getHeaders()
      });

      if (!scheduleResponse.ok) {
        throw new Error('Failed to fetch schedule history');
      }

      const scheduleData = await scheduleResponse.json();
      const schedules = scheduleData.d.results;

      if (schedules.length === 0) {
        console.log('No schedule history found');
        return [];
      }

      console.log(`Found ${schedules.length} historical schedules`);

      // Parse trainee assignments from each schedule's JSON field
      const trainingHistory = [];

      schedules.forEach(schedule => {
        if (schedule.traineeAssignments) {
          try {
            const traineeAssignments = JSON.parse(schedule.traineeAssignments);
            if (Array.isArray(traineeAssignments)) {
              traineeAssignments.forEach(assignment => {
                trainingHistory.push({
                  StaffId: assignment.staffId,
                  StudentId: assignment.studentId,
                  Session: assignment.session,
                  Program: assignment.program || '',
                  ScheduleId: schedule.Id,
                  ScheduleDate: schedule.ScheduleDate,
                  IsTrainee: true
                });
              });
            }
          } catch (e) {
            console.warn('Failed to parse trainee assignments for schedule', schedule.Id, e);
          }
        }
      });

      console.log(`✅ Found ${trainingHistory.length} training sessions in history`);
      return trainingHistory;

    } catch (error) {
      console.error('Error fetching training history:', error);
      return [];
    }
  }

  /**
   * Record a training completion when staff moves from overlap to solo
   * @param {Object} params - Completion data
   * @param {number} params.staffId - Staff member ID
   * @param {string} params.staffName - Staff member name
   * @param {number} params.clientId - Client ID
   * @param {string} params.clientName - Client name
   * @param {string} params.trainingType - Previous training type ('overlap-bcba' or 'overlap-staff')
   * @param {number} params.totalSessions - Number of training sessions completed
   * @param {Date} params.startDate - When training started (first session date)
   */
  async recordTrainingCompletion({ staffId, staffName, clientId, clientName, trainingType, totalSessions, startDate }) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot record training completion - not authenticated');
        return false;
      }

      console.log(`🎓 Recording training completion: ${staffName} → ${clientName}`);

      const headers = await this.getHeaders(true);
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('TrainingCompletions')/items`;

      // Convert training type to SharePoint format
      const spTrainingType = trainingType === 'overlap-bcba' ? 'BCBA Overlap' : 
                            trainingType === 'overlap-staff' ? 'Staff Overlap' : 'Unknown';

      const body = {
        __metadata: { type: 'SP.Data.TrainingCompletionsListItem' },
        Title: `${staffName} - ${clientName}`,
        StaffMemberId: staffId,
        ClientId: clientId,
        TrainingType: spTrainingType,
        CompletedDate: new Date().toISOString(),
        TotalSessions: totalSessions || 0,
        StartDate: startDate ? new Date(startDate).toISOString() : null
      };

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to record training completion:', response.status, errorText);
        // Don't throw - this is non-critical, just log
        return false;
      }

      console.log(`✅ Training completion recorded: ${staffName} completed training on ${clientName}`);
      return true;

    } catch (error) {
      console.error('Error recording training completion:', error);
      // Don't throw - this is non-critical
      return false;
    }
  }

  /**
   * Load training completions from SharePoint
   * @param {number} daysBack - How many days back to load (default 90)
   * @returns {Array} Array of completion records
   */
  async loadTrainingCompletions(daysBack = 90) {
    try {
      if (!this.isAuthenticated()) {
        console.error('Cannot load training completions - not authenticated');
        return [];
      }

      console.log(`📚 Loading training completions (last ${daysBack} days)...`);

      const headers = await this.getHeaders();
      
      // Calculate date filter
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const startISO = startDate.toISOString();

      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('TrainingCompletions')/items?` +
        `$select=Id,Title,StaffMember/Id,StaffMember/Title,ClientId,TrainingType,CompletedDate,TotalSessions,StartDate&` +
        `$expand=StaffMember&` +
        `$filter=CompletedDate ge datetime'${startISO}'&` +
        `$orderby=CompletedDate desc&` +
        `$top=500`;

      const response = await this.makeRequest(url, { headers });

      if (!response.ok) {
        // If list doesn't exist yet, return empty array (non-critical)
        if (response.status === 404) {
          console.warn('⚠️ TrainingCompletions list not found - create it to track completions');
          return [];
        }
        const errorText = await response.text();
        console.error('Failed to load training completions:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      const items = data.d.results || [];

      console.log(`✅ Loaded ${items.length} training completions`);

      // Map to normalized format
      return items.map(item => ({
        id: item.Id,
        staffId: item.StaffMember?.Id,
        staffName: item.StaffMember?.Title || 'Unknown',
        clientId: item.ClientId,
        trainingType: item.TrainingType,
        completedDate: item.CompletedDate ? new Date(item.CompletedDate) : null,
        totalSessions: item.TotalSessions || 0,
        startDate: item.StartDate ? new Date(item.StartDate) : null
      }));

    } catch (error) {
      console.error('Error loading training completions:', error);
      return [];
    }
  }

  /**
   * Get training session count for a specific staff-client pair
   * Uses the schedule history to count trainee assignments
   */
  async getTrainingSessionCount(staffId, clientId) {
    try {
      // Get all historical trainee assignments for this staff-client pair
      const trainingHistory = await this.getTrainingHistory();
      
      const sessions = trainingHistory.filter(
        h => h.StaffId === staffId && h.StudentId === clientId
      );

      // Get the first session date
      let firstSessionDate = null;
      if (sessions.length > 0) {
        const sortedSessions = sessions.sort((a, b) => 
          new Date(a.ScheduleDate) - new Date(b.ScheduleDate)
        );
        firstSessionDate = new Date(sortedSessions[0].ScheduleDate);
      }

      return {
        count: sessions.length,
        firstSessionDate
      };

    } catch (error) {
      console.error('Error getting training session count:', error);
      return { count: 0, firstSessionDate: null };
    }
  }
}