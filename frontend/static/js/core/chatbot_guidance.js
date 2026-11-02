import { symptomTopics, medicalSources, faqEntries } from '../data/chatbot_knowledge.js';

export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const hasPhrase = (text, phrase) => (` ${text} `).includes(` ${normalize(phrase)} `);
export const contains = (text, phrases) => phrases.some(phrase => hasPhrase(text, phrase));

// Negation stays within a short clause and never crosses "but/nhưng".
export function affirmed(message, phrase) {
  const clauses = String(message).split(/[.,;!?\n]|\bnhưng\b|\bnhung\b|\bbut\b/iu);
  return clauses.some(clause => {
    const q = normalize(clause), needle = normalize(phrase);
    let start = 0;
    while (start <= q.length) {
      const at = (` ${q} `).indexOf(` ${needle} `, start);
      if (at < 0) break;
      const before = q.slice(0, at).trim().split(' ').slice(-4).join(' ');
      if (!/(?:^| )(?:khong|ko|k|chua|chang)(?: (?:bi|co|he|con|thay|dau|bi dau|cam thay)){0,3}$/.test(before)) return true;
      start = at + needle.length + 1;
    }
    return false;
  });
}
const anyAffirmed = (message, phrases) => phrases.some(phrase => affirmed(message, phrase));

export function urgentGuidance(message, previous = '') {
  const q = normalize(message), full = normalize(`${previous} ${message}`);
  const emergency = ['cấp cứu','khó thở','không thở được','đau ngực','bất tỉnh','ngất','co giật','khó đánh thức',
    'nôn ra máu','ói ra máu','phân đen','đi ngoài ra máu nhiều','nói khó','méo miệng',
    'yếu một bên','liệt nửa người','mất thị lực','không nhìn thấy','hóa chất vào mắt',
    'không nuốt được nước bọt','tê vùng kín','không kiểm soát tiểu tiện'];
  const severe = anyAffirmed(message, ['dữ dội','đau dữ','đau quặn không chịu nổi','đau không chịu nổi']);
  const sudden = anyAffirmed(message, ['đột ngột','bất chợt']);
  if (anyAffirmed(message, emergency)
    || (severe && contains(full,['đau bụng','bụng','đau đầu','đầu','đau mắt','mắt']))
    || (sudden && contains(full,['nhìn mờ','giảm thị lực']))
    || (contains(full,['đau lưng','lưng']) && anyAffirmed(message,['yếu hai chân','tê hai chân']))
    || (contains(full,['đau đầu','sốt']) && anyAffirmed(message,['cứng cổ','cứng gáy']))
    || anyAffirmed(message,['tự tử','tự sát'])) {
    return {kind:'emergency', text:'Những dấu hiệu bạn vừa nêu cần được đánh giá y tế khẩn cấp. Hãy nhờ người ở gần hỗ trợ và đến cơ sở cấp cứu ngay; đừng chờ lịch đặt khám thông thường. Chatbot không thể xác định nguyên nhân hay mức độ an toàn qua tin nhắn.'};
  }
  const young = /(?:^| )(?:[012])\s*thang(?: |$)|duoi 3 thang|so sinh/.test(full);
  const fever = anyAffirmed(message,['sốt']) || (contains(full,['sốt']) && /(?:^| )(?:3[89]|4\d)(?: |$)/.test(q));
  const pregnant = anyAffirmed(message,['mang thai','có thai','đang bầu']) || anyAffirmed(previous,['mang thai','có thai','đang bầu']);
  const youngHighFever=/(?:^| )[3-6] thang(?: |$)/.test(full)&&/(?:^| )(?:39|4\d)(?: |$)/.test(q)&&contains(full,['sốt']);
  if ((young && fever) || youngHighFever || (pregnant && contains(full,['đau bụng','tiểu buốt','tiểu rắt']))
      || anyAffirmed(message,['ho ra máu','tiểu ra máu','đau tăng nhanh','nặng lên nhanh','không uống được nước'])
      || (contains(full,['tiểu buốt','tiểu rắt']) && anyAffirmed(message,['sốt','đau hông lưng']))) {
    return {kind:'urgent', text:'Bạn nên liên hệ nhân viên y tế để được đánh giá trực tiếp ngay trong ngày, thay vì chỉ chọn lịch khám thông thường. Nếu đau dữ dội, khó thở, ngất hoặc tình trạng xấu đi, hãy đến cấp cứu. Chatbot chỉ hỗ trợ tìm nơi khám, không xác định bệnh.'};
  }
  return null;
}
export function findTopic(message) {
  const q=normalize(message).replace(/\b(?:ho so|dat ho|dang ky ho)\b/g,' ');
  return symptomTopics.map(topic=>({topic,score:Math.max(0,...topic.terms.filter(term=>hasPhrase(q,term)).map(term=>normalize(term).length))}))
    .sort((a,b)=>b.score-a.score).find(item=>item.score>0)?.topic;
}
export function findFaq(message) {
  return faqEntries.find(entry=>contains(normalize(message),entry.terms));
}
export function population(message) {
  const q=normalize(message);
  if(contains(q,['người lớn','trưởng thành']))return 'adult';
  if(contains(q,['trẻ em','trẻ','em bé','bé','con tôi','bé nhà','cháu nhà','sơ sinh']))return 'child';
  const years=q.match(/(?:^| )(\d{1,3}) tuoi(?: |$)/);
  if(years)return Number(years[1])<16?'child':'adult';
  if(/(?:^| )\d{1,2} thang(?: |$)/.test(q))return 'child';
  return undefined;
}
export function topicSource(topic) {
  const [label,href]=medicalSources[topic.source];
  return {label:`Nguồn tham khảo: ${label}`,href};
}
export function createGuidance() {
  let state;
  return {
    clear(){state=undefined;},
    inspect(message){
      const urgent=urgentGuidance(message,state?.history||'');
      if(urgent){state=undefined;return urgent;}
      const topic=findTopic(message);
      if(topic&&topic.id!==state?.topic.id)state={topic,history:'',turns:0};
      if(!state)return null;
      state.history=`${state.history} ${message}`.slice(-1800);state.turns++;
      const group=population(state.history);
      const detail=contains(normalize(state.history),['nhẹ','âm ỉ','không dữ dội','không khó thở','không đau ngực','không sốt'])
        || /(?:\d+|mot|hai|ba|vai) (?:ngay|tuan|thang|gio)|tu hom qua|tu sang|keo dai/.test(normalize(state.history));
      if(!group||!detail)return {kind:'question',text:`${state.topic.question}\n${state.topic.warning}\nTôi chỉ hướng dẫn tìm nơi khám, không chẩn đoán hoặc kê thuốc.`,source:topicSource(state.topic)};
      const current=state.topic;
      return {kind:'recommendation',topic:current,departments:group==='child'?['nhi','nhi khoa']:current.departments,
        text:`Bạn có thể tham khảo nơi khám dưới đây để bác sĩ đánh giá trực tiếp. Đây là hướng dẫn chọn nơi khám, không phải kết luận bệnh hoặc xác nhận tình trạng an toàn.\n${current.warning}`,source:topicSource(current)};
    },
  };
}
