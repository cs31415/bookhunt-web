import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/AuthContext';
import { useThemeChoice } from '../../theme/ThemeContext';
import type { ThemeChoice } from '../../theme/theme';
import { BackArrowIcon, LogoMark, MenuIcon, MoonIcon, SunIcon, SystemThemeIcon, UserIcon } from '../icons';
import { useNavItems } from '../nav-items';
import { useDismissOnOutside } from '../use-dismiss-on-outside';
import styles from './TopBar.module.css';

/**
 * Three states, not two. "System" means keep following the machine, which a
 * light/dark switch cannot say -- and collapsing it would freeze a reader to
 * whichever mode their machine happens to be in today.
 *
 * So the button cycles rather than toggles, in the order a reader would reach
 * for: an explicit choice first, the deferral last.
 */
const THEME_CYCLE: { choice: ThemeChoice; label: string; Icon: typeof SunIcon }[] = [
  { choice: 'light', label: 'Light', Icon: SunIcon },
  { choice: 'dark', label: 'Dark', Icon: MoonIcon },
  { choice: 'system', label: 'System', Icon: SystemThemeIcon },
];

function ThemeToggle() {
  const { choice, setChoice } = useThemeChoice();

  const index = Math.max(
    THEME_CYCLE.findIndex((state) => state.choice === choice),
    0,
  );
  const current = THEME_CYCLE[index];
  const next = THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
  const { Icon } = current;

  return (
    <button
      type="button"
      className={styles.themeToggle}
      // Both halves said aloud: an icon can show which state is on, but not
      // that there is a third, nor which one a click will bring.
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      // The tooltip names only the state that is on. It appears under a
      // pointer, which has the icon in view and the next click a moment away,
      // so the rest is answered faster by trying it than by reading it.
      title={current.label}
      onClick={() => setChoice(next.choice)}
    >
      <Icon className={styles.themeIcon} />
    </button>
  );
}

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
    // One door, named in words. A Sign up link beside it would repeat what the
    // sign-in page already offers at the foot of its form (LOS-286), and the
    // word alone answers what the bare avatar could not (LOS-219).
    return (
      <div className={`${styles.account} ${styles.accountPushRight}`}>
        <Link to="/login" className={styles.signIn}>
          Sign in
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
              Profile
            </Link>
          )}
          {/* Beside Profile rather than in the nav: both are the reader's own
              things, and the nav is for where the app takes you. */}
          <Link
            to="/favorites"
            role="menuitem"
            className={styles.accountItem}
            onClick={() => setOpen(false)}
          >
            Favourites
          </Link>
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
      {/* Beside the account rather than in its menu: the theme is changed on
          sight of a page, and a control you have to open a menu to find is one
          you reach for after deciding to look for it. */}
      <ThemeToggle />
      <NavMenu />
    </header>
  );
}
