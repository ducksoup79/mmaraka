import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './marketplace-preview.jsx';

const root = document.getElementById('root');
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
