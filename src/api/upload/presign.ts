import { apiFetch } from '../client';

/**
 * Content types and size the S3 policy itself enforces, so checking them here
 * only turns an opaque rejection into a useful message.
 *
 * There is deliberately no photo-count limit: how many photos one scan can take
 * depends on vision-call chunking and provider budgets the client can't see, so
 * the API owns that ceiling and reports it in its 400 (LOS-163).
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Uploads in flight at once — a big batch shouldn't open 40 parallel connections. */
export const UPLOAD_CONCURRENCY = 4;

export function isAllowedImageType(contentType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}

/**
 * A presigned S3 POST policy — not a PUT URL. `fields` must be replayed verbatim
 * in the multipart form; see uploadToPresigned.
 */
export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  key: string;
}

/** POST /upload/presign — batch only, one policy back per file. */
export function presignUploads(files: { contentType: string }[]): Promise<PresignedUpload[]> {
  return apiFetch('/upload/presign', {
    method: 'POST',
    body: JSON.stringify({ files }),
  });
}
