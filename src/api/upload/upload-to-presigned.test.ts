import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { UploadError, uploadToPresigned } from './upload-to-presigned';
import type { PresignedUpload } from './presign';

const policy: PresignedUpload = {
  url: 'https://bucket.s3.amazonaws.com/',
  fields: { key: 'uploads/7/abc', policy: 'base64policy', 'x-amz-signature': 'sig' },
  key: 'uploads/7/abc',
};

function makeFile() {
  return new File(['bytes'], 'shelf.jpg', { type: 'image/jpeg' });
}

describe('uploadToPresigned', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs a multipart form to the policy url with every field replayed', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' });

    await uploadToPresigned(policy, makeFile());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(policy.url);
    expect(init.method).toBe('POST');

    const form = init.body as FormData;
    expect(form.get('key')).toBe('uploads/7/abc');
    expect(form.get('policy')).toBe('base64policy');
    expect(form.get('x-amz-signature')).toBe('sig');
  });

  it('appends the file last, since S3 ignores fields that follow it', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' });

    await uploadToPresigned(policy, makeFile());

    const form = fetchMock.mock.calls[0][1].body as FormData;
    const names = Array.from(form.keys());
    expect(names[names.length - 1]).toBe('file');
  });

  it('sends no headers, so the auth token and JSON content-type never break the signature', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' });

    await uploadToPresigned(policy, makeFile());

    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
  });

  it('surfaces S3’s own explanation when it rejects the upload', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '<Error><Code>AccessDenied</Code></Error>',
    });

    // The XML body is the only thing distinguishing an expired policy from a
    // content-type mismatch from a size violation — all of them 403.
    await expect(uploadToPresigned(policy, makeFile())).rejects.toThrow('AccessDenied');
    await expect(uploadToPresigned(policy, makeFile())).rejects.toThrow('shelf.jpg');
  });

  it('reports a status and key on an S3 rejection', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => '' });

    await expect(uploadToPresigned(policy, makeFile())).rejects.toMatchObject({
      name: 'UploadError',
      status: 403,
      key: 'uploads/7/abc',
    });
  });

  it('names CORS as the likely cause when the request never reaches S3', async () => {
    // fetch rejects rather than resolving: no response, no status, and nothing
    // logged server-side because this request never touches the API.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await uploadToPresigned(policy, makeFile()).catch((e) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error.status).toBeNull();
    expect(error.message).toContain('CORS');
  });
});
