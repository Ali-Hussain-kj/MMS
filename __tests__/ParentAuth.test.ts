import {
  approveRegistrationRequest,
  createParentAccount,
  signInForRole,
} from '../Src/services/firebase/parentMonitoring';
import { getFirebaseServices } from '../Src/services/firebase/firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from 'firebase/firestore';

jest.mock('../Src/services/firebase/firebase', () => ({
  getFirebaseServices: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  sendEmailVerification: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  runTransaction: jest.fn(),
  setDoc: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
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
  signOut.mockResolvedValue(undefined);
  addDoc.mockResolvedValue({ id: 'request-1' });
  collection.mockReturnValue('registration-requests');
  doc.mockReturnValue('parent-profile');
  setDoc.mockResolvedValue(undefined);
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
  expect(addDoc).toHaveBeenCalledWith(
    'registration-requests',
    expect.objectContaining({
      ...registration,
      parentUid: 'parent-1',
      parentEmail: 'parent@example.com',
      status: 'pending',
    }),
  );
  expect(addDoc.mock.calls[0][1]).not.toHaveProperty('password');
  expect(signOut).toHaveBeenCalled();
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
  const transaction = {
    get: jest
      .fn()
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          studentName: 'Amina Ahmed',
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
  runTransaction.mockImplementation((_db, callback) => callback(transaction));
  doc.mockImplementation(
    (_db, collectionName, id) => `${collectionName}/${id}`,
  );

  await approveRegistrationRequest('request-1');

  expect(transaction.set).toHaveBeenCalledWith('students/request-1', {
    studentName: 'Amina Ahmed',
    id: 'request-1',
  });
  expect(transaction.set).toHaveBeenCalledWith(
    'users/parent-1',
    {
      email: 'parent@example.com',
      role: 'parent',
      studentIds: ['older-student', 'request-1'],
    },
    { merge: true },
  );
  expect(transaction.delete).toHaveBeenCalledWith(
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

test('explains that Firestore rules need publishing when parent profile creation is denied', async () => {
  getDoc.mockResolvedValue({ exists: () => false });
  setDoc.mockRejectedValue({ code: 'permission-denied' });

  await expect(
    signInForRole('parent@example.com', 'secret123', 'parent'),
  ).rejects.toThrow('Publish the latest firestore.rules');

  expect(signOut).toHaveBeenCalled();
});

test('requires email verification before creating or reading a parent profile', async () => {
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
  ).rejects.toThrow('Verify your email address');

  expect(getDoc).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
  expect(signOut).toHaveBeenCalled();
});
