import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FaArrowRightFromBracket, FaBell, FaBuilding, FaGear, FaLayerGroup } from 'react-icons/fa6';
import { getNotificationsApi, markAllNotificationsReadApi, markNotificationReadApi, subscribeNotificationsApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import AccountSettings from './AccountSettings';

const Header = ({ changeUser, data }) => {
  const { currentUser } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  return (
    <>
      <header className="flex min-h-[76px] items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="header-brand-mark" aria-hidden="true"><FaLayerGroup /></div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <FaBuilding className="shrink-0 text-[10px]" />
              {data?.companyName || 'Company Workspace'}
            </p>
            <h1 className="mt-1 truncate text-base font-semibold tracking-tight text-slate-700 sm:text-lg">
              Welcome back, <span className="font-extrabold text-slate-950">{currentUser?.firstName || data?.firstName || 'User'}</span>
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(open => !open)}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={showNotifications}
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <FaBell aria-hidden="true" />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-extrabold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {showNotifications && (
              <section className="absolute right-0 z-30 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" aria-label="Notifications">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div><h2 className="text-sm font-extrabold text-slate-900">Notifications</h2><p className="text-[11px] text-slate-500">{unreadCount} unread</p></div>
                  {unreadCount > 0 && <button type="button" onClick={markAllRead} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Mark all read</button>}
                </div>
                {notificationError && <p role="alert" className="px-4 py-2 text-xs text-rose-700">{notificationError}</p>}
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length ? notifications.map(notification => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => markRead(notification)}
                      className={`block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${notification.readAt ? 'bg-white' : 'bg-indigo-50/50'}`}
                    >
                      <span className="flex items-start gap-2">
                        {!notification.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold leading-5 text-slate-800">{notification.message}</span>
                          <time className="mt-1 block text-[10px] text-slate-400" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                        </span>
                      </span>
                    </button>
                  )) : <p className="px-4 py-9 text-center text-xs text-slate-500">You’re all caught up.</p>}
                </div>
              </section>
            )}
          </div>
          <button type="button" onClick={() => { setShowNotifications(false); setShowSettings(true); }} aria-label="Account settings" aria-haspopup="dialog" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50">
            <FaGear aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={logOutUser}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:px-4 sm:text-sm"
          >
            <FaArrowRightFromBracket aria-hidden="true" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>
      {showSettings && <AccountSettings onClose={closeSettings} />}
    </>
  );
};

export default Header;
