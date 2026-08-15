import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ThemeProvider } from './shared/theme/ThemeContext';
import { router } from './routes/router';

function App() {
  return (
    // ThemeProvider inside AuthProvider: it adopts the signed-in reader's
    // stored theme, and saves a change back to them.
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
