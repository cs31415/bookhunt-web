import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shared/layout/AppShell';

// Plain inline placeholders until Phases 2-6 add the real features/* pages.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <div>Discover</div> },
      { path: 'search', element: <div>Search</div> },
      { path: 'books/:slug', element: <div>Book Detail</div> },
      { path: 'authors/:slug', element: <div>Author</div> },
      { path: 'library', element: <div>Library</div> },
      { path: 'login', element: <div>Login</div> },
      { path: 'register', element: <div>Register</div> },
    ],
  },
]);
