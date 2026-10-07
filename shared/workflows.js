const step=(name,department,document)=>({name,department,document});
const survey=step('Khảo sát & tiếp nhận cơ hội','PKD','Biên bản khảo sát');
const appraisal=step('Thẩm định & phê duyệt tài chính','TCKT','Hồ sơ thẩm định đã duyệt');
const signing=step('Ký kết hợp đồng đầu vào','PKD','Hợp đồng đã ký');
const setup=step('Setup & nghiệm thu bàn giao','BQL','Biên bản nghiệm thu');
const operation=step('Khai thác & vận hành','BQL','Báo cáo vận hành');
const renewal=step('Đánh giá & gia hạn','PKD','Phương án gia hạn');
const closure=step('Thanh lý & quyết toán','TCKT','Biên bản thanh lý');
export const workflowTemplates={
 'Master Lease 10 năm':[survey,appraisal,signing,setup,operation,renewal,closure],
 'Gems Office 5 năm':[survey,appraisal,signing,setup,operation,closure],
 'Managed Office OUT':[survey,appraisal,step('Thỏa thuận hợp tác bên ngoài','PKD','Thỏa thuận hợp tác'),setup,operation,closure],
 'Managed Office IN':[survey,appraisal,step('Phê duyệt nội bộ Master Lease','PKD','Phê duyệt nội bộ'),setup,operation,closure],
 'Setup':[survey,appraisal,signing,setup,step('Bàn giao & theo dõi hoàn vốn','BQL','Biên bản bàn giao'),closure],
};
