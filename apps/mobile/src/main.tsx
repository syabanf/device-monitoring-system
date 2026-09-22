import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AppErrorBoundary, TooltipProvider } from '@monitoring/ui';
import './index.css';
import { clearSession } from './state/client';
import { AppStateProvider } from './state/app-state';
import { AuthProvider } from './auth/auth';
import { router } from './router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary onReset={() => { clearSession(); window.location.assign('/login'); }}>
      <AppStateProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <RouterProvider router={router} />
          </TooltipProvider>
        </AuthProvider>
      </AppStateProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
