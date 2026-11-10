/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';
import TeacherDashboardScreen from '../Src/features/teacher/TeacherDashboardScreen';
import {
  createParentAccount,
  sendParentPasswordReset,
  signInForRole,
} from '../Src/services/firebase/parentMonitoring';

jest.mock('../Src/services/firebase/parentMonitoring', () => ({
  approveRegistrationRequest: jest.fn(),
  createParentAccount: jest.fn().mockResolvedValue(undefined),
  declineRegistrationRequest: jest.fn(),
  allocateHostelRoom: jest.fn(),
  allocateApprovedHostelRequest: jest.fn(),
  createParentHostelRequest: jest.fn().mockResolvedValue(undefined),
  createHostelRoom: jest.fn(),
  recordHostelVisitor: jest.fn(),
  removeStudent: jest.fn(),
  saveStudent: jest.fn(),
  saveHostelMeals: jest.fn(),
  saveHostelAttendance: jest.fn(),
  reviewHostelRequest: jest.fn().mockResolvedValue(undefined),
  sendParentPasswordReset: jest.fn().mockResolvedValue(undefined),
  signInForRole: jest.fn(),
  signOutUser: jest.fn(),
  subscribeToHostelCollection: jest.fn().mockReturnValue(jest.fn()),
  subscribeToHostelRequests: jest.fn().mockReturnValue(jest.fn()),
  subscribeToHostelStudents: jest.fn().mockReturnValue(jest.fn()),
  subscribeToRegistrationRequests: jest.fn().mockReturnValue(jest.fn()),
  subscribeToStudents: jest.fn().mockReturnValue(jest.fn()),
  updateStudentClass: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactNative = require('react-native');

  return {
    SafeAreaProvider: ReactNative.View,
    SafeAreaView: ReactNative.View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

test('shared admin login routes a hostel admin to the hostel-only dashboard', async () => {
  signInForRole.mockResolvedValue({
    uid: 'hostel-admin-1',
    email: 'hostel@example.com',
    role: 'hostelAdmin',
  });
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'role-admin' }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'email-input' })
      .props.onChangeText('hostel@example.com');
    renderer.root
      .findByProps({ testID: 'password-input' })
      .props.onChangeText('secure-password');
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({ testID: 'auth-submit' }).props.onPress();
  });

  expect(signInForRole).toHaveBeenCalledWith(
    'hostel@example.com',
    'secure-password',
    'admin',
  );
  expect(
    renderer.root.findByProps({ testID: 'hostel-admin-sign-out' }),
  ).toBeTruthy();
  expect(renderer.root.findByProps({ testID: 'hostel-tab-attendance' })).toBeTruthy();
  expect(() => renderer.root.findByProps({ testID: 'admin-tab-students' })).toThrow();
});

test('parent login sends a reset email to the entered address', async () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'role-parent' }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'email-input' })
      .props.onChangeText('parent@example.com');
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'parent-forgot-password' })
      .props.onPress();
  });

  expect(sendParentPasswordReset).toHaveBeenCalledWith('parent@example.com');
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text =>
        text.props.children?.toString().includes('Firebase has sent a password reset link'),
      ),
  ).toBe(true);
});

test('student enrollment creates parent login and submits request without saving password', async () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer.root.findByProps({ testID: 'role-admin' })).toBeTruthy();
  expect(renderer.root.findByProps({ testID: 'role-teacher' })).toBeTruthy();
  expect(renderer.root.findByProps({ testID: 'role-parent' })).toBeTruthy();
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'language-toggle' }).props.onPress();
  });
  expect(
    renderer.root.findByProps({ testID: 'language-flag' }).props.children,
  ).toBe('🇵🇰');
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 'ایم ایم ایس میں خوش آمدید'),
  ).toBe(true);
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'language-toggle' }).props.onPress();
  });

  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'role-parent' }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'parent-register' }).props.onPress();
  });

  const registrationFields = {
    'student-name-input': 'Amina Ahmed',
    'father-name-input': 'Ahmed Ali',
    'date-of-birth-input': '10/02/2015',
    'address-input': 'Lahore',
    'parent-email-input': 'parent@gmail.com',
    'parent-password-input': 'parent-secret',
    'contact-number-input': '03001234567',
  };
  Object.entries(registrationFields).forEach(([testID, value]) => {
    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID }).props.onChangeText(value);
    });
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'program-nazra-quran' })
      .props.onPress();
    renderer.root.findByProps({ testID: 'hostel-resident' }).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'parent-register-submit' })
      .props.onPress();
  });

  expect(createParentAccount).toHaveBeenCalledWith(
    'parent@gmail.com',
    'parent-secret',
    expect.objectContaining({
      studentName: 'Amina Ahmed',
      gmail: 'parent@gmail.com',
      program: 'nazra-quran',
      status: 'pending',
    }),
  );
  expect(createParentAccount.mock.calls[0][2]).not.toHaveProperty('password');
  expect(
    renderer.root
      .findAllByType(Text)
      .some(
        text =>
          text.props.children ===
          'Enrollment request sent. If this is a new parent login, verify your email before signing in.',
      ),
  ).toBe(true);

  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'back-to-parent-login' })
      .props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'back-button' }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'role-admin' }).props.onPress();
  });
  expect(() =>
    renderer.root.findByProps({ testID: 'admin-dashboard-preview' }),
  ).toThrow();
});

test('teacher board shows only students supplied from the live database', () => {
  const student = {
    id: 'STU001',
    studentName: 'Amina Ahmed',
    program: 'hifz-ul-quran',
  };
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <TeacherDashboardScreen
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[student]}
      />,
    );
  });

  expect(
    renderer.root.findByProps({ testID: 'attendance-board-STU001' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ testID: 'teacher-tab-quran' }).props.disabled,
  ).toBe(false);
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 'Amina Ahmed'),
  ).toBe(true);
  expect(
    renderer.root.findAll(node =>
      node.props.testID?.startsWith('attendance-board-demo-'),
    ),
  ).toHaveLength(0);
});

test('teacher attendance date is visible and rejects invalid dates', () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <TeacherDashboardScreen
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[
          {
            id: 'STU001',
            studentName: 'Amina Ahmed',
            program: 'hifz-ul-quran',
          },
        ]}
      />,
    );
  });

  const dateInput = renderer.root.findByProps({ testID: 'attendance-date' });
  expect(dateInput.props.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  ReactTestRenderer.act(() => {
    dateInput.props.onChangeText('2024-02-31');
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'attendance-status-present' })
      .props.onPress();
  });

  expect(
    renderer.root
      .findAllByType(Text)
      .some(
        text =>
          text.props.children ===
          'Enter a valid attendance date in YYYY-MM-DD format.',
      ),
  ).toBe(true);
});

test('teacher dashboard resets to an available student when the roster changes', () => {
  const firstStudent = {
    id: 'STU001',
    studentName: 'Amina Ahmed',
    program: 'hifz-ul-quran',
  };
  const secondStudent = {
    id: 'STU002',
    studentName: 'Bilal Ahmed',
    program: 'nazra-quran',
  };
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <TeacherDashboardScreen
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[firstStudent, secondStudent]}
      />,
    );
  });

  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'teacher-student-STU002' })
      .props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.update(
      <TeacherDashboardScreen
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[firstStudent]}
      />,
    );
  });

  expect(
    renderer.root.findByProps({ testID: 'teacher-student-STU001' }).props
      .accessibilityState.selected,
  ).toBe(true);
});

test('teacher board shows no placeholder students when the database has no records', () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <TeacherDashboardScreen
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[]}
      />,
    );
  });

  expect(
    renderer.root.findAll(node =>
      node.props.testID?.startsWith('attendance-board-'),
    ),
  ).toHaveLength(0);
  expect(
    renderer.root
      .findAllByType(Text)
      .some(
        text =>
          text.props.children ===
          'No student records are available yet. Ask an administrator to approve the enrollment request.',
      ),
  ).toBe(true);
});
