import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AppErrorBoundary, TooltipProvider } from '@monitoring/ui';
import './index.css';
import { clearSession } from './state/client';
import { AuthProvider } from './auth/auth';
import { AppStateProvider } from './state/app-state';
import { ApiProvider } from './state/api';
import { router } from './router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary onReset={() => { clearSession(); window.location.assign('/login'); }}>
      <AuthProvider>
        <AppStateProvider>
          <ApiProvider>
            <TooltipProvider delayDuration={200}>
              <RouterProvider router={router} />
            </TooltipProvider>
          </ApiProvider>
        </AppStateProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
