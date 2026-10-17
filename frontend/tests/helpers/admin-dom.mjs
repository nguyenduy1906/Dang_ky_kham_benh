// A small test DOM for exercising the actual admin controller without a browser session.
const voids=new Set(['input','img','br','hr','meta','link']);
const decode=s=>String(s).replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
function matches(el,selector){
  if(selector.startsWith('#'))return el.id===selector.slice(1);
  if(selector.startsWith('.'))return String(el.className || '').split(/\s+/).includes(selector.slice(1));
  const attr=selector.match(/^(\w+)?\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
  if(attr)return (!attr[1]||el.tag===attr[1])&&el.attrs[attr[2]]!=null&&(attr[3]==null||el.attrs[attr[2]]===attr[3]);
  return el.tag===selector;
}
export class Element {
  constructor(tag='div',attrs={}){this.tag=tag;this.attrs=attrs;this.children=[];this.listeners={};this.dataset={};this.files=[];this._html='';this._text='';Object.assign(this,{disabled:false,hidden:false,open:false});for(const[k,v]of Object.entries(attrs)){if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;else if(k==='class')this.className=v;else if(['selected','checked','multiple','disabled','hidden','required'].includes(k))this[k]=true;else this[k]=v;}this.classList={add:()=>{},remove:()=>{},contains:()=>false};}
  get innerHTML(){return this._html;}
  set innerHTML(value){this._html=value;this.children=[];parse(value,this);}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  get value(){if(this._value!=null)return this._value;if(this.tag==='select'){const opts=this.querySelectorAll('option');return (opts.find(o=>o.selected)||opts[0])?.value || '';}if(this.tag==='textarea')return this._text;return this.attrs.value ?? (this.type==='checkbox'?'on':'');}
  set value(value){this._value=String(value);}
  get elements(){return Object.fromEntries(this.descendants().filter(c=>c.name).map(c=>[c.name,c]));}
  descendants(){return this.children.flatMap(c=>[c,...c.descendants()]);}
  querySelectorAll(selector){return this.descendants().filter(c=>matches(c,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0] || null;}
  closest(selector){for(let el=this;el;el=el.parent)if(matches(el,selector))return el;return null;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  addEventListener(type,callback){(this.listeners[type] ||= []).push(callback);}
  setAttribute(k,v){this.attrs[k]=String(v);this[k]=String(v);}
  getAttribute(k){return this.attrs[k] ?? null;}
  insertAdjacentHTML(position,html){const container=new Element();parse(html,container);const parent=position==='afterend'?this.parent:this;for(const node of container.children)node.parent=parent;if(position==='afterend'){const i=parent.children.indexOf(this);parent.children.splice(i+1,0,...container.children);}else parent.children.push(...container.children);}
  showModal(){this.open=true;}
  close(){this.open=false;for(const fn of this.listeners.close || [])fn({target:this});}
  remove(){if(this.parent){const index=this.parent.children.indexOf(this);if(index>=0)this.parent.children.splice(index,1);}}
  focus(){this.focused=true;}
  setCustomValidity(message){this.validationMessage=message;}
  reportValidity(){return true;}
}
function parse(html,parent){
  const pattern=/<(\/?)([a-zA-Z][\w-]*)([^>]*?)>|([^<]+)/g,stack=[parent];let match;
  while((match=pattern.exec(html))){if(match[4]){stack.at(-1)._text+=decode(match[4]);continue;}const[,close,tag,rest]=match;if(close){if(stack.length>1)stack.pop();continue;}const attrs={};for(const a of rest.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const el=new Element(tag,attrs);el.parent=stack.at(-1);el.parent.children.push(el);if(!voids.has(tag))stack.push(el);}
}
export function installDom(page){
  const original=Object.fromEntries(['document','window','location','FormData','fetch','sessionStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const root=new Element('body');root.dataset={role:'admin',page};
  root.innerHTML='<main id="main-content"><header id="page-header"><div id="overview-period-control"></div></header><div id="page-body"></div></main><div id="staff-access" hidden></div><dialog id="admin-dialog"><h2 id="admin-dialog-title"></h2><div id="admin-dialog-body"></div></dialog>';
  const document={body:root,querySelector:s=>root.querySelector(s),createElement:t=>new Element(t),activeElement:root};
  const window=new EventTarget();
  class TestFormData extends original.FormData.value {
    constructor(form){super();if(form)for(const el of form.descendants().filter(e=>e.name&&!e.disabled)){if(el.type==='checkbox'&&!el.checked)continue;if(el.tag==='select'&&el.multiple){for(const opt of el.querySelectorAll('option').filter(o=>o.selected))this.append(el.name,opt.value);}else if(el.type!=='file')this.append(el.name,el.value);}}
  }
  Object.assign(globalThis,{document,window,FormData:TestFormData,location:new URL(`http://localhost/frontend/templates/(admin)/${page}.html`),sessionStorage:{removeItem(){},getItem(){return null;}}});
  return {root,$:s=>document.querySelector(s),restore(){for(const[k,d]of Object.entries(original)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}};
}
export const tick=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
export async function trigger(element,type){const event={target:element,preventDefault(){}};for(let el=element;el;el=el.parent)for(const callback of el.listeners[type] || [])callback(event);await tick();}
