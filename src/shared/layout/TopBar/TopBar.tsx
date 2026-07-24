import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../features/auth/AuthContext';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { BackArrowIcon, LogoMark, UserIcon } from '../icons';
import { NAV_ITEMS } from '../nav-items';
import styles from './TopBar.module.css';

function isActivePath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function AccountMenu({ pushRight }: { pushRight: boolean }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const avatarClass = pushRight ? `${styles.avatar} ${styles.avatarPushRight}` : styles.avatar;

  if (!isAuthenticated) {
    return (
      <Link to="/login" className={avatarClass} aria-label="Sign in">
        <UserIcon className={styles.avatarIcon} />
      </Link>
    );
  }

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/');
  }

  return (
    <div
      className={pushRight ? `${styles.account} ${styles.accountPushRight}` : styles.account}
      ref={containerRef}
    >
      <button
        type="button"
        className={`${styles.avatar} ${styles.avatarButton}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((value) => !value)}
      >
        <UserIcon className={styles.avatarIcon} />
      </button>
      {open && (
        <div className={styles.accountMenu} role="menu">
          {user && <p className={styles.accountName}>{user.displayName}</p>}
          <button type="button" role="menuitem" className={styles.accountItem} onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
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

      <AccountMenu pushRight={pathname === '/'} />
    </header>
  );
}
