function getFirebaseServices() {
  // Load Firebase only when a backend action is requested (also keeps unit tests lightweight).
  return require('./firebase').getFirebaseServices();
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidVisitTime(value) {
  const match = /^(\d{4}-\d{2}-\d{2}) ([0-2]\d):([0-5]\d)$/.exec(value || '');
  return Boolean(match && isValidISODate(match[1]) && Number(match[2]) < 24);
}

// Sign in first, then check Firestore to make sure this account has the chosen role.
export async function signInForRole(email, password, expectedRole) {
  const { auth, db } = getFirebaseServices();
  const {
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
  } = require('firebase/auth');
  const { doc, getDoc, setDoc } = require('firebase/firestore');
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );

  if (!credential.user.emailVerified) {
    try {
      await sendEmailVerification(credential.user);
    } catch (verificationError) {
      await signOut(auth);
      throw new Error(
        `Could not send verification email: ${verificationError.message}`,
      );
    }
    await signOut(auth);
    const error = new Error('Email verification is required.');
    error.code = 'auth/email-not-verified';
    error.email = credential.user.email;
    throw error;
  }

  try {
    // Refresh the token so Firestore rules see the latest email_verified claim.
    await credential.user.getIdToken(true);
    const userRef = doc(db, 'users', credential.user.uid);
    let userSnapshot = await getDoc(userRef);

    // New parents start with no child access; an admin must link their children.
    if (!userSnapshot.exists() && expectedRole === 'parent') {
      await setDoc(userRef, {
        email: credential.user.email,
        role: 'parent',
        studentIds: [],
      });
      userSnapshot = await getDoc(userRef);
    }

    const accountRole = userSnapshot.exists() ? userSnapshot.data().role : null;
    const roleMatches =
      accountRole === expectedRole ||
      (expectedRole === 'admin' && accountRole === 'hostelAdmin');
    if (!roleMatches) {
      throw new Error(
        `This account is not authorized to sign in as ${expectedRole}.`,
      );
    }

    return {
      uid: credential.user.uid,
      email: credential.user.email,
      role: accountRole,
    };
  } catch (error) {
    await signOut(auth);
    if (error.code === 'permission-denied') {
      throw new Error(
        'Firestore denied parent profile access. Publish the latest firestore.rules to the Firebase project configured in the app, then try again.',
      );
    }
    throw error;
  }
}

export async function sendParentPasswordReset(email) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new Error('Enter your parent account email address first.');
  }

  const { auth } = getFirebaseServices();
  const { sendPasswordResetEmail } = require('firebase/auth');
  await sendPasswordResetEmail(auth, normalizedEmail);
}

export async function createParentAccount(email, password, registration) {
  if (!registration || typeof registration.studentName !== 'string') {
    throw new Error('Student registration details are required.');
  }

  const { auth, db } = getFirebaseServices();
  const {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
  } = require('firebase/auth');
  const { collection, doc, getDoc, runTransaction } = require('firebase/firestore');
  let credential;
  let createdAccount = false;

  try {
    try {
      credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      createdAccount = true;
    } catch (error) {
      // Reuse a verified parent account when enrolling another child with the same email.
      if (error.code !== 'auth/email-already-in-use') {
        throw error;
      }
      credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const parentProfile = await getDoc(doc(db, 'users', credential.user.uid));
      if (parentProfile.exists() && parentProfile.data().role !== 'parent') {
        throw new Error('This email is already used by a non-parent account.');
      }
    }

    // Verify email ownership before the new account can sign in to monitoring.
    if (createdAccount || !credential.user.emailVerified) {
      await sendEmailVerification(credential.user);
    }

    const submittedAt = new Date().toISOString();
    const registrationRef = doc(collection(db, 'registrationRequests'));
    const studentId = registrationRef.id;
    const registrationRequest = {
      ...registration,
      gmail: credential.user.email,
      parentUid: credential.user.uid,
      parentEmail: credential.user.email,
      status: 'pending',
      submittedAt,
    };

    await runTransaction(db, async transaction => {
      transaction.set(registrationRef, registrationRequest);
      if (registration.hostelStatus !== 'resident') {
        return;
      }

      const hostelRequestRef = doc(db, 'hostelRequests', studentId);
      const activeRequestRef = doc(db, 'hostelActiveRequests', studentId);
      const hostelRequest = {
        studentId,
        registrationRequestId: studentId,
        requestType: 'admission',
        source: 'registration',
        studentName: registration.studentName.trim(),
        fatherName: registration.fatherName.trim(),
        className: registration.className || '',
        program: registration.program,
        parentUid: credential.user.uid,
        parentEmail: credential.user.email,
        contactNumber: registration.contactNumber.trim(),
        status: 'pending',
        submittedAt,
        updatedAt: submittedAt,
      };
      transaction.set(hostelRequestRef, hostelRequest);
      transaction.set(activeRequestRef, {
        requestId: studentId,
        parentUid: credential.user.uid,
        requestType: 'admission',
        status: 'pending',
        createdAt: submittedAt,
      });
    });
  } finally {
    await signOut(auth);
  }
}

export function subscribeToRegistrationRequests(onChange, onError) {
  const { db } = getFirebaseServices();
  const { collection, onSnapshot } = require('firebase/firestore');
  return onSnapshot(
    collection(db, 'registrationRequests'),
    snapshot =>
      onChange(
        snapshot.docs
          .map(request => ({ id: request.id, ...request.data() }))
          .sort((a, b) =>
            (b.submittedAt || '').localeCompare(a.submittedAt || ''),
          ),
      ),
    onError,
  );
}

export async function approveRegistrationRequest(requestId) {
  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const requestRef = doc(db, 'registrationRequests', requestId);
  const studentRef = doc(db, 'students', requestId);

  await runTransaction(db, async transaction => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists()) {
      throw new Error('This registration request is no longer available.');
    }

    const request = requestSnapshot.data();
    const userRef = doc(db, 'users', request.parentUid);
    const userSnapshot = await transaction.get(userRef);
    const existingProfile = userSnapshot.exists() ? userSnapshot.data() : {};

    if (existingProfile.role && existingProfile.role !== 'parent') {
      throw new Error(
        'The registration email belongs to a non-parent account.',
      );
    }
    const existingStudentIds = Array.isArray(existingProfile.studentIds)
      ? existingProfile.studentIds
      : [];

    const { parentUid, parentEmail, status, submittedAt, ...studentDetails } =
      request;
    const studentRecord = { ...studentDetails, id: requestId, hostelStatus: 'day' };
    transaction.set(studentRef, studentRecord);
    transaction.set(doc(db, 'hostelStudentRoster', requestId), {
      id: requestId,
      studentName: studentDetails.studentName,
      fatherName: studentDetails.fatherName || '',
      className: studentDetails.className || '',
      program: studentDetails.program || '',
      contactNumber: studentDetails.contactNumber || '',
      hostelStatus: 'day',
    });
    transaction.set(
      userRef,
      {
        email: parentEmail,
        role: 'parent',
        studentIds: [...new Set([...existingStudentIds, requestId])],
      },
      { merge: true },
    );
    transaction.delete(requestRef);
  });
}

export async function declineRegistrationRequest(requestId) {
  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const registrationRef = doc(db, 'registrationRequests', requestId);
  const hostelRequestRef = doc(db, 'hostelRequests', requestId);
  const activeRequestRef = doc(db, 'hostelActiveRequests', requestId);
  await runTransaction(db, async transaction => {
    const [registration, hostelRequest, activeRequest] = await Promise.all([
      transaction.get(registrationRef),
      transaction.get(hostelRequestRef),
      transaction.get(activeRequestRef),
    ]);
    if (registration.exists()) {
      transaction.delete(registrationRef);
    }
    if (
      hostelRequest.exists() &&
      hostelRequest.data().source === 'registration' &&
      hostelRequest.data().status === 'pending'
    ) {
      const updatedAt = new Date().toISOString();
      transaction.update(hostelRequestRef, {
        status: 'rejected',
        reviewedAt: updatedAt,
        updatedAt,
      });
      if (activeRequest.exists()) {
        transaction.delete(activeRequestRef);
      }
    }
  });
}

// Listen for parent-link changes and reports so access updates without restarting the app.
export function subscribeToParentReports(uid, onChange, onError) {
  const { db } = getFirebaseServices();
  const { collection, doc, onSnapshot } = require('firebase/firestore');
  const userRef = doc(db, 'users', uid);
  const childSubscriptions = new Map();
  const reportsByStudent = new Map();

  function publish() {
    onChange(Array.from(reportsByStudent.values()));
  }

  const unsubscribeUser = onSnapshot(
    userRef,
    snapshot => {
      if (!snapshot.exists() || snapshot.data().role !== 'parent') {
        onError(new Error('Parent account profile is unavailable.'));
        return;
      }

      const studentIds = Array.isArray(snapshot.data().studentIds)
        ? [...new Set(snapshot.data().studentIds)]
        : [];
      const linkedIds = new Set(studentIds);

      // Stop listening to children an admin has unlinked from this parent.
      childSubscriptions.forEach((subscriptions, studentId) => {
        if (!linkedIds.has(studentId)) {
          subscriptions.forEach(unsubscribe => unsubscribe());
          childSubscriptions.delete(studentId);
          reportsByStudent.delete(studentId);
        }
      });

      studentIds.forEach(studentId => {
        if (childSubscriptions.has(studentId)) {
          return;
        }

        const studentReport = {
          student: null,
          attendance: [],
          hifzProgress: [],
          nazraProgress: [],
        };
        reportsByStudent.set(studentId, studentReport);

        // Each listener reads one linked child and only that child's report collections.
        const subscriptions = [
          onSnapshot(
            doc(db, 'students', studentId),
            studentSnapshot => {
              studentReport.student = studentSnapshot.exists()
                ? { id: studentSnapshot.id, ...studentSnapshot.data() }
                : null;
              publish();
            },
            onError,
          ),
          ...['attendance', 'hifzProgress', 'nazraProgress'].map(
            collectionName =>
              onSnapshot(
                collection(db, 'students', studentId, collectionName),
                recordsSnapshot => {
                  studentReport[collectionName] = recordsSnapshot.docs
                    .map(record => ({ id: record.id, ...record.data() }))
                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                  publish();
                },
                onError,
              ),
          ),
        ];
        childSubscriptions.set(studentId, subscriptions);
      });

      publish();
    },
    onError,
  );

  return () => {
    // Firestore listeners stay active until explicitly unsubscribed.
    unsubscribeUser();
    childSubscriptions.forEach(subscriptions =>
      subscriptions.forEach(unsubscribe => unsubscribe()),
    );
    childSubscriptions.clear();
  };
}

async function seedHostelStudentRoster(db, students) {
  const { doc, writeBatch } = require('firebase/firestore');
  const batchSize = 400;

  for (let start = 0; start < students.length; start += batchSize) {
    const batch = writeBatch(db);
    students.slice(start, start + batchSize).forEach(student => {
      batch.set(doc(db, 'hostelStudentRoster', student.id), {
        id: student.id,
        studentName: student.studentName,
        fatherName: student.fatherName || '',
        className: student.className || '',
        program: student.program || '',
        contactNumber: student.contactNumber || '',
        hostelStatus: student.hostelStatus === 'resident' ? 'resident' : 'day',
      });
    });
    await batch.commit();
  }
}

export function subscribeToStudents(
  onChange,
  onError,
  { syncHostelRoster = false } = {},
) {
  // Admin screens receive live student changes rather than needing a manual refresh.
  const { db } = getFirebaseServices();
  const { collection, onSnapshot } = require('firebase/firestore');
  let rosterSeeded = false;
  return onSnapshot(
    collection(db, 'students'),
    snapshot => {
      const students = snapshot.docs.map(student => ({
        id: student.id,
        ...student.data(),
      }));
      onChange(students);
      if (syncHostelRoster && !rosterSeeded && !snapshot.metadata?.fromCache) {
        rosterSeeded = true;
        seedHostelStudentRoster(db, students).catch(error => {
          rosterSeeded = false;
          onError(error);
        });
      }
    },
    onError,
  );
}

export function subscribeToHostelStudents(onChange, onError) {
  const { db } = getFirebaseServices();
  const { collection, onSnapshot } = require('firebase/firestore');
  return onSnapshot(
    collection(db, 'hostelStudentRoster'),
    snapshot =>
      onChange(
        snapshot.docs.map(student => ({ id: student.id, ...student.data() })),
      ),
    onError,
  );
}

export async function saveStudent(student) {
  const { db } = getFirebaseServices();
  const { doc, setDoc } = require('firebase/firestore');
  await setDoc(doc(db, 'students', student.id), student);
  const hostelRosterRef = doc(db, 'hostelStudentRoster', student.id);
  await setDoc(hostelRosterRef, {
    id: student.id,
    studentName: student.studentName,
    fatherName: student.fatherName || '',
    className: student.className || '',
    program: student.program || '',
    contactNumber: student.contactNumber || '',
    hostelStatus: student.hostelStatus === 'resident' ? 'resident' : 'day',
  });
}

export async function removeStudent(studentId) {
  const { db } = getFirebaseServices();
  const { deleteDoc, doc } = require('firebase/firestore');
  await Promise.all([
    deleteDoc(doc(db, 'students', studentId)),
    deleteDoc(doc(db, 'hostelStudentRoster', studentId)),
  ]);
}

export async function updateStudentClass(studentId, className) {
  const { db } = getFirebaseServices();
  const { doc, updateDoc } = require('firebase/firestore');
  await updateDoc(doc(db, 'students', studentId), { className });
}

export async function findParentAccounts(email) {
  const { db } = getFirebaseServices();
  const { collection, getDocs, query, where } = require('firebase/firestore');
  const parentQuery = query(
    collection(db, 'users'),
    where('role', '==', 'parent'),
  );
  const snapshot = await getDocs(parentQuery);
  const normalizedEmail = email.trim().toLowerCase();
  // Filter exact email matches in the app so the lookup doesn't need a compound index.
  return snapshot.docs
    .map(parent => ({ id: parent.id, ...parent.data() }))
    .filter(parent => parent.email?.toLowerCase() === normalizedEmail);
}

export async function linkStudentsToParent(parentUid, studentIds) {
  // Store unique student document IDs on the parent profile to define report access.
  const { db } = getFirebaseServices();
  const { doc, updateDoc } = require('firebase/firestore');
  await updateDoc(doc(db, 'users', parentUid), {
    studentIds: [...new Set(studentIds)],
  });
}

export async function saveTeacherReport(studentId, collectionName, record) {
  const { auth, db } = getFirebaseServices();
  if (!auth.currentUser) {
    return;
  }

  // Keep each report inside its student's document path for rule-based access checks.
  const { doc, setDoc } = require('firebase/firestore');
  await setDoc(
    doc(db, 'students', studentId, collectionName, record.id),
    record,
  );
}

export function subscribeToHostelCollection(collectionName, onChange, onError) {
  const { db } = getFirebaseServices();
  const { collection, onSnapshot } = require('firebase/firestore');
  return onSnapshot(
    collection(db, collectionName),
    snapshot =>
      onChange(
        snapshot.docs.map(record => ({ id: record.id, ...record.data() })),
      ),
    onError,
  );
}

export function subscribeToHostelRequests(onChange, onError) {
  const { db } = getFirebaseServices();
  const { collection, onSnapshot } = require('firebase/firestore');
  return onSnapshot(
    collection(db, 'hostelRequests'),
    snapshot =>
      onChange(
        snapshot.docs
          .map(request => ({ id: request.id, ...request.data() }))
          .sort((left, right) =>
            (right.submittedAt || '').localeCompare(left.submittedAt || ''),
          ),
      ),
    onError,
  );
}

export function subscribeToParentHostelRequests(uid, onChange, onError) {
  const { db } = getFirebaseServices();
  const { collection, onSnapshot, query, where } = require('firebase/firestore');
  return onSnapshot(
    query(collection(db, 'hostelRequests'), where('parentUid', '==', uid)),
    snapshot =>
      onChange(
        snapshot.docs
          .map(request => ({ id: request.id, ...request.data() }))
          .sort((left, right) =>
            (right.submittedAt || '').localeCompare(left.submittedAt || ''),
          ),
      ),
    onError,
  );
}

export async function createParentHostelRequest(studentId, parentUid, requestType) {
  if (!studentId || !parentUid || !['admission', 'cancellation'].includes(requestType)) {
    throw new Error('A linked student and valid hostel request type are required.');
  }

  const { db } = getFirebaseServices();
  const { collection, doc, runTransaction } = require('firebase/firestore');
  const parentRef = doc(db, 'users', parentUid);
  const studentRef = doc(db, 'students', studentId);
  const registrationRef = doc(db, 'hostelRegistrations', studentId);
  const activeRequestRef = doc(db, 'hostelActiveRequests', studentId);
  const requestRef = doc(collection(db, 'hostelRequests'));
  const submittedAt = new Date().toISOString();

  await runTransaction(db, async transaction => {
    const [parent, student, registration, activeRequest] = await Promise.all([
      transaction.get(parentRef),
      transaction.get(studentRef),
      transaction.get(registrationRef),
      transaction.get(activeRequestRef),
    ]);
    if (
      !parent.exists() ||
      parent.data().role !== 'parent' ||
      !Array.isArray(parent.data().studentIds) ||
      !parent.data().studentIds.includes(studentId)
    ) {
      throw new Error('You can only request hostel changes for a child linked to your account.');
    }
    if (!student.exists()) {
      throw new Error('The linked student record is unavailable.');
    }
    if (activeRequest.exists()) {
      throw new Error('A hostel request for this student is already pending review.');
    }

    const currentRegistration = registration.exists();
    if (
      (requestType === 'admission' &&
        (student.data().hostelStatus === 'resident' || currentRegistration)) ||
      (requestType === 'cancellation' &&
        (student.data().hostelStatus !== 'resident' || !currentRegistration))
    ) {
      throw new Error(
        requestType === 'admission'
          ? 'This student is already registered as a hostel resident.'
          : 'This student does not have an active hostel registration.',
      );
    }

    const profile = parent.data();
    const details = student.data();
    transaction.set(requestRef, {
      studentId,
      requestType,
      source: 'parent',
      studentName: details.studentName || studentId,
      fatherName: details.fatherName || '',
      className: details.className || '',
      program: details.program || '',
      parentUid,
      parentEmail: profile.email || '',
      contactNumber: details.contactNumber || '',
      status: 'pending',
      submittedAt,
      updatedAt: submittedAt,
    });
    transaction.set(activeRequestRef, {
      requestId: requestRef.id,
      parentUid,
      requestType,
      status: 'pending',
      createdAt: submittedAt,
    });
  });
}

export async function reviewHostelRequest(requestId, decision) {
  if (!requestId || !['approve', 'reject'].includes(decision)) {
    throw new Error('Select a valid hostel request decision.');
  }

  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const requestRef = doc(db, 'hostelRequests', requestId);
  await runTransaction(db, async transaction => {
    const current = await transaction.get(requestRef);
    if (!current.exists() || current.data().status !== 'pending') {
      throw new Error('This hostel request is no longer pending review.');
    }

    const request = current.data();
    const activeRef = doc(db, 'hostelActiveRequests', request.studentId);
    const active = await transaction.get(activeRef);
    if (!active.exists() || active.data().requestId !== requestId) {
      throw new Error('This request is no longer the active hostel request.');
    }
    const updatedAt = new Date().toISOString();

    if (decision === 'reject') {
      transaction.update(requestRef, {
        status: 'rejected',
        reviewedAt: updatedAt,
        updatedAt,
      });
      transaction.delete(activeRef);
    } else if (request.requestType === 'cancellation') {
      const registrationRef = doc(db, 'hostelRegistrations', request.studentId);
      const studentRef = doc(db, 'students', request.studentId);
      const rosterRef = doc(db, 'hostelStudentRoster', request.studentId);
      const registration = await transaction.get(registrationRef);
      const student = await transaction.get(studentRef);
      if (!registration.exists() || !student.exists()) {
        throw new Error('The student no longer has an active hostel registration.');
      }
      const roomRef = doc(db, 'hostelRooms', registration.data().roomId);
      const room = await transaction.get(roomRef);
      if (room.exists()) {
        const allocations = { ...(room.data().allocations || {}) };
        delete allocations[registration.data().bedNumber];
        transaction.update(roomRef, { allocations });
      }
      transaction.update(studentRef, { hostelStatus: 'day' });
      transaction.update(rosterRef, { hostelStatus: 'day' });
      transaction.delete(registrationRef);
      transaction.update(requestRef, {
        status: 'approved',
        reviewedAt: updatedAt,
        processedAt: updatedAt,
        updatedAt,
      });
      transaction.delete(activeRef);
    } else {
      transaction.update(requestRef, {
        status: 'approved',
        reviewedAt: updatedAt,
        updatedAt,
      });
      transaction.update(activeRef, { status: 'approved', updatedAt });
    }

  });
}

export async function allocateApprovedHostelRequest(requestId, allocation) {
  const roomId = allocation.roomId?.trim();
  const bedNumber = Number(allocation.bedNumber);
  if (!requestId || !roomId || !Number.isInteger(bedNumber) || bedNumber < 1) {
    throw new Error('Select a room and valid bed number.');
  }

  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const requestRef = doc(db, 'hostelRequests', requestId);
  await runTransaction(db, async transaction => {
    const requestSnapshot = await transaction.get(requestRef);
    if (
      !requestSnapshot.exists() ||
      requestSnapshot.data().requestType !== 'admission' ||
      requestSnapshot.data().status !== 'approved'
    ) {
      throw new Error('Approve a pending admission request before allocating a room.');
    }
    const request = requestSnapshot.data();
    const activeRef = doc(db, 'hostelActiveRequests', request.studentId);
    const registrationRef = doc(db, 'hostelRegistrations', request.studentId);
    const studentRef = doc(db, 'students', request.studentId);
    const rosterRef = doc(db, 'hostelStudentRoster', request.studentId);
    const roomRef = doc(db, 'hostelRooms', roomId);
    const [active, registration, student, roster, roomSnapshot] = await Promise.all([
      transaction.get(activeRef),
      transaction.get(registrationRef),
      transaction.get(studentRef),
      transaction.get(rosterRef),
      transaction.get(roomRef),
    ]);
    if (!active.exists() || active.data().requestId !== requestId) {
      throw new Error('This request is no longer active.');
    }
    if (registration.exists()) {
      throw new Error('This student already has an allocated hostel room.');
    }
    if (!student.exists() || !roster.exists()) {
      throw new Error('The Main Admin must approve the student registration before room allocation.');
    }
    if (!roomSnapshot.exists()) {
      throw new Error('The selected room no longer exists. Refresh and try again.');
    }

    const room = roomSnapshot.data();
    if (bedNumber > room.bedCount) {
      throw new Error('The selected bed number is outside this room’s bed count.');
    }
    const allocations = { ...(room.allocations || {}) };
    if (allocations[bedNumber]) {
      throw new Error('That bed is already occupied. Select another bed.');
    }
    allocations[bedNumber] = request.studentId;
    const updatedAt = new Date().toISOString();
    transaction.update(roomRef, { allocations });
    transaction.set(registrationRef, {
      studentId: request.studentId,
      studentName: request.studentName,
      roomId,
      roomNumber: room.roomNumber,
      floor: room.floor,
      bedNumber,
      admissionDate: updatedAt.slice(0, 10),
      createdAt: updatedAt,
      updatedAt,
    });
    transaction.update(studentRef, { hostelStatus: 'resident' });
    transaction.update(rosterRef, { hostelStatus: 'resident' });
    transaction.update(requestRef, {
      status: 'approved',
      allocatedAt: updatedAt,
      roomId,
      roomNumber: room.roomNumber,
      floor: room.floor,
      bedNumber,
      updatedAt,
    });
    transaction.delete(activeRef);
  });
}

export async function createHostelRoom(room) {
  const roomNumber = room.roomNumber?.trim();
  const floor = room.floor?.trim();
  const bedCount = Number(room.bedCount);
  if (!roomNumber || !floor || !Number.isInteger(bedCount) || bedCount < 1) {
    throw new Error('Enter a room number, floor, and positive whole-number bed count.');
  }

  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const roomId = `room_${encodeURIComponent(floor.toLowerCase())}_${encodeURIComponent(roomNumber.toLowerCase())}`;
  const roomRef = doc(db, 'hostelRooms', roomId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    if (snapshot.exists()) {
      throw new Error('A room with this number on this floor already exists.');
    }
    transaction.set(roomRef, {
      roomNumber,
      floor,
      bedCount,
      allocations: {},
      createdAt: new Date().toISOString(),
    });
  });
}

export async function allocateHostelRoom(registration) {
  const studentId = registration.studentId?.trim();
  const roomId = registration.roomId?.trim();
  const bedNumber = Number(registration.bedNumber);
  const admissionDate = registration.admissionDate?.trim();
  if (
    !studentId ||
    !roomId ||
    !isValidISODate(admissionDate) ||
    !Number.isInteger(bedNumber) ||
    bedNumber < 1
  ) {
    throw new Error('Enter a student ID, room, bed number, and admission date.');
  }

  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const registrationRef = doc(db, 'hostelRegistrations', studentId);
  const roomRef = doc(db, 'hostelRooms', roomId);
  const studentRef = doc(db, 'hostelStudentRoster', studentId);
  await runTransaction(db, async transaction => {
    const [existingRegistration, roomSnapshot, studentSnapshot] = await Promise.all([
      transaction.get(registrationRef),
      transaction.get(roomRef),
      transaction.get(studentRef),
    ]);
    if (existingRegistration.exists()) {
      throw new Error('This student already has a hostel room allocation.');
    }
    if (!studentSnapshot.exists()) {
      throw new Error('Only a hostel resident can be allocated a room.');
    }
    if (!roomSnapshot.exists()) {
      throw new Error('The selected room no longer exists. Refresh and try again.');
    }

    const room = roomSnapshot.data();
    if (bedNumber > room.bedCount) {
      throw new Error('The selected bed number is outside this room’s bed count.');
    }
    const allocations = room.allocations || {};
    if (allocations[bedNumber]) {
      throw new Error('That bed is already occupied. Select another bed.');
    }

    transaction.update(roomRef, {
      allocations: { ...allocations, [bedNumber]: studentId },
    });
    transaction.set(registrationRef, {
      studentId,
      studentName: registration.studentName?.trim() || studentId,
      roomId,
      roomNumber: room.roomNumber,
      floor: room.floor,
      bedNumber,
      admissionDate,
    });
  });
}

export async function saveHostelMeals(mealRecord) {
  const studentId = mealRecord.studentId?.trim();
  const date = mealRecord.date?.trim();
  if (!studentId || !isValidISODate(date)) {
    throw new Error('Enter a student ID and a valid date in YYYY-MM-DD format.');
  }
  if (!['breakfast', 'lunch', 'dinner'].some(meal => mealRecord[meal] === true)) {
    throw new Error('Select at least one meal to record.');
  }

  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const registrationRef = doc(db, 'hostelRegistrations', studentId);
  const mealId = `${encodeURIComponent(studentId)}_${date}`;
  const mealRef = doc(db, 'hostelMeals', mealId);
  await runTransaction(db, async transaction => {
    const registration = await transaction.get(registrationRef);
    if (!registration.exists()) {
      throw new Error('Register this student in the hostel before recording meals.');
    }
    transaction.set(
      mealRef,
      {
        studentId,
        studentName: mealRecord.studentName?.trim() || registration.data().studentName,
        date,
        breakfast: mealRecord.breakfast === true,
        lunch: mealRecord.lunch === true,
        dinner: mealRecord.dinner === true,
      },
      { merge: true },
    );
  });
}

export async function saveHostelAttendance(attendance) {
  const studentId = attendance.studentId?.trim();
  const date = attendance.date?.trim();
  const status = attendance.status;
  if (
    !studentId ||
    !isValidISODate(date) ||
    !['present', 'absent', 'leave'].includes(status)
  ) {
    throw new Error('Enter a student ID, valid date, and attendance status.');
  }

  const { db } = getFirebaseServices();
  const { doc, runTransaction } = require('firebase/firestore');
  const registrationRef = doc(db, 'hostelRegistrations', studentId);
  const attendanceId = `${encodeURIComponent(studentId)}_${date}`;
  const attendanceRef = doc(db, 'hostelAttendance', attendanceId);
  await runTransaction(db, async transaction => {
    const registration = await transaction.get(registrationRef);
    if (!registration.exists()) {
      throw new Error('Register this student in the hostel before marking attendance.');
    }
    transaction.set(attendanceRef, {
      studentId,
      studentName: registration.data().studentName,
      date,
      status,
    });
  });
}

export async function recordHostelVisitor(visitor) {
  const studentId = visitor.studentId?.trim();
  const visitorName = visitor.visitorName?.trim();
  const relation = visitor.relation?.trim();
  const visitTime = visitor.visitTime?.trim();
  if (!studentId || !visitorName || !relation || !isValidVisitTime(visitTime)) {
    throw new Error(
      'Enter a student ID, visitor name, relation, and a valid visit time in YYYY-MM-DD HH:mm format.',
    );
  }

  const { db } = getFirebaseServices();
  const { collection, doc, runTransaction } = require('firebase/firestore');
  const registrationRef = doc(db, 'hostelRegistrations', studentId);
  const visitorRef = doc(collection(db, 'hostelVisitors'));
  await runTransaction(db, async transaction => {
    const registration = await transaction.get(registrationRef);
    if (!registration.exists()) {
      throw new Error('Visitors can only be recorded for registered hostel students.');
    }
    transaction.set(visitorRef, {
      studentId,
      studentName: registration.data().studentName,
      visitorName,
      relation,
      visitTime,
      recordedAt: new Date().toISOString(),
    });
  });
}

export async function signOutUser() {
  const { auth } = getFirebaseServices();
  const { signOut } = require('firebase/auth');
  await signOut(auth);
}
