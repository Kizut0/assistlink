import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AuthUser } from '../../middleware/auth.js';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_PAGES = 10;
export const MAX_RESUME_TEXT = 20_000;

export interface ResumeUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredResume {
  pdf: Uint8Array;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function sanitizeFileName(input: string): string {
  const base = path.basename(input).normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim()
    .slice(0, 180);
  const stem = base.replace(/\.pdf$/i, '').trim() || 'resume';
  return `${stem}.pdf`;
}

function normalizeResumeText(input: string): string {
  return input.replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parseResume(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    if (result.total > MAX_RESUME_PAGES) {
      throw ApiError.badRequest(`Résumé PDFs may contain at most ${MAX_RESUME_PAGES} pages`);
    }
    const text = normalizeResumeText(result.text);
    if (text.length < 50) {
      throw ApiError.badRequest('This PDF does not contain enough selectable text. Upload a text-based résumé rather than a scanned image.');
    }
    return text.slice(0, MAX_RESUME_TEXT);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest('Unable to read this PDF. Make sure it is a valid, unencrypted résumé.');
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function validateUpload(file: ResumeUpload | undefined): asserts file is ResumeUpload {
  if (!file) throw ApiError.badRequest('Choose a résumé PDF to upload');
  if (file.size > MAX_RESUME_BYTES) throw new ApiError(413, 'Résumé PDFs must be 5 MB or smaller');
  if (file.mimetype.toLowerCase() !== 'application/pdf' || !file.originalname.toLowerCase().endsWith('.pdf')) {
    throw ApiError.badRequest('Only PDF résumé files are accepted');
  }
  if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw ApiError.badRequest('The uploaded file is not a valid PDF');
  }
}

export async function uploadMyResume(userId: number, file: ResumeUpload | undefined) {
  validateUpload(file);
  const text = await parseResume(file.buffer);
  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  if (!student) throw ApiError.badRequest('Complete and save your student profile before uploading a résumé');

  const uploadedAt = new Date();
  const fileName = sanitizeFileName(file.originalname);
  const [updated] = await prisma.$transaction([
    prisma.student.update({
      where: { id: student.id },
      data: {
        resumePdf: new Uint8Array(file.buffer),
        resumeFileName: fileName,
        resumeMimeType: 'application/pdf',
        resumeSizeBytes: file.size,
        resumeUploadedAt: uploadedAt,
        resumeText: text,
        resumeUrl: null,
      },
      select: { resumeFileName: true, resumeMimeType: true, resumeSizeBytes: true, resumeUploadedAt: true, resumeText: true },
    }),
    prisma.application.updateMany({
      where: { studentId: student.id },
      data: { aiScore: null, aiRationale: null },
    }),
  ]);
  return {
    resume: {
      fileName: updated.resumeFileName!,
      mimeType: updated.resumeMimeType!,
      sizeBytes: updated.resumeSizeBytes!,
      uploadedAt: updated.resumeUploadedAt!,
    },
    resumeText: updated.resumeText,
  };
}

export async function deleteMyResume(userId: number) {
  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  if (!student) throw ApiError.notFound('Student profile not found');
  await prisma.$transaction([
    prisma.student.update({
      where: { id: student.id },
      data: {
        resumePdf: null,
        resumeFileName: null,
        resumeMimeType: null,
        resumeSizeBytes: null,
        resumeUploadedAt: null,
        resumeText: null,
        resumeUrl: null,
      },
    }),
    prisma.application.updateMany({ where: { studentId: student.id }, data: { aiScore: null, aiRationale: null } }),
  ]);
  return { resume: null, resumeText: null };
}

export async function getMyResume(userId: number): Promise<StoredResume> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { resumePdf: true, resumeFileName: true, resumeMimeType: true, resumeSizeBytes: true },
  });
  return requireStoredResume(student);
}

export async function getApplicantResume(postId: number, applicationId: number, actor: AuthUser): Promise<StoredResume> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      postId: true,
      post: { select: { authorId: true } },
      student: { select: { resumePdf: true, resumeFileName: true, resumeMimeType: true, resumeSizeBytes: true } },
    },
  });
  if (!application || application.postId !== postId) throw ApiError.notFound('Application not found');
  if (actor.role !== 'ADMIN' && application.post.authorId !== actor.userId) {
    throw ApiError.forbidden('You can only view résumés for applicants to your own posts');
  }
  return requireStoredResume(application.student);
}

function requireStoredResume(value: {
  resumePdf: Uint8Array | null;
  resumeFileName: string | null;
  resumeMimeType: string | null;
  resumeSizeBytes: number | null;
} | null): StoredResume {
  if (!value?.resumePdf || !value.resumeFileName || value.resumeSizeBytes === null) {
    throw ApiError.notFound('Résumé PDF not found');
  }
  return {
    pdf: value.resumePdf,
    fileName: value.resumeFileName,
    mimeType: value.resumeMimeType ?? 'application/pdf',
    sizeBytes: value.resumeSizeBytes,
  };
}
