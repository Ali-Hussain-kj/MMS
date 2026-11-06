import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LanguageToggle from './Src/components/LanguageToggle';
import appStyles from './Src/components/styles';
import AdminDashboardScreen from './Src/features/admin/AdminDashboardScreen';
import ParentMonitoringScreen from './Src/features/parent/ParentMonitoringScreen';
import RoleSelectionScreen from './Src/features/roles/RoleSelectionScreen';
import TeacherDashboardScreen from './Src/features/teacher/TeacherDashboardScreen';
import {
  approveRegistrationRequest,
  createParentAccount,
  declineRegistrationRequest,
  removeStudent as removeStudentRecord,
  saveStudent as saveStudentRecord,
  signOutUser,
  subscribeToRegistrationRequests,
  subscribeToStudents,
  updateStudentClass,
} from './Src/services/firebase/parentMonitoring';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('roles');
  const [language, setLanguage] = useState('en');
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [authSession, setAuthSession] = useState(null);
  const [backendNotice, setBackendNotice] = useState('');

  useEffect(() => {
    if (!authSession || !['admin', 'teacher'].includes(authSession.role)) {
      return undefined;
    }

    // Admins and teachers get the staff student list; parent data is fetched separately.
    const unsubscribeStudents = subscribeToStudents(setStudents, error =>
      setBackendNotice(error.message),
    );
    if (authSession.role !== 'admin') {
      return unsubscribeStudents;
    }

    const unsubscribeRequests = subscribeToRegistrationRequests(
      setRegistrationRequests,
      error => setBackendNotice(error.message),
    );
    return () => {
      unsubscribeStudents();
      unsubscribeRequests();
    };
  }, [authSession]);

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
    setRegistrationRequests([]);
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
