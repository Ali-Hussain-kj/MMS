import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LanguageToggle from './Src/components/LanguageToggle';
import appStyles from './Src/components/styles';
import AdminDashboardScreen from './Src/features/admin/AdminDashboardScreen';
import HostelAdminDashboardScreen from './Src/features/admin/HostelAdminDashboardScreen';
import ParentMonitoringScreen from './Src/features/parent/ParentMonitoringScreen';
import RoleSelectionScreen from './Src/features/roles/RoleSelectionScreen';
import StaffRoleSelectionScreen from './Src/features/roles/StaffRoleSelectionScreen';
import TeacherDashboardScreen from './Src/features/teacher/TeacherDashboardScreen';
import getStrings from './Src/localization';
import {
  approveRegistrationRequest,
  allocateApprovedHostelRequest,
  allocateHostelRoom,
  createParentAccount,
  createHostelRoom,
  createTeacherAccount,
  declineRegistrationRequest,
  recordHostelVisitor,
  removeTeacherProfile,
  removeFinancialRecord,
  reviewHostelRequest,
  removeStudent as removeStudentRecord,
  saveStudent as saveStudentRecord,
  saveTeacherProfile,
  saveFinancialRecord,
  saveHostelMeals,
  saveHostelAttendance,
  signOutUser,
  subscribeToAuthSession,
  subscribeToHostelCollection,
  subscribeToHostelRequests,
  subscribeToHostelStudents,
  subscribeToRegistrationRequests,
  subscribeToStudents,
  subscribeToTeacherStudents,
  subscribeToTeachers,
  subscribeToFinancialRecords,
  updateStudentClass,
} from './Src/services/firebase/parentMonitoring';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('login');
  const [loginRoute, setLoginRoute] = useState('parent');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [language, setLanguage] = useState('en');
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [hostelStudents, setHostelStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [financialRecords, setFinancialRecords] = useState([]);
  const [hostelRooms, setHostelRooms] = useState([]);
  const [hostelRegistrations, setHostelRegistrations] = useState([]);
  const [hostelRequests, setHostelRequests] = useState([]);
  const [hostelMeals, setHostelMeals] = useState([]);
  const [hostelAttendance, setHostelAttendance] = useState([]);
  const [hostelVisitors, setHostelVisitors] = useState([]);
  const [authSession, setAuthSession] = useState(null);
  const [backendNotice, setBackendNotice] = useState('');
  const strings = getStrings(language);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    function handleRestoredSession(session) {
      if (!isMounted) {
        return;
      }
      setAuthSession(session);
      setActiveScreen(session?.role || 'login');
      setIsAuthReady(true);
      if (session) {
        setBackendNotice('');
      }
    }

    try {
      unsubscribe = subscribeToAuthSession(
        handleRestoredSession,
        error => {
          if (isMounted) {
            setAuthSession(null);
            setActiveScreen('login');
            setBackendNotice(error.message);
            setIsAuthReady(true);
          }
        },
      );
    } catch (error) {
      setBackendNotice(error.message);
      setIsAuthReady(true);
    }

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (
      !authSession ||
      !['admin', 'hostelAdmin', 'teacher'].includes(authSession.role)
    ) {
      return undefined;
    }

    if (authSession.role === 'hostelAdmin') {
      const unsubscribeHostelStudents = subscribeToHostelStudents(
        setHostelStudents,
        error => setBackendNotice(error.message),
      );
      const unsubscribeHostelData = subscribeToHostelData();
      return () => {
        unsubscribeHostelStudents();
        unsubscribeHostelData();
      };
    }

    if (authSession.role === 'teacher') {
      return subscribeToTeacherStudents(
        authSession.uid,
        setStudents,
        error => setBackendNotice(error.message),
      );
    }

    const unsubscribeStudents = subscribeToStudents(
      setStudents,
      error => setBackendNotice(error.message),
      { syncHostelRoster: true },
    );
    const unsubscribeRequests = subscribeToRegistrationRequests(
      setRegistrationRequests,
      error => setBackendNotice(error.message),
    );
    const unsubscribeTeachers =
      authSession.role === 'admin'
        ? subscribeToTeachers(setTeachers, error => setBackendNotice(error.message))
        : undefined;
    const unsubscribeFinancialRecords =
      authSession.role === 'admin'
        ? subscribeToFinancialRecords(
            setFinancialRecords,
            error => setBackendNotice(error.message),
          )
        : undefined;
    const unsubscribeHostelData = subscribeToHostelData();
    return () => {
      unsubscribeStudents();
      unsubscribeRequests();
      unsubscribeTeachers?.();
      unsubscribeFinancialRecords?.();
      unsubscribeHostelData();
    };
  }, [authSession]);

  function subscribeToHostelData() {
    const onError = error => setBackendNotice(error.message);
    const unsubscribeRooms = subscribeToHostelCollection(
      'hostelRooms',
      setHostelRooms,
      onError,
    );
    const unsubscribeRegistrations = subscribeToHostelCollection(
      'hostelRegistrations',
      setHostelRegistrations,
      onError,
    );
    const unsubscribeAttendance = subscribeToHostelCollection(
      'hostelAttendance',
      setHostelAttendance,
      onError,
    );
    const unsubscribeMeals = subscribeToHostelCollection(
      'hostelMeals',
      setHostelMeals,
      onError,
    );
    const unsubscribeVisitors = subscribeToHostelCollection(
      'hostelVisitors',
      setHostelVisitors,
      onError,
    );
    const unsubscribeRequests = subscribeToHostelRequests(
      setHostelRequests,
      onError,
    );
    return () => {
      unsubscribeRooms();
      unsubscribeRegistrations();
      unsubscribeAttendance();
      unsubscribeMeals();
      unsubscribeVisitors();
      unsubscribeRequests();
    };
  }

  function handleAuthentication(session) {
    const allowedRoles =
      loginRoute === 'admin'
        ? ['admin', 'hostelAdmin']
        : [loginRoute];
    if (!session || !allowedRoles.includes(session.role)) {
      signOutUser().catch(error => setBackendNotice(error.message));
      setAuthSession(null);
      setActiveScreen('login');
      setLoginRoute('parent');
      setBackendNotice(strings.loginCategoryMismatch);
      return;
    }

    setAuthSession(session);
    setIsAuthReady(true);
    setBackendNotice('');
    setActiveScreen(session.role);
  }

  async function returnToRoles() {
    if (authSession) {
      try {
        await signOutUser();
      } catch (error) {
        setBackendNotice(error.message);
        return;
      }
    }
    setAuthSession(null);
    setStudents([]);
    setTeachers([]);
    setFinancialRecords([]);
    setHostelStudents([]);
    setRegistrationRequests([]);
    setHostelRooms([]);
    setHostelRegistrations([]);
    setHostelRequests([]);
    setHostelMeals([]);
    setHostelAttendance([]);
    setHostelVisitors([]);
    setLoginRoute('parent');
    setActiveScreen('login');
  }

  async function addRegistrationRequest(request, credentials) {
    await createParentAccount(credentials.email, credentials.password, request);
  }

  async function approveRegistration(requestId) {
    try {
      await approveRegistrationRequest(requestId);
    } catch (error) {
      setBackendNotice(error.message);
    }
  }

  async function declineRegistration(requestId) {
    try {
      await declineRegistrationRequest(requestId);
    } catch (error) {
      setBackendNotice(error.message);
    }
  }

  async function addStudent(student) {
    const newStudent = { ...student, id: `student-${Date.now()}` };
    await saveStudentRecord(newStudent);
  }

  async function updateStudent(updatedStudent) {
    await saveStudentRecord(updatedStudent);
  }

  async function deleteStudent(studentId) {
    await removeStudentRecord(studentId);
  }

  async function addTeacher(teacher, password) {
    await createTeacherAccount(teacher, password);
  }

  async function updateTeacher(updatedTeacher) {
    await saveTeacherProfile(updatedTeacher);
  }

  async function deleteTeacher(teacherId) {
    await removeTeacherProfile(teacherId);
  }

  async function deleteFinancialEntry(recordId) {
    await removeFinancialRecord(recordId);
  }

  async function promoteStudent(studentId, className) {
    await updateStudentClass(studentId, className);
  }

  return (
    <SafeAreaProvider>
      <View
        style={[
          appStyles.container,
          language === 'ur' ? appStyles.rightToLeft : appStyles.leftToRight,
        ]}>
        {!isAuthReady ? (
          <View
            accessibilityRole="progressbar"
            style={appStyles.sessionLoading}>
            <ActivityIndicator color="#0B6B4B" />
            <Text>{strings.restoringSession}</Text>
          </View>
        ) : activeScreen === 'parent' && authSession?.role === 'parent' ? (
          <ParentMonitoringScreen
            language={language}
            user={authSession}
            onSignOut={returnToRoles}
          />
        ) : activeScreen === 'teacher' && authSession?.role === 'teacher' ? (
          <TeacherDashboardScreen
            language={language}
            onBack={returnToRoles}
            onPromoteStudent={promoteStudent}
            students={students}
            backendNotice={backendNotice}
            isAuthenticated={authSession?.role === 'teacher'}
          />
        ) : activeScreen === 'hostelAdmin' &&
          ['admin', 'hostelAdmin'].includes(authSession?.role) ? (
          <HostelAdminDashboardScreen
            language={language}
            onSignOut={returnToRoles}
            students={hostelStudents}
            rooms={hostelRooms}
            registrations={hostelRegistrations}
            requests={hostelRequests}
            attendance={hostelAttendance}
            meals={hostelMeals}
            visitors={hostelVisitors}
            backendNotice={backendNotice}
            onCreateRoom={createHostelRoom}
            onAllocateRoom={allocateHostelRoom}
            onReviewRequest={reviewHostelRequest}
            onAllocateRequest={allocateApprovedHostelRequest}
            onSaveAttendance={saveHostelAttendance}
            onSaveMeals={saveHostelMeals}
            onRecordVisitor={recordHostelVisitor}
          />
        ) : activeScreen === 'admin' && authSession?.role === 'admin' ? (
          <AdminDashboardScreen
            language={language}
            isAuthenticated={authSession?.role === 'admin'}
            onBack={returnToRoles}
            onAddStudent={addStudent}
            onUpdateStudent={updateStudent}
            onDeleteStudent={deleteStudent}
            onApproveRegistration={approveRegistration}
            onDeclineRegistration={declineRegistration}
            onAddTeacher={addTeacher}
            onUpdateTeacher={updateTeacher}
            onDeleteTeacher={deleteTeacher}
            financialRecords={financialRecords}
            onSaveFinancialRecord={saveFinancialRecord}
            onDeleteFinancialRecord={deleteFinancialEntry}
            registrationRequests={registrationRequests}
            students={students}
            teachers={teachers}
            backendNotice={backendNotice}
            hostelRooms={hostelRooms}
            hostelRegistrations={hostelRegistrations}
            hostelRequests={hostelRequests}
            hostelAttendance={hostelAttendance}
            hostelMeals={hostelMeals}
            hostelVisitors={hostelVisitors}
            onCreateHostelRoom={createHostelRoom}
            onAllocateHostelRoom={allocateHostelRoom}
            onReviewHostelRequest={reviewHostelRequest}
            onAllocateHostelRequest={allocateApprovedHostelRequest}
            onSaveHostelMeals={saveHostelMeals}
            onSaveHostelAttendance={saveHostelAttendance}
            onRecordHostelVisitor={recordHostelVisitor}
          />
        ) : activeScreen === 'staffRoles' ? (
          <StaffRoleSelectionScreen
            language={language}
            onBack={() => {
              setLoginRoute('parent');
              setActiveScreen('login');
              setBackendNotice('');
            }}
            onSelectRole={role => {
              setLoginRoute(role);
              setActiveScreen('login');
              setBackendNotice('');
            }}
          />
        ) : (
          <RoleSelectionScreen
            key={loginRoute}
            language={language}
            authNotice={backendNotice}
            loginRole={loginRoute}
            onAuthenticate={handleAuthentication}
            onRegisterStudent={addRegistrationRequest}
            onBack={() => {
              setLoginRoute('parent');
              setActiveScreen('staffRoles');
              setBackendNotice('');
            }}
            onStaffLogin={() => {
              setLoginRoute('parent');
              setActiveScreen('staffRoles');
              setBackendNotice('');
            }}
          />
        )}
        <LanguageToggle
          language={language}
          onToggle={() =>
            setLanguage(current => (current === 'en' ? 'ur' : 'en'))
          }
        />
      </View>
    </SafeAreaProvider>
  );
}
