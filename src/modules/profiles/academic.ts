export const FACULTY_PROGRAMS = {
  'Martin de Tours School of Management and Economics': [
    'Accountancy',
    'Business Economics',
    'Family Business Management & Innovation',
    'Global Hospitality Management',
    'Design & Digital Innovation',
    'Sustainable Business Management',
    'Business Administration',
  ],
  'Theodore Maria School of Arts': [
    'Business English',
    'Business French',
    'Business Chinese',
    'Business Japanese',
    'English-Chinese for Digital Communication',
  ],
  'Albert Laurence School of Communication Arts': [
    'Creative Commercial Communication',
    'Creative Communication Design',
  ],
  'Vincent Mary School of Engineering, Science and Technology': [
    'Aeronautic Engineering',
    'Electrical & Computer Engineering',
    'Mechatronics Engineering & Artificial Intelligence',
    'New Energy Automotive Engineering',
    'Computer Science',
    'Applied Informatics',
  ],
  'Montfort del Rosario School of Architecture and Design': [
    'Architecture',
    'Interior Design',
    'Art and Design',
  ],
  'Theophane Venard School of Food Biotechnology & Innovation': [
    'Food Technology',
  ],
  'Thomas Aquinas School of Law': [
    'Business Law',
  ],
  'Louis Nobiron School of Music': [
    'Music Entrepreneurship',
  ],
  'Bernadette de Lourdes School of Nursing Science': [
    'Nursing Science',
  ],
} as const;

export type FacultyName = keyof typeof FACULTY_PROGRAMS;
export const FACULTY_NAMES = Object.keys(FACULTY_PROGRAMS) as FacultyName[];

export function isFacultyName(value: string): value is FacultyName {
  return Object.prototype.hasOwnProperty.call(FACULTY_PROGRAMS, value);
}

export function isMajorForFaculty(faculty: FacultyName, major: string): boolean {
  return (FACULTY_PROGRAMS[faculty] as readonly string[]).includes(major);
}
