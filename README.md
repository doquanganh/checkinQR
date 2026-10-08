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

Yêu cầu **Node.js ≥ 20.19** (khuyến nghị 22 hoặc 24). Lần chạy dev đầu tiên, server tạo tài khoản admin `admin@eventhub.vn` và in mật khẩu ngẫu nhiên ra console (chỉ một lần). Dữ liệu mẫu trong mục 4 được nạp tự động khi chạy dev. DB lưu tại `./data/checkin.db`.

```bash
npm test        # test API: đăng nhập, phân quyền, 5 case check-in, race condition
npm run lint    # kiểm tra kiểu TypeScript
```

### Triển khai lên VPS (Docker + HTTPS tự động)

Cần: VPS Linux có Docker + Docker Compose, một tên miền trỏ về IP VPS (bản ghi A), cổng 80 và 443 mở. **HTTPS là bắt buộc**, vì trình duyệt chỉ cho phép camera quét QR và cài PWA trên HTTPS.

```bash
git clone https://github.com/doquanganh/checkinQR.git /opt/checkin && cd /opt/checkin
cp .env.example .env
# Sửa .env: DOMAIN, APP_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD, SMTP_*
docker compose up -d --build
docker compose logs -f app      # chờ dòng "Event Guest & QR Check-in Server running"
```

Mở `https://<DOMAIN>`, đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD`, rồi vào menu tài khoản (góc phải trên) để **tạo tài khoản staff** cho từng cổng soát vé. Sau khi tạo xong có thể xóa `ADMIN_PASSWORD` khỏi `.env`.

| Biến | Ý nghĩa |
|---|---|
| `DOMAIN` | Tên miền công khai (Caddy tự lấy chứng chỉ Let's Encrypt) |
| `APP_SECRET` | Chuỗi ngẫu nhiên ≥ 32 ký tự, dùng mã hóa mật khẩu SMTP lưu trong DB. **Không đổi sau khi đã cấu hình SMTP**, nếu đổi phải nhập lại mật khẩu SMTP |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin đầu tiên, chỉ dùng khi DB chưa có tài khoản nào |
| `SMTP_*` | Gmail SMTP (App Password 16 ký tự). Cũng có thể nhập trong app: "Cài đặt Email SMTP" |
| `SEED_SAMPLE_DATA` | `true` để nạp dữ liệu mẫu (mặc định tắt ở production) |
| `ENABLE_DEMO_TOOLS` | `true` để bật nút reset check-in, tạo 1,000 khách mẫu, test race (mặc định tắt ở production) |

**Cập nhật phiên bản:** `git pull && docker compose up -d --build`. Dữ liệu nằm trong volume `checkin_data` nên không mất khi build lại.

**Sao lưu** (DB là một file SQLite, backup an toàn khi app đang chạy). Thêm vào crontab của VPS:

```bash
0 2 * * * cd /opt/checkin && docker compose exec -T app node scripts/backup.mjs
```

Bản sao lưu nằm ở `/data/backups/` trong volume (giữ 14 bản gần nhất, đổi bằng `BACKUP_KEEP`). Nhớ chép định kỳ ra ngoài VPS, ví dụ `docker compose cp app:/data/backups ./backups` rồi `rsync` đi nơi khác. Khôi phục: dừng app, chép file `.db` đè lên `/data/checkin.db`, khởi động lại.

**Chạy không dùng Docker:** `npm ci && npm run build`, rồi `NODE_ENV=production APP_SECRET=... ADMIN_EMAIL=... ADMIN_PASSWORD=... APP_URL=https://<domain> npm start` sau một reverse proxy HTTPS (nginx/Caddy). Đặt `TZ=Asia/Ho_Chi_Minh` để biểu đồ check-in theo giờ đúng múi giờ.

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

1. **Email Delivery:** Khi chưa cấu hình SMTP, thao tác gửi thư mời không gửi gì và không đổi trạng thái (UI báo cần cấu hình SMTP). Gmail giới hạn khoảng 500 thư/ngày với tài khoản thường (2.000 với Google Workspace); sự kiện lớn hơn nên dùng Resend/SendGrid/AWS SES qua SMTP. Gửi hàng loạt hiện chạy ngay trong một request (giới hạn 5 thư/giây), nên với hàng nghìn khách hãy gửi theo từng đợt.
2. **Một máy chủ duy nhất:** SQLite và luồng SSE chạy trong một process, không hỗ trợ chạy nhiều bản app song song. Đủ cho 10.000 khách và hàng chục thiết bị quét.
3. **Camera Permission trên iframe/sandbox:** Trên một số trình duyệt khi chạy trong iframe bị giới hạn quyền camera, hệ thống cung cấp sẵn tính năng quét từ tệp ảnh QR hoặc nhập mã khách thủ công để đảm bảo luôn vận hành thông suốt.

---

## 6. Nhật ký thay đổi (CHANGELOG)

### [2.1.0] - 2026-10-08
- Lưu dữ liệu bền bằng SQLite (WAL, migration tự động); check-in atomic ở tầng DB.
- Đăng nhập thật (phiên cookie HttpOnly, mật khẩu scrypt), phân quyền ADMIN / CHECKIN_STAFF được kiểm tra ở backend; admin tạo và khóa tài khoản staff trong UI.
- Token QR sinh bằng CSPRNG; trang vé công khai chỉ mở bằng token, không dùng mã khách tuần tự.
- Mật khẩu SMTP mã hóa AES-256-GCM trong DB; nội dung email được escape HTML; biến mẫu `{{FULL_NAME}}`... hoạt động đúng; QR trong email scanner đọc được.
- Docker + Caddy (HTTPS tự động), script backup, test tự động (`npm test`).

### [2.0.0] - 2026-10-06
- Bổ sung Fullstack Node.js + Express backend với Vite dev middleware.
- Xây dựng cơ chế khóa nguyên tử Atomic Mutex Locking chống race condition 100%.
- Tích hợp Server-Sent Events (SSE) cho Live Real-time Dashboard và Monitoring.
- Hỗ trợ PWA với Web App Manifest, Service Worker và In-App Install prompt.
- Bổ sung bộ mô phỏng kiểm thử Race-Condition trực quan.
- Bổ sung tính năng tạo 1,000 khách mời ngẫu nhiên để stress-test hệ thống.
