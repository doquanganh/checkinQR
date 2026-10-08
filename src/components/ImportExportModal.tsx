import React, { useState } from 'react';
import { EventItem } from '../types/index.js';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface ImportExportModalProps {
  currentEvent: EventItem;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  currentEvent,
  onClose,
  onImportComplete,
}) => {
  const { lang, t } = useLanguage();
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Sample CSV Template to download
  const handleDownloadTemplate = () => {
    const templateContent =
      'FULL_NAME,PHONE,EMAIL,ORGANIZATION,TITLE,NOTES\n' +
      'Nguyễn Văn A,0901234567,nguyen.a@example.com,BIDV,Trưởng ban,Khách VIP\n' +
      'Trần Thị B,0912345678,tran.b@example.com,Vietcombank,Phó giám đốc,Đại biểu\n' +
      'Lê Quang C,0988776655,le.c@example.com,FPT Telecom,Giám đốc kỹ thuật,\n';

    const blob = new Blob(['\uFEFF' + templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_nhap_khach_moi_event.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Handle file select
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file, 'utf-8');
  };

  // Parse CSV text into rows
  const parseCSV = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toUpperCase());

    const nameIdx = headers.findIndex((h) => h.includes('NAME') || h.includes('TÊN'));
    const phoneIdx = headers.findIndex((h) => h.includes('PHONE') || h.includes('SĐT') || h.includes('THOẠI'));
    const emailIdx = headers.findIndex((h) => h.includes('EMAIL'));
    const orgIdx = headers.findIndex((h) => h.includes('ORG') || h.includes('ĐƠN VỊ') || h.includes('CƠ QUAN'));
    const titleIdx = headers.findIndex((h) => h.includes('TITLE') || h.includes('CHỨC VỤ'));
    const notesIdx = headers.findIndex((h) => h.includes('NOTE') || h.includes('GHI CHÚ'));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV split (handles basic quoted values)
      const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));

      rows.push({
        full_name: nameIdx !== -1 ? values[nameIdx] : values[0] || '',
        phone: phoneIdx !== -1 ? values[phoneIdx] : values[1] || '',
        email: emailIdx !== -1 ? values[emailIdx] : values[2] || '',
        organization: orgIdx !== -1 ? values[orgIdx] : values[3] || 'Khác',
        title: titleIdx !== -1 ? values[titleIdx] : values[4] || 'Khách mời',
        notes: notesIdx !== -1 ? values[notesIdx] : values[5] || '',
      });
    }

    return rows;
  };

  const handleStartImport = async () => {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      setImportError(lang === 'vi' ? 'Không tìm thấy dòng dữ liệu nào hợp lệ trong văn bản CSV' : 'No valid CSV data rows found');
      return;
    }

    setImporting(true);
    setSummary(null);
    setErrors([]);
    setImportError(null);

    try {
      const res = await api.importGuests(currentEvent.id, rows);
      if (res.success) {
        setSummary(res.summary);
        setErrors(res.errors || []);
        onImportComplete();
      } else {
        setImportError(res.message);
      }
    } catch (err: any) {
      setImportError((lang === 'vi' ? 'Lỗi: ' : 'Error: ') + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Download error report CSV
  const handleDownloadErrorReport = () => {
    if (errors.length === 0) return;
    const header = 'DÒNG,LÝ DO LỖI,DỮ LIỆU\n';
    const lines = errors.map(
      (e) => `${e.row},"${e.reason}","${JSON.stringify(e.data).replace(/"/g, '""')}"`
    );
    const content = header + lines.join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_cao_loi_import_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm text-white">
              {lang === 'vi' ? 'Import Khách Mời Từ File CSV / Excel' : 'Import Guests from CSV / Excel'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              {lang === 'vi' ? 'Dán nội dung CSV hoặc Tải tệp lên:' : 'Paste CSV Content or Upload File:'}
            </label>
            <button
              onClick={handleDownloadTemplate}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Tải file CSV mẫu chuẩn' : 'Download Sample CSV'}</span>
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-4 text-center hover:border-indigo-500/50 transition">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>

          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="FULL_NAME,PHONE,EMAIL,ORGANIZATION,TITLE,NOTES&#10;Nguyễn Văn A,0901234567,a@example.com,BIDV,Trưởng đoàn,&#10;Trần Văn B,0912345678,b@example.com,FPT,Khách mời,"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
          />

          {importError && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs font-semibold">
              {importError}
            </div>
          )}

          <button
            onClick={handleStartImport}
            disabled={importing || !csvText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition"
          >
            <Upload className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} />
            <span>
              {importing
                ? lang === 'vi' ? 'Đang phân tích & Import...' : 'Parsing & Importing...'
                : lang === 'vi' ? 'Tiến Hành Import Vào Sự Kiện' : 'Start Import into Event'}
            </span>
          </button>

          {/* Import Summary Results (Section 18) */}
          {summary && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 animate-in fade-in">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {lang === 'vi' ? 'Kết Quả Sau Khi Import:' : 'Import Results Summary:'}
              </h4>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">{lang === 'vi' ? 'Tổng dòng' : 'Total Rows'}</div>
                  <div className="font-bold text-white text-base">{summary.total_rows}</div>
                </div>
                <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <div className="text-emerald-400 text-[10px]">{lang === 'vi' ? 'Thành công' : 'Success'}</div>
                  <div className="font-bold text-emerald-300 text-base">{summary.success}</div>
                </div>
                <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/30">
                  <div className="text-amber-400 text-[10px]">{lang === 'vi' ? 'Trùng lặp' : 'Duplicates'}</div>
                  <div className="font-bold text-amber-300 text-base">{summary.duplicate}</div>
                </div>
                <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/30">
                  <div className="text-rose-400 text-[10px]">{lang === 'vi' ? 'Không hợp lệ' : 'Invalid'}</div>
                  <div className="font-bold text-rose-300 text-base">{summary.invalid}</div>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="pt-2 flex justify-between items-center text-xs">
                  <span className="text-rose-400 font-semibold">
                    {lang === 'vi'
                      ? `Có ${errors.length} dòng gặp lỗi không thể nhập`
                      : `${errors.length} rows encountered errors and were skipped`}
                  </span>
                  <button
                    onClick={handleDownloadErrorReport}
                    className="text-xs text-rose-300 hover:text-white underline cursor-pointer"
                  >
                    {lang === 'vi' ? 'Tải báo cáo lỗi (CSV)' : 'Download error report (CSV)'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
