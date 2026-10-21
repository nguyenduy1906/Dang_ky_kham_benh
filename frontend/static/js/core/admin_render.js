// Update read-only regions without replacing identical DOM or losing local position.
const rendered = new WeakMap();
export function replaceAdminRegion(root, markup) {
  if(!root)return false;
  const html=String(markup);
  if(rendered.get(root)===html || root.innerHTML===html)return false;
  const nodes=[root,...(root.querySelectorAll?.('*')||[])];
  const positions=nodes.map((node,index)=>({index,top:node.scrollTop||0,left:node.scrollLeft||0})).filter(position=>position.top||position.left);
  const active=globalThis.document?.activeElement;
  let focusSelector;
  if(active&&root.contains?.(active)) {
    const attributes=[...(active.attributes||[])].filter(attribute=>attribute.name==='id'||attribute.name==='name'||attribute.name.startsWith('data-'));
    if(attributes.length)focusSelector=active.tagName.toLowerCase()+attributes.map(attribute=>`[${attribute.name}=${JSON.stringify(attribute.value)}]`).join('');
  }
  root.innerHTML=html;rendered.set(root,html);
  const updated=[root,...(root.querySelectorAll?.('*')||[])];
  for(const position of positions) {
    const node=updated[position.index];if(!node)continue;
    node.scrollTop=position.top;node.scrollLeft=position.left;
  }
  if(focusSelector)root.querySelector?.(focusSelector)?.focus({preventScroll:true});
  return true;
}
