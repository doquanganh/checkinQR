/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { EventItem, Role, User, EventGuest } from './types/index.js';
import { api } from './services/api.js';
import { Header } from './components/Header.js';
import { Dashboard } from './components/Dashboard.js';
import { CheckinScanner } from './components/CheckinScanner.js';
import { GuestList } from './components/GuestList.js';
import { EmailTemplateView } from './components/EmailTemplateView.js';
import { CheckinLogsView } from './components/CheckinLogsView.js';
import { InvitationModal } from './components/InvitationModal.js';
import { GuestModal } from './components/GuestModal.js';
import { ImportExportModal } from './components/ImportExportModal.js';
import { CreateEventModal } from './components/CreateEventModal.js';
import { SmtpSettingsModal } from './components/SmtpSettingsModal.js';
import { PublicTicketView } from './components/PublicTicketView.js';
import { OfflineIndicator } from './components/OfflineIndicator.js';
import { BottomNav } from './components/BottomNav.js';
import { EventSelectModal } from './components/SelectModals.js';
import { AccountModal } from './components/AccountModal.js';
import { LoginView } from './components/LoginView.js';
import { useLanguage } from './context/LanguageContext.js';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const { lang, t } = useLanguage();
  const [ticketParam, setTicketParam] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ticket') : null
  );
  const [events, setEvents] = useState<EventItem[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Signed-in user comes from the server session; the role is enforced by the API, not by this UI
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const activeRole: Role = currentUser?.role ?? 'CHECKIN_STAFF';
  const [activeTab, setActiveTab] = useState('dashboard');

  // Unified Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<EventGuest | null>(null);
  const [invitationGuest, setInvitationGuest] = useState<EventGuest | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);

  // Refresh trigger for GuestList component
  const [guestListRefreshKey, setGuestListRefreshKey] = useState(0);
  const triggerGuestListRefresh = () => {
    setGuestListRefreshKey((k) => k + 1);
  };

  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      const data = await api.getEvents();
      setEvents(data);
      if (data.length > 0 && !currentEvent) {
        setCurrentEvent(data[0]);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  // Restore the session on load; a 401 anywhere in the app drops back to the login screen
  useEffect(() => {
    api.me().then((u) => {
      setCurrentUser(u);
      setAuthChecked(true);
    });
    const expired = () => setCurrentUser(null);
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, []);

  // Staff land on the scanner; anyone signing in loads their events
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'CHECKIN_STAFF') {
      setActiveTab((tab) => (['scanner', 'logs', 'guests'].includes(tab) ? tab : 'scanner'));
    }
    setLoading(true);
    loadEvents();
  }, [currentUser?.id]);

  const handleLogout = async () => {
    await api.logout();
    setIsUserModalOpen(false);
    setCurrentEvent(null);
    setEvents([]);
    setCurrentUser(null);
  };

  // If a public web ticket link was opened (?ticket=CODE), render public ticket pass view
  if (ticketParam) {
    return (
      <PublicTicketView
        ticketCode={ticketParam}
        onBackToApp={() => {
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
          setTicketParam(null);
        }}
      />
    );
  }

  if (!authChecked) {
    return <div className="min-h-screen bg-canvas" />;
  }

  if (!currentUser) {
    return <LoginView onLoggedIn={setCurrentUser} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-canvas text-fg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4" />
        <h2 className="text-base font-bold">
          {lang === 'vi'
            ? 'Đang khởi động hệ thống Check-in Sự kiện...'
            : 'Starting Event Check-in System...'}
        </h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Offline Status Banner */}
      <OfflineIndicator />

      {/* App Header */}
      <Header
        currentEvent={currentEvent}
        events={events}
        onSelectEvent={(evt) => setCurrentEvent(evt)}
        onCreateEvent={() => setIsCreateEventOpen(true)}
        activeRole={activeRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        onOpenEventModal={() => setIsEventModalOpen(true)}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
      />

      {/* Bulk Generated Notification Toast */}
      {bannerMessage && (
        <div className="bg-emerald-600/90 text-fg px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-fg shrink-0" />
          <span>{bannerMessage}</span>
        </div>
      )}

      {/* Main Content Area (pb-36 ensures plenty of clearance above mobile bottom nav) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-36 md:pb-12">
        {currentEvent ? (
          <>
            {/* Tab: Dashboard */}
            {activeTab === 'dashboard' && (
              <Dashboard
                currentEvent={currentEvent}
                onNavigateTab={setActiveTab}
              />
            )}

            {/* Tab: Scanner (Mobile-first QR Camera check-in) */}
            {activeTab === 'scanner' && (
              <CheckinScanner currentEvent={currentEvent} currentUser={currentUser} />
            )}

            {/* Tab: Guests (1,000+ guest management) */}
            {activeTab === 'guests' && (
              <GuestList
                currentEvent={currentEvent}
                userRole={activeRole}
                refreshKey={guestListRefreshKey}
                onOpenAddModal={() => setIsAddGuestOpen(true)}
                onOpenEditModal={(eg) => setEditingGuest(eg)}
                onOpenInvitationModal={(eg) => setInvitationGuest(eg)}
                onOpenImportModal={() => setIsImportOpen(true)}
                onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
              />
            )}

            {/* Tab: Invitations & Email Template */}
            {activeTab === 'invitations' && (
              <EmailTemplateView
                currentEvent={currentEvent}
                onRefreshData={triggerGuestListRefresh}
                onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
              />
            )}

            {/* Tab: Logs (Audit trail) */}
            {activeTab === 'logs' && <CheckinLogsView currentEvent={currentEvent} />}
          </>
        ) : (
          <div className="text-center py-16 text-fg-muted">
            <p>
              {lang === 'vi'
                ? 'Chưa có sự kiện nào được chọn. Hãy tạo một sự kiện để bắt đầu!'
                : 'No event selected. Please create an event to get started!'}
            </p>
          </div>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeRole={activeRole}
        currentEvent={currentEvent}
        currentUser={currentUser}
        onOpenEventModal={() => setIsEventModalOpen(true)}
        onOpenUserModal={() => setIsUserModalOpen(true)}
      />

      {/* MODALS */}
      {/* 0. Event Selector Modal (Unified for desktop & mobile) */}
      <EventSelectModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        events={events}
        currentEvent={currentEvent}
        onSelectEvent={(evt) => setCurrentEvent(evt)}
        onCreateEvent={() => setIsCreateEventOpen(true)}
        isAdmin={activeRole === 'ADMIN'}
      />

      {/* 0.1. Account modal: profile, password, staff management (admin), sign out */}
      <AccountModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      {/* 1. Add / Edit Guest Modal */}
      {(isAddGuestOpen || editingGuest) && currentEvent && (
        <GuestModal
          currentEvent={currentEvent}
          editingGuest={editingGuest}
          onClose={() => {
            setIsAddGuestOpen(false);
            setEditingGuest(null);
          }}
          onSaved={(savedGuest) => {
            // refresh data and trigger immediate GuestList reload
            loadEvents();
            triggerGuestListRefresh();
            if (savedGuest) {
              const guestName = savedGuest.guest?.full_name || savedGuest.guest_code;
              setBannerMessage(
                lang === 'vi'
                  ? `Đã lưu khách mời thành công: ${guestName} (Mã vé: ${savedGuest.guest_code})`
                  : `Guest saved successfully: ${guestName} (${savedGuest.guest_code})`
              );
              setTimeout(() => setBannerMessage(null), 6000);
            }
          }}
        />
      )}

      {/* 2. Invitation & QR Modal */}
      {invitationGuest && currentEvent && (
        <InvitationModal
          currentEvent={currentEvent}
          eventGuest={invitationGuest}
          onClose={() => setInvitationGuest(null)}
          onInvitationSent={() => {
            loadEvents();
            triggerGuestListRefresh();
          }}
          onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
        />
      )}

      {/* 3. CSV / Excel Import Modal */}
      {isImportOpen && currentEvent && (
        <ImportExportModal
          currentEvent={currentEvent}
          onClose={() => setIsImportOpen(false)}
          onImportComplete={() => {
            loadEvents();
            triggerGuestListRefresh();
          }}
        />
      )}

      {/* 4. Create Event Modal */}
      {isCreateEventOpen && (
        <CreateEventModal
          onClose={() => setIsCreateEventOpen(false)}
          onEventCreated={(evt) => {
            setEvents((prev) => [evt, ...prev]);
            setCurrentEvent(evt);
            triggerGuestListRefresh();
          }}
        />
      )}

      {/* 5. SMTP Server Settings Modal */}
      <SmtpSettingsModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        onConfigUpdated={triggerGuestListRefresh}
      />
    </div>
  );
}
