/**
 * SharePoint People Picker Helper Service
 * Provides utilities for working with SharePoint People Picker fields
 */
export class PeoplePickerService {
  constructor(config) {
    this.config = config;
    this.accessToken = null;
  }

  /**
   * Set access token for API calls
   * @param {string} token - Access token
   */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Get headers for SharePoint REST API calls
   * @returns {Object} Headers object
   */
  getHeaders() {
    const headers = {
      'Accept': 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose'
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Search for users in SharePoint
   * @param {string} searchText - Text to search for
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Promise<Array>} Array of user objects
   */
  async searchUsers(searchText, maxResults = 10) {
    try {
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/siteusers?$filter=substringof('${searchText}',Title) or substringof('${searchText}',Email)&$top=${maxResults}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to search users: ${response.status}`);
      }

      const data = await response.json();
      
      return data.d.results.map(user => ({
        id: user.Id,
        title: user.Title,
        email: user.Email,
        loginName: user.LoginName,
        principalType: user.PrincipalType
      }));
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Get user information by ID
   * @param {number} userId - SharePoint User ID
   * @returns {Promise<Object>} User object
   */
  async getUserById(userId) {
    try {
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/siteusers/getbyid(${userId})`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to get user: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        id: data.d.Id,
        title: data.d.Title,
        email: data.d.Email,
        loginName: data.d.LoginName,
        principalType: data.d.PrincipalType
      };
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Resolve user by email address
   * @param {string} email - Email address to resolve
   * @returns {Promise<Object>} User object
   */
  async resolveUserByEmail(email) {
    try {
      const response = await fetch(
        `${this.config.siteUrl}/_api/web/ensureuser`,
        {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'X-RequestDigest': await this.getRequestDigest()
          },
          body: JSON.stringify({
            'logonName': email
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to resolve user: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        id: data.d.Id,
        title: data.d.Title,
        email: data.d.Email,
        loginName: data.d.LoginName,
        principalType: data.d.PrincipalType
      };
    } catch (error) {
      console.error('Error resolving user by email:', error);
      throw error;
    }
  }

  /**
   * Get request digest for POST operations
   * @returns {Promise<string>} Request digest value
   */
  async getRequestDigest() {
    try {
      const response = await fetch(
        `${this.config.siteUrl}/_api/contextinfo`,
        {
          method: 'POST',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get request digest: ${response.status}`);
      }

      const data = await response.json();
      return data.d.GetContextWebInformation.FormDigestValue;
    } catch (error) {
      console.error('Error getting request digest:', error);
      throw error;
    }
  }

  /**
   * Format user data for People Picker field
   * @param {Array<number>} userIds - Array of SharePoint User IDs
   * @returns {Object} Formatted object for SharePoint People Picker
   */
  formatForPeoplePicker(userIds) {
    if (!userIds || userIds.length === 0) {
      return null;
    }

    return {
      results: userIds
    };
  }

  /**
   * Extract user IDs from People Picker field data
   * @param {Object} peoplePickerData - People Picker field data from SharePoint
   * @returns {Array<number>} Array of user IDs
   */
  extractUserIds(peoplePickerData) {
    if (!peoplePickerData || !peoplePickerData.results) {
      return [];
    }

    return peoplePickerData.results.map(user => user.Id || user.id);
  }

  /**
   * Get all site users (for populating dropdowns)
   * @param {boolean} activeOnly - Whether to return only active users
   * @returns {Promise<Array>} Array of user objects
   */
  async getAllSiteUsers(activeOnly = true) {
    try {
      let query = `${this.config.siteUrl}/_api/web/siteusers?$top=1000`;
      
      if (activeOnly) {
        // Filter out system accounts and disabled users
        query += "&$filter=PrincipalType eq 1"; // User principal type
      }

      const response = await fetch(query, { 
        headers: this.getHeaders() 
      });

      if (!response.ok) {
        throw new Error(`Failed to get site users: ${response.status}`);
      }

      const data = await response.json();
      
      return data.d.results
        .filter(user => user.Title && user.Email) // Filter out users without name/email
        .map(user => ({
          id: user.Id,
          title: user.Title,
          email: user.Email,
          loginName: user.LoginName,
          principalType: user.PrincipalType
        }))
        .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically
    } catch (error) {
      console.error('Error getting all site users:', error);
      throw error;
    }
  }

  /**
   * Validate that user IDs exist in the site
   * @param {Array<number>} userIds - Array of user IDs to validate
   * @returns {Promise<Object>} Object with valid and invalid user IDs
   */
  async validateUserIds(userIds) {
    const validUsers = [];
    const invalidIds = [];

    for (const userId of userIds) {
      try {
        const user = await this.getUserById(userId);
        validUsers.push(user);
      } catch (error) {
        invalidIds.push(userId);
      }
    }

    return {
      validUsers,
      invalidIds
    };
  }
}

export default PeoplePickerService;