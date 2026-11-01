import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FaArrowRightFromBracket, FaBell, FaBuilding, FaGear, FaLayerGroup, FaMoon, FaSun } from 'react-icons/fa6';
import { getNotificationsApi, markAllNotificationsReadApi, markNotificationReadApi, subscribeNotificationsApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import { useTheme } from '../../context/ThemeContext';
import AccountSettings from './AccountSettings';

const Header = ({ changeUser, data }) => {
  const { currentUser } = useContext(AuthContext);
  const { darkMode, toggleDark } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const notifRef = useRef(null);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  const refreshNotifications = async () => {
    try {
      const result = await getNotificationsApi();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  useEffect(() => {
    return subscribeNotificationsApi(
      result => {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        setNotificationError('');
      },
      setNotificationError
    );
  }, []);

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handleClickOutside = event => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const markRead = async notification => {
    if (notification.readAt) return;
    try {
      await markNotificationReadApi(notification.id);
      await refreshNotifications();
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      await refreshNotifications();
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  const logOutUser = () => {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    changeUser();
  };

  const userName = currentUser?.firstName || data?.firstName || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = currentUser?.role || data?.role || 'employee';

  return (
    <>
      <header className="flex min-h-[72px] items-center justify-between gap-4 py-3">
        {/* Brand & Workspace info */}
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-500/20" aria-hidden="true">
            <FaLayerGroup className="text-base" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <FaBuilding className="text-[10px] text-slate-400" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{data?.companyName || 'Workspace'}</span>
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                userRole === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {userRole}
              </span>
            </div>
            
            <h1 className="mt-1 truncate text-sm font-semibold text-slate-700 sm:text-base">
              Welcome back, <span className="font-bold text-slate-900">{userName}</span>
            </h1>
          </div>
        </div>

        {/* Right Actions: Notifications, Settings, Profile, Logout */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(open => !open)}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={showNotifications}
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                showNotifications 
                  ? 'border-indigo-300 bg-indigo-50/60 text-indigo-600 shadow-sm' 
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <FaBell className="text-sm" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <section 
                className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 transition-all animate-fade-in" 
                aria-label="Notifications"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Notifications</h2>
                    <p className="text-[11px] text-slate-500">{unreadCount} unread alert{unreadCount === 1 ? '' : 's'}</p>
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      type="button" 
                      onClick={markAllRead} 
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notificationError && (
                  <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                    {notificationError}
                  </p>
                )}

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length ? notifications.map(notification => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => markRead(notification)}
                      className={`block w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                        notification.readAt ? 'bg-white' : 'bg-indigo-50/30'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {!notification.readAt ? (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600 shadow-sm" />
                        ) : (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-200" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 leading-snug">{notification.message}</p>
                          <time className="mt-1 block text-[10px] text-slate-400" dateTime={notification.createdAt}>
                            {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(notification.createdAt).toLocaleDateString()}
                          </time>
                        </div>
                      </div>
                    </button>
                  )) : (
                    <div className="px-4 py-10 text-center">
                      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <FaBell className="text-xs" />
                      </div>
                      <p className="text-xs font-medium text-slate-500">You&apos;re all caught up</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">No new notifications at this time.</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Account Settings Trigger */}
          <button 
            type="button" 
            onClick={() => { setShowNotifications(false); setShowSettings(true); }} 
            aria-label="Account settings" 
            aria-haspopup="dialog" 
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <FaGear className="text-sm" aria-hidden="true" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDark}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {darkMode ? <FaSun className="text-sm text-amber-500" aria-hidden="true" /> : <FaMoon className="text-sm" aria-hidden="true" />}
          </button>

          {/* User Initials Avatar */}
          <div 
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-sm ring-1 ring-black/5" 
            title={userName}
          >
            {userInitial}
          </div>

          {/* Log out */}
          <button
            type="button"
            onClick={logOutUser}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <FaArrowRightFromBracket className="text-xs text-slate-400" aria-hidden="true" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>
      {showSettings && <AccountSettings onClose={closeSettings} />}
    </>
  );
};

export default Header;
