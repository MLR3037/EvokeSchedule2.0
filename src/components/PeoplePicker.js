import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, ChevronDown } from 'lucide-react';

/**
 * People Picker Component for SharePoint integration
 * Allows selection of multiple users from SharePoint
 */
export const PeoplePicker = ({ 
  selectedUsers = [], 
  onSelectionChange, 
  placeholder = "Search for people...",
  maxSelections = null,
  disabled = false,
  peoplePickerService
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const dropdownRef = useRef(null);

  // Load all site users on component mount
  useEffect(() => {
    if (peoplePickerService) {
      loadAllUsers();
    }
  }, [peoplePickerService]);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAllUsers = async () => {
    try {
      const users = await peoplePickerService.getAllSiteUsers(true);
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSearch = async (text) => {
    setSearchText(text);
    
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      // Filter from all users locally for better performance
      const filtered = allUsers.filter(user => 
        user.title.toLowerCase().includes(text.toLowerCase()) ||
        user.email.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 10); // Limit to 10 results

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSelect = (user) => {
    if (disabled) return;
    
    // Check if user is already selected
    if (selectedUsers.some(selected => selected.id === user.id)) {
      return;
    }

    // Check max selections limit
    if (maxSelections && selectedUsers.length >= maxSelections) {
      return;
    }

    const updatedUsers = [...selectedUsers, user];
    onSelectionChange(updatedUsers);
    setSearchText('');
    setSearchResults([]);
    setIsOpen(false);
  };

  const handleUserRemove = (userId) => {
    if (disabled) return;
    
    const updatedUsers = selectedUsers.filter(user => user.id !== userId);
    onSelectionChange(updatedUsers);
  };

  const displayResults = searchText.trim() ? searchResults : allUsers.slice(0, 10);
  const availableResults = displayResults.filter(user => 
    !selectedUsers.some(selected => selected.id === user.id)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Users Display */}
      {selectedUsers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedUsers.map(user => (
            <div
              key={user.id}
              className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              <Users className="w-3 h-3" />
              <span>{user.title}</span>
              {!disabled && (
                <button
                  onClick={() => handleUserRemove(user.id)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center border border-gray-300 rounded-md">
          <div className="flex-1 flex items-center">
            <Search className="w-4 h-4 text-gray-400 ml-3" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full pl-2 pr-3 py-2 border-0 focus:outline-none focus:ring-0"
            />
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className="px-3 py-2 border-l border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {isSearching && (
              <div className="px-4 py-3 text-gray-500 text-sm">
                Searching...
              </div>
            )}

            {!isSearching && availableResults.length === 0 && (
              <div className="px-4 py-3 text-gray-500 text-sm">
                {searchText.trim() ? 'No users found' : 'No users available'}
              </div>
            )}

            {!isSearching && availableResults.map(user => (
              <button
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {user.title}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {maxSelections && selectedUsers.length >= maxSelections && (
              <div className="px-4 py-3 text-amber-600 text-sm bg-amber-50 border-t">
                Maximum {maxSelections} selection{maxSelections !== 1 ? 's' : ''} reached
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper Text */}
      {maxSelections && (
        <div className="mt-1 text-xs text-gray-500">
          {selectedUsers.length} of {maxSelections} selected
        </div>
      )}
    </div>
  );
};

/**
 * Single People Picker Component (for selecting one person)
 */
export const SinglePeoplePicker = ({ 
  selectedUser = null, 
  onSelectionChange, 
  placeholder = "Search for a person...",
  disabled = false,
  peoplePickerService
}) => {
  return (
    <PeoplePicker
      selectedUsers={selectedUser ? [selectedUser] : []}
      onSelectionChange={(users) => onSelectionChange(users[0] || null)}
      placeholder={placeholder}
      maxSelections={1}
      disabled={disabled}
      peoplePickerService={peoplePickerService}
    />
  );
};

/**
 * Staff People Picker Component (specifically for staff selection)
 */
export const StaffPeoplePicker = ({ 
  selectedStaff = [], 
  onSelectionChange, 
  allStaff = [],
  disabled = false,
  peoplePickerService
}) => {
  // Filter people picker results to only show users who are in the staff list
  const [filteredUsers, setFilteredUsers] = useState([]);

  useEffect(() => {
    if (peoplePickerService && allStaff.length > 0) {
      loadStaffUsers();
    }
  }, [peoplePickerService, allStaff]);

  const loadStaffUsers = async () => {
    try {
      const allUsers = await peoplePickerService.getAllSiteUsers(true);
      
      // Filter to only users who are in the staff list
      const staffUsers = allUsers.filter(user => 
        allStaff.some(staff => 
          staff.email && user.email && 
          staff.email.toLowerCase() === user.email.toLowerCase()
        )
      );
      
      setFilteredUsers(staffUsers);
    } catch (error) {
      console.error('Error loading staff users:', error);
    }
  };

  return (
    <div>
      <PeoplePicker
        selectedUsers={selectedStaff}
        onSelectionChange={onSelectionChange}
        placeholder="Search for staff members..."
        disabled={disabled}
        peoplePickerService={peoplePickerService}
      />
      
      {allStaff.length > 0 && filteredUsers.length === 0 && (
        <div className="mt-2 text-sm text-amber-600">
          Note: Only users in the Staff list can be selected
        </div>
      )}
    </div>
  );
};

export default PeoplePicker;