import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  CheckSquare,
  Radio,
  X,
  ChevronRight,
} from 'lucide-react';
import { realtimeService } from '../../services/realtime.js';
import { DomainEvent } from '@aquasentinel/shared';

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'INCIDENT' | 'RECOMMENDATION' | 'TASK' | 'FHIR' | 'SYSTEM';
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  linkTarget?: {
    tab: 'incidents' | 'recommendations' | 'tasks' | 'evidence' | 'health';
    id?: string;
  };
  read: boolean;
}

interface NotificationCenterProps {
  onNavigate?: (tab: any, id?: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [activeToast, setActiveToast] = useState<InAppNotification | null>(null);

  useEffect(() => {
    // Subscribe to domain events from realtimeService
    const unsubscribe = realtimeService.subscribeAll((event: DomainEvent) => {
      let newNotif: InAppNotification | null = null;
      const now = new Date().toISOString();

      if (event.eventType === 'IncidentCreated' || event.eventType === 'IncidentStateChanged') {
        const payload = (event.payload as any) || {};
        const incident = payload.incident;
        const severity = incident?.severity || 'HIGH';
        newNotif = {
          id: event.eventId,
          title: `Incident Alert: ${severity}`,
          message: `${incident?.hazardType?.replace(/_/g, ' ') || 'Environmental Anomaly'} reported on monitored reach.`,
          timestamp: event.timestamp || now,
          type: 'INCIDENT',
          severity: severity,
          linkTarget: { tab: 'incidents', id: incident?.id },
          read: false,
        };
      } else if (event.eventType === 'RecommendationGenerated') {
        const payload = (event.payload as any) || {};
        newNotif = {
          id: event.eventId,
          title: 'Recommendations Ready for Review',
          message: `${payload.recommendations?.length || 'New'} candidate intervention measures awaiting supervisory review.`,
          timestamp: event.timestamp || now,
          type: 'RECOMMENDATION',
          severity: 'HIGH',
          linkTarget: { tab: 'recommendations', id: payload.incidentId },
          read: false,
        };
      } else if (event.eventType === 'TaskCreated') {
        const payload = (event.payload as any) || {};
        newNotif = {
          id: event.eventId,
          title: 'Operational Task Dispatched',
          message: `${payload.task?.title || 'Field operation'} assigned to ${payload.task?.assignedTo || 'technician'}.`,
          timestamp: event.timestamp || now,
          type: 'TASK',
          severity: 'MEDIUM',
          linkTarget: { tab: 'tasks', id: payload.task?.id },
          read: false,
        };
      } else if (event.eventType === 'TaskStatusUpdated') {
        const payload = (event.payload as any) || {};
        newNotif = {
          id: event.eventId,
          title: `Task Status: ${payload.newStatus}`,
          message: `Task updated by ${payload.actor || 'field officer'}.`,
          timestamp: event.timestamp || now,
          type: 'TASK',
          severity: 'INFO',
          linkTarget: { tab: 'tasks', id: payload.taskId },
          read: false,
        };
      } else if (event.eventType === 'ObservationReceived') {
        const payload = (event.payload as any) || {};
        const obs = payload.observation;
        newNotif = {
          id: event.eventId,
          title: 'Observation Ingested',
          message: `${obs?.source || 'Sensor'} recorded ${obs?.indicator || 'metric'} (${obs?.value ?? ''}).`,
          timestamp: event.timestamp || now,
          type: 'SYSTEM',
          severity: 'INFO',
          linkTarget: { tab: 'dashboard' as any },
          read: false,
        };
      }

      if (newNotif) {
        setNotifications((prev) => [newNotif!, ...prev.slice(0, 49)]);
        setActiveToast(newNotif);
        const timer = setTimeout(() => {
          setActiveToast((curr) => (curr?.id === newNotif?.id ? null : curr));
        }, 5000);
        return () => clearTimeout(timer);
      }
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (notif: InAppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (notif.linkTarget && onNavigate) {
      onNavigate(notif.linkTarget.tab, notif.linkTarget.id);
      setIsOpen(false);
    }
  };

  const getNotifIcon = (type: InAppNotification['type'], severity?: string) => {
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      return <AlertTriangle size={15} className="text-rose-400" />;
    }
    switch (type) {
      case 'INCIDENT':
        return <AlertTriangle size={15} className="text-amber-400" />;
      case 'RECOMMENDATION':
        return <Sparkles size={15} className="text-cyan-400" />;
      case 'TASK':
        return <CheckSquare size={15} className="text-blue-400" />;
      case 'FHIR':
        return <Radio size={15} className="text-purple-400" />;
      default:
        return <CheckCircle2 size={15} className="text-slate-400" />;
    }
  };

  return (
    <div className="relative">
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        title="Operational Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-500 text-white font-mono text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Operational Alerts
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-700">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-slate-500 hover:text-blue-600 font-medium transition"
                  >
                    Read All
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-medium transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto divide-y divide-slate-100 p-1 flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No notifications recorded.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 rounded-xl transition cursor-pointer flex items-start gap-3 ${
                      n.read
                        ? 'bg-transparent hover:bg-slate-50 text-slate-500'
                        : 'bg-blue-50/40 hover:bg-blue-50/70 text-slate-900 border-l-2 border-blue-600'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {getNotifIcon(n.type, n.severity)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    <ChevronRight size={14} className="text-slate-300 mt-1 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Floating Toast Notification */}
      {activeToast && !isOpen && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white border border-blue-200/90 rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-slide-in">
          <div className="mt-0.5 shrink-0">{getNotifIcon(activeToast.type, activeToast.severity)}</div>
          <div
            className="flex-1 cursor-pointer"
            onClick={() => handleNotificationClick(activeToast)}
          >
            <div className="text-xs font-bold text-slate-900">{activeToast.title}</div>
            <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{activeToast.message}</div>
            <div className="text-[10px] text-blue-600 font-semibold mt-1">Click to view details →</div>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
