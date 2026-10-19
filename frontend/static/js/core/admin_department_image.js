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
  if(file)validateDepartmentImage(file);
  galleryFiles.forEach(item=>{if(item)validateDepartmentImage(item);});
  if(payload.gallery?.some((item,index)=>!item.url&&!galleryFiles[index]))throw new Error('Vui lòng chọn ảnh cho mỗi mục thư viện hoặc bỏ mục trống.');
  if(payload.gallery) {
    const gallery=[];
    for(const [index,item] of payload.gallery.entries())gallery.push({...item,url:galleryFiles[index]?await uploadedImage(id,galleryFiles[index],signal):item.url});
    payload={...payload,gallery};
  }
  if(file) {
    validateDepartmentImage(file);
    const url=await uploadedImage(id,file,signal);
    payload={...payload,cover_image_url:url};
  }
  return catalog.updateDepartment(id,payload,{signal});
}
