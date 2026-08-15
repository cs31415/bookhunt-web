import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/AuthContext';
import { BackArrowIcon, LogoMark, MenuIcon, UserIcon } from '../icons';
import { useNavItems } from '../nav-items';
import { useDismissOnOutside } from '../use-dismiss-on-outside';
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

  useDismissOnOutside(open, containerRef, () => setOpen(false));

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
          {user?.handle && (
            <Link
              to={`/${user.handle}`}
              role="menuitem"
              className={styles.accountItem}
              onClick={() => setOpen(false)}
            >
              My profile
            </Link>
          )}
          <Link
            to="/settings"
            role="menuitem"
            className={styles.accountItem}
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button type="button" role="menuitem" className={styles.accountItem} onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The primary nav on narrow screens, where .nav is hidden.
 *
 * Replaces the fixed bottom tab bar (LOS-235). That bar spent a permanent strip
 * of a short screen on two links, one of which is absent until the reader has
 * searched — so most of the time it was a full-width bar holding a single entry.
 */
function NavMenu() {
  const { pathname } = useLocation();
  const navItems = useNavItems();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismissOnOutside(open, containerRef, () => setOpen(false));

  return (
    <div className={styles.navMenu} ref={containerRef}>
      <button
        type="button"
        className={styles.menuButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((value) => !value)}
      >
        <MenuIcon className={styles.menuIcon} />
      </button>
      {open && (
        <nav aria-label="Primary" className={styles.menuPanel}>
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.path);
            const { Icon } = item;
            return (
              <Link
                key={item.path}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={active ? `${styles.menuItem} ${styles.menuItemActive}` : styles.menuItem}
                // Navigating leaves the panel mounted otherwise: the route
                // changes under it and it stays open over the new page.
                onClick={() => setOpen(false)}
              >
                <Icon className={styles.menuItemIcon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
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
      <NavMenu />
    </header>
  );
}
