const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create departments
    const dept1 = await client.query(
      'INSERT INTO "Department" (name) VALUES ($1) RETURNING id',
      ['Computer Science']
    );
    const dept2 = await client.query(
      'INSERT INTO "Department" (name) VALUES ($1) RETURNING id',
      ['Engineering']
    );

    const deptCSId = dept1.rows[0].id;
    const deptEngId = dept2.rows[0].id;

    // Create professor
    const prof = await client.query(
      'INSERT INTO "User" ("adObjectId", email, name, phone, role, "departmentId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['prof-001', 'prof@university.edu', 'Dr. Jane Smith', '555-0001', 'PROFESSOR', deptCSId]
    );
    const profId = prof.rows[0].id;

    // Create admin
    await client.query(
      'INSERT INTO "User" ("adObjectId", email, name, phone, role, "departmentId") VALUES ($1, $2, $3, $4, $5, $6)',
      ['admin-001', 'admin@university.edu', 'Admin User', '555-0002', 'ADMIN', deptCSId]
    );

    // Create student 1
    const student1 = await client.query(
      'INSERT INTO "User" ("adObjectId", email, name, phone, role, "departmentId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['student-001', 'student1@university.edu', 'Alice Johnson', '555-0003', 'STUDENT', deptCSId]
    );
    const student1Id = student1.rows[0].id;

    // Create student 2
    const student2 = await client.query(
      'INSERT INTO "User" ("adObjectId", email, name, phone, role, "departmentId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['student-002', 'student2@university.edu', 'Bob Williams', '555-0004', 'STUDENT', deptEngId]
    );
    const student2Id = student2.rows[0].id;

    // Create student profiles
    await client.query(
      'INSERT INTO "Student" ("userId", "gpa", "workHoursPerWeek", "resumeUrl", "resumeText", "bio", "skills") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [student1Id, 3.8, 10, 'https://example.com/resume1.pdf', 'Experienced developer with 2 years of internship', 'Passionate about machine learning', ['Python', 'JavaScript', 'React', 'PostgreSQL']]
    );

    await client.query(
      'INSERT INTO "Student" ("userId", "gpa", "workHoursPerWeek", "resumeUrl", "resumeText", "bio", "skills") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [student2Id, 3.5, 15, 'https://example.com/resume2.pdf', 'Full-stack developer with DevOps experience', 'Interested in system design and cloud architecture', ['Java', 'C++', 'AWS', 'Docker', 'Kubernetes']]
    );

    // Create posts
    await client.query(
      'INSERT INTO "Post" (title, content, "requiredSkills", "status", "authorId") VALUES ($1, $2, $3, $4, $5)',
      ['Research Assistant Needed - ML Project', 'Looking for a motivated student to help with machine learning research on image classification.', ['Python', 'TensorFlow', 'Machine Learning'], 'OPEN', profId]
    );

    await client.query(
      'INSERT INTO "Post" (title, content, "requiredSkills", "status", "authorId") VALUES ($1, $2, $3, $4, $5)',
      ['Teaching Assistant Wanted - Data Structures', 'Need help grading assignments and leading lab sessions for Data Structures course.', ['Java', 'Data Structures', 'Teaching'], 'OPEN', profId]
    );

    await client.query('COMMIT');
    console.log('✅ Seed data created successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
