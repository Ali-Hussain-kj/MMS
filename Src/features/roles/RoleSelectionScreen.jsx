import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ParentRegisterScreen from './ParentRegisterScreen';
import getStrings from '../../localization';
import {
  sendParentPasswordReset,
  signInForRole,
} from '../../services/firebase/parentMonitoring';
import styles from './styles';

export default function RoleSelectionScreen({
  language,
  onAuthenticate,
  onRegisterStudent,
}) {
  const strings = getStrings(language);
  // Role IDs stay language-independent even when the visible titles are translated.
  const roles = [
    {
      id: 'admin',
      title: strings.roleAdmin,
      description: strings.roleAdminDescription,
    },
    {
      id: 'teacher',
      title: strings.roleTeacher,
      description: strings.roleTeacherDescription,
    },
    {
      id: 'parent',
      title: strings.roleParent,
      description: strings.roleParentDescription,
    },
  ];
  const [selectedRole, setSelectedRole] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const activeRole = roles.find(role => role.id === selectedRole?.id);

  // Sign-in checks both the Firebase account and its role in the users collection.
  async function authenticate() {
    setIsAuthenticating(true);
    setMessage('');
    try {
      const session = await signInForRole(email, password, activeRole.id);
      onAuthenticate(session);
    } catch (error) {
      setMessage(
        error.code === 'auth/email-not-verified'
          ? strings.verificationEmailSent.replace(
              '{email}',
              error.email || email.trim(),
            )
          : error.message,
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function sendPasswordReset() {
    setMessage('');
    if (!email.trim()) {
      setMessage(strings.passwordResetNeedEmail);
      return;
    }

    setIsSendingReset(true);
    try {
      await sendParentPasswordReset(email);
      setMessage(
        strings.passwordResetSent.replace('{email}', email.trim()),
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSendingReset(false);
    }
  }

  // Enrollment collects the parent's login credentials together with student details.
  if (selectedRole?.id === 'parent' && isRegistering) {
    return (
      <ParentRegisterScreen
        language={language}
        onRegisterStudent={onRegisterStudent}
        onBackToLogin={() => {
          setIsRegistering(false);
          setMessage('');
        }}
        onBackToRoles={() => {
          setSelectedRole(null);
          setIsRegistering(false);
          setMessage('');
        }}
      />
    );
  }

  // After choosing a role, show its login form and any role-specific actions.
  if (selectedRole) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSelectedRole(null);
              setIsRegistering(false);
              setMessage('');
            }}
            style={styles.backButton}
            testID="back-button">
            <Text style={styles.backButtonText}>{strings.back}</Text>
          </Pressable>

          <Text style={styles.eyebrow}>{strings.appName.toUpperCase()}</Text>
          <Text style={styles.title}>
            {strings.loginTitle.replace('{role}', activeRole.title)}
          </Text>
          <Text style={styles.subtitle}>
            {strings.loginSubtitle.replace('{role}', activeRole.title)}
          </Text>

          <View style={styles.form}>
            <Text style={styles.inputLabel}>{strings.email}</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={value => {
                setEmail(value);
                setMessage('');
              }}
              placeholder="name@example.com"
              style={styles.input}
              testID="email-input"
              value={email}
            />

            <Text style={styles.inputLabel}>{strings.password}</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={value => {
                setPassword(value);
                setMessage('');
              }}
              placeholder={strings.enterPassword}
              secureTextEntry
              style={styles.input}
              testID="password-input"
              value={password}
            />

            <Pressable
              accessibilityRole="button"
              disabled={isAuthenticating || isSendingReset}
              onPress={authenticate}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
              ]}
              testID="auth-submit">
              <Text style={styles.submitButtonText}>
                {strings.logIn}
              </Text>
            </Pressable>

            {activeRole.id === 'parent' ? (
              <Pressable
                accessibilityRole="button"
                disabled={isAuthenticating || isSendingReset}
                onPress={sendPasswordReset}
                style={styles.passwordResetButton}
                testID="parent-forgot-password">
                <Text style={styles.registerLink}>
                  {isSendingReset ? strings.sendingPasswordReset : strings.forgotPassword}
                </Text>
              </Pressable>
            ) : null}

            {message ? (
              <Text accessibilityRole="alert" style={styles.message}>
                {message}
              </Text>
            ) : null}

          </View>

          {activeRole.id === 'parent' && (
            <View style={styles.registerFooter}>
              <Text style={styles.footerText}>{strings.enrollPrompt}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsRegistering(true);
                  setMessage('');
                }}
                testID="parent-register">
                <Text style={styles.registerLink}>{strings.registerStudent}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{strings.appName.toUpperCase()}</Text>
        <Text style={styles.title}>{strings.welcome}</Text>
        <Text style={styles.subtitle}>{strings.chooseRole}</Text>

        <View style={styles.roleList}>
          {roles.map(role => (
            <Pressable
              accessibilityRole="button"
              key={role.id}
              onPress={() => setSelectedRole(role)}
              style={({ pressed }) => [
                styles.roleCard,
                pressed && styles.roleCardPressed,
              ]}
              testID={`role-${role.id}`}>
              <View style={styles.roleCardText}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleDescription}>{role.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
