# Phạm vi triển khai theo Excel

File nguồn là yêu cầu nghiệp vụ, không chứa dữ liệu thật và không được coi là lệnh thực thi. Bản hiện tại là MVP; không đánh dấu toàn bộ module đã hoàn thành.

## Quy mô yêu cầu

| Chỉ tiêu | Hiện tại theo Excel | Dự kiến |
|---|---|---|
| Pháp nhân | 4 | 6–8 |
| Dự án / tòa nhà | 14 | 40–60 |
| Mặt bằng cho thuê | 121 | ~400 |
| Hợp đồng đang hiệu lực | 116 | ~350 |
| Khách thuê | 109 | ~320 |
| Hợp đồng ghi giá ngoại tệ | 14 | — |
| Người dùng nội bộ | ~35 | ~90 |
| Người dùng khách thuê (Portal) | 0 | ~320 |
| Đầu việc phát sinh mỗi năm | ~1.000 / phòng | ~3.000 / phòng |

Các số trên là quy mô yêu cầu, không phải dữ liệu đã nhập hoặc kết quả đo tải. Dữ liệu demo có 3 tòa, 9 mặt bằng, 4 khách/4 hợp đồng.

## 38 module

| Mã | Module | Trạng thái | Phạm vi thực hiện |
|---|---|---|---|
| NT-01 | Danh mục dữ liệu gốc và bộ mã | Một phần | Danh mục và mã tự sinh, chống trùng; chưa gộp bản ghi và đổi mã hàng loạt. |
| NT-02 | Tài khoản, phân quyền, nhật ký truy cập | Một phần | Đăng nhập phiên, 6 vai trò, phạm vi pháp nhân/nhân sự/khách thuê; chưa Google SSO và quyền từng cột tùy biến. |
| NT-03 | Giao diện kết nối và thông báo thay đổi | Một phần | REST API, phân trang, truy vết, cap_nhat_tu; chưa OAuth2/API key hoặc webhook ký và retry. |
| NT-04 | Nhật ký thay đổi và chốt kỳ | Một phần | Audit before/after và khóa kỳ; chưa workflow bút toán điều chỉnh/khôi phục. |
| L1-01 | Báo cáo công việc — Phòng TCKT | Một phần | Công việc theo phòng, nghĩa vụ/chức danh, 4 trạng thái và hàng đợi duyệt. |
| L1-02 | Báo cáo công việc — Phòng Kinh doanh | Một phần | Công việc PKD; chưa toàn bộ chỉ số bán hàng tự động. |
| L1-03 | Báo cáo công việc — Ban Quản lý | Một phần | Công việc BQL, sự cố, bảo trì và giao diện điện thoại. |
| L1-04 | Báo cáo công việc — Marketing | Một phần | Công việc MKT; chưa đối soát attribution khách hàng. |
| L1-05 | Báo cáo công việc — HCNS | Một phần | Công việc HCNS; chưa tuyển dụng/mua sắm đầy đủ. |
| L1-06 | Gộp báo cáo toàn công ty | Một phần | Báo cáo gộp 5 phòng tự động theo kỳ, trạng thái và người. |
| L1-07 | Thang bảng lương | Một phần | Lương cơ bản và mức thưởng; chưa thang/ngạch/bậc hiệu lực theo ngày. |
| L1-08 | KPI – OKR | Một phần | KPI theo chức danh, trọng số, nguồn số, chốt kỳ; chưa khung thưởng nhiều ngưỡng. |
| L1-09 | Chạy thử lương thưởng theo KPI | Một phần | Chạy thử lương cũ/mới, hiển thị cách tính; chưa biên bản hiệu chỉnh. |
| L1-10 | Áp dụng chính thức lương thưởng theo KPI | Chưa triển khai | Chưa trả lương chính thức hoặc xử lý khiếu nại. |
| L1-11 | Thuế đầu vào – đầu ra đa pháp nhân | Một phần | Thuế từng dòng và tổng hợp đa pháp nhân; chưa tờ khai thuế. |
| L2-01 | Quản lý thu — hợp đồng, mặt bằng, hóa đơn, công nợ | Một phần | Hợp đồng, giá/tỷ giá theo ngày, công tơ, VAT, hóa đơn nội bộ, thu nhiều lần, cọc, thanh lý, tuổi nợ. Chưa e-invoice/email và tách gộp mặt bằng. |
| L2-02 | Quản lý chi | Một phần | Đề nghị chi → duyệt → thanh toán, chi phí bảo trì; chưa tự sinh chi định kỳ. |
| L2-03 | Dòng tiền và dự báo | Một phần | Thu chi thực tế và dự báo tối thiểu 3 tháng; chưa số dư ngân hàng/ngưỡng cảnh báo. |
| L2-04 | Hiệu quả dự án đang triển khai | Một phần | Lãi lỗ từng dự án theo kỳ; chưa đối chiếu tự động giả định thẩm định. |
| L2-05 | Đánh giá dự án đã hoạt động | Một phần | Biên lợi nhuận dự án đang vận hành theo tháng. |
| L2-06 | Thẩm định nhà nhập tiềm năng — Master Leasing | Một phần | Mô hình 120 tháng, 3 kịch bản, NPV/IRR/hòa vốn; chưa so sánh nhiều tòa và mô hình thuê chủ nhà nhiều giai đoạn. |
| L2-07 | Thẩm định dự án Managed Office | Một phần | Mô hình 60 tháng dùng khung thẩm định; chưa giá bán theo thỏa thuận hợp tác. |
| L2-08 | Thẩm định dự án Setup | Một phần | Mô hình Setup 60 tháng, vốn đầu tư, giá bán và hoàn vốn. |
| L2-09 | Quy trình vòng đời dự án Master Leasing — 10 năm | Một phần | Khung 7 bước Master Lease 10 năm, giao người/đơn vị, tài liệu, công việc tự sinh, chặn chuyển khi chưa duyệt. |
| L2-10 | Quy trình vòng đời Master Leasing — mô hình Gems Office, 5 năm | Một phần | Khung Gems Office 5 năm dùng chung cơ chế bàn giao. |
| L2-11 | Quy trình vòng đời Managed Office — OUT | Một phần | Khung Managed Office OUT, xác nhận từng bước và hồ sơ. |
| L2-12 | Quy trình vòng đời Managed Office — IN | Một phần | Khung Managed Office IN dùng chung workflow. |
| L2-13 | Quy trình vòng đời dự án Setup | Một phần | Khung Setup, bàn giao và theo dõi hoàn vốn. |
| L2-14 | Tiêu chuẩn công việc và chất lượng dịch vụ | Một phần | Phiếu chất lượng theo người/tòa/vị trí, điểm, ảnh và GPS nhập tay; điểm đưa vào KPI. Chưa bộ tiêu chuẩn cấu hình/tần suất tự sinh. |
| L2-15 | Bảng tổng hợp điều hành công ty | Một phần | Dashboard tổng hợp tài chính, lấp đầy, hiệu quả, phòng ban và cảnh báo, lọc pháp nhân/tòa. |
| L2-16 | Công việc liên phòng ban | Một phần | Công việc vòng đời có bàn giao giữa PKD/TCKT/BQL và lưu thời điểm; chưa cấu hình workflow liên phòng tùy ý. |
| VH-01 | Thiết bị kỹ thuật và bảo trì định kỳ | Một phần | Thiết bị, lịch/chu kỳ và nhật ký bảo trì sinh đề nghị chi; chưa ảnh và thông báo đẩy. |
| VH-02 | Sự cố và yêu cầu dịch vụ | Một phần | Tiếp nhận, SLA, phân công, xử lý, khách nghiệm thu, chuyển phí qua hóa đơn; chưa ảnh/biên bản. |
| CS-01 | Hồ sơ khách thuê và lịch sử chăm sóc | Một phần | CRM liên hệ và lịch sử hợp đồng, cảnh báo tái ký trong 90 ngày; chưa khảo sát. |
| CS-02 | Thông báo đa kênh | Một phần | Thông báo đọc trên portal; chưa gửi email/SMS/Zalo hoặc nhắc nợ đa cấp. |
| PT-01 | Portal khách thuê — bản web | Một phần | Tài khoản khách thuê riêng, hợp đồng/hóa đơn/thanh toán/công tơ/yêu cầu/thông báo trong phạm vi khách. |
| PT-02 | Ứng dụng di động iOS và Android | Chưa triển khai | Web responsive; chưa ứng dụng native, push hoặc xuất bản lên kho ứng dụng. |
| PT-03 | Thanh toán trực tuyến | Chưa triển khai | Thu thủ công, chưa QR theo hóa đơn hoặc kết nối ngân hàng/đối soát tự động. |

## Bổ sung nền ERP ngoài danh sách Excel

- Tài khoản kế toán, hạch toán kép hóa đơn/thu tiền/cọc/duyệt và trả chi phí; cân đối và bút toán đảo.
- Nhà cung cấp, mua sắm có duyệt, nhận hàng tạo khoản chi.
- Kho vật tư, nhập/xuất, chống tồn âm; chưa định giá/hạch toán tồn kho.
- Sao lưu SQLite nhất quán; nhập JSON atomic và xuất dữ liệu có quyền.

## 41 yêu cầu nghiệp vụ

Các yêu cầu được giữ nguyên để nghiệm thu chi tiết; không đồng nghĩa tất cả đã đạt.

### A-1 · L1-01 đến L1-05

Danh mục nghĩa vụ theo chức danh. Mỗi chức danh có bộ nghĩa vụ khai một lần; đầu việc kế thừa thuộc tính từ nghĩa vụ, không khai lại.

### A-2 · L1-01 đến L1-05

Mức thiệt hại bốn bậc định tính, khai ở danh mục nghĩa vụ. Không dùng thang theo giá trị tiền — Gems đã thử và bỏ vì nghĩa vụ với đầu việc con hầu như luôn lệch nhau.

### A-3 · L1-01 đến L1-05

Bốn trạng thái duyệt: chưa hoàn thành, chờ duyệt, đã duyệt HOẶC bị trả lại. Không phải hai trạng thái.

### A-4 · L1-01 đến L1-05

Vòng duyệt hai chiều. Việc hoàn thành tự nổi lên hàng đợi của Trưởng phòng; quyết định của Trưởng phòng ghi ngược về đúng bản ghi của nhân viên và việc rút khỏi hàng đợi.

### A-5 · L1-01 đến L1-05

Nhánh trả lại phải có đường ra. Việc bị trả lại cần một thao tác rõ ràng để nhân viên báo đã làm lại và đưa việc quay lại hàng đợi duyệt. Thiếu bước này việc bị kẹt vĩnh viễn — Gems đã gặp trên ba mã việc thật.

### A-6 · L1-01 đến L1-05

Chỉ số bó theo kỳ. Bảng phòng ban chỉ đếm việc có hạn hoàn thành rơi trong kỳ đang xem, không đếm toàn bộ số dòng trong hệ thống.

### A-7 · L1-01 đến L1-05

Điểm rủi ro tính từ mức thiệt hại và số ngày trễ.

### A-8 · L1-01 đến L1-05

Thời điểm ghi nhận do hệ thống quản lý. Cột ngày người dùng nhập và mốc thời gian hệ thống ghi phải tách nhau, nếu không thứ tự sự kiện sẽ sai khi người và máy cùng ghi.

### A-9 · L1-01 đến L1-05

Chuẩn hóa nhập liệu ngay khi gõ: ngày kiểu 5/9 hoặc 5-9-26; tỷ lệ kiểu 80% hoặc 0,8. Chặn ngày hoàn thành nằm ở tương lai.

### A-10 · L1-01 đến L1-05

Rà soát dữ liệu tự động hằng ngày: trùng mã, sai khuôn mã, thiếu hạn hoàn thành, nghĩa vụ không gắn với chức danh nào.

### A-11 · L1-01 đến L1-05

Nhập liệu trên điện thoại — bắt buộc với L1-03 vì Ban Quản lý có nhiều nhân sự hiện trường.

### B-12 · L2-01

Lộ trình giá thuê theo ngày hiệu lực. Một hợp đồng có nhiều mức giá theo từng giai đoạn. Sửa giá hôm nay KHÔNG được làm đổi số đã tính của các kỳ trước.

### B-13 · L2-01

Đơn giá dịch vụ theo hợp đồng nhân loại phí nhân ngày hiệu lực. Không gắn đơn giá vào khách hàng, vì một khách thuê hai tầng có thể có hai mức giá khác nhau. Yêu cầu quan trọng nhất của phụ lục này.

### B-14 · L2-01

Thuế suất tách theo từng loại phí: thuê văn phòng 10%, biển bảng 10%, điện 8%, xe 8%, nước 5%, ngoài giờ 10%, phí dịch vụ khác 8%. Kèm cờ khách có lấy hóa đơn thuế hay không.

### B-15 · L2-01

Hợp đồng ghi giá ngoại tệ. Bảng tỷ giá theo ngày, tra đúng mốc gần nhất của ĐÚNG hợp đồng đó, và không cộng dồn khi có hai mốc cùng ngày.

### B-16 · L2-01

Nhiều cách tính tiền nước: theo công tơ, theo khoán, hoặc hai cách cùng tồn tại trên một khách.

### B-17 · L2-01

Công tơ điện và nước: chỉ số đầu kỳ và cuối kỳ, tính ra sản lượng và tiền theo đơn giá đang hiệu lực.

### B-18 · L2-01

Bồi thường dừng hợp đồng trước hạn: báo trước đủ hai tháng thì đền hai tháng tiền thuê, không đủ thì đền bốn tháng. Chỉ áp cho trường hợp dừng trước hạn, không áp cho không gia hạn. Mỗi hợp đồng ghi đè được mức riêng.

### B-19 · L2-01

Tiền cọc: nhận, giữ, cấn trừ vào kỳ cuối, hoàn trả khi thanh lý.

### B-20 · L2-01

Thời gian miễn phí setup khai theo hợp đồng và tự loại khỏi kỳ thu.

### B-21 · L2-01

Đóng hợp đồng kéo hai hiệu ứng dây chuyền: mặt bằng tự chuyển sang trạng thái trống, và các kỳ chưa tới hạn tự dừng thu; kỳ đã qua giữ nguyên, không sửa ngược.

### B-22 · L2-01

Mã hợp đồng dẫn xuất từ mã mặt bằng và mã khách; gia hạn thêm hậu tố lần 2, lần 3. Sửa mã khách thì mọi tham chiếu đi theo.

### B-23 · L2-01

Nhật ký thu tiền: một hóa đơn có thể thu nhiều lần, nhiều ngày, nhiều hình thức.

### B-24 · L2-01

Hóa đơn: sinh theo kỳ, đánh số riêng theo từng pháp nhân, xuất PDF, gửi email. Nêu rõ có kết nối được hóa đơn điện tử và phần mềm kế toán đang dùng hay không, và chi phí kết nối do bên nào chịu.

### B-25 · L2-01

Công nợ theo tuổi nợ 0-30, 30-60, 60-90, trên 90 ngày; bảng cảnh báo chỉ liệt kê hợp đồng tới hạn trong 90 ngày tới, không liệt kê toàn bộ.

### B-26 · L2-01

Lấp đầy theo tháng: số mặt bằng trống, mét vuông trống, tỷ lệ trống, và giá trị tiền của phần đang trống.

### B-27 · L2-01

Đa pháp nhân: hóa đơn xuất theo pháp nhân đứng tên hợp đồng; báo cáo lọc được theo từng pháp nhân và theo cả nhóm.

### C-28 · L1-08

Bộ KPI khai theo chức danh, không khai theo từng người, để người mới vào vị trí là kế thừa ngay.

### C-29 · L1-08

Mỗi chỉ tiêu khai rõ nguồn số: lấy tự động từ module nào, hay do ai nhập tay. Chỉ tiêu không nói được nguồn thì không được đưa vào khung tính thưởng.

### C-30 · L1-08

Trọng số và ngưỡng: mức tối thiểu, mức đạt, mức vượt; công thức quy đổi ra phần trăm hoàn thành.

### C-31 · L1-08

Khung quy đổi thưởng từ phần trăm hoàn thành ra số tiền, theo ngạch lương của L1-07.

### C-32 · L1-08

Chốt kỳ và đóng băng. Sau khi chốt, số liệu kỳ đó chỉ đọc.

### C-33 · L1-08

Chạy thử song song với cách tính cũ ít nhất một kỳ trước khi áp dụng thật — yêu cầu bắt buộc của Gems, không phải tùy chọn.

### C-34 · L1-08

Người lao động xem được cách tính của chính mình, không chỉ xem con số cuối cùng.

### D-35 · L2-06 đến L2-08

Mô hình dòng tiền theo tháng cho toàn vòng đời: 10 năm với Master Leasing, 5 năm với Managed Office và Setup.

### D-36 · L2-06 đến L2-08

Đầu vào phía chi phí: giá thuê trả chủ nhà, lộ trình tăng giá theo năm, thời gian miễn phí, tiền cọc phải đặt, chi phí setup ban đầu, chi phí vận hành, chi phí marketing và bán hàng.

### D-37 · L2-06 đến L2-08

Đầu vào phía doanh thu: diện tích cho thuê được, giả định giá bán và lộ trình tăng, giả định tốc độ lấp đầy theo tháng, giả định tỷ lệ khách rời đi.

### D-38 · L2-06 đến L2-08

Ba kịch bản tốt, cơ sở, xấu — chạy đồng thời, hiển thị cạnh nhau.

### D-39 · L2-06 đến L2-08

Chỉ số quyết định: điểm hòa vốn theo tháng, tổng lãi lỗ vòng đời, giá trị hiện tại ròng, tỷ suất hoàn vốn nội bộ, mức lấp đầy tối thiểu để không lỗ.

### D-40 · L2-06 đến L2-08

So sánh nhiều tòa nhà cạnh nhau trên cùng bộ tiêu chí, để chọn giữa các cơ hội đang đàm phán.

### D-41 · L2-06 đến L2-08

Bộ giả định được lưu lại và chuyển tiếp sang L2-04 và L2-05, để sau này đối chiếu dự án chạy thật với mô hình lúc quyết định.

## Những giới hạn nghiệp vụ hiện tại

- Giá rent theo m²/tháng hoặc khoán tháng; công tơ chia sản lượng theo ngày để áp đơn giá hiệu lực. Chưa khai chỉ số theo thời điểm trong tháng hoặc phân bổ nhiều công tơ.
- Cọc có nghiệp vụ nhận/giữ/cấn trừ/hoàn và bút toán; bồi thường thanh lý là khoản dự kiến, chưa tự phát hành hóa đơn bồi thường hoặc cấn trừ bồi thường.
- Mã dẫn xuất và gia hạn có sẵn; chưa tách/gộp mặt bằng hoặc đổi mã khách kéo toàn bộ tham chiếu.
- Hóa đơn in/lưu PDF bằng trình duyệt là chứng từ nội bộ, không phải hóa đơn điện tử pháp định.
- Lấp đầy tháng dựa trên diện tích các mặt bằng đã khai, có hợp đồng giao thời gian với tháng; chưa bình quân theo từng ngày.
- Dự báo là mức tối thiểu từ lịch giá hợp đồng và chi phí đã duyệt: chưa có số dư mở/ngân hàng, kịch bản dòng tiền đầy đủ, hoặc tự sinh lịch chi từ hợp đồng chủ nhà. Hợp đồng thiếu chỉ số/tỷ giá sẽ chưa được tính vào dự báo.
- KPI theo chức danh có nguồn số, trọng số và điểm; bonus tuyến tính tối đa 120%, chưa ngạch/bậc, nhiều ngưỡng, duyệt áp dụng chính thức hoặc xử lý khiếu nại.
- Chưa đánh giá rủi ro đầy đủ, chuẩn hóa nhập ngày/tỷ lệ dạng tự do hoặc scheduler rà soát dữ liệu hằng ngày.
- Vòng đời có 5 mẫu cơ sở và bàn giao PKD/TCKT/BQL; chưa cấu hình bộ bước theo quy trình thật của Gems hoặc lịch chạy theo các năm. Tài liệu là link, chưa kho file. Phiếu chất lượng có ảnh lưu SQLite và GPS nhập tay, chưa định vị tự động/lịch chấm theo tần suất.
- Chưa tích hợp Google SSO, e-invoice, cổng ngân hàng, Zalo/email/SMS hoặc app native. Không tự gửi thông báo ra bên ngoài.
- Quyền là bộ vai trò/phạm vi cố định phía máy chủ, chưa trình cấu hình quyền theo từng cột. Tài khoản chưa có đặt lại mật khẩu/MFA hoặc quản lý vòng đời đầy đủ.
- Sổ kế toán chưa số dư đầu, khấu hao/phân bổ, kế toán giá vốn hay báo cáo tài chính/thuế pháp định. Bút toán đảo không tự sửa sổ công nợ và phải đối soát khi dùng.

## Các bước tiếp theo để triển khai toàn doanh nghiệp

1. Nghiệm thu module và từng phụ lục với dữ liệu thật; xác nhận quy tắc thang lương, phí, dự báo và kỳ kế toán.
2. Chọn nhà cung cấp SSO, hóa đơn điện tử, ngân hàng/thanh toán và thông báo; cung cấp cấu hình qua môi trường bảo mật, không đặt secret vào mã.
3. Hoàn thiện quy trình vòng đời, chất lượng dịch vụ và trả lương chính thức sau ít nhất một kỳ chạy thử.
4. Bổ sung quản lý tài khoản, TLS, giám sát, backup/restore được diễn tập và kiểm thử tải theo quy mô yêu cầu.
5. Đánh giá chuyển sang PostgreSQL và triển khai nhiều instance nếu cần vận hành quy mô/HA.
