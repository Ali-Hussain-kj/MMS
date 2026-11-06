// Shared program IDs are stored in student records; labels are shown in the UI.
export const programs = [
  { id: 'noorani-qaida', label: 'Noorani Qaida' },
  { id: 'nazra-quran', label: 'Nazra Quran' },
  { id: 'hifz-ul-quran', label: 'Hifz-ul-Quran' },
  { id: 'dars-e-nizami', label: 'Dars-e-Nizami' },
  { id: 'asri-taleem-class-1-10', label: 'Asri Taleem (Class 1-10)' },
];

export const classes = Array.from({ length: 10 }, (_, index) =>
  String(index + 1),
);

// Return a friendly label for a saved program ID.
export function getProgramLabel(programId) {
  return programs.find(program => program.id === programId)?.label || programId;
}
