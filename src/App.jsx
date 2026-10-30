import React, { useContext, useState } from 'react';
import Login from './components/Auth/Login';
import LandingPage from './components/Auth/LandingPage';
import RegisterCompany from './components/Auth/RegisterCompany';
import AcceptInvitation from './components/Auth/AcceptInvitation';
import EmployeeDashboard from './components/Dashboard/EmployeeDashboard';
import AdminDashboard from './components/Dashboard/AdminDashboard';
import { AuthContext } from './context/AuthProvider';
import './App.css';

const App = () => {
  const { currentUser, logout, loading } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  if (loading) return <div className="min-h-screen grid place-items-center bg-neutral-100 text-neutral-500">Loading EmployeeMS…</div>;
  if (!currentUser) {
    const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)$/);
    if (inviteMatch) return <AcceptInvitation token={inviteMatch[1]} onBack={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }} />;
    if (showRegister) return <RegisterCompany onBack={() => setShowRegister(false)} onLogin={() => { setShowRegister(false); setShowLogin(true); }} />;
    if (showLogin) return <Login onBack={() => setShowLogin(false)} />;
    return <LandingPage onLogin={() => setShowLogin(true)} onRegister={() => setShowRegister(true)} />;
  }
  return currentUser.role === 'admin'
    ? <AdminDashboard changeUser={logout} data={currentUser} />
    : <EmployeeDashboard changeUser={logout} data={currentUser} />;
};
export default App;
