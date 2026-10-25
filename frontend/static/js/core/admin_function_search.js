import {adminSections} from '../data/admin_navigation.js';

const templates=new URL('../../../templates/',import.meta.url);
const names=new Map(adminSections.flatMap(([,items])=>items.map(([page,title])=>[page,title])));
const feature=(id,page,title,selector,keywords='',tab='')=>({id,page,title,selector,keywords,tab,section:names.get(page)});
export const adminFunctions=Object.freeze([
  ...[...names].filter(([page])=>page!=='profile').map(([page,title])=>feature(`${page}-page`,page,title,'#page-body')),
  ...['users','doctors','assignments','departments','rooms','schedule','patients'].map(page=>feature(`${page}-create`,page,({users:'Tạo tài khoản nhân viên',doctors:'Thêm hồ sơ bác sĩ',assignments:'Phân công y tá theo ca',departments:'Thêm chuyên khoa',rooms:'Thêm phòng khám',schedule:'Tạo ca làm việc',patients:'Thêm bệnh nhân'})[page],'#add-record','thêm mới tạo')),
  ...['users','doctors','assignments','departments','rooms','schedule','patients','encounters'].flatMap(page=>[
    feature(`${page}-search`,page,`Tìm kiếm, lọc ${names.get(page).toLocaleLowerCase('vi')}`,'#resource-filter','tra cứu danh sách'),
    feature(`${page}-detail`,page,`Xem chi tiết ${names.get(page).toLocaleLowerCase('vi')}`,'#admin-results','thông tin'),
    ...(['encounters'].includes(page)?[]:[feature(`${page}-edit`,page,`Chỉnh sửa ${names.get(page).toLocaleLowerCase('vi')}`,'#admin-results','cập nhật sửa lưu thay đổi')]),
  ]),
  feature('users-access','users','Khóa, mở khóa và phân quyền tài khoản','#admin-results','vai trò quyền trạng thái nhân viên'),
  feature('department-content','departments','Nội dung giới thiệu, hình ảnh chuyên khoa','#admin-results','ảnh bìa thư viện dịch vụ thiết bị thành tựu'),
  feature('department-members','departments','Thành viên và lãnh đạo chuyên khoa','#admin-results','trưởng khoa phó khoa phân công bác sĩ chức vụ'),
  feature('reception-assignment-create','reception_assignments','Phân công lễ tân theo ca','#add-reception-assignment','thêm tạo phân công quầy sảnh'),
  feature('assignment-revoke','assignments','Thu hồi phân công y tá','#admin-results','hủy ngừng phân công'),
  feature('leave-list','schedule','Đơn xin nghỉ và xét duyệt','#leave-filter','duyệt nghỉ từ chối đơn nhân viên'),
  feature('schedule-visits','schedule','Lượt khám trong ca làm việc','#admin-results','xem chi tiết ca bác sĩ phòng'),
  feature('patient-history','patients','Lịch sử khám, bệnh án và đơn thuốc','#admin-results','hồ sơ người thân kết quả khám giao dịch'),
  feature('payment-search','payments','Tìm kiếm giao dịch thanh toán','#payment-search','tiền cọc phí khám'),
  feature('payment-detail','payments','Chi tiết giao dịch thanh toán','#payment-results','thông tin giao dịch'),
  feature('refund-history','payments','Lịch sử hoàn tiền','#refund-search','tra cứu hoàn tiền'),
  feature('refund-request','payments','Yêu cầu hoàn tiền','#request-refund','hoàn cọc hoàn nhiều giao dịch'),
  feature('article-create','articles','Viết bài mới','#page-header [data-article-action="create"]','thêm tạo tin tức đăng bài'),
  feature('article-search','articles','Tìm kiếm và lọc tin tức','#article-filters','bài viết danh mục trạng thái'),
  feature('article-edit','articles','Chỉnh sửa, nội dung và hình ảnh bài viết','#article-results','thêm mục đoạn ảnh tiêu đề'),
  feature('article-publish','articles','Đăng bài, hẹn đăng và bản nháp','#article-results','xuất bản xác nhận tin tức'),
  feature('review-search','reviews','Tìm kiếm và lọc đánh giá','#feedback-filters','số sao bác sĩ phản hồi'),
  feature('review-detail','reviews','Chi tiết đánh giá','#feedback-results','nội dung phản hồi'),
  feature('review-visibility','reviews','Ẩn, hiện đánh giá','#feedback-results','ẩn phản hồi xác nhận'),
  feature('notification-search','notifications','Tìm kiếm và lọc thông báo','#feedback-filters','chưa đọc đã đọc loại thông báo'),
  feature('notification-detail','notifications','Chi tiết thông báo và hoạt động liên quan','#feedback-results','xem nội dung'),
  feature('overview-chart','home','Biểu đồ lượt khám theo tuần','#admin-weekly-chart','thống kê ngày'),
  feature('overview-visits','home','Lượt khám hôm nay','#admin-overview-recent','danh sách tổng quan'),
  feature('overview-calendar','home','Lịch làm việc bác sĩ trên tổng quan','.admin-overview-schedules','lịch ngày phòng'),
  feature('overview-notices','home','Thông báo trên tổng quan','.admin-overview-notifications','hộp thư chưa đọc'),
  feature('report-filter','statistics','Bộ lọc thời gian và chuyên khoa báo cáo','#statistics-filter','từ ngày đến ngày'),
  ...[['overview','Tổng hợp'],['encounters','Lượt khám'],['departments','Chuyên khoa'],['doctors','Bác sĩ'],['payments','Thanh toán'],['capacity','Công suất'],['reviews','Đánh giá']].map(([tab,title])=>feature(`report-${tab}`,'statistics',`Báo cáo ${title.toLocaleLowerCase('vi')}`,'#statistics-results',`thống kê biểu đồ ${title}`,tab)),
  feature('report-export','statistics','Xuất CSV báo cáo','#statistics-export','xuất file tải thống kê'),
  ...[['HOSPITAL_NAME','Tên cơ sở'],['SUPPORT_PHONE','Điện thoại hỗ trợ'],['SUPPORT_EMAIL','Email hỗ trợ'],['EXAM_HOURS','Giờ khám'],['ALLOW_WALK_IN','Tiếp nhận trực tiếp'],['REMINDER_BEFORE_HOURS','Nhắc lịch khám'],['APPOINTMENT_HOLD_MINUTES','Thời gian giữ chỗ'],['CHECKIN_EARLY_MINUTES','Đến trước giờ hẹn'],['CHECKIN_LATE_MINUTES','Tiếp nhận muộn'],['NO_SHOW_GRACE_MINUTES','Thời gian chờ sau ca'],['DEFAULT_DEPOSIT_PERCENT','Tỷ lệ đặt cọc'],['CANCEL_HOURS_LIMIT','Mốc hủy lịch hoàn cọc'],['CANCEL_REFUND_PERCENT','Tỷ lệ hoàn cọc'],['NO_SHOW_FORFEIT_DEPOSIT','Chính sách không đến khám']].map(([key,title])=>feature(`config-${key.toLowerCase()}`,'configuration',`Cấu hình ${title.toLocaleLowerCase('vi')}`,`[data-form="configuration"][data-key="${key}"], #config-${key}-help`,'thiết lập hệ thống')),
  feature('audit-search','audit','Tìm kiếm và lọc nhật ký hoạt động','#activity-log-filter','admin người thực hiện thay đổi từ ngày đến ngày'),
  feature('audit-detail','audit','Chi tiết thay đổi trước và sau','#activity-results','nhật ký lịch sử hoạt động'),
]);
export const normalizeFunctionQuery=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'d').toLowerCase().trim();
export function searchAdminFunctions(query,limit=8){
  const terms=normalizeFunctionQuery(query).split(/\s+/).filter(Boolean);
  return adminFunctions.map((item,index)=>{
    const title=normalizeFunctionQuery(item.title),haystack=normalizeFunctionQuery(`${item.title} ${item.section} ${item.keywords}`);
    return {item,index,score:terms.reduce((score,term)=>score+(title.includes(term)?3:1),0),matches:terms.every(term=>haystack.includes(term))};
  }).filter(row=>row.matches).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit).map(row=>row.item);
}
export function adminFunctionUrl(item){
  const url=new URL(`(admin)/${item.page}.html`,templates);url.searchParams.set('admin_function',item.id);return url;
}


