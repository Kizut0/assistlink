import { FACULTY_NAMES, FACULTY_PROGRAMS } from './academic.js';

export const DEMO_ADMIN = {
  adObjectId: 'admin-001', email: 'admin@university.edu', name: 'Admin User', phone: '555-0002',
  faculty: 'Martin de Tours School of Management and Economics',
} as const;

const BASE_DEMO_STUDENTS = [
  {
    adObjectId: 'student-001', email: 'student1@university.edu', name: 'Alice Johnson', phone: '555-0003',
    faculty: 'Vincent Mary School of Engineering, Science and Technology', major: 'Computer Science',
    gpa: 3.8, workHoursPerWeek: 10, bio: 'Passionate about machine learning and responsible AI.',
    skills: ['Python', 'JavaScript', 'React', 'PostgreSQL'],
  },
  {
    adObjectId: 'student-002', email: 'student2@university.edu', name: 'Bob Williams', phone: '555-0004',
    faculty: 'Martin de Tours School of Management and Economics', major: 'Business Administration',
    gpa: 3.5, workHoursPerWeek: 15, bio: 'Interested in system design and cloud architecture.',
    skills: ['Java', 'C++', 'AWS', 'Docker', 'Kubernetes'],
  },
  {
    adObjectId: 'student-003', email: 'student3@university.edu', name: 'Chanya Srisuk', phone: '555-0005',
    faculty: 'Theodore Maria School of Arts', major: 'Business English',
    gpa: 3.7, workHoursPerWeek: 12, skills: ['English', 'Presentation', 'Writing'],
    bio: 'Interested in bilingual communication and digital content.',
  },
  {
    adObjectId: 'student-004', email: 'student4@university.edu', name: 'Narin Kittisak', phone: '555-0006',
    faculty: 'Albert Laurence School of Communication Arts', major: 'Creative Communication Design',
    gpa: 3.6, workHoursPerWeek: 14, skills: ['Illustrator', 'Branding', 'Typography'],
    bio: 'Enjoys turning complex ideas into clear visual stories.',
  },
  {
    adObjectId: 'student-005', email: 'student5@university.edu', name: 'Pimchanok Arun', phone: '555-0007',
    faculty: 'Montfort del Rosario School of Architecture and Design', major: 'Architecture',
    gpa: 3.4, workHoursPerWeek: 10, skills: ['AutoCAD', 'SketchUp', 'Model Making'],
    bio: 'Exploring sustainable spaces and human-centered design.',
  },
  {
    adObjectId: 'student-006', email: 'student6@university.edu', name: 'Thanawat Boonmee', phone: '555-0008',
    faculty: 'Theophane Venard School of Food Biotechnology & Innovation', major: 'Food Technology',
    gpa: 3.8, workHoursPerWeek: 8, skills: ['Food Science', 'Laboratory', 'Quality Control'],
    bio: 'Interested in food innovation and sustainable production.',
  },
  {
    adObjectId: 'student-007', email: 'student7@university.edu', name: 'Kritsada Wong', phone: '555-0009',
    faculty: 'Thomas Aquinas School of Law', major: 'Business Law',
    gpa: 3.5, workHoursPerWeek: 10, skills: ['Legal Research', 'Contracts', 'Writing'],
    bio: 'Focused on practical legal research for growing businesses.',
  },
  {
    adObjectId: 'student-008', email: 'student8@university.edu', name: 'Sirinapa Chaiyasit', phone: '555-0010',
    faculty: 'Louis Nobiron School of Music', major: 'Music Entrepreneurship',
    gpa: 3.9, workHoursPerWeek: 6, skills: ['Music Production', 'Event Planning', 'Marketing'],
    bio: 'Combines performance, production, and creative business planning.',
  },
  {
    adObjectId: 'student-009', email: 'student9@university.edu', name: 'Worawan Saelim', phone: '555-0011',
    faculty: 'Bernadette de Lourdes School of Nursing Science', major: 'Nursing Science',
    gpa: 3.8, workHoursPerWeek: 8, skills: ['Patient Care', 'Health Communication', 'Research'],
    bio: 'Interested in evidence-based care and community health.',
  },
] as const;

const generatedStudents = Array.from({ length: 41 }, (_, index) => {
  const number = index + 10;
  const faculty = FACULTY_NAMES[index % FACULTY_NAMES.length];
  const major = FACULTY_PROGRAMS[faculty][index % FACULTY_PROGRAMS[faculty].length];
  return {
    adObjectId: `student-${String(number).padStart(3, '0')}`,
    email: `student${number}@university.edu`,
    name: `Test Student ${String(number).padStart(2, '0')}`,
    phone: `555-${String(1000 + number).padStart(4, '0')}`,
    faculty,
    major,
    gpa: Number((3.1 + (index % 9) * 0.1).toFixed(1)),
    workHoursPerWeek: 8 + (index % 9),
    skills: ['Research', major],
    bio: `Demo student ${number} studying ${major}.`,
  };
});

export const DEMO_STUDENTS = [...BASE_DEMO_STUDENTS, ...generatedStudents];

export const DEMO_PROFESSORS = [
  {
    adObjectId: 'prof-001', email: 'prof@university.edu', name: 'Dr. Jane Smith', phone: '555-0001',
    faculty: 'Vincent Mary School of Engineering, Science and Technology',
  },
  {
    adObjectId: 'prof-002', email: 'prof.management@university.edu', name: 'Dr. Anong Prasert', phone: '555-0102',
    faculty: 'Martin de Tours School of Management and Economics',
  },
  {
    adObjectId: 'prof-003', email: 'prof.arts@university.edu', name: 'Dr. Michael Chen', phone: '555-0103',
    faculty: 'Theodore Maria School of Arts',
  },
  {
    adObjectId: 'prof-004', email: 'prof.communication@university.edu', name: 'Dr. Lalita Arun', phone: '555-0104',
    faculty: 'Albert Laurence School of Communication Arts',
  },
  {
    adObjectId: 'prof-005', email: 'prof.architecture@university.edu', name: 'Dr. Somchai Rattan', phone: '555-0105',
    faculty: 'Montfort del Rosario School of Architecture and Design',
  },
  {
    adObjectId: 'prof-006', email: 'prof.food@university.edu', name: 'Dr. Nicha Kraisorn', phone: '555-0106',
    faculty: 'Theophane Venard School of Food Biotechnology & Innovation',
  },
  {
    adObjectId: 'prof-007', email: 'prof.law@university.edu', name: 'Dr. Preecha Wattan', phone: '555-0107',
    faculty: 'Thomas Aquinas School of Law',
  },
  {
    adObjectId: 'prof-008', email: 'prof.music@university.edu', name: 'Dr. Kanya Meechai', phone: '555-0108',
    faculty: 'Louis Nobiron School of Music',
  },
  {
    adObjectId: 'prof-009', email: 'prof.nursing@university.edu', name: 'Dr. Supansa Charoen', phone: '555-0109',
    faculty: 'Bernadette de Lourdes School of Nursing Science',
  },
] as const;
