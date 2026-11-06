import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { programs } from '../students/studentOptions';
import getStrings from '../../localization';
import styles from './styles';

const initialForm = {
  studentName: '',
  fatherName: '',
  dateOfBirth: '',
  address: '',
  gmail: '',
  contactNumber: '',
  password: '',
};

// Collect a child's details so an admin can review the enrollment request.
export default function ParentRegisterScreen({
  language,
  onBackToLogin,
  onBackToRoles,
  onRegisterStudent,
}) {
  const strings = getStrings(language);
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [hostelStatus, setHostelStatus] = useState(null);
  const [form, setForm] = useState(initialForm);

  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setMessage('');
    setIsSubmitted(false);
  }

  // Check required fields and choices before sending the request to the app.
  async function submitRegistration() {
    const requiredFields = Object.entries(form);
    if (requiredFields.some(([, value]) => !value.trim())) {
      setMessage(strings.registrationIncomplete);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.gmail.trim())) {
      setMessage(strings.invalidEmail);
      return;
    }

    if (form.password.length < 6) {
      setMessage(strings.passwordTooShort);
      return;
    }

    if (!selectedProgram || !hostelStatus) {
      setMessage(strings.selectProgramAndHostel);
      return;
    }

    // The school program requires a class; other programs leave that field empty.
    if (
      selectedProgram === 'asri-taleem-class-1-10' &&
      !selectedClass
    ) {
      setMessage(strings.selectClassRange);
      return;
    }

    const { password, ...studentDetails } = form;
    setIsSubmitting(true);
    try {
      // Pass the password only to Firebase account creation, never into the student request.
      await onRegisterStudent(
        {
          ...studentDetails,
          gmail: form.gmail.trim(),
          program: selectedProgram,
          className:
            selectedProgram === 'asri-taleem-class-1-10' ? selectedClass : '',
          hostelStatus,
          status: 'pending',
          submittedAt: new Date().toISOString(),
        },
        { email: form.gmail.trim(), password },
      );
      setIsSubmitted(true);
      setMessage(strings.registrationSubmitted);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputProps = field => ({
    onChangeText: value => updateField(field, value),
    value: form[field],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={onBackToLogin}
          style={styles.backButton}
          testID="back-to-parent-login">
          <Text style={styles.backButtonText}>{strings.backToParentLogin}</Text>
        </Pressable>

        <Text style={styles.eyebrow}>{strings.appName.toUpperCase()}</Text>
        <Text style={styles.title}>{strings.registerStudent}</Text>
        <Text style={styles.subtitle}>
          {strings.enterChildDetails}
        </Text>

        <View style={styles.form}>
          <Text style={styles.inputLabel}>{strings.studentName}</Text>
          <TextInput
            autoCapitalize="words"
            placeholder={strings.enterStudentName}
            style={styles.input}
            testID="student-name-input"
            {...inputProps('studentName')}
          />

          <Text style={styles.inputLabel}>{strings.fatherName}</Text>
          <TextInput
            autoCapitalize="words"
            placeholder={strings.enterFatherName}
            style={styles.input}
            testID="father-name-input"
            {...inputProps('fatherName')}
          />

          <Text style={styles.inputLabel}>{strings.dateOfBirth}</Text>
          <TextInput
            placeholder="DD / MM / YYYY"
            style={styles.input}
            testID="date-of-birth-input"
            {...inputProps('dateOfBirth')}
          />

          <Text style={styles.inputLabel}>{strings.address}</Text>
          <TextInput
            multiline
            placeholder={strings.enterAddress}
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            testID="address-input"
            {...inputProps('address')}
          />

          <Text style={styles.inputLabel}>{strings.email}</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="name@example.com"
            style={styles.input}
            testID="parent-email-input"
            {...inputProps('gmail')}
          />

          <Text style={styles.inputLabel}>{strings.password}</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={value => updateField('password', value)}
            placeholder={strings.createPassword}
            secureTextEntry
            style={styles.input}
            testID="parent-password-input"
            value={form.password}
          />

          <Text style={styles.inputLabel}>{strings.contactNumber}</Text>
          <TextInput
            keyboardType="phone-pad"
            placeholder={strings.enterContactNumber}
            style={styles.input}
            testID="contact-number-input"
            {...inputProps('contactNumber')}
          />

          <Text style={styles.inputLabel}>{strings.programType}</Text>
          <View style={styles.courseOptions}>
            {programs.map(program => {
              const isSelected = selectedProgram === program.id;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={program.id}
                  onPress={() => {
                    setSelectedProgram(program.id);
                    setSelectedClass(null);
                    setMessage('');
                    setIsSubmitted(false);
                  }}
                  style={[
                    styles.courseOption,
                    isSelected && styles.courseOptionSelected,
                  ]}
                  testID={`program-${program.id}`}>
                  <Text
                    style={[
                      styles.courseOptionText,
                      isSelected && styles.courseOptionTextSelected,
                    ]}>
                    {program.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedProgram === 'asri-taleem-class-1-10' && (
            <View testID="asri-class-selection">
              <Text style={styles.inputLabel}>{strings.whichClass}</Text>
              <Text style={styles.fieldHint}>{strings.chooseClassRange}</Text>
              <View style={styles.gradeOptions}>
                {Array.from({ length: 10 }, (_, index) => String(index + 1)).map(
                  grade => {
                    const isSelected = selectedClass === grade;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={grade}
                        onPress={() => {
                          setSelectedClass(grade);
                          setMessage('');
                          setIsSubmitted(false);
                        }}
                        style={[
                          styles.gradeOption,
                          isSelected && styles.courseOptionSelected,
                        ]}
                        testID={`class-${grade}`}>
                        <Text
                          style={[
                            styles.courseOptionText,
                            isSelected && styles.courseOptionTextSelected,
                          ]}>
                          {grade}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </View>
          )}

          <Text style={styles.inputLabel}>{strings.hostelStatus}</Text>
          <View style={styles.hostelOptions}>
            {[
              { id: 'day', label: strings.dayStudent },
              { id: 'resident', label: strings.hostelResident },
            ].map(status => {
              const isSelected = hostelStatus === status.id;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={status.id}
                  onPress={() => {
                    setHostelStatus(status.id);
                    setMessage('');
                    setIsSubmitted(false);
                  }}
                  style={[
                    styles.hostelOption,
                    isSelected && styles.courseOptionSelected,
                  ]}
                  testID={`hostel-${status.id}`}>
                  <Text
                    style={[
                      styles.courseOptionText,
                      isSelected && styles.courseOptionTextSelected,
                    ]}>
                    {status.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitted || isSubmitting}
            onPress={submitRegistration}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
            ]}
            testID="parent-register-submit">
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? strings.creatingParentAccount
                : isSubmitted
                  ? strings.requestSent
                  : strings.registerStudentAction}
            </Text>
          </Pressable>

          {message ? (
            <Text accessibilityRole="alert" style={styles.message}>
              {message}
            </Text>
          ) : null}
        </View>

        <View style={styles.registerFooter}>
          <Text style={styles.footerText}>{strings.alreadyRegistered}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onBackToLogin}
            testID="parent-register-login">
            <Text style={styles.registerLink}>{strings.logIn}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onBackToRoles}
          style={styles.secondaryBackButton}
          testID="parent-register-roles">
          <Text style={styles.secondaryBackButtonText}>{strings.chooseAnotherRole}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
