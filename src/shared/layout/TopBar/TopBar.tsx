import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { BackArrowIcon, LogoMark, UserIcon } from '../icons';
import { NAV_ITEMS } from '../nav-items';
import styles from './TopBar.module.css';

function isActivePath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function SearchField({
  initialQuery,
  onSubmit,
}: {
  initialQuery: string;
  onSubmit: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);

  return (
    <div className={styles.searchForm}>
      <SearchBar value={query} onChange={setQuery} onSubmit={onSubmit} placeholder="Search…" />
    </div>
  );
}

export function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  return (
    <header className={styles.bar}>
      <button type="button" className={styles.back} aria-label="Back" onClick={() => navigate(-1)}>
        <BackArrowIcon className={styles.backIcon} />
      </button>

      <Link to="/" className={styles.brand}>
        <LogoMark light className={styles.logo} />
        <span className={styles.wordmark}>BookHunt</span>
      </Link>

      <nav aria-label="Primary" className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={active ? `${styles.navLink} ${styles.active}` : styles.navLink}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {pathname !== '/' && (
        <SearchField
          key={initialQuery}
          initialQuery={initialQuery}
          onSubmit={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
        />
      )}

      <div
        className={pathname === '/' ? `${styles.avatar} ${styles.avatarPushRight}` : styles.avatar}
        aria-label="Account"
      >
        <UserIcon className={styles.avatarIcon} />
      </div>
    </header>
  );
}
