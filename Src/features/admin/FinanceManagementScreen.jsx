import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import getStrings from '../../localization';
import styles from './styles';

const recordTypes = [
  { id: 'fee', labelKey: 'studentFee' },
  { id: 'zakat', labelKey: 'zakat' },
  { id: 'sadaqat', labelKey: 'sadaqat' },
  { id: 'donation', labelKey: 'donation' },
  { id: 'salary', labelKey: 'staffSalary' },
];

const recordTypeLabelKeys = Object.fromEntries(
  recordTypes.map(type => [type.id, type.labelKey]),
);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    type: 'fee',
    amount: '',
    date: today(),
    entityId: '',
    entityName: '',
    category: '',
    period: '',
    notes: '',
  };
}

function Field({ label, value, onChangeText, keyboardType, testID, multiline }) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        onChangeText={onChangeText}
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        testID={testID}
        value={value}
      />
    </>
  );
}

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

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return false;
  }
  return true;
}

export default function FinanceManagementScreen({
  records,
  students,
  teachers,
  language,
  onSave,
  onDelete,
}) {
  const strings = getStrings(language);
  const [form, setForm] = useState(null);
  const [reportMonth, setReportMonth] = useState(today().slice(0, 7));
  const [notice, setNotice] = useState('');
  const filteredRecords = useMemo(
    () => records.filter(record => (record.date || '').startsWith(reportMonth)),
    [records, reportMonth],
  );
  const totals = useMemo(() => {
    const totalFor = types =>
      filteredRecords
        .filter(record => types.includes(record.type))
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);
    return {
      income: totalFor(['fee', 'zakat', 'sadaqat', 'donation']),
      salaries: totalFor(['salary']),
    };
  }, [filteredRecords]);

  function startNewRecord() {
    setForm(emptyForm());
    setNotice('');
  }

  function editRecord(record) {
    setForm({ ...record, amount: String(record.amount) });
    setNotice('');
  }

  function updateField(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
      ...(field === 'type' ? { entityId: '', entityName: '' } : {}),
    }));
    setNotice('');
  }

  function confirmDelete(record) {
    Alert.alert(
      strings.deleteFinancialRecord,
      strings.deleteFinancialRecordPrompt
        .replace('{type}', strings[recordTypeLabelKeys[record.type]])
        .replace('{name}', record.entityName),
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(record.id);
              setNotice(strings.financialRecordDeleted);
            } catch (error) {
              setNotice(
                strings.failedDeleteFinancialRecord.replace(
                  '{error}',
                  error.message,
                ),
              );
            }
          },
        },
      ],
    );
  }

  async function saveRecord() {
    const amount = Number(form.amount);
    if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setNotice(strings.amountMustBePositive);
      return;
    }
    if (!validDate(form.date)) {
      setNotice(strings.invalidFinancialDate);
      return;
    }
    if (form.type === 'fee' && !form.entityId) {
      setNotice(strings.selectStudentForFee);
      return;
    }
    if (form.type === 'salary' && !form.entityId) {
      setNotice(strings.selectTeacherForSalary);
      return;
    }
    if (!['fee', 'salary'].includes(form.type) && !form.entityName.trim()) {
      setNotice(strings.donorNameRequired);
      return;
    }
    if (!form.category.trim()) {
      setNotice(strings.financialCategoryRequired);
      return;
    }

    const now = new Date().toISOString();
    const record = {
      ...form,
      id: form.id || `finance-${Date.now()}`,
      amount,
      entityName: form.entityName.trim(),
      category: form.category.trim(),
      period: form.period.trim(),
      notes: form.notes.trim(),
      createdAt: form.createdAt || now,
      updatedAt: now,
    };
    try {
      await onSave(record);
      setForm(null);
      setNotice(strings.financialRecordSaved);
    } catch (error) {
      setNotice(
        strings.failedSaveFinancialRecord.replace('{error}', error.message),
      );
    }
  }

  const relatedPeople =
    form?.type === 'fee'
      ? students
      : form?.type === 'salary'
        ? teachers
        : [];

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{strings.financialManagement}</Text>
        <ActionButton
          label={strings.addFinancialRecord}
          onPress={startNewRecord}
          testID="finance-add-record"
        />
      </View>
      <Text style={styles.parentAccessHint}>
        {strings.privateFinancialRecords}
      </Text>

      {form ? (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {form.id ? strings.editFinancialRecord : strings.newFinancialRecord}
          </Text>
          <Text style={styles.fieldLabel}>{strings.financialRecordType}</Text>
          <View style={styles.choiceGrid}>
            {recordTypes.map(type => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: form.type === type.id }}
                key={type.id}
                onPress={() => updateField('type', type.id)}
                style={[
                  styles.choice,
                  form.type === type.id && styles.choiceSelected,
                ]}
                testID={`finance-type-${type.id}`}>
                <Text
                  style={[
                    styles.choiceText,
                    form.type === type.id && styles.choiceTextSelected,
                  ]}>
                  {strings[type.labelKey]}
                </Text>
              </Pressable>
            ))}
          </View>

          {relatedPeople.length ? (
            <>
              <Text style={styles.fieldLabel}>
                {form.type === 'fee'
                  ? strings.selectFinancialStudent
                  : strings.selectFinancialTeacher}
              </Text>
              {relatedPeople.map(person => {
                const personName =
                  person.studentName || person.name || person.email || person.id;
                const selected = form.entityId === person.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={person.id}
                    onPress={() =>
                      setForm(current => ({
                        ...current,
                        entityId: person.id,
                        entityName: personName,
                      }))
                    }
                    style={[
                      styles.parentStudentOption,
                      selected && styles.choiceSelected,
                    ]}
                    testID={`finance-person-${person.id}`}>
                    <Text style={styles.parentStudentName}>{personName}</Text>
                  </Pressable>
                );
              })}
            </>
          ) : form.type !== 'fee' && form.type !== 'salary' ? (
            <Field
              label={strings.donorName}
              value={form.entityName}
              onChangeText={value => updateField('entityName', value)}
              testID="finance-entity-name"
            />
          ) : null}
          <Field
            label={strings.amount}
            value={form.amount}
            keyboardType="decimal-pad"
            onChangeText={value => updateField('amount', value)}
            testID="finance-amount"
          />
          <Field
            label={strings.financialDate}
            value={form.date}
            onChangeText={value => updateField('date', value)}
            testID="finance-date"
          />
          <Field
            label={strings.categoryOrPurpose}
            value={form.category}
            onChangeText={value => updateField('category', value)}
            testID="finance-category"
          />
          <Field
            label={strings.periodOptional}
            value={form.period}
            onChangeText={value => updateField('period', value)}
            testID="finance-period"
          />
          <Field
            label={strings.financialNotes}
            value={form.notes}
            onChangeText={value => updateField('notes', value)}
            multiline
            testID="finance-notes"
          />
          <View style={styles.formActions}>
            <ActionButton
              label={
                form.id ? strings.saveFinancialChanges : strings.saveFinancialRecord
              }
              onPress={saveRecord}
              testID="finance-save-record"
            />
            <ActionButton
              label={strings.cancel}
              onPress={() => setForm(null)}
              variant="secondary"
            />
          </View>
        </View>
      ) : null}

      <Text style={styles.fieldLabel}>{strings.financialReportMonth}</Text>
      <TextInput
        autoCapitalize="none"
        maxLength={7}
        onChangeText={setReportMonth}
        style={styles.formInput}
        testID="finance-report-month"
        value={reportMonth}
      />
      {validMonth(reportMonth) ? (
        <View style={styles.metricRow}>
          <Metric label={strings.income} value={totals.income} />
          <Metric label={strings.salaries} value={totals.salaries} />
          <Metric label={strings.balance} value={totals.income - totals.salaries} />
        </View>
      ) : (
        <Text style={styles.notice}>{strings.invalidReportMonth}</Text>
      )}
      <Text style={styles.sectionTitle}>
        {strings.financialRecords} · {filteredRecords.length}
      </Text>
      {filteredRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {strings.noFinancialRecords}
          </Text>
        </View>
      ) : (
        filteredRecords
          .slice()
          .sort((left, right) => (right.date || '').localeCompare(left.date || ''))
          .map(record => (
            <View key={record.id} style={styles.recordCard}>
              <Text style={styles.recordTitle}>
                {strings[recordTypeLabelKeys[record.type]]} · {record.entityName}
              </Text>
              <Text style={styles.recordDetail}>
                {record.date} · {record.category} · {record.amount}
              </Text>
              {record.period ? (
                <Text style={styles.recordDetail}>Period: {record.period}</Text>
              ) : null}
              {record.notes ? (
                <Text style={styles.recordDetail}>{record.notes}</Text>
              ) : null}
              <View style={styles.recordActions}>
                <ActionButton
                  label={strings.editFinancialRecordAction}
                  onPress={() => editRecord(record)}
                  variant="secondary"
                  testID={`finance-edit-${record.id}`}
                />
                <ActionButton
                  label={strings.delete}
                  onPress={() => confirmDelete(record)}
                  variant="danger"
                  testID={`finance-delete-${record.id}`}
                />
              </View>
            </View>
          ))
      )}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </View>
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
