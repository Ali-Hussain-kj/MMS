import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import FinanceManagementScreen from '../Src/features/admin/FinanceManagementScreen';

test('finance screen saves a fee against a selected student', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <FinanceManagementScreen
        records={[]}
        students={[{ id: 'student-1', studentName: 'Amina Ahmed' }]}
        teachers={[]}
        onSave={onSave}
        onDelete={jest.fn()}
      />,
    );
  });

  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'finance-add-record' }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'finance-person-student-1' }).props.onPress();
    renderer.root.findByProps({ testID: 'finance-amount' }).props.onChangeText('1200');
    renderer.root.findByProps({ testID: 'finance-category' }).props.onChangeText('Tuition');
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({ testID: 'finance-save-record' }).props.onPress();
  });

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'fee',
      amount: 1200,
      entityId: 'student-1',
      entityName: 'Amina Ahmed',
      category: 'Tuition',
    }),
  );
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 'Financial record saved.'),
  ).toBe(true);
});

test('finance report totals only saved records for the selected month', () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <FinanceManagementScreen
        records={[
          { id: 'fee-1', type: 'fee', amount: 900, date: '2025-03-05', entityName: 'Amina', category: 'Tuition' },
          { id: 'salary-1', type: 'salary', amount: 300, date: '2025-03-10', entityName: 'Teacher', category: 'Salary' },
          { id: 'donation-1', type: 'donation', amount: 500, date: '2025-02-10', entityName: 'Donor', category: 'General' },
        ]}
        students={[]}
        teachers={[]}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'finance-report-month' }).props.onChangeText('2025-03');
  });

  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 900),
  ).toBe(true);
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 300),
  ).toBe(true);
  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 600),
  ).toBe(true);
});

test('finance screen rejects invalid monetary amounts', async () => {
  let renderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <FinanceManagementScreen
        records={[]}
        students={[{ id: 'student-1', studentName: 'Amina Ahmed' }]}
        teachers={[]}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'finance-add-record' }).props.onPress();
  });
  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ testID: 'finance-person-student-1' }).props.onPress();
    renderer.root.findByProps({ testID: 'finance-category' }).props.onChangeText('Tuition');
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({ testID: 'finance-save-record' }).props.onPress();
  });

  expect(
    renderer.root
      .findAllByType(Text)
      .some(text => text.props.children === 'Enter an amount greater than zero.'),
  ).toBe(true);
});
