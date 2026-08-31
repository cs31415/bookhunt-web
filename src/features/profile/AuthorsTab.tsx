import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAbortError } from '../../api/client';
import {
  getMyFavoriteAuthors,
  getPublicFavoriteAuthors,
} from '../../api/users/get-favorite-authors';
import type { FavoriteAuthor } from '../../api/users/get-favorite-authors';
import { setAuthorHidden } from '../../api/users/set-author-hidden';
import { toast } from '../../shared/toast/toast-store';
import { pluralize } from '../../shared/lib/text';
import { PublicTick } from './PublicTick';
import { VisibilityBar } from './VisibilityBar';
import { useEditMode } from './useEditMode';
import styles from './ProfilePage.module.css';

/**
 * The favourite-authors tab.
 *
 * Reads a different endpoint for the owner than for a visitor, for the same
 * reason the rest of the page does: the public one is gated on the page being
 * on, and the owner has to see their own list either way.
 *
 * The owner also gets a tick per author, saying whether it appears on the
 * public page. Authors carry their own flag (LOS-282) rather than a library
 * entry's, so the toggle lives here rather than in useEntryFlags. Ticks are
 * staged and written by Save (LOS-288), as the book grid's are.
 */
export function AuthorsTab({ handle, owner }: { handle: string; owner: boolean }) {
  const [authors, setAuthors] = useState<FavoriteAuthor[] | null>(null);
  // Slug -> the isHidden it would be saved with. Ticks move this, not the
  // server; a key drops out again once it agrees with the fetched list.
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  // Behind Edit like the book grid's ticks, so the list reads as a list until
  // the owner says otherwise (LOS-346).
  const edit = useEditMode(useCallback(() => setStaged({}), []));

  useEffect(() => {
    const controller = new AbortController();
    const request = owner
      ? getMyFavoriteAuthors(controller.signal)
      : getPublicFavoriteAuthors(handle, controller.signal);

    request
      .then((response) => setAuthors(response.authors))
      .catch((err) => {
        if (isAbortError(err)) return;
        setAuthors([]);
      });

    return () => controller.abort();
  }, [handle, owner]);

  /** What the fetched list says, before anything was staged over it. */
  const savedHidden = (slug: string) =>
    Boolean((authors ?? []).find((author) => author.slug === slug)?.isHidden);

  /**
   * Records what each row would become, dropping anything that matches the
   * fetched list again: back to where it started is no longer a change to save.
   */
  function stage(rows: FavoriteAuthor[], isHidden: boolean) {
    setStaged((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (savedHidden(row.slug) === isHidden) delete next[row.slug];
        else next[row.slug] = isHidden;
      }
      return next;
    });
  }

  /**
   * Writes every staged change, then adopts what went through.
   *
   * Sequential rather than parallel, like useEntryFlags.hideMany: a list can be
   * long, and a burst of simultaneous requests is how a rate limit gets hit.
   * Failures are counted and reported once, and those rows keep what the server
   * last said rather than a remembered value.
   */
  async function save() {
    const rows = (authors ?? []).filter((row) => row.slug in staged);
    setSaving(true);

    const done: Record<string, boolean> = {};
    const failed: string[] = [];
    for (const row of rows) {
      try {
        await setAuthorHidden(row.slug, staged[row.slug]);
        done[row.slug] = staged[row.slug];
      } catch {
        failed.push(row.name);
      }
    }

    setAuthors((current) =>
      (current ?? []).map((row) =>
        row.slug in done ? { ...row, isHidden: done[row.slug] } : row,
      ),
    );
    // Leaves the mode with the staging, as the book grid does: a save is the
    // end of the task, not a step in it.
    edit.exit();
    setSaving(false);

    if (failed.length > 0) {
      toast({
        text:
          failed.length === 1
            ? `Could not update ${failed[0]}`
            : `Could not update ${failed.length} authors`,
      });
    }
  }

  if (authors === null) return <p className={styles.message}>Loading…</p>;
  if (authors.length === 0) {
    return (
      <p className={styles.message}>
        {owner ? 'You have not favourited any authors yet.' : 'No favourite authors yet.'}
      </p>
    );
  }

  // What the ticks show: the fetched list with anything staged laid over it.
  const shown = authors.map((author) =>
    author.slug in staged ? { ...author, isHidden: staged[author.slug] } : author,
  );

  return (
    <>
      {owner && (
        <VisibilityBar
          publicCount={shown.filter((author) => !author.isHidden).length}
          total={shown.length}
          editing={edit.editing}
          onEdit={edit.enter}
          onExit={edit.exit}
          onSetAll={(nextShown) => stage(authors, !nextShown)}
          dirtyCount={Object.keys(staged).length}
          saving={saving}
          onSave={save}
        />
      )}

      <ul className={styles.authorList}>
        {shown.map((author) => (
          <li key={author.slug} className={styles.authorRow}>
            <Link to={`/authors/${author.slug}`} className={styles.authorName}>
              {author.name}
            </Link>
            <span className={styles.authorCount}>
              {author.bookCount} {pluralize(author.bookCount, 'book')}
            </span>
            {/* After the name rather than before it: the row reads as the
                author first, then what is done with them. */}
            {owner && edit.editing && (
              <PublicTick
                shown={!author.isHidden}
                onChange={(next) => stage([author], !next)}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
