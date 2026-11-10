import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import ParentMonitoringScreen from '../Src/features/parent/ParentMonitoringScreen';
import TeacherDashboardScreen from '../Src/features/teacher/TeacherDashboardScreen';
import { subscribeToParentReports } from '../Src/services/firebase/parentMonitoring';
import {
  createParentHostelRequest,
  saveSchoolSubjects,
  saveTeacherReport,
  subscribeToParentHostelRequests,
  subscribeToSchoolSubjects,
  subscribeToTeacherReports,
} from '../Src/services/firebase/parentMonitoring';

jest.mock('react-native-safe-area-context', () => {
  const ReactNative = require('react-native');

  return {
    SafeAreaView: ReactNative.View,
  };
});

jest.mock('../Src/services/firebase/parentMonitoring', () => ({
  createParentHostelRequest: jest.fn(),
  saveSchoolSubjects: jest.fn(),
  saveTeacherReport: jest.fn(),
  subscribeToParentHostelRequests: jest.fn(),
  subscribeToParentReports: jest.fn(),
  subscribeToSchoolSubjects: jest.fn(),
  subscribeToTeacherReports: jest.fn(),
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
          hostelStatus: 'resident',
        },
        hostelRegistration: {
          roomNumber: '12',
          floor: 'First',
          bedNumber: 2,
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
  subscribeToParentHostelRequests.mockImplementation((_uid, onChange) => {
    onChange([]);
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
    renderer.root.findByProps({ testID: 'parent-hostel-room-details' }),
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

test('parent can request hostel admission for a linked day student', async () => {
  subscribeToParentReports.mockImplementation((_uid, onChange) => {
    onChange([
      {
        student: {
          id: 'day-child',
          studentName: 'Amina Ahmed',
          hostelStatus: 'day',
        },
        attendance: [],
        hifzProgress: [],
        nazraProgress: [],
      },
    ]);
    return jest.fn();
  });
  subscribeToParentHostelRequests.mockImplementation((_uid, onChange) => {
    onChange([]);
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
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'parent-hostel-request' })
      .props.onPress();
  });

  expect(createParentHostelRequest).toHaveBeenCalledWith(
    'day-child',
    'parent-1',
    'admission',
  );
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 'Hostel request submitted for review.'),
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

test('teacher loads persisted Dars progress and saves updates to Firestore', async () => {
  const student = {
    id: 'dars-student',
    studentName: 'Amina Ahmed',
    program: 'dars-e-nizami',
  };
  subscribeToTeacherReports.mockImplementation((studentId, onChange) => {
    onChange({
      attendance: [],
      hifzProgress: [],
      nazraProgress: [],
      darsProgress: [
        {
          id: 'book-sharh',
          studentId,
          studentName: student.studentName,
          book: 'Sharh',
          chapters: 2,
          pages: 14,
          percentage: 40,
        },
      ],
      takrarAttendance: [],
      schoolResults: [],
    });
    return jest.fn();
  });
  subscribeToSchoolSubjects.mockImplementation((className, onChange) => {
    onChange([]);
    return jest.fn();
  });
  saveTeacherReport.mockResolvedValue(undefined);

  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <TeacherDashboardScreen
        isAuthenticated
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[student]}
      />,
    );
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'teacher-tab-dars' }).props.onPress();
  });

  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 'Sharh'),
  ).toBe(true);

  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'kitab-name' }).props.onChangeText('New Book');
    renderer.root.findByProps({ testID: 'kitab-chapters' }).props.onChangeText('3');
    renderer.root.findByProps({ testID: 'kitab-pages' }).props.onChangeText('18');
    renderer.root.findByProps({ testID: 'kitab-percentage' }).props.onChangeText('25');
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({ testID: 'save-kitab-progress' }).props.onPress();
  });

  expect(saveTeacherReport).toHaveBeenCalledWith(
    'dars-student',
    'darsProgress',
    expect.objectContaining({
      book: 'New Book',
      percentage: 25,
    }),
  );
});

test('teacher persists class subjects in the shared class catalog', async () => {
  const student = {
    id: 'school-student',
    studentName: 'Bilal Ahmed',
    program: 'asri-taleem-class-1-10',
  };
  subscribeToTeacherReports.mockImplementation((studentId, onChange) => {
    onChange({
      attendance: [],
      hifzProgress: [],
      nazraProgress: [],
      darsProgress: [],
      takrarAttendance: [],
      schoolResults: [],
    });
    return jest.fn();
  });
  subscribeToSchoolSubjects.mockImplementation((className, onChange) => {
    onChange(['English']);
    return jest.fn();
  });
  saveSchoolSubjects.mockResolvedValue(undefined);

  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <TeacherDashboardScreen
        isAuthenticated
        language="en"
        onBack={jest.fn()}
        onPromoteStudent={jest.fn()}
        students={[student]}
      />,
    );
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'teacher-tab-school' }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'new-school-subject' }).props.onChangeText('Arabic');
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({ testID: 'add-school-subject' }).props.onPress();
  });

  expect(saveSchoolSubjects).toHaveBeenCalledWith('1', ['English', 'Arabic']);
});
