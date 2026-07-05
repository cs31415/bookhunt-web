import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../nav-items';
import styles from './MobileNav.module.css';

function isActivePath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

export function MobileNav() {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Primary" className={styles.bar}>
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.path);
        const { Icon } = item;
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? 'page' : undefined}
            className={active ? `${styles.item} ${styles.active}` : styles.item}
          >
            <Icon className={styles.icon} />
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
