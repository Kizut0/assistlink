import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';
import { ApiError } from '../src/utils/ApiError.js';
import {
  deleteMyResume,
  getApplicantResume,
  getMyResume,
  MAX_RESUME_BYTES,
  uploadMyResume,
} from '../src/modules/profiles/resumes.service.js';

const originals = {
  studentFindUnique: prisma.student.findUnique,
  studentUpdate: prisma.student.update,
  applicationFindUnique: prisma.application.findUnique,
  applicationUpdateMany: prisma.application.updateMany,
  transaction: prisma.$transaction,
};

afterEach(() => {
  prisma.student.findUnique = originals.studentFindUnique;
  prisma.student.update = originals.studentUpdate;
  prisma.application.findUnique = originals.applicationFindUnique;
  prisma.application.updateMany = originals.applicationUpdateMany;
  prisma.$transaction = originals.transaction;
});

function pdfWithText(text: string, pageCount = 1): Buffer {
  const fontId = 3 + pageCount;
  const contentStart = fontId + 1;
  const kids = Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(' ');
  const pages = Array.from({ length: pageCount }, (_, index) =>
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentStart + index} 0 R >>`);
  const streams = Array.from({ length: pageCount }, (_, index) => {
    const pageText = `${text}${text ? ` page ${index + 1}` : ''}`;
    const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${pageText.replace(/[()\\]/g, '\\$&')}) Tj\nET`;
    return `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    ...pages,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...streams,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

test('valid PDF upload extracts text, stores bytes, and invalidates only the student rankings', async () => {
  const pdf = pdfWithText('Alice Johnson software engineering resume Python TensorFlow research experience and project leadership.');
  let studentUpdate: any;
  let rankingUpdate: any;
  prisma.student.findUnique = (async () => ({ id: 12 })) as typeof originals.studentFindUnique;
  prisma.student.update = (async args => {
    studentUpdate = args;
    return {
      resumeFileName: args.data.resumeFileName,
      resumeMimeType: args.data.resumeMimeType,
      resumeSizeBytes: args.data.resumeSizeBytes,
      resumeUploadedAt: args.data.resumeUploadedAt,
      resumeText: args.data.resumeText,
    };
  }) as typeof originals.studentUpdate;
  prisma.application.updateMany = (async args => { rankingUpdate = args; return { count: 2 }; }) as typeof originals.applicationUpdateMany;
  prisma.$transaction = (async values => Promise.all(values as Promise<unknown>[])) as typeof originals.transaction;

  const result = await uploadMyResume(3, { originalname: '../Alice Resume.pdf', mimetype: 'application/pdf', size: pdf.length, buffer: pdf });
  assert.equal(result.resume.fileName, 'Alice Resume.pdf');
  assert.match(result.resumeText!, /TensorFlow research experience/);
  assert.ok(studentUpdate.data.resumePdf instanceof Uint8Array);
  assert.equal('resumePdf' in result, false);
  assert.deepEqual(rankingUpdate, { where: { studentId: 12 }, data: { aiScore: null, aiRationale: null } });
});

test('invalid files fail before database writes and preserve an existing résumé', async () => {
  let lookedUp = false;
  prisma.student.findUnique = (async () => { lookedUp = true; return { id: 12 }; }) as typeof originals.studentFindUnique;
  const invalidCases = [
    undefined,
    { originalname: 'resume.txt', mimetype: 'text/plain', size: 10, buffer: Buffer.from('not a pdf') },
    { originalname: 'resume.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('not a pdf') },
    { originalname: 'resume.pdf', mimetype: 'application/pdf', size: MAX_RESUME_BYTES + 1, buffer: Buffer.from('%PDF-') },
  ];
  for (const file of invalidCases) {
    await assert.rejects(uploadMyResume(3, file), (error: unknown) => error instanceof ApiError && [400, 413].includes(error.statusCode));
  }
  assert.equal(lookedUp, false);
});

test('image-only and over-ten-page PDFs are rejected before profile replacement', async () => {
  let lookedUp = false;
  prisma.student.findUnique = (async () => { lookedUp = true; return { id: 12 }; }) as typeof originals.studentFindUnique;
  for (const buffer of [pdfWithText(''), pdfWithText('Readable resume experience and skills with enough text for extraction.', 11)]) {
    await assert.rejects(uploadMyResume(3, {
      originalname: 'resume.pdf', mimetype: 'application/pdf', size: buffer.length, buffer,
    }), (error: unknown) => error instanceof ApiError && error.statusCode === 400);
  }
  assert.equal(lookedUp, false);
});

test('resume retrieval enforces self and applicant ownership without exposing other applications', async () => {
  const stored = { resumePdf: new Uint8Array([1, 2, 3]), resumeFileName: 'resume.pdf', resumeMimeType: 'application/pdf', resumeSizeBytes: 3 };
  prisma.student.findUnique = (async () => stored) as typeof originals.studentFindUnique;
  assert.equal((await getMyResume(3)).fileName, 'resume.pdf');

  prisma.application.findUnique = (async () => ({ postId: 8, post: { authorId: 1 }, student: stored })) as typeof originals.applicationFindUnique;
  assert.equal((await getApplicantResume(8, 20, { userId: 1, role: 'PROFESSOR' })).sizeBytes, 3);
  await assert.rejects(getApplicantResume(8, 20, { userId: 2, role: 'PROFESSOR' }), { statusCode: 403 });
  await assert.rejects(getApplicantResume(9, 20, { userId: 1, role: 'PROFESSOR' }), { statusCode: 404 });
  assert.equal((await getApplicantResume(8, 20, { userId: 99, role: 'ADMIN' })).fileName, 'resume.pdf');
});

test('deleting a résumé clears file metadata, extracted text, legacy URL, and rankings', async () => {
  let data: unknown;
  prisma.student.findUnique = (async () => ({ id: 12 })) as typeof originals.studentFindUnique;
  prisma.student.update = (async args => { data = args.data; return {}; }) as typeof originals.studentUpdate;
  prisma.application.updateMany = (async () => ({ count: 1 })) as typeof originals.applicationUpdateMany;
  prisma.$transaction = (async values => Promise.all(values as Promise<unknown>[])) as typeof originals.transaction;
  assert.deepEqual(await deleteMyResume(3), { resume: null, resumeText: null });
  assert.deepEqual(data, {
    resumePdf: null,
    resumeFileName: null,
    resumeMimeType: null,
    resumeSizeBytes: null,
    resumeUploadedAt: null,
    resumeText: null,
    resumeUrl: null,
  });
});
