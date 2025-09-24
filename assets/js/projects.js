(function(){
  const grid = document.getElementById('projectsGrid');
  const btn = document.getElementById('createProjectBtn');
  const dialog = document.getElementById('createProjectDialog');
  const form = document.getElementById('createProjectForm');
  const input = document.getElementById('projectNameInput');

  // Rename dialog
  const renameDialog = document.getElementById('renameProjectDialog');
  const renameForm = document.getElementById('renameProjectForm');
  const renameInput = document.getElementById('renameProjectInput');
  let currentRenameProjectId = null;
  const loadAutoheGlobalBtn = document.getElementById('loadAutoheGlobalBtn');
  const hiddenAutoheInput = document.createElement('input'); hiddenAutoheInput.type='file'; hiddenAutoheInput.accept='.autohe,application/json'; hiddenAutoheInput.style.display='none'; document.body.appendChild(hiddenAutoheInput);

  function render(){
    const projects = AutoHE.getProjects();
    grid.innerHTML = '';
    if(projects.length === 0){
      grid.innerHTML = `<div class="card project-card pop-in" style="grid-column: 1 / -1; text-align:center;">
        У тебя пока нет проектов. Нажми \"Создать проект\".
      </div>`;
      return;
    }
    projects.forEach(p => {
      const story = p.scripts.filter(s=>s.type==='story').length;
      const content = p.scripts.filter(s=>s.type==='content').length;
      const mod = p.scripts.filter(s=>s.type==='mod').length;
      const el = document.createElement('div');
      el.className = 'card project-card pop-in';
      el.innerHTML = `
        <div style="display:flex; align-items:center; justify-content: space-between; gap:10px;">
          <div style="font-weight:800; font-size:18px;">${escapeHtml(p.name)}</div>
          <span style="color: var(--muted); font-size: 12px;">${new Date(p.createdAt).toLocaleDateString()}</span>
        </div>
        <div style="color:var(--muted);">Сюжет: ${story} • Контент: ${content} • Модификации: ${mod}</div>
        <div class="card-actions">
          <button class="btn btn-primary" data-open>Открыть</button>
          <button class="btn btn-ghost" data-rename>Переименовать</button>
          <button class="btn btn-ghost" data-delete>Удалить</button>
          <button class="btn btn-ghost" data-save>Сохранить (.autohe)</button>
        </div>
      `;
      el.querySelector('[data-open]').onclick = ()=> AutoHE.go(`project.html?id=${p.id}`);
      el.querySelector('[data-rename]').onclick = ()=> openRenameDialog(p.id, p.name);
      el.querySelector('[data-delete]').onclick = ()=> deleteProject(p.id);
      el.querySelector('[data-save]').onclick = ()=> saveAutohe(p.id, p.name);
      grid.appendChild(el);
    });
  }

  function escapeHtml(s){
    return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function openRenameDialog(id, currentName) {
    currentRenameProjectId = id;
    renameInput.value = currentName;
    renameDialog.showModal();
    setTimeout(() => renameInput.focus(), 50);
  }

  function deleteProject(id){
    if(!confirm('Удалить проект? Это действие необратимо.')) return;
    const projects = AutoHE.getProjects().filter(p => p.id !== id);
    localStorage.setItem('autohe.projects.v1', JSON.stringify(projects));
    render();
  }

  async function saveAutohe(projectId, name){
    try{
      if(typeof JSZip === 'undefined'){ alert('JSZip не загружен'); return; }
      const zip = new JSZip();
      const bundle = await AutoHE.exportProjectBundle(projectId);
      zip.file('project.json', JSON.stringify(bundle.project, null, 2));
      const folder = zip.folder('models');
      for(const m of bundle.models){
        if(m && m.file && m.file.data){
          const u8 = new Uint8Array(m.file.data);
          const fname = `${m.meta.id}.${m.meta.ext||'bin'}`;
          folder.file(fname, u8, {binary:true});
        }
      }
      const out = await zip.generateAsync({type:'blob'});
      const a = document.createElement('a');
      const modid = (name || 'project').toLowerCase().replace(/[^a-z0-9_]/g,'_');
      a.href = URL.createObjectURL(out); a.download = `${modid}.autohe`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
    }catch(e){ console.error(e); alert('Не удалось сохранить проект'); }
  }

  // Создание проекта
  btn.onclick = () => { input.value=''; dialog.showModal(); setTimeout(()=>input.focus(), 50); };
  dialog.addEventListener('close', ()=>{
    if(dialog.returnValue === 'confirm'){
      const name = input.value.trim();
      if(!name){ alert('Введите название проекта'); return; }
      AutoHE.createProject(name); render();
    } else {
      input.value = '';
    }
  });

  // Переименование
  renameDialog.addEventListener('close', ()=>{
    if(renameDialog.returnValue === 'confirm' && currentRenameProjectId){
      const name = renameInput.value.trim(); if(!name) return;
      const p = AutoHE.getProject(currentRenameProjectId); if(!p) return;
      p.name = name; AutoHE.saveProject(p); currentRenameProjectId = null; render();
    } else {
      currentRenameProjectId = null;
    }
  });

  // Глобальная загрузка .autohe
  loadAutoheGlobalBtn.onclick = ()=> hiddenAutoheInput.click();
  hiddenAutoheInput.onchange = async (e)=>{
    const f = e.target.files && e.target.files[0]; if(!f) return;
    try{
      const zip = await JSZip.loadAsync(f);
      const projectFile = zip.file('project.json');
      if(!projectFile) throw new Error('project.json not found in .autohe file');
      const projectJson = await projectFile.async('string');
      const project = JSON.parse(projectJson);
      const models = [];
      const modelsFolder = zip.folder('models');
      if(modelsFolder){
        const files = Object.keys(modelsFolder.files || {});
        for(const path of files){
          if(!path || path.endsWith('/')) continue;
          const modelFile = modelsFolder.file(path);
          if(!modelFile) continue;
          const blob = await modelFile.async('blob');
          const id = path.split('/').pop().split('.')[0];
          models.push({ id, blob });
        }
      }
      const bundle = { version: 1, project, models: [] };
      for(const m of models){
        const buffer = await m.blob.arrayBuffer();
        bundle.models.push({ 
          meta: { id: m.id, name: m.id, ext: (m.id.split('.').pop()||'bin') }, 
          file: { mime: m.blob?.type||'application/octet-stream', data: Array.from(new Uint8Array(buffer)) } 
        });
      }
      await AutoHE.importProjectBundle(bundle);
      render();
      alert('Проект успешно загружен!');
    }catch(err){ console.error(err); alert('Не удалось загрузить .autohe'); }
    // Сбросить input для повторной загрузки того же файла
    e.target.value = '';
  };

  // Живые обновления из других вкладок
  window.addEventListener('storage', (e)=>{ if(e.key === 'autohe.projects.v1'){ render(); } });

  render();
})();