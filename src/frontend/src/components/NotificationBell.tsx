import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import api from '../api/client';
import './NotificationBell.css';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  userId: string;
  role: 'buyer' | 'seller';
}

export function NotificationBell({ userId, role }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Create a ref for the audio object so it persists
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    // A subtle pop sound to play
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.3; // subtle volume
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get(`/notifications?userId=${userId}&role=${role}`);
      const data = response.data;
      if (Array.isArray(data)) {
        setNotifications(prev => {
          // Play sound if there is a new unread notification that we didn't have before
          const newUnreadCount = data.filter(n => !n.isRead).length;
          const prevUnreadCount = prev.filter(n => !n.isRead).length;
          
          if (newUnreadCount > prevUnreadCount) {
             audioRef.current?.play().catch(e => console.error('Audio play failed', e));
          }
          return data;
        });
      }
    } catch (e) {
      console.error('Failed to fetch notifications');
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [userId, role]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error('Failed to mark notification read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(`/notifications/read-all`, { userId, role });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error('Failed to mark all read');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="nb-container" ref={containerRef}>
      <button 
        className="nb-icon-btn m3-btn m3-btn-icon" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Bell size={24} color="var(--md-sys-color-on-surface)" />
        {unreadCount > 0 && <span className="nb-dot"></span>}
      </button>

      {isOpen && (
        <div className="nb-popover m3-surface-container">
          <div className="nb-header">
            <h3 className="m3-label-large">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                className="nb-mark-all m3-btn m3-btn-text m3-btn-sm" 
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="nb-list">
            {notifications.length === 0 ? (
              <div className="nb-empty m3-body-small">No new notifications</div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={`nb-item ${notif.isRead ? 'nb-item-read' : 'nb-item-unread'}`}
                  onClick={() => !notif.isRead && markAsRead(notif.id)}
                >
                  <div className="nb-item-title m3-label-medium">{notif.title}</div>
                  <div className="nb-item-msg m3-body-small">{notif.message}</div>
                  <div className="nb-item-time m3-label-small">
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {!notif.isRead && <div className="nb-item-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
