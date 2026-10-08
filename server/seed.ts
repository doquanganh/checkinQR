import { db } from './db.ts';

// Sample data from the README (2 events, 7 guests). Runs only on an empty database.
export function seedSampleData() {
  if (db.listEvents().length > 0) return;

  const t = Date.now();
  const bidv = db.createEvent({
    id: 'evt_bidv_2026',
    event_code: 'EVT202610',
    event_name: 'BIDV Annual Event 2026',
    description: 'Hội nghị Tri ân Khách hàng & Tổng kết Hoạt động Thường niên BIDV 2026',
    location: 'Trung tâm Hội nghị Quốc gia, Đại lộ Thăng Long, Hà Nội',
    start_at: '2026-10-06T08:00:00+07:00',
    end_at: '2026-10-06T18:00:00+07:00',
    status: 'ACTIVE',
    created_at: new Date(t).toISOString(),
  });
  const tech = db.createEvent({
    id: 'evt_tech_summit',
    event_code: 'EVT202611',
    event_name: 'Vietnam Tech Innovation Summit 2026',
    description: 'Diễn đàn Đổi mới Sáng tạo & Công nghệ Trí tuệ Nhân tạo',
    location: 'Saigon Exhibition and Convention Center (SECC), Q.7, TP.HCM',
    start_at: '2026-11-15T09:00:00+07:00',
    end_at: '2026-11-15T17:30:00+07:00',
    status: 'UPCOMING',
    created_at: new Date(t - 1000).toISOString(),
  });

  db.saveTemplate(bidv.id, {
    subject: 'Thư mời tham dự sự kiện {{EVENT_NAME}}',
    sender_name: 'Ban Tổ Chức BIDV',
    sender_email: 'event@bidv.com.vn',
    body: `Kính gửi Anh/Chị {{FULL_NAME}},

Ban Tổ chức trân trọng kính mời Anh/Chị {{FULL_NAME}} ({{ORGANIZATION}} - {{TITLE}}) tham dự sự kiện trọng thể:

{{EVENT_NAME}}

• Thời gian: {{EVENT_DATE}}
• Địa điểm: {{EVENT_LOCATION}}
• Mã số khách mời: {{GUEST_CODE}}

Vui lòng xuất trình mã QR đính kèm tại bàn đón tiếp để hoàn tất thủ tục check-in nhanh chóng.

Trân trọng,
Ban Tổ Chức BIDV`,
  });

  const guests = [
    { full_name: 'Nguyễn Quang Anh', phone: '0901234567', email: 'mr.anhdq@gmail.com', organization: 'BIDV', title: 'Trưởng ban Tổ chức', notes: 'Khách VIP - Đại biểu danh dự' },
    { full_name: 'Nguyễn Ngọc Anh', phone: '0912345678', email: 'ngoc.anh.btc@gmail.com', organization: 'BTC', title: 'Khách mời VIP', notes: 'Ban Thư ký sự kiện' },
    { full_name: 'Trần Văn Hoàng', phone: '0988776655', email: 'hoang.tv@vietcombank.com.vn', organization: 'Vietcombank', title: 'Phó Tổng Giám Đốc', notes: 'Khu vực VIP A1' },
    { full_name: 'Phạm Thị Mai', phone: '0933221100', email: 'mai.pham@techcombank.com.vn', organization: 'Techcombank', title: 'Giám đốc Khối Khách hàng Doanh nghiệp', notes: 'Bàn số 04' },
    { full_name: 'Đỗ Hùng Dũng', phone: '0977112233', email: 'dung.do@fpt.com.vn', organization: 'FPT Software', title: 'Trưởng đoàn Đối tác Chiến lược', notes: '' },
    { full_name: 'Vũ Minh Tuấn', phone: '0966554433', email: 'tuan.vm@vnexpress.net', organization: 'VnExpress', title: 'Phóng viên Ban Kinh tế', notes: 'Khu vực Báo chí & Truyền thông' },
    // revoked ticket, exercises GUEST_INACTIVE
    { full_name: 'Lê Thùy Trang (Tài khoản bị khoá)', phone: '0911889900', email: 'trang.le@inactive-corp.vn', organization: 'BIDV Chi nhánh Hà Thành', title: 'Chuyên viên QHKH', notes: 'Vé đã bị thu hồi do chuyển công tác', status: 'DISABLED' as const },
  ];

  guests.forEach((g, i) => {
    const eg = db.addGuest(bidv.id, g);
    if (i === 0 || i === 2) db.setInvitation(eg.id, 'SENT');
  });

  // guest 1 also belongs to the second event, to exercise WRONG_EVENT
  db.linkGuest(tech.id, '000001', 'GTECH00001', { invitation_status: 'SENT', invited_at: new Date().toISOString() });
}
