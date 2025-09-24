(function(){
  const STORAGE_KEY = 'autohe.projects.v1';

  function readProjects(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ return [] }
  }
  function writeProjects(projects){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }
  function generateId(prefix='id'){ return `${prefix}_${Math.random().toString(36).slice(2,10)}` }
  function nowIso(){ return new Date().toISOString(); }

  // IndexedDB for models
  function openModelsDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open('autohe.models.v1', 1);
      req.onupgradeneeded = ()=>{ const db = req.result; if(!db.objectStoreNames.contains('models')) db.createObjectStore('models', { keyPath: 'id' }); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }
  async function saveModelBlob(projectId, modelId, blob){
    const db = await openModelsDB();
    await new Promise((resolve, reject)=>{
      const tx = db.transaction('models', 'readwrite');
      tx.objectStore('models').put({ id: modelId, projectId, blobType: blob.type || 'application/octet-stream', size: blob.size || 0, blob });
      tx.oncomplete = ()=> resolve(); tx.onerror = ()=> reject(tx.error);
    });
    db.close();
  }
  async function getModelBlob(modelId){
    const db = await openModelsDB();
    const rec = await new Promise((resolve, reject)=>{
      const tx = db.transaction('models', 'readonly');
      const req = tx.objectStore('models').get(modelId);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> reject(req.error);
    });
    db.close();
    return rec ? new Blob([rec.blob], { type: rec.blobType }) : null;
  }
  async function deleteModelBlob(modelId){
    const db = await openModelsDB();
    await new Promise((resolve, reject)=>{
      const tx = db.transaction('models', 'readwrite');
      tx.objectStore('models').delete(modelId);
      tx.oncomplete = ()=> resolve(); tx.onerror = ()=> reject(tx.error);
    });
    db.close();
  }

  // IndexedDB for large blocksState storage (avoid localStorage quota issues)
  function openStateDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open('autohe.state.v1', 1);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if(!db.objectStoreNames.contains('blocks')) db.createObjectStore('blocks', { keyPath: 'id' });
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }
  async function saveBlocksState(scriptId, data){
    const db = await openStateDB();
    await new Promise((resolve, reject)=>{
      const tx = db.transaction('blocks', 'readwrite');
      tx.objectStore('blocks').put({ id: scriptId, data, size: (data||'').length, updatedAt: nowIso() });
      tx.oncomplete = ()=> resolve();
      tx.onerror = ()=> reject(tx.error);
    });
    db.close();
  }
  async function getBlocksState(scriptId){
    const db = await openStateDB();
    const rec = await new Promise((resolve, reject)=>{
      const tx = db.transaction('blocks', 'readonly');
      const req = tx.objectStore('blocks').get(scriptId);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> reject(req.error);
    });
    db.close();
    return rec ? (rec.data || null) : null;
  }
  async function deleteBlocksState(scriptId){
    const db = await openStateDB();
    await new Promise((resolve, reject)=>{
      const tx = db.transaction('blocks', 'readwrite');
      tx.objectStore('blocks').delete(scriptId);
      tx.oncomplete = ()=> resolve();
      tx.onerror = ()=> reject(tx.error);
    });
    db.close();
  }

  function ensureProjectShape(p){
    if(!p) return p;
    if(!Array.isArray(p.scripts)) p.scripts = [];
    if(!p.settings) p.settings = { dialogNameColor: '#66CDAA' };
    // Defaults for choices settings (separate from dialogs)
    try{
      if(typeof p.settings.dialogNameColor !== 'string') p.settings.dialogNameColor = '#66CDAA';
      if(typeof p.settings.choicesQuestionColor !== 'string') p.settings.choicesQuestionColor = '#ffffff';
      if(typeof p.settings.choicesOptionColor !== 'string') p.settings.choicesOptionColor = '#ffffff';
      if(typeof p.settings.choicesOptionPrefix !== 'string') p.settings.choicesOptionPrefix = '> ';
      if(typeof p.settings.choicesBackgroundTexture !== 'string') p.settings.choicesBackgroundTexture = 'autohe:textures/cyber_bg.png';
    }catch(_){ }
    // legacy -> resources (только если ресурсов ещё нет)
    if(Array.isArray(p.models) && !p.resources){
      p.resources = {
        models: p.models,
        textures: [],
        sounds: [],
        worlds: [],
        heads: []
      };
    }
    if(!p.resources){ p.resources = { models: [], textures: [], sounds: [], worlds: [], heads: [] }; }
    // ensure all arrays exist
    const r = p.resources;
    if(!Array.isArray(r.models)) r.models = [];
    if(!Array.isArray(r.textures)) r.textures = [];
    if(!Array.isArray(r.sounds)) r.sounds = [];
    if(!Array.isArray(r.worlds)) r.worlds = [];
    if(!Array.isArray(r.heads)) r.heads = [];
    return p;
  }

  // Sanitize helpers for Resource naming rules [a-z0-9_]
  function sanitizeResourceToken(s){
    const input = String(s||'').toLowerCase();
    const map = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'i',
      'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
      'х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
    };
    const translit = input.split('').map(ch => map[ch] !== undefined ? map[ch] : ch).join('');
    const replaced = translit.replace(/[^a-z0-9_]+/g, '_');
    const collapsed = replaced.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return collapsed || 'file';
  }
  function sanitizeResourceExt(kind, ext){
    const e = String(ext||'').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if(kind === 'model') return (e === 'glb' || e === 'gltf') ? e : 'gltf';
    if(kind === 'texture') return (e === 'png' || e === 'jpg' || e === 'jpeg') ? e : 'png';
    if(kind === 'sound') return (e === 'ogg' || e === 'wav' || e === 'mp3') ? e : 'ogg';
    if(kind === 'head') return 'png';
    if(kind === 'world') return 'dir';
    return e || 'dat';
  }
  function sanitizeResourceEntry(kind, entry){
    if(!entry) return entry;
    if(typeof entry.name === 'string') entry.name = sanitizeResourceToken(entry.name);
    if('ext' in entry) entry.ext = sanitizeResourceExt(kind, entry.ext);
    return entry;
  }
  function sanitizeAllResources(projectId){
    const p = getProject(projectId); if(!p) return;
    let changed = false;
    const r = p.resources || { models: [], textures: [], sounds: [], worlds: [], heads: [] };
    ['model','texture','sound','world','head'].forEach(kind => {
      const list = kind==='model'?r.models: kind==='texture'?r.textures: kind==='sound'?r.sounds: kind==='world'?r.worlds: r.heads;
      for(let i=0;i<list.length;i++){
        const before = JSON.stringify(list[i]);
        sanitizeResourceEntry(kind, list[i]);
        if(JSON.stringify(list[i]) !== before) changed = true;
      }
    });
    if(changed) saveProject(p);
  }

  function getProjects(){ return readProjects().map(ensureProjectShape); }
  function getProject(projectId){ const p = readProjects().find(p => p.id === projectId) || null; return ensureProjectShape(p); }
  function saveProject(updated){
    const projects = readProjects();
    const idx = projects.findIndex(p => p.id === updated.id);
    if (idx >= 0) {
      projects[idx] = updated;
      // debug
      try{
        const r = updated.resources || {models:[],textures:[],sounds:[],worlds:[],heads:[]};
        console.log('[AutoHE][saveProject]', updated.id, {models:(r.models||[]).length, textures:(r.textures||[]).length, sounds:(r.sounds||[]).length, heads:(r.heads||[]).length, worlds:(r.worlds||[]).length});
      }catch(_){ }
      writeProjects(projects);
    }
  }
  function getProjectSettings(projectId){ const p = getProject(projectId); return p ? (p.settings || { dialogNameColor: '#66CDAA' }) : { dialogNameColor: '#66CDAA' }; }
  function updateProjectSettings(projectId, partial){ const p = getProject(projectId); if(!p) return; p.settings = { ...(p.settings||{}), ...partial }; saveProject(p); }
  function createProject(name){
    const project = {
      id: generateId('prj'),
      name: name || 'Новый проект',
      createdAt: nowIso(),
      scripts: [],
      resources: { models: [], textures: [], sounds: [], worlds: [], heads: [] }
    };
    const projects = readProjects();
    projects.unshift(project);
    writeProjects(projects);
    // Добавляем базовую модель classic.gltf из пресетов (асинхронно)
    (async ()=>{
      try{
        const resp = await fetch('assets/presets/classic.gltf', { method:'GET' });
        if(!resp.ok) return;
        const blob = await resp.blob();
        let animations = [];
        try {
          const text = await blob.text();
          try { const json = JSON.parse(text); if(Array.isArray(json.animations)) animations = json.animations.map((a,i)=>a.name||`anim_${i}`); } catch(_) {}
        } catch(_) {}
        const entry = addResource(project.id, 'model', { name: 'classic', ext: 'gltf', animations });
        try { await saveResourceBlob(project.id, entry.id, blob); } catch(_){ }
        // Обновить кеш проекта, чтобы модель сразу появилась в UI
        const p = getProject(project.id); if(p){ saveProject(p); }
      } catch(_){ }
    })();
    return project;
  }
  function addScript(projectId, type, name){
    const project = getProject(projectId);
    if(!project) return null;
    const script = {
      id: generateId('scr'),
      name: name || defaultScriptName(type),
      type,
      blocks: [],
      createdAt: nowIso()
    };
    project.scripts.push(script);
    saveProject(project);
    return script;
  }
  function updateScript(projectId, script){
    const project = getProject(projectId);
    if(!project) return;
    const idx = project.scripts.findIndex(s => s.id === script.id);
    if(idx >= 0){ project.scripts[idx] = script; saveProject(project); }
  }
  function getScript(projectId, scriptId){
    const project = getProject(projectId);
    if(!project) return null;
    return project.scripts.find(s => s.id === scriptId) || null;
  }

  // Resources API
  function getResources(projectId){
    sanitizeAllResources(projectId);
    const p = getProject(projectId);
    const res = p ? (p.resources || {models:[],textures:[],sounds:[],worlds:[],heads:[]}) : {models:[],textures:[],sounds:[],worlds:[],heads:[]};
    try{ console.log('[AutoHE][getResources]', projectId, {models:(res.models||[]).length, textures:(res.textures||[]).length, sounds:(res.sounds||[]).length, heads:(res.heads||[]).length, worlds:(res.worlds||[]).length}); }catch(_){ }
    return res;
  }
  function addResource(projectId, kind, data){
    const p = getProject(projectId); if(!p) return null;
    const idPrefix = kind==='model'?'mdl': kind==='texture'?'tex': kind==='sound'?'snd': kind==='head'?'hed':'wld';
    const entry = sanitizeResourceEntry(kind, { id: generateId(idPrefix), createdAt: nowIso(), ...data });
    if(kind==='model' && !Array.isArray(entry.animations)) entry.animations = [];
    delete entry.dataUrl; delete entry.blob;
    if(kind==='model') p.resources.models.push(entry);
    else if(kind==='texture') p.resources.textures.push(entry);
    else if(kind==='sound') p.resources.sounds.push(entry);
    else if(kind==='world') p.resources.worlds.push(entry);
    else if(kind==='head') p.resources.heads.push(entry);
    try{ const r=p.resources; console.log('[AutoHE][addResource]', projectId, kind, '->', entry.id, {models:r.models.length, textures:r.textures.length, sounds:r.sounds.length, heads:r.heads.length, worlds:r.worlds.length}); }catch(_){ }
    saveProject(p); return entry;
  }
  function updateResource(projectId, kind, entry){
    const p = getProject(projectId); if(!p) return;
    const list = kind==='model'?p.resources.models: kind==='texture'?p.resources.textures: kind==='sound'?p.resources.sounds: kind==='world'?p.resources.worlds: p.resources.heads;
    const i = list.findIndex(x=>x.id===entry.id); if(i>=0){ list[i]=entry; saveProject(p); }
  }
  function removeResource(projectId, kind, id){
    const p = getProject(projectId); if(!p) return;
    const list = kind==='model'?p.resources.models: kind==='texture'?p.resources.textures: kind==='sound'?p.resources.sounds: kind==='world'?p.resources.worlds: p.resources.heads;
    const i = list.findIndex(x=>x.id===id); if(i>=0){ list.splice(i,1); saveProject(p); }
  }

  // Backward-compat model helpers mapped to resources.models
  function getModels(projectId){ const r = getResources(projectId); return r.models || []; }
  function getModel(projectId, modelId){ return (getModels(projectId) || []).find(m=>m.id===modelId) || null; }
  function addModel(projectId, model){ return addResource(projectId, 'model', { animations: [], ...model }); }
  function updateModel(projectId, model){ return updateResource(projectId, 'model', model); }

  // Generic resource blob API (aliases to model blob storage)
  // Supports both signatures:
  //  - saveResourceBlob(projectId, resourceId, blob)
  //  - saveResourceBlob(resourceId, blob)
  async function saveResourceBlob(arg1, arg2, arg3){
    let projectId, resourceId, blob;
    if (arg3 !== undefined) { projectId = arg1; resourceId = arg2; blob = arg3; }
    else { projectId = null; resourceId = arg1; blob = arg2; }
    if(!blob) throw new Error('saveResourceBlob: blob is undefined');
    return saveModelBlob(projectId, resourceId, blob);
  }
  async function getResourceBlob(resourceId){ return getModelBlob(resourceId); }
  async function deleteResourceBlob(resourceId){ return deleteModelBlob(resourceId); }

  function defaultScriptName(type){
    if(type === 'story') return 'Новый сюжет';
    if(type === 'content') return 'Новый контент';
    if(type === 'mod') return 'Новая модификация';
    return 'Новый скрипт';
  }
  function typeLabel(type){
    return type === 'story' ? 'Сюжетный' : type === 'content' ? 'Контент' : type === 'mod' ? 'Модификация' : 'Скрипт';
  }

  function setYear(){
    const el = document.getElementById('year');
    if(el) el.textContent = String(new Date().getFullYear());
  }

  function qs(name){
    const url = new URL(location.href);
    return url.searchParams.get(name);
  }

  function go(url){ location.href = url; }

  async function exportProjectBundle(projectId){
    const p = getProject(projectId); if(!p) throw new Error('Project not found');
    // собрать метаданные и blobs моделей
    const models = await Promise.all(((p.resources&&p.resources.models)||[]).map(async m => {
      const blob = await getModelBlob(m.id);
      let fileData = null;
      if(blob){ const buf = await blob.arrayBuffer(); fileData = { mime: blob.type||'application/octet-stream', data: Array.from(new Uint8Array(buf)) }; }
      return { meta: m, file: fileData };
    }));
    return { version: 2, project: p, models };
  }
  async function importProjectBundle(bundle){
    if(!bundle || !bundle.project) throw new Error('Invalid bundle');
    const p = ensureProjectShape(bundle.project);
    // сохранить сам проект
    const projects = readProjects();
    const idx = projects.findIndex(x=>x.id===p.id);
    if(idx>=0) projects[idx]=p; else projects.unshift(p);
    writeProjects(projects);
    // сохранить модели в IndexedDB
    for(const entry of (bundle.models||[])){
      try{
        const meta = entry.meta; const file = entry.file;
        if(meta){ updateModel(p.id, meta); }
        if(file && file.data){
          const u8 = new Uint8Array(file.data);
          const blob = new Blob([u8], { type: file.mime||'application/octet-stream' });
          await saveModelBlob(p.id, meta.id, blob);
        }
      } catch(_){ }
    }
    return p;
  }

  window.AutoHE = {
    getProjects, getProject, saveProject, createProject,
    addScript, getScript, updateScript,
    getResources, addResource, updateResource, removeResource,
    // Back-compat model helpers and resource blob helpers
    getModels, getModel, addModel, updateModel,
    saveResourceBlob, getResourceBlob, deleteResourceBlob,
    // Legacy blob helpers (still exposed for older code)
    saveModelBlob, getModelBlob, deleteModelBlob,
    generateId, typeLabel, qs, go, setYear,
    getProjectSettings, updateProjectSettings,
    exportProjectBundle, importProjectBundle,
    // Large state storage helpers
    saveBlocksState, getBlocksState, deleteBlocksState
  };

  // Система уведомлений о модах
  const LATEST_MODS_VERSION = '1.2';

  function syncModsVersionAndNotify(){
    try{
      const stored = localStorage.getItem('autohe.mods.version');
      if(stored !== LATEST_MODS_VERSION){
        localStorage.setItem('autohe.mods.version', LATEST_MODS_VERSION);
        localStorage.setItem('autohe.mods.forceNotify', 'true');
      }
    }catch(_){ }
  }

  function checkAndShowModsNotification(){
    const hasSeenMods = localStorage.getItem('autohe.mods.seen');
    const forceNotify = localStorage.getItem('autohe.mods.forceNotify') === 'true';
    const shouldShow = !hasSeenMods || forceNotify;
    const badge = document.getElementById('modsNotificationBadge');
    if(badge && shouldShow){
      badge.style.display = 'inline-block';
    }
  }
  
  // Функция для принудительного показа уведомления (когда администратор обновил моды)
  function forceModsNotification(){
    localStorage.setItem('autohe.mods.forceNotify', 'true');
    checkAndShowModsNotification();
  }
  
  // Добавляем функции в глобальный объект
  window.AutoHE.checkAndShowModsNotification = checkAndShowModsNotification;
  window.AutoHE.forceModsNotification = forceModsNotification;

  document.addEventListener('DOMContentLoaded', setYear);
  document.addEventListener('DOMContentLoaded', syncModsVersionAndNotify);
  document.addEventListener('DOMContentLoaded', checkAndShowModsNotification);
})();