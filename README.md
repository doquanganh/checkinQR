# HỆ THỐNG GUEST INVITATION & QR CHECK-IN SỰ KIỆN

**Phiên bản (VERSION):** 2.0.0 (Production-Ready)  
**Kiến trúc:** React 19 + TypeScript + Vite + Node.js Express Fullstack + PWA (Progressive Web App) + In-memory Atomic Mutex Lock

---

## 1. Mục tiêu & Tổng quan

Hệ thống quản lý khách mời, phát hành thư mời, tạo mã QR bảo mật và check-in tốc độ cao cho sự kiện quy mô từ **1.000 đến 10.000 khách**.

Quy trình hỗ trợ:
```text
Import / Nhập khách
        ↓
Tạo mã khách + QR Token ngẫu nhiên (Cryptographically secure)
        ↓
Tạo thư mời chuẩn trang trọng & Template Email cá nhân hóa
        ↓
Gửi thư mời (Đơn lẻ / Hàng loạt / Tất cả khách chưa gửi)
        ↓
Khách đến sự kiện (Xuất trình QR trên điện thoại hoặc bản in)
        ↓
Nhân viên quét QR (Camera trực tiếp / Upload ảnh / Nhập mã)
        ↓
Xác thực khách 5 trường hợp (Hợp lệ, Đã check-in, Sai mã, Khác sự kiện, Vé bị khóa)
        ↓
Atomic Check-in (Khóa chống quét trùng race-condition tuyệt đối)
        ↓
Ghi Audit Log & Thông báo Real-time SSE đến Dashboard
```

---

## 2. Tính năng nổi bật (FEATURES)

1. **Mobile-First PWA Check-in Scanner:**
   - Hoạt động mượt mà trên mọi điện thoại Android và iOS Safari.
   - Hỗ trợ đổi Camera trước/sau, đèn flash.
   - Âm thanh Synthesizer (Web Audio API) chime đôi khi thành công, buzzer khi lỗi, rung xúc giác haptic vibration.
   - Hiệu ứng pháo hoa confetti khi check-in thành công.
   - Hỗ trợ nhập mã dự phòng thủ công khi vé bị nhăn/mờ/rách.

2. **Chống Check-in Trùng Đồng Thời Tuyệt Đối (Atomic Mutex Locking - Section 13):**
   - Cơ chế Row-level Lock / In-memory Atomic CAS tuần tự hóa (serialized) lượt quét.
   - Khi 2 hoặc nhiều nhân viên tại các cổng quét cùng một mã QR tại cùng 1 microsecond: Chỉ duy nhất 1 request đầu tiên được `SUCCESS`, toàn bộ request còn lại nhận ngay `ALREADY_CHECKED_IN`.
   - Có tích hợp sẵn bảng điều khiển **"Test Race Condition"** để bắn đồng thời 2-5 HTTP request song song kiểm chứng tức thì.

3. **Validation Đầy Đủ 5 Case Chuẩn (Section 12):**
   - **Case 1 (Hợp lệ):** Cập nhật `CHECKED_IN`, lưu timestamp, tên nhân viên cổng, thiết bị.
   - **Case 2 (Đã check-in):** Cảnh báo `ALREADY_CHECKED_IN` kèm thời gian check-in trước đó và nhân viên đã đón tiếp.
   - **Case 3 (QR sai):** `INVALID_QR`.
   - **Case 4 (Khác sự kiện):** `WRONG_EVENT` (Chỉ rõ vé thuộc sự kiện khác, không thể vào).
   - **Case 5 (Vé bị khóa/thu hồi):** `GUEST_INACTIVE` (Chỉ rõ lý do khóa thẻ).

4. **Quản trị Khách Mời Quy Mô Lớn (1.000 - 10.000 khách):**
   - 1-Click "Tạo 1,000 Khách" với dữ liệu họ tên tiếng Việt thực tế, số điện thoại, cơ quan (BIDV, Vietcombank, FPT,...) để test tải.
   - Phân trang, tìm kiếm thời gian thực theo tên, email, SĐT, cơ quan, mã vé.
   - Lọc theo trạng thái thư mời (SENT/PENDING) và trạng thái check-in.
   - Thao tác hàng loạt: Gửi thư mời nhiều khách, xuất CSV.

5. **Thư Mời Trang Trọng & Quản Lý Mẫu Email:**
   - Trình soạn thảo mẫu email với biến tự động: `{{FULL_NAME}}`, `{{ORGANIZATION}}`, `{{EVENT_NAME}}`, `{{EVENT_DATE}}`, `{{EVENT_LOCATION}}`, `{{GUEST_CODE}}`, `{{QR_CODE}}`.
   - Xem trước Live Preview email.
   - Tải ảnh thẻ QR độ phân giải cao có khung thẻ đại biểu.
   - In thư mời trực tiếp (Ctrl+P / Print).

6. **Import & Export Dữ Liệu:**
   - Import file CSV / Excel với báo cáo thống kê chi tiết (Dòng hợp lệ, dòng trùng lặp, dòng lỗi).
   - Cho phép tải file báo cáo lỗi chi tiết.
   - Xuất file CSV danh sách khách mời, báo cáo check-in và audit logs.

7. **Phân Quyền Người Dùng (Role-Based Access Control):**
   - **ADMIN:** Toàn quyền quản lý khách, sự kiện, email template, audit log, export dữ liệu, test race condition.
   - **CHECKIN_STAFF:** Giao diện tối giản tập trung tối đa vào tốc độ quét camera, tra cứu nhanh, không được sửa/xóa khách.

8. **Khả Năng Chịu Lỗi & Ngoại Tuyến (Offline Resilience):**
   - Khi mất mạng hoặc Wi-Fi sự kiện chập chờn, lượt quét được lưu trữ vào Offline Queue trong trình duyệt và tự động đồng bộ lên server ngay khi có kết nối trở lại.

---

## 3. Hướng dẫn chạy và triển khai (DEPLOYMENT GUIDE)

### Chạy môi trường phát triển (Local / Dev)

```bash
# 1. Cài đặt các thư viện cần thiết
npm install

# 2. Khởi động server fullstack (Node Express + Vite)
npm run dev

# 3. Mở trình duyệt tại:
http://localhost:3000
```

### Triển khai Môi trường Sản xuất (Production Build)

```bash
# 1. Build ứng dụng
npm run build

# 2. Chạy ứng dụng production
npm start
```

Port mặc định: `3000` (hoặc cấu hình qua biến môi trường `PORT`).

---

## 4. Dữ liệu mẫu ban đầu (Sample Data)

- **Guest 1:**
  - ID: `000001`
  - Mã vé: `G202600001`
  - Họ tên: `Nguyễn Quang Anh`
  - Email: `mr.anhdq@gmail.com`
  - Cơ quan: `BIDV`
  - Chức vụ: `Trưởng ban Tổ chức`

- **Guest 2:**
  - ID: `000002`
  - Mã vé: `G202600002`
  - Họ tên: `Nguyễn Ngọc Anh`
  - Email: `ngoc.anh.btc@gmail.com`
  - Cơ quan: `BTC`
  - Chức vụ: `Khách mời VIP`

- **Sự kiện 1:** `EVT202610` — BIDV Annual Event 2026
- **Sự kiện 2:** `EVT202611` — Vietnam Tech Innovation Summit 2026 (Dùng để kiểm thử vé sai sự kiện WRONG_EVENT)

---

## 5. Giới hạn đã biết (KNOWN LIMITATIONS)

1. **Email Delivery:** Ở môi trường demo / dev, chức năng gửi email được ghi nhận trạng thái và log trong cơ sở dữ liệu (`SENT`/`PENDING`/`FAILED`). Khi triển khai production doanh nghiệp, cần cấu hình SMTP credentials hoặc dịch vụ gửi email như SendGrid/Resend/AWS SES qua biến môi trường.
2. **Camera Permission trên iframe/sandbox:** Trên một số trình duyệt khi chạy trong iframe bị giới hạn quyền camera, hệ thống cung cấp sẵn tính năng quét từ tệp ảnh QR hoặc nhập mã khách thủ công để đảm bảo luôn vận hành thông suốt.

---

## 6. Nhật ký thay đổi (CHANGELOG)

### [2.0.0] - 2026-10-06
- Bổ sung Fullstack Node.js + Express backend với Vite dev middleware.
- Xây dựng cơ chế khóa nguyên tử Atomic Mutex Locking chống race condition 100%.
- Tích hợp Server-Sent Events (SSE) cho Live Real-time Dashboard và Monitoring.
- Hỗ trợ PWA với Web App Manifest, Service Worker và In-App Install prompt.
- Bổ sung bộ mô phỏng kiểm thử Race-Condition trực quan.
- Bổ sung tính năng tạo 1,000 khách mời ngẫu nhiên để stress-test hệ thống.
