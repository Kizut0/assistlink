import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create departments
  const deptCS = await prisma.department.create({
    data: {
      name: 'Computer Science',
    },
  });

  const deptEng = await prisma.department.create({
    data: {
      name: 'Engineering',
    },
  });

  // Create professor
  const professor = await prisma.user.create({
    data: {
      adObjectId: 'prof-001',
      email: 'prof@university.edu',
      name: 'Dr. Jane Smith',
      phone: '555-0001',
      role: 'PROFESSOR',
      departmentId: deptCS.id,
    },
  });

  // Create admin
  const admin = await prisma.user.create({
    data: {
      adObjectId: 'admin-001',
      email: 'admin@university.edu',
      name: 'Admin User',
      phone: '555-0002',
      role: 'ADMIN',
      departmentId: deptCS.id,
    },
  });

  // Create students
  const student1User = await prisma.user.create({
    data: {
      adObjectId: 'student-001',
      email: 'student1@university.edu',
      name: 'Alice Johnson',
      phone: '555-0003',
      role: 'STUDENT',
      departmentId: deptCS.id,
    },
  });

  const student1 = await prisma.student.create({
    data: {
      userId: student1User.id,
      gpa: 3.8,
      workHoursPerWeek: 10,
      resumeUrl: 'https://example.com/resume1.pdf',
      resumeText: 'Experienced developer with 2 years of internship',
      bio: 'Passionate about machine learning',
      skills: ['Python', 'JavaScript', 'React', 'PostgreSQL'],
    },
  });

  const student2User = await prisma.user.create({
    data: {
      adObjectId: 'student-002',
      email: 'student2@university.edu',
      name: 'Bob Williams',
      phone: '555-0004',
      role: 'STUDENT',
      departmentId: deptEng.id,
    },
  });

  const student2 = await prisma.student.create({
    data: {
      userId: student2User.id,
      gpa: 3.5,
      workHoursPerWeek: 15,
      resumeUrl: 'https://example.com/resume2.pdf',
      resumeText: 'Full-stack developer with DevOps experience',
      bio: 'Interested in system design and cloud architecture',
      skills: ['Java', 'C++', 'AWS', 'Docker', 'Kubernetes'],
    },
  });

  // Create sample posts
  const post1 = await prisma.post.create({
    data: {
      title: 'Research Assistant Needed - ML Project',
      details: 'Looking for a motivated student to help with machine learning research on image classification.',
      jobCategory: 'RA',
      requiredSkills: ['Python', 'TensorFlow', 'Machine Learning'],
      authorId: professor.id,
      status: 'OPEN',
    },
  });

  const post2 = await prisma.post.create({
    data: {
      title: 'Teaching Assistant Wanted - Data Structures',
      details: 'Need help grading assignments and leading lab sessions for Data Structures course.',
      jobCategory: 'TA',
      requiredSkills: ['Java', 'Data Structures', 'Teaching'],
      authorId: professor.id,
      status: 'OPEN',
    },
  });

  console.log('✅ Seed data created successfully!');
  console.log(`📚 Departments: ${deptCS.name}, ${deptEng.name}`);
  console.log(`👨‍🏫 Professor: ${professor.name}`);
  console.log(`🔐 Admin: ${admin.name}`);
  console.log(`👨‍🎓 Students: ${student1User.name}, ${student2User.name}`);
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
