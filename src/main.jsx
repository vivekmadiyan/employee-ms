import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import AuthProvider from './context/AuthProvider';
import { ThemeProvider } from './context/ThemeContext';
import WorkspaceSettingsProvider from './context/WorkspaceSettingsContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceSettingsProvider><App /></WorkspaceSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
