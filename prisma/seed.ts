import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { FACULTY_PROGRAMS } from '../src/modules/profiles/academic.js';
import { DEMO_ADMIN, DEMO_PROFESSORS, DEMO_STUDENTS } from '../src/modules/profiles/demo-data.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // The existing Department table stores the university's faculty/school names.
  const departments = new Map<string, { id: number; name: string }>();
  for (const name of Object.keys(FACULTY_PROGRAMS)) {
    const department = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    departments.set(name, department);
  }
  const facultyManagement = departments.get(DEMO_ADMIN.faculty)!;
  const facultyEngineering = departments.get('Vincent Mary School of Engineering, Science and Technology')!;

  // Upsert deterministic development accounts so this script can be rerun.
  const professor = await prisma.user.upsert({
    where: { adObjectId: 'prof-001' },
    update: { email: 'prof@university.edu', name: 'Dr. Jane Smith', phone: '555-0001', role: 'PROFESSOR', departmentId: facultyEngineering.id },
    create: {
      adObjectId: 'prof-001', email: 'prof@university.edu', name: 'Dr. Jane Smith', phone: '555-0001',
      role: 'PROFESSOR', departmentId: facultyEngineering.id,
    },
  });
  const professors = new Map<string, typeof professor>([['prof-001', professor]]);

  const admin = await prisma.user.upsert({
    where: { adObjectId: DEMO_ADMIN.adObjectId },
    update: { email: DEMO_ADMIN.email, name: DEMO_ADMIN.name, phone: DEMO_ADMIN.phone, role: 'ADMIN', departmentId: facultyManagement.id },
    create: {
      adObjectId: DEMO_ADMIN.adObjectId, email: DEMO_ADMIN.email, name: DEMO_ADMIN.name, phone: DEMO_ADMIN.phone,
      role: 'ADMIN', departmentId: facultyManagement.id,
    },
  });

  // Create one student profile in every faculty for local testing.
  const demoUsers = [];
  for (const sample of DEMO_STUDENTS) {
    const user = await prisma.user.upsert({
      where: { adObjectId: sample.adObjectId },
      update: { email: sample.email, name: sample.name, phone: sample.phone, role: 'STUDENT', departmentId: departments.get(sample.faculty)!.id },
      create: {
        adObjectId: sample.adObjectId, email: sample.email, name: sample.name, phone: sample.phone,
        role: 'STUDENT', departmentId: departments.get(sample.faculty)!.id,
      },
    });
    demoUsers.push(user);
    await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        major: sample.major,
        resumeUrl: null,
        resumeText: null,
        resumePdf: null,
        resumeFileName: null,
        resumeMimeType: null,
        resumeSizeBytes: null,
        resumeUploadedAt: null,
        gpa: sample.gpa, workHoursPerWeek: sample.workHoursPerWeek, bio: sample.bio, skills: [...sample.skills],
      },
      create: {
        userId: user.id, major: sample.major,
        resumeUrl: null,
        resumeText: null,
        resumePdf: null,
        resumeFileName: null,
        resumeMimeType: null,
        resumeSizeBytes: null,
        resumeUploadedAt: null,
        gpa: sample.gpa, workHoursPerWeek: sample.workHoursPerWeek, bio: sample.bio, skills: [...sample.skills],
      },
    });
  }

  // The first professor above keeps the original development user ID. Add the
  // remaining faculty leads after the student fixtures so student IDs stay
  // contiguous in a fresh seeded database.
  for (const sample of DEMO_PROFESSORS.slice(1)) {
    const facultyProfessor = await prisma.user.upsert({
      where: { adObjectId: sample.adObjectId },
      update: { email: sample.email, name: sample.name, phone: sample.phone, role: 'PROFESSOR', departmentId: departments.get(sample.faculty)!.id },
      create: {
        adObjectId: sample.adObjectId, email: sample.email, name: sample.name, phone: sample.phone,
        role: 'PROFESSOR', departmentId: departments.get(sample.faculty)!.id,
      },
    });
    professors.set(sample.adObjectId, facultyProfessor);
  }

  async function seedPost(data: {
    title: string; details: string; jobCategory: 'RA' | 'TA'; requiredSkills: string[]; authorId: number;
  }) {
    const existing = await prisma.post.findFirst({ where: { title: data.title, authorId: data.authorId } });
    return existing
      ? prisma.post.update({ where: { id: existing.id }, data: { ...data, status: 'OPEN', private: false } })
      : prisma.post.create({ data: { ...data, status: 'OPEN', private: false } });
  }
  const seededPosts = await Promise.all([
    seedPost({
      title: 'Computer Vision Research Assistant',
      details: 'Support image-classification experiments, prepare datasets, and document model results for an applied machine-learning study.',
      jobCategory: 'RA', requiredSkills: ['Python', 'TensorFlow', 'Machine Learning'], authorId: professor.id,
    }),
    seedPost({
      title: 'Data Structures Teaching Assistant',
      details: 'Help lead lab sessions, answer student questions, and review Java programming assignments for Data Structures.',
      jobCategory: 'TA', requiredSkills: ['Java', 'Data Structures', 'Teaching'], authorId: professor.id,
    }),
    seedPost({
      title: 'Smart Campus Energy Research Assistant',
      details: 'Analyze sensor data and prototype dashboards for a study of energy efficiency across university buildings.',
      jobCategory: 'RA', requiredSkills: ['Python', 'Data Analysis', 'SQL'], authorId: professor.id,
    }),
    seedPost({
      title: 'Sustainable Consumer Research Assistant',
      details: 'Assist with survey design, market research, and quantitative analysis for a sustainable business behavior project.',
      jobCategory: 'RA', requiredSkills: ['Research', 'Statistics', 'Excel'], authorId: professors.get('prof-002')!.id,
    }),
    seedPost({
      title: 'Digital Communication Teaching Assistant',
      details: 'Support workshops on professional writing, presentations, and digital communication for multilingual learners.',
      jobCategory: 'TA', requiredSkills: ['Writing', 'Presentation', 'English'], authorId: professors.get('prof-003')!.id,
    }),
    seedPost({
      title: 'Sustainable Design Research Assistant',
      details: 'Document case studies and help evaluate human-centered sustainability strategies in architecture and interior design.',
      jobCategory: 'RA', requiredSkills: ['Research', 'AutoCAD', 'Sustainability'], authorId: professors.get('prof-005')!.id,
    }),
    seedPost({
      title: 'Food Quality Laboratory Assistant',
      details: 'Prepare samples, maintain laboratory records, and assist with food quality and shelf-life experiments.',
      jobCategory: 'RA', requiredSkills: ['Laboratory', 'Food Science', 'Quality Control'], authorId: professors.get('prof-006')!.id,
    }),
    seedPost({
      title: 'Evidence-Based Nursing Research Assistant',
      details: 'Support literature reviews and structured data collection for a community health research project.',
      jobCategory: 'RA', requiredSkills: ['Research', 'Patient Care', 'Health Communication'], authorId: professors.get('prof-009')!.id,
    }),
  ]);

  console.log('✅ Seed data created successfully!');
  console.log(`📚 Faculties: ${departments.size}`);
  console.log(`👨‍🏫 Professor: ${professor.name}`);
  console.log(`🔐 Admin: ${admin.name}`);
  console.log(`👨‍🎓 Students: ${demoUsers.length} profiles across all faculties`);
  console.log(`👩‍🏫 Professors: ${DEMO_PROFESSORS.length} faculty leads`);
  console.log(`📝 Posts: ${seededPosts.length} realistic opportunities (no applications or rankings added)`);
}

export async function runDemoSeed(): Promise<void> {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}
