import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import getStrings from '../../localization';
import FinanceManagementScreen from './FinanceManagementScreen';
import HostelManagementScreen from './HostelManagementScreen';
import ParentAccessManagement from './ParentAccessManagement';
import { classes, getProgramLabel, programs } from '../students/studentOptions';
import styles from './styles';

// The tab IDs are stable values; each tab selects a different admin workflow.
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'requests', label: 'Requests' },
  { id: 'students', label: 'Students' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'parents', label: 'Parents' },
  { id: 'hostel', label: 'Hostel' },
  { id: 'finance', label: 'Finance' },
];

const emptyStudent = {
  studentName: '',
  fatherName: '',
  dateOfBirth: '',
  address: '',
  gmail: '',
  contactNumber: '',
  program: '',
  className: '',
  teacherId: '',
  hostelStatus: 'day',
  photoUri: '',
};

const emptyTeacher = {
  name: '',
  email: '',
  password: '',
  qualification: '',
  experience: '',
  contactNumber: '',
  subjects: '',
  salary: '',
  assignedPrograms: [],
  assignedClasses: [],
};

// Small shared UI building blocks keep admin forms and actions consistent.
function ActionButton({ label, onPress, variant = 'primary', testID }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.actionButton,
        variant === 'secondary' && styles.secondaryAction,
        variant === 'danger' && styles.dangerAction,
      ]}
      testID={testID}>
      <Text
        style={[
          styles.actionButtonText,
          variant === 'secondary' && styles.secondaryActionText,
          variant === 'danger' && styles.dangerActionText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  autoComplete,
  testID,
}) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={
          keyboardType === 'email-address' || secureTextEntry
            ? 'none'
            : 'sentences'
        }
        autoComplete={autoComplete}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        secureTextEntry={secureTextEntry}
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        testID={testID}
        value={value}
      />
    </>
  );
}

function ChoiceGrid({ items, selected, onSelect, testPrefix }) {
  return (
    <View style={styles.choiceGrid}>
      {items.map(item => {
        const isSelected = selected === item.id;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.choice, isSelected && styles.choiceSelected]}
            testID={`${testPrefix}-${item.id}`}>
            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TeacherPicker({ teachers, selectedTeacherId, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTeacher = teachers.find(
    teacher => teacher.id === selectedTeacherId,
  );

  return (
    <View>
      <Text style={styles.fieldLabel}>Assign Teacher</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(value => !value)}
        style={styles.teacherPicker}
        testID="student-teacher-picker">
        <Text style={styles.teacherPickerText}>
          {selectedTeacher?.name || 'Unassigned'}
        </Text>
        <Text style={styles.teacherPickerChevron}>{isOpen ? '⌃' : '⌄'}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.teacherPickerOptions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onSelect('');
              setIsOpen(false);
            }}
            style={styles.teacherPickerOption}
            testID="student-teacher-unassigned">
            <Text style={styles.teacherPickerOptionText}>Unassigned</Text>
          </Pressable>
          {teachers.map(teacher => (
            <Pressable
              accessibilityRole="button"
              key={teacher.id}
              onPress={() => {
                onSelect(teacher.id);
                setIsOpen(false);
              }}
              style={styles.teacherPickerOption}
              testID={`student-teacher-option-${teacher.id}`}>
              <Text style={styles.teacherPickerOptionText}>{teacher.name}</Text>
            </Pressable>
          ))}
          {teachers.length === 0 ? (
            <Text style={styles.teacherPickerEmpty}>No teachers available.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function AdminDashboardScreen({
  language,
  isAuthenticated,
  onBack,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onApproveRegistration,
  onDeclineRegistration,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  financialRecords = [],
  onSaveFinancialRecord,
  onDeleteFinancialRecord,
  registrationRequests,
  students,
  teachers = [],
  backendNotice,
  hostelRooms,
  hostelRegistrations,
  hostelRequests,
  hostelAttendance,
  hostelMeals,
  hostelVisitors,
  onCreateHostelRoom,
  onAllocateHostelRoom,
  onReviewHostelRequest,
  onAllocateHostelRequest,
  onSaveHostelMeals,
  onSaveHostelAttendance,
  onRecordHostelVisitor,
}) {
  const strings = getStrings(language);
  // Keep the active view and unfinished form values while switching admin tabs.
  const [activeTab, setActiveTab] = useState('overview');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentForm, setStudentForm] = useState(null);
  const [teacherForm, setTeacherForm] = useState(null);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [notice, setNotice] = useState('');

  // Search across common student details without changing the saved records.
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) {
      return students;
    }

    return students.filter(student =>
      [
        student.studentName,
        student.fatherName,
        student.contactNumber,
        getProgramLabel(student.program),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [studentSearch, students]);

  function startStudentForm(student) {
    setNotice('');
    setStudentForm({
      mode: student ? 'edit' : 'add',
      values: { ...emptyStudent, ...(student || {}) },
    });
  }

  function updateStudentField(field, value) {
    setStudentForm(current => ({
      ...current,
      values: { ...current.values, [field]: value },
    }));
    setNotice('');
  }

  async function saveStudent() {
    // Validate required enrollment details before calling the parent screen's save handler.
    const { values, mode } = studentForm;
    if (
      !values.studentName.trim() ||
      !values.fatherName.trim() ||
      !values.program ||
      (values.program === 'asri-taleem-class-1-10' && !values.className)
    ) {
      setNotice('Complete the student name, father name, program, class (if needed), and hostel status.');
      return;
    }

    try {
      if (mode === 'edit') {
        await onUpdateStudent(values);
      } else {
        await onAddStudent(values);
      }
    } catch (error) {
      setNotice(`Could not save student: ${error.message}`);
      return;
    }
    setStudentForm(null);
    setNotice(mode === 'edit' ? 'Student information updated.' : 'Student added.');
  }

  function chooseStudentPhoto() {
    // Use the device photo picker and show errors instead of silently ignoring them.
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 })
      .then(result => {
        if (result.didCancel) {
          return;
        }
        if (result.errorCode) {
          setNotice(`Could not select photo: ${result.errorMessage || result.errorCode}`);
          return;
        }
        const photoUri = result.assets?.[0]?.uri;
        if (!photoUri) {
          setNotice('The photo picker returned no image. Please try again.');
          return;
        }
        updateStudentField('photoUri', photoUri);
      })
      .catch(error => {
        setNotice(`Could not open photo picker: ${error.message}`);
      });
  }

  function confirmDeleteStudent(student) {
    // Ask for confirmation because deleting a profile cannot be undone from this screen.
    Alert.alert(
      'Delete student?',
      `Remove ${student.studentName} from the student records?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDeleteStudent(student.id);
              setNotice('Student deleted.');
            } catch (error) {
              setNotice(`Could not delete student: ${error.message}`);
            }
          },
        },
      ],
    );
  }

  function startTeacherForm(teacher) {
    setNotice('');
    const values = {
      ...emptyTeacher,
      ...(teacher || {}),
      subjects: Array.isArray(teacher?.subjects)
        ? teacher.subjects.join(', ')
        : teacher?.subjects || '',
    };
    setTeacherForm({
      mode: teacher ? 'edit' : 'add',
      values,
    });
  }

  function updateTeacherField(field, value) {
    setTeacherForm(current => ({
      ...current,
      values: { ...current.values, [field]: value },
    }));
    setNotice('');
  }

  function toggleTeacherAssignment(field, value) {
    // A teacher can be assigned to several programs or classes at once.
    const selected = teacherForm.values[field];
    updateTeacherField(
      field,
      selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value],
    );
  }

  async function saveTeacher() {
    // Convert the comma-separated subjects field into a clean list before saving.
    const { values, mode } = teacherForm;
    if (isSavingTeacher) {
      return;
    }
    if (!values.name.trim() || !values.contactNumber.trim()) {
      setNotice('Enter the teacher name and contact number.');
      return;
    }

    const email = (values.email || '').trim().toLowerCase();
    const password = values.password;
    if (
      mode === 'add' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setNotice('Enter a valid teacher email address.');
      return;
    }
    if (mode === 'add' && password.length < 6) {
      setNotice('The initial password must be at least 6 characters.');
      return;
    }

    const { email: savedEmail, password: teacherPassword, ...profileValues } =
      values;
    const teacher = {
      ...profileValues,
      ...(mode === 'add' ? { email } : savedEmail ? { email: savedEmail } : {}),
      subjects: (values.subjects || '')
        .split(',')
        .map(subject => subject.trim())
        .filter(Boolean),
    };
    setIsSavingTeacher(true);
    try {
      if (mode === 'edit') {
        await onUpdateTeacher(teacher);
      } else {
        await onAddTeacher(teacher, teacherPassword);
      }
    } catch (error) {
      setNotice(`Could not ${mode === 'edit' ? 'save' : 'create'} teacher account: ${error.message}`);
      setIsSavingTeacher(false);
      return;
    }
    setIsSavingTeacher(false);
    setTeacherForm(null);
    setNotice(
      mode === 'edit'
        ? 'Teacher profile updated.'
        : `Teacher account created. A verification email was sent to ${email}.`,
    );
  }

  function confirmDeleteTeacher(teacher) {
    Alert.alert(
      'Delete teacher?',
      `Remove ${teacher.name} from the teacher records?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDeleteTeacher(teacher.id);
              setNotice('Teacher profile deleted.');
            } catch (error) {
              setNotice(`Could not delete teacher profile: ${error.message}`);
            }
          },
        },
      ],
    );
  }

  function renderOverview() {
    // The overview summarizes counts and surfaces a few requests for quick review.
    return (
      <>
        <View style={styles.metricRow}>
          <Metric label={strings.students} value={students.length} />
          <Metric label={strings.teachers} value={teachers.length} />
          <Metric label={strings.requests} value={registrationRequests.length} />
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{strings.registrationRequests}</Text>
          <Text style={styles.sectionCount}>
            {registrationRequests.length} {strings.pending}
          </Text>
        </View>
        {registrationRequests.length === 0 ? (
          <EmptyState text="New student registrations will appear here for review." />
        ) : (
          registrationRequests.slice(0, 3).map(request => (
            <RegistrationCard
              key={request.id}
              request={request}
              onApprove={() => onApproveRegistration(request.id)}
              onDecline={() => onDeclineRegistration(request.id)}
              actionTestPrefix={`overview-${request.id}`}
            />
          ))
        )}
        {registrationRequests.length > 3 && (
          <ActionButton
            label={`View all ${registrationRequests.length} requests`}
            onPress={() => setActiveTab('requests')}
            variant="secondary"
          />
        )}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{strings.quickActions}</Text>
        </View>
        <View style={styles.quickActions}>
          <ActionButton
            label="+ Add student"
            onPress={() => {
              setActiveTab('students');
              startStudentForm(null);
            }}
          />
          <ActionButton
            label="+ Add teacher"
            onPress={() => {
              setActiveTab('teachers');
              startTeacherForm(null);
            }}
            variant="secondary"
          />
        </View>
      </>
    );
  }

  function renderRequests() {
    // Registration requests remain separate until an admin approves or declines them.
    return (
      <>
        <Text style={styles.sectionTitle}>{strings.reviewRegistrations}</Text>
        {registrationRequests.length === 0 ? (
          <EmptyState text="There are no pending student registrations." />
        ) : (
          registrationRequests.map(request => (
            <RegistrationCard
              key={request.id}
              request={request}
              onApprove={() => onApproveRegistration(request.id)}
              onDecline={() => onDeclineRegistration(request.id)}
              actionTestPrefix={`request-${request.id}`}
            />
          ))
        )}
      </>
    );
  }

  function renderStudentForm() {
    if (!studentForm) {
      return null;
    }
    const { values } = studentForm;

    return (
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>
          {studentForm.mode === 'edit' ? 'Edit student' : 'Add student'}
        </Text>
        <PhotoPicker
          photoUri={values.photoUri}
          onPress={chooseStudentPhoto}
        />
        <FormField
          label="Student name"
          value={values.studentName}
          onChangeText={value => updateStudentField('studentName', value)}
          testID="admin-student-name"
        />
        <FormField
          label="Father name"
          value={values.fatherName}
          onChangeText={value => updateStudentField('fatherName', value)}
          testID="admin-father-name"
        />
        <FormField
          label="Date of birth"
          value={values.dateOfBirth}
          placeholder="DD / MM / YYYY"
          onChangeText={value => updateStudentField('dateOfBirth', value)}
          testID="admin-student-dob"
        />
        <FormField
          label="Address"
          value={values.address}
          multiline
          onChangeText={value => updateStudentField('address', value)}
          testID="admin-student-address"
        />
        <FormField
          label="Email"
          value={values.gmail}
          keyboardType="email-address"
          onChangeText={value => updateStudentField('gmail', value)}
          testID="admin-student-email"
        />
        <FormField
          label="Contact number"
          value={values.contactNumber}
          keyboardType="phone-pad"
          onChangeText={value => updateStudentField('contactNumber', value)}
          testID="admin-student-contact"
        />
        <Text style={styles.fieldLabel}>Program</Text>
        <ChoiceGrid
          items={programs}
          selected={values.program}
          onSelect={program => {
            setStudentForm(current => ({
              ...current,
              values: {
                ...current.values,
                program,
                className:
                  program === 'asri-taleem-class-1-10'
                    ? current.values.className
                    : '',
              },
            }));
          }}
          testPrefix="student-program"
        />
        {values.program === 'asri-taleem-class-1-10' && (
          <>
            <Text style={styles.fieldLabel}>Class</Text>
            <ChoiceGrid
              items={classes.map(grade => ({ id: grade, label: `Class ${grade}` }))}
              selected={values.className}
              onSelect={grade => updateStudentField('className', grade)}
              testPrefix="student-class"
            />
          </>
        )}
        <TeacherPicker
          teachers={teachers}
          selectedTeacherId={values.teacherId || ''}
          onSelect={teacherId => updateStudentField('teacherId', teacherId)}
        />
        <Text style={styles.fieldLabel}>
          Hostel status: {values.hostelStatus === 'resident' ? 'Hostel resident' : 'Day student'}
        </Text>
        <Text style={styles.parentAccessHint}>
          Hostel status changes only after the Hostel Admin approves and processes an allocation or cancellation.
        </Text>
        <View style={styles.formActions}>
          <ActionButton
            label={studentForm.mode === 'edit' ? 'Save changes' : 'Add student'}
            onPress={saveStudent}
            testID="save-student"
          />
          <ActionButton
            label="Cancel"
            onPress={() => setStudentForm(null)}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  function renderStudents() {
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Student records</Text>
          <ActionButton
            label="+ Add"
            onPress={() => startStudentForm(null)}
            testID="add-student"
          />
        </View>
        <TextInput
          onChangeText={setStudentSearch}
          placeholder="Search by name, contact, or program"
          style={styles.searchInput}
          testID="student-search"
          value={studentSearch}
        />
        {renderStudentForm()}
        {filteredStudents.length === 0 ? (
          <EmptyState
            text={studentSearch ? 'No students match your search.' : 'No student records yet. Add a student or approve a registration.'}
          />
        ) : (
          filteredStudents.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              teacher={teachers.find(item => item.id === student.teacherId)}
              onEdit={() => startStudentForm(student)}
              onDelete={() => confirmDeleteStudent(student)}
            />
          ))
        )}
      </>
    );
  }

  function renderTeacherForm() {
    if (!teacherForm) {
      return null;
    }
    const { values } = teacherForm;

    return (
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>
          {teacherForm.mode === 'edit' ? 'Edit teacher profile' : 'Add teacher'}
        </Text>
        <FormField
          label="Name"
          value={values.name}
          onChangeText={value => updateTeacherField('name', value)}
          testID="teacher-name"
        />
        {teacherForm.mode === 'add' ? (
          <>
            <FormField
              label="Email"
              value={values.email}
              keyboardType="email-address"
              autoComplete="email"
              onChangeText={value => updateTeacherField('email', value)}
              testID="teacher-email"
            />
            <FormField
              label="Initial password"
              value={values.password}
              autoComplete="new-password"
              secureTextEntry
              onChangeText={value => updateTeacherField('password', value)}
              testID="teacher-password"
            />
          </>
        ) : null}
        <FormField
          label="Qualification"
          value={values.qualification}
          onChangeText={value => updateTeacherField('qualification', value)}
          testID="teacher-qualification"
        />
        <FormField
          label="Experience"
          value={values.experience}
          placeholder="For example: 5 years"
          onChangeText={value => updateTeacherField('experience', value)}
          testID="teacher-experience"
        />
        <FormField
          label="Contact number"
          value={values.contactNumber}
          keyboardType="phone-pad"
          onChangeText={value => updateTeacherField('contactNumber', value)}
          testID="teacher-contact"
        />
        <FormField
          label="Subjects assigned"
          value={values.subjects}
          placeholder="Separate subjects with commas"
          onChangeText={value => updateTeacherField('subjects', value)}
          testID="teacher-subjects"
        />
        <FormField
          label="Salary"
          value={values.salary}
          keyboardType="numeric"
          onChangeText={value => updateTeacherField('salary', value)}
          testID="teacher-salary"
        />
        <Text style={styles.fieldLabel}>Assign programs</Text>
        <AssignmentGrid
          items={programs}
          selected={values.assignedPrograms}
          onToggle={value => toggleTeacherAssignment('assignedPrograms', value)}
          testPrefix="teacher-program"
        />
        <Text style={styles.fieldLabel}>Assign classes</Text>
        <AssignmentGrid
          items={classes.map(grade => ({ id: grade, label: `Class ${grade}` }))}
          selected={values.assignedClasses}
          onToggle={value => toggleTeacherAssignment('assignedClasses', value)}
          testPrefix="teacher-class"
        />
        <View style={styles.formActions}>
          <ActionButton
            label={
              isSavingTeacher
                ? teacherForm.mode === 'edit'
                  ? 'Saving...'
                  : 'Creating account...'
                : teacherForm.mode === 'edit'
                  ? 'Save changes'
                  : 'Add teacher'
            }
            onPress={saveTeacher}
            testID="save-teacher"
          />
          <ActionButton
            label="Cancel"
            onPress={() => setTeacherForm(null)}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  function renderTeachers() {
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Teacher management</Text>
          <ActionButton
            label="+ Add"
            onPress={() => startTeacherForm(null)}
            testID="add-teacher"
          />
        </View>
        {renderTeacherForm()}
        {teachers.length === 0 ? (
          <EmptyState text="No teachers added yet." />
        ) : (
          teachers.map(teacher => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              onEdit={() => startTeacherForm(teacher)}
              onDelete={() => confirmDeleteTeacher(teacher)}
            />
          ))
        )}
      </>
    );
  }

  function renderParentAccess() {
    return <ParentAccessManagement language={language} students={students} />;
  }

  function renderHostel() {
    return (
      <HostelManagementScreen
        language={language}
        students={students}
        rooms={hostelRooms}
        registrations={hostelRegistrations}
        requests={hostelRequests}
        attendance={hostelAttendance}
        meals={hostelMeals}
        visitors={hostelVisitors}
        onCreateRoom={onCreateHostelRoom}
        onAllocateRoom={onAllocateHostelRoom}
        onReviewRequest={onReviewHostelRequest}
        onAllocateRequest={onAllocateHostelRequest}
        onSaveMeals={onSaveHostelMeals}
        onSaveAttendance={onSaveHostelAttendance}
        onRecordVisitor={onRecordHostelVisitor}
      />
    );
  }

  function renderFinance() {
    return (
      <FinanceManagementScreen
        language={language}
        records={financialRecords}
        students={students}
        teachers={teachers}
        onSave={onSaveFinancialRecord}
        onDelete={onDeleteFinancialRecord}
      />
    );
  }

  // Resolve the current tab to its screen section.
  const tabContent = {
    overview: renderOverview,
    requests: renderRequests,
    students: renderStudents,
    teachers: renderTeachers,
    parents: renderParentAccess,
    hostel: renderHostel,
    finance: renderFinance,
  }[activeTab];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>{strings.appAdministration.toUpperCase()}</Text>
            <Text style={styles.title}>{strings.adminDashboard}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={styles.signOutButton}
            testID="admin-back">
            <Text style={styles.signOutText}>{strings.logOut}</Text>
          </Pressable>
        </View>
        {!isAuthenticated ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            Sign in with an administrator account to manage live records.
          </Text>
        ) : null}
        {backendNotice ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {backendNotice}
          </Text>
        ) : null}
        {notice ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === tab.id }}
              key={tab.id}
              onPress={() => {
                setActiveTab(tab.id);
                setNotice('');
              }}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              testID={`admin-tab-${tab.id}`}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.id === 'parents'
                  ? strings.parents
                  : tab.id === 'hostel'
                    ? strings.hostelManagement
                    : tab.id === 'finance'
                      ? strings.financeManagement
                    : strings[tab.id]}
                {tab.id === 'requests' && registrationRequests.length > 0
                  ? ` (${registrationRequests.length})`
                  : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        {tabContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ text }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

function RegistrationCard({
  request,
  onApprove,
  onDecline,
  actionTestPrefix,
}) {
  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>{request.studentName}</Text>
      <Text style={styles.recordSubtitle}>Father: {request.fatherName}</Text>
      <Text style={styles.recordDetail}>
        {getProgramLabel(request.program)}
        {request.className ? ` · Class ${request.className}` : ''}
      </Text>
      <Text style={styles.recordDetail}>{request.contactNumber}</Text>
      <View style={styles.recordActions}>
        <ActionButton
          label="Approve"
          onPress={onApprove}
          testID={`${actionTestPrefix}-approve`}
        />
        <ActionButton
          label="Decline"
          onPress={onDecline}
          variant="danger"
          testID={`${actionTestPrefix}-decline`}
        />
      </View>
    </View>
  );
}

function StudentCard({ student, teacher, onEdit, onDelete }) {
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        {student.photoUri ? (
          <Image source={{ uri: student.photoUri }} style={styles.studentPhoto} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>
              {student.studentName?.charAt(0)?.toUpperCase() || 'S'}
            </Text>
          </View>
        )}
        <View style={styles.recordHeaderText}>
          <Text style={styles.recordTitle}>{student.studentName}</Text>
          <Text style={styles.recordSubtitle}>Father: {student.fatherName}</Text>
        </View>
      </View>
      <Text style={styles.recordDetail}>
        {getProgramLabel(student.program)}
        {student.className ? ` · Class ${student.className}` : ''}
      </Text>
      <Text style={styles.recordDetail}>
        {student.contactNumber || 'No contact number'} ·{' '}
        {student.hostelStatus === 'resident' ? 'Hostel resident' : 'Day student'}
      </Text>
      <Text style={styles.recordDetail} testID={`student-assigned-teacher-${student.id}`}>
        Assigned teacher: {teacher?.name || 'Unassigned'}
      </Text>
      <View style={styles.recordActions}>
        <ActionButton label="Edit" onPress={onEdit} variant="secondary" testID={`edit-student-${student.id}`} />
        <ActionButton label="Delete" onPress={onDelete} variant="danger" testID={`delete-student-${student.id}`} />
      </View>
    </View>
  );
}

function TeacherCard({ teacher, onEdit, onDelete }) {
  const programsText = (teacher.assignedPrograms || [])
    .map(getProgramLabel)
    .join(', ');
  const subjectsText = Array.isArray(teacher.subjects)
    ? teacher.subjects.join(', ')
    : teacher.subjects;

  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>{teacher.name}</Text>
      <Text style={styles.recordSubtitle}>
        {teacher.qualification || 'Qualification not specified'}
        {teacher.experience ? ` · ${teacher.experience}` : ''}
      </Text>
      {teacher.email ? (
        <Text style={styles.recordDetail}>Email: {teacher.email}</Text>
      ) : null}
      <Text style={styles.recordDetail}>Contact: {teacher.contactNumber}</Text>
      <Text style={styles.recordDetail}>
        Subjects: {subjectsText || 'Not assigned'}
      </Text>
      <Text style={styles.recordDetail}>
        Programs: {programsText || 'Not assigned'} · Classes:{' '}
        {(teacher.assignedClasses || []).join(', ') || 'Not assigned'}
      </Text>
      <Text style={styles.recordDetail}>Salary: {teacher.salary || 'Not set'}</Text>
      <Text style={styles.workload}>
        Workload: {(teacher.assignedPrograms || []).length} programs,{' '}
        {(teacher.assignedClasses || []).length} classes
      </Text>
      <View style={styles.recordActions}>
        <ActionButton label="Edit profile" onPress={onEdit} variant="secondary" testID={`edit-teacher-${teacher.id}`} />
        <ActionButton label="Delete" onPress={onDelete} variant="danger" testID={`delete-teacher-${teacher.id}`} />
      </View>
    </View>
  );
}

function PhotoPicker({ photoUri, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.photoPicker}
      testID="student-photo-picker">
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photoPreview} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>+</Text>
        </View>
      )}
      <View>
        <Text style={styles.photoPickerTitle}>
          {photoUri ? 'Change student photo' : 'Add student photo'}
        </Text>
        <Text style={styles.photoPickerSubtitle}>Choose an image from this device</Text>
      </View>
    </Pressable>
  );
}

function AssignmentGrid({ items, selected, onToggle, testPrefix }) {
  return (
    <View style={styles.choiceGrid}>
      {items.map(item => {
        const isSelected = selected.includes(item.id);

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={item.id}
            onPress={() => onToggle(item.id)}
            style={[styles.choice, isSelected && styles.choiceSelected]}
            testID={`${testPrefix}-${item.id}`}>
            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
