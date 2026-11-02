// Free, deterministic assistant. Only public directory APIs are used.
import { normalize, contains, hasPhrase, createGuidance, findFaq, findTopic, urgentGuidance } from './chatbot_guidance.js';
import { departmentAliases } from '../data/chatbot_knowledge.js';
export { normalize } from './chatbot_guidance.js';
const targets = {
  booking:{label:'Đặt lịch khám',href:'../(patient)/portal.html'},
  appointments:{label:'Lịch khám của bạn',href:'../(patient)/appointments.html'},
  records:{label:'Hồ sơ sức khỏe',href:'../(patient)/records.html'},
  doctors:{label:'Danh sách bác sĩ',href:'doctors.html'},
  contact:{label:'Liên hệ nhân viên',href:'contact.html'},
  login:{label:'Đăng nhập',href:'../auth/login.html'},
};
const link=(label,page,id)=>({label,href:`${page}.html?id=${encodeURIComponent(id)}`});
const result=(text,links=[])=>({text,links,modeLabel:'NEU Medical · Tra cứu miễn phí'});
const fee=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0
  ?`${Number(value).toLocaleString('vi-VN')} đồng`:'Chưa cập nhật phí khám';
const active=row=>row.is_active!==false&&row.is_active!==0;
async function allPages(load,params={}) {
  const rows=[];
  for(let page=1;page<=50;page++) {
    const data=await load({...params,page,page_size:100});
    if(!Array.isArray(data?.items))throw new Error('Invalid public directory');
    rows.push(...data.items);
    if(Number.isFinite(data.total)?rows.length>=data.total:!data.page||data.items.length<100)return rows;
    if(!data.items.length)throw new Error('Incomplete directory');
  }
  throw new Error('Directory is too large');
}
function doctorAnswer(rows,department,prefix='') {
  const selected=rows.filter(active).slice(0,4);
  if(!selected.length)return result(`${prefix}\nChưa có bác sĩ được công khai${department?` thuộc ${department.name}`:''}. Bạn hãy liên hệ nhân viên; tôi không có dữ liệu để xác nhận lịch trống.`,[targets.contact,targets.doctors]);
  return result([prefix,`Một số bác sĩ${department?` thuộc ${department.name}`:''} trong hệ thống:`,
    ...selected.map(d=>`${d.full_name} — ${d.department_name||d.specialization||department?.name||'Chuyên môn đang cập nhật'}\nPhí khám niêm yết: ${fee(d.consultation_fee)}`),
    'Xem hồ sơ và kiểm tra khung giờ tại trang đặt khám. Danh sách này không xếp hạng bác sĩ; giá trên không phải tổng chi phí thuốc/xét nghiệm.'].filter(Boolean).join('\n\n'),
    [...selected.map(d=>link(d.full_name,'doctor_detail',d.doctor_profile_id)),targets.booking]);
}
export function createAssistant(api) {
  const guidance=createGuidance();
  let departmentId;
  return async function answer(message) {
    const q=normalize(message);
    if(!q)return result('Bạn muốn tìm hiểu thông tin gì?');
    const urgent=urgentGuidance(message);
    if(urgent){guidance.clear();departmentId=undefined;return result(urgent.text,[targets.contact]);}
    if(/(?:\bsk-[\w-]+|\b\d{9,12}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(message)
       &&!contains(q,['bác sĩ','liên hệ','email bệnh viện']))return result('Bạn không cần gửi số điện thoại, giấy tờ, khóa truy cập hoặc dữ liệu cá nhân. Hãy chỉ mô tả ngắn câu hỏi và dùng cổng bệnh nhân cho thông tin riêng.',[targets.login]);
    if(contains(q,['uống thuốc','uống gì','kê thuốc','kê đơn','liều thuốc','thuốc gì','chẩn đoán','bệnh gì']))
      return result('Tôi có thể giúp tìm chuyên khoa và bác sĩ, nhưng không xác định bệnh, kê đơn hay chọn thuốc/liều dùng. Bạn có thể mô tả triệu chứng ngắn gọn để được hướng dẫn nơi khám; nếu cần điều trị hãy trao đổi trực tiếp với bác sĩ.',[targets.booking,targets.contact]);
    const faq=findFaq(message);
    if(faq&&!findTopic(message)) {
      const pending=guidance.inspect(message);
      if(pending?.kind==='emergency'||pending?.kind==='urgent'){departmentId=undefined;return result(pending.text,[targets.contact]);}
      guidance.clear();
      return result(faq.text,[targets[faq.target],...(faq.target==='contact'?[]:[targets.contact])]);
    }
    const directoryIntent=contains(q,['danh sách','tất cả','các khoa','khoa mắt','khoa nội','khoa ngoại','khoa nhi','khoa tim','khoa da','khoa tai','khoa tiêu','khoa thận','khoa thần','khoa răng','khoa cơ','khoa hô','khoa sản','khoa dinh','khoa tiết','khoa không']);
    if(directoryIntent&&!findTopic(message))guidance.clear();
    const route=guidance.inspect(message);
    if(route?.kind==='emergency'||route?.kind==='urgent'){departmentId=undefined;return result(route.text,[targets.contact]);}
    if(route?.kind==='question')return result(route.text,[targets.contact,route.source]);
    if(route?.kind==='recommendation') {
      try {
        const departments=(await allPages(api.departments)).filter(active);
        const department=route.departments.map(name=>departments.find(d=>normalize(d.name).replace(/^khoa /,'')===normalize(name))).find(Boolean);
        if(!department)return result(`${route.text}\nChưa có chuyên khoa phù hợp trong danh mục công khai. Hãy liên hệ nhân viên để được hướng dẫn.`,[targets.contact,route.source]);
        departmentId=department.department_id;
        const rows=await allPages(api.doctors,{department_id:departmentId});
        const answer=doctorAnswer(rows.filter(d=>String(d.department_id)===String(departmentId)),department,route.text);
        answer.links.push(route.source);guidance.clear();
        return answer;
      }catch{return unavailable(route.text,[route.source]);}
    }
    if(contains(q,['xin chào','chào','hello','cảm ơn'])) {guidance.clear();return result('Xin chào! Tôi giúp tìm nơi khám theo triệu chứng cơ bản, tra cứu chuyên khoa, bác sĩ, phí và cách đặt lịch. Ví dụ: “Tôi đau bụng thì khám ở đâu?” hoặc “Khoa Mắt có bác sĩ nào?”.');}
    try {
      const departments=(await allPages(api.departments)).filter(active);
      const matched=departments.filter(d=>hasPhrase(q,normalize(d.name).replace(/^(khoa|chuyen khoa) /,''))
        ||contains(q,Object.entries(departmentAliases).find(([name])=>normalize(name)===normalize(d.name))?.[1]||[]))
        .sort((a,b)=>b.name.length-a.name.length)[0];
      if(matched){departmentId=matched.department_id;guidance.clear();}
      if(contains(q,['liên hệ','hotline','điện thoại','email','giờ khám','giờ làm việc','mở cửa','địa chỉ','ở đâu'])&&!matched) {
        const data=await api.contact();guidance.clear();
        return result([data.hospital_name||'NEU Medical',`Điện thoại: ${data.support_phone||'Chưa cập nhật'}`,`Email: ${data.support_email||'Chưa cập nhật'}`,`Giờ khám: ${data.exam_hours||'Chưa cập nhật'}`,'Xem địa chỉ và bản đồ tại trang liên hệ.'].join('\n'),[targets.contact]);
      }
      const wantsDoctors=contains(q,['bác sĩ','bs','phí','giá khám','bao nhiêu','chi phí','ai khám']);
      if(wantsDoctors) {
        const all=(await allPages(api.doctors)).filter(active);
        const byName=all.filter(d=>hasPhrase(q,d.full_name.replace(/^BS\.?\s*/i,'')));
        if(!matched&&!byName.length&&/\bkhoa\s+\S/.test(q)&&!contains(q,['khoa này','khoa đó','chuyên khoa']))
          return result('Tôi chưa xác định được chuyên khoa bạn muốn hỏi trong danh mục. Bạn thử nhập đúng tên khoa hoặc xem danh sách chuyên khoa nhé.',[{label:'Danh sách chuyên khoa',href:'departments.html'}]);
        const search=q.replace(/\b(cho toi|bac si|phi kham|gia kham|chi phi|bao nhieu|danh sach|tat ca|toan bo|chuyen khoa|khoa nay|khoa do|o do|phu hop|nao|cac|nhung|va|co|tim|xem|ten|la|bs|phi|cua|giup|voi|a|khong)\b/g,' ').replace(/\s+/g,' ').trim();
        const partial=!matched&&search?all.filter(d=>normalize(d.full_name).includes(search)):[];
        if(!matched&&search&&!byName.length&&!partial.length)
          return result('Chưa tìm thấy bác sĩ theo tên hoặc chuyên khoa bạn vừa nhập. Bạn thử tên đầy đủ hoặc xem danh sách bác sĩ nhé.',[targets.doctors]);
        const useContext=matched||(!byName.length&&!partial.length&&!contains(q,['tất cả','toàn bộ'])&&departmentId);
        const department=departments.find(d=>String(d.department_id)===String(matched?.department_id||departmentId));
        const rows=byName.length?byName:partial.length?partial:useContext?all.filter(d=>String(d.department_id)===String(department?.department_id)):all;
        return doctorAnswer(rows,byName.length||!useContext?undefined:department);
      }
      if(matched)return result(`${matched.name}\n${matched.description||'Xem thông tin tại trang chuyên khoa.'}\nBạn có thể hỏi tiếp “Bác sĩ và phí khám” để xem bác sĩ của khoa này.`,[link('Chi tiết chuyên khoa','department_detail',matched.department_id),targets.booking]);
      if(contains(q,['chuyên khoa','các khoa','khoa nào','danh sách khoa'])) {
        departmentId=undefined;guidance.clear();
        return result(departments.length?`Các chuyên khoa đang hoạt động:\n${departments.map(d=>`• ${d.name}`).join('\n')}\nBạn có thể nhập tên khoa hoặc mô tả triệu chứng để được hướng dẫn.`:'Chưa có chuyên khoa để hiển thị.',[{label:'Tất cả chuyên khoa',href:'departments.html'}]);
      }
      return result('Tôi chưa hiểu rõ câu hỏi. Bạn có thể hỏi “Đau bụng khám ở đâu?”, “Khoa Mắt có bác sĩ nào?”, “Làm sao đặt lịch?”, “Hủy lịch có hoàn tiền không?” hoặc “Xem kết quả ở đâu?”. Tôi chỉ hỗ trợ thông tin khám bệnh trong phạm vi website.',[targets.booking,targets.contact]);
    }catch{return unavailable();}
  };
}
function unavailable(prefix='',extra=[]) {
  return result([prefix,'Hiện chưa lấy được danh mục bác sĩ từ bệnh viện. Bạn vui lòng thử lại hoặc liên hệ nhân viên; tôi không có dữ liệu để xác nhận bác sĩ, phí hay lịch trống.'].filter(Boolean).join('\n'),[targets.contact,...extra]);
}
