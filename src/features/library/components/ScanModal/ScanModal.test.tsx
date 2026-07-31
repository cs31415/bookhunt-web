import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LibraryPage } from '../../LibraryPage';
import { ToastHost } from '../../../../shared/toast/ToastHost';
import { clearToasts } from '../../../../shared/toast/toast-store';
import { getLibrary } from '../../../../api/library/get-library';
import { addToLibrary } from '../../../../api/library/add-to-library';
import { getBooksByIds } from '../../../../api/books/get-books-by-ids';
import { presignUploads } from '../../../../api/upload/presign';
import { uploadToPresigned } from '../../../../api/upload/upload-to-presigned';
import { scanShelves } from '../../../../api/upload/scan';
import { ApiError } from '../../../../api/client';
import type { RawDetectedBook } from '../../../../api/upload/scan';
import type { RawLibraryEntry } from '../../../../normalize/library';

vi.mock('../../../../api/library/get-library');
vi.mock('../../../../api/library/add-to-library');
vi.mock('../../../../api/books/get-books-by-ids');
vi.mock('../../../../api/upload/presign', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../api/upload/presign')>()),
  presignUploads: vi.fn(),
}));
vi.mock('../../../../api/upload/upload-to-presigned');
vi.mock('../../../../api/upload/scan');

const mockedGetLibrary = vi.mocked(getLibrary);
const mockedAddToLibrary = vi.mocked(addToLibrary);
const mockedGetBooksByIds = vi.mocked(getBooksByIds);
const mockedPresign = vi.mocked(presignUploads);
const mockedUpload = vi.mocked(uploadToPresigned);
const mockedScan = vi.mocked(scanShelves);

function makeEntry(overrides: Partial<RawLibraryEntry> = {}): RawLibraryEntry {
  const id = overrides.book_id ?? 1;
  return {
    book_id: id,
    status: 'queued',
    notes: null,
    review: null,
    title: `Book ${id}`,
    book_slug: `book-${id}`,
    author_name: 'Anon',
    author_slug: 'anon',
    year: 2000,
    rating: 4,
    cover_url: null,
    hue: '#6f7a55',
    subjects: [],
    date_added: null,
    ...overrides,
  };
}

function makeFile(name = 'shelf.jpg', type = 'image/jpeg', size = 1024) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** Five books the vision model "read", all resolved against a provider. */
function detected(n: number): RawDetectedBook[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Spine ${i + 1}`,
    author: `Author ${i + 1}`,
    resolvedBook: {
      googleBooksId: `gb-${i + 1}`,
      openLibraryId: null,
      title: `Spine ${i + 1}`,
      authors: [`Author ${i + 1}`],
      year: 1990 + i,
      publisher: 'Press',
      pages: 200,
      rating: 4,
      coverUrl: `https://example.test/${i + 1}.jpg`,
      isbn13: null,
      language: 'en',
      blurb: null,
      categories: [],
      moods: [],
      inLibrary: false,
      libraryStatus: null,
      source: 'google_books',
    },
  }));
}

function renderLibrary() {
  const router = createMemoryRouter(
    [
      {
        path: '/library',
        element: (
          <>
            <LibraryPage />
            <ToastHost />
          </>
        ),
      },
      { path: '/', element: <div /> },
      { path: '/books/:slug', element: <div /> },
    ],
    { initialEntries: ['/library'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

/** Opens the modal from a non-empty library and waits for the upload phase. */
async function openModal() {
  fireEvent.click(await screen.findByRole('button', { name: 'Add from a photo' }));
  return await screen.findByRole('dialog');
}

function dropFiles(dialog: HTMLElement, files: File[]) {
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe('ScanModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearToasts();
    // Stubbed explicitly rather than inherited from .env, which is gitignored —
    // otherwise every test here would flip off in a fresh checkout or CI.
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', 'true');
    // jsdom implements neither.
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((f: File) => `blob:${f.name}`),
      revokeObjectURL: vi.fn(),
    });

    mockedGetLibrary.mockResolvedValue({
      entries: [makeEntry({ book_id: 1, title: 'Existing' })],
      stats: { total: 1, by_status: { queued: 1 } },
    });
    mockedPresign.mockResolvedValue([
      { url: 'https://s3.test/', fields: { key: 'uploads/1/a' }, key: 'uploads/1/a' },
    ]);
    mockedUpload.mockResolvedValue(undefined);
    mockedGetBooksByIds.mockResolvedValue({ books: [] });
    mockedAddToLibrary.mockResolvedValue({ entry: {}, book: { id: 9, slug: 'spine-1' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // AC1
  it('opens on "Add from a photo" showing the upload phase and a single-file picker', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: [] });
    renderLibrary();
    const dialog = await openModal();

    expect(within(dialog).getByText('Drop a photo of your bookshelf')).toBeInTheDocument();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    // One photo at a time (LOS-170): a single image gets the whole prompt and
    // token budget, which reads spines better than several sharing them.
    expect(input).not.toHaveAttribute('multiple');
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
  });

  it('hides photo import entirely when the flag is off', async () => {
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', 'false');
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.queryByRole('button', { name: 'Add from a photo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hides photo import when the flag is unset', async () => {
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', '');
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.queryByRole('button', { name: 'Add from a photo' })).not.toBeInTheDocument();
  });

  it('hides photo import from the empty state too when the flag is off', async () => {
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', 'false');
    mockedGetLibrary.mockResolvedValue({ entries: [], stats: { total: 0, by_status: {} } });
    renderLibrary();

    await screen.findByText('Your shelves are empty');
    expect(screen.getByRole('button', { name: 'Discover books' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add from a photo' })).not.toBeInTheDocument();
  });

  // AC1 — the empty-state button is a separate branch and must open it too.
  it('opens from the empty state as well', async () => {
    mockedGetLibrary.mockResolvedValue({ entries: [], stats: { total: 0, by_status: {} } });
    mockedScan.mockResolvedValue({ detectedBooks: [] });
    renderLibrary();

    await screen.findByText('Your shelves are empty');
    fireEvent.click(screen.getByRole('button', { name: 'Add from a photo' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  // AC2
  it('shows a preview of the photo with a scanning label while processing', async () => {
    let resolveScan: (v: { detectedBooks: RawDetectedBook[] }) => void = () => {};
    mockedScan.mockReturnValue(new Promise((resolve) => (resolveScan = resolve)));

    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile('shelf.jpg')]);

    expect(await screen.findByText('Scanning your photo…')).toBeInTheDocument();
    expect(dialog.querySelectorAll('img')).toHaveLength(1);

    await act(async () => resolveScan({ detectedBooks: [] }));
  });

  // AC3
  it('lists detected books with covers, a default queued status, and an add count', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(5) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(await screen.findByText(/Found/)).toHaveTextContent('Found 5 books');
    expect(screen.getByText('Spine 1')).toBeInTheDocument();
    expect(screen.getByText('Author 1')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Queued' })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Add 5 to library' })).toBeInTheDocument();
  });

  // AC4
  it('cycles a status queued -> reading -> finished -> queued', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(1) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    fireEvent.click(await screen.findByRole('button', { name: 'Queued' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reading' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finished' }));
    expect(screen.getByRole('button', { name: 'Queued' })).toBeInTheDocument();
  });

  // AC5
  it('excludes an unticked book from the count and restores it when re-ticked', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(3) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    await screen.findByRole('button', { name: 'Add 3 to library' });

    const skip = screen.getByRole('checkbox', { name: 'Skip Spine 2' });
    fireEvent.click(skip);
    expect(screen.getByRole('button', { name: 'Add 2 to library' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include Spine 2' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Spine 2' }));
    expect(screen.getByRole('button', { name: 'Add 3 to library' })).toBeInTheDocument();
  });

  it('keeps a chosen status across untick and re-tick', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(1) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    fireEvent.click(await screen.findByRole('button', { name: 'Queued' }));
    expect(screen.getByRole('button', { name: 'Reading' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Skip Spine 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Spine 1' }));

    expect(screen.getByRole('button', { name: 'Reading' })).toBeInTheDocument();
  });

  // AC6
  it('adds every ticked book with its chosen status and closes', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(2) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    fireEvent.click(await screen.findByRole('button', { name: 'Add 2 to library' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockedAddToLibrary).toHaveBeenCalledTimes(2);
    expect(mockedAddToLibrary).toHaveBeenCalledWith(
      'spine-1',
      'queued',
      expect.objectContaining({ title: 'Spine 1', googleBooksId: 'gb-1' }),
    );
  });

  it('adds a catalog match by its real slug with no upsert fields', async () => {
    mockedScan.mockResolvedValue({
      detectedBooks: [{ title: 'Dune', author: 'Frank Herbert', matchedBookId: 42 }],
    });
    mockedGetBooksByIds.mockResolvedValue({
      books: [
        {
          id: 42,
          slug: 'dune',
          title: 'Dune',
          authorName: 'Frank Herbert',
          authorSlug: 'frank-herbert',
          year: 1965,
          rating: 4.5,
          coverUrl: null,
          hue: '#6f7a55',
        },
      ],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 to library' }));

    await waitFor(() => expect(mockedAddToLibrary).toHaveBeenCalledWith('dune', 'queued', undefined));
  });

  // AC7
  it('toasts when the scan finishes after the modal was closed, and Review reopens it', async () => {
    let resolveScan: (v: { detectedBooks: RawDetectedBook[] }) => void = () => {};
    mockedScan.mockReturnValue(new Promise((resolve) => (resolveScan = resolve)));

    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);
    await screen.findByText('Scanning your photo…');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => resolveScan({ detectedBooks: detected(4) }));

    expect(await screen.findByText('Found 4 books in your photo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 4 to library' })).toBeInTheDocument();
  });

  it('does not toast when the modal is still open as the scan finishes', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(2) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    await screen.findByRole('button', { name: 'Add 2 to library' });
    expect(screen.queryByText(/in your photo/)).not.toBeInTheDocument();
  });

  // AC8
  it('closes without adding anything when Cancel is clicked', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(2) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedAddToLibrary).not.toHaveBeenCalled();
  });

  // AC9
  it('shows the generic error message when the scan call fails', async () => {
    mockedScan.mockRejectedValue(new ApiError(500, 'boom'));
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(
      await screen.findByText("Couldn't read your photos — please try again."),
    ).toBeInTheDocument();
  });

  it('distinguishes a rate-limited scan from a generic failure', async () => {
    mockedScan.mockRejectedValue(new ApiError(429, 'slow down'));
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(
      await screen.findByText('Too many scans right now — try again in a minute.'),
    ).toBeInTheDocument();
  });

  it('returns to the upload phase from the error pane', async () => {
    mockedScan.mockRejectedValue(new ApiError(500, 'boom'));
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Drop a photo of your bookshelf')).toBeInTheDocument();
  });

  // AC10
  it('reports zero books and offers no add button when nothing is recognised', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: [] });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(await screen.findByText(/Found/)).toHaveTextContent('Found 0 books');
    expect(screen.queryByRole('button', { name: /Add .* to library/ })).not.toBeInTheDocument();
  });

  // AC11
  it('drops detections that are already in the library', async () => {
    mockedScan.mockResolvedValue({
      detectedBooks: [
        { title: 'Existing', author: 'Anon', matchedBookId: 1 },
        { title: 'Dune', author: 'Frank Herbert', matchedBookId: 42 },
      ],
    });
    mockedGetBooksByIds.mockResolvedValue({
      books: [
        {
          id: 42,
          slug: 'dune',
          title: 'Dune',
          authorName: 'Frank Herbert',
          authorSlug: 'frank-herbert',
          year: 1965,
          rating: 4.5,
          coverUrl: null,
          hue: '#6f7a55',
        },
      ],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(await screen.findByText(/Found/)).toHaveTextContent('Found 1 book');
    expect(screen.getByRole('checkbox', { name: 'Skip Dune' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Existing/ })).not.toBeInTheDocument();
  });

  // AC12
  it('closes on a backdrop click but not on a click inside the card', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: [] });
    renderLibrary();
    const dialog = await openModal();

    fireEvent.click(dialog);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: [] });
    renderLibrary();
    await openModal();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Unresolved tier
  it('starts unresolved spines unticked and flags why', async () => {
    mockedScan.mockResolvedValue({
      detectedBooks: [{ title: 'Blurry Spine', author: null }, ...detected(1)],
    });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(await screen.findByText(/Found/)).toHaveTextContent('Found 2 books');
    expect(screen.getByText(/Couldn’t match this one/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include Blurry Spine' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    // Only the resolved one counts toward the add.
    expect(screen.getByRole('button', { name: 'Add 1 to library' })).toBeInTheDocument();
  });

  // Client-side guards — these never reach the API.
  it('rejects a HEIC pick with actionable guidance', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile('IMG_0001.HEIC', 'image/heic')]);

    expect(await screen.findByText(/HEIC photos aren't supported yet/)).toBeInTheDocument();
    expect(mockedPresign).not.toHaveBeenCalled();
  });

  it('rejects an oversized photo', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile('huge.jpg', 'image/jpeg', 11 * 1024 * 1024)]);

    expect(await screen.findByText('huge.jpg is larger than 10 MB.')).toBeInTheDocument();
    expect(mockedPresign).not.toHaveBeenCalled();
  });

  it('rejects a multi-file selection instead of silently taking the first', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile('a.jpg'), makeFile('b.jpg')]);

    expect(
      await screen.findByText(/Please choose one photo at a time/),
    ).toBeInTheDocument();
    expect(mockedPresign).not.toHaveBeenCalled();
  });

  it('surfaces the API’s own validation message on a 400', async () => {
    mockedPresign.mockRejectedValue(new ApiError(400, 'files must contain at most 40 items'));

    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(await screen.findByText('Files must contain at most 40 items.')).toBeInTheDocument();
  });

  // Batch mechanics
  // The API's batch shape is unchanged — the client just sends a batch of one,
  // so the multi-image capability stays available to scripts/test-photo-import.js.
  it('presigns, uploads, and scans the single photo through the batch API', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(1) });

    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile('shelf.jpg')]);

    await screen.findByRole('button', { name: 'Add 1 to library' });

    expect(mockedPresign).toHaveBeenCalledTimes(1);
    expect(mockedPresign).toHaveBeenCalledWith([{ contentType: 'image/jpeg' }]);
    expect(mockedUpload).toHaveBeenCalledTimes(1);
    expect(mockedScan).toHaveBeenCalledTimes(1);
    expect(mockedScan).toHaveBeenCalledWith(['uploads/1/a']);
  });

  it('reports a partial failure instead of discarding the successful adds', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(2) });
    mockedAddToLibrary
      .mockResolvedValueOnce({ entry: {}, book: { id: 9, slug: 'spine-1' } })
      .mockRejectedValueOnce(new ApiError(500, 'nope'));

    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    fireEvent.click(await screen.findByRole('button', { name: 'Add 2 to library' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockedAddToLibrary).toHaveBeenCalledTimes(2);
    // The one that worked still triggers a library refresh.
    expect(mockedGetLibrary).toHaveBeenCalledTimes(2);
  });

  it('refreshes the library after a successful import', async () => {
    mockedScan.mockResolvedValue({ detectedBooks: detected(1) });
    renderLibrary();
    const dialog = await openModal();
    dropFiles(dialog, [makeFile()]);

    expect(mockedGetLibrary).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 to library' }));

    await waitFor(() => expect(mockedGetLibrary).toHaveBeenCalledTimes(2));
  });
});
