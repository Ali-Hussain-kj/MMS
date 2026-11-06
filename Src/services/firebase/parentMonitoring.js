function getFirebaseServices() {
  // Load Firebase only when a backend action is requested (also keeps unit tests lightweight).
  return require('./firebase').getFirebaseServices();
}

// Sign in first, then check Firestore to make sure this account has the chosen role.
export async function signInForRole(email, password, expectedRole) {
  const { auth, db } = getFirebaseServices();
  const { signInWithEmailAndPassword, signOut } = require('firebase/auth');
  const { doc, getDoc, setDoc } = require('firebase/firestore');
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );

  if (!credential.user.emailVerified) {
    await signOut(auth);
    throw new Error('Verify your email address before signing in.');
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

    if (!userSnapshot.exists() || userSnapshot.data().role !== expectedRole) {
      throw new Error(
        `This account is not authorized to sign in as ${expectedRole}.`,
      );
    }

    return {
      uid: credential.user.uid,
      email: credential.user.email,
      role: expectedRole,
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
  const { addDoc, collection, doc, getDoc } = require('firebase/firestore');
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

    await addDoc(collection(db, 'registrationRequests'), {
      ...registration,
      gmail: credential.user.email,
      parentUid: credential.user.uid,
      parentEmail: credential.user.email,
      status: 'pending',
      submittedAt: new Date().toISOString(),
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
    transaction.set(studentRef, { ...studentDetails, id: requestId });
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
  const { deleteDoc, doc } = require('firebase/firestore');
  await deleteDoc(doc(db, 'registrationRequests', requestId));
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

export function subscribeToStudents(onChange, onError) {
  // Admin screens receive live student changes rather than needing a manual refresh.
  const { db } = getFirebaseServices();
  const { collection, onSnapshot } = require('firebase/firestore');
  return onSnapshot(
    collection(db, 'students'),
    snapshot =>
      onChange(
        snapshot.docs.map(student => ({ id: student.id, ...student.data() })),
      ),
    onError,
  );
}

export async function saveStudent(student) {
  // Student IDs are document IDs so parent links can point to an exact profile.
  const { db } = getFirebaseServices();
  const { doc, setDoc } = require('firebase/firestore');
  await setDoc(doc(db, 'students', student.id), student);
}

export async function removeStudent(studentId) {
  const { db } = getFirebaseServices();
  const { deleteDoc, doc } = require('firebase/firestore');
  await deleteDoc(doc(db, 'students', studentId));
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

export async function signOutUser() {
  const { auth } = getFirebaseServices();
  const { signOut } = require('firebase/auth');
  await signOut(auth);
}
