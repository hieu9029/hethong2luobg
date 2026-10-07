# Gems Office — ERP quản lý tòa nhà

Bản ERP MVP chạy được, xây theo **Hệ thống 2 luồng - Gems Office.xlsx**.
File Excel là bản yêu cầu gồm 38 module, 41 yêu cầu nghiệp vụ và các quy tắc
liên thông dữ liệu; không có danh sách khách hàng/hợp đồng/giao dịch thật.
Danh mục gốc được lưu ở `shared/requirements.json`. Màn hình **Bản đồ nghiệp
vụ Excel** đối chiếu phần đã làm và phần còn thiếu của từng module.

## Chạy

Mã nguồn: [hieu9029/hethong2luobg](https://github.com/hieu9029/hethong2luobg).
Chọn **Code → Download ZIP** rồi giải nén, hoặc dùng `git clone https://github.com/hieu9029/hethong2luobg.git`.

Yêu cầu Node.js **24 trở lên**, npm. Không cần API key để dùng các chức năng
nội bộ đã triển khai.

```bash
cd /workspace/hethong2luobg
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev
```

Ngoài môi trường đám mây, dùng `cd hethong2luobg`, `npm ci`, `npm run dev` trong thư mục đã giải nén; không cần chỉ định cache `/workspace`.

Lệnh này chạy Vite ở cổng 5173 và API Node.js ở cổng 3001. Giao diện proxy API
qua cùng origin. Trong cloud onboarding, các địa chỉ loopback chỉ dùng cho
kiểm tra nội bộ, không phải link preview cho người dùng.

Lần đầu mở ứng dụng, tạo tài khoản quản trị và **tự đặt mật khẩu** (ít nhất
12 ký tự). Có thể chọn thêm dữ liệu minh họa hoặc bắt đầu trống. Không có tài
khoản/mật khẩu mặc định. Mật khẩu lưu bằng scrypt + salt; phiên cookie
HttpOnly/SameSite hết hạn sau 8 giờ. Tài khoản khách thuê do quản trị viên cấp,
gắn với một khách thuê và chỉ truy cập dữ liệu thuộc khách đó.

Database bền vững nằm tại `data/erp.sqlite`, dùng SQLite WAL. Dữ liệu được
lưu ở máy chủ, không còn dựa vào localStorage của ứng dụng ban đầu. Dữ liệu
SQLite và bản sao lưu không được đưa vào Git và bị chặn phục vụ qua Vite.

## Dữ liệu demo

Sau khi cài phụ thuộc, tạo dữ liệu minh họa bằng:

```bash
npm run seed:demo
npm run dev
```

Bộ mẫu gồm 4 pháp nhân, 3 tòa nhà, 9 mặt bằng, 4 khách thuê/hợp đồng,
5 nhân sự ở 5 phòng ban; hóa đơn và thu/chi trong 6 tháng, tiền cọc,
bút toán kế toán, công việc/KPI, thiết bị, sự cố, thông báo, thẩm định,
đề nghị mua sắm và một mã vật tư. Một số hóa đơn tháng hiện tại chưa thu
hoặc thu một phần để xem công nợ. Kho vật tư ban đầu có tồn bằng 0 để thử nhập kho.
Các tên, địa chỉ, email và giao dịch đều giả lập; email dùng `example.com`.
Kỳ dữ liệu lấy theo ngày tạo; chạy lại giữ nguyên kỳ và không sinh bản ghi trùng.

Lệnh không tạo tài khoản hay mật khẩu. Nếu chưa khởi tạo, mở ứng dụng và tự
tạo quản trị viên; tùy chọn dữ liệu minh họa lúc tạo quản trị không nhân đôi
bộ dữ liệu đã có. Tài khoản hiện có được giữ nguyên.

Lệnh từ chối thêm demo nếu database đã có dữ liệu nghiệp vụ khác. Để trải
nghiệm ở database riêng mà giữ dữ liệu hiện tại (Bash):

```bash
ERP_DB=data/demo.sqlite npm run seed:demo
ERP_DB=data/demo.sqlite npm run dev
```

## Các phân hệ có chức năng

| Nhóm | Chức năng |
|---|---|
| Nền tảng | Pháp nhân, mã dữ liệu, đăng nhập, 6 vai trò, phạm vi pháp nhân/nhân sự/khách thuê, nhật ký before/after, khóa kỳ |
| Tài sản | Tòa nhà, 3 mô hình dự án, mặt bằng, trạng thái khai thác |
| Khách thuê | Hồ sơ doanh nghiệp, liên hệ, ghi chú chăm sóc, nhiều hợp đồng, cảnh báo hết hạn trong 90 ngày |
| Hợp đồng | Thời hạn, miễn phí setup, cọc, mã dẫn xuất, gia hạn, thanh lý và bồi thường 2/4 tháng có ghi đè |
| Tài chính | Giá/phí theo hợp đồng và ngày hiệu lực, USD và tỷ giá riêng, thuế từng loại phí, chỉ số công tơ |
| Hóa đơn | Lập theo kỳ, giá/thuế chụp tại thời điểm phát hành, mã theo pháp nhân, in/lưu PDF nội bộ, thu nhiều lần, tuổi nợ |
| Chi phí | Đề nghị → duyệt → thanh toán, thuế đầu vào, chi phí tự sinh từ bảo trì và nhận hàng |
| Kế toán | Tài khoản, bút toán kép tự sinh, sổ nhật ký, bảng cân đối, bút toán đảo trong kỳ mở |
| Mua sắm/kho | Nhà cung cấp, duyệt đề nghị mua, nhận hàng tạo đề nghị chi, vật tư, nhập/xuất và chống tồn âm |
| Vận hành | Thiết bị, chu kỳ/lịch bảo trì, nhật ký và chi phí, sự cố/SLA, phân công → xử lý → nghiệm thu |
| Hiệu suất | 5 phòng ban, nhân sự, nghĩa vụ theo chức danh, 4 trạng thái duyệt, trả lại → sửa → gửi lại, thống kê theo hạn trong kỳ |
| KPI/lương | KPI theo chức danh, nguồn tự động/thủ công, trọng số, xem cách tính, đối chiếu lương cũ và lương thử |
| Đầu tư | Master Lease 120 tháng, Managed Office/Setup 60 tháng; 3 kịch bản, NPV, IRR, hòa vốn và dòng tiền từng tháng |
| Vòng đời/chất lượng | 5 mẫu quy trình, sinh việc theo phòng, chặn chuyển bước khi chưa duyệt, hồ sơ bàn giao; phiếu chất lượng có ảnh/GPS nhập tay và nguồn KPI |
| Điều hành | Dashboard, doanh thu, lấp đầy, công nợ, dòng tiền thực tế/dự báo, hiệu quả tòa nhà, cảnh báo, lọc pháp nhân/tòa/kỳ |
| Portal | Khách thuê xem hợp đồng, hóa đơn, lịch sử thu, điện nước, thông báo; gửi và nghiệm thu yêu cầu |
| Dữ liệu | API REST, phân trang, lấy thay đổi từ mốc thời gian, xuất JSON toàn bộ, CSV trang hiện tại, nhập JSON có rollback, sao lưu SQLite |

## Kiểm tra

```bash
npm test
npm run build
npm run test:browser
ERP_TEST_MODE=production npm run test:browser
```

`npm test` chạy kiểm thử quy tắc tài chính và API với database in-memory riêng.
`test:browser` tự khởi động Vite/database kiểm thử, không sửa database thật;
cần Chromium tại `/usr/bin/chromium` (đã có trong môi trường này). Có thể chọn
trình duyệt đã cài bằng `BROWSER_EXECUTABLE=/đường/dẫn/chromium`.

Để chạy bản build với API cùng origin:

```bash
npm run build
npm start
```

API mặc định chỉ bind `127.0.0.1:3001`. `API_PORT`, `API_HOST` có thể đổi khi
triển khai. `ERP_DB` có thể chỉ định đường dẫn database ngoài checkout.
`SESSION_SECURE=1` dành cho triển khai sau reverse proxy HTTPS; cookie Secure
không dùng cho phát triển qua HTTP. Khi triển khai thật, hoàn tất tạo quản trị
trong mạng riêng trước khi mở truy cập, dùng HTTPS và sao lưu định kỳ.

## Sao lưu

```bash
npm run backup
```

Sao lưu online nhất quán bằng SQLite backup API vào `backups/`; không ghi đè
file đã tồn tại. Có thể chỉ định đích: `npm run backup -- /workspace/backup.sqlite`.
Để kiểm tra/khôi phục mà vẫn giữ bản hiện tại: dừng dịch vụ và khởi động với
`ERP_DB=/đường/dẫn/bản-sao.sqlite npm start`. Không sao chép riêng file SQLite
đang chạy và bỏ qua WAL. File backup chứa dữ liệu và tài khoản của hệ thống,
cần giữ trong nơi có quyền truy cập phù hợp.

## Giới hạn được ghi rõ

Đây là **bản MVP**, chưa phải toàn bộ 38 module đạt đủ mọi yêu cầu. Các phần
thiếu được nêu ở [phạm vi triển khai](docs/SCOPE.md) và trong ứng dụng:

- Chưa Google Workspace SSO, OAuth2/API key, webhook ký/retry.
- Chưa hóa đơn điện tử hợp pháp, gửi email/SMS/Zalo, QR ngân hàng/đối soát tự động.
- Chưa ứng dụng native iOS/Android, push hoặc xuất bản lên kho ứng dụng.
- Workflow dùng các mẫu cơ sở; chưa quy trình chi tiết đã nghiệm thu với Gems, scheduler theo vòng đời hoặc kho tài liệu đính kèm. Phiếu chất lượng có ảnh/GPS nhập tay, chưa tự lấy vị trí hoặc lịch chấm tự động.
- Chưa trả lương chính thức, thang ngạch/bậc, bảo hiểm/thuế TNCN hoặc khiếu nại lương.
- Sổ kế toán nội bộ chưa bao gồm kỳ đầu/số dư mở, khấu hao, phân bổ, báo cáo tài chính
  pháp định hoặc định giá tồn kho. Đảo bút toán không tự đảo giao dịch nghiệp vụ.
- SQLite phù hợp bản chạy một máy; chưa triển khai HA, phân tán hoặc đo tải theo quy
  mô 40–60 tòa nhà/90 người dùng. Chưa triển khai ứng dụng ra Internet.

## Tổ chức mã

- `src/`: giao diện ERP responsive, bảng dữ liệu, biểu mẫu và workflow.
- `shared/schema.js`: định nghĩa phân hệ và trường dữ liệu dùng chung.
- `shared/requirements.json`: nội dung yêu cầu từ Excel.
- `server/`: API, xác thực, SQLite, nghiệp vụ và dữ liệu minh họa.
- `tests/`: kiểm thử tài chính/API và luồng trình duyệt.
- `scripts/`: khởi động dev và sao lưu.
- `docs/`: API và phạm vi ERP theo file nguồn.
