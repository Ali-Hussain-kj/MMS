import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from './styles';

// These are overview cards for modules planned for the management system.
const modules = [
  { title: 'Students', description: 'Admissions and student records' },
  { title: 'Teachers & staff', description: 'Profiles, assignments, and salaries' },
  { title: 'Attendance', description: 'Daily attendance and reports' },
  { title: 'Quran progress', description: 'Sabaq, Sabaqi, Manzil, and Nazra' },
  { title: 'Dars-e-Nizami', description: 'Book-wise learning progress' },
  { title: 'School', description: 'Classes, subjects, and results' },
  { title: 'Hostel', description: 'Rooms, meals, and visitors' },
  { title: 'Fees & donations', description: 'Fees, Zakat, and Sadaqat' },
  { title: 'Reports', description: 'Academic and financial summaries' },
  { title: 'Parent portal', description: 'Progress and attendance updates' },
];

export default function DashboardScreen() {
  // The scroll view keeps the module list usable on smaller phone screens.
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MADARIS MANAGEMENT SYSTEM</Text>
        <Text style={styles.title}>Welcome to MMS</Text>
        <Text style={styles.subtitle}>
          A starting point for managing your madrasa in one place.
        </Text>

        <Text style={styles.sectionTitle}>Modules</Text>
        <View style={styles.grid}>
          {modules.map(module => (
            <View key={module.title} style={styles.card}>
              <Text style={styles.cardTitle}>{module.title}</Text>
              <Text style={styles.cardDescription}>{module.description}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
