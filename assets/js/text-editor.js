// ========================
// ТЕКСТОВЫЙ РЕДАКТОР ДИАЛОГОВ
// ========================

(() => {
  // Подключаем AutoHE API
  const AutoHE = window.AutoHE;
  
  let currentProject = null;
  let currentScript = null;
  let projectId = null;
  let scriptId = null;
  let existingNPCs = new Set(); // Получаем заранее из основного редактора
  let existingNpcModelsByName = new Map(); // name -> modelId, собранные из blocksState проекта
  
  // Инициализация
  document.addEventListener('DOMContentLoaded', () => {
    loadProjectAndScript();
    initTextEditor();
  });
  
  function loadProjectAndScript() {
    const urlParams = new URLSearchParams(window.location.search);
    projectId = urlParams.get('projectId');
    scriptId = urlParams.get('scriptId');
    const npcData = urlParams.get('npcs');
    
    console.log('Загрузка:', { projectId, scriptId, npcData });
    
    if (!projectId || !scriptId) {
      alert('Ошибка: не указан проект или скрипт');
      window.location.href = 'projects.html';
      return;
    }
    
    // Загружаем существующих NPC из URL
    if (npcData) {
      try {
        console.log('NPC данные из URL (закодированные):', npcData);
        const decoded = atob(npcData);
        console.log('NPC данные после atob:', decoded);
        const npcArray = JSON.parse(decodeURIComponent(decoded));
        console.log('NPC данные после JSON.parse:', npcArray);
        existingNPCs = new Set(npcArray);
        console.log('Получены NPC из URL:', [...existingNPCs]);
      } catch (e) {
        console.warn('Ошибка декодирования NPC:', e);
        console.error('Полный стек ошибки:', e.stack);
        existingNPCs = new Set();
      }
    } else {
      console.log('NPC данные не переданы в URL');
    }
    
    // Используем API AutoHE как в основном редакторе
    currentProject = AutoHE.getProject(projectId);
    currentScript = AutoHE.getScript(projectId, scriptId);
    
    console.log('Загружен проект:', currentProject);
    console.log('Загружен скрипт:', currentScript);
    
    if (!currentProject || !currentScript) {
      alert('Проект или скрипт не найден');
      window.location.href = 'projects.html';
      return;
    }
    
    // Собираем модели существующих NPC из всех скриптов проекта
    try {
      existingNpcModelsByName = new Map();
      if (currentProject && Array.isArray(currentProject.scripts)) {
        currentProject.scripts.forEach(s => {
          if (!s || !s.blocksState) return;
          try {
            const state = JSON.parse(s.blocksState);
            // Рекурсивный обход любых структур JSON
            const visit = (node) => {
              if (!node || typeof node !== 'object') return;
              if (Array.isArray(node)) { node.forEach(visit); return; }
              // Если это блок создания NPC — извлекаем имя и модель
              if (node.type === 'create_npc') {
                const fields = node.fields;
                let name = null;
                let model = null;
                if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
                  name = fields.NAME || fields['NAME'] || null;
                  model = fields.MODEL_ID || fields['MODEL_ID'] || null;
                }
                // На всякий случай обходим альтернативные представления
                if ((!name || !model) && Array.isArray(fields)) {
                  try {
                    const byName = new Map(fields.map(f => [f && (f.name || f.field), f && (f.value || f.val)]));
                    name = name || byName.get('NAME') || null;
                    model = model || byName.get('MODEL_ID') || null;
                  } catch(_) {}
                }
                if (name && model) {
                  existingNpcModelsByName.set(String(name), String(model));
                }
              }
              // Обход вложенных свойств, включая next.block
              Object.keys(node).forEach(k => {
                if (k === 'next' && node.next && node.next.block) visit(node.next.block);
                else visit(node[k]);
              });
            };
            visit(state);
          } catch(_) {}
        });
      }
      try { console.log('📦 Найдены модели NPC в проекте:', Array.from(existingNpcModelsByName.entries())); } catch(_) {}
    } catch(_) {}

    // Обновляем UI
    document.getElementById('projectName').textContent = 
      `${currentProject.name} → ${currentScript.name}`;
  }
  
  const textEditor = {
    npcs: new Set(),
    autocompleteDropdown: null,
    
    // Транслитерация имени в ID
    nameToId(name) {
      const translit = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      
      return name.toLowerCase()
        .split('')
        .map(char => translit[char] || char)
        .join('')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    },
    
    init() {
      this.setupEventListeners();
      this.detectNPCs(); // Инициализация списка NPC
    },
    
    setupEventListeners() {
      // Кнопка возврата к редактору
      document.getElementById('backToProjectBtn').addEventListener('click', () => {
        if (projectId && scriptId) {
          window.location.href = `editor.html?projectId=${projectId}&scriptId=${scriptId}`;
        } else {
          window.location.href = 'projects.html';
        }
      });
      
      // Текстовое поле
      const textarea = document.getElementById('dialogTextarea');
      textarea.addEventListener('input', () => {
        this.updateLineCounter();
        this.detectNPCs();
      });
      
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          this.handleTabCompletion();
        }
        if (e.key === 'Escape') {
          this.hideAutocomplete();
        }
      });
      
      // Настройки
      document.getElementById('triggerType').addEventListener('change', (e) => {
        const keyGroup = document.getElementById('keySettingGroup');
        keyGroup.style.display = e.target.value === 'key' ? 'block' : 'none';
      });
      
      // Кнопка генерации блоков
      document.getElementById('generateBlocksBtn').addEventListener('click', () => {
        this.generateBlocks();
      });
    },
    
    updateLineCounter() {
      const textarea = document.getElementById('dialogTextarea');
      const lines = textarea.value.split('\n').length;
      document.getElementById('lineCounter').textContent = lines;
    },
    
    getExistingNPCs() {
      // Возвращаем NPC, полученные заранее из основного редактора
      console.log('Используем заранее полученных NPC:', [...existingNPCs]);
      return existingNPCs;
    },
    
    detectNPCs() {
      const textarea = document.getElementById('dialogTextarea');
      const text = textarea.value;
      const lines = text.split('\n');
      
      const detectedNPCs = new Set();
      
      console.log('detectNPCs вызван, existingNPCs:', [...existingNPCs]);
      
      // Добавляем всех существующих NPC из проекта
      existingNPCs.forEach(npc => detectedNPCs.add(npc));
      
      // Добавляем NPC из текущего диалога
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && trimmed.includes(':')) {
          const speaker = trimmed.split(':')[0].trim();
          if (speaker && speaker !== 'Игрок' && speaker !== 'игрок') {
            detectedNPCs.add(speaker);
          }
        }
      });
      
      console.log('Все найденные NPC:', [...detectedNPCs]);
      console.log('Существующие NPC:', [...existingNPCs]);
      
      // Обновляем список NPC, если есть изменения
      if (detectedNPCs.size !== this.npcs.size || 
          [...detectedNPCs].some(npc => !this.npcs.has(npc))) {
        console.log('Обновляем список NPC, старый размер:', this.npcs.size, 'новый размер:', detectedNPCs.size);
        this.npcs = detectedNPCs;
        this.updateNPCList();
      } else {
        console.log('Список NPC не изменился');
      }
    },
    
    updateNPCList() {
      const npcList = document.getElementById('npcList');
      
      console.log('updateNPCList вызван, npcs:', [...this.npcs]);
      
      if (this.npcs.size === 0) {
        npcList.innerHTML = '<div class="no-npcs">Добавьте NPC в диалог, чтобы настроить их</div>';
        return;
      }
      
      const existingNPCs = this.getExistingNPCs();
      console.log('existingNPCs в updateNPCList:', [...existingNPCs]);
      
      let html = '';
      this.npcs.forEach(npcName => {
        const safeName = npcName.replace(/'/g, "\\'");
        const isExisting = existingNPCs.has(npcName);
        const statusBadge = isExisting ? '<span class="npc-status existing">из проекта</span>' : '<span class="npc-status new">новый</span>';
        
        console.log(`Обрабатываем NPC: ${npcName}, isExisting: ${isExisting}`);
        
        html += `
          <div class="npc-item">
            <div class="npc-name">${npcName} ${statusBadge}</div>
            <div class="npc-settings">
              <div class="npc-setting">
                <label>Модель:</label>
                <select class="npc-model" data-npc="${safeName}" ${isExisting ? 'disabled title="NPC уже существует в проекте"' : ''}>
                  <option value="">Выбрать из проекта...</option>
                  ${this.getModelOptions()}
                </select>
              </div>
              <div class="npc-setting head-setting" style="display:none;">
                <label>Голова:</label>
                <select class="npc-head" data-npc="${safeName}" ${isExisting ? 'disabled' : ''}>
                  <option value="">Выбрать из проекта...</option>
                  ${this.getHeadOptions()}
                </select>
              </div>
            </div>
          </div>
        `;
      });
      
      npcList.innerHTML = html;
      
      // Показываем/скрываем поле головы в зависимости от типа чата
      this.updateHeadVisibility();
      
      // Проставляем выбранную модель для существующих NPC (если найдена в проекте)
      try {
        npcList.querySelectorAll('.npc-model').forEach(select => {
          const container = select.closest('.npc-item');
          const titleEl = container ? container.querySelector('.npc-name') : null;
          let npcName = null;
          if (titleEl) {
            // Берём первый текстовый узел до бэйджа статуса
            const firstNode = titleEl.childNodes[0];
            npcName = firstNode ? String(firstNode.textContent || '').trim() : null;
          }
          if (npcName) {
            const modelId = existingNpcModelsByName.get(npcName);
            if (modelId) {
              select.value = modelId;
            }
          }
        });
      } catch(_) {}

      // Обработчики для настроек NPC
      npcList.querySelectorAll('.npc-model').forEach(select => {
        select.addEventListener('change', () => {
          this.updateHeadVisibility();
        });
      });
      
      // Обработчик изменения типа чата
      document.getElementById('chatType').addEventListener('change', () => {
        this.updateHeadVisibility();
      });
    },
    
    getModelOptions() {
      // Получаем модели из проекта через оба источника; если их нет — ничего не показываем
      const models = [];

      try {
        const apiModels = AutoHE.getModels(projectId);
        if (Array.isArray(apiModels)) {
          apiModels.forEach(m => { if (m && m.id) models.push([m.name || m.id, m.id]); });
        }
      } catch(e){ console.warn('getModelOptions: getModels failed', e); }

      try {
        const res = AutoHE.getResources(projectId);
        const resModels = res && res.models;
        if (models.length === 0 && Array.isArray(resModels)) {
          resModels.forEach(m => { if (m && m.id) models.push([m.name || m.id, m.id]); });
        }
      } catch(e){ console.warn('getModelOptions: getResources failed', e); }

      // Если моделей нет — вернём пустой список (не показываем базовые)
      if (models.length === 0) return '';

      return models.map(model => `<option value="${model[1]}">${model[0]}</option>`).join('');
    },
    
    getHeadOptions() {
      try {
        const res = AutoHE.getResources(projectId);
        const heads = res && Array.isArray(res.heads) ? res.heads : [];
        if (!heads.length) return '';
        return heads
          .map(h => `${h.name}.png`)
          .map(v => `<option value="${String(v).toLowerCase()}">${String(v).toLowerCase()}</option>`)
          .join('');
      } catch(_) { return ''; }
    },
    
    updateHeadVisibility() {
      const chatType = document.getElementById('chatType').value;
      const headSettings = document.querySelectorAll('.head-setting');
      
      headSettings.forEach(setting => {
        setting.style.display = chatType === 'center' ? 'block' : 'none';
      });
    },
    
    handleTabCompletion() {
      const textarea = document.getElementById('dialogTextarea');
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = textarea.value.substring(0, cursorPos);
      const currentLine = textBeforeCursor.split('\n').pop();
      
      // Ищем частичное совпадение с именами NPC
      const matches = [...this.npcs].filter(npc => 
        npc.toLowerCase().startsWith(currentLine.toLowerCase()) && 
        npc.toLowerCase() !== currentLine.toLowerCase()
      );
      
      if (matches.length === 1) {
        // Автодополнение одного совпадения
        const completion = matches[0];
        const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
        const newText = textarea.value.substring(0, lineStart) + 
                       completion + ': ' + 
                       textarea.value.substring(cursorPos);
        textarea.value = newText;
        textarea.selectionStart = textarea.selectionEnd = lineStart + completion.length + 2;
      } else if (matches.length > 1) {
        // Показываем выпадающий список
        this.showAutocomplete(matches, cursorPos, currentLine);
      }
    },
    
    showAutocomplete(matches, cursorPos, currentLine) {
      this.hideAutocomplete();
      
      const textarea = document.getElementById('dialogTextarea');
      const dropdown = document.createElement('div');
      dropdown.className = 'autocomplete-dropdown';
      dropdown.id = 'autocompleteDropdown';
      
      matches.forEach((match, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        if (index === 0) item.classList.add('selected');
        item.textContent = match;
        item.addEventListener('click', () => {
          this.selectAutocomplete(match, cursorPos, currentLine);
        });
        dropdown.appendChild(item);
      });
      
      // Позиционирование
      const rect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const lines = textarea.value.substring(0, cursorPos).split('\n').length;
      
      dropdown.style.position = 'absolute';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.top = (rect.top + (lines * lineHeight)) + 'px';
      
      document.body.appendChild(dropdown);
      this.autocompleteDropdown = dropdown;
      
      // Обработка клавиш
      textarea.addEventListener('keydown', this.handleAutocompleteKeys.bind(this));
    },
    
    handleAutocompleteKeys(e) {
      if (!this.autocompleteDropdown) return;
      
      const items = this.autocompleteDropdown.querySelectorAll('.autocomplete-item');
      let selectedIndex = [...items].findIndex(item => item.classList.contains('selected'));
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[selectedIndex].classList.remove('selected');
        selectedIndex = (selectedIndex + 1) % items.length;
        items[selectedIndex].classList.add('selected');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[selectedIndex].classList.remove('selected');
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
        items[selectedIndex].classList.add('selected');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = items[selectedIndex];
        if (selectedItem) {
          selectedItem.click();
        }
      }
    },
    
    selectAutocomplete(match, cursorPos, currentLine) {
      const textarea = document.getElementById('dialogTextarea');
      const lineStart = textarea.value.lastIndexOf('\n', cursorPos - 1) + 1;
      const newText = textarea.value.substring(0, lineStart) + 
                     match + ': ' + 
                     textarea.value.substring(cursorPos);
      textarea.value = newText;
      textarea.selectionStart = textarea.selectionEnd = lineStart + match.length + 2;
      this.hideAutocomplete();
    },
    
    hideAutocomplete() {
      if (this.autocompleteDropdown) {
        this.autocompleteDropdown.remove();
        this.autocompleteDropdown = null;
      }
    },
    
    async generateBlocks() {
      const textarea = document.getElementById('dialogTextarea');
      const text = textarea.value.trim();
      if (!text) {
        alert('Введите диалог для генерации блоков');
        return;
      }
      
      const lines = text.split('\n').filter(line => line.trim());
      const triggerType = document.getElementById('triggerType').value;
      const triggerKey = document.getElementById('triggerKey').value;
      const chatType = document.getElementById('chatType').value;
      
      // Собираем настройки NPC
      const npcSettings = {};
      document.querySelectorAll('.npc-item').forEach(item => {
        const name = item.querySelector('.npc-name').textContent.replace(/\s+(из проекта|новый)$/, '');
        const modelSelect = item.querySelector('.npc-model');
        const headInput = item.querySelector('.npc-head');
        const model = modelSelect && !modelSelect.disabled ? modelSelect.value : '';
        const head = headInput && !headInput.disabled ? headInput.value : '';
        npcSettings[name] = { model, head };
      });
      
      try {
        console.log('Начинаем генерацию блоков...');
        console.log('Параметры:', { triggerType, triggerKey, chatType, npcSettings });
        console.log('Строки диалога:', lines);
        
        const blocklyCode = this.createBlocksCode(lines, triggerType, triggerKey, chatType, npcSettings);
        console.log('Сгенерированные блоки:', blocklyCode);
        
        // Сохраняем в конкретный скрипт через API AutoHE
        if (currentScript && projectId && scriptId) {
          console.log('Сохраняем в скрипт:', { projectId, scriptId, currentScript: currentScript.name });
          
          // Обновляем скрипт - сохраняем в blocksState для совместимости с основным редактором
          const jsonState = JSON.stringify(blocklyCode);
          // Пытаемся сохранить компактно: большой state уводим в IndexedDB
          let saveResult = null;
          try {
            if (jsonState.length > 200000) {
              await AutoHE.saveBlocksState(scriptId, jsonState);
              const updatedScript = { ...currentScript, blocksState: '__IDXDB__' };
              saveResult = AutoHE.updateScript(projectId, updatedScript);
              console.log('Сохранено в IndexedDB, ссылка в script.blocksState = __IDXDB__');
            } else {
              const updatedScript = { ...currentScript, blocksState: jsonState };
              saveResult = AutoHE.updateScript(projectId, updatedScript);
              console.log('Сохранено непосредственно в blocksState');
            }
          } catch (e) {
            // Fallback: сохраняем напрямую
            const updatedScript = { ...currentScript, blocksState: jsonState };
            saveResult = AutoHE.updateScript(projectId, updatedScript);
          }
          console.log('Результат сохранения:', saveResult);
          
          console.log('Скрипт сохранен успешно');
        } else {
          console.error('Отсутствуют данные для сохранения:', { currentScript, projectId, scriptId });
        }
        
        alert('Блоки успешно созданы и сохранены в скрипт!');
        
        // Переходим к редактору
        if (projectId && scriptId) {
          window.location.href = `editor.html?projectId=${projectId}&scriptId=${scriptId}`;
        }
      } catch (error) {
        console.error('Ошибка создания блоков:', error);
        console.error('Стек ошибки:', error.stack);
        alert('Ошибка при создании блоков: ' + error.message);
      }
    },
    
    createBlocksCode(lines, triggerType, triggerKey, chatType, npcSettings) {
      // Создаем простую структуру, которую поймет редактор
      const blocklyData = {
        blocks: {
          languageVersion: 0,
          blocks: []
        }
      };
      
      const existingNPCs = this.getExistingNPCs();
      const createdNPCs = new Set();
      let yPosition = 50;
      
      // 1. Создаем новые NPC блоки (только те, которых нет в проекте)
      const npcBlocks = [];
      let npcYPosition = 170; // Начинаем после триггера входа
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && trimmed.includes(':')) {
          const speaker = trimmed.split(':')[0].trim();
          if (speaker && speaker !== 'Игрок' && speaker !== 'игрок' && 
              !createdNPCs.has(speaker) && !existingNPCs.has(speaker)) {
            const npcId = this.nameToId(speaker);
            const settings = npcSettings[speaker] || {};
            
            console.log(`Создаем новый NPC: ${speaker} (ID: ${npcId})`);
            
            const npcBlock = {
              type: 'create_npc',
              id: `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              x: 50,
              y: npcYPosition,
              fields: {
                ID: npcId,
                NAME: speaker,
                MODEL_ID: settings.model || 'minecraft:player',
                X: 0,
                Y: 64,
                Z: 0,
                SHOW_NAME: false,
                WORLD: 'overworld'
              }
            };
            
            npcBlocks.push(npcBlock);
            npcYPosition += 120;
            createdNPCs.add(speaker);
          } else if (existingNPCs.has(speaker)) {
            console.log(`NPC ${speaker} уже существует в проекте, пропускаем создание`);
          }
        }
      });
      
      // 2. Создаем диалоги с триггерами по правилам
      const dialogBlocks = [];
      let dialogYPosition = npcYPosition; // Продолжаем после NPC

      // Разбираем строки на структуру { speakerName, isPlayer, message }
      const parsed = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes(':')) continue;
        const [speaker, ...messageParts] = trimmed.split(':');
        const speakerName = (speaker || '').trim();
        const isPlayer = (speakerName === 'Игрок' || speakerName === 'игрок');
        const message = messageParts.join(':').trim();
        parsed.push({ speakerName, isPlayer, message });
      }

      // Первый NPC-спикер для начального триггера
      const firstNpc = parsed.find(p => !p.isPlayer);

      // Начальный триггер после создания NPC
      if (triggerType === 'rightclick' && firstNpc) {
        const triggerBlock = {
          type: 'trigger_npc_wait_interact',
          id: `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: 50,
          y: dialogYPosition,
          fields: { NPC: this.nameToId(firstNpc.speakerName) }
        };
        dialogBlocks.push(triggerBlock);
        dialogYPosition += 120;
      } else if (triggerType === 'key') {
        const keyBlock = {
          type: 'trigger_keybind',
          id: `key_trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: 50,
          y: dialogYPosition,
          fields: { KEY: (triggerKey || 'F').toUpperCase() }
        };
        dialogBlocks.push(keyBlock);
        dialogYPosition += 120;
      }

      // Триггер перед каждой последующей репликой и сам диалог
      let lastNpcSpeakerName = firstNpc ? firstNpc.speakerName : null;
      parsed.forEach((p, index) => {
        // Для первой строки начальный триггер уже добавлен — не добавляем ещё один
        if (index > 0) {
          if (triggerType === 'rightclick') {
            // Для реплики игрока — триггер по последнему NPC, для NPC — по самому NPC
            const targetNpc = p.isPlayer ? (lastNpcSpeakerName ? this.nameToId(lastNpcSpeakerName) : null)
                                          : this.nameToId(p.speakerName);
            if (targetNpc) {
              const t = {
                type: 'trigger_npc_wait_interact',
                id: `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                x: 50,
                y: dialogYPosition,
                fields: { NPC: targetNpc }
              };
              dialogBlocks.push(t);
              dialogYPosition += 120;
            }
          } else if (triggerType === 'key') {
            const t = {
              type: 'trigger_keybind',
              id: `key_trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              x: 50,
              y: dialogYPosition,
              fields: { KEY: (triggerKey || 'F').toUpperCase() }
            };
            dialogBlocks.push(t);
            dialogYPosition += 120;
          }
        }

        // Сам диалог-блок
        const dialogBlock = {
          type: 'dialog_tellraw',
          id: `dialog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: 50,
          y: dialogYPosition,
          fields: {
            SOURCE: p.isPlayer ? '__PLAYER_FIRST__' : this.nameToId(p.speakerName),
            TYPE: chatType === 'center' ? 'CENTER' : 'CLASSIC',
            TEXT: p.message
          }
        };
        if (!p.isPlayer && chatType === 'center') {
          const s = npcSettings[p.speakerName] || {};
          if (s.head) dialogBlock.fields.HEAD = s.head;
          dialogBlock.fields.TIME = 3;
        }
        if (p.isPlayer && chatType === 'center') {
          dialogBlock.fields.TIME = 3;
        }
        dialogBlocks.push(dialogBlock);
        dialogYPosition += 120;

        if (!p.isPlayer) lastNpcSpeakerName = p.speakerName;
      });
      
      // 3. Создаем триггер входа в начало
      const entryTrigger = {
        type: 'trigger_entry_point',
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: 50,
        y: 50,
        fields: {}
      };
      
      // 4. Связываем блоки через next, но складываем в один корневой блок для компактности JSON
      const allBlocks = [entryTrigger, ...npcBlocks, ...dialogBlocks];
      for (let i = 0; i < allBlocks.length - 1; i++) {
        allBlocks[i].next = { block: allBlocks[i + 1] };
      }
      blocklyData.blocks.blocks = allBlocks.length ? [allBlocks[0]] : [];
      
      return blocklyData;
    }
  };
  
  function initTextEditor() {
    textEditor.init();
  }
})();
