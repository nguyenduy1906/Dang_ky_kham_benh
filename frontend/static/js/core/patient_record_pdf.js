import {code} from './business_codes.js';
import {statusLabels} from './appointments.js';

const date=value=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value.length===10?`${value}T00:00:00+07:00`:value)):'Chưa cập nhật';
const text=value=>String(value??'').trim()||'Chưa cập nhật';

// The PDF embeds locally rendered A4 pages, retaining Vietnamese glyphs without a remote font service.
export function pdfFromJpegPages(pages,width=1240,height=1754) {
  const encoder=new TextEncoder(),chunks=[],offsets=[0];let size=0;
  const push=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;chunks.push(bytes);size+=bytes.length;};
  const object=(id,body)=>{offsets[id]=size;push(`${id} 0 obj\n`);body();push('\nendobj\n');};
  push('%PDF-1.4\n');
  object(1,()=>push('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2,()=>push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`));
  pages.forEach((bytes,i)=>{
    const id=3+i*3,commands='q 595.28 0 0 841.89 0 0 cm /Image Do Q';
    object(id,()=>push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Image ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`));
    object(id+1,()=>{push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);push(bytes);push('\nendstream');});
    object(id+2,()=>push(`<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}\nendstream`));
  });
  const xref=size;push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for(const offset of offsets.slice(1))push(`${String(offset).padStart(10,'0')} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks,{type:'application/pdf'});
}

export async function createPatientRecordPdf({profile,encounter,record=null,medications=[]}) {
  await document.fonts.ready;
  const width=1240,height=1754,margin=90,bottom=1630,pages=[];
  let canvas,ctx,y;
  const font=bold=>{ctx.font=`${bold?'600':'400'} 25px Arial, sans-serif`;ctx.fillStyle='#243b33';};
  const newPage=()=>{
    canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    font(true);ctx.fillStyle='#00834d';ctx.fillText('NEU MEDICAL',margin,95);
    ctx.font='20px Arial';ctx.fillStyle='#65766e';ctx.fillText(`Hồ sơ ${code('BN',profile.patient_id)}  |  Lượt khám ${code('LK',encounter.encounter_id)}`,margin,130);
    ctx.strokeStyle='#cbdcd2';ctx.beginPath();ctx.moveTo(margin,155);ctx.lineTo(width-margin,155);ctx.stroke();y=205;
  };
  const finish=()=>{
    ctx.font='19px Arial';ctx.fillStyle='#65766e';ctx.fillText(`Xuất ngày ${date(new Date().toISOString())}`,margin,height-65);
    ctx.textAlign='right';ctx.fillText(`Trang ${pages.length+1}`,width-margin,height-65);ctx.textAlign='left';
    pages.push(Uint8Array.from(atob(canvas.toDataURL('image/jpeg',.96).split(',')[1]),c=>c.charCodeAt(0)));
  };
  const ensure=space=>{if(y+space>bottom){finish();newPage();}};
  const lines=(value,bold=false,indent=0)=>{
    font(bold);const available=width-margin*2-indent;let current='';
    const draw=()=>{ensure(36);font(bold);ctx.fillText(current,margin+indent,y);y+=36;current='';};
    for(const paragraph of text(value).split(/\r?\n/)){
      for(const word of paragraph.split(/\s+/)){
        const candidate=current?`${current} ${word}`:word;
        if(ctx.measureText(candidate).width<=available){current=candidate;continue;}
        if(current)draw();
        // Fall back to character wrapping for a single oversized identifier.
        for(const char of word){if(ctx.measureText(current+char).width>available&&current)draw();current+=char;}
      }
      draw();
    }
  };
  const section=title=>{ensure(100);y+=18;ctx.fillStyle='#edf5ef';ctx.fillRect(margin,y-27,width-margin*2,46);lines(title,true,14);y+=12;};
  const field=(label,value)=>lines(`${label}: ${text(value)}`);
  newPage();ctx.font='bold 37px Arial';ctx.fillStyle='#183e2e';ctx.fillText('PHIẾU HỒ SƠ KHÁM BỆNH',margin,y);y+=58;
  section('1. THÔNG TIN NGƯỜI BỆNH');
  field('Họ và tên',profile.full_name);field('Ngày sinh',date(profile.dob));
  field('Giới tính',({MALE:'Nam',FEMALE:'Nữ',OTHER:'Khác'})[profile.gender]||profile.gender);
  field('Số điện thoại',profile.phone);field('Địa chỉ',profile.address);field('Mã bảo hiểm y tế',profile.health_insurance);
  section('2. THÔNG TIN LƯỢT KHÁM');
  field('Bác sĩ',encounter.doctor_name);field('Chuyên khoa',encounter.department_name);field('Phòng khám',encounter.room_name);
  field('Ngày khám',date(encounter.work_date));
  const clock=value=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'Chưa cập nhật';
  field('Khung giờ',`${clock(encounter.estimated_exam_at)} - ${clock(encounter.appointment_end_at)}`);
  field('Trạng thái',statusLabels[encounter.encounter_status]||encounter.encounter_status);
  section('3. KẾT QUẢ KHÁM');
  if(record){field('Chẩn đoán',record.diagnosis);field('Hướng điều trị',record.treatment);field('Ghi chú bác sĩ',record.doctor_notes);}
  else lines('Chưa có kết quả khám được ghi nhận.');
  section('4. ĐƠN THUỐC');
  if(!medications.length)lines(record?'Không có thuốc được kê trong hồ sơ hiện tại.':'Chưa có đơn thuốc được ghi nhận.');
  medications.forEach((item,index)=>{ensure(90);lines(`${index+1}. ${text(item.medication_name)}`,true);field('Liều dùng',item.dosage);field('Số lượng',item.quantity);field('Hướng dẫn',item.instructions);y+=12;});
  finish();return pdfFromJpegPages(pages,width,height);
}

export function downloadPatientRecordPdf(blob,profile,encounter) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`ho-so-${code('BN',profile.patient_id)}-${code('LK',encounter.encounter_id)}.pdf`;
  link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
