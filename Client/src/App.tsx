import { BrowserRouter } from 'react-router-dom';
import { ThemeModeProvider } from './theme/ThemeModeContext';
import { AppRoutes } from './routes/routes';

function App() {
  return (
    <ThemeModeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeModeProvider>
  );
}

export default App;
