import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import OperationsApp from './operaciones/OperationsApp.jsx';
import './styles.css';

const esOperaciones =
  window.location.pathname === '/operaciones' ||
  window.location.pathname.startsWith('/operaciones/');

if (esOperaciones) {
  document.title = 'Aruca Almacén | Operaciones';
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.setAttribute('href', '/manifest-operaciones.webmanifest');
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', '#0f766e');
  const appleTitle = document.querySelector(
    'meta[name="apple-mobile-web-app-title"]'
  );
  if (appleTitle) appleTitle.setAttribute('content', 'Aruca Almacén');
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {esOperaciones ? (
        <OperationsApp />
      ) : (
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      )}
    </BrowserRouter>
  </React.StrictMode>
);
