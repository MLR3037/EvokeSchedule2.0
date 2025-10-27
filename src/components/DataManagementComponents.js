import React, { useState } from 'react';
import { Save, X, User, Users, Mail, Phone, Calendar } from 'lucide-react';
import { Staff, Student, ROLES, PROGRAMS, RATIOS } from '../types/index.js';
import { SinglePeoplePicker, StaffPeoplePicker } from './PeoplePicker.js';

/**
 * Staff Form Component - Add/Edit staff members with People Picker integration
 */
export const StaffForm = ({ 
  staff = null, 
  onSave, 
  onCancel, 
  peoplePickerService 
}) => {
  const [formData, setFormData] = useState({
    name: staff?.name || '',
    role: staff?.role || ROLES.RBT,
    email: staff?.email || '',
    phone: staff?.phone || '',
    isActive: staff?.isActive ?? true,
    primaryProgram: staff?.primaryProgram || false, // Yes/No field
    secondaryProgram: staff?.secondaryProgram || false, // Yes/No field
    certificationExpiry: staff?.certificationExpiry || '',
    userId: staff?.userId || '',
    staffPerson: staff?.staffPerson || null
  });

  const [selectedPerson, setSelectedPerson] = useState(
    staff?.staffPerson ? {
      id: staff.userId,
      title: staff.name,
      email: staff.email
    } : null
  );

  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handlePersonSelect = (person) => {
    setSelectedPerson(person);
    if (person) {
      setFormData(prev => ({
        ...prev,
        name: person.title,
        email: person.email,
        userId: person.id.toString(),
        staffPerson: person
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        name: '',
        email: '',
        userId: '',
        staffPerson: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    if (!formData.primaryProgram && !formData.secondaryProgram) {
      newErrors.programs = 'At least one program must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Create staff object
    const staffData = {
      id: staff?.id || Date.now(),
      ...formData
    };

    onSave(new Staff(staffData));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="bg-blue-600 text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5" />
            {staff ? 'Edit Staff Member' : 'Add Staff Member'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* People Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Staff Member *
            </label>
            <SinglePeoplePicker
              selectedUser={selectedPerson}
              onSelectionChange={handlePersonSelect}
              placeholder="Search for staff member..."
              peoplePickerService={peoplePickerService}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedPerson}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(ROLES).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role}</p>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedPerson}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Work Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Certification Expiry
            </label>
            <input
              type="date"
              value={formData.certificationExpiry}
              onChange={(e) => handleInputChange('certificationExpiry', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Programs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Programs *
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.primaryProgram}
                  onChange={(e) => handleInputChange('primaryProgram', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Primary Program</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.secondaryProgram}
                  onChange={(e) => handleInputChange('secondaryProgram', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Secondary Program</span>
              </label>
            </div>
            {errors.programs && (
              <p className="mt-1 text-sm text-red-600">{errors.programs}</p>
            )}
          </div>

          {/* Active Status */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {staff ? 'Update Staff' : 'Add Staff'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Student Form Component - Add/Edit students with People Picker for team management
 */
export const StudentForm = ({ 
  student = null, 
  onSave, 
  onCancel, 
  allStaff = [],
  peoplePickerService 
}) => {
  const [formData, setFormData] = useState({
    name: student?.name || '',
    program: student?.program || PROGRAMS.PRIMARY,
    ratioAM: student?.ratioAM || RATIOS.ONE_TO_ONE,
    ratioPM: student?.ratioPM || RATIOS.ONE_TO_ONE,
    team: student?.team || [], // Renamed from preferredStaff
    isActive: student?.isActive ?? true,
    notes: student?.notes || '',
    dateStarted: student?.dateStarted || '',
    teamTrainingStatus: student?.teamTrainingStatus || {}, // PRESERVE training status data
    pairedWith: student?.pairedWith || null // PRESERVE paired student data
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleTeamChange = (teamList) => {
    setFormData(prev => ({
      ...prev,
      team: teamList
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.program) {
      newErrors.program = 'Program is required';
    }

    if (!formData.ratioAM) {
      newErrors.ratioAM = 'AM ratio is required';
    }

    if (!formData.ratioPM) {
      newErrors.ratioPM = 'PM ratio is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const studentData = {
      id: student?.id || Date.now(),
      ...formData
    };

    onSave(new Student(studentData));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="bg-green-600 text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            {student ? 'Edit Student' : 'Add Student'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Program *
              </label>
              <select
                value={formData.program}
                onChange={(e) => handleInputChange('program', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.values(PROGRAMS).map(program => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
              {errors.program && (
                <p className="mt-1 text-sm text-red-600">{errors.program}</p>
              )}
            </div>
          </div>

          {/* Ratio Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AM Ratio *
              </label>
              <select
                value={formData.ratioAM}
                onChange={(e) => handleInputChange('ratioAM', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.values(RATIOS).map(ratio => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
              {errors.ratioAM && (
                <p className="mt-1 text-sm text-red-600">{errors.ratioAM}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PM Ratio *
              </label>
              <select
                value={formData.ratioPM}
                onChange={(e) => handleInputChange('ratioPM', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.values(RATIOS).map(ratio => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
              {errors.ratioPM && (
                <p className="mt-1 text-sm text-red-600">{errors.ratioPM}</p>
              )}
            </div>
          </div>

          {/* Date Started */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date Started
            </label>
            <input
              type="date"
              value={formData.dateStarted}
              onChange={(e) => handleInputChange('dateStarted', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Team Management */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Members
            </label>
            <StaffPeoplePicker
              selectedStaff={formData.team}
              onSelectionChange={handleTeamChange}
              allStaff={allStaff}
              peoplePickerService={peoplePickerService}
            />
            <p className="mt-1 text-xs text-gray-500">
              Select staff members who work with this client
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Additional notes about the student..."
            />
          </div>

          {/* Active Status */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {student ? 'Update Student' : 'Add Student'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default { StaffForm, StudentForm };