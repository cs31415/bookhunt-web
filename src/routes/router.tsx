import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shared/layout/AppShell';
import { ComponentGallery } from '../features/dev-gallery/ComponentGallery';
import { DiscoverPage } from '../features/discover/DiscoverPage';
import { SearchPage } from '../features/search/SearchPage';
import { BookDetailPage } from '../features/book-detail/BookDetailPage';

// Plain inline placeholders until Phases 2-6 add the remaining real features/* pages.
const discoverElement = <DiscoverPage />;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: discoverElement },
      { path: 'search', element: <SearchPage /> },
      { path: 'books/:slug', element: <BookDetailPage /> },
      { path: 'authors/:slug', element: <div>Author</div> },
      { path: 'library', element: <div>Library</div> },
      { path: 'login', element: <div>Login</div> },
      { path: 'register', element: <div>Register</div> },
      // Dev-only visual check for the LOS-76 design system, stripped from production builds.
      ...(import.meta.env.DEV ? [{ path: '__gallery', element: <ComponentGallery /> }] : []),
      // Unknown routes fall back to Discover rather than a 404 (LOS-75 AC6).
      { path: '*', element: discoverElement },
    ],
  },
]);
