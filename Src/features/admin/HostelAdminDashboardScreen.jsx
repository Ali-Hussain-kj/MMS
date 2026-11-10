import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import getStrings from '../../localization';
import HostelManagementScreen from './HostelManagementScreen';
import styles from './styles';

export default function HostelAdminDashboardScreen({
  language,
  onSignOut,
  students,
  rooms,
  registrations,
  requests,
  attendance,
  meals,
  visitors,
  backendNotice,
  onCreateRoom,
  onAllocateRoom,
  onReviewRequest,
  onAllocateRequest,
  onSaveAttendance,
  onSaveMeals,
  onRecordVisitor,
}) {
  const strings = getStrings(language);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>{strings.hostelAdminSpace.toUpperCase()}</Text>
            <Text style={styles.title}>{strings.hostelAdminDashboard}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onSignOut}
            style={styles.signOutButton}
            testID="hostel-admin-sign-out">
            <Text style={styles.signOutText}>{strings.logOut}</Text>
          </Pressable>
        </View>
        {backendNotice ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {backendNotice}
          </Text>
        ) : null}
        <Text style={styles.hostelHint}>
          {strings.hostelPendingCount.replace(
            '{count}',
            String(requests.filter(request => request.status === 'pending').length),
          )}
        </Text>
        <HostelManagementScreen
          language={language}
          students={students}
          rooms={rooms}
          registrations={registrations}
          requests={requests}
          attendance={attendance}
          meals={meals}
          visitors={visitors}
          onCreateRoom={onCreateRoom}
          onAllocateRoom={onAllocateRoom}
          onReviewRequest={onReviewRequest}
          onAllocateRequest={onAllocateRequest}
          onSaveAttendance={onSaveAttendance}
          onSaveMeals={onSaveMeals}
          onRecordVisitor={onRecordVisitor}
          isHostelAdmin
        />
      </ScrollView>
    </SafeAreaView>
  );
}
