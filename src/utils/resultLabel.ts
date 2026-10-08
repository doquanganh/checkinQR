import type { CheckinResult } from '../types/index.js';

type Lang = 'vi' | 'en';

// Short badge text for a check-in result, so lists never show raw codes like ALREADY_CHECKED_IN
const SHORT: Record<CheckinResult, Record<Lang, string>> = {
  SUCCESS: { vi: 'Thành công', en: 'Success' },
  ALREADY_CHECKED_IN: { vi: 'Quét lại', en: 'Re-scan' },
  INVALID_QR: { vi: 'QR sai', en: 'Invalid QR' },
  WRONG_EVENT: { vi: 'Sai sự kiện', en: 'Wrong event' },
  GUEST_INACTIVE: { vi: 'Vé bị khóa', en: 'Revoked' },
  ERROR: { vi: 'Lỗi', en: 'Error' },
};

export function resultLabel(status: string, lang: Lang): string {
  return SHORT[status as CheckinResult]?.[lang] ?? status;
}
