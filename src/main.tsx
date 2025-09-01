import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext';
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext';
import { Toaster } from '@/components/ui/toaster';
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UnsavedChangesProvider>
          <App />
          <Toaster />
        </UnsavedChangesProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
