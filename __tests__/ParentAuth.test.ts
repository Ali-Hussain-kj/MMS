import {
  allocateApprovedHostelRequest,
  allocateHostelRoom,
  approveRegistrationRequest,
  createParentAccount,
  createParentHostelRequest,
  declineRegistrationRequest,
  reviewHostelRequest,
  removeStudent,
  saveStudent,
  sendParentPasswordReset,
  signInForRole,
  subscribeToAuthSession,
  subscribeToTeacherStudents,
} from '../Src/services/firebase/parentMonitoring';
import { getFirebaseServices } from '../Src/services/firebase/firebase';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';

jest.mock('../Src/services/firebase/firebase', () => ({
  getFirebaseServices: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  onAuthStateChanged: jest.fn(),
  reload: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  onSnapshot: jest.fn(),
  runTransaction: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

let transaction;

beforeEach(() => {
  jest.clearAllMocks();
  transaction = {
    delete: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
  };
  runTransaction.mockImplementation((_db, callback) => callback(transaction));
  getFirebaseServices.mockReturnValue({ auth: {}, db: {} });
  signInWithEmailAndPassword.mockResolvedValue({
    user: {
      uid: 'parent-1',
      email: 'parent@example.com',
      emailVerified: true,
      getIdToken: jest.fn().mockResolvedValue('fresh-parent-token'),
    },
  });
  createUserWithEmailAndPassword.mockResolvedValue({
    user: {
      uid: 'parent-1',
      email: 'parent@example.com',
      emailVerified: false,
    },
  });
  sendEmailVerification.mockResolvedValue(undefined);
  sendPasswordResetEmail.mockResolvedValue(undefined);
  signOut.mockResolvedValue(undefined);
  collection.mockReturnValue('registration-requests');
  doc.mockImplementation((...args) =>
    args.length === 1 ? { id: 'registration-1' } : 'parent-profile',
  );
  setDoc.mockResolvedValue(undefined);
});

test('sends a password reset email to the normalized parent email', async () => {
  await sendParentPasswordReset(' parent@example.com ');

  expect(sendPasswordResetEmail).toHaveBeenCalledWith(
    {},
    'parent@example.com',
  );
});

test('student edits preserve the existing hostel status in both records', async () => {
  getFirebaseServices.mockReturnValue({
    auth: { currentUser: { uid: 'admin-1' } },
    db: {},
  });
  transaction.get.mockResolvedValue({
    exists: () => true,
    data: () => ({ hostelStatus: 'resident' }),
  });

  await saveStudent({
    id: 'student-1',
    studentName: 'Amina Ahmed',
    hostelStatus: 'day',
  });

  expect(transaction.set).toHaveBeenNthCalledWith(
    1,
    'parent-profile',
    expect.objectContaining({ hostelStatus: 'resident' }),
  );
  expect(transaction.set).toHaveBeenNthCalledWith(
    2,
    'parent-profile',
    expect.objectContaining({ hostelStatus: 'resident' }),
  );
});

test('student deletion is blocked while a hostel registration exists', async () => {
  getFirebaseServices.mockReturnValue({
    auth: { currentUser: { uid: 'admin-1' } },
    db: {},
  });
  transaction.get
    .mockResolvedValueOnce({ exists: () => true })
    .mockResolvedValueOnce({ exists: () => false });

  await expect(removeStudent('student-1')).rejects.toThrow(
    'Resolve the student’s hostel registration or pending request',
  );
  expect(transaction.delete).not.toHaveBeenCalled();
});

test('requires an email address before requesting a parent password reset', async () => {
  await expect(sendParentPasswordReset('  ')).rejects.toThrow(
    'Enter your parent account email address first.',
  );
  expect(sendPasswordResetEmail).not.toHaveBeenCalled();
});

test('restores a verified Firebase session using its Firestore role', async () => {
  const user = {
    uid: 'hostel-admin-1',
    email: 'hostel@example.com',
    emailVerified: true,
    getIdToken: jest.fn().mockResolvedValue('fresh-token'),
  };
  let authListener;
  onAuthStateChanged.mockImplementation((_auth, listener) => {
    authListener = listener;
    return jest.fn();
  });

  reload.mockResolvedValue(undefined);
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ role: 'hostelAdmin' }),
  });

  const restoredSession = new Promise((resolve, reject) => {
    subscribeToAuthSession(session => {
      if (session) {
        resolve(session);
      }
    }, reject);
    authListener(user);
  });

  await expect(restoredSession).resolves.toEqual({
    uid: 'hostel-admin-1',
    email: 'hostel@example.com',
    role: 'hostelAdmin',
  });
  expect(reload).toHaveBeenCalledWith(user);
  expect(user.getIdToken).toHaveBeenCalledWith(true);
});

test('teacher subscriptions listen only to student IDs assigned in the trusted profile', () => {
  getFirebaseServices.mockReturnValue({ auth: {}, db: {} });
  doc.mockImplementation((_db, ...segments) => segments.join('/'));
  onSnapshot.mockImplementation((reference, onNext) => {
    if (reference === 'users/teacher-1') {
      onNext({
        exists: () => true,
        data: () => ({
          role: 'teacher',
          studentIds: ['student-1'],
        }),
      });
    } else {
      onNext({
        exists: () => true,
        id: 'student-1',
        data: () => ({ studentName: 'Amina Ahmed' }),
      });
    }
    return jest.fn();
  });
  const onChange = jest.fn();

  const unsubscribe = subscribeToTeacherStudents(
    'teacher-1',
    onChange,
    jest.fn(),
  );

  expect(onSnapshot.mock.calls.map(([reference]) => reference)).toEqual([
    'users/teacher-1',
    'students/student-1',
  ]);
  expect(onChange).toHaveBeenLastCalledWith([
    { id: 'student-1', studentName: 'Amina Ahmed' },
  ]);
  unsubscribe();
});

test('creates the parent login and saves the student request without its password', async () => {
  const registration = {
    studentName: 'Amina Ahmed',
    fatherName: 'Ahmed Ali',
    gmail: 'parent@example.com',
    program: 'hifz-ul-quran',
  };
  await createParentAccount('parent@example.com', 'secret123', registration);

  expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
    {},
    'parent@example.com',
    'secret123',
  );
  expect(sendEmailVerification).toHaveBeenCalledWith({
    uid: 'parent-1',
    email: 'parent@example.com',
    emailVerified: false,
  });
  expect(transaction.set).toHaveBeenCalledWith(
    { id: 'registration-1' },
    expect.objectContaining({
      ...registration,
      parentUid: 'parent-1',
      parentEmail: 'parent@example.com',
      status: 'pending',
    }),
  );
  expect(transaction.set.mock.calls[0][1]).not.toHaveProperty('password');
  expect(signOut).toHaveBeenCalled();
});

test('hostel student registration creates a pending hostel request atomically', async () => {
  await createParentAccount('parent@example.com', 'secret123', {
    studentName: 'Amina Ahmed',
    fatherName: 'Ahmed Ali',
    className: '3',
    program: 'asri-taleem-class-1-10',
    contactNumber: '03001234567',
    hostelStatus: 'resident',
  });

  expect(transaction.set).toHaveBeenCalledTimes(3);
  expect(transaction.set.mock.calls[1][1]).toEqual(
    expect.objectContaining({
      studentId: 'registration-1',
      requestType: 'admission',
      status: 'pending',
      className: '3',
      parentUid: 'parent-1',
    }),
  );
  expect(transaction.set.mock.calls[2][1]).toEqual(
    expect.objectContaining({
      requestId: 'registration-1',
      requestType: 'admission',
      status: 'pending',
    }),
  );
});

test('day student registration does not create a hostel request or active lock', async () => {
  await createParentAccount('parent@example.com', 'secret123', {
    studentName: 'Amina Ahmed',
    hostelStatus: 'day',
  });

  expect(transaction.set).toHaveBeenCalledTimes(1);
});

test('linked parents can submit one hostel request for their child', async () => {
  doc.mockImplementation((...args) =>
    args.length === 1 ? { id: 'hostel-request-1' } : args.slice(1).join('/'),
  );
  transaction.get
    .mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'parent', email: 'parent@example.com', studentIds: ['STU001'] }),
    })
    .mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ studentName: 'Amina Ahmed', hostelStatus: 'day' }),
    })
    .mockResolvedValueOnce({ exists: () => false })
    .mockResolvedValueOnce({ exists: () => false });

  await createParentHostelRequest('STU001', 'parent-1', 'admission');

  expect(transaction.set).toHaveBeenCalledTimes(2);
  expect(transaction.set.mock.calls[0][1]).toEqual(
    expect.objectContaining({
      studentId: 'STU001',
      parentUid: 'parent-1',
      requestType: 'admission',
      status: 'pending',
    }),
  );
  expect(transaction.set.mock.calls[1][1]).toEqual(
    expect.objectContaining({
      requestId: 'hostel-request-1',
      status: 'pending',
    }),
  );
});

test('prevents a second pending parent hostel request', async () => {
  transaction.get
    .mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'parent', studentIds: ['STU001'] }),
    })
    .mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ studentName: 'Amina Ahmed', hostelStatus: 'day' }),
    })
    .mockResolvedValueOnce({ exists: () => false })
    .mockResolvedValueOnce({ exists: () => true });

  await expect(
    createParentHostelRequest('STU001', 'parent-1', 'admission'),
  ).rejects.toThrow('already pending review');
  expect(transaction.set).not.toHaveBeenCalled();
});

test('hostel admin approval keeps an admission request active until allocation', async () => {
  doc.mockImplementation((_db, collectionName, id) => `${collectionName}/${id}`);
  transaction.get
    .mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ studentId: 'STU001', requestType: 'admission', status: 'pending' }),
    })
    .mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ requestId: 'request-1' }),
    });

  await reviewHostelRequest('request-1', 'approve');

  expect(transaction.update).toHaveBeenCalledWith(
    'hostelRequests/request-1',
    expect.objectContaining({ status: 'approved' }),
  );
  expect(transaction.update).toHaveBeenCalledWith(
    'hostelActiveRequests/STU001',
    expect.objectContaining({ status: 'approved' }),
  );
  expect(transaction.delete).not.toHaveBeenCalled();
});

test('approved hostel request allocates one available bed and activates the student', async () => {
  doc.mockImplementation((_db, collectionName, id) => `${collectionName}/${id}`);
  transaction.get.mockImplementation(ref => {
    const records = {
      'hostelRequests/request-1': {
        exists: () => true,
        data: () => ({
          studentId: 'STU001',
          studentName: 'Amina Ahmed',
          requestType: 'admission',
          status: 'approved',
        }),
      },
      'hostelActiveRequests/STU001': {
        exists: () => true,
        data: () => ({ requestId: 'request-1' }),
      },
      'hostelRegistrations/STU001': { exists: () => false },
      'students/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'day' }),
      },
      'hostelStudentRoster/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'day' }),
      },
      'hostelRooms/room-1': {
        exists: () => true,
        data: () => ({
          roomNumber: '12',
          floor: 'First',
          bedCount: 2,
          allocations: { 1: 'STU002' },
        }),
      },
    };
    return Promise.resolve(records[ref]);
  });

  await allocateApprovedHostelRequest('request-1', {
    roomId: 'room-1',
    bedNumber: 2,
  });

  expect(transaction.update).toHaveBeenCalledWith(
    'hostelRooms/room-1',
    { allocations: { 1: 'STU002', 2: 'STU001' } },
  );
  expect(transaction.set).toHaveBeenCalledWith(
    'hostelRegistrations/STU001',
    expect.objectContaining({ roomNumber: '12', bedNumber: 2 }),
  );
  expect(transaction.update).toHaveBeenCalledWith(
    'students/STU001',
    { hostelStatus: 'resident' },
  );
  expect(transaction.delete).toHaveBeenCalledWith(
    'hostelActiveRequests/STU001',
  );
});

test('cancellation approval releases only the bed assigned to that student', async () => {
  doc.mockImplementation((_db, collectionName, id) => `${collectionName}/${id}`);
  transaction.get.mockImplementation(ref => {
    const records = {
      'hostelRequests/cancel-1': {
        exists: () => true,
        data: () => ({
          studentId: 'STU001',
          requestType: 'cancellation',
          status: 'pending',
        }),
      },
      'hostelActiveRequests/STU001': {
        exists: () => true,
        data: () => ({ requestId: 'cancel-1' }),
      },
      'hostelRegistrations/STU001': {
        exists: () => true,
        data: () => ({ roomId: 'room-1', bedNumber: 2 }),
      },
      'students/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'resident' }),
      },
      'hostelRooms/room-1': {
        exists: () => true,
        data: () => ({
          allocations: { 1: 'STU002', 2: 'STU001' },
        }),
      },
    };
    return Promise.resolve(records[ref]);
  });

  await reviewHostelRequest('cancel-1', 'approve');

  expect(transaction.update).toHaveBeenCalledWith(
    'hostelRooms/room-1',
    { allocations: { 1: 'STU002' } },
  );
  expect(transaction.update).toHaveBeenCalledWith(
    'students/STU001',
    { hostelStatus: 'day' },
  );
  expect(transaction.delete).toHaveBeenCalledWith(
    'hostelRegistrations/STU001',
  );
});

test('cancellation approval fails rather than releasing another student’s bed', async () => {
  doc.mockImplementation((_db, collectionName, id) => `${collectionName}/${id}`);
  transaction.get.mockImplementation(ref => {
    const records = {
      'hostelRequests/cancel-1': {
        exists: () => true,
        data: () => ({
          studentId: 'STU001',
          requestType: 'cancellation',
          status: 'pending',
        }),
      },
      'hostelActiveRequests/STU001': {
        exists: () => true,
        data: () => ({ requestId: 'cancel-1' }),
      },
      'hostelRegistrations/STU001': {
        exists: () => true,
        data: () => ({ roomId: 'room-1', bedNumber: 2 }),
      },
      'students/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'resident' }),
      },
      'hostelRooms/room-1': {
        exists: () => true,
        data: () => ({ allocations: { 2: 'STU002' } }),
      },
    };
    return Promise.resolve(records[ref]);
  });

  await expect(reviewHostelRequest('cancel-1', 'approve')).rejects.toThrow(
    'not allocated to this student',
  );
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.delete).not.toHaveBeenCalled();
});

test('manual room allocation requires a resident with no active hostel request', async () => {
  doc.mockImplementation((_db, collectionName, id) => `${collectionName}/${id}`);
  transaction.get.mockImplementation(ref => {
    const records = {
      'hostelRegistrations/STU001': { exists: () => false },
      'hostelRooms/room-1': {
        exists: () => true,
        data: () => ({
          roomNumber: '12',
          floor: 'First',
          bedCount: 2,
          allocations: {},
        }),
      },
      'students/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'resident' }),
      },
      'hostelStudentRoster/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'resident' }),
      },
      'hostelActiveRequests/STU001': { exists: () => false },
    };
    return Promise.resolve(records[ref]);
  });

  await allocateHostelRoom({
    studentId: 'STU001',
    studentName: 'Amina Ahmed',
    roomId: 'room-1',
    bedNumber: 2,
    admissionDate: '2026-11-11',
  });

  expect(transaction.update).toHaveBeenCalledWith(
    'hostelRooms/room-1',
    { allocations: { 2: 'STU001' } },
  );
  expect(transaction.set).toHaveBeenCalledWith(
    'hostelRegistrations/STU001',
    expect.objectContaining({ bedNumber: 2 }),
  );
});

test('manual room allocation rejects day students before writing', async () => {
  doc.mockImplementation((_db, collectionName, id) => `${collectionName}/${id}`);
  transaction.get.mockImplementation(ref => {
    const records = {
      'hostelRegistrations/STU001': { exists: () => false },
      'hostelRooms/room-1': { exists: () => true },
      'students/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'day' }),
      },
      'hostelStudentRoster/STU001': {
        exists: () => true,
        data: () => ({ hostelStatus: 'day' }),
      },
      'hostelActiveRequests/STU001': { exists: () => false },
    };
    return Promise.resolve(records[ref]);
  });

  await expect(
    allocateHostelRoom({
      studentId: 'STU001',
      roomId: 'room-1',
      bedNumber: 1,
      admissionDate: '2026-11-11',
    }),
  ).rejects.toThrow('Only an approved hostel resident');
  expect(transaction.set).not.toHaveBeenCalled();
  expect(transaction.update).not.toHaveBeenCalled();
});

test('declining a new student also closes its pending hostel request', async () => {
  doc.mockImplementation((_db, collectionName, id) => `${collectionName}/${id}`);
  transaction.get.mockImplementation(_ref =>
    Promise.resolve({
      exists: () => true,
      data: () => ({
        source: 'registration',
        status: 'pending',
      }),
    }),
  );

  await declineRegistrationRequest('STU001');

  expect(transaction.delete).toHaveBeenCalledWith(
    'registrationRequests/STU001',
  );
  expect(transaction.update).toHaveBeenCalledWith(
    'hostelRequests/STU001',
    expect.objectContaining({ status: 'rejected' }),
  );
  expect(transaction.delete).toHaveBeenCalledWith(
    'hostelActiveRequests/STU001',
  );
});

test('reuses an existing parent login for another child registration', async () => {
  const existingUser = {
    uid: 'parent-1',
    email: 'parent@example.com',
    emailVerified: true,
  };
  createUserWithEmailAndPassword.mockRejectedValue({
    code: 'auth/email-already-in-use',
  });
  signInWithEmailAndPassword.mockResolvedValue({ user: existingUser });
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ role: 'parent' }),
  });

  await createParentAccount('parent@example.com', 'secret123', {
    studentName: 'Amina Ahmed',
  });

  expect(sendEmailVerification).not.toHaveBeenCalled();
  expect(signOut).toHaveBeenCalled();
});

test('does not reuse credentials belonging to a non-parent account', async () => {
  createUserWithEmailAndPassword.mockRejectedValue({
    code: 'auth/email-already-in-use',
  });
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ role: 'admin' }),
  });

  await expect(
    createParentAccount('parent@example.com', 'secret123', {
      studentName: 'Amina Ahmed',
    }),
  ).rejects.toThrow('non-parent account');

  expect(signOut).toHaveBeenCalled();
});

test('approves a request by creating the student and linking the parent in one transaction', async () => {
  const approvalTransaction = {
    get: jest
      .fn()
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          studentName: 'Amina Ahmed',
          hostelStatus: 'resident',
          parentUid: 'parent-1',
          parentEmail: 'parent@example.com',
          status: 'pending',
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'parent', studentIds: ['older-student'] }),
      }),
    set: jest.fn(),
    delete: jest.fn(),
  };
  runTransaction.mockImplementation((_db, callback) =>
    callback(approvalTransaction),
  );
  doc.mockImplementation(
    (_db, collectionName, id) => `${collectionName}/${id}`,
  );

  await approveRegistrationRequest('request-1');

  expect(approvalTransaction.set).toHaveBeenCalledWith('students/request-1', {
    studentName: 'Amina Ahmed',
    hostelStatus: 'day',
    id: 'request-1',
  });
  expect(approvalTransaction.set).toHaveBeenCalledWith(
    'hostelStudentRoster/request-1',
    {
      id: 'request-1',
      studentName: 'Amina Ahmed',
      fatherName: '',
      className: '',
      program: '',
      contactNumber: '',
      hostelStatus: 'day',
    },
  );
  expect(approvalTransaction.set).toHaveBeenCalledWith(
    'users/parent-1',
    {
      email: 'parent@example.com',
      role: 'parent',
      studentIds: ['older-student', 'request-1'],
    },
    { merge: true },
  );
  expect(approvalTransaction.delete).toHaveBeenCalledWith(
    'registrationRequests/request-1',
  );
});

test('creates an unlinked parent profile only after verified parent sign-in', async () => {
  const getIdToken = jest.fn().mockResolvedValue('fresh-parent-token');
  signInWithEmailAndPassword.mockResolvedValue({
    user: {
      uid: 'parent-1',
      email: 'parent@example.com',
      emailVerified: true,
      getIdToken,
    },
  });
  getDoc.mockResolvedValueOnce({ exists: () => false }).mockResolvedValueOnce({
    exists: () => true,
    data: () => ({ role: 'parent', studentIds: [] }),
  });

  await expect(
    signInForRole('parent@example.com', 'secret123', 'parent'),
  ).resolves.toEqual({
    uid: 'parent-1',
    email: 'parent@example.com',
    role: 'parent',
  });

  expect(setDoc).toHaveBeenCalledWith('parent-profile', {
    email: 'parent@example.com',
    role: 'parent',
    studentIds: [],
  });
  expect(getIdToken).toHaveBeenCalledWith(true);
});

test('rejects accounts without the requested role and signs them out', async () => {
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ role: 'teacher' }),
  });
  await expect(
    signInForRole('parent@example.com', 'secret123', 'parent'),
  ).rejects.toThrow('not authorized to sign in as parent');

  expect(signOut).toHaveBeenCalled();
});

test('shared admin sign-in identifies a hostel admin from the Firestore profile', async () => {
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ role: 'hostelAdmin' }),
  });

  await expect(
    signInForRole('hostel@example.com', 'secret123', 'admin'),
  ).resolves.toEqual({
    uid: 'parent-1',
    email: 'parent@example.com',
    role: 'hostelAdmin',
  });
});

test('explains that Firestore rules need publishing when parent profile creation is denied', async () => {
  getDoc.mockResolvedValue({ exists: () => false });
  setDoc.mockRejectedValue({ code: 'permission-denied' });

  await expect(
    signInForRole('parent@example.com', 'secret123', 'parent'),
  ).rejects.toThrow('Publish the latest firestore.rules');

  expect(signOut).toHaveBeenCalled();
});

test('sends an email verification link before rejecting an unverified sign-in', async () => {
  signInWithEmailAndPassword.mockResolvedValue({
    user: {
      uid: 'parent-1',
      email: 'parent@example.com',
      emailVerified: false,
      getIdToken: jest.fn(),
    },
  });

  await expect(
    signInForRole('parent@example.com', 'secret123', 'parent'),
  ).rejects.toMatchObject({
    code: 'auth/email-not-verified',
    email: 'parent@example.com',
  });

  expect(sendEmailVerification).toHaveBeenCalled();
  expect(getDoc).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
  expect(signOut).toHaveBeenCalled();
});
