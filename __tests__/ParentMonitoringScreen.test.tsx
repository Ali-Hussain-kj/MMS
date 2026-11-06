import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import ParentMonitoringScreen from '../Src/features/parent/ParentMonitoringScreen';
import TeacherDashboardScreen from '../Src/features/teacher/TeacherDashboardScreen';
import { subscribeToParentReports } from '../Src/services/firebase/parentMonitoring';

jest.mock('react-native-safe-area-context', () => {
  const ReactNative = require('react-native');

  return {
    SafeAreaView: ReactNative.View,
  };
});

jest.mock('../Src/services/firebase/parentMonitoring', () => ({
  subscribeToParentReports: jest.fn(),
  saveTeacherReport: jest.fn(),
}));

test('parent sees only linked-child daily, weekly, monthly, Hifz, and Nazra reports', () => {
  const reportDate = new Date().toISOString().slice(0, 10);
  subscribeToParentReports.mockImplementation((uid, onChange) => {
    onChange([
      {
        student: {
          id: 'linked-child',
          studentName: 'Amina Ahmed',
          program: 'hifz-ul-quran',
        },
        attendance: [
          { id: 'attendance-1', date: reportDate, status: 'present' },
        ],
        hifzProgress: [
          {
            id: 'hifz-1',
            type: 'sabaq',
            date: reportDate,
            surah: 'Al-Baqarah',
            ayahRange: '1-5',
            pages: '1',
          },
        ],
        nazraProgress: [
          {
            id: 'nazra-1',
            date: reportDate,
            page: '12',
            completion: 100,
            fluency: 'Good',
            remarks: 'Clear reading',
          },
        ],
      },
    ]);
    return jest.fn();
  });

  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ParentMonitoringScreen
        language="en"
        user={{ uid: 'parent-1', email: 'parent@example.com' }}
        onSignOut={jest.fn()}
      />,
    );
  });

  expect(
    renderer.root.findByProps({ testID: 'parent-child-linked-child' }),
  ).toBeTruthy();
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 'Amina Ahmed'),
  ).toBe(true);
  expect(
    renderer.root.findByProps({ testID: 'parent-attendance-daily' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ testID: 'parent-attendance-weekly' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ testID: 'parent-attendance-monthly' }),
  ).toBeTruthy();
  expect(
    renderer.root
      .findAllByType(Text)
      .some(
        text =>
          typeof text.props.children === 'string' &&
          text.props.children.includes('Clear reading'),
      ),
  ).toBe(true);
});

test('authenticated teacher does not see preview students when no real students are linked', () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <TeacherDashboardScreen
        isAuthenticated
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[]}
      />,
    );
  });

  expect(
    renderer.root.findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('attendance-board-'),
    ),
  ).toHaveLength(0);
  expect(
    renderer.root
      .findAllByType(Text)
      .some(
        text =>
          typeof text.props.children === 'string' &&
          text.props.children.includes('Sample students'),
      ),
  ).toBe(false);
});
