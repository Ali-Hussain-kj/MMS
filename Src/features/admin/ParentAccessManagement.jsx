import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import getStrings from '../../localization';
import {
  findParentAccounts,
  linkStudentsToParent,
} from '../../services/firebase/parentMonitoring';
import styles from './styles';

export default function ParentAccessManagement({ language, students }) {
  const strings = getStrings(language);
  const [email, setEmail] = useState('');
  const [parent, setParent] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Find an existing, verified parent account before showing student link options.
  async function findParent() {
    setBusy(true);
    setNotice('');
    setParent(null);
    try {
      const matches = await findParentAccounts(email);
      if (matches.length !== 1) {
        setNotice(
          matches.length === 0
            ? strings.parentAccountNotFound
            : strings.parentAccountAmbiguous,
        );
        return;
      }
      const matchedParent = matches[0];
      setParent(matchedParent);
      setSelectedStudentIds(
        Array.isArray(matchedParent.studentIds) ? matchedParent.studentIds : [],
      );
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleStudent(studentId) {
    // Add or remove one student ID while preserving the other selected children.
    setSelectedStudentIds(current =>
      current.includes(studentId)
        ? current.filter(id => id !== studentId)
        : [...current, studentId],
    );
  }

  // Save the selected student document IDs to the parent's access list.
  async function saveLinks() {
    setBusy(true);
    setNotice('');
    try {
      await linkStudentsToParent(parent.id, selectedStudentIds);
      setParent(current => ({ ...current, studentIds: selectedStudentIds }));
      setNotice(strings.parentLinksSaved);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      {/* Only show link controls after the email lookup identifies one parent account. */}
      <Text style={styles.sectionTitle}>{strings.parentAccess}</Text>
      <Text style={styles.parentAccessHint}>
        {strings.parentAccessDescription}
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={value => {
          setEmail(value);
          setParent(null);
          setSelectedStudentIds([]);
          setNotice('');
        }}
        placeholder={strings.parentEmail}
        style={styles.searchInput}
        testID="parent-account-email"
        value={email}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy || !email.trim()}
        onPress={findParent}
        style={[
          styles.parentAccessButton,
          busy && styles.parentAccessButtonDisabled,
        ]}
        testID="find-parent-account"
      >
        <Text style={styles.parentAccessButtonText}>
          {strings.findParentAccount}
        </Text>
      </Pressable>
      {parent ? (
        <View style={styles.parentAccessCard}>
          <Text style={styles.parentAccessEmail}>{parent.email}</Text>
          <Text style={styles.parentAccessHint}>
            {strings.selectChildrenForParent}
          </Text>
          {students.length === 0 ? (
            <Text style={styles.parentAccessHint}>
              {strings.noStudentsToLink}
            </Text>
          ) : (
            students.map(student => {
              const selected = selectedStudentIds.includes(student.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={student.id}
                  onPress={() => toggleStudent(student.id)}
                  style={styles.parentStudentOption}
                  testID={`parent-link-student-${student.id}`}
                >
                  <Text style={styles.parentStudentCheck}>
                    {selected ? '✓' : '○'}
                  </Text>
                  <Text style={styles.parentStudentName}>
                    {student.studentName}
                  </Text>
                </Pressable>
              );
            })
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={saveLinks}
            style={[
              styles.parentAccessButton,
              busy && styles.parentAccessButtonDisabled,
            ]}
            testID="save-parent-student-links"
          >
            <Text style={styles.parentAccessButtonText}>
              {strings.saveParentLinks}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {notice ? (
        <Text
          accessibilityRole={
            notice === strings.parentLinksSaved ? 'text' : 'alert'
          }
          style={styles.parentAccessNotice}
        >
          {notice}
        </Text>
      ) : null}
    </View>
  );
}
