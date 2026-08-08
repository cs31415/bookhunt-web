import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/AuthContext';
import { BackArrowIcon, LogoMark, UserIcon } from '../icons';
import { useNavItems } from '../nav-items';
import styles from './TopBar.module.css';

function isActivePath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

function AccountMenu() {
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

  if (!isAuthenticated) {
    // The avatar alone only ever offered sign-in, which left a first-time
    // reader with no way into the app at all (LOS-219).
    return (
      <div className={`${styles.account} ${styles.accountPushRight}`}>
        <Link to="/register" className={styles.signUp}>
          Sign up
        </Link>
        <Link to="/login" className={styles.avatar} aria-label="Sign in">
          <UserIcon className={styles.avatarIcon} />
        </Link>
      </div>
    );
  }

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/');
  }

  return (
    <div className={`${styles.account} ${styles.accountPushRight}`} ref={containerRef}>
      {user && <span className={styles.greeting}>Hello, {firstNameOf(user.displayName)}</span>}
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

export function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navItems = useNavItems();

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
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={active ? `${styles.navLink} ${styles.active}` : styles.navLink}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <AccountMenu />
    </header>
  );
}
