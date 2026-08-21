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
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { SharedProfilePage } from '../features/profile/SharedProfilePage';
import { FavoritesPage } from '../features/favorites/FavoritesPage';

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
      // Above the :handle route, and safe there: 'favorites' is a reserved
      // handle in the API, so nobody can hold the name this shadows.
      {
        path: 'favorites',
        element: (
          <RequireAuth>
            <FavoritesPage />
          </RequireAuth>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        ),
      },
      // Messaging is shelved (LOS-261). features/messages/ is intact; only the
      // two routes are gone, so /messages falls through to the profile route
      // and shows "no such profile" -- which is true, since 'messages' is a
      // reserved handle nobody can hold.
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      // Target of the link in the sign-up email. Unauthenticated by definition:
      // verifying is what produces the session (LOS-219).
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      // Dev-only visual check for the LOS-76 design system, stripped from production builds.
      ...(import.meta.env.DEV ? [{ path: '__gallery', element: <ComponentGallery /> }] : []),
      // The unlisted address (LOS-305). Above ':handle', and safe there for the
      // same reason 'favorites' is: 's' is a reserved handle in the API, so
      // nobody can hold the name this shadows. Listed nowhere -- the only thing
      // that produces one of these URLs is the owner's own copy button.
      { path: 's/:token', element: <SharedProfilePage /> },
      // The bare root path is the public profile: bookhunt.net/<handle>.
      // React Router ranks static segments above dynamic ones, so every route
      // above still wins — but the reserved-handle list in the API is what
      // stops a reader claiming a name a future top-level route will need.
      { path: ':handle', element: <ProfilePage /> },
      // Unknown routes fall back to Discover rather than a 404 (LOS-75 AC6).
      // Only multi-segment paths reach this now; a single unknown segment is a
      // profile that does not exist, and says so.
      { path: '*', element: discoverElement },
    ],
  },
]);
