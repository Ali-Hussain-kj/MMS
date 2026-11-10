import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import getStrings from '../../localization';
import {
  createParentHostelRequest,
  subscribeToParentHostelRequests,
  subscribeToParentReports,
} from '../../services/firebase/parentMonitoring';
import styles from './styles';

const periods = ['daily', 'weekly', 'monthly'];
const hifzTypes = ['sabaq', 'sabaqi', 'manzil'];
const attendanceStringKeys = {
  present: 'attendancePresent',
  absent: 'attendanceAbsent',
  leave: 'attendanceLeave',
};

// Dates are stored as YYYY-MM-DD strings so the parent can filter reports by period.
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Match attendance dates against the period the parent selected.
function isWithinPeriod(date, period) {
  if (!date) {
    return false;
  }
  if (period === 'daily') {
    return date === today();
  }
  if (period === 'monthly') {
    return date.slice(0, 7) === today().slice(0, 7);
  }
  const recordDate = new Date(`${date}T00:00:00`);
  const currentDate = new Date(`${today()}T00:00:00`);
  const daysAgo = (currentDate - recordDate) / (24 * 60 * 60 * 1000);
  return daysAgo >= 0 && daysAgo < 7;
}

function ReportCard({ title, subtitle, details }) {
  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>{title}</Text>
        {subtitle ? <Text style={styles.reportDate}>{subtitle}</Text> : null}
      </View>
      {details.map(detail => (
        <Text key={detail} style={styles.reportDetail}>
          {detail}
        </Text>
      ))}
    </View>
  );
}

export default function ParentMonitoringScreen({ language, user, onSignOut }) {
  const strings = getStrings(language);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hostelRequests, setHostelRequests] = useState([]);
  const [hostelRequestMessage, setHostelRequestMessage] = useState('');
  const [isSubmittingHostelRequest, setIsSubmittingHostelRequest] =
    useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    // The service only subscribes to student IDs listed on this parent's Firestore profile.
    return subscribeToParentReports(
      user.uid,
      reports => {
        setChildren(reports.filter(report => report.student));
        setSelectedChildId(current =>
          reports.some(report => report.student?.id === current)
            ? current
            : reports.find(report => report.student)?.student.id || '',
        );
        setLoading(false);
      },
      subscriptionError => {
        setError(subscriptionError.message);
        setLoading(false);
      },
    );
  }, [user.uid]);

  useEffect(
    () =>
      subscribeToParentHostelRequests(
        user.uid,
        setHostelRequests,
        subscriptionError => setError(subscriptionError.message),
      ),
    [user.uid],
  );

  const child = children.find(report => report.student.id === selectedChildId);
  const requestsByStudent = hostelRequests.reduce((requestsById, request) => {
    if (!requestsById.has(request.studentId)) {
      requestsById.set(request.studentId, request);
    }
    return requestsById;
  }, new Map());
  // Filter the selected child's downloaded attendance for the chosen time period.
  const attendance = useMemo(
    () =>
      (child?.attendance || []).filter(record =>
        isWithinPeriod(record.date, period),
      ),
    [child, period],
  );
  const hifzProgress = child?.hifzProgress || [];
  const nazraProgress = child?.nazraProgress || [];
  const completedPages = new Set(
    nazraProgress.map(record => record.page).filter(Boolean),
  ).size;

  async function submitHostelRequest(student) {
    setHostelRequestMessage('');
    setIsSubmittingHostelRequest(true);
    try {
      await createParentHostelRequest(
        student.id,
        user.uid,
        student.hostelStatus === 'resident' ? 'cancellation' : 'admission',
      );
      setHostelRequestMessage(strings.hostelRequestSubmitted);
    } catch (requestError) {
      setHostelRequestMessage(requestError.message);
    } finally {
      setIsSubmittingHostelRequest(false);
    }
  }

  // The chosen child and period below control which reports are displayed.
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              {strings.parentPortal.toUpperCase()}
            </Text>
            <Text style={styles.title}>{strings.monitoringTitle}</Text>
            <Text style={styles.subtitle}>{user.email}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onSignOut}
            style={styles.signOutButton}
            testID="parent-sign-out"
          >
            <Text style={styles.signOutText}>{strings.logOut}</Text>
          </Pressable>
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Text style={styles.sectionTitle}>{strings.hostelRequests}</Text>
        {hostelRequests.length === 0 ? (
          <Text style={styles.emptyText}>{strings.noParentHostelRequests}</Text>
        ) : (
          hostelRequests.map(request => (
            <View key={request.id} style={styles.reportCard}>
              <Text style={styles.reportTitle}>
                {request.studentName} ·{' '}
                {request.requestType === 'cancellation'
                  ? strings.hostelCancellationRequest
                  : strings.hostelAdmissionRequest}
              </Text>
              <Text style={styles.reportDetail}>
                {strings.requestStatus}: {strings[request.status] || request.status}
              </Text>
              {request.allocatedAt ? (
                <Text style={styles.reportDetail}>
                  {strings.allocatedRoomDetails}: {request.roomNumber}, {strings.floor} {request.floor}, {strings.bedNumber} {request.bedNumber}
                </Text>
              ) : null}
              {request.status === 'approved' &&
              request.requestType === 'admission' &&
              !request.allocatedAt ? (
                <Text style={styles.reportDetail}>
                  {strings.hostelApprovalWaitingForRoom}
                </Text>
              ) : null}
            </View>
          ))
        )}
        {hostelRequestMessage ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {hostelRequestMessage}
          </Text>
        ) : null}
        {loading ? (
          <Text style={styles.status}>{strings.loadingReports}</Text>
        ) : children.length === 0 ? (
          <View style={styles.emptyState} testID="parent-no-linked-students">
            <Text style={styles.emptyTitle}>{strings.noLinkedChildren}</Text>
            <Text style={styles.emptyText}>{strings.waitForAdminLink}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{strings.yourChildren}</Text>
            {/* Multiple linked children can be selected without leaving the dashboard. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.childList}
              testID="parent-child-list"
            >
              {children.map(report => {
                const student = report.student;
                const selected = student.id === selectedChildId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={student.id}
                    onPress={() => setSelectedChildId(student.id)}
                    style={[
                      styles.childCard,
                      selected && styles.childCardSelected,
                    ]}
                    testID={`parent-child-${student.id}`}
                  >
                    <Text style={styles.childInitials}>
                      {student.studentName
                        ?.split(/\s+/)
                        .slice(0, 2)
                        .map(part => part[0])
                        .join('')
                        .toUpperCase()}
                    </Text>
                    <Text numberOfLines={1} style={styles.childName}>
                      {student.studentName}
                    </Text>
                    <Text style={styles.childProgram}>
                      {student.className
                        ? `${strings.classLabel} ${student.className}`
                        : strings.student}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {child ? (
              <>
                <View style={styles.hostelRequestPanel}>
                  <Text style={styles.sectionTitle}>{strings.hostelManagement}</Text>
                  <Text style={styles.reportDetail}>
                    {strings.hostelStatus}: {child.student.hostelStatus === 'resident' ? strings.hostelResident : strings.dayStudent}
                  </Text>
                  {requestsByStudent.get(child.student.id)?.allocatedAt ? (
                    <Text style={styles.reportDetail}>
                      {strings.allocatedRoomDetails}:{' '}
                      {requestsByStudent.get(child.student.id).roomNumber},{' '}
                      {strings.floor}{' '}
                      {requestsByStudent.get(child.student.id).floor},{' '}
                      {strings.bedNumber}{' '}
                      {requestsByStudent.get(child.student.id).bedNumber}
                    </Text>
                  ) : null}
                  {requestsByStudent.get(child.student.id)?.status === 'pending' ||
                  (requestsByStudent.get(child.student.id)?.status === 'approved' &&
                    requestsByStudent.get(child.student.id)?.requestType === 'admission' &&
                    !requestsByStudent.get(child.student.id)?.allocatedAt) ? (
                    <Text style={styles.reportDetail}>
                      {strings.hostelRequestInProgress}
                    </Text>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSubmittingHostelRequest}
                      onPress={() => submitHostelRequest(child.student)}
                      style={styles.hostelRequestButton}
                      testID="parent-hostel-request">
                      <Text style={styles.hostelRequestButtonText}>
                        {child.student.hostelStatus === 'resident'
                          ? strings.requestHostelCancellation
                          : strings.requestHostelAdmission}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{strings.attendance}</Text>
                  <Text style={styles.sectionCaption}>
                    {child.student.studentName}
                  </Text>
                </View>
                <View style={styles.periodSelector}>
                  {periods.map(value => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: period === value }}
                      key={value}
                      onPress={() => setPeriod(value)}
                      style={[
                        styles.periodButton,
                        period === value && styles.periodButtonSelected,
                      ]}
                      testID={`parent-attendance-${value}`}
                    >
                      <Text
                        style={[
                          styles.periodText,
                          period === value && styles.periodTextSelected,
                        ]}
                      >
                        {
                          strings[
                            `period${value[0].toUpperCase()}${value.slice(1)}`
                          ]
                        }
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {attendance.length === 0 ? (
                  <Text style={styles.emptyText}>{strings.noAttendance}</Text>
                ) : (
                  attendance.map(record => (
                    <ReportCard
                      key={record.id}
                      title={
                        strings[attendanceStringKeys[record.status]] ||
                        record.status
                      }
                      subtitle={record.date}
                      details={[]}
                    />
                  ))
                )}

                <Text style={styles.sectionTitle}>{strings.hifzProgress}</Text>
                {hifzTypes.map(type => {
                  const records = hifzProgress.filter(
                    record => record.type === type,
                  );
                  return (
                    <View key={type}>
                      <Text style={styles.subsectionTitle}>
                        {
                          strings[
                            `hifz${type[0].toUpperCase()}${type.slice(1)}`
                          ]
                        }
                      </Text>
                      {records.length === 0 ? (
                        <Text style={styles.emptyText}>
                          {strings.noProgress}
                        </Text>
                      ) : (
                        records.map(record => (
                          <ReportCard
                            key={record.id}
                            title={record.surah || strings.hifzRecord}
                            subtitle={record.date}
                            details={[
                              record.ayahRange
                                ? `${strings.ayahs}: ${record.ayahRange}`
                                : '',
                              record.pages
                                ? `${strings.pages}: ${record.pages}`
                                : '',
                              record.grade
                                ? `${strings.grade}: ${record.grade}`
                                : '',
                              record.notes
                                ? `${strings.teacherFeedback}: ${record.notes}`
                                : '',
                            ].filter(Boolean)}
                          />
                        ))
                      )}
                    </View>
                  );
                })}

                <Text style={styles.sectionTitle}>{strings.nazraProgress}</Text>
                <View style={styles.pageSummary}>
                  <Text style={styles.pageCount}>{completedPages}</Text>
                  <Text style={styles.pageLabel}>{strings.pagesCompleted}</Text>
                </View>
                {nazraProgress.length === 0 ? (
                  <Text style={styles.emptyText}>{strings.noProgress}</Text>
                ) : (
                  nazraProgress.map(record => (
                    <ReportCard
                      key={record.id}
                      title={`${strings.page} ${record.page}`}
                      subtitle={record.date}
                      details={[
                        `${strings.completion}: ${record.completion}%`,
                        `${strings.fluency}: ${record.fluency}`,
                        record.remarks
                          ? `${strings.teacherFeedback}: ${record.remarks}`
                          : `${strings.noFeedbackYet}`,
                      ]}
                    />
                  ))
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
