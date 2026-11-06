import { StyleSheet } from 'react-native';

// Shared app-shell styles, including the floating language switch button.
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  languageToggle: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE4E0',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 3,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    shadowColor: '#17352B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    width: 44,
    zIndex: 10,
  },
  languageFlag: {
    fontSize: 22,
    lineHeight: 28,
  },
});

export default styles;
