/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';
import TeacherDashboardScreen from '../Src/features/teacher/TeacherDashboardScreen';
import { createParentAccount } from '../Src/services/firebase/parentMonitoring';

jest.mock('../Src/services/firebase/parentMonitoring', () => ({
  approveRegistrationRequest: jest.fn(),
  createParentAccount: jest.fn().mockResolvedValue(undefined),
  declineRegistrationRequest: jest.fn(),
  removeStudent: jest.fn(),
  saveStudent: jest.fn(),
  signOutUser: jest.fn(),
  subscribeToRegistrationRequests: jest.fn(),
  subscribeToStudents: jest.fn(),
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
