import React from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from './styles';

// The flag shows the current language; tapping it calls the app's language switcher.
const languageOptions = {
  en: { flag: '🇬🇧', label: 'English', nextLanguage: 'Urdu' },
  ur: { flag: '🇵🇰', label: 'Urdu', nextLanguage: 'English' },
};

export default function LanguageToggle({ language, onToggle }) {
  const insets = useSafeAreaInsets();
  const selectedLanguage = languageOptions[language] || languageOptions.en;

  return (
    <Pressable
      accessibilityLabel={`${selectedLanguage.label}. Switch language to ${selectedLanguage.nextLanguage}`}
      accessibilityRole="button"
      onPress={onToggle}
      style={[styles.languageToggle, { top: insets.top + 6 }]}
      testID="language-toggle">
      <Text style={styles.languageFlag} testID="language-flag">
        {selectedLanguage.flag}
      </Text>
    </Pressable>
  );
}
