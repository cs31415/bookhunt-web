import { logFailure, logRequest, logResponse } from '../log';
import type { PresignedUpload } from './presign';

export class UploadError extends Error {
  key: string;
  /** null when the request never produced a response at all (network or CORS). */
  status: number | null;

  constructor(key: string, status: number | null, message: string) {
    super(message);
    this.name = 'UploadError';
    this.key = key;
    this.status = status;
  }
}

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

  logRequest('POST', upload.url, { key: upload.key, name: file.name, type: file.type, size: file.size });

  let response: Response;
  try {
    response = await fetch(upload.url, { method: 'POST', body: form });
  } catch (error) {
    // This request never touches the bookhunt API, so a failure here leaves no
    // server-side trace. The usual cause is the bucket's CORS configuration not
    // allowing POST from this origin — the browser reports it as a bare
    // "Failed to fetch" with no status.
    logFailure('POST', upload.url, error);
    throw new UploadError(
      upload.key,
      null,
      `Upload of ${file.name} never reached S3 — check the bucket's CORS rules allow POST from ${window.location.origin}.`,
    );
  }

  if (!response.ok) {
    // S3 explains itself in an XML body; without it a 403 is unattributable
    // (expired policy, content-type mismatch, size outside content-length-range).
    const detail = await response.text().catch(() => '');
    logResponse('POST', upload.url, response.status, detail);
    throw new UploadError(
      upload.key,
      response.status,
      `S3 rejected ${file.name} with ${response.status}. ${detail}`.trim(),
    );
  }

  logResponse('POST', upload.url, response.status);
}
