import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { FACULTY_PROGRAMS } from '../src/modules/profiles/academic.js';
import { DEMO_PROFESSORS, DEMO_STUDENTS } from '../src/modules/profiles/demo-data.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const name of Object.keys(FACULTY_PROGRAMS)) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const sample of DEMO_PROFESSORS) {
    await prisma.user.upsert({
      where: { adObjectId: sample.adObjectId },
      update: {
        email: sample.email,
        name: sample.name,
        phone: sample.phone,
        department: { connect: { name: sample.faculty } },
      },
      create: {
        adObjectId: sample.adObjectId,
        email: sample.email,
        name: sample.name,
        phone: sample.phone,
        role: 'PROFESSOR',
        department: { connect: { name: sample.faculty } },
      },
    });
  }

  for (const sample of DEMO_STUDENTS) {
    const user = await prisma.user.upsert({
      where: { adObjectId: sample.adObjectId },
      update: {
        email: sample.email,
        name: sample.name,
        phone: sample.phone,
        department: { connect: { name: sample.faculty } },
      },
      create: {
        adObjectId: sample.adObjectId,
        email: sample.email,
        name: sample.name,
        phone: sample.phone,
        role: 'STUDENT',
        department: { connect: { name: sample.faculty } },
      },
    });
    await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        major: sample.major,
        gpa: sample.gpa,
        workHoursPerWeek: sample.workHoursPerWeek,
        resumeUrl: 'resumeUrl' in sample ? sample.resumeUrl : null,
        resumeText: 'resumeText' in sample ? sample.resumeText : null,
        bio: sample.bio,
        skills: [...sample.skills],
      },
      create: {
        userId: user.id,
        major: sample.major,
        gpa: sample.gpa,
        workHoursPerWeek: sample.workHoursPerWeek,
        resumeUrl: 'resumeUrl' in sample ? sample.resumeUrl : null,
        resumeText: 'resumeText' in sample ? sample.resumeText : null,
        bio: sample.bio,
        skills: [...sample.skills],
      },
    });
  }

  console.log(`✅ Upserted ${DEMO_STUDENTS.length} student and ${DEMO_PROFESSORS.length} professor test users across ${Object.keys(FACULTY_PROGRAMS).length} faculties.`);
}

main()
  .catch(error => {
    console.error('❌ Test user seed failed:', error);
    process.exit(1);
  })
  .finally(async () => { await prisma.$disconnect(); });
