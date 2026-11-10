import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import getStrings from '../../localization';
import styles from './styles';

const staffRoles = [
  {
    id: 'admin',
    icon: '🛡️',
    titleKey: 'roleAdmin',
    descriptionKey: 'staffAdminDescription',
  },
  {
    id: 'teacher',
    icon: '🎓',
    titleKey: 'roleTeacher',
    descriptionKey: 'staffTeacherDescription',
  },
];

export default function StaffRoleSelectionScreen({
  language,
  onSelectRole,
  onBack,
}) {
  const strings = getStrings(language);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.staffSelectionContent}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
          testID="staff-role-back">
          <Text style={styles.backButtonText}>{strings.back}</Text>
        </Pressable>
        <Image
          accessibilityLabel={strings.appName}
          resizeMode="contain"
          source={require('../../assets/mms-logo.png')}
          style={styles.staffLogo}
        />
        <Text style={styles.staffTitle}>{strings.staffWelcome}</Text>
        <Text style={styles.subtitle}>{strings.staffRoleSubtitle}</Text>
        <View style={styles.staffRoleList}>
          {staffRoles.map(role => (
            <Pressable
              accessibilityRole="button"
              key={role.id}
              onPress={() => onSelectRole(role.id)}
              style={({ pressed }) => [
                styles.staffRoleCard,
                pressed && styles.roleCardPressed,
              ]}
              testID={`staff-role-${role.id}`}>
              <View style={styles.staffRoleIcon}>
                <Text style={styles.staffRoleIconText}>{role.icon}</Text>
              </View>
              <View style={styles.roleCardText}>
                <Text style={styles.roleTitle}>{strings[role.titleKey]}</Text>
                <Text style={styles.roleDescription}>
                  {strings[role.descriptionKey]}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
