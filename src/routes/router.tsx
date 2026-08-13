import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shared/layout/AppShell';
import { ComponentGallery } from '../features/dev-gallery/ComponentGallery';
import { DiscoverPage } from '../features/discover/DiscoverPage';
import { SearchPage } from '../features/search/SearchPage';
import { BookDetailPage } from '../features/book-detail/BookDetailPage';
import { AuthorPage } from '../features/author/AuthorPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { LibraryPage } from '../features/library/LibraryPage';

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
      { path: 'authors/:slug', element: <AuthorPage /> },
      {
        path: 'library',
        element: (
          <RequireAuth>
            <LibraryPage />
          </RequireAuth>
        ),
      },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      // Target of the link in the sign-up email. Unauthenticated by definition:
      // verifying is what produces the session (LOS-219).
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      // Dev-only visual check for the LOS-76 design system, stripped from production builds.
      ...(import.meta.env.DEV ? [{ path: '__gallery', element: <ComponentGallery /> }] : []),
      // Unknown routes fall back to Discover rather than a 404 (LOS-75 AC6).
      { path: '*', element: discoverElement },
    ],
  },
]);
