import React, { useEffect, useState } from 'react';
import { EventItem, EventGuest } from '../types/index.js';
import { api } from '../services/api.js';
import { formatQRPayload, generateQRCodeDataUrl, downloadQRCodePNG } from '../utils/qr.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  QrCode,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Download,
  Share2,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface PublicTicketViewProps {
  ticketCode: string;
  onBackToApp: () => void;
}

export const PublicTicketView: React.FC<PublicTicketViewProps> = ({ ticketCode, onBackToApp }) => {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ eventGuest: EventGuest; event: EventItem } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    loadTicket();
  }, [ticketCode]);

  const loadTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPublicTicket(ticketCode);
      if (res.success && res.data) {
        setData(res.data);
        const payload = formatQRPayload(res.data.event.event_code, res.data.eventGuest.qr_token);
        const url = await generateQRCodeDataUrl(payload, { width: 340 });
        setQrDataUrl(url);
      } else {
        setError(res.message || 'Không tìm thấy vé');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải vé');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!data) return;
    const { eventGuest, event } = data;
    const payload = formatQRPayload(event.event_code, eventGuest.qr_token);
    downloadQRCodePNG(
      payload,
      `Ve_Checkin_${eventGuest.guest_code}_${data.eventGuest.guest?.full_name || 'Khach'}`,
      `${data.eventGuest.guest?.full_name || 'Khách mời'} (${eventGuest.guest_code})`,
      lang
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 text-fg">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-fg-muted">
          {lang === 'vi' ? 'Đang tải vé điện tử...' : 'Loading digital ticket...'}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 text-fg">
        <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-fg">
            {lang === 'vi' ? 'Không Tìm Thấy Vé' : 'Ticket Not Found'}
          </h2>
          <p className="text-sm text-fg-muted">
            {error || (lang === 'vi' ? 'Mã vé không tồn tại hoặc đã bị hủy.' : 'Ticket does not exist.')}
          </p>
          <button
            onClick={onBackToApp}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {lang === 'vi' ? 'Về Trang Quản Lý' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  const { eventGuest, event } = data;
  const guest = eventGuest.guest;
  const isCheckedIn = eventGuest.checkin_status === 'CHECKED_IN';

  return (
    <div className="min-h-screen bg-canvas text-fg py-8 px-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-2">
          <button
            onClick={onBackToApp}
            className="text-xs text-fg-muted hover:text-fg flex items-center gap-1.5 transition py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Quay lại hệ thống' : 'Back to App'}</span>
          </button>

          <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-400/40 px-2.5 py-0.5 rounded-full">
            {event.event_code}
          </span>
        </div>

        {/* Digital Ticket Card */}
        <div className="bg-surface border border-line rounded-3xl overflow-hidden shadow-2xl relative">
          {/* Header Banner */}
          <div className="bg-indigo-600 p-6 text-center text-white relative">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              {lang === 'vi' ? 'VÉ CHECK-IN ĐIỆN TỬ' : 'DIGITAL EVENT PASS'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black leading-tight">{event.event_name}</h1>
          </div>

          {/* Ticket Body */}
          <div className="p-6 space-y-5">
            {/* Guest Details */}
            <div className="text-center pb-4 border-b border-line">
              <h2 className="text-2xl font-black text-fg">{guest?.full_name || 'Khách mời'}</h2>
              {guest?.organization && (
                <p className="text-sm font-semibold text-indigo-400 mt-1">
                  {guest?.title ? `${guest.title} • ` : ''}
                  {guest.organization}
                </p>
              )}
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-surface-2 rounded-full text-xs font-mono text-fg border border-line">
                <span>{lang === 'vi' ? 'Mã vé:' : 'Code:'}</span>
                <strong className="text-fg">{eventGuest.guest_code}</strong>
              </div>
            </div>

            {/* Event Time & Venue */}
            <div className="bg-surface-2/60 border border-line/60 rounded-2xl p-4 space-y-2.5 text-xs text-fg">
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-fg-muted uppercase font-bold block">
                    {lang === 'vi' ? 'Thời gian' : 'Time'}
                  </span>
                  <span className="text-fg font-medium text-xs">
                    {new Date(event.start_at).toLocaleString('vi-VN', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-fg-muted uppercase font-bold block">
                    {lang === 'vi' ? 'Địa điểm' : 'Location'}
                  </span>
                  <span className="text-fg font-medium text-xs">{event.location}</span>
                </div>
              </div>
            </div>

            {/* High Resolution QR Code */}
            <div className="bg-canvas border-2 border-indigo-400/40 rounded-2xl p-5 text-center flex flex-col items-center">
              <div className="bg-white p-3 rounded-2xl shadow-sm inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Ticket QR Code"
                    className="w-52 h-52 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-52 h-52 bg-slate-200 animate-pulse rounded-lg" />
                )}
              </div>
              <p className="text-xs text-indigo-400 font-medium mt-3">
                {lang === 'vi'
                  ? 'Xuất trình mã QR này tại bàn đón tiếp để check-in'
                  : 'Present this QR code at reception to check-in'}
              </p>
            </div>

            {/* Check-in Status */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold ${
                isCheckedIn
                  ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-400/40 text-amber-400'
              }`}
            >
              {isCheckedIn ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {lang === 'vi' ? 'ĐÃ CHECK-IN THÀNH CÔNG' : 'CHECKED IN'}
                    {eventGuest.checked_in_at &&
                      ` (${new Date(eventGuest.checked_in_at).toLocaleTimeString('vi-VN')})`}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'vi' ? 'CHƯA CHECK-IN (SẴN SÀNG QUÉT)' : 'NOT CHECKED IN (READY TO SCAN)'}</span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Tải Ảnh Mã QR' : 'Save QR Ticket'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="py-3 px-4 bg-surface-2 hover:bg-surface-3 text-fg font-semibold rounded-xl text-xs border border-line transition"
              >
                {lang === 'vi' ? 'In Vé' : 'Print'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
