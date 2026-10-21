import {getUnreadCount} from '../api/notification.js';
import {startAutoRefresh} from './auto_refresh.js';
export function unreadBadgeCount(value){
  const number=Number(value);
  return Number.isFinite(number)?Math.min(999,Math.max(0,Math.floor(number))):0;
}
export function initAdminNotificationBadge(){
  const link=document.querySelector('#staff-sidebar nav a[href="notifications.html"]');
  if(!link)return;
  const badge=document.createElement('b');badge.className='admin-nav-unread';badge.hidden=true;badge.setAttribute('aria-hidden','true');link.append(badge);
  let active=true,version=0;
  async function refresh(){
    const current=++version;
    try {
      const result=await getUnreadCount();
      if(!active||current!==version)return;
      if(!Number.isSafeInteger(result.unread_count)||result.unread_count<0)return;
      badge.textContent=String(unreadBadgeCount(result.unread_count));badge.hidden=false;
      const text=`Thông báo: ${result.unread_count} chưa đọc`;
      link.setAttribute('aria-label',text);link.title=text;
    }catch{/* Keep the last confirmed count until the next successful read. */}
  }
  const update=()=>{void refresh();};
  window.addEventListener('notifications-changed',update);
  const stop=()=>{active=false;version++;window.removeEventListener('notifications-changed',update);badge.remove();};
  window.addEventListener('pagehide',stop,{once:true});window.addEventListener('neu:auth-change',stop,{once:true});
  void refresh();startAutoRefresh(refresh,{canRefresh:()=>active});
}
