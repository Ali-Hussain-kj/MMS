import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import AdminDashboardScreen from '../Src/features/admin/AdminDashboardScreen';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactNative = require('react-native');

  return {
    SafeAreaView: ReactNative.View,
  };
});

test('admin dashboard exposes hostel management in the visible tab grid', () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <AdminDashboardScreen
        language="en"
        isAuthenticated
        onBack={jest.fn()}
        onAddStudent={jest.fn()}
        onUpdateStudent={jest.fn()}
        onDeleteStudent={jest.fn()}
        onApproveRegistration={jest.fn()}
        onDeclineRegistration={jest.fn()}
        onAddTeacher={jest.fn()}
        onUpdateTeacher={jest.fn()}
        onDeleteTeacher={jest.fn()}
        registrationRequests={[]}
        students={[]}
        teachers={[]}
        backendNotice=""
        hostelRooms={[]}
        hostelRegistrations={[]}
        hostelMeals={[]}
        hostelVisitors={[]}
        onCreateHostelRoom={jest.fn()}
        onAllocateHostelRoom={jest.fn()}
        onSaveHostelMeals={jest.fn()}
        onRecordHostelVisitor={jest.fn()}
      />,
    );
  });

    const hostelTab = renderer.root.findByProps({ testID: 'admin-tab-hostel' });
    expect(hostelTab.findByType(Text).props.children[0]).toBe('Hostel');
    expect(hostelTab.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flexBasis: '32%' })]),
    );
  });

  test('adding a teacher requires valid account credentials and sends them separately', async () => {
    const onAddTeacher = jest.fn().mockResolvedValue(undefined);
    let teacherRenderer;
    ReactTestRenderer.act(() => {
      teacherRenderer = ReactTestRenderer.create(
        <AdminDashboardScreen
          language="en"
          isAuthenticated
          onBack={jest.fn()}
          onAddStudent={jest.fn()}
          onUpdateStudent={jest.fn()}
          onDeleteStudent={jest.fn()}
          onApproveRegistration={jest.fn()}
          onDeclineRegistration={jest.fn()}
          onAddTeacher={onAddTeacher}
          onUpdateTeacher={jest.fn()}
          onDeleteTeacher={jest.fn()}
          registrationRequests={[]}
          students={[]}
          teachers={[]}
          backendNotice=""
          hostelRooms={[]}
          hostelRegistrations={[]}
          hostelMeals={[]}
          hostelVisitors={[]}
          onCreateHostelRoom={jest.fn()}
          onAllocateHostelRoom={jest.fn()}
          onSaveHostelMeals={jest.fn()}
          onRecordHostelVisitor={jest.fn()}
        />,
      );
    });

    ReactTestRenderer.act(() =>
      teacherRenderer.root
        .findByProps({ testID: 'admin-tab-teachers' })
        .props.onPress(),
    );
    ReactTestRenderer.act(() =>
      teacherRenderer.root.findByProps({ testID: 'add-teacher' }).props.onPress(),
    );

    const input = testID => teacherRenderer.root.findByProps({ testID });
    ReactTestRenderer.act(() =>
      input('teacher-name').props.onChangeText('Teacher One'),
    );
    ReactTestRenderer.act(() =>
      input('teacher-contact').props.onChangeText('123456789'),
    );
    ReactTestRenderer.act(() =>
      input('teacher-email').props.onChangeText('teacher@example.com'),
    );
    ReactTestRenderer.act(() =>
      input('teacher-password').props.onChangeText('secure123'),
    );
    await ReactTestRenderer.act(async () => {
      await teacherRenderer.root.findByProps({ testID: 'save-teacher' }).props.onPress();
    });

    expect(onAddTeacher).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Teacher One',
        email: 'teacher@example.com',
        contactNumber: '123456789',
      }),
      'secure123',
    );
    expect(onAddTeacher.mock.calls[0][0]).not.toHaveProperty('password');
    expect(
      teacherRenderer.root.findAll(node =>
        node.type === Text &&
        node.props.children?.toString().includes('verification email'),
      ),
    ).toHaveLength(1);
});

test('admin can assign a student to a Firebase teacher ID from the student form', async () => {
    const onUpdateStudent = jest.fn().mockResolvedValue(undefined);
    let renderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AdminDashboardScreen
          language="en"
          isAuthenticated
          onBack={jest.fn()}
          onAddStudent={jest.fn()}
          onUpdateStudent={onUpdateStudent}
          onDeleteStudent={jest.fn()}
          onApproveRegistration={jest.fn()}
          onDeclineRegistration={jest.fn()}
          onAddTeacher={jest.fn()}
          onUpdateTeacher={jest.fn()}
          onDeleteTeacher={jest.fn()}
          registrationRequests={[]}
          students={[
            {
              id: 'student-1',
              studentName: 'Amina Ahmed',
              fatherName: 'Ahmed',
              program: 'hifz-ul-quran',
              contactNumber: '123456789',
              teacherId: 'teacher-old-uid',
              hostelStatus: 'day',
            },
          ]}
          teachers={[
            { id: 'teacher-old-uid', name: 'Teacher Old' },
            { id: 'teacher-uid-1', name: 'Teacher One' },
          ]}
          backendNotice=""
          hostelRooms={[]}
          hostelRegistrations={[]}
          hostelMeals={[]}
          hostelVisitors={[]}
          onCreateHostelRoom={jest.fn()}
          onAllocateHostelRoom={jest.fn()}
          onSaveHostelMeals={jest.fn()}
          onRecordHostelVisitor={jest.fn()}
        />,
      );
    });

    ReactTestRenderer.act(() =>
      renderer.root.findByProps({ testID: 'admin-tab-students' }).props.onPress(),
    );
    ReactTestRenderer.act(() =>
      renderer.root.findByProps({ testID: 'edit-student-student-1' }).props.onPress(),
    );
    ReactTestRenderer.act(() =>
      renderer.root.findByProps({ testID: 'student-teacher-picker' }).props.onPress(),
    );
    ReactTestRenderer.act(() =>
      renderer.root
        .findByProps({ testID: 'student-teacher-option-teacher-uid-1' })
        .props.onPress(),
    );
    expect(
      renderer.root
        .findByProps({ testID: 'student-teacher-picker' })
        .findAllByType(Text)[0].props.children,
    ).toBe('Teacher One');

    await ReactTestRenderer.act(async () => {
      await renderer.root.findByProps({ testID: 'save-student' }).props.onPress();
    });

    expect(onUpdateStudent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'student-1', teacherId: 'teacher-uid-1' }),
    );
    expect(
      renderer.root.findByProps({
        testID: 'student-assigned-teacher-student-1',
      }).props.children,
    ).toEqual(['Assigned teacher: ', 'Teacher Old']);
});
