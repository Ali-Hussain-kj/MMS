import english from './en';
import urdu from './ur';

// Use English as the base dictionary and replace its values with Urdu when selected.
export default function getStrings(language) {
  return language === 'ur' ? { ...english, ...urdu } : english;
}
