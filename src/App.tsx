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
import { RaceConditionSimulator } from './components/RaceConditionSimulator.js';
import { InvitationModal } from './components/InvitationModal.js';
import { GuestModal } from './components/GuestModal.js';
import { ImportExportModal } from './components/ImportExportModal.js';
import { CreateEventModal } from './components/CreateEventModal.js';
import { SmtpSettingsModal } from './components/SmtpSettingsModal.js';
import { PublicTicketView } from './components/PublicTicketView.js';
import { OfflineIndicator } from './components/OfflineIndicator.js';
import { BottomNav } from './components/BottomNav.js';
import { EventSelectModal, UserSelectModal } from './components/SelectModals.js';
import { useLanguage } from './context/LanguageContext.js';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const { lang, t } = useLanguage();
  const [ticketParam, setTicketParam] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ticket') : null
  );
  const [events, setEvents] = useState<EventItem[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Available sample users
  const availableUsers: User[] = [
    {
      id: 'usr_admin',
      name: 'Nguyễn Quản Trị (Admin)',
      email: 'admin@eventhub.vn',
      role: 'ADMIN',
    },
    {
      id: 'usr_staff_01',
      name: 'Trần Nhân Viên (Staff Cổng 1)',
      email: 'staff01@eventhub.vn',
      role: 'CHECKIN_STAFF',
    },
    {
      id: 'usr_staff_02',
      name: 'Lê Soát Vé (Staff Cổng 2)',
      email: 'staff02@eventhub.vn',
      role: 'CHECKIN_STAFF',
    },
  ];

  const [currentUser, setCurrentUser] = useState<User>(availableUsers[0]);
  const [activeRole, setActiveRole] = useState<Role>('ADMIN');
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

  // Bulk 1,000 generate loading
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [isConfirmBulkGenerateOpen, setIsConfirmBulkGenerateOpen] = useState(false);
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

  useEffect(() => {
    loadEvents();
  }, []);

  // When role changes to staff, auto switch to scanner view
  const handleRoleChange = (role: Role) => {
    setActiveRole(role);
    if (role === 'CHECKIN_STAFF' && activeTab !== 'scanner' && activeTab !== 'logs' && activeTab !== 'guests') {
      setActiveTab('scanner');
    }
  };

  // Bulk 1,000 Generation
  const handleBulkGenerate = () => {
    if (!currentEvent) return;
    setIsConfirmBulkGenerateOpen(true);
  };

  const executeBulkGenerate = async () => {
    if (!currentEvent) return;
    setIsConfirmBulkGenerateOpen(false);
    setBulkGenerating(true);
    try {
      const res = await api.bulkGenerateGuests(currentEvent.id, 1000);
      setBannerMessage(res.message);
      setTimeout(() => setBannerMessage(null), 5000);
      const evts = await api.getEvents();
      setEvents(evts);
      triggerGuestListRefresh();
    } catch (err: any) {
      setBannerMessage((lang === 'vi' ? 'Lỗi: ' : 'Error: ') + err.message);
      setTimeout(() => setBannerMessage(null), 5000);
    } finally {
      setBulkGenerating(false);
    }
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Offline Status Banner */}
      <OfflineIndicator />

      {/* App Header */}
      <Header
        currentEvent={currentEvent}
        events={events}
        onSelectEvent={(evt) => setCurrentEvent(evt)}
        onCreateEvent={() => setIsCreateEventOpen(true)}
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        availableUsers={availableUsers}
        onOpenEventModal={() => setIsEventModalOpen(true)}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
      />

      {/* Bulk Generated Notification Toast */}
      {bannerMessage && (
        <div className="bg-emerald-600/90 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
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
                onOpenBulkGenerate={handleBulkGenerate}
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
                onOpenBulkGenerate={handleBulkGenerate}
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

            {/* Tab: Race Condition Tester */}
            {activeTab === 'race-test' && (
              <RaceConditionSimulator currentEvent={currentEvent} />
            )}
          </>
        ) : (
          <div className="text-center py-16 text-slate-400">
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
        onRoleChange={handleRoleChange}
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

      {/* 0.1. User & Role Selector Modal */}
      <UserSelectModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        availableUsers={availableUsers}
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

      {/* Bulk Generating Modal Overlay */}
      {bulkGenerating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs text-white space-y-4">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-500 border-t-transparent shadow-2xl" />
          <div className="text-center">
            <h3 className="text-lg font-bold">
              {lang === 'vi'
                ? 'Đang sinh 1,000 Khách mời & Mã QR Token...'
                : 'Generating 1,000 Sample Guests & QR Tokens...'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'vi'
                ? 'Đang khởi tạo mã định danh duy nhất và tạo token bảo mật cho từng khách'
                : 'Initializing unique identifiers and secure QR tokens for each guest'}
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Bulk 1,000 Generation */}
      {isConfirmBulkGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-slate-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">
                  {lang === 'vi' ? 'Sinh 1,000 Khách Mời Mẫu' : 'Generate 1,000 Sample Guests'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'vi'
                    ? 'Bạn có muốn tạo tự động 1,000 khách mời mẫu (kèm tên, email, cơ quan, mã QR token bảo mật) để kiểm thử hiệu năng và chịu tải sự kiện?'
                    : 'Do you want to automatically generate 1,000 sample guests (with names, emails, organizations, and secure QR tokens) for event load & performance testing?'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmBulkGenerateOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={executeBulkGenerate}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Tạo 1,000 Khách' : 'Generate 1,000 Guests'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
