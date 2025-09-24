(function(){
  const projectId = AutoHE.qs('id');
  let project = AutoHE.getProject(projectId);
  const title = document.getElementById('projectTitle');
  const scriptsList = document.getElementById('scriptsList');
  const scriptStats = document.getElementById('scriptStats');
  const addScriptBtn = document.getElementById('addScriptBtn');

  const createDialog = document.getElementById('createScriptDialog');
  const createForm = document.getElementById('createScriptForm');
  const nameInput = document.getElementById('scriptNameInput');
  const descInput = document.getElementById('scriptDescInput');

  const renameDialog = document.getElementById('renameScriptDialog');
  const renameForm = document.getElementById('renameScriptForm');
  const renameInput = document.getElementById('renameScriptInput');
  let currentRenameScript = null;

  const resourcesList = document.getElementById('resourcesList');
  const hiddenFile = document.createElement('input'); hiddenFile.type='file'; hiddenFile.multiple = true; hiddenFile.accept='.glb,.gltf,.png,.jpg,.jpeg,.ogg,.wav,.mp3,model/gltf-binary,model/gltf+json,audio/*,image/*'; hiddenFile.style.display='none'; document.body.appendChild(hiddenFile);
  const hiddenDir = document.createElement('input'); hiddenDir.type='file'; hiddenDir.webkitdirectory = true; hiddenDir.style.display='none'; document.body.appendChild(hiddenDir);
  const exportInfoDialog = document.getElementById('exportInfoDialog');
  const exportButtons = document.querySelectorAll('#exportBtn');
  const dialogColorInput = document.getElementById('dialogNameColorInput');
  const dialogPreview = document.getElementById('dialogPreview');

  exportButtons.forEach(btn => btn.onclick = () => {
    // Показываем индикатор загрузки
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Экспортируем...';
    btn.style.opacity = '0.7';
    
    ensureJSZip()
      .then(() => exportProject())
      .catch(err => { 
        console.error(err); 
        alert('Экспорт не удался'); 
      })
      .finally(() => {
        // Восстанавливаем кнопку
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.opacity = '1';
      });
  });

  function loadScript(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = ()=> resolve();
      s.onerror = ()=> reject(new Error('Failed to load '+src));
      document.head.appendChild(s);
    });
  }
  async function ensureJSZip(){
    if(typeof JSZip !== 'undefined') return;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    } catch(e){ }
    if(typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
  }

  function sanitizeModId(name){ return String(name||'autohe').toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'') || 'autohe'; }
  function sanitizeFile(name){ return String(name||'file').toLowerCase().replace(/[^a-z0-9_]/g,'_') || 'file'; }
  function typeExt(t){ return t==='story'?'.se.kts': t==='content'?'.content.kts': t==='mod'?'.mod.kts':'.kts'; }

  async function exportProject(){
    if(typeof JSZip === 'undefined'){ alert('JSZip не загружен'); return; }
    
    // Обновляем статус
    updateExportStatus('Создаём архив...');
    
    const zip = new JSZip();

    project = AutoHE.getProject(projectId);
    const modid = 'autohe'; // Всегда используем фиксированный modid
    // Начиная с этой версии экспортируем только папку hollowengine. Моды скачиваются отдельно на спец. странице.

    updateExportStatus('Добавляем скрипты...');

    const heDir = zip.folder('hollowengine');
    const scriptsDir = heDir.folder('scripts');

    // Встроенный мод-скрипт с плейсхолдерами для команд (не редактируемый пользователем)
    const builtinModScriptName = 'storyevents.mod.kts';
    const builtinModScript = `@file:Suppress("unused")

// Built-in placeholders for commands
fun init() {}

// Имя НИПа в цвете, с пробелом после скобки
fun nameCompNpc(nick: String, color: String) = """{"text":"[${'$'}nick] ","color":"${'$'}color"}"""

// Имя игрока через селектор @p в цвете, со скобками и пробелом
fun nameCompPlayer(color: String) = """{"text":"[","color":"${'$'}color"},{"selector":"@p","color":"${'$'}color"},{"text":"] ","color":"${'$'}color"}"""

// Имя игрока напрямую строкой (без @p), со скобками и пробелом
fun nameCompPlayerBy(name: String, color: String) = """{"text":"[${'$'}name] ","color":"${'$'}color"}"""
`;
    scriptsDir.file(builtinModScriptName, builtinModScript);

    // Добавляем фиксер he_fixer.kts из assets/presets
    try {
      const resp = await fetch('assets/presets/he_fixer.kts', { method: 'GET' });
      if(resp.ok){
        const fixerText = await resp.text();
        scriptsDir.file('he_fixer.kts', fixerText);
      }
    } catch(_) {}

    const scripts = (project.scripts||[]);
    scripts.forEach(s => {
      const base = sanitizeFile(s.name);
      const content = (s.kotlin && typeof s.kotlin === 'string') ? s.kotlin : '';
      scriptsDir.file(`${base}${typeExt(s.type)}`, content);
    });

    updateExportStatus('Упаковываем ресурсы...');

    const assetsRoot = heDir.folder('assets').folder(modid);
    const res = AutoHE.getResources(projectId);
    // Модели
    const modelsDir = assetsRoot.folder('models');
    await Promise.all(((res.models)||[]).map(async m => {
      try { const blob = await AutoHE.getResourceBlob(m.id); if(blob){ modelsDir.file(`${sanitizeFile(m.name)}.${m.ext||'glb'}`, blob); } } catch(_){ }
    }));
    // Текстуры
    const texturesDir = assetsRoot.folder('textures');
    await Promise.all(((res.textures)||[]).map(async t => {
      try { const blob = await AutoHE.getResourceBlob(t.id); if(blob){ texturesDir.file(`${sanitizeFile(t.name)}.${t.ext||'png'}`, blob); } } catch(_){ }
    }));
    // Звуки
    const soundsDir = assetsRoot.folder('sounds');
    await Promise.all(((res.sounds)||[]).map(async s => {
      try { const blob = await AutoHE.getResourceBlob(s.id); if(blob){ soundsDir.file(`${sanitizeFile(s.name)}.${s.ext||'ogg'}`, blob); } } catch(_){ }
    }));
    // Миры
    const worldsRoot = heDir.folder('worlds');
    for(const w of (res.worlds||[])){
      const worldFolder = worldsRoot.folder(sanitizeFile(w.name||'world'));
      const rootName = (w.name||'world');
      const files = Array.isArray(w.files) ? w.files : [];
      for(const wf of files){
        try{
          const blob = await AutoHE.getResourceBlob(wf.id);
          if(!blob) continue;
          const rel = (wf.path||'').replace(/^\/?/,'');
          const parts = rel.split('/');
          const relPath = parts[0] === rootName ? parts.slice(1).join('/') : rel;
          if(relPath){ worldFolder.file(relPath, blob); }
        }catch(_){ }
      }
    }

    updateExportStatus('Создаём ZIP архив...');

    const outBlob = await zip.generateAsync({ type: 'blob' });
    
    updateExportStatus('Завершаем экспорт...');
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(outBlob);
    a.download = `${modid}-export.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);

    // Сформируем команды запуска для всех скриптов проекта
    try {
      const cmdsContainer = document.getElementById('exportCommands');
      if(cmdsContainer){
        const scripts = (project.scripts||[]);
        if(scripts.length){
          const lines = scripts.map(s => {
            const base = (s.name||'main');
            const ext = typeExt(s.type);
            // По требованию: команда без префикса hollowengine в пути
            const path = `scripts/${base}${ext}`;
            return `/hollowengine start-script @a ${path}`;
          });
          cmdsContainer.innerHTML = `
            <div style="margin-top:8px;">
              ${lines.map(l => `<pre style="background:#0a0e13;color:#b7c9dd;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);white-space:pre-wrap;margin:6px 0;">${l}</pre>`).join('')}
            </div>
          `;
        } else {
          cmdsContainer.innerHTML = '<div style="color:var(--muted);">В проекте нет скриптов</div>';
        }
      }
    } catch(_){}

    if(exportInfoDialog && exportInfoDialog.showModal){ exportInfoDialog.showModal(); }
  }

  // Функция для обновления статуса экспорта
  function updateExportStatus(message) {
    exportButtons.forEach(btn => {
      if(btn.disabled) {
        btn.textContent = message;
      }
    });
  }

  if(!project){
    alert('Проект не найден');
    AutoHE.go('projects.html');
    return;
  }

  title.textContent = project.name;

  addScriptBtn.onclick = () => {
    nameInput.value = '';
    descInput.value = '';
    document.querySelector('input[name="scriptType"][value="story"]').checked = true;
    createDialog.showModal();
    setTimeout(() => nameInput.focus(), 50);
  };

  createDialog.addEventListener('close', () => {
    if(createDialog.returnValue === 'confirm') {

      project = AutoHE.getProject(projectId);

      const scriptType = 'story';
      const scriptName = nameInput.value.trim().toLowerCase();
      const scriptDesc = descInput.value.trim();

      if (!scriptName) { alert('Введите имя скрипта'); return; }
      if (!/^[a-z0-9_]+$/.test(scriptName)) { alert('Имя может содержать только английские буквы, цифры и подчеркивания'); return; }
      if (project.scripts.some(s => s.name === scriptName)) { alert('Скрипт с таким именем уже существует'); return; }

      const script = AutoHE.addScript(projectId, scriptType, scriptName);
      if (script && scriptDesc) { script.description = scriptDesc; AutoHE.updateScript(projectId, script); }
      project = AutoHE.getProject(projectId);
      render();
    }
  });

  renameDialog.addEventListener('close', () => {
    if(renameDialog.returnValue === 'confirm' && currentRenameScript) {
      project = AutoHE.getProject(projectId);
      const newName = renameInput.value.trim().toLowerCase();
      if (!newName) return;
      if (!/^[a-z0-9_]+$/.test(newName)) { alert('Имя может содержать только английские буквы, цифры и подчеркивания'); return; }
      if (project.scripts.some(s => s.name === newName && s.id !== currentRenameScript.id)) { alert('Скрипт с таким именем уже существует'); return; }
      currentRenameScript.name = newName; AutoHE.updateScript(projectId, currentRenameScript);
      project = AutoHE.getProject(projectId);
      render();
    }
    currentRenameScript = null;
  });

  createForm.querySelector('[value="cancel"]').onclick = () => { createDialog.close('cancel'); };
  renameForm.querySelector('[value="cancel"]').onclick = () => { renameDialog.close('cancel'); };

  nameInput.addEventListener('input', (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
  renameInput.addEventListener('input', (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });

  // drag & drop: глобально предотвращаем открытие файла
  ;['dragenter','dragover','dragleave','drop'].forEach(ev=>{
    document.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); }, false);
  });

  // Состояние сворачивания категорий
  function loadCollapseState(){
    try{ const raw = localStorage.getItem(`autohe.resources.collapse.${projectId}`); return raw? JSON.parse(raw) : {}; }catch(_){ return {}; }
  }
  function saveCollapseState(state){
    try{ localStorage.setItem(`autohe.resources.collapse.${projectId}` , JSON.stringify(state||{})); }catch(_){ }
  }
  let collapseState = loadCollapseState();

  async function handleFiles(kind, files){
    const list = Array.from(files||[]);
    if(!list.length) return;
    for(const f of list){
    const ext = (f.name.split('.').pop()||'').toLowerCase();
      if(kind==='model' || ['glb','gltf'].includes(ext)){
    let animations = [];
    try { if(ext==='gltf'){ const text = await f.text(); const json = JSON.parse(text); if(Array.isArray(json.animations)) animations = json.animations.map((a,i)=>a.name||`anim_${i}`); } } catch(_){ }
        const entry = AutoHE.addResource(projectId, 'model', { name: f.name.replace(/\.[^.]+$/,''), ext, animations });
        try { await AutoHE.saveResourceBlob(projectId, entry.id, f); } catch(err){ console.warn('saveResourceBlob failed', err); }
      } else if(kind==='texture' || ['png','jpg','jpeg'].includes(ext)){
        const entry = AutoHE.addResource(projectId, 'texture', { name: f.name.replace(/\.[^.]+$/,''), ext });
        try { await AutoHE.saveResourceBlob(projectId, entry.id, f); } catch(err){ console.warn('saveResourceBlob failed', err); }
      } else if(kind==='sound' || ['ogg','wav','mp3'].includes(ext)){
        const entry = AutoHE.addResource(projectId, 'sound', { name: f.name.replace(/\.[^.]+$/,''), ext });
        try { await AutoHE.saveResourceBlob(projectId, entry.id, f); } catch(err){ console.warn('saveResourceBlob failed', err); }
      } else {
        console.warn('Unsupported file type', f.name);
      }
    }
    project = AutoHE.getProject(projectId);
    render();
  }

  hiddenFile.onchange = async (e)=>{ await handleFiles('auto', e.target.files); };

  async function handleWorldDir(fileList){
    const files = Array.from(fileList||[]);
    if(!files.length) return;
    // Определяем имя корневой папки мира. Если webkitRelativePath не даёт корень, берём из имени zip-папки, иначе 'world'
    let root = 'world';
    if(files[0] && files[0].webkitRelativePath){
      root = files[0].webkitRelativePath.split('/')[0] || 'world';
    } else if(files[0] && files[0].name){
      const p = files[0].name.split('/')[0]; if(p) root = p;
    }
    const worldEntry = AutoHE.addResource(projectId, 'world', { name: root, ext: 'dir', files: [] });
    for(const f of files){
      try{
        const fileId = AutoHE.generateId('wf');
        await AutoHE.saveResourceBlob(projectId, fileId, f);
        const rel = f.webkitRelativePath || f.name;
        worldEntry.files.push({ id: fileId, path: rel, size: f.size||0, mime: f.type||'' });
      }catch(err){ console.warn('save world file failed', err); }
    }
    AutoHE.updateResource(projectId, 'world', worldEntry);
    project = AutoHE.getProject(projectId);
    render();
  }

  hiddenDir.onchange = async (e)=>{ await handleWorldDir(e.target.files); };
  function openWorldViewer(world){
    if(!worldViewerDialog || !wvCanvas) return;
    if(wvRegionSelect){ wvRegionSelect.innerHTML = '<option value="all">Все файлы</option>'; }
    if(wvYInput){ wvYInput.value = 64; }
    renderWorldViewer(world, Number(wvYInput && wvYInput.value || 64));
    if(worldViewerDialog.showModal) worldViewerDialog.showModal();
    if(wvYInput){ wvYInput.oninput = ()=> renderWorldViewer(world, Number(wvYInput.value||64)); }
    if(wvRegionSelect){ wvRegionSelect.onchange = ()=> renderWorldViewer(world, Number(wvYInput.value||64)); }
  }
  async function renderWorldViewer(world, yLevel){
    const ctx = wvCanvas.getContext('2d');
    const W = wvCanvas.width, H = wvCanvas.height;
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#334155'; ctx.font = '12px system-ui'; ctx.fillText(`Y = ${yLevel}`, 8, 16);
    const files = (world.files||[]).slice(0, 144);
    const grid = Math.ceil(Math.sqrt(files.length||1));
    const cellW = Math.max(8, Math.floor(W / grid)), cellH = Math.max(8, Math.floor(H / grid));
    let i=0;
    for(const wf of files){
      const blob = await AutoHE.getResourceBlob(wf.id); if(!blob){ i++; continue; }
      const u8 = new Uint8Array(await blob.arrayBuffer());
      const seed = u8.length > 16 ? (u8[0] ^ u8[1] ^ u8[2] ^ u8[3]) : (i*53 & 255);
      const x = (i % grid) * cellW;
      const y = Math.floor(i / grid) * cellH;
      ctx.fillStyle = `hsl(${(seed*7)%360} 55% 45%)`;
      ctx.fillRect(x+1, y+1, cellW-2, cellH-2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '10px system-ui';
      const name = (wf.path||'').split('/').pop();
      ctx.fillText(String(name||'file').slice(0, 12), x+4, y+14);
      i++;
    }
    if(wvInfo){ wvInfo.textContent = `Файлов: ${(world.files||[]).length}, показываем: ${files.length}`; }
  }

  function render(){

    project = AutoHE.getProject(projectId);
    if(!project) return;

    title.textContent = project.name;

    try {
      if(dialogColorInput){ dialogColorInput.value = (project.settings && project.settings.dialogNameColor) || '#66CDAA'; }
      if(dialogPreview){
        const col = (project.settings && project.settings.dialogNameColor) || '#66CDAA';
        const visual = `<span style="color:${col}">[Имя нипа]</span> <span style="color:#fff">Сам текст тут</span>`;
        dialogPreview.innerHTML = visual;
      }
    } catch(_){ }

    const story = project.scripts.filter(s=>s.type==='story').length;
    const content = project.scripts.filter(s=>s.type==='content').length;
    const mod = project.scripts.filter(s=>s.type==='mod').length;
    scriptStats.innerHTML = `
      <span>Сюжетных: ${story}</span>
      <span>Контентных: ${content}</span>
      <span>Модификаций: ${mod}</span>
      <span>Всего: ${project.scripts.length}</span>
    `;

    scriptsList.innerHTML = '';
    if(project.scripts.length === 0) {
      scriptsList.innerHTML = `
        <div class="script-item" style="justify-content: center; text-align: center;">
          <div style="color: var(--muted);">
            Пока нет скриптов. Нажмите "Новый скрипт" чтобы создать первый.
          </div>
        </div>
      `;
    } else {
      const sortedScripts = [...project.scripts].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      sortedScripts.forEach(script => {
        if (!script.createdAt) { script.createdAt = new Date().toISOString(); AutoHE.updateScript(projectId, script); }
        const el = document.createElement('div'); el.className = 'script-item pop-in';
        const createdDate = new Date(script.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const description = script.description ? `<div style="font-size: 13px; color: var(--muted); margin-top: 2px;">${escapeHtml(script.description)}</div>` : '';
        el.innerHTML = `
          <div class="script-info">
            <div class="script-name">${escapeHtml(script.name)}</div>
            ${description}
            <div class="script-meta">
              <span class="script-type-badge ${script.type}">${AutoHE.typeLabel(script.type)}</span>
              <span>Создан: ${createdDate}</span>
              <span>Блоков: ${typeof script.blockCount === 'number' ? script.blockCount : (script.blocks ? script.blocks.length : 0)}</span>
            </div>
          </div>
          <div class="script-actions">
            <button class="btn btn-primary" data-open>Открыть</button>
            <button class="btn btn-ghost" data-rename>Переименовать</button>
            <button class="btn btn-ghost" data-delete>Удалить</button>
          </div>
        `;
        el.querySelector('[data-open]').onclick = ()=> AutoHE.go(`editor.html?projectId=${projectId}&scriptId=${script.id}`);
        el.querySelector('[data-rename]').onclick = ()=> renameScript(script);
        el.querySelector('[data-delete]').onclick = ()=> deleteScript(script.id);
        scriptsList.appendChild(el);
      });
    }

    const res = AutoHE.getResources(projectId);
    resourcesList.innerHTML = '';
    const groups = [
      { title: 'Модели', kind: 'model', accept: '.glb,.gltf', items: res.models||[] },
      { title: 'Текстуры', kind: 'texture', accept: '.png,.jpg,.jpeg,image/*', items: res.textures||[] },
      { title: 'Звуки', kind: 'sound', accept: '.ogg,.wav,.mp3,audio/*', items: res.sounds||[] },
      { title: 'Миры', kind: 'world', accept: 'directory', items: res.worlds||[] },
    ];
    if(groups.every(g => g.items.length===0)){
      resourcesList.innerHTML = `<div class=\"script-item\" style=\"justify-content:center; color: var(--muted);\">Пока нет ресурсов. Нажмите \\\"Добавить ресурсы\\\"</div>`;
    } else {
      groups.forEach(group => {
        const collapsed = !!collapseState[group.kind];
        const header = document.createElement('div');
        header.className='script-item';
        header.innerHTML = `<div class=\"script-info\"><div class=\"script-name\" style=\"display:flex;align-items:center;gap:8px;cursor:pointer;\"><span data-toggle>${collapsed?'▶':'▼'}</span><span>${group.title}</span></div></div>`;
        // dropzone
        const dz = document.createElement('div');
        dz.className = 'card';
        dz.style.cssText = 'margin:8px 0;padding:12px;border:1px dashed rgba(255,255,255,0.2);background:rgba(255,255,255,0.02); border-radius:8px;';
        dz.innerHTML = `<div style=\"display:flex;align-items:center;gap:8px;\"> <span>Перетащите сюда ${group.title.toLowerCase()}</span> <small style=\"color:var(--muted);\">или нажмите для выбора</small></div>`;
        const input = document.createElement('input'); input.type='file'; input.style.display='none'; if(group.kind!=='world'){ input.multiple = true; input.accept = group.accept; } else { input.webkitdirectory = true; }
        header.appendChild(dz); header.appendChild(input);
        const itemsContainer = document.createElement('div');
        if(collapsed){ dz.style.display='none'; }
        header.querySelector('[data-toggle]').addEventListener('click', ()=>{
          const now = dz.style.display==='none'?false:true;
          dz.style.display = now?'none':'block';
          itemsContainer.style.display = now?'none':'block';
          header.querySelector('[data-toggle]').textContent = now?'▶':'▼';
          collapseState[group.kind] = !now; saveCollapseState(collapseState);
        });
        const openPicker = ()=> input.click();
        dz.addEventListener('click', openPicker);
        dz.addEventListener('dragover', ()=> dz.style.borderColor='rgba(34,197,94,0.6)');
        dz.addEventListener('dragleave', ()=> dz.style.borderColor='rgba(255,255,255,0.2)');
        dz.addEventListener('drop', async (e)=>{
          dz.style.borderColor='rgba(255,255,255,0.2)';
          const dt = e.dataTransfer;
          if(!dt) return;
          if(group.kind==='world' && dt.items){
            const entries = [];
            for(const item of Array.from(dt.items)){
              const entry = item.webkitGetAsEntry && item.webkitGetAsEntry(); if(entry) entries.push(entry);
            }
            // Фоллбек: если нет directory entries — игнор
            // Обработаем через input кликом если нужно
            if(entries.length===0){ openPicker(); return; }
            // Прочитать файлы из папок не трогая файловую систему сложно без File System Access API; оставим клик
            openPicker();
            return;
          }
          await handleFiles(group.kind, dt.files ? Array.from(dt.files) : []);
        });
        input.onchange = async (e)=>{
          const files = Array.from(e.target.files||[]);
          if(group.kind==='world'){ await handleWorldDir(files); } else { await handleFiles(group.kind, files); }
        };
        resourcesList.appendChild(header);
        resourcesList.appendChild(itemsContainer);
        group.items.forEach(item => {
        const el = document.createElement('div'); el.className = 'script-item';
          const createdDate = new Date(item.createdAt).toLocaleDateString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
          const extra = group.kind==='model' && (item.animations||[]).length ? `<div style=\"font-size:12px; color: var(--muted);\">${escapeHtml((item.animations||[]).join(', '))}</div>` : '';
        el.innerHTML = `
            <div class=\"script-info\">
              <div class=\"script-name\">${escapeHtml(item.name)}${item.ext?` <small style=\\\"color:var(--muted);\\\">.${item.ext}</small>`:''}</div>
              <div class=\"script-meta\">
              <span>${createdDate}</span>
                ${group.kind==='model'?`<span>Анимаций: ${(item.animations||[]).length}</span>`:''}
                ${group.kind==='world' && Array.isArray(item.files)?`<span>Файлов: ${item.files.length}</span>`:''}
              </div>
              ${extra}
            </div>
            <div class=\"script-actions\">
              <button class=\"btn btn-ghost\" data-download>Скачать</button>
              ${group.kind==='world'?'<button class=\\"btn\\" data-view>Открыть</button>':''}
              <button class=\"btn btn-ghost\" data-remove>Удалить</button>
          </div>
        `;
          el.querySelector('[data-download]').onclick = async ()=>{
            if(group.kind === 'world'){
              try{
                await ensureJSZip();
                const zip = new JSZip();
                const root = sanitizeFile(item.name||'world');
                const folder = zip.folder(root);
                for(const wf of (item.files||[])){
                  try{ const blob = await AutoHE.getResourceBlob(wf.id); if(blob){ const rel = (wf.path||''); folder.file(rel, blob); } }catch(_){ }
                }
                const out = await zip.generateAsync({type:'blob'});
                const a=document.createElement('a'); a.href=URL.createObjectURL(out); a.download=`${root}.zip`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
              }catch(err){ alert('Не удалось собрать архив мира'); }
            } else {
              const blob = await AutoHE.getResourceBlob(item.id); if(!blob){ alert('Файл не найден'); return; }
              const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${item.name}${item.ext?'.'+item.ext:''}`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2500);
            }
          };
          if(group.kind==='world'){
            const viewBtn = el.querySelector('[data-view]');
            if(viewBtn){ viewBtn.onclick = ()=> openWorldViewer(item); }
          }
          el.querySelector('[data-remove]').onclick = async ()=>{
            if(!confirm('Удалить ресурс?')) return;
            if(group.kind === 'world'){
              for(const wf of (item.files||[])){
                try{ await AutoHE.deleteResourceBlob(wf.id); }catch(_){ }
              }
            } else {
              await AutoHE.deleteResourceBlob(item.id);
            }
            AutoHE.removeResource(projectId, group.kind, item.id);
            render();
          };
          itemsContainer.appendChild(el);
        });
      });
    }
  }

  function escapeHtml(s){ return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function renameScript(script){ currentRenameScript = script; renameInput.value = script.name; renameDialog.showModal(); setTimeout(() => renameInput.focus(), 50); }

  function deleteScript(id){ if(!confirm('Удалить скрипт?')) return; const p = AutoHE.getProject(projectId); p.scripts = p.scripts.filter(s => s.id !== id); AutoHE.saveProject(p); render(); }

  window.addEventListener('storage', (e)=>{ if(e.key === 'autohe.projects.v1'){ render(); } });

  if(dialogColorInput){
    dialogColorInput.addEventListener('input', (e)=>{
      const color = e.target.value || '#66CDAA';
      AutoHE.updateProjectSettings(projectId, { dialogNameColor: color });
      render();
    });
  }

  render();
})();
