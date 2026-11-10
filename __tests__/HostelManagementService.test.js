import { expect, test } from '@jest/globals';
import {
  allocateHostelRoom,
  createHostelRoom,
  recordHostelVisitor,
  saveHostelAttendance,
  saveHostelMeals,
} from '../Src/services/firebase/parentMonitoring';

test('hostel service rejects incomplete and invalid records before saving', async () => {
  await expect(
    createHostelRoom({ roomNumber: '12', floor: 'First', bedCount: 0 }),
  ).rejects.toThrow('positive whole-number bed count');
  await expect(
    allocateHostelRoom({
      studentId: 'STU001',
      roomId: 'room-1',
      bedNumber: '2',
      admissionDate: '2024-02-31',
    }),
  ).rejects.toThrow('admission date');
  await expect(
    saveHostelAttendance({
      studentId: 'STU001',
      date: '2024-02-31',
      status: 'present',
    }),
  ).rejects.toThrow('valid date');
  await expect(
    saveHostelMeals({
      studentId: 'STU001',
      date: '2024-01-01',
      breakfast: false,
      lunch: false,
      dinner: false,
    }),
  ).rejects.toThrow('Select at least one meal');
  await expect(
    recordHostelVisitor({
      studentId: 'STU001',
      visitorName: 'Ahmed',
      relation: 'Father',
      visitTime: '2024-01-01 24:61',
    }),
  ).rejects.toThrow('valid visit time');
});
