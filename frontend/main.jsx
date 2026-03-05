/**
 * Web app entry: route by pathname to ResetPasswordPage, VerifyEmailPage, or main App.
 * No React Router; reset/verify are standalone pages; everything else is the SPA in marketplace-preview.jsx.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './marketplace-preview.jsx';
import ResetPasswordPage from './ResetPasswordPage.jsx';
import VerifyEmailPage from './VerifyEmailPage.jsx';

const pathname = window.location.pathname;
const isResetPage = pathname === '/reset-password' || pathname === '/reset-password/';
const isVerifyPage = pathname === '/verify-email' || pathname === '/verify-email/';

const root = document.getElementById('root');
createRoot(root).render(
  <React.StrictMode>
    {isVerifyPage ? <VerifyEmailPage /> : isResetPage ? <ResetPasswordPage /> : <App />}
  </React.StrictMode>
);
