import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/main.scss';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root non trovato.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
