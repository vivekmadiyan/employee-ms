import React, { useContext, useState } from 'react';
import Login from './components/Auth/Login';
import LandingPage from './components/Auth/LandingPage';
import RegisterCompany from './components/Auth/RegisterCompany';
import AcceptInvitation from './components/Auth/AcceptInvitation';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import EmployeeDashboard from './components/Dashboard/EmployeeDashboard';
import AdminDashboard from './components/Dashboard/AdminDashboard';
import { AuthContext } from './context/AuthProvider';
import './App.css';

const App = () => {
  const { currentUser, logout, loading } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  if (loading) return <div className="app-loading" role="status"><span className="app-loading-mark">E</span><span>Loading your workspace…</span></div>;
  if (!currentUser) {
    const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)$/);
    if (inviteMatch) return <AcceptInvitation token={inviteMatch[1]} onBack={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }} />;
    const resetMatch = window.location.pathname.match(/^\/reset-password\/([^/]+)$/);
    if (resetMatch) return <ResetPassword token={resetMatch[1]} onBack={() => { window.history.replaceState({}, '', '/'); setShowLogin(true); }} />;
    if (showForgotPassword || window.location.pathname === '/forgot-password') return <ForgotPassword onBack={() => { window.history.replaceState({}, '', '/'); setShowForgotPassword(false); setShowLogin(true); }} />;
    if (showRegister) return <RegisterCompany onBack={() => setShowRegister(false)} onLogin={() => { setShowRegister(false); setShowLogin(true); }} />;
    if (showLogin) return <Login onBack={() => setShowLogin(false)} onForgotPassword={() => setShowForgotPassword(true)} />;
    return <LandingPage onLogin={() => setShowLogin(true)} onRegister={() => setShowRegister(true)} />;
  }
  return currentUser.role === 'admin'
    ? <AdminDashboard changeUser={logout} data={currentUser} />
    : <EmployeeDashboard changeUser={logout} data={currentUser} />;
};
export default App;
