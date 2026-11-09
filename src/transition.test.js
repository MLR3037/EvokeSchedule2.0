import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Assignment, PROGRAMS, Schedule, Staff, Student, normalizeProgram } from './types';
import { AutoAssignmentEngine } from './services/AutoAssignmentEngine';
import { SharePointService } from './services/SharePointService';
import ScheduleGridView from './components/ScheduleGridView';

jest.mock('@azure/msal-browser', () => ({
  PublicClientApplication: jest.fn().mockImplementation(() => ({}))
}));

const date = new Date(2026, 10, 9);

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('Transition remains distinct and shares Secondary session defaults', () => {
  const transition = new Student({ id: 1, name: 'Transition client', program: ' transition ' });
  const secondary = new Student({ id: 2, name: 'Secondary client', program: 'Secondary' });
  const staff = new Staff({ id: 3, name: 'Staff', role: 'RBT', secondaryProgram: true, transitionProgram: true });

  expect(normalizeProgram('Transition')).toBe(PROGRAMS.TRANSITION);
  expect(transition.program).toBe(PROGRAMS.TRANSITION);
  expect(transition.getScheduleTimes()).toEqual(secondary.getScheduleTimes());
  expect(staff.canWorkProgram(PROGRAMS.SECONDARY)).toBe(true);
  expect(staff.canWorkProgram(PROGRAMS.TRANSITION)).toBe(true);
  expect(new Staff({ id: 4, name: 'Secondary only', role: 'RBT', secondaryProgram: true })
    .canWorkProgram(PROGRAMS.TRANSITION)).toBe(false);
  expect(new Assignment({ program: PROGRAMS.TRANSITION, session: 'AM' }).getSessionTimes())
    .toEqual(new Assignment({ program: PROGRAMS.SECONDARY, session: 'AM' }).getSessionTimes());
});

test('automatic assignment includes Transition and avoids staff busy in another program', async () => {
  const busy = new Staff({ id: 1, name: 'Busy', role: 'RBT', secondaryProgram: true, transitionProgram: true });
  const available = new Staff({ id: 2, name: 'Available', role: 'RBT', transitionProgram: true });
  const student = new Student({
    id: 10, name: 'Client', program: 'Transition', absentPM: true, teamIds: [1, 2]
  });
  const schedule = new Schedule({
    date,
    assignments: [new Assignment({ id: 'existing', staffId: 1, studentId: 20, session: 'AM', program: 'Secondary' })]
  });

  const result = await new AutoAssignmentEngine().autoAssignSchedule(schedule, [busy, available], [student], date);
  expect(result.errors).toEqual([]);
  expect(result.assignments).toHaveLength(1);
  expect(result.assignments[0]).toMatchObject({ staffId: 2, studentId: 10, program: 'Transition', session: 'AM' });
  expect(schedule.isStaffAvailable(1, 'AM', 'Transition')).toBe(false);
  expect(schedule.isStaffAvailable(1, 'PM', 'Transition')).toBe(true);
  expect(schedule.isStaffAssignedToOtherProgram('1', 'am', 'transition')).toBe(true);
  expect(schedule.isStaffAssignedToOtherProgram(1, 'AM', 'Secondary')).toBe(false);
  schedule.addTraineeAssignment({ staffId: 2, session: 'PM', program: 'Secondary' });
  expect(schedule.isStaffAssignedToOtherProgram(2, 'PM', 'Transition')).toBe(true);
});

test('automatic training does not place a trainee in two programs in one session', () => {
  const trainee = new Staff({ id: 1, name: 'Trainee', role: 'RBT', transitionProgram: true });
  const trainer = new Staff({ id: 2, name: 'Trainer', role: 'RBT', transitionProgram: true });
  const student = new Student({ id: 10, name: 'Client', program: 'Transition' });
  const schedule = new Schedule({
    date,
    assignments: [new Assignment({ staffId: 1, studentId: 20, session: 'AM', program: 'Secondary' })]
  });
  expect(new AutoAssignmentEngine().placeTrainingPair(trainee, trainer, student, 'AM', schedule)).toBe(false);
  expect(schedule.traineeAssignments).toHaveLength(0);
  expect(schedule.assignments).toHaveLength(1);
});

test('SharePoint loads and saves Transition staff and assignments', async () => {
  const service = new SharePointService({ clientId: 'test', tenantId: 'test' });
  service.getHeaders = jest.fn().mockResolvedValue({});
  service.makeRequest = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ d: { results: [{ InternalName: 'Program' }] } }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ d: { results: [{
        Id: 11, StaffPerson: { Id: 1, Title: 'Staff', EMail: 'staff@example.com' },
        Role: 'RBT', Program: 'Secondary', PrimaryProgram: false, SecondaryProgram: true,
        TransitionProgram: true, IsActive: true
      }] } })
    })
    .mockResolvedValue({ ok: true });

  const [staff] = await service.loadStaff();
  expect(staff.canWorkProgram('Secondary')).toBe(true);
  expect(staff.canWorkProgram('Transition')).toBe(true);
  expect(service.makeRequest.mock.calls[1][0]).toContain('TransitionProgram');
  await service.saveStaff(staff, true);
  const staffBody = JSON.parse(service.makeRequest.mock.calls[2][1].body);
  expect(staffBody).toMatchObject({ SecondaryProgram: true, TransitionProgram: true });

  service.syncStudentTeamToList = jest.fn().mockResolvedValue(true);
  const student = new Student({ id: 10, name: 'Client', program: 'Transition' });
  const [loadedStudent] = service.parseStudents([{ Id: 10, Title: 'Client', Program: 'Transition' }], {});
  expect(loadedStudent.program).toBe('Transition');
  await service.saveStudent(student, true);
  expect(JSON.parse(service.makeRequest.mock.calls[3][1].body).Program).toBe('Transition');

  service.getRequestDigest = jest.fn().mockResolvedValue('digest');
  service.retryFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ d: { ID: 123 } }) });
  await service.saveAssignmentToHistory(new Assignment({
    staffId: 1, studentId: 10, session: 'AM', program: 'Transition'
  }), 99, '2026-11-09');
  expect(JSON.parse(service.retryFetch.mock.calls[0][1].body).Program).toBe('Transition');
  expect(service.normalizeAssignmentProgram('transition')).toBe('Transition');
});

test('grid and its popup display Transition separately', () => {
  const students = [
    new Student({ id: 1, name: 'Secondary client', program: 'Secondary' }),
    new Student({ id: 2, name: 'Transition client', program: 'Transition' })
  ];
  const popup = { document: { write: jest.fn() } };
  jest.spyOn(window, 'open').mockReturnValue(popup);
  render(<ScheduleGridView
    schedule={new Schedule({ date })}
    students={students}
    staff={[]}
    selectedDate={date}
    onAssignmentLock={jest.fn()}
    onAssignmentUnlock={jest.fn()}
    onAssignmentRemove={jest.fn()}
    onManualAssignment={jest.fn()}
  />);

  fireEvent.click(screen.getByText('+ Expand Transition'));
  expect(screen.getByText('Transition client')).toBeInTheDocument();
  expect(screen.queryByText('Secondary client')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Open in New Window'));
  const html = popup.document.write.mock.calls[0][0];
  expect(html).toContain('>Transition</h2>');
  expect(html).toContain('Transition client');
  expect(html).toContain('Secondary client');
});
