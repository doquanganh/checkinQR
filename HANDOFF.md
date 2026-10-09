# Ghi chú bàn giao: CheckinQR

Tài liệu cho người (hoặc phiên làm việc) tiếp theo. README mô tả cách dùng và triển khai; tệp này nói **hệ thống gồm gì, đang ở trạng thái nào và cần cẩn thận chỗ nào**. Không có bí mật nào trong đây.

## 1. Hiện trạng

| Mục | Giá trị |
|---|---|
| Mã nguồn | https://github.com/doquanganh/checkinQR, nhánh `main` |
| Phiên bản | xem `version` trong `package.json` (hiện 2.2.0); mã commit hiện trong ứng dụng và ở `/api/health` |
| Đang chạy | VPS Ubuntu 22.04, `https://eventgate.anhdq.xyz`, Docker sau nginx có sẵn, cổng nội bộ `127.0.0.1:3010` |
| Tự cập nhật | cron mỗi 5 phút chạy `deploy/auto-update.sh` (kéo `main`, build, kiểm tra `/api/health`, tự quay lui nếu lỗi) |
| Dữ liệu | SQLite trong volume Docker `checkin_data` (`/data/checkin.db`); sao lưu bằng `scripts/backup.mjs` |
| Chưa kiểm chứng trên máy thật | quét camera và rung trên điện thoại, gửi Gmail (SMTP chưa cấu hình), cài PWA |

## 2. Kiến trúc

- **Một tiến trình Node** (`server.ts`) phục vụ cả API (Express) và frontend (React 19 + Vite, bản build trong `dist/`). Dev: Vite chạy dạng middleware trong cùng tiến trình.
- **Backend** (`server/`): `app.ts` (middleware, CSRF theo Origin, `/api/health`), `api.ts` (route nghiệp vụ), `auth.ts` (đăng nhập, phiên, quản lý user), `db.ts` (SQLite, migration, check-in nguyên tử), `email.ts` (SMTP, mã hoá mật khẩu), `config.ts` (biến môi trường, thông tin build), `crypto.ts`, `seed.ts` (dữ liệu mẫu), `app.test.ts` (21 test).
- **Frontend** (`src/`): `App.tsx` điều phối tab; `components/` các màn hình; `services/api.ts` gọi API (có xử lý 401 và hàng đợi quét offline); `context/` ngôn ngữ và chủ đề; `utils/` mã QR, âm thanh/rung, nhãn kết quả.
- **Phân quyền:** `ADMIN` làm mọi việc, `CHECKIN_STAFF` chỉ quét, tra cứu, xem nhật ký. Kiểm tra ở **backend** (`requireAdmin`, `requireAuth`), UI chỉ ẩn nút cho gọn.
- **Check-in nguyên tử:** `UPDATE ... WHERE checkin_status='NOT_CHECKED_IN'` trong một giao dịch, nên chỉ một lượt quét thành công dù có nhiều thiết bị cùng lúc.

## 3. Lệnh hay dùng

Trên máy dev (Node ≥ 20.19, máy này đang dùng Node 24):
```text
npm install
npm run dev        # http://localhost:3000, lần đầu in mật khẩu admin dev ra console (chỉ một lần)
npm run lint       # tsc --noEmit
npm test           # vitest, DB trong bộ nhớ
npm run build
```
Trên VPS (`/opt/checkin`):
```text
bash deploy/auto-update.sh                 # cập nhật ngay
tail -f /var/log/checkin-update.log        # nhật ký cập nhật
docker compose logs -f app                 # nhật ký ứng dụng
curl http://127.0.0.1:3010/api/health      # version, commit, built_at
```
Tắt tự cập nhật (vào ngày sự kiện): `crontab -l | grep -v auto-update.sh | crontab -`. Cách bật lại và quy ước nâng số phiên bản nằm trong README.

## 4. Quy ước và điểm dễ vấp

- **Giao diện dùng token màu**, không dùng màu cứng: `bg-surface`, `bg-canvas`, `text-fg`, `text-fg-muted`, `border-line`... Bảng màu thương hiệu (Carbon Teal `#042F32`, Mint Foam `#D6FFCB`) và hai chế độ sáng/tối khai báo trong `src/index.css`; thang `indigo-*` được ánh xạ sang màu teal. Muốn đổi màu thì sửa ở đó.
- **Màu trạng thái chỉ dùng 4 màu:** teal (thương hiệu), xanh lá (thành công, "đã đến"), đỏ (lỗi), vàng (cảnh báo/quét lại). Tránh thêm màu mới.
- **Các tờ "giấy trắng"** (thư mời in, xem trước email, vé công khai) phải dùng màu cố định (`text-carbon`, `text-slate-*`), không dùng `text-fg`, kẻo mất chữ ở chế độ tối.
- **Màn quét camera:** khung `#qr-reader-container` phải luôn có kích thước thật (không `display:none`) lúc `html5-qrcode` khởi động, nếu không video đen. Camera gọi lại liên tục nên chống quét trùng bằng `ref` và thời gian chờ 6 giây (`CheckinScanner.tsx`).
- **Token QR và mã khách:** trang vé công khai chỉ mở bằng `qr_token`, không bằng mã khách tuần tự. Staff không nhận `qr_token` của khách khác.
- **Công cụ demo** (reset check-in, tạo 1.000 khách, test race) đã gỡ khỏi giao diện; endpoint còn lại ở server, tắt ở production (`ENABLE_DEMO_TOOLS`).
- **Phiên bản:** hằng `__APP_VERSION__`, `__GIT_SHA__`, `__BUILT_AT__` do Vite tiêm; Docker không có git nên `GIT_SHA` và `BUILT_AT` truyền qua build arg. Build tay mà thiếu chúng thì app hiện `unknown`.
- **Windows:** repo có `.gitattributes` ép `*.sh` dùng LF; file `.sh` bị CRLF sẽ hỏng trên Linux.
- **`APP_SECRET` đừng đổi** sau khi đã nhập mật khẩu SMTP (đổi thì phải nhập lại mật khẩu SMTP).

## 5. Việc còn dang dở / ý tưởng

- Thử thật trên điện thoại: camera, rung (chỉ Android), thanh "có bản mới", cài PWA.
- Cấu hình SMTP (Gmail App Password hoặc dịch vụ khác) và thử gửi thư mời. Gmail thường giới hạn ~500 thư/ngày; gửi hàng loạt hiện chạy ngay trong một yêu cầu (5 thư/giây), nên gửi theo từng đợt.
- Bảng danh sách khách ở màn hình rộng ~800px còn bị cắt cột thao tác bên phải.
- `bun.lock` còn trong repo cạnh `package-lock.json`; Docker dùng npm. Quyết định giữ cái nào.
- Các chuỗi dịch không còn dùng trong `src/i18n/translations.ts` (sót từ bộ chọn vai trò cũ) chưa dọn.
- Chạy nhiều bản ứng dụng song song **không được hỗ trợ** (SQLite và luồng SSE nằm trong một tiến trình).
