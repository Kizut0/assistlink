import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { FACULTY_PROGRAMS } from '../src/modules/profiles/academic.js';
import { DEMO_PROFESSORS, DEMO_STUDENTS } from '../src/modules/profiles/demo-data.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // The existing Department table stores the university's faculty/school names.
  const departments = new Map<string, { id: number; name: string }>();
  for (const name of Object.keys(FACULTY_PROGRAMS)) {
    const department = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    departments.set(name, department);
  }
  const facultyManagement = departments.get('Martin de Tours School of Management and Economics')!;
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

  const admin = await prisma.user.upsert({
    where: { adObjectId: 'admin-001' },
    update: { email: 'admin@university.edu', name: 'Admin User', phone: '555-0002', role: 'ADMIN', departmentId: facultyManagement.id },
    create: {
      adObjectId: 'admin-001', email: 'admin@university.edu', name: 'Admin User', phone: '555-0002',
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
        resumeUrl: 'resumeUrl' in sample ? sample.resumeUrl : null,
        resumeText: 'resumeText' in sample ? sample.resumeText : null,
        gpa: sample.gpa, workHoursPerWeek: sample.workHoursPerWeek, bio: sample.bio, skills: [...sample.skills],
      },
      create: {
        userId: user.id, major: sample.major,
        resumeUrl: 'resumeUrl' in sample ? sample.resumeUrl : null,
        resumeText: 'resumeText' in sample ? sample.resumeText : null,
        gpa: sample.gpa, workHoursPerWeek: sample.workHoursPerWeek, bio: sample.bio, skills: [...sample.skills],
      },
    });
  }

  // The first professor above keeps the original development user ID. Add the
  // remaining faculty leads after the student fixtures so student IDs stay
  // contiguous in a fresh seeded database.
  for (const sample of DEMO_PROFESSORS.slice(1)) {
    await prisma.user.upsert({
      where: { adObjectId: sample.adObjectId },
      update: { email: sample.email, name: sample.name, phone: sample.phone, role: 'PROFESSOR', departmentId: departments.get(sample.faculty)!.id },
      create: {
        adObjectId: sample.adObjectId, email: sample.email, name: sample.name, phone: sample.phone,
        role: 'PROFESSOR', departmentId: departments.get(sample.faculty)!.id,
      },
    });
  }

  async function seedPost(data: {
    title: string; details: string; jobCategory: 'RA' | 'TA'; requiredSkills: string[]; authorId: number;
  }) {
    const existing = await prisma.post.findFirst({ where: { title: data.title, authorId: data.authorId } });
    return existing
      ? prisma.post.update({ where: { id: existing.id }, data: { ...data, status: 'OPEN', private: false } })
      : prisma.post.create({ data: { ...data, status: 'OPEN', private: false } });
  }
  const post1 = await seedPost({
    title: 'Research Assistant Needed - ML Project',
    details: 'Looking for a motivated student to help with machine learning research on image classification.',
    jobCategory: 'RA', requiredSkills: ['Python', 'TensorFlow', 'Machine Learning'], authorId: professor.id,
  });
  const post2 = await seedPost({
    title: 'Teaching Assistant Wanted - Data Structures',
    details: 'Need help grading assignments and leading lab sessions for Data Structures course.',
    jobCategory: 'TA', requiredSkills: ['Java', 'Data Structures', 'Teaching'], authorId: professor.id,
  });

  console.log('✅ Seed data created successfully!');
  console.log(`📚 Faculties: ${departments.size}`);
  console.log(`👨‍🏫 Professor: ${professor.name}`);
  console.log(`🔐 Admin: ${admin.name}`);
  console.log(`👨‍🎓 Students: ${demoUsers.length} profiles across all faculties`);
  console.log(`👩‍🏫 Professors: ${DEMO_PROFESSORS.length} faculty leads`);
  console.log(`📝 Posts: ${post1.title}, ${post2.title}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
