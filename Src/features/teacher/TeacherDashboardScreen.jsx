import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import getStrings from '../../localization';
import { saveTeacherReport } from '../../services/firebase/parentMonitoring';
import { getProgramLabel } from '../students/studentOptions';
import styles from './styles';

const tabs = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'quran', label: 'Hifz' },
  { id: 'nazra', label: 'Nazra' },
  { id: 'dars', label: 'Dars' },
  { id: 'takrar', label: 'Takrar' },
  { id: 'school', label: 'School' },
];

const tabPrograms = {
  attendance: null,
  quran: ['hifz-ul-quran'],
  nazra: ['nazra-quran'],
  dars: ['dars-e-nizami'],
  takrar: ['dars-e-nizami'],
  school: ['asri-taleem-class-1-10'],
};

// Map internal tab IDs to language dictionary keys.
const tabStringKeys = {
  attendance: 'attendance',
  quran: 'teacherTabHifz',
  nazra: 'teacherTabNazra',
  dars: 'teacherTabDars',
  takrar: 'teacherTabTakrar',
  school: 'school',
};

const attendanceTypes = [
  { id: 'present', label: 'Present' },
  { id: 'absent', label: 'Absent' },
  { id: 'leave', label: 'Leave' },
];

// Attendance IDs are saved in reports; these keys provide translated button text.
const attendanceStringKeys = {
  present: 'attendancePresent',
  absent: 'attendanceAbsent',
  leave: 'attendanceLeave',
};

const fluencyLevels = ['Excellent', 'Good', 'Needs practice'];

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  testID,
}) {
  // Reusable label/input pair keeps all teacher forms consistent.
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="sentences"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        style={[styles.input, multiline && styles.multilineInput]}
        testID={testID}
        value={value}
      />
    </>
  );
}

function Button({
  label,
  onPress,
  testID,
  secondary,
  danger,
  disabled,
  compact,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
        compact && styles.compactButton,
      ]}
      testID={testID}>
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
          danger && styles.dangerButtonText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceRow({ items, selected, onSelect, testPrefix }) {
  return (
    <View style={styles.choiceRow}>
      {items.map(item => {
        const choice = typeof item === 'string' ? { id: item, label: item } : item;
        const isSelected = selected === choice.id;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={choice.id}
            onPress={() => onSelect(choice.id)}
            style={[styles.choice, isSelected && styles.choiceSelected]}
            testID={testPrefix ? `${testPrefix}-${choice.id}` : undefined}>
            <Text
              style={[
                styles.choiceText,
                isSelected && styles.choiceTextSelected,
              ]}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function EmptyState({ children }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{children}</Text>
    </View>
  );
}

function RecordCard({ title, children, badge }) {
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordTitle}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Detail({ label, value }) {
  if (!value) {
    return null;
  }
  return (
    <Text style={styles.recordDetail}>
      <Text style={styles.detailLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

function mistakeGrade(value) {
  // Turn the mistake count into the traditional Hifz performance grade.
  const mistakes = Number(value);
  if (!Number.isFinite(mistakes) || mistakes < 0) {
    return '';
  }
  if (mistakes === 0) {
    return 'Mumtaz';
  }
  if (mistakes <= 2) {
    return 'Jayyid Jiddan';
  }
  if (mistakes <= 4) {
    return 'Jayyid';
  }
  return 'Needs Improvement';
}

function isWithinLastSevenDays(date) {
  const parsedDate = new Date(`${date}T00:00:00`);
  const currentDate = new Date(`${today()}T00:00:00`);
  const difference = currentDate - parsedDate;
  return difference >= 0 && difference <= 7 * 24 * 60 * 60 * 1000;
}

export default function TeacherDashboardScreen({
  language,
  onBack,
  students: registeredStudents,
  onPromoteStudent,
  backendNotice,
  isAuthenticated = false,
}) {
  const strings = getStrings(language);
  // The teacher board always uses the live student list supplied by the app.
  const students = useMemo(
    () => registeredStudents || [],
    [registeredStudents],
  );

  // Keep the selected student and each teaching module's form/report data in state.
  const [activeTab, setActiveTab] = useState('attendance');
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || '');
  const [notice, setNotice] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [attendance, setAttendance] = useState([]);
  const [quranForm, setQuranForm] = useState({
    date: today(),
    juz: '',
    surah: '',
    ayahStart: '',
    ayahEnd: '',
    pages: '',
    sabaqiDate: today(),
    sabaqiSurah: '',
    sabaqiRange: '',
    sabaqiNotes: '',
    manzilJuz: '',
    manzilSurah: '',
    manzilRange: '',
    mistakes: '0',
  });
  const [quranRecords, setQuranRecords] = useState([]);
  const [nazraForm, setNazraForm] = useState({
    date: today(),
    page: '',
    completion: '100',
    fluency: 'Good',
    pronunciationErrors: '0',
    remarks: '',
  });
  const [nazraRecords, setNazraRecords] = useState([]);
  const [bookForm, setBookForm] = useState({
    book: '',
    chapters: '',
    pages: '',
    percentage: '',
  });
  const [bookProgress, setBookProgress] = useState([]);
  const [takrarForm, setTakrarForm] = useState({
    date: today(),
    time: '',
    subject: '',
    supervisor: '',
    status: 'present',
  });
  const [takrarRecords, setTakrarRecords] = useState([]);
  const [schoolClass, setSchoolClass] = useState('1');
  const [schoolSubject, setSchoolSubject] = useState('');
  const [schoolSubjects, setSchoolSubjects] = useState([
    'English',
    'Mathematics',
    'Islamiat',
  ]);
  const [marksForm, setMarksForm] = useState({
    subject: 'English',
    marks: '',
    total: '100',
  });
  const [marksRecords, setMarksRecords] = useState([]);
  const [schoolReport, setSchoolReport] = useState('');
  const [attendanceReport, setAttendanceReport] = useState('');

  const activeStudent =
    students.find(student => student.id === selectedStudentId) || students[0];
  useEffect(() => {
    const currentStudent =
      students.find(student => student.id === selectedStudentId) || students[0];

    if (!currentStudent) {
      if (selectedStudentId) {
        setSelectedStudentId('');
      }
      if (activeTab !== 'attendance') {
        setActiveTab('attendance');
      }
      return;
    }

    if (currentStudent.id !== selectedStudentId) {
      setSelectedStudentId(currentStudent.id);
    }

    const allowedPrograms = tabPrograms[activeTab];
    if (allowedPrograms && !allowedPrograms.includes(currentStudent.program)) {
      setActiveTab('attendance');
    }
  }, [activeTab, selectedStudentId, students]);

  const isTabAvailable = tab =>
    Boolean(activeStudent) &&
    (!tabPrograms[tab.id] || tabPrograms[tab.id].includes(activeStudent.program));
  const studentAttendance = attendance.filter(
    record => record.studentId === activeStudent?.id,
  );
  const monthAttendance = studentAttendance.filter(
    record => record.date.slice(0, 7) === attendanceDate.slice(0, 7),
  );
  const studentQuran = quranRecords.filter(
    record => record.studentId === activeStudent?.id,
  );
  const studentNazra = nazraRecords.filter(
    record => record.studentId === activeStudent?.id,
  );
  const studentTakrar = takrarRecords.filter(
    record => record.studentId === activeStudent?.id,
  );
  const studentMarks = marksRecords.filter(
    record =>
      record.studentId === activeStudent?.id && record.className === schoolClass,
  );
  const markedStudentCount = students.filter(student =>
    attendance.some(
      record =>
        record.studentId === student.id && record.date === attendanceDate,
    ),
  ).length;

  // Derive the selected student's records so one student's activity is not mixed with another's.
  const latestQuran = useMemo(() => studentQuran.slice().reverse(), [studentQuran]);
  const recentNazra = useMemo(() => studentNazra.slice().reverse(), [studentNazra]);

  function updateQuran(field, value) {
    setQuranForm(current => ({ ...current, [field]: value }));
    setNotice('');
  }

  function updateNazra(field, value) {
    setNazraForm(current => ({ ...current, [field]: value }));
    setNotice('');
  }

  function updateTakrar(field, value) {
    setTakrarForm(current => ({ ...current, [field]: value }));
    setNotice('');
  }

  function markAttendanceFor(student, status) {
    if (!student) {
      setNotice('Add or approve a student before marking attendance.');
      return;
    }
    if (!isValidDate(attendanceDate)) {
      setNotice('Enter a valid attendance date in YYYY-MM-DD format.');
      return;
    }
    // A student's date is the unique key, so marking again updates that day's status.
    const record = {
      id: `${student.id}-${attendanceDate}`,
      studentId: student.id,
      studentName: student.studentName,
      date: attendanceDate,
      status,
    };
    setAttendance(current => {
      const withoutDay = current.filter(item => item.id !== record.id);
      return [...withoutDay, record].sort((a, b) => b.date.localeCompare(a.date));
    });
    if (isAuthenticated) {
      saveTeacherReport(student.id, 'attendance', record).catch(error =>
        setNotice(`Could not save attendance report: ${error.message}`),
      );
    }
    setSelectedStudentId(student.id);
    setNotice(`${student.studentName} marked ${strings[attendanceStringKeys[status]]} for ${attendanceDate}.`);
  }

  function generateAttendanceReport() {
    if (!isValidDate(attendanceDate)) {
      setNotice('Enter a valid attendance date in YYYY-MM-DD format.');
      return;
    }
    // Count each attendance status for the selected month.
    const totals = attendanceTypes.reduce(
      (result, type) => ({
        ...result,
        [type.id]: monthAttendance.filter(record => record.status === type.id).length,
      }),
      {},
    );
    setAttendanceReport(
      `${attendanceDate.slice(0, 7)} report — Present: ${totals.present}, Absent: ${totals.absent}, Leave: ${totals.leave}.`,
    );
  }

  function saveQuranRecord(type) {
    // Each Hifz record type has different required fields and date inputs.
    const required = {
      sabaq: [
        ['juz', quranForm.juz],
        ['surah', quranForm.surah],
        ['ayah start', quranForm.ayahStart],
        ['ayah end', quranForm.ayahEnd],
        ['pages memorized', quranForm.pages],
      ],
      sabaqi: [
        ['revision date', quranForm.sabaqiDate],
        ['surah', quranForm.sabaqiSurah],
        ['ayah range', quranForm.sabaqiRange],
      ],
      manzil: [
        ['juz', quranForm.manzilJuz],
        ['surah', quranForm.manzilSurah],
        ['ayah range', quranForm.manzilRange],
      ],
    }[type];
    const missing = required.find(([, value]) => !value.trim());
    if (missing) {
      setNotice(`Enter ${missing[0]} before saving ${type}.`);
      return;
    }
    if (!/^\d+$/.test(quranForm.mistakes)) {
      setNotice('Enter a whole number for the mistake count.');
      return;
    }
    const record = {
      id: `${Date.now()}-${type}`,
      studentId: activeStudent.id,
      studentName: activeStudent.studentName,
      type,
      date: type === 'sabaqi' ? quranForm.sabaqiDate : quranForm.date,
      juz: type === 'sabaq' ? quranForm.juz : quranForm.manzilJuz,
      surah:
        type === 'sabaqi' ? quranForm.sabaqiSurah :
          type === 'manzil' ? quranForm.manzilSurah : quranForm.surah,
      ayahRange:
        type === 'sabaq'
          ? `${quranForm.ayahStart}-${quranForm.ayahEnd}`
          : type === 'sabaqi'
            ? quranForm.sabaqiRange
            : quranForm.manzilRange,
      pages: type === 'sabaq' ? quranForm.pages : '',
      notes: type === 'sabaqi' ? quranForm.sabaqiNotes : '',
      mistakes: quranForm.mistakes,
      grade: mistakeGrade(quranForm.mistakes),
    };
    setQuranRecords(current => [...current, record]);
    if (isAuthenticated) {
      saveTeacherReport(activeStudent.id, 'hifzProgress', record).catch(error =>
        setNotice(`Could not save Hifz report: ${error.message}`),
      );
    }
    setNotice(`${type[0].toUpperCase()}${type.slice(1)} saved for ${activeStudent.studentName}.`);
  }

  function saveNazra() {
    if (!nazraForm.page.trim() || !nazraForm.completion.trim()) {
      setNotice('Enter the page number and completion percentage.');
      return;
    }
    const completion = Number(nazraForm.completion);
    if (!Number.isFinite(completion) || completion < 0 || completion > 100) {
      setNotice('Completion must be a number from 0 to 100.');
      return;
    }
    // Store one reading log with the selected student's ID for parent access.
    const record = {
      ...nazraForm,
      id: `nazra-${Date.now()}`,
      studentId: activeStudent.id,
      studentName: activeStudent.studentName,
      completion,
    };
    setNazraRecords(current => [
      ...current,
      record,
    ]);
    if (isAuthenticated) {
      saveTeacherReport(activeStudent.id, 'nazraProgress', record).catch(error =>
        setNotice(`Could not save Nazra report: ${error.message}`),
      );
    }
    setNotice('Nazra reading log saved.');
  }

  function saveBookProgress() {
    if (!bookForm.book.trim() || !bookForm.percentage.trim()) {
      setNotice('Enter the kitab name and completion percentage.');
      return;
    }
    const percentage = Number(bookForm.percentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      setNotice('Completion percentage must be from 0 to 100.');
      return;
    }
    setBookProgress(current => {
      const existing = current.find(
        entry =>
          entry.studentId === activeStudent.id &&
          entry.book.toLowerCase() === bookForm.book.trim().toLowerCase(),
      );
      const entry = {
        ...bookForm,
        book: bookForm.book.trim(),
        percentage,
        studentId: activeStudent.id,
        studentName: activeStudent.studentName,
      };
      return existing
        ? current.map(item => (item === existing ? entry : item))
        : [...current, entry];
    });
    setNotice('Kitab progress updated.');
  }

  function saveTakrar() {
    const missing = ['date', 'time', 'subject', 'supervisor'].find(
      field => !takrarForm[field].trim(),
    );
    if (missing) {
      setNotice(`Enter the Takrar ${missing} before saving.`);
      return;
    }
    setTakrarRecords(current => [
      ...current,
      {
        ...takrarForm,
        id: `takrar-${Date.now()}`,
        studentId: activeStudent.id,
        studentName: activeStudent.studentName,
      },
    ]);
    setNotice('Takrar attendance saved separately from daily attendance.');
  }

  function addSchoolSubject() {
    const subject = schoolSubject.trim();
    if (!subject) {
      setNotice('Enter a subject name first.');
      return;
    }
    if (schoolSubjects.some(item => item.toLowerCase() === subject.toLowerCase())) {
      setNotice('That subject is already in the subject list.');
      return;
    }
    setSchoolSubjects(current => [...current, subject]);
    setMarksForm(current => ({ ...current, subject }));
    setSchoolSubject('');
    setNotice(`${subject} added to the subject list.`);
  }

  function saveMarks() {
    const marks = Number(marksForm.marks);
    const total = Number(marksForm.total);
    if (!marksForm.subject || !marksForm.marks.trim() || !marksForm.total.trim()) {
      setNotice('Choose a subject and enter marks and total marks.');
      return;
    }
    if (!Number.isFinite(marks) || !Number.isFinite(total) || total <= 0 || marks < 0 || marks > total) {
      setNotice('Marks must be between 0 and the total marks.');
      return;
    }
    const record = {
      id: `marks-${Date.now()}`,
      studentId: activeStudent.id,
      studentName: activeStudent.studentName,
      className: schoolClass,
      subject: marksForm.subject,
      marks,
      total,
      percentage: Math.round((marks / total) * 100),
    };
    setMarksRecords(current => [
      ...current.filter(
        item =>
          !(
            item.studentId === record.studentId &&
            item.className === record.className &&
            item.subject === record.subject
          ),
      ),
      record,
    ]);
    setSchoolReport('');
    setNotice(`Marks saved for ${record.subject}.`);
  }

  function generateSchoolResult() {
    if (studentMarks.length === 0) {
      setNotice('Enter at least one subject mark before generating a result.');
      return;
    }
    const obtained = studentMarks.reduce((sum, item) => sum + item.marks, 0);
    const total = studentMarks.reduce((sum, item) => sum + item.total, 0);
    const percentage = Math.round((obtained / total) * 100);
    setSchoolReport(
      `${activeStudent.studentName} — Class ${schoolClass} — ${obtained}/${total} (${percentage}%) across ${studentMarks.length} subject${studentMarks.length === 1 ? '' : 's'}.`,
    );
  }

  function promoteStudent() {
    const currentClass = Number(activeStudent?.className);
    if (
      !activeStudent ||
      activeStudent.program !== 'asri-taleem-class-1-10' ||
      !Number.isInteger(currentClass) ||
      currentClass < 1 ||
      currentClass >= 10
    ) {
      setNotice('Promotion is available for Asri Taleem students in Classes 1–9.');
      return;
    }
    onPromoteStudent(activeStudent.id, String(currentClass + 1));
    setSchoolClass(String(currentClass + 1));
    setNotice(`${activeStudent.studentName} promoted to Class ${currentClass + 1}.`);
  }

  function renderAttendance() {
    // The attendance board is above; this section shows date filters and saved history.
    return (
      <>
        <SectionTitle
          title="Daily attendance"
          subtitle={strings.markAttendanceForDate}
        />
        <View style={styles.actionRow}>
          <Button
            label="Generate monthly report"
            onPress={generateAttendanceReport}
            testID="attendance-monthly-report"
          />
        </View>
        {attendanceReport ? (
          <Text style={styles.reportBox} testID="attendance-report">
            {attendanceReport}
          </Text>
        ) : null}
        <SectionTitle title="Attendance history" subtitle="Records for the selected student." />
        {studentAttendance.length === 0 ? (
          <EmptyState>Attendance history will show here after you mark a student.</EmptyState>
        ) : (
          studentAttendance
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(record => (
              <RecordCard
                key={record.id}
                title={record.date}
                badge={record.status}
              />
            ))
        )}
      </>
    );
  }

  function renderQuran() {
    // Teachers can save separate Sabaq, Sabaqi, and Manzil reports for the selected student.
    const grade = mistakeGrade(quranForm.mistakes);
    const studentRecords = latestQuran.filter(
      record => record.date === quranForm.date && ['sabaq', 'sabaqi', 'manzil'].includes(record.type),
    );
    return (
      <>
        <SectionTitle
          title="Hifz daily record"
          subtitle="Record Sabaq, Sabaqi, and Manzil separately for the selected student."
        />
        <Field
          label="Record date"
          value={quranForm.date}
          placeholder="YYYY-MM-DD"
          onChangeText={value => updateQuran('date', value)}
        />
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sabaq · New lesson</Text>
          <Field label="Juz number" value={quranForm.juz} keyboardType="numeric" onChangeText={value => updateQuran('juz', value)} testID="sabaq-juz" />
          <Field label="Surah number or name" value={quranForm.surah} onChangeText={value => updateQuran('surah', value)} testID="sabaq-surah" />
          <View style={styles.inlineFields}>
            <View style={styles.inlineField}><Field label="Ayah start" value={quranForm.ayahStart} keyboardType="numeric" onChangeText={value => updateQuran('ayahStart', value)} /></View>
            <View style={styles.inlineField}><Field label="Ayah end" value={quranForm.ayahEnd} keyboardType="numeric" onChangeText={value => updateQuran('ayahEnd', value)} /></View>
          </View>
          <Field label="Pages memorized" value={quranForm.pages} keyboardType="numeric" onChangeText={value => updateQuran('pages', value)} />
          <Button label="Save Sabaq" onPress={() => saveQuranRecord('sabaq')} testID="save-sabaq" />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sabaqi · Recent revision</Text>
          <Text style={styles.helperText}>Review lessons from the last 5–7 days.</Text>
          <Field label="Revision date" value={quranForm.sabaqiDate} placeholder="YYYY-MM-DD" onChangeText={value => updateQuran('sabaqiDate', value)} />
          <Field label="Surah" value={quranForm.sabaqiSurah} onChangeText={value => updateQuran('sabaqiSurah', value)} />
          <Field label="Ayah range" value={quranForm.sabaqiRange} placeholder="For example: 20-35" onChangeText={value => updateQuran('sabaqiRange', value)} />
          <Field label="Performance notes" value={quranForm.sabaqiNotes} multiline onChangeText={value => updateQuran('sabaqiNotes', value)} />
          <Button label="Save Sabaqi" onPress={() => saveQuranRecord('sabaqi')} testID="save-sabaqi" />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Manzil · Old revision</Text>
          <Field label="Juz number" value={quranForm.manzilJuz} keyboardType="numeric" onChangeText={value => updateQuran('manzilJuz', value)} />
          <Field label="Surah" value={quranForm.manzilSurah} onChangeText={value => updateQuran('manzilSurah', value)} />
          <Field label="Ayah range" value={quranForm.manzilRange} placeholder="For example: 1-15" onChangeText={value => updateQuran('manzilRange', value)} />
          <Button label="Save Manzil" onPress={() => saveQuranRecord('manzil')} testID="save-manzil" />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Mistake counter</Text>
          <Field label="Mistakes" value={quranForm.mistakes} keyboardType="numeric" onChangeText={value => updateQuran('mistakes', value)} testID="mistakes-input" />
          <Text style={styles.gradeResult} testID="mistake-grade">
            Grade: {grade || 'Enter a valid mistake count'}
          </Text>
          <Text style={styles.helperText}>0 Mumtaz · 1–2 Jayyid Jiddan · 3–4 Jayyid · 5+ Needs Improvement</Text>
        </View>

        <SectionTitle title="Today’s saved values" />
        {studentRecords.length === 0 ? (
          <EmptyState>Save today’s Sabaq, Sabaqi, and Manzil to see them here.</EmptyState>
        ) : (
          studentRecords.map(record => (
            <RecordCard key={record.id} title={record.type.toUpperCase()} badge={record.grade}>
              <Detail label="Juz" value={record.juz} />
              <Detail label="Surah" value={record.surah} />
              <Detail label="Ayahs" value={record.ayahRange} />
              <Detail label="Pages" value={record.pages} />
              <Detail label="Notes" value={record.notes} />
            </RecordCard>
          ))
        )}
      </>
    );
  }

  function renderNazra() {
    // Show reading logs and calculate a completion average for the latest week.
    const weeklyRecords = studentNazra.filter(record => isWithinLastSevenDays(record.date));
    const weeklyAverage = weeklyRecords.length
      ? Math.round(
          weeklyRecords.reduce((sum, record) => sum + record.completion, 0) /
            weeklyRecords.length,
        )
      : 0;
    return (
      <>
        <SectionTitle
          title="Nazra reading log"
          subtitle="Track reading, fluency, and pronunciation for each day."
        />
        <Field label="Date" value={nazraForm.date} placeholder="YYYY-MM-DD" onChangeText={value => updateNazra('date', value)} />
        <Field label="Page number" value={nazraForm.page} keyboardType="numeric" onChangeText={value => updateNazra('page', value)} testID="nazra-page" />
        <Field label="Lesson completion (%)" value={nazraForm.completion} keyboardType="numeric" onChangeText={value => updateNazra('completion', value)} />
        <Text style={styles.fieldLabel}>Fluency level</Text>
        <ChoiceRow items={fluencyLevels} selected={nazraForm.fluency} onSelect={value => updateNazra('fluency', value)} />
        <Field label="Pronunciation errors" value={nazraForm.pronunciationErrors} keyboardType="numeric" onChangeText={value => updateNazra('pronunciationErrors', value)} />
        <Field label="Teacher remarks" value={nazraForm.remarks} multiline onChangeText={value => updateNazra('remarks', value)} />
        <Button label="Save reading log" onPress={saveNazra} testID="save-nazra" />

        <SectionTitle title="Progress report" subtitle="Daily log and rolling 7-day completion average." />
        <View style={styles.reportCard}>
          <Text style={styles.reportMetric}>{weeklyAverage}%</Text>
          <Text style={styles.reportMetricLabel}>Weekly average completion</Text>
          <Text style={styles.helperText}>{weeklyRecords.length} reading log(s) in the last 7 days</Text>
        </View>
        <SectionTitle title="Daily reading log" />
        {recentNazra.length === 0 ? (
          <EmptyState>Nazra reading logs will appear after you save a lesson.</EmptyState>
        ) : (
          recentNazra.map(record => (
            <RecordCard key={record.id} title={`Page ${record.page}`} badge={`${record.completion}%`}>
              <Detail label="Date" value={record.date} />
              <Detail label="Fluency" value={record.fluency} />
              <Detail label="Pronunciation errors" value={record.pronunciationErrors} />
              <Detail label="Remarks" value={record.remarks} />
            </RecordCard>
          ))
        )}
      </>
    );
  }

  function renderDars() {
    const progress = bookProgress.filter(item => item.studentId === activeStudent?.id);
    return (
      <>
        <SectionTitle
          title="Dars-e-Nizami kitab progress"
          subtitle="Track chapters, pages, and completion separately for each book."
        />
        <Field label="Kitab name" value={bookForm.book} onChangeText={value => setBookForm(current => ({ ...current, book: value }))} testID="kitab-name" />
        <Field label="Chapters completed" value={bookForm.chapters} keyboardType="numeric" onChangeText={value => setBookForm(current => ({ ...current, chapters: value }))} />
        <Field label="Pages covered" value={bookForm.pages} keyboardType="numeric" onChangeText={value => setBookForm(current => ({ ...current, pages: value }))} />
        <Field label="Completion percentage" value={bookForm.percentage} keyboardType="numeric" placeholder="0–100" onChangeText={value => setBookForm(current => ({ ...current, percentage: value }))} testID="kitab-percentage" />
        <Button label="Update kitab progress" onPress={saveBookProgress} testID="save-kitab-progress" />
        <SectionTitle title="Book-wise progress" />
        {progress.length === 0 ? (
          <EmptyState>Add a kitab above to start tracking progress.</EmptyState>
        ) : (
          progress.map(entry => (
            <RecordCard key={`${entry.studentId}-${entry.book}`} title={entry.book} badge={`${entry.percentage}%`}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${entry.percentage}%` }]} />
              </View>
              <Detail label="Chapters completed" value={entry.chapters} />
              <Detail label="Pages covered" value={entry.pages} />
            </RecordCard>
          ))
        )}
      </>
    );
  }

  function renderTakrar() {
    const records = studentTakrar.slice().reverse();
    return (
      <>
        <SectionTitle
          title="Takrar attendance"
          subtitle="Evening peer-study attendance is recorded separately from daily attendance."
        />
        <Field label="Date" value={takrarForm.date} placeholder="YYYY-MM-DD" onChangeText={value => updateTakrar('date', value)} />
        <Field label="Time" value={takrarForm.time} placeholder="For example: 6:30 PM" onChangeText={value => updateTakrar('time', value)} />
        <Field label="Subject" value={takrarForm.subject} onChangeText={value => updateTakrar('subject', value)} />
        <Field label="Supervising teacher" value={takrarForm.supervisor} onChangeText={value => updateTakrar('supervisor', value)} />
        <Text style={styles.fieldLabel}>Takrar attendance</Text>
        <ChoiceRow
          items={attendanceTypes}
          selected={takrarForm.status}
          onSelect={value => updateTakrar('status', value)}
          testPrefix="takrar-status"
        />
        <Button label="Save Takrar attendance" onPress={saveTakrar} testID="save-takrar" />
        <SectionTitle title="Takrar history" />
        {records.length === 0 ? (
          <EmptyState>Takrar sessions will appear here. They are separate from regular attendance.</EmptyState>
        ) : (
          records.map(record => (
            <RecordCard key={record.id} title={`${record.subject} · ${record.date}`} badge={record.status}>
              <Detail label="Time" value={record.time} />
              <Detail label="Supervisor" value={record.supervisor} />
            </RecordCard>
          ))
        )}
      </>
    );
  }

  function renderSchool() {
    const schoolStudent = activeStudent?.program === 'asri-taleem-class-1-10';
    const currentClass = schoolStudent ? activeStudent.className : '';
    return (
      <>
        <SectionTitle
          title="Asri Taleem"
          subtitle="Manage classes, subjects, marks, results, and student promotion."
        />
        <Text style={styles.fieldLabel}>Class management (1–10)</Text>
        <ChoiceRow
          items={Array.from({ length: 10 }, (_, index) => String(index + 1)).map(grade => ({
            id: grade,
            label: `Class ${grade}`,
          }))}
          selected={schoolClass}
          onSelect={grade => {
            setSchoolClass(grade);
            setSchoolReport('');
          }}
          testPrefix="school-class"
        />
        {schoolStudent ? (
          <View style={styles.studentSchoolCard}>
            <Text style={styles.recordTitle}>{activeStudent.studentName}</Text>
            <Text style={styles.recordDetail}>Registered class: {currentClass || 'Not assigned'}</Text>
            <Button label="Promote to next class" onPress={promoteStudent} testID="promote-student" />
          </View>
        ) : (
          <EmptyState>
            The selected student is not registered in Asri Taleem. School marks and results can still be entered for the selected class.
          </EmptyState>
        )}

        <SectionTitle title={`Subjects · Class ${schoolClass}`} subtitle="Add a subject to the class list." />
        <Field label="New subject" value={schoolSubject} onChangeText={setSchoolSubject} testID="new-school-subject" />
        <Button label="Add subject" onPress={addSchoolSubject} testID="add-school-subject" />
        <ChoiceRow
          items={schoolSubjects.map(subject => ({ id: subject, label: subject }))}
          selected={marksForm.subject}
          onSelect={subject => setMarksForm(current => ({ ...current, subject }))}
        />

        <SectionTitle title="Marks entry" subtitle={`Enter results for ${activeStudent?.studentName || 'the selected student'}.`} />
        <Field label="Marks obtained" value={marksForm.marks} keyboardType="numeric" onChangeText={value => setMarksForm(current => ({ ...current, marks: value }))} testID="school-marks" />
        <Field label="Total marks" value={marksForm.total} keyboardType="numeric" onChangeText={value => setMarksForm(current => ({ ...current, total: value }))} />
        <Button label="Save marks" onPress={saveMarks} testID="save-school-marks" />
        <Button label="Generate result" onPress={generateSchoolResult} secondary testID="generate-school-result" />
        {schoolReport ? (
          <Text style={styles.reportBox} testID="school-result">
            {schoolReport}
          </Text>
        ) : null}
        {studentMarks.map(record => (
          <RecordCard key={record.id} title={record.subject} badge={`${record.percentage}%`}>
            <Detail label="Marks" value={`${record.marks} / ${record.total}`} />
          </RecordCard>
        ))}
      </>
    );
  }

  // Render the active teaching module without unmounting the dashboard shell.
  const content = {
    attendance: renderAttendance,
    quran: renderQuran,
    nazra: renderNazra,
    dars: renderDars,
    takrar: renderTakrar,
    school: renderSchool,
  }[activeTab];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{strings.teacherSpace.toUpperCase()}</Text>
          <Text style={styles.title}>{strings.teacherDashboard}</Text>
        </View>
        <Button
          compact
          label={strings.logOut}
          onPress={onBack}
          secondary
          testID="teacher-exit"
        />
      </View>
      <View style={styles.attendanceBoard}>
        <View style={styles.attendanceBoardHeader}>
          <View style={styles.attendanceBoardHeading}>
            <Text style={styles.attendanceBoardTitle}>{strings.attendanceBoard}</Text>
            <Text style={styles.attendanceBoardDate}>
              {activeStudent
                ? getProgramLabel(activeStudent.program)
                : ''}
            </Text>
          </View>
          <View style={styles.attendanceDateControl}>
            <Text style={styles.attendanceDateLabel}>{strings.attendanceDate}</Text>
            <TextInput
              accessibilityLabel="Attendance date"
              autoCapitalize="none"
              maxLength={10}
              onChangeText={value => {
                setAttendanceDate(value);
                setNotice('');
              }}
              placeholder="YYYY-MM-DD"
              style={styles.attendanceDateInput}
              testID="attendance-date"
              value={attendanceDate}
            />
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attendanceCards}
          testID="teacher-student-attendance-list">
          {students.length === 0 ? (
            <Text style={styles.attendanceEmpty}>{strings.noStudentsForTeacher}</Text>
          ) : (
            students.map(student => {
            // Read this student's status for the current date before rendering the buttons.
            const isSelected = selectedStudentId === student.id;
            const dayRecord = attendance.find(
              record => record.studentId === student.id && record.date === attendanceDate,
            );
            const initials = (student.studentName || '?')
              .split(/\s+/)
              .slice(0, 2)
              .map(part => part[0])
              .join('')
              .toUpperCase();
            const statusPrefix = isSelected
              ? 'attendance-status'
              : `attendance-status-${student.id}`;

            return (
              <View
                key={student.id}
                style={[
                  styles.attendanceStudentCard,
                  isSelected && styles.attendanceStudentCardSelected,
                ]}
                testID={`attendance-board-${student.id}`}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    setSelectedStudentId(student.id);
                    setNotice('');
                    if (
                      tabPrograms[activeTab] &&
                      !tabPrograms[activeTab].includes(student.program)
                    ) {
                      setActiveTab('attendance');
                      setNotice(
                        `${activeTab === 'quran' ? 'Hifz' : tabs.find(tab => tab.id === activeTab)?.label} is unavailable because ${student.studentName} is not enrolled in that program.`,
                      );
                    }
                  }}
                  style={styles.studentProfile}
                  testID={`teacher-student-${student.id}`}>
                  {student.photoUri ? (
                    <Image
                      source={{ uri: student.photoUri }}
                      style={styles.studentProfileImage}
                    />
                  ) : (
                    <View style={styles.studentProfileAvatar}>
                      <Text style={styles.studentProfileInitials}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.studentProfileDetails}>
                    <Text numberOfLines={1} style={styles.studentProfileName}>
                      {student.studentName}
                    </Text>
                    <Text numberOfLines={1} style={styles.studentProfileProgram}>
                      {getProgramLabel(student.program)}
                    </Text>
                  </View>
                </Pressable>
                <Text style={styles.attendanceStatusLabel}>
                  {dayRecord
                    ? `${strings.todayAttendance}: ${strings[attendanceStringKeys[dayRecord.status]]}`
                    : strings.markAttendanceForDate}
                </Text>
                <View style={styles.attendanceStatusChoices}>
                  {attendanceTypes.map(type => {
                    const selected = dayRecord?.status === type.id;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={type.id}
                        onPress={() => markAttendanceFor(student, type.id)}
                        style={[
                          styles.attendanceStatusChoice,
                          selected && styles.attendanceStatusChoiceSelected,
                        ]}
                        testID={`${statusPrefix}-${type.id}`}>
                        <Text
                          style={[
                            styles.attendanceStatusChoiceText,
                            selected && styles.attendanceStatusChoiceTextSelected,
                          ]}>
                          {strings[attendanceStringKeys[type.id]]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
            })
          )}
        </ScrollView>
        <View style={styles.attendanceProgress}>
          <View style={styles.attendanceProgressTrack}>
            {Array.from({ length: 10 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.attendanceProgressSegment,
                  index <
                    (students.length
                      ? Math.ceil((markedStudentCount / students.length) * 10)
                      : 0) && styles.attendanceProgressSegmentFilled,
                ]}
              />
            ))}
          </View>
          <Text style={styles.attendanceProgressLabel} testID="teacher-attendance-progress">
            {strings.attendanceProgress
              .replace('{marked}', String(markedStudentCount))
              .replace('{total}', String(students.length))}
          </Text>
        </View>
      </View>
      <Text style={styles.liveDataNotice}>
        {strings.teacherLiveNotice}
      </Text>
      <Text style={styles.programAccessHint}>
        Greyed-out sections are not available for the selected student’s program.
      </Text>
      {backendNotice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {backendNotice}
        </Text>
      ) : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}>
        {tabs.map(tab => {
          const available = isTabAvailable(tab);

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: !available,
                selected: activeTab === tab.id,
              }}
              disabled={!available}
              key={tab.id}
              onPress={() => {
                if (!available) {
                  return;
                }
                setActiveTab(tab.id);
                setNotice('');
              }}
              style={[
                styles.tab,
                activeTab === tab.id && styles.tabActive,
                !available && styles.tabDisabled,
              ]}
              testID={`teacher-tab-${tab.id}`}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.tabTextActive,
                  !available && styles.tabTextDisabled,
                ]}>
                {strings[tabStringKeys[tab.id]]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.contentScroll}>
        {activeStudent ? content() : null}
      </ScrollView>
    </SafeAreaView>
  );
}
