import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import './i18n';
import iconSprite from './assets/icons.svg?raw';
import { queryClient } from './config/query-client';
import { ThemeProvider } from './contexts/theme-context';
import { ToastProvider } from './contexts/toast-context';
import { CartProvider } from './features/cart/cart-context';
import { App } from './App';

// Inject the SVG sprite once so <use href="#icon-..."> resolves app-wide.
function mountIconSprite() {
  if (document.getElementById('sbay-icon-sprite')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'sbay-icon-sprite';
  wrapper.innerHTML = iconSprite;
  document.body.prepend(wrapper);
}
mountIconSprite();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
