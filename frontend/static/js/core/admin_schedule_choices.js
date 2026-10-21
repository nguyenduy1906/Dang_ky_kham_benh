const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi").trim();
export const scheduleDepartmentKey = row => String(row.department_id ?? row.department_name ?? "");

export function scheduleDepartments(rows) {
  return [...new Map(rows.filter(row=>row.department_name).map(row=>[scheduleDepartmentKey(row),{id:scheduleDepartmentKey(row),name:row.department_name}])).values()];
}

export function scheduleNameChoices(rows, department, kind, query = "") {
  const field = kind === "doctor" ? "doctor_name" : "room_name";
  const names = rows.filter(row=>(!department||scheduleDepartmentKey(row)===department)&&row[field]).map(row=>row[field]);
  return [...new Set(names)].filter(name=>normalize(name).includes(normalize(query))).sort((a,b)=>a.localeCompare(b,"vi"));
}

export function bindScheduleSuggestions({ input, list, names, onPick }) {
  let current = [], active = -1;
  const close = () => { list.hidden=true;input.setAttribute("aria-expanded","false");input.removeAttribute("aria-activedescendant");active=-1; };
  function highlight() {
    [...list.querySelectorAll('[role="option"]')].forEach((node,index)=>node.setAttribute("aria-selected",String(index===active)));
    if(active>=0)input.setAttribute("aria-activedescendant",`${list.id}-${active}`);else input.removeAttribute("aria-activedescendant");
  }
  function choose(index) {
    if(!current[index])return;
    input.value=current[index];close();input.dispatchEvent(new Event("input",{bubbles:true}));close();onPick?.();input.focus();
  }
  function show() {
    current=names(input.value);active=-1;list.replaceChildren();
    if(!current.length){const empty=document.createElement("span");empty.className="admin-suggestion-empty";empty.textContent="Không có tên phù hợp";list.append(empty);}
    current.forEach((name,index)=>{const option=document.createElement("span");option.setAttribute("role","option");option.id=`${list.id}-${index}`;option.textContent=name;option.setAttribute("aria-selected","false");option.addEventListener("pointerdown",event=>event.preventDefault());option.addEventListener("click",()=>choose(index));list.append(option);});
    list.hidden=false;input.setAttribute("aria-expanded","true");input.removeAttribute("aria-activedescendant");
  }
  input.addEventListener("input",show);
  input.addEventListener("focus",show);
  input.addEventListener("blur",close);
  input.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!list.hidden){event.preventDefault();event.stopPropagation();close();}
    else if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      event.preventDefault();if(list.hidden)show();
      if(current.length){active=active<0?(event.key==="ArrowDown"?0:current.length-1):(active+(event.key==="ArrowDown"?1:-1)+current.length)%current.length;highlight();list.querySelector('[aria-selected="true"]')?.scrollIntoView({block:"nearest"});}
    }else if(event.key==="Enter"&&!list.hidden&&active>=0){event.preventDefault();choose(active);}
  });
  return {close};
}
