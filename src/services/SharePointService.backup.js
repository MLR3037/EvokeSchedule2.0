import { Staff, Student, Assignment, Schedule, PROGRAMS } from '../types/index.js';

/**
 * SharePoint REST API integration service with OAuth authentication
 * Works with Microsoft Graph and SharePoint APIs for external hosting
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
    this.accessToken = null;
    this.tokenExpiry = null;
    this.requestDigest = null;
    this.digestExpiry = null;
  }

  /**
   * Authenticate with Microsoft using OAuth
   */
  async login() {
    try {
      console.log('🔐 Starting Microsoft OAuth login...');
      
      // Check if we have a valid cached token first
      const cachedToken = this.getCachedToken();
      if (cachedToken) {
        this.accessToken = cachedToken.token;
        this.tokenExpiry = cachedToken.expiry;
        console.log('✅ Using cached access token');
        return true;
      }

      // Build authorization URL (now async for PKCE)
      const authUrl = await this.buildAuthUrl();
      console.log('🔗 Redirecting to Microsoft login...');
      console.log('🌐 Full redirect URL:', authUrl);
      
      // Add a small delay to ensure console logs are visible
      setTimeout(() => {
        window.location.href = authUrl;
      }, 100);
      
      return false; // Will redirect, so return false for now
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE() {
    // Generate random code verifier
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Generate code challenge
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    return crypto.subtle.digest('SHA-256', data).then(digest => {
      const codeChallenge = btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      return { codeVerifier, codeChallenge };
    });
  }

  /**
   * Build OAuth authorization URL
   */
  async buildAuthUrl() {
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = await this.generatePKCE();
    
    // Store code verifier for later use
    localStorage.setItem('pkce_code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: 'https://graph.microsoft.com/Sites.ReadWrite.All https://graph.microsoft.com/User.Read',
      response_mode: 'query',
      state: 'login',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params}`;
    console.log('🔗 Built OAuth URL with PKCE:', authUrl);
    console.log('🔧 Config check:', {
      clientId: this.config.clientId,
      tenantId: this.config.tenantId,
      redirectUri: this.config.redirectUri
    });
    
    return authUrl;
  }

  /**
   * Handle OAuth callback and exchange code for token
   */
  async handleOAuthCallback() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      if (error) {
        const errorDescription = urlParams.get('error_description');
        throw new Error(`OAuth error: ${error} - ${decodeURIComponent(errorDescription || 'Unknown error')}`);
      }
      
      if (!code || state !== 'login') {
        throw new Error('Invalid OAuth callback parameters');
      }

      console.log('🔄 Exchanging OAuth code for access token...');
      
      // Get stored code verifier for PKCE
      const codeVerifier = localStorage.getItem('pkce_code_verifier');
      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found');
      }

      // Exchange code for token with PKCE
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          scope: 'https://graph.microsoft.com/Sites.ReadWrite.All https://graph.microsoft.com/User.Read',
          code: code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
      
      // Cache the token and clean up PKCE verifier
      this.cacheToken(this.accessToken, this.tokenExpiry);
      localStorage.removeItem('pkce_code_verifier');
      
      console.log('✅ Access token obtained successfully');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return true;
    } catch (error) {
      console.error('❌ OAuth callback failed:', error);
      // Clean up PKCE verifier on error
      localStorage.removeItem('pkce_code_verifier');
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuthentication() {
    try {
      // Check for OAuth callback (including error cases)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('code') && urlParams.get('state') === 'login') {
        return await this.handleOAuthCallback();
      }
      
      // Check for OAuth error
      if (urlParams.get('error')) {
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        console.error('❌ OAuth error detected:', error, decodeURIComponent(errorDescription || ''));
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return false;
      }

      // Check cached token
      const cachedToken = this.getCachedToken();
      if (cachedToken) {
        this.accessToken = cachedToken.token;
        this.tokenExpiry = cachedToken.expiry;
        console.log('✅ Found valid cached token');
        return true;
      }

      console.log('⚠️ No valid authentication found');
      return false;
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Cache access token
   */
  cacheToken(token, expiry) {
    localStorage.setItem('sp_access_token', token);
    localStorage.setItem('sp_token_expiry', expiry.toString());
  }

  /**
   * Get cached token if valid
   */
  getCachedToken() {
    const token = localStorage.getItem('sp_access_token');
    const expiry = localStorage.getItem('sp_token_expiry');
    
    if (token && expiry && Date.now() < parseInt(expiry) - 300000) { // 5 min buffer
      return { token, expiry: parseInt(expiry) };
    }
    
    return null;
  }

  /**
   * Force logout and clear tokens
   */
  forceLogout() {
    console.log('🚪 Logging out and clearing tokens...');
    this.accessToken = null;
    this.tokenExpiry = null;
    localStorage.removeItem('sp_access_token');
    localStorage.removeItem('sp_token_expiry');
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
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.staffListName}')/items?` +
        `$select=Id,Title,Role,Email,PrimaryProgram,SecondaryProgram,IsActive&` +
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

      return staffItems.map(item => {
        const staff = new Staff({
          id: item.Id,
          name: item.Title || 'Unknown Staff',
          role: item.Role || 'RBT',
          email: item.Email || '',
          primaryProgram: item.PrimaryProgram || false,
          secondaryProgram: item.SecondaryProgram || false,
          isActive: item.IsActive !== false
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
      const url = `${this.config.siteUrl}/_api/web/lists/getbytitle('${this.config.studentsListName}')/items?` +
        `$select=Id,Title,Program,RatioAM,RatioPM,IsActive,PairedWith,Team/Id,Team/Title&` +
        `$expand=Team&` +
        `$top=5000`;

      console.log('📋 Fetching students from:', url);

      const response = await this.makeRequest(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('SharePoint Students API Error:', response.status, errorText);
        throw new Error(`Failed to load students: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 Raw SharePoint students response:', data);

      const studentItems = data.d.results || [];
      console.log(`✅ Found ${studentItems.length} students`);

      const students = studentItems.map(item => {
        // Handle team members - properly parse lookup field
        let team = [];
        let teamIds = [];

        if (item.Team) {
          if (item.Team.results && Array.isArray(item.Team.results)) {
            // Multi-value lookup field format
            team = item.Team.results.map(teamMember => ({
              id: teamMember.Id,
              title: teamMember.Title,
              name: teamMember.Title
            }));
            teamIds = team.map(member => member.id);
          } else if (item.Team.Id) {
            // Single lookup field format
            team = [{
              id: item.Team.Id,
              title: item.Team.Title,
              name: item.Team.Title
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
          pairedWith: item.PairedWith || null
        });

        if (team.length > 0) {
          console.log(`✅ Student ${item.Title} has ${team.length} team members:`, team.map(t => t.title));
        } else {
          console.log(`⚠️ Student ${item.Title} has no team members`);
        }

        return student;
      });

      console.log('📊 STUDENT LOAD SUMMARY:');
      console.log(`  Total students: ${students.length}`);
      console.log(`  Students with teams: ${students.filter(s => s.team && s.team.length > 0).length}`);

      return students;

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
        IsActive: staff.isActive
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

      const body = {
        __metadata: { type: 'SP.Data.ClientsListItem' },
        Title: student.name,
        Program: student.program,
        RatioAM: student.ratioAM,
        RatioPM: student.ratioPM,
        IsActive: student.isActive
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
      console.log('💾 Schedule saving temporarily disabled');
      return true;
    } catch (error) {
      console.error('Error saving schedule:', error);
      return false;
    }
  }

  async saveAssignment(assignment) {
    try {
      console.log('💾 Assignment saving temporarily disabled');
      return { success: true, id: assignment.id };
    } catch (error) {
      console.error('Error saving assignment:', error);
      return { success: false };
    }
  }
}