import * as catalog from "../api/catalog.js";
export function validateDepartmentImage(file) {
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Chọn ảnh JPEG, PNG hoặc WebP, tối đa 5 MB.');
}
const uploads=new WeakMap();
async function uploadedImage(id,file,signal) {
  let url=uploads.get(file);
  if(!url){const result=await catalog.uploadDepartmentImage(id,file,{signal});url=result.url;uploads.set(file,url);}
  return url;
}
export async function saveDepartmentImage(id,payload,file,{signal,galleryFiles=[]}={}) {
  validateImages(payload,file,galleryFiles);
  if(payload.gallery) {
    const gallery=[];
    for(const [index,item] of payload.gallery.entries())gallery.push({...item,url:galleryFiles[index]?await uploadedImage(id,galleryFiles[index],signal):item.url});
    payload={...payload,gallery};
  }
  if(file)payload={...payload,cover_image_url:await uploadedImage(id,file,signal)};
  return catalog.updateDepartment(id,payload,{signal});
}
function validateImages(payload,file,galleryFiles) {
  if(file)validateDepartmentImage(file);
  galleryFiles.forEach(item=>{if(item)validateDepartmentImage(item);});
  if(payload.gallery?.some((item,index)=>!item.url&&!galleryFiles[index]))throw new Error('Vui lòng chọn ảnh cho mỗi mục thư viện hoặc bỏ mục trống.');
}
export async function createDepartmentWithImages(payload,file,{signal,galleryFiles=[],onCreated=()=>{}}={}) {
  validateImages(payload,file,galleryFiles);
  // The existing upload endpoint needs a saved department ID. Keep pending
  // gallery files out of the first JSON request, then save their uploaded URLs.
  const initial={...payload};
  if(initial.gallery)initial.gallery=initial.gallery.filter((item,index)=>!galleryFiles[index]);
  const created=await catalog.createDepartment(initial,{signal});
  onCreated(created.department);
  if(!file&&!galleryFiles.some(Boolean))return created;
  try {
    return await saveDepartmentImage(created.department.department_id,{...payload,expected_version:created.department.version},file,{signal,galleryFiles});
  } catch(error) {
    error.message=`Chuyên khoa đã được tạo, nhưng chưa lưu đầy đủ hình ảnh. ${error.message} Giữ biểu mẫu này và bấm lưu để thử lại.`;
    throw error;
  }
}
