import type { PresignedUpload } from './presign';

/**
 * Uploads one file straight to S3 with a presigned POST policy.
 *
 * Deliberately uses bare fetch rather than apiFetch: apiFetch prefixes the
 * bookhunt API base URL, forces `Content-Type: application/json`, and attaches
 * the Bearer token — all three invalidate the S3 signature. The browser must
 * set the multipart boundary itself, so no headers are passed at all.
 *
 * Field order matters: S3 ignores any form field that appears after `file`,
 * so the policy fields are appended first.
 */
export async function uploadToPresigned(upload: PresignedUpload, file: File): Promise<void> {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) {
    form.append(name, value);
  }
  form.append('file', file);

  const response = await fetch(upload.url, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`Upload failed for ${upload.key} (${response.status})`);
  }
}
