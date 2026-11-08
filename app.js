"use strict";
(() => {
  const {courses, stages, resources} = window.COURSE_DATA;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isLessonPage = document.body.dataset.page==='lesson';
  const dayNumber = value => /^(?:[1-9]|[12]\d|30)$/.test(value || '') ? Number(value) : null;
  const lessonUrl = (day, section='course') => `./lesson.html?day=${day}${section==='note'?'&tab=note':''}`;
  const KEY = 'silvercare-learning-v1';
  const fresh = () => ({version:1, selected:1, theme:'light', days:{}});
  let state = fresh(), tab = 'course', view = 'learn', pending = null, toastTimer;
  const tasks = c => [
    '理论：能用自己的话解释本课关键概念，并阅读对应官方示例。',
    '数学：完成公式推导或数值验证，记录单位、假设和边界。',
    ...c.steps,
    `交付：${c.deliver}`,
    `验收：${c.acceptance}`,
    '复盘：保存正常、边界及必要异常案例，记录运行环境、结果与失败原因。'
  ];
  function validate(data) {
    if (!data || typeof data!=='object' || Array.isArray(data) || data.version!==1 || !Number.isInteger(data.selected) || data.selected<1 || data.selected>30 || !['light','dark'].includes(data.theme) || !data.days || typeof data.days!=='object' || Array.isArray(data.days)) throw Error('备份格式或版本不匹配。请选择本平台导出的JSON文件。');
    const result = {version:1, selected:data.selected, theme:data.theme, days:{}};
    for (const [id, d] of Object.entries(data.days)) {
      if (!/^(?:[1-9]|[12]\d|30)$/.test(id) || !d || typeof d!=='object' || typeof d.note!=='string' || d.note.length>50000 || !Array.isArray(d.checked) || d.checked.some(n => !Number.isInteger(n) || n<0 || n>=tasks(courses[Number(id)-1]).length) || new Set(d.checked).size!==d.checked.length) throw Error('备份包含无效日期、任务或过长笔记，未导入任何记录。');
      result.days[id] = {checked:[...d.checked], note:d.note};
    }
    return result;
  }
  function warn(message) { $('persistent-warning').textContent=message; $('persistent-warning').hidden=false; }
  try { const raw=localStorage.getItem(KEY); if(raw) state=validate(JSON.parse(raw)); }
  catch(e) { warn('无法读取本机记录。旧数据未被自动覆盖；可先导出原始记录留存，再导入有效备份。当前改动将暂存于本次页面。'); }
  let blockedStorage = !$('persistent-warning').hidden;
  function save() {
    if(blockedStorage) { $('save-status').textContent='仅本次页面 · 请导出备份'; return false; }
    try { localStorage.setItem(KEY,JSON.stringify(state)); $('save-status').textContent='已自动保存到本机'; return true; }
    catch(e) { $('save-status').textContent='保存失败 · 请导出备份'; warn('浏览器存储不可用或空间不足。记录仍在本次页面中，请立即导出备份，避免关闭后丢失。'); return false; }
  }
  function record(c) { return state.days[c.day] || {checked:[],note:''}; }
  // 保留旧任务索引，把原有记录分成三组；无需清空笔记或改写备份格式。
  const taskGroups = c => [[0,1], Array.from({length:c.steps.length},(_,i)=>i+2), [c.steps.length+2,c.steps.length+3,c.steps.length+4]];
  function count(c) { return taskGroups(c).filter(group=>group.every(i=>record(c).checked.includes(i))).length; }
  function started(c) { return record(c).checked.length>0; }
  function done(c) { return count(c)===3; }
  function percent(list) { return Math.round(list.reduce((a,c)=>a+count(c),0)/(list.length*3)*1000)/10; }
  function notify(message) { $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500); }
  function applyTheme() { document.documentElement.classList.toggle('dark',state.theme==='dark'); $('theme').setAttribute('aria-label',state.theme==='dark'?'切换浅色模式':'切换暗色模式'); }
  function renderProgress() {
    const p=percent(courses); $('overall').innerHTML=`${p}<small>%</small>`; $('overall-bar').value=p;
    $('days-done').innerHTML=`${courses.filter(done).length}<small> / 30天</small>`;
    $('exams-done').innerHTML=`${courses.filter(c=>c.assessment&&done(c)).length}<small> / 6次</small>`;
    $('stage-nav').innerHTML=stages.map((s,i)=>`<button class="stage-nav ${courses[state.selected-1].stage===i?'selected':''}" data-stage="${i}" aria-label="查看第${i+1}阶段：${s}，进度${percent(courses.filter(c=>c.stage===i))}%"><b>${i+1}</b><span>${esc(s)}</span></button><div class="side-progress"><i style="width:${percent(courses.filter(c=>c.stage===i))}%"></i></div>`).join('');
    $('continue').innerHTML=`${courses.every(done)?'回顾最终项目':courses.some(started)?'继续今天的学习':'开始今天的学习'} <span>↗</span>`;
  }
  const shortTitles=['坐标变换','三维位姿','相机标定','目标检测','视觉助手','目标跟踪','RGB-D点云','空间关系','物品记忆','空间找物','节点通信','服务与TF2','PID控制','机器人工程','系统骨架','家居仿真','路径规划','Nav2避障','定位建图','室内巡视','语言理解','任务状态机','主动感知','系统集成','语言找物','安全机制','测试评估','性能优化','产品交付','结课实践'];
  function renderMap() {
    const q=$('search').value.trim().toLocaleLowerCase(), stage=$('stage-filter').value, status=$('status-filter').value;
    const filtered=courses.filter(c=>(stage==='all'||c.stage===Number(stage)) && (status==='all'||status==='done'&&done(c)||status==='todo'&&!started(c)||status==='doing'&&started(c)&&!done(c)||status==='exam'&&c.assessment) && (!q||JSON.stringify(c).toLocaleLowerCase().includes(q)||`d${c.day}`===q));
    $('result-count').textContent=`${filtered.length}天课程`;
    $('course-map').innerHTML=stages.map((s,i)=>{
      const days=filtered.filter(c=>c.stage===i); if(!days.length)return '';
      const all=courses.filter(c=>c.stage===i), p=percent(all);
      return `<section class="phase"><div class="phase-head"><b><em>0${i+1}</em>${esc(s)}</b><small>${p}% · ${all.filter(done).length}/5天</small></div><div class="phase-progress" role="progressbar" aria-label="${esc(s)}任务进度" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div><div class="days">${days.map(c=>`<a href="${lessonUrl(c.day)}" data-day="${c.day}" aria-label="D${c.day} ${esc(c.title)}，${done(c)?'已完成':started(c)?'进行中':'未开始'}" aria-current="${c.day===state.selected?'step':'false'}" class="day ${c.assessment?'exam':''} ${c.day===state.selected?'selected':''} ${done(c)?'done':''}"><b>D${String(c.day).padStart(2,'0')}</b><span>${shortTitles[c.day-1]}</span><small>${done(c)?'已完成':started(c)?'进行中':c.assessment?'阶段实践':'动手学习'}</small></a>`).join('')}</div></section>`;
    }).join('') || '<div class="empty">没有匹配课程。试试“坐标”“Nav2”或清除筛选。</div>';
  }
  function text(value) { return esc(value).replace(/\\[()\[\]]/g,'').replace(/\\\*/g,'*').replace(/`([^`]+)`/g,'<code>$1</code>'); }
  function renderStudy(c) {
    const study=c.study;
    return `<div class="daily-goal"><span>今天学会什么</span><p>${text(study.goal)}</p></div>
      <h3>先理解这几个概念</h3><div class="concepts">${study.concepts.map((p,i)=>`<p><b>${i+1}.</b> ${text(p)}</p>`).join('')}</div>
      <h3>数学怎么用</h3><p class="formula">${text(c.math)}</p>
      <div class="worked-example"><b>用一个例子想明白</b><p>${text(study.worked)}</p></div>
      <h3>跟着做：今天的实验</h3><p class="muted">在自己的开发环境动手。先跑通最小例子，再改一个条件观察结果；卡住时可以先记下来。</p>
      <ol class="lab-steps">${study.lab.map(step=>`<li>${text(step)}</li>`).join('')}</ol>
      ${study.code?`<h3>可以从这段代码开始</h3><p class="muted">这是学习起点，可复制到本地修改。代码不会在网页中执行。</p><pre class="sample-code"><code>${esc(study.code)}</code></pre>`:''}
      <h3>做完后这样检查</h3><ul class="simple-check">${study.checks.map(item=>`<li>${text(item)}</li>`).join('')}</ul>
      <p class="learning-hint">确认后切换到“今日打卡”，勾选三项就好。留下一份能运行的代码，或一张图、一句心得，不需要每天写正式报告。</p>
      <h3>继续看哪里</h3><div class="resource-links">${c.resources.map(i=>`<a href="${esc(resources[i][1])}" target="_blank" rel="noopener noreferrer">${esc(resources[i][0])}</a>`).join('')}</div>`;
  }
  function renderLesson() {
    const c=courses[state.selected-1], r=record(c), list=c.study.checks, groups=taskGroups(c), p=Math.round(count(c)/3*100);
    const content=tab==='course'?renderStudy(c):tab==='check'?`
      <h3>今天，只检查三件事</h3><p class="muted">理解一点、动手一次、核对一下。按自己的实际学习情况勾选，三个都完成就记为学完今天。</p>
      <div class="checklist">${list.map((t,i)=>`<label class="check-row"><input type="checkbox" data-task="${i}" ${groups[i].every(index=>r.checked.includes(index))?'checked':''}><span><b>${['理解了','做过了','检查过了'][i]}</b><br>${text(t)}</span></label>`).join('')}</div>
      <p class="learning-hint">有一步没理解就先留空，下次接着学。笔记可选，不要求上传文件、评分或提交报告。</p>`:tab==='note'?`
      <h3>D${c.day} 随手记一点</h3><label for="note" class="muted">今天懂了什么？哪里卡住了？下次想试什么？</label>
      <textarea id="note" maxlength="50000" placeholder="今天学会了：\n动手结果：\n还没想明白：\n下次继续：">${esc(r.note)}</textarea>
      <div class="note-hint"><span id="note-status">输入即自动保存，写几句话就好</span><span id="note-count">${r.note.length}/50000</span></div>`:`
      <h3>有余力时，继续深入</h3><p class="muted">这里保留完整项目的实验与验收目标，供以后强化。日常学习只需完成三项自查，不用每天准备这些材料。</p>
      <h3>拓展实验</h3><ol>${c.steps.map(step=>`<li>${text(step)}</li>`).join('')}</ol>
      <h3>可以积累的成果</h3><p>${text(c.deliver)}</p><h3>完整项目目标</h3><div class="callout"><p>${text(c.acceptance)}</p></div>`;
    $('lesson').innerHTML=`<header class="lesson-head"><div class="lesson-meta"><span>第${c.stage+1}阶段 / D${String(c.day).padStart(2,'0')}</span><span>${c.assessment?'阶段实践与复盘':'每日学习'}</span></div><h2>${esc(c.title)}</h2><p>${esc(stages[c.stage])} · ${count(c)}/3项自查完成</p><progress max="100" value="${p}" aria-label="D${c.day}任务完成百分比"></progress></header>
      <div class="lesson-tabs" role="tablist" aria-label="每日课程内容">${[['course','知识与实验'],['check','今日打卡'],['note','学习笔记'],['original','进阶参考']].map(([id,label])=>`<button id="tab-${id}" role="tab" aria-controls="lesson-panel" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="lesson-content" id="lesson-panel" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">${content}</div><div class="lesson-bottom"><button data-move="-1" ${c.day===1?'disabled':''}>上一天</button><button data-move="1" ${c.day===30?'disabled':''}>下一天</button></div>`;
  }
  function selectDay(day, section='course') {
    if(!dayNumber(String(day)))return;
    state.selected=day; save();
    location.assign(lessonUrl(day,section));
  }
  function renderNotes() {
    const list=courses.filter(c=>record(c).note.trim());
    $('notes-list').innerHTML=list.map(c=>`<article class="note-card"><h2>D${c.day} · ${esc(c.title)}</h2><p>${esc(record(c).note)}</p><button data-note-day="${c.day}">打开并编辑</button></article>`).join('')||'<div class="empty">还没有笔记。打开任意一天的“学习笔记”开始记录。</div>';
  }
  function showView(next) {
    if(isLessonPage && next!=='learn') { location.assign(`./index.html?view=${next}`); return; }
    view=next;
    for(const id of ['learn','resources','notes','guide']) $(`${id}-view`).hidden=id!==next;
    document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===next);b.setAttribute('aria-current',b.dataset.view===next?'page':'false');});
    if(next==='notes')renderNotes();
  }
  function download(name, content, type) {
    const blob=new Blob([content],{type}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportBackup() { const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); download(`银龄康护-学习备份-${date}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json;charset=utf-8'); notify('学习备份已生成，请确认浏览器下载已保存。'); }
  $('export').onclick=exportBackup; $('side-export').onclick=exportBackup; $('backup-before').onclick=exportBackup;
  if(blockedStorage) { const b=document.createElement('button'); b.textContent='导出原始记录'; b.onclick=()=>{try{download('银龄康护-原始记录.txt',localStorage.getItem(KEY)||'无可读原始记录','text/plain;charset=utf-8');}catch(e){notify('浏览器拒绝读取原始记录。');}}; $('persistent-warning').append(' ',b); }
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=async event=>{
    const file=event.target.files[0]; event.target.value=''; if(!file)return;
    try {
      if(file.size>12*1024*1024)throw Error('文件超过12MB。请选择本平台的学习备份文件。');
      pending=validate(JSON.parse(await file.text()));
      const dayCount=Object.keys(pending.days).length, checks=Object.values(pending.days).reduce((a,d)=>a+d.checked.length,0), notes=Object.values(pending.days).filter(d=>d.note.trim()).length;
      $('import-preview').textContent=`已校验：${dayCount}天记录、${checks}项打卡、${notes}篇笔记。`;
      $('import-dialog').showModal();
    } catch(e) { pending=null; notify(e instanceof SyntaxError?'文件不是有效JSON，当前记录保持不变。':e.message); }
  };
  $('cancel-import').onclick=()=>{pending=null;$('import-dialog').close();};
  $('import-dialog').addEventListener('cancel',()=>{pending=null;});
  $('confirm-import').onclick=()=>{
    if(!pending)return;
    state=pending;pending=null;blockedStorage=false;$('persistent-warning').hidden=true;
    const saved=save();applyTheme();$('import-dialog').close();renderProgress();renderMap();
    if(isLessonPage){history.replaceState(null,'',lessonUrl(state.selected));tab='course';renderLesson();document.title=`D${state.selected} · ${courses[state.selected-1].title} · 银龄康护`;}
    notify(saved?'备份已导入，并保存到本机。':'备份已加载到页面；本机保存失败，请导出备份。');
  };
  $('theme').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();save();};
  $('continue').onclick=()=>selectDay((courses.find(c=>!done(c))||courses[29]).day);
  $('reset-filter').onclick=()=>{$('search').value='';$('stage-filter').value='all';$('status-filter').value='all';renderMap();};
  $('search').oninput=renderMap;$('stage-filter').onchange=renderMap;$('status-filter').onchange=renderMap;
  document.querySelector('nav').onclick=e=>{const b=e.target.closest('[data-view]');if(b){showView(b.dataset.view);$('main').focus();window.scrollTo(0,0);}};
  $('stage-nav').onclick=e=>{const b=e.target.closest('[data-stage]');if(!b)return;if(isLessonPage){location.assign(`./index.html?stage=${b.dataset.stage}#course-map`);return;}showView('learn');$('stage-filter').value=b.dataset.stage;$('search').value='';$('status-filter').value='all';renderMap();$('course-map').scrollIntoView();};
  $('notes-list').onclick=e=>{const b=e.target.closest('[data-note-day]');if(b)selectDay(Number(b.dataset.noteDay),'note');};
  $('lesson').onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.tab){tab=b.dataset.tab;renderLesson();$(`tab-${tab}`).focus();}
    if(b.dataset.move)selectDay(state.selected+Number(b.dataset.move));
  };
  $('lesson').onkeydown=e=>{
    if(e.target.getAttribute('role')!=='tab')return;
    const tabs=['course','check','note','original']; let i=tabs.indexOf(tab);
    if(e.key==='ArrowRight')i=(i+1)%tabs.length;else if(e.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=tabs.length-1;else return;
    e.preventDefault();tab=tabs[i];renderLesson();$(`tab-${tab}`).focus();
  };
  $('lesson').onchange=e=>{
    if(!e.target.matches('[data-task]'))return;
    const c=courses[state.selected-1], r=state.days[c.day]||{checked:[],note:''}, index=Number(e.target.dataset.task);
    const group=taskGroups(c)[index];
    r.checked=e.target.checked?[...new Set([...r.checked,...group])]:r.checked.filter(i=>!group.includes(i));state.days[c.day]=r;save();renderProgress();renderMap();
    const focusIndex=index;renderLesson();$('lesson').querySelector(`[data-task="${focusIndex}"]`).focus();
    if(done(c))notify(`D${c.day}学习完成，今天又前进了一步。`);
  };
  $('lesson').oninput=e=>{
    if(e.target.id!=='note')return;
    const id=state.selected, r=state.days[id]||{checked:[],note:''};r.note=e.target.value;state.days[id]=r;
    const saved=save();$('note-status').textContent=saved?'已自动保存到本机':'仅本次页面，请导出备份';$('note-count').textContent=`${r.note.length}/50000`;
  };
  $('report-template').onclick=()=>download('学习笔记模板.md','# D__ 随手学习记录\n\n今天学会了：\n\n动手结果：\n\n还没想明白：\n\n下次继续：\n','text/markdown;charset=utf-8');
  $('stage-filter').insertAdjacentHTML('beforeend',stages.map((s,i)=>`<option value="${i}">阶段${i+1} · ${esc(s)}</option>`).join(''));
  $('resource-grid').innerHTML=resources.map(([name,url])=>`<a class="resource-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><h2>${esc(name)} ↗</h2><p>${esc(new URL(url).hostname)}<br>官方教程 / 项目源码</p></a>`).join('');
  const params=new URLSearchParams(location.search);
  const legacyDay=dayNumber(location.hash.match(/^#day-(\d+)$/)?.[1]);
  if(!isLessonPage && legacyDay){location.replace(lessonUrl(legacyDay));return;}
  if(isLessonPage){
    state.selected=dayNumber(params.get('day')) || 1;
    tab=params.get('tab')==='note'?'note':'course';
    document.title=`D${state.selected} · ${courses[state.selected-1].title} · 银龄康护`;
    if(!dayNumber(params.get('day')))history.replaceState(null,'',lessonUrl(state.selected));
    renderLesson();save();
  } else {
    const stage=params.get('stage');
    if(/^[0-5]$/.test(stage || ''))$('stage-filter').value=stage;
    if(['learn','notes','resources','guide'].includes(params.get('view')))showView(params.get('view'));
  }
  applyTheme();renderProgress();renderMap();
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw));}
    catch(e){warn('无法刷新本机记录，请先导出备份。');return;}
    if(isLessonPage)state.selected=dayNumber(new URLSearchParams(location.search).get('day'))||1;
    applyTheme();renderProgress();renderMap();
    if(isLessonPage)renderLesson();
    if(view==='notes')renderNotes();
  });
  if(blockedStorage)$('save-status').textContent='仅本次页面 · 请导出备份';
})();
