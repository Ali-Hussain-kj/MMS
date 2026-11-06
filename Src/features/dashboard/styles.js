import { StyleSheet } from 'react-native';

// Layout and card styles for the dashboard's module overview.
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8F7',
  },
  content: {
    padding: 20,
  },
  eyebrow: {
    color: '#0B6B4B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 16,
  },
  title: {
    color: '#17352B',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: '#718078',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#17352B',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 30,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE4E0',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 100,
    padding: 16,
    width: '48%',
  },
  cardTitle: {
    color: '#17352B',
    fontSize: 15,
    fontWeight: '700',
  },
  cardDescription: {
    color: '#718078',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});

export default styles;
