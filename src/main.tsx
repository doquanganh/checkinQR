import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LanguageProvider} from './context/LanguageContext.js';
import {ThemeProvider} from './context/ThemeContext.js';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ThemeProvider>
);
