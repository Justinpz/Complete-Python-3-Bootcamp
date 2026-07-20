import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/teko/600.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import './theme.css';
import App from './App.jsx';
import { useStore } from './store/store.js';
import { initPersistence } from './store/persistence.js';

initPersistence(useStore);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
