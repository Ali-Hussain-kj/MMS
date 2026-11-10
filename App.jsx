import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LanguageToggle from './Src/components/LanguageToggle';
import appStyles from './Src/components/styles';
import AdminDashboardScreen from './Src/features/admin/AdminDashboardScreen';
import HostelAdminDashboardScreen from './Src/features/admin/HostelAdminDashboardScreen';
import ParentMonitoringScreen from './Src/features/parent/ParentMonitoringScreen';
import RoleSelectionScreen from './Src/features/roles/RoleSelectionScreen';
import TeacherDashboardScreen from './Src/features/teacher/TeacherDashboardScreen';
import {
  approveRegistrationRequest,
  allocateApprovedHostelRequest,
  allocateHostelRoom,
  createParentAccount,
  createHostelRoom,
  declineRegistrationRequest,
  recordHostelVisitor,
  reviewHostelRequest,
  removeStudent as removeStudentRecord,
  saveStudent as saveStudentRecord,
  saveHostelMeals,
  saveHostelAttendance,
  signOutUser,
  subscribeToHostelCollection,
  subscribeToHostelRequests,
  subscribeToHostelStudents,
  subscribeToRegistrationRequests,
  subscribeToStudents,
  updateStudentClass,
} from './Src/services/firebase/parentMonitoring';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('roles');
  const [language, setLanguage] = useState('en');
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [hostelStudents, setHostelStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [hostelRooms, setHostelRooms] = useState([]);
  const [hostelRegistrations, setHostelRegistrations] = useState([]);
  const [hostelRequests, setHostelRequests] = useState([]);
  const [hostelMeals, setHostelMeals] = useState([]);
  const [hostelAttendance, setHostelAttendance] = useState([]);
  const [hostelVisitors, setHostelVisitors] = useState([]);
  const [authSession, setAuthSession] = useState(null);
  const [backendNotice, setBackendNotice] = useState('');

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

    const unsubscribeStudents = subscribeToStudents(
      setStudents,
      error => setBackendNotice(error.message),
      { syncHostelRoster: authSession.role === 'admin' },
    );
    if (authSession.role === 'teacher') {
      return unsubscribeStudents;
    }

    const unsubscribeRequests = subscribeToRegistrationRequests(
      setRegistrationRequests,
      error => setBackendNotice(error.message),
    );
    const unsubscribeHostelData = subscribeToHostelData();
    return () => {
      unsubscribeStudents();
      unsubscribeRequests();
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
    setAuthSession(session);
    setBackendNotice('');
    setActiveScreen(session.role);
  }

  async function returnToRoles() {
    if (authSession) {
      try {
        await signOutUser();
      } catch (error) {
        setBackendNotice(error.message);
      }
    }
    setAuthSession(null);
    setStudents([]);
    setHostelStudents([]);
    setRegistrationRequests([]);
    setHostelRooms([]);
    setHostelRegistrations([]);
    setHostelRequests([]);
    setHostelMeals([]);
    setHostelAttendance([]);
    setHostelVisitors([]);
    setActiveScreen('roles');
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

  function addStudent(student) {
    const newStudent = { ...student, id: `student-${Date.now()}` };
    setStudents(current => [...current, newStudent]);
    if (authSession?.role === 'admin') {
      saveStudentRecord(newStudent).catch(error =>
        setBackendNotice(error.message),
      );
    }
  }

  function updateStudent(updatedStudent) {
    setStudents(current =>
      current.map(student =>
        student.id === updatedStudent.id ? updatedStudent : student,
      ),
    );
    if (authSession?.role === 'admin') {
      saveStudentRecord(updatedStudent).catch(error =>
        setBackendNotice(error.message),
      );
    }
  }

  function deleteStudent(studentId) {
    setStudents(current => current.filter(student => student.id !== studentId));
    if (authSession?.role === 'admin') {
      removeStudentRecord(studentId).catch(error =>
        setBackendNotice(error.message),
      );
    }
  }

  function addTeacher(teacher) {
    setTeachers(current => [
      ...current,
      { ...teacher, id: `teacher-${Date.now()}` },
    ]);
  }

  function updateTeacher(updatedTeacher) {
    setTeachers(current =>
      current.map(teacher =>
        teacher.id === updatedTeacher.id ? updatedTeacher : teacher,
      ),
    );
  }

  function deleteTeacher(teacherId) {
    setTeachers(current => current.filter(teacher => teacher.id !== teacherId));
  }

  function promoteStudent(studentId, className) {
    setStudents(current =>
      current.map(student =>
        student.id === studentId ? { ...student, className } : student,
      ),
    );
    if (authSession?.role === 'teacher') {
      updateStudentClass(studentId, className).catch(error =>
        setBackendNotice(error.message),
      );
    }
  }

  return (
    <SafeAreaProvider>
      <View style={appStyles.container}>
        {activeScreen === 'parent' && authSession ? (
          <ParentMonitoringScreen
            language={language}
            user={authSession}
            onSignOut={returnToRoles}
          />
        ) : activeScreen === 'teacher' ? (
          <TeacherDashboardScreen
            language={language}
            onBack={returnToRoles}
            onPromoteStudent={promoteStudent}
            students={students}
            backendNotice={backendNotice}
            isAuthenticated={authSession?.role === 'teacher'}
          />
        ) : activeScreen === 'hostelAdmin' && authSession ? (
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
        ) : activeScreen === 'admin' ? (
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
        ) : (
          <RoleSelectionScreen
            language={language}
            onAuthenticate={handleAuthentication}
            onRegisterStudent={addRegistrationRequest}
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
