import QRCode from 'qrcode';

export interface QRPayload {
  type: 'EVENT_GUEST';
  event: string;
  token: string;
}

export function formatQRPayload(eventCode: string, token: string): string {
  return JSON.stringify({
    type: 'EVENT_GUEST',
    event: eventCode,
    token: token,
  });
}

export async function generateQRCodeDataUrl(
  payloadText: string,
  options?: { width?: number; margin?: number; color?: { dark: string; light: string } }
): Promise<string> {
  return QRCode.toDataURL(payloadText, {
    width: options?.width || 320,
    margin: options?.margin ?? 2,
    color: options?.color || {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
}

// Download QR code as PNG image
export async function downloadQRCodePNG(
  payloadText: string,
  fileName: string,
  label?: string,
  lang: 'vi' | 'en' = 'vi'
): Promise<void> {
  const dataUrl = await generateQRCodeDataUrl(payloadText, { width: 512, margin: 3 });

  if (!label) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Draw on canvas with custom card label
  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background card
  ctx.fillStyle = '#ffffff';
  ctx.roundRect(0, 0, 600, 720, 24);
  ctx.fill();

  // Header band
  ctx.fillStyle = '#4f46e5';
  ctx.roundRect(0, 0, 600, 80, [24, 24, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'vi' ? 'QR CHECK-IN SỰ KIỆN' : 'EVENT CHECK-IN QR', 300, 50);

  // QR Image
  ctx.drawImage(img, 50, 110, 500, 500);

  // Label text
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(label, 300, 650);

  ctx.fillStyle = '#64748b';
  ctx.font = '16px sans-serif';
  ctx.fillText(
    lang === 'vi'
      ? 'Vui lòng xuất trình mã này tại bàn tiếp đón'
      : 'Please present this code at reception desk',
    300,
    685
  );

  const pngUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = pngUrl;
  a.download = `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
