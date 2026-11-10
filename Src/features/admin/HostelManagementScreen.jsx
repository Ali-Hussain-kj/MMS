import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import getStrings from '../../localization';
import styles from './styles';

const sections = [
  'registration',
  'requests',
  'rooms',
  'attendance',
  'meals',
  'visitors',
];

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentVisitTime() {
  const date = new Date();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${today()} ${hour}:${minute}`;
}

function Field({
  label,
  value,
  onChangeText,
  testID,
  keyboardType,
  autoCapitalize = 'sentences',
}) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType || 'default'}
        onChangeText={onChangeText}
        placeholder={label}
        style={styles.formInput}
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
  selected = false,
  secondary = false,
  disabled = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected ? { selected: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        secondary && styles.secondaryAction,
        selected && styles.hostelChoiceSelected,
      ]}
      testID={testID}>
      <Text
        style={[
          styles.actionButtonText,
          secondary && styles.secondaryActionText,
          selected && styles.hostelChoiceTextSelected,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RecordCard({ title, details }) {
  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>{title}</Text>
      {details.map(detail => (
        <Text key={detail} style={styles.recordDetail}>
          {detail}
        </Text>
      ))}
    </View>
  );
}

export default function HostelManagementScreen({
  language,
  students,
  rooms,
  registrations,
  requests = [],
  attendance,
  meals,
  visitors,
  onCreateRoom,
  onAllocateRoom,
  onReviewRequest,
  onAllocateRequest,
  onSaveAttendance,
  onSaveMeals,
  onRecordVisitor,
  isHostelAdmin = false,
}) {
  const strings = getStrings(language);
  const [activeSection, setActiveSection] = useState(
    isHostelAdmin ? 'requests' : 'registration',
  );
  const visibleSections = isHostelAdmin
    ? sections.filter(section => section !== 'registration')
    : sections;
  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    floor: '',
    bedCount: '',
  });
  const [registrationForm, setRegistrationForm] = useState({
    studentId: '',
    roomId: '',
    bedNumber: '',
    admissionDate: today(),
  });
  const [mealForm, setMealForm] = useState({
    studentId: '',
    date: today(),
    breakfast: false,
    lunch: false,
    dinner: false,
  });
  const [attendanceForm, setAttendanceForm] = useState({
    studentId: '',
    date: today(),
    status: 'present',
  });
  const [visitorForm, setVisitorForm] = useState({
    studentId: '',
    visitorName: '',
    relation: '',
    visitTime: currentVisitTime(),
  });
  const [allocationForms, setAllocationForms] = useState({});
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const registrationsById = useMemo(
    () => new Map(registrations.map(item => [item.studentId, item])),
    [registrations],
  );
  const roomById = useMemo(
    () => new Map(rooms.map(room => [room.id, room])),
    [rooms],
  );
  const studentsById = useMemo(
    () => new Map(students.map(student => [student.id, student])),
    [students],
  );

  function getRoomOccupancy(room) {
    return Object.keys(room.allocations || {}).length;
  }

  async function submit(action, successMessage, reset) {
    setNotice('');
    setIsSaving(true);
    try {
      await action();
      reset();
      setNotice(successMessage);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  function updateField(setForm, field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setNotice('');
  }

  function renderRoomForm() {
    return (
      <>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{strings.createRoom}</Text>
          <Field
            label={strings.roomNumber}
            value={roomForm.roomNumber}
            onChangeText={value => updateField(setRoomForm, 'roomNumber', value)}
            testID="hostel-room-number"
          />
          <Field
            label={strings.floor}
            value={roomForm.floor}
            onChangeText={value => updateField(setRoomForm, 'floor', value)}
            testID="hostel-room-floor"
          />
          <Field
            label={strings.bedCount}
            keyboardType="number-pad"
            value={roomForm.bedCount}
            onChangeText={value => updateField(setRoomForm, 'bedCount', value)}
            testID="hostel-room-bed-count"
          />
          <Button
            label={strings.createRoom}
            disabled={isSaving}
            onPress={() =>
              submit(
                () => onCreateRoom(roomForm),
                strings.roomCreated,
                () => setRoomForm({ roomNumber: '', floor: '', bedCount: '' }),
              )
            }
            testID="hostel-create-room"
          />
        </View>
        <Text style={styles.sectionTitle}>{strings.existingRooms}</Text>
        {rooms.length === 0 ? (
          <Text style={styles.hostelEmpty}>{strings.noRooms}</Text>
        ) : (
          rooms.map(room => (
            <RecordCard
              key={room.id}
              title={`${strings.roomNumber} ${room.roomNumber}`}
              details={[
                `${strings.floor}: ${room.floor}`,
                `${strings.occupancy}: ${getRoomOccupancy(room)} / ${room.bedCount}`,
              ]}
            />
          ))
        )}
      </>
    );
  }

  function renderRegistration() {
    const selectedStudent = students.find(
      student =>
        student.id === registrationForm.studentId.trim() &&
        student.hostelStatus === 'resident',
    );
    const selectedRoom = roomById.get(registrationForm.roomId);
    return (
      <>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{strings.hostelRegistration}</Text>
          <Field
            label={strings.studentId}
            value={registrationForm.studentId}
            onChangeText={value => updateField(setRegistrationForm, 'studentId', value)}
            autoCapitalize="none"
            testID="hostel-student-id"
          />
          {selectedStudent ? (
            <Text style={styles.hostelHint}>
              {strings.student}: {selectedStudent.studentName}
            </Text>
          ) : null}
          <Text style={styles.fieldLabel}>{strings.room}</Text>
          {rooms.length === 0 ? (
            <Text style={styles.hostelEmpty}>{strings.createRoomFirst}</Text>
          ) : (
            <View style={styles.hostelChoiceRow}>
              {rooms.map(room => {
                const occupied = getRoomOccupancy(room);
                const isFull = occupied >= room.bedCount;
                return (
                  <Button
                    key={room.id}
                    label={`${room.roomNumber} · ${strings.floor} ${room.floor} (${occupied}/${room.bedCount})`}
                    onPress={() =>
                      !isFull &&
                      updateField(setRegistrationForm, 'roomId', room.id)
                    }
                    selected={registrationForm.roomId === room.id}
                    secondary
                    disabled={isFull}
                    testID={`hostel-select-room-${room.id}`}
                  />
                );
              })}
            </View>
          )}
          {selectedRoom ? (
            <Field
              label={`${strings.bedNumber} (1–${selectedRoom.bedCount})`}
              keyboardType="number-pad"
              value={registrationForm.bedNumber}
              onChangeText={value =>
                updateField(setRegistrationForm, 'bedNumber', value)
              }
              testID="hostel-bed-number"
            />
          ) : null}
          <Field
            label={`${strings.admissionDate} (YYYY-MM-DD)`}
            value={registrationForm.admissionDate}
            onChangeText={value =>
              updateField(setRegistrationForm, 'admissionDate', value)
            }
            testID="hostel-admission-date"
          />
          <Button
            label={strings.allocateRoom}
            disabled={isSaving}
            onPress={() => {
              if (!selectedStudent) {
                setNotice(strings.hostelResidentRequired);
                return;
              }
              const room = roomById.get(registrationForm.roomId);
              if (!room) {
                setNotice(strings.selectRoom);
                return;
              }
              if (registrationsById.has(selectedStudent.id)) {
                setNotice(strings.studentAlreadyAllocated);
                return;
              }
              submit(
                () =>
                  onAllocateRoom({
                    ...registrationForm,
                    studentId: selectedStudent.id,
                    studentName: selectedStudent.studentName,
                  }),
                strings.roomAllocated,
                () =>
                  setRegistrationForm({
                    studentId: '',
                    roomId: '',
                    bedNumber: '',
                    admissionDate: today(),
                  }),
              );
            }}
            testID="hostel-allocate-room"
          />
        </View>
        <Text style={styles.sectionTitle}>{strings.hostelResidents}</Text>
        {registrations.length === 0 ? (
          <Text style={styles.hostelEmpty}>{strings.noHostelResidents}</Text>
        ) : (
          registrations.map(registration => (
            <RecordCard
              key={registration.id}
              title={registration.studentName}
              details={[
                `${strings.studentId}: ${registration.studentId}`,
                `${strings.roomNumber} ${registration.roomNumber} · ${strings.floor} ${registration.floor} · ${strings.bedNumber} ${registration.bedNumber}`,
                `${strings.admissionDate}: ${registration.admissionDate}`,
              ]}
            />
          ))
        )}
      </>
    );
  }

  function renderRequests() {
    if (requests.length === 0) {
      return (
        <Text style={styles.hostelEmpty}>{strings.noHostelRequests}</Text>
      );
    }

    return requests.map(request => {
      const requestForm = allocationForms[request.id] || {
        roomId: '',
        bedNumber: '',
      };
      const requestTypeLabel =
        request.requestType === 'cancellation'
          ? strings.hostelCancellationRequest
          : strings.hostelAdmissionRequest;
      const studentRecord = studentsById.get(request.studentId);
      const canAllocate =
        request.requestType === 'admission' &&
        request.status === 'approved' &&
        !request.allocatedAt;
      const selectedRoom = roomById.get(requestForm.roomId);

      return (
        <View key={request.id} style={styles.recordCard}>
          <Text style={styles.recordTitle}>{request.studentName}</Text>
          <Text style={styles.recordSubtitle}>
            {requestTypeLabel} · {strings.requestStatus}: {strings[request.status] || request.status}
          </Text>
          <Text style={styles.recordDetail}>
            {strings.studentId}: {request.studentId}
          </Text>
          <Text style={styles.recordDetail}>
            {strings.classLabel}: {request.className || strings.notAvailable}
          </Text>
          <Text style={styles.recordDetail}>
            {strings.programType}: {request.program || strings.notAvailable}
          </Text>
          <Text style={styles.recordDetail}>
            {strings.fatherName}: {request.fatherName || strings.notAvailable}
          </Text>
          <Text style={styles.recordDetail}>
            {strings.parentEmail}: {request.parentEmail || strings.notAvailable}
          </Text>
          <Text style={styles.recordDetail}>
            {strings.contactNumber}: {request.contactNumber || strings.notAvailable}
          </Text>
          {request.status === 'pending' ? (
            <View style={styles.recordActions}>
              <Button
                label={strings.approveRequest}
                disabled={isSaving}
                onPress={() =>
                  submit(
                    () => onReviewRequest(request.id, 'approve'),
                    strings.hostelRequestApproved,
                    () => {},
                  )
                }
                testID={`hostel-request-approve-${request.id}`}
              />
              <Button
                label={strings.rejectRequest}
                disabled={isSaving}
                onPress={() =>
                  submit(
                    () => onReviewRequest(request.id, 'reject'),
                    strings.hostelRequestRejected,
                    () => {},
                  )
                }
                secondary
                testID={`hostel-request-reject-${request.id}`}
              />
            </View>
          ) : null}
          {canAllocate ? (
            <>
              {!studentRecord ? (
                <Text style={styles.hostelHint}>
                  {strings.waitingForStudentApproval}
                </Text>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{strings.room}</Text>
                  <View style={styles.hostelChoiceRow}>
                    {rooms.map(room => {
                      const occupied = getRoomOccupancy(room);
                      const isFull = occupied >= room.bedCount;
                      return (
                        <Button
                          key={room.id}
                          label={`${room.roomNumber} · ${strings.floor} ${room.floor} (${occupied}/${room.bedCount})`}
                          disabled={isFull}
                          onPress={() =>
                            setAllocationForms(current => ({
                              ...current,
                              [request.id]: {
                                ...requestForm,
                                roomId: room.id,
                              },
                            }))
                          }
                          selected={requestForm.roomId === room.id}
                          secondary
                          testID={`hostel-request-room-${request.id}-${room.id}`}
                        />
                      );
                    })}
                  </View>
                  {selectedRoom ? (
                    <Field
                      label={`${strings.bedNumber} (1–${selectedRoom.bedCount})`}
                      keyboardType="number-pad"
                      value={requestForm.bedNumber}
                      onChangeText={value =>
                        setAllocationForms(current => ({
                          ...current,
                          [request.id]: { ...requestForm, bedNumber: value },
                        }))
                      }
                      testID={`hostel-request-bed-${request.id}`}
                    />
                  ) : null}
                  <Button
                    label={strings.allocateRoom}
                    disabled={isSaving}
                    onPress={() => {
                      if (!selectedRoom) {
                        setNotice(strings.selectRoom);
                        return;
                      }
                      submit(
                        () =>
                          onAllocateRequest(request.id, {
                            roomId: requestForm.roomId,
                            bedNumber: requestForm.bedNumber,
                          }),
                        strings.roomAllocated,
                        () => {},
                      );
                    }}
                    testID={`hostel-request-allocate-${request.id}`}
                  />
                </>
              )}
            </>
          ) : null}
          {request.allocatedAt ? (
            <Text style={styles.hostelHint}>
              {strings.allocatedRoomDetails}: {request.roomNumber}, {strings.floor} {request.floor}, {strings.bedNumber} {request.bedNumber}
            </Text>
          ) : null}
        </View>
      );
    });
  }

  function renderMeals() {
    return (
      <>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{strings.mealTracking}</Text>
          <Field
            label={strings.studentId}
            value={mealForm.studentId}
            onChangeText={value => updateField(setMealForm, 'studentId', value)}
            autoCapitalize="none"
            testID="hostel-meal-student-id"
          />
          <Field
            label={`${strings.date} (YYYY-MM-DD)`}
            value={mealForm.date}
            onChangeText={value => updateField(setMealForm, 'date', value)}
            testID="hostel-meal-date"
          />
          <View style={styles.hostelChoiceRow}>
            {['breakfast', 'lunch', 'dinner'].map(meal => (
              <Button
                key={meal}
                label={strings[meal]}
                onPress={() =>
                  updateField(setMealForm, meal, !mealForm[meal])
                }
                selected={mealForm[meal]}
                secondary
                testID={`hostel-meal-${meal}`}
              />
            ))}
          </View>
          <Button
            label={strings.saveMeals}
            disabled={isSaving}
            onPress={() =>
              submit(
                () =>
                  onSaveMeals({
                    ...mealForm,
                    studentName:
                      registrationsById.get(mealForm.studentId.trim())
                        ?.studentName || '',
                  }),
                strings.mealsSaved,
                () =>
                  setMealForm({
                    studentId: '',
                    date: today(),
                    breakfast: false,
                    lunch: false,
                    dinner: false,
                  }),
              )
            }
            testID="hostel-save-meals"
          />
        </View>
        <Text style={styles.sectionTitle}>{strings.mealHistory}</Text>
        {meals.length === 0 ? (
          <Text style={styles.hostelEmpty}>{strings.noMealRecords}</Text>
        ) : (
          meals.map(record => (
            <RecordCard
              key={record.id}
              title={`${record.studentName} · ${record.date}`}
              details={[
                `${strings.breakfast}: ${record.breakfast ? strings.recorded : strings.notRecorded}`,
                `${strings.lunch}: ${record.lunch ? strings.recorded : strings.notRecorded}`,
                `${strings.dinner}: ${record.dinner ? strings.recorded : strings.notRecorded}`,
              ]}
            />
          ))
        )}
      </>
    );
  }

  function renderAttendance() {
    return (
      <>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{strings.hostelAttendance}</Text>
          <Field
            label={strings.studentId}
            value={attendanceForm.studentId}
            onChangeText={value =>
              updateField(setAttendanceForm, 'studentId', value)
            }
            autoCapitalize="none"
            testID="hostel-attendance-student-id"
          />
          <Field
            label={`${strings.date} (YYYY-MM-DD)`}
            value={attendanceForm.date}
            onChangeText={value => updateField(setAttendanceForm, 'date', value)}
            testID="hostel-attendance-date"
          />
          <View style={styles.hostelChoiceRow}>
            {['present', 'absent', 'leave'].map(status => (
              <Button
                key={status}
                label={strings[`attendance${status[0].toUpperCase()}${status.slice(1)}`]}
                onPress={() => updateField(setAttendanceForm, 'status', status)}
                selected={attendanceForm.status === status}
                secondary
                testID={`hostel-attendance-status-${status}`}
              />
            ))}
          </View>
          <Button
            label={strings.saveAttendance}
            disabled={isSaving}
            onPress={() =>
              submit(
                () =>
                  onSaveAttendance({
                    ...attendanceForm,
                    studentName:
                      registrationsById.get(attendanceForm.studentId.trim())
                        ?.studentName || '',
                  }),
                strings.attendanceSaved,
                () =>
                  setAttendanceForm({
                    studentId: '',
                    date: today(),
                    status: 'present',
                  }),
              )
            }
            testID="hostel-save-attendance"
          />
        </View>
        <Text style={styles.sectionTitle}>{strings.hostelAttendanceHistory}</Text>
        {attendance.length === 0 ? (
          <Text style={styles.hostelEmpty}>{strings.noHostelAttendance}</Text>
        ) : (
          attendance.map(record => (
            <RecordCard
              key={record.id}
              title={`${record.studentName} · ${record.date}`}
              details={[
                `${strings.studentId}: ${record.studentId}`,
                `${strings.attendanceStatus}: ${strings[`attendance${record.status[0].toUpperCase()}${record.status.slice(1)}`]}`,
              ]}
            />
          ))
        )}
      </>
    );
  }

  function renderVisitors() {
    return (
      <>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{strings.recordVisitor}</Text>
          <Field
            label={strings.studentId}
            value={visitorForm.studentId}
            onChangeText={value => updateField(setVisitorForm, 'studentId', value)}
            autoCapitalize="none"
            testID="hostel-visitor-student-id"
          />
          <Field
            label={strings.visitorName}
            value={visitorForm.visitorName}
            onChangeText={value => updateField(setVisitorForm, 'visitorName', value)}
            testID="hostel-visitor-name"
          />
          <Field
            label={strings.relation}
            value={visitorForm.relation}
            onChangeText={value => updateField(setVisitorForm, 'relation', value)}
            testID="hostel-visitor-relation"
          />
          <Field
            label={`${strings.visitTime} (YYYY-MM-DD HH:mm)`}
            value={visitorForm.visitTime}
            onChangeText={value => updateField(setVisitorForm, 'visitTime', value)}
            testID="hostel-visitor-time"
          />
          <Button
            label={strings.saveVisitor}
            disabled={isSaving}
            onPress={() =>
              submit(
                () => onRecordVisitor(visitorForm),
                strings.visitorSaved,
                () =>
                  setVisitorForm({
                    studentId: '',
                    visitorName: '',
                    relation: '',
                    visitTime: currentVisitTime(),
                  }),
              )
            }
            testID="hostel-save-visitor"
          />
        </View>
        <Text style={styles.sectionTitle}>{strings.visitorHistory}</Text>
        {visitors.length === 0 ? (
          <Text style={styles.hostelEmpty}>{strings.noVisitorRecords}</Text>
        ) : (
          [...visitors]
            .sort((left, right) => right.visitTime.localeCompare(left.visitTime))
            .map(visitor => (
              <RecordCard
                key={visitor.id}
                title={visitor.visitorName}
                details={[
                  `${strings.student}: ${visitor.studentName} (${visitor.studentId})`,
                  `${strings.relation}: ${visitor.relation}`,
                  `${strings.visitTime}: ${visitor.visitTime}`,
                ]}
              />
            ))
        )}
      </>
    );
  }

  const content = {
    registration: renderRegistration,
    requests: renderRequests,
    rooms: renderRoomForm,
    attendance: renderAttendance,
    meals: renderMeals,
    visitors: renderVisitors,
  }[activeSection];

  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.hostelManagement}</Text>
      <View style={styles.hostelTabs}>
        {visibleSections.map(section => (
          <Button
            key={section}
            label={strings[`hostelTab${section[0].toUpperCase()}${section.slice(1)}`]}
            onPress={() => {
              setActiveSection(section);
              setNotice('');
            }}
            selected={activeSection === section}
            secondary
            testID={`hostel-tab-${section}`}
          />
        ))}
      </View>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {isSaving ? (
        <Text style={styles.hostelHint}>{strings.saving}</Text>
      ) : null}
      {content()}
    </View>
  );
}
