import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { expect, jest, test } from '@jest/globals';
import HostelManagementScreen from '../Src/features/admin/HostelManagementScreen';

function createProps(overrides = {}) {
  return {
    language: 'en',
    students: [
      {
        id: 'STU001',
        studentName: 'Amina Ahmed',
        hostelStatus: 'resident',
      },
    ],
    rooms: [],
    registrations: [],
    attendance: [],
    meals: [],
    visitors: [],
    onCreateRoom: jest.fn().mockResolvedValue(undefined),
    onAllocateRoom: jest.fn().mockResolvedValue(undefined),
    onSaveAttendance: jest.fn().mockResolvedValue(undefined),
    onSaveMeals: jest.fn().mockResolvedValue(undefined),
    onRecordVisitor: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

test('hostel room form saves room number, floor, and bed count', async () => {
  const props = createProps();
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HostelManagementScreen {...props} />);
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'hostel-tab-rooms' }).props.onPress();
  });

  const fields = {
    'hostel-room-number': '12',
    'hostel-room-floor': 'First',
    'hostel-room-bed-count': '4',
  };
  Object.entries(fields).forEach(([testID, value]) => {
    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID }).props.onChangeText(value);
    });
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({ testID: 'hostel-create-room' }).props.onPress();
  });

  expect(props.onCreateRoom).toHaveBeenCalledWith({
    roomNumber: '12',
    floor: 'First',
    bedCount: '4',
  });
});

test('hostel allocation uses an existing resident and selected bed', async () => {
  const props = createProps({
    rooms: [
      {
        id: 'room-first-12',
        roomNumber: '12',
        floor: 'First',
        bedCount: 4,
        allocations: {},
      },
    ],
  });
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HostelManagementScreen {...props} />);
  });

  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'hostel-student-id' })
      .props.onChangeText('STU001');
    renderer.root
      .findByProps({ testID: 'hostel-select-room-room-first-12' })
      .props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'hostel-bed-number' })
      .props.onChangeText('2');
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'hostel-allocate-room' })
      .props.onPress();
  });

  expect(props.onAllocateRoom).toHaveBeenCalledWith(
    expect.objectContaining({
      studentId: 'STU001',
      studentName: 'Amina Ahmed',
      roomId: 'room-first-12',
      bedNumber: '2',
    }),
  );
});

test('hostel admin can search registered students and filter them by floor', () => {
  const props = createProps({
    isHostelAdmin: true,
    registrations: [
      {
        id: 'STU001',
        studentId: 'STU001',
        studentName: 'Amina Ahmed',
        roomNumber: '12',
        floor: 'First',
        bedNumber: 1,
        admissionDate: '2026-10-01',
      },
      {
        id: 'STU002',
        studentId: 'STU002',
        studentName: 'Bilal Ahmed',
        roomNumber: '20',
        floor: 'Second',
        bedNumber: 3,
        admissionDate: '2026-10-02',
      },
    ],
  });
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HostelManagementScreen {...props} />);
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'hostel-tab-registered' })
      .props.onPress();
  });

  expect(
    renderer.root.findByProps({ testID: 'registered-student-STU001' }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({ testID: 'registered-student-STU002' }),
  ).toBeTruthy();

  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'hostel-registered-search' })
      .props.onChangeText('Bilal');
  });
  expect(
    renderer.root.findByProps({ testID: 'registered-student-STU002' }),
  ).toBeTruthy();
  expect(() =>
    renderer.root.findByProps({ testID: 'registered-student-STU001' }),
  ).toThrow();

  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'hostel-registered-search' })
      .props.onChangeText('');
    renderer.root
      .findByProps({ testID: 'hostel-floor-filter-First' })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ testID: 'registered-student-STU001' }),
  ).toBeTruthy();
  expect(() =>
    renderer.root.findByProps({ testID: 'registered-student-STU002' }),
  ).toThrow();
});

test('hostel attendance records status for a registered resident', async () => {
  const props = createProps({
    registrations: [
      { id: 'STU001', studentId: 'STU001', studentName: 'Amina Ahmed' },
    ],
  });
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HostelManagementScreen {...props} />);
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'hostel-tab-attendance' })
      .props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ testID: 'hostel-attendance-student-id' })
      .props.onChangeText('STU001');
    renderer.root
      .findByProps({ testID: 'hostel-attendance-status-absent' })
      .props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root
      .findByProps({ testID: 'hostel-save-attendance' })
      .props.onPress();
  });

  expect(props.onSaveAttendance).toHaveBeenCalledWith(
    expect.objectContaining({
      studentId: 'STU001',
      studentName: 'Amina Ahmed',
      status: 'absent',
    }),
  );
});
