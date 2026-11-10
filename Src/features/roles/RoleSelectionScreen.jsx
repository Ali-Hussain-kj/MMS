import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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

const roleTitleKeys = {
  admin: 'roleAdmin',
  teacher: 'roleTeacher',
  parent: 'roleParent',
};

export default function RoleSelectionScreen({
  language,
  authNotice,
  loginRole = 'parent',
  onAuthenticate,
  onRegisterStudent,
  onBack,
  onStaffLogin,
}) {
  const strings = getStrings(language);
  const roleTitle = strings[roleTitleKeys[loginRole]];
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  async function authenticate() {
    if (isAuthenticating || isSendingReset) {
      return;
    }
    setIsAuthenticating(true);
    setMessage('');
    try {
      const session = await signInForRole(email, password, loginRole);
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
      setMessage(strings.passwordResetSent.replace('{email}', email.trim()));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSendingReset(false);
    }
  }

  if (loginRole === 'parent' && isRegistering) {
    return (
      <ParentRegisterScreen
        language={language}
        onRegisterStudent={onRegisterStudent}
        onBackToLogin={() => {
          setIsRegistering(false);
          setMessage('');
        }}
        onBackToRoles={() => {
          setIsRegistering(false);
          setMessage('');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}>
        <ScrollView
          contentContainerStyle={styles.loginContent}
          keyboardShouldPersistTaps="handled">
          {loginRole !== 'parent' ? (
            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              style={styles.backButton}
              testID="back-button">
              <Text style={styles.backButtonText}>{strings.back}</Text>
            </Pressable>
          ) : null}

          <View style={styles.loginBrand}>
            <Image
              accessibilityLabel={strings.appName}
              resizeMode="contain"
              source={require('../../assets/mms-logo.png')}
              style={styles.loginLogo}
              testID="mms-logo"
            />
            <Text style={styles.eyebrow}>{strings.appName.toUpperCase()}</Text>
          </View>
          <Text style={styles.loginTitle}>
            {loginRole === 'parent'
              ? strings.welcomeBack
              : strings.loginTitle.replace('{role}', roleTitle)}
          </Text>
          <Text style={styles.subtitle}>
            {loginRole === 'parent'
              ? strings.parentLoginSubtitle
              : strings.loginSubtitle.replace('{role}', roleTitle)}
          </Text>

          {authNotice ? (
            <Text accessibilityRole="alert" style={styles.message}>
              {authNotice}
            </Text>
          ) : null}

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
              onSubmitEditing={() => {}}
              placeholder="name@example.com"
              returnKeyType="next"
              style={styles.input}
              testID="email-input"
              value={email}
            />

            <Text style={styles.inputLabel}>{strings.password}</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={value => {
                  setPassword(value);
                  setMessage('');
                }}
                onSubmitEditing={authenticate}
                placeholder={strings.enterPassword}
                returnKeyType="go"
                secureTextEntry={!isPasswordVisible}
                style={styles.passwordInput}
                testID="password-input"
                value={password}
              />
              <Pressable
                accessibilityLabel={
                  isPasswordVisible ? strings.hidePassword : strings.showPassword
                }
                accessibilityRole="button"
                onPress={() => setIsPasswordVisible(value => !value)}
                style={styles.passwordVisibilityButton}
                testID="password-visibility">
                <Text style={styles.passwordVisibilityText}>
                  {isPasswordVisible ? strings.hidePassword : strings.showPassword}
                </Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isAuthenticating || isSendingReset || !email.trim() || !password}
              onPress={authenticate}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                (isAuthenticating || isSendingReset) && styles.submitButtonDisabled,
              ]}
              testID="auth-submit">
              {isAuthenticating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{strings.logIn}</Text>
              )}
            </Pressable>

            {loginRole === 'parent' ? (
              <Pressable
                accessibilityRole="button"
                disabled={isAuthenticating || isSendingReset}
                onPress={sendPasswordReset}
                style={styles.passwordResetButton}
                testID="parent-forgot-password">
                <Text style={styles.registerLink}>
                  {isSendingReset
                    ? strings.sendingPasswordReset
                    : strings.forgotPassword}
                </Text>
              </Pressable>
            ) : null}

            {message ? (
              <Text accessibilityRole="alert" style={styles.message}>
                {message}
              </Text>
            ) : null}
          </View>

          <View style={styles.loginFooter}>
            {loginRole === 'parent' ? (
              <>
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
                <Pressable
                  accessibilityRole="button"
                  onPress={onStaffLogin}
                  style={styles.staffLoginLink}
                  testID="staff-login">
                  <Text style={styles.staffLoginText}>
                    {strings.staffLoginPrompt}{' '}
                    <Text style={styles.staffLoginAction}>{strings.staffLogin}</Text>
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
