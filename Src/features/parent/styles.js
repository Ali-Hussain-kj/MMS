import { StyleSheet } from 'react-native';

// Visual styles for the parent dashboard and its child/report cards.
const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F4F8F5',
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 34,
    marginBottom: 22,
  },
  headerText: {
    flex: 1,
    paddingRight: 10,
  },
  eyebrow: {
    color: '#0B6B4B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#17352B',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 5,
  },
  subtitle: {
    color: '#718078',
    fontSize: 12,
    marginTop: 4,
  },
  signOutButton: {
    backgroundColor: '#E3F2EC',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  signOutText: {
    color: '#0B6B4B',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  sectionTitle: {
    color: '#17352B',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 22,
  },
  sectionCaption: {
    color: '#718078',
    fontSize: 11,
  },
  childList: {
    paddingTop: 10,
  },
  childCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE4E0',
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    padding: 12,
    width: 132,
  },
  childCardSelected: {
    borderColor: '#0B6B4B',
    backgroundColor: '#E3F2EC',
  },
  childInitials: {
    alignItems: 'center',
    backgroundColor: '#D8EEE4',
    borderRadius: 24,
    color: '#0B6B4B',
    fontSize: 14,
    fontWeight: '800',
    overflow: 'hidden',
    padding: 13,
  },
  childName: {
    color: '#17352B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  childProgram: {
    color: '#718078',
    fontSize: 10,
    marginTop: 3,
  },
  periodSelector: {
    backgroundColor: '#E8EFEB',
    borderRadius: 10,
    flexDirection: 'row',
    marginTop: 10,
    padding: 4,
  },
  periodButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  periodButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  periodText: {
    color: '#718078',
    fontSize: 12,
    fontWeight: '700',
  },
  periodTextSelected: {
    color: '#0B6B4B',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E9E3',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 9,
    padding: 13,
  },
  reportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportTitle: {
    color: '#17352B',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  reportDate: {
    color: '#718078',
    fontSize: 10,
  },
  reportDetail: {
    color: '#53655B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  subsectionTitle: {
    color: '#0B6B4B',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
  },
  pageSummary: {
    alignItems: 'center',
    backgroundColor: '#E3F2EC',
    borderRadius: 12,
    flexDirection: 'row',
    marginTop: 10,
    padding: 14,
  },
  pageCount: {
    color: '#0B6B4B',
    fontSize: 26,
    fontWeight: '800',
    marginRight: 10,
  },
  pageLabel: {
    color: '#20563F',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E9E3',
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 30,
    padding: 22,
  },
  emptyTitle: {
    color: '#17352B',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: '#718078',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  status: {
    color: '#718078',
    fontSize: 14,
    marginTop: 32,
    textAlign: 'center',
  },
  error: {
    backgroundColor: '#FCEBEC',
    borderRadius: 10,
    color: '#A3333B',
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
  },
});

export default styles;
