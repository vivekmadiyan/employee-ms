import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaArrowRightFromBracket, FaBell, FaGear, FaLayerGroup, FaMoon, FaSun } from 'react-icons/fa6';
import { getNotificationsApi, getTasksApi, markAllNotificationsReadApi, markNotificationReadApi, subscribeNotificationsApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import { useTheme } from '../../context/ThemeContext';
import AccountSettings from './AccountSettings';

const Header = ({ changeUser, data, onOpenTask }) => {
  const { currentUser } = useContext(AuthContext);
  const { darkMode, toggleDark } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState('');
  const [taskOpenError, setTaskOpenError] = useState('');
  const [openingTask, setOpeningTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const notifRef = useRef(null);
  const notifButton = useRef(null);
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

  const openNotification = async notification => {
    setTaskOpenError('');
    if (!notification.taskId || !onOpenTask) return markRead(notification);
    setOpeningTask(true);
    try {
      const [tasks] = await Promise.all([getTasksApi({ taskId: notification.taskId }), markRead(notification)]);
      const task = tasks.find(item => item.id === notification.taskId);
      if (!task) {
        setTaskOpenError('This task is no longer available.');
        return;
      }
      await onOpenTask(task);
      setShowNotifications(false);
    } catch (error) {
      setTaskOpenError(error.message || 'Could not open this task.');
    } finally {
      setOpeningTask(false);
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

  const logOutUser = async () => {
    setSignOutError('');
    setSigningOut(true);
    try {
      await changeUser();
    } catch {
      setSignOutError('Could not end your session. Try logging out again.');
    } finally {
      setSigningOut(false);
    }
  };

  const userName = currentUser?.firstName || data?.firstName || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = currentUser?.role || data?.role || 'employee';

  return (
    <>
      <header className="workspace-toolbar">
        <div className="workspace-identity">
          <span className="workspace-mark"><FaLayerGroup aria-hidden="true" /></span>
          <div className="workspace-identity-text">
            <strong>{data?.companyName || 'Workspace'}</strong>
            <span>{userName} <span aria-hidden="true">·</span> {userRole === 'admin' ? 'Admin' : 'Employee'}</span>
          </div>
        </div>

        {/* Right Actions: Notifications, Settings, Profile, Logout */}
        <div className="workspace-tools">
          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef} onKeyDown={event => {
            if (event.key === 'Escape' && showNotifications) {
              setShowNotifications(false);
              notifButton.current?.focus();
            }
          }}>
            <button
              type="button"
              ref={notifButton}
              onClick={() => setShowNotifications(open => !open)}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={showNotifications}
              className="workspace-icon workspace-icon--notifications"
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
                className="notification-panel absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 transition-all animate-fade-in"
                aria-label="Notifications" aria-busy={openingTask}
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

                {(taskOpenError || notificationError) && (
                  <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                    {taskOpenError || notificationError}
                  </p>
                )}

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length ? notifications.map(notification => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      disabled={openingTask}
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
                        {notification.taskId && onOpenTask && <FaArrowRight className="mt-1 shrink-0 text-xs text-slate-500" aria-hidden="true" />}
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
            className="workspace-icon"
          >
            <FaGear className="text-sm" aria-hidden="true" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDark}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="workspace-icon"
          >
            {darkMode ? <FaSun className="text-sm text-amber-500" aria-hidden="true" /> : <FaMoon className="text-sm" aria-hidden="true" />}
          </button>

          {/* User Initials Avatar */}
          <div 
            className="workspace-avatar"
            aria-hidden="true"
            title={userName}
          >
            {userInitial}
          </div>

          {/* Log out */}
          <button
            type="button"
            onClick={logOutUser}
            aria-label="Log out"
            disabled={signingOut}
            className="workspace-icon workspace-icon--logout"
          >
            <FaArrowRightFromBracket aria-hidden="true" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>
      {signOutError && <p className="px-2 pb-2 text-xs text-rose-700" role="alert">{signOutError}</p>}
      {showSettings && <AccountSettings onClose={closeSettings} />}
    </>
  );
};

export default Header;
