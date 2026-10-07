# API nội bộ Gems ERP

Tất cả endpoint `/api` trả JSON, cùng origin với giao diện. Ngoại trừ health,
trạng thái và đăng nhập/khởi tạo, API cần cookie phiên đăng nhập. API dùng
cookie HttpOnly/SameSite=Strict, chưa hỗ trợ OAuth2 hoặc API key.

POST/PUT/DELETE phải có `Content-Type: application/json` và
`X-ERP-Request: 1`. Nếu có Origin, hostname/cổng phải khớp Host. Không bật
CORS cho website bên ngoài. Trường ngoài schema không được dùng để ghi đè
ID, trạng thái duyệt hoặc mốc thời gian hệ thống.

| Endpoint | Mục đích |
|---|---|
| `GET /api/health` | Readiness API |
| `GET /api/auth/status` | Hệ thống đã khởi tạo chưa; người dùng hiện tại |
| `POST /api/auth/bootstrap` | Tạo admin đầu tiên; `name`, `username`, `password`, `demo` |
| `POST /api/auth/login` | Đăng nhập bằng username/password |
| `POST /api/auth/logout` | Hủy phiên |
| `GET /api/meta` | Schema phân hệ được đọc, quyền và yêu cầu Excel |
| `GET /api/records/:collection` | Bản ghi theo quyền/phạm vi, phân trang |
| `GET /api/records/:collection/:id` | Chi tiết bản ghi có kiểm tra phạm vi |
| `POST /api/records/:collection` | Tạo bản ghi qua validation nghiệp vụ |
| `PUT /api/records/:collection/:id` | Cập nhật các trường được phép |
| `DELETE /api/records/:collection/:id` | Chỉ admin; chỉ nháp không có tham chiếu, không xóa lịch sử nghiệp vụ |
| `POST /api/records/:collection/:id/actions` | Workflow với trường `action` |
| `POST /api/invoices/generate` | `contractId`, `period` dạng YYYY-MM |
| `GET /api/reports?period=YYYY-MM` | Báo cáo điều hành; tùy chọn legalEntityId/buildingId |
| `GET /api/ledger?period=YYYY-MM` | Cân đối tài khoản; tùy chọn legalEntityId |
| `GET /api/payroll?period=YYYY-MM` | Bảng lương chạy thử, không quyết định trả lương |
| `GET /api/appraisals/:id/calculate` | Ba kịch bản và toàn bộ dòng tiền tháng |
| `GET/POST /api/users` | Admin đọc/tạo tài khoản, chưa sửa/xóa tài khoản |
| `GET/POST /api/periods` | Admin đọc/chốt kỳ, chưa mở lại kỳ |
| `GET /api/audit?limit=100` | Admin đọc nhật ký, tối đa 200 dòng |
| `GET /api/export` | Admin xuất JSON nghiệp vụ, không gồm mật khẩu/phiên |
| `POST /api/import/:collection` | Admin nhập `items` tối đa 100 bản ghi, toàn đợt atomic |

Tham số list: `page` (từ 1), `limit` (1–500), `q`, `legalEntityId`,
`buildingId`, `cap_nhat_tu` (ISO timestamp). Trả `{items,total,page,limit}`.
Mỗi bản ghi có `code`, `sourceSystem`, `createdBy`, `updatedBy`, `createdAt`,
`updatedAt`. Polling `cap_nhat_tu` là kênh đồng bộ hiện tại; chưa có webhook
hoặc feed tombstone cho bản nháp đã xóa.

## Các action

- Hóa đơn: `pay` với amount, date, method, reference. Tiền cọc cấn trừ phải
  đủ số dư và ở kỳ cuối/thanh lý. Khoản thu không được vượt dư nợ.
- Hợp đồng: `receiveDeposit` (amount/date/method), `close` (date/noticeMonths/
  reason), `refundDeposit` (confirmCompensation). Nhận cọc không ghi doanh thu.
- Công việc: `submit`, `approve`, `reject` (reason bắt buộc). Công việc trả lại
  được sửa rồi submit lại; nhân viên chỉ gửi việc của mình.
- Chi phí: `approve`, `pay` (date). Không bỏ qua bước duyệt.
- Sự cố: `assign` (assignee), `resolve`, `accept`. Khách nghiệm thu trong phạm vi
  hợp đồng; phí được đưa sang hóa đơn khi lập kỳ tiếp theo.
- Mua sắm: `approve`, `receive`; nhận hàng sinh đề nghị chi chưa duyệt.
- Vật tư: `receive` / `issue` (quantity/date/notes), không cho tồn âm.
- Vòng đời dự án: `advance` với documentUrl, nextOwnerId, nextDueDate; chỉ chuyển khi việc bước hiện tại đã duyệt; bước mới sinh việc cho đúng phòng.
- Sổ nhật ký: `reverse` (date/reason), giữ bản gốc và lập bút toán đảo trong kỳ mở.
  Không tự đảo chứng từ vận hành.

## Khóa kỳ và thu tiền sau khi khóa

Giá/thuế/sản lượng và nội dung hóa đơn đã phát hành là snapshot bất biến.
Kỳ đã chốt không nhận thêm hóa đơn, chi phí, công việc/KPI hoặc bút toán vào
kỳ đó. Thu tiền sau cho hóa đơn của kỳ khóa được ghi thành khoản thu và bút toán trong **kỳ mới chưa khóa**. Đã thu/dư nợ là số liệu dẫn xuất từ nhật ký
thu, không sửa snapshot hóa đơn hoặc báo cáo đối soát đã lưu lúc chốt.

Hủy hóa đơn kỳ tương lai do thanh lý tạo bút toán đối ứng ở đúng kỳ tương lai;
giữ chứng từ và lịch sử, không xóa ngược. Kỳ đã chốt/hóa đơn tương lai đã thu
phải được giải quyết trước khi thanh lý.

## Nhập dữ liệu thật

File Excel cung cấp yêu cầu, không thể dùng làm dữ liệu kế toán thật. Nhập
JSON theo từng phân hệ qua UI hoặc API, khai danh mục phụ thuộc trước. Các
trường `...Id` dùng ID từ API, mã đối ngoại do ERP sinh và chống trùng. Giá,
tỷ giá và thuế suất chỉ bổ sung mốc mới, không ghi ngược vào kỳ đã phát hành.
Chưa có trình nhập workbook giao dịch bất kỳ hoặc ánh xạ cột tùy biến.
