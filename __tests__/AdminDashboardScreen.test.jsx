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
