(function(){
  const projectId = AutoHE.qs('projectId');
  const scriptId = AutoHE.qs('scriptId');
  const project = AutoHE.getProject(projectId);
  const script = AutoHE.getScript(projectId, scriptId);
  if(!project || !script){
    alert('Скрипт не найден');
    AutoHE.go('projects.html');
    return;
  }

  const editorTitle = document.getElementById('editorTitle');
  const breadcrumbs = document.getElementById('breadcrumbs');
  const kotlinPreview = document.getElementById('kotlinPreview');

  editorTitle.textContent = script.name;
  breadcrumbs.innerHTML = `<a href="project.html?id=${projectId}" class="btn btn-ghost">← ${escapeHtml(project.name)}</a>`;

  const theme = Blockly.Theme.defineTheme('autohe-dark', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      toolboxBackgroundColour: '#0e131a',
      toolboxForegroundColour: '#e8eff7',
      flyoutBackgroundColour: '#0e131a',
      flyoutForegroundColour: '#e8eff7',
      flyoutOpacity: 1,
      insertionMarkerColour: '#7c3aed',
      insertionMarkerOpacity: 0.5,
      scrollbarColour: '#8aa0b8',
      scrollbarOpacity: 0.5,
      cursorColour: '#7c3aed',
    },
    categoryStyles: {
      events_category: { colour: '#3b82f6' },
      control_category: { colour: '#ef4444' },
      actions_category: { colour: '#22c55e' },
      logic_category: { colour: '#9333ea' },
      variables_category: { colour: '#64748b' },
      npc_category: { colour: '#06b6d4' },
      dialog_category: { colour: '#f59e0b' },
      triggers_category: { colour: '#14b8a6' },
      quests_category: { colour: '#e11d48' },
      trade_category: { colour: '#f97316' },
      async_category: { colour: '#60a5fa' },
      search_category: { colour: '#000000' }
    },
    blockStyles: {}
  });

  // Категории, как в Scratch
  const toolbox = {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: 'Триггеры', categorystyle: 'triggers_category', contents: [
        { kind: 'block', type: 'trigger_entry_point' },
        { kind: 'block', type: 'trigger_join_script' },
        { kind: 'block', type: 'trigger_after_script' },
        { kind: 'block', type: 'trigger_repeatable_script' }
      ]},
      { kind: 'category', name: 'Управление', categorystyle: 'control_category', contents: [
        { kind: 'block', type: 'wait_seconds' },
        // Новые блоки эффектов
        { kind: 'block', type: 'fade_in' },
        { kind: 'block', type: 'fade_out' },
        { kind: 'block', type: 'play_sound' }
      ]},
      { kind: 'category', name: 'NPC', categorystyle: 'npc_category', contents: [
        { kind: 'block', type: 'create_npc' },
        // Новые блоки NPC настроек
        { kind: 'block', type: 'npc_invulnerable' },
        { kind: 'block', type: 'npc_hitbox' },
        { kind: 'block', type: 'npc_attack_damage' }
      ]},
      { kind: 'category', name: 'Диалоги', categorystyle: 'dialog_category', contents: [
        { kind: 'block', type: 'dialog_tellraw' },
        { kind: 'block', type: 'dialog_notification' },
        // Динамические выборы
        { kind: 'block', type: 'dialog_choices' }
      ]},
      { kind: 'category', name: 'Логика', categorystyle: 'logic_category', contents: [
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' }
      ]},
    ]
  };

  // Квесты — блоки
  Blockly.Blocks['quest_add'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('создать квест')
        .appendField(new Blockly.FieldTextInput('Начало'), 'QNAME')
        .appendField('с автором')
        .appendField(new Blockly.FieldTextInput('Автор'), 'AUTHOR')
        .appendField('показать уведомление')
        .appendField(new Blockly.FieldDropdown([["true","TRUE"],["false","FALSE"]]), 'NOTIFY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#e11d48');
      this.setTooltip('execute { /quest add @a <id> "<имя>" "<автор>" | <true/false> }');
    }
  };
  Blockly.Blocks['quest_remove'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('удалить квест')
        .appendField(new Blockly.FieldDropdown(() => getQuestNameOptions()), 'QNAME')
        .appendField('показать уведомление')
        .appendField(new Blockly.FieldDropdown([["true","TRUE"],["false","FALSE"]]), 'NOTIFY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#e11d48');
      this.setTooltip('execute { /quest remove @a <id> | <true/false> }');
    }
  };
  Blockly.Blocks['quest_set_status'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('установить статус квеста')
        .appendField(new Blockly.FieldDropdown(() => getQuestNameOptions()), 'QNAME')
        .appendField('на')
        .appendField(new Blockly.FieldDropdown([["выполнен","COMPLETE"],["провален","FAIL"]]), 'STATUS')
        .appendField('показать уведомление')
        .appendField(new Blockly.FieldDropdown([["true","TRUE"],["false","FALSE"]]), 'NOTIFY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#e11d48');
      this.setTooltip('execute { /quest complete|fail @a <id> | <true/false> }');
    }
  };

  // Квесты — описание (append)
  Blockly.Blocks['quest_append'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('описание квеста')
        .appendField(new Blockly.FieldDropdown(() => getQuestNameOptions()), 'QNAME');
      const block = this;
      
      // Скрытое поле для хранения текста
      this.appendDummyInput('HIDDEN_STORE')
        .appendField(new Blockly.FieldTextInput('', null), 'QTEXT');
      this.getInput('HIDDEN_STORE').setVisible(false);

      // Кнопка редактирования через изображение-иконку
      const btnIcon = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>');
      
      this.appendDummyInput('TEXT_ROW')
        .appendField('текст')
        .appendField(new Blockly.FieldImage(btnIcon, 16, 16, 'Редактировать'), 'BTN_IMG')
        .appendField('Редактировать', 'BTN_LABEL');
      
      this.appendDummyInput()
        .appendField('показать уведомление')
        .appendField(new Blockly.FieldDropdown([["true","TRUE"],["false","FALSE"]]), 'NOTIFY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#e11d48');
      this.setTooltip('execute { /quest append @a <id> "<текст>" | <true/false> }');

      // Привязываем клик к иконке
      setTimeout(() => {
        try {
          const imgField = this.getField('BTN_IMG');
          if (imgField && imgField.imageElement_) {
            imgField.imageElement_.style.cursor = 'pointer';
            imgField.imageElement_.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              try { openMultilineEditor(block, 'QTEXT', 'Описание квеста'); } catch(_) {}
            });
          }
          
          // Также привязываем к тексту "Редактировать"
          const labelField = this.getField('BTN_LABEL');
          if (labelField && labelField.textElement_) {
            labelField.textElement_.style.cursor = 'pointer';
            labelField.textElement_.style.fill = 'white';
            labelField.textElement_.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              try { openMultilineEditor(block, 'QTEXT', 'Описание квеста'); } catch(_) {}
            });
          }
        } catch(_) {}
      }, 100);
    }
  };

  // Квесты — цели
  Blockly.Blocks['quest_goal'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('создать цель')
        .appendField(new Blockly.FieldTextInput('Найти выход'), 'GOAL_NAME')
        .appendField('для квеста')
        .appendField(new Blockly.FieldDropdown(() => getQuestNameOptions()), 'QNAME');
      this.appendDummyInput()
        .appendField('показать уведомление')
        .appendField(new Blockly.FieldDropdown([["true","TRUE"],["false","FALSE"]]), 'NOTIFY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#e11d48');
      this.setTooltip('Создает цель квеста (без триггеров)');
    }
  };

  // Кастомные блоки
  // Триггеры запуска (аннотации файла)
  Blockly.Blocks['trigger_entry_point'] = {
    init: function(){
      this.appendDummyInput().appendField('при первом входе в мир (EntryPoint)');
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('Ставит аннотацию @file:EntryPoint — автозапуск при первом входе в мир');
    }
  };
  Blockly.Blocks['trigger_join_script'] = {
    init: function(){
      this.appendDummyInput().appendField('при входе в мир (JoinScript)');
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('Ставит аннотацию @file:JoinScript — автозапуск при каждом входе');
    }
  };
  Blockly.Blocks['trigger_after_script'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('после скрипта')
        .appendField(new Blockly.FieldTextInput('scripts/path/to/script.se.kts'), 'PATH');
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('Ставит аннотацию @file:AfterScript("<path>")');
    }
  };
  Blockly.Blocks['trigger_repeatable_script'] = {
    init: function(){
      this.appendDummyInput().appendField('повторяемый скрипт (RepeatableScript)');
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('Ставит аннотацию @file:RepeatableScript');
    }
  };

  // Управление
  Blockly.Blocks['wait_seconds'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('ждать')
        .appendField(new Blockly.FieldNumber(5, 0, 999, 1), 'SECS')
        .appendField('секунд');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#ef4444');
      this.setTooltip('wait { 5.sec } — ожидание указанного времени');
    }
  };

  // КАТСЦЕНЫ: камера — движение по пути (spline)
  Blockly.Blocks['camera_spline'] = {
    init: function(){
      this.appendDummyInput().appendField('камера: движение (spline)');
      this.appendDummyInput()
        .appendField('время (сек)')
        .appendField(new Blockly.FieldNumber(60, 1, 36000, 1), 'TIME');
      this.appendDummyInput()
        .appendField('файл пути (*.nbt.nbt)')
        .appendField(new Blockly.FieldTextInput('prologue.nbt.nbt'), 'FILE');
      this.appendDummyInput()
        .appendField('интерполяция')
        .appendField(new Blockly.FieldDropdown([
          ['LINEAR','Interpolation.LINEAR'],
          ['SINE_IN','Interpolation.SINE_IN'],['SINE_OUT','Interpolation.SINE_OUT'],['SINE_IN_OUT','Interpolation.SINE_IN_OUT'],
          ['QUAD_IN','Interpolation.QUAD_IN'],['QUAD_OUT','Interpolation.QUAD_OUT'],['QUAD_IN_OUT','Interpolation.QUAD_IN_OUT'],
          ['CUBIC_IN','Interpolation.CUBIC_IN'],['CUBIC_OUT','Interpolation.CUBIC_OUT'],['CUBIC_IN_OUT','Interpolation.CUBIC_IN_OUT'],
          ['QUART_IN','Interpolation.QUART_IN'],['QUART_OUT','Interpolation.QUART_OUT'],['QUART_IN_OUT','Interpolation.QUART_IN_OUT'],
          ['QUINT_IN','Interpolation.QUINT_IN'],['QUINT_OUT','Interpolation.QUINT_OUT'],['QUINT_IN_OUT','Interpolation.QUINT_IN_OUT'],
          ['EXPO_IN','Interpolation.EXPO_IN'],['EXPO_OUT','Interpolation.EXPO_OUT'],['EXPO_IN_OUT','Interpolation.EXPO_IN_OUT'],
          ['CIRC_IN','Interpolation.CIRC_IN'],['CIRC_OUT','Interpolation.CIRC_OUT'],['CIRC_IN_OUT','Interpolation.CIRC_IN_OUT'],
          ['BACK_IN','Interpolation.BACK_IN'],['BACK_OUT','Interpolation.BACK_OUT'],['BACK_IN_OUT','Interpolation.BACK_IN_OUT'],
          ['ELASTIC_IN','Interpolation.ELASTIC_IN'],['ELASTIC_OUT','Interpolation.ELASTIC_OUT'],['ELASTIC_IN_OUT','Interpolation.ELASTIC_IN_OUT'],
          ['BOUNCE_IN','Interpolation.BOUNCE_IN'],['BOUNCE_OUT','Interpolation.BOUNCE_OUT'],['BOUNCE_IN_OUT','Interpolation.BOUNCE_IN_OUT']
        ]), 'INTERP');
      this.appendDummyInput()
        .appendField('границы')
        .appendField(new Blockly.FieldDropdown([["вкл","TRUE"],["выкл","FALSE"]]), 'BORDERS');
      this.appendDummyInput()
        .appendField('интерполяция границ')
        .appendField(new Blockly.FieldDropdown([
          ['LINEAR','Interpolation.LINEAR'],
          ['SINE_IN','Interpolation.SINE_IN'],['SINE_OUT','Interpolation.SINE_OUT'],['SINE_IN_OUT','Interpolation.SINE_IN_OUT'],
          ['QUAD_IN','Interpolation.QUAD_IN'],['QUAD_OUT','Interpolation.QUAD_OUT'],['QUAD_IN_OUT','Interpolation.QUAD_IN_OUT'],
          ['CUBIC_IN','Interpolation.CUBIC_IN'],['CUBIC_OUT','Interpolation.CUBIC_OUT'],['CUBIC_IN_OUT','Interpolation.CUBIC_IN_OUT'],
          ['QUART_IN','Interpolation.QUART_IN'],['QUART_OUT','Interpolation.QUART_OUT'],['QUART_IN_OUT','Interpolation.QUART_IN_OUT'],
          ['QUINT_IN','Interpolation.QUINT_IN'],['QUINT_OUT','Interpolation.QUINT_OUT'],['QUINT_IN_OUT','Interpolation.QUINT_IN_OUT'],
          ['EXPO_IN','Interpolation.EXPO_IN'],['EXPO_OUT','Interpolation.EXPO_OUT'],['EXPO_IN_OUT','Interpolation.EXPO_IN_OUT'],
          ['CIRC_IN','Interpolation.CIRC_IN'],['CIRC_OUT','Interpolation.CIRC_OUT'],['CIRC_IN_OUT','Interpolation.CIRC_IN_OUT'],
          ['BACK_IN','Interpolation.BACK_IN'],['BACK_OUT','Interpolation.BACK_OUT'],['BACK_IN_OUT','Interpolation.BACK_IN_OUT'],
          ['ELASTIC_IN','Interpolation.ELASTIC_IN'],['ELASTIC_OUT','Interpolation.ELASTIC_OUT'],['ELASTIC_IN_OUT','Interpolation.ELASTIC_IN_OUT'],
          ['BOUNCE_IN','Interpolation.BOUNCE_IN'],['BOUNCE_OUT','Interpolation.BOUNCE_OUT'],['BOUNCE_IN_OUT','Interpolation.BOUNCE_IN_OUT']
        ]), 'BORDER_INTERP');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#64748b');
    }
  };

  // КАТСЦЕНЫ: камера — статическая
  Blockly.Blocks['camera_static'] = {
    init: function(){
      this.appendDummyInput().appendField('камера: статическая');
      this.appendDummyInput()
        .appendField('время (сек)')
        .appendField(new Blockly.FieldNumber(25, 1, 36000, 1), 'TIME');
      this.appendDummyInput()
        .appendField('позиция x')
        .appendField(new Blockly.FieldNumber(0), 'X')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(64), 'Y')
        .appendField('z')
        .appendField(new Blockly.FieldNumber(0), 'Z');
      this.appendDummyInput()
        .appendField('поворот yaw')
        .appendField(new Blockly.FieldNumber(0), 'YAW')
        .appendField('pitch')
        .appendField(new Blockly.FieldNumber(0), 'PITCH')
        .appendField('roll')
        .appendField(new Blockly.FieldNumber(0), 'ROLL');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#64748b');
    }
  };

  // КАТСЦЕНЫ: камера — статическое слежение за целью
  Blockly.Blocks['camera_entity'] = {
    init: function(){
      this.appendDummyInput().appendField('камера: слежение за целью');
      this.appendDummyInput()
        .appendField('время (сек)')
        .appendField(new Blockly.FieldNumber(25, 1, 36000, 1), 'TIME');
      this.appendDummyInput()
        .appendField('позиция x')
        .appendField(new Blockly.FieldNumber(0), 'X')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(64), 'Y')
        .appendField('z')
        .appendField(new Blockly.FieldNumber(0), 'Z');
      this.appendDummyInput()
        .appendField('цель')
        .appendField(new Blockly.FieldDropdown(() => getEntityOptions()), 'TARGET');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#64748b');
    }
  };

  // NPC: создание
  Blockly.Blocks['create_npc'] = {
    init: function(){
      this.appendDummyInput().appendField('создать НИП');
      this.appendDummyInput()
        .appendField('id')
        .appendField(new Blockly.FieldTextInput('npc', function(text){
          try {
            const field = this;
            const block = field && field.getSourceBlock ? field.getSourceBlock() : null;
            const oldVal = field && field.getValue ? field.getValue() : '';
            let v = String(text || 'npc').toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'');
            if(!v) v = 'npc';
            if(block){
              const ws = typeof workspace !== 'undefined' ? workspace : null;
              if(ws){
                const blocks = ws.getAllBlocks(false);
                const used = new Set(blocks
                  .filter(b => b && b.type === 'create_npc' && b !== block)
                  .map(b => (b.getFieldValue && b.getFieldValue('ID')) || '')
                  .filter(Boolean));
                if(used.has(v)){
                  let base = v, idx = 2;
                  while(used.has(`${base}_${idx}`)) idx++;
                  v = `${base}_${idx}`;
                  setTimeout(()=>{ try { updateNpcReferences(oldVal, v); } catch(_){} }, 0);
                } else if(oldVal && oldVal !== v){
                  setTimeout(()=>{ try { updateNpcReferences(oldVal, v); } catch(_){} }, 0);
                }
              }
            }
            return v;
          } catch(_) {
            return String(text || 'npc').toLowerCase().replace(/[^a-z0-9_]/g,'_') || 'npc';
          }
        }), 'ID');
      this.appendDummyInput()
        .appendField('имя')
        .appendField(new Blockly.FieldTextInput('НИП'), 'NAME');
      this.appendDummyInput()
        .appendField('модель')
        .appendField(new Blockly.FieldDropdown(()=>getModelOptions()), 'MODEL_ID');
      this.appendDummyInput()
        .appendField('позиция x')
        .appendField(new Blockly.FieldNumber(0), 'X')
        .appendField('y')
        .appendField(new Blockly.FieldNumber(64), 'Y')
        .appendField('z')
        .appendField(new Blockly.FieldNumber(0), 'Z');
      this.appendDummyInput()
        .appendField('показывать имя')
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'SHOW_NAME');
      this.appendDummyInput()
        .appendField('мир')
        .appendField(new Blockly.FieldTextInput('overworld'), 'WORLD');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#06b6d4');
      this.setTooltip('Создаёт НИПа, модель выбирается из списка моделей проекта');
    }
  };

  // Диалог (tellraw / showmessage)
  Blockly.Blocks['dialog_tellraw'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('диалог: источник')
        .appendField(new Blockly.FieldDropdown(() => getSpeakerOptions()), 'SOURCE');
      this.appendDummyInput()
        .appendField('тип')
        .appendField(new Blockly.FieldDropdown([["классический","CLASSIC"],["по центру","CENTER"]], (val)=>{
          const isCenter = val === 'CENTER';
          const headRow = this.getInput('HEAD_ROW');
          const timeRow = this.getInput('TIME_ROW');
          if(headRow) headRow.setVisible(isCenter);
          if(timeRow) timeRow.setVisible(isCenter);
          this.render();
          return val;
        }), 'TYPE');
      this.appendDummyInput()
        .appendField('текст')
        .appendField(new Blockly.FieldTextInput('Привет!'), 'TEXT');
      this.appendDummyInput('HEAD_ROW')
        .appendField('голова (heads/)')
        .appendField(new Blockly.FieldDropdown(() => getHeadOptions()), 'HEAD');
      this.appendDummyInput('TIME_ROW')
        .appendField('время (сек)')
        .appendField(new Blockly.FieldNumber(3, 1, 3600, 1), 'TIME');
      const headRow = this.getInput('HEAD_ROW');
      const timeRow = this.getInput('TIME_ROW');
      if(headRow) headRow.setVisible(false);
      if(timeRow) timeRow.setVisible(false);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#f59e0b');
      this.setTooltip('Диалог: классический (tellraw) или по центру (showmessage)');
    }
  };

  // Диалог: уведомление (execute { /notification <item> "<text>" <time> })
  Blockly.Blocks['dialog_notification'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('уведомление предмет')
        .appendField(new Blockly.FieldTextInput('minecraft:diamond'), 'ITEM');
      this.appendDummyInput()
        .appendField('текст')
        .appendField(new Blockly.FieldTextInput('Награда получена'), 'TEXT');
      this.appendDummyInput()
        .appendField('время (сек)')
        .appendField(new Blockly.FieldNumber(5, 0, 3600, 1), 'TIME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#f59e0b');
      this.setTooltip('Показывает уведомление: /notification <itemId> "<text>" <seconds>');
    }
  };

  // Механики: стамина — блоки
  Blockly.Blocks['stamina_off'] = {
    init: function(){
      this.appendDummyInput().appendField('выключить стамину');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#22c55e');
      this.setTooltip('execute { /stamina off @a }');
    }
  };
  Blockly.Blocks['stamina_on'] = {
    init: function(){
      this.appendDummyInput().appendField('включить стамину');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#22c55e');
      this.setTooltip('execute { /stamina on @a }');
    }
  };
  Blockly.Blocks['stamina_setmax'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('установить количество стамины')
        .appendField(new Blockly.FieldNumber(100, 0, 100000, 1), 'AMOUNT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#22c55e');
      this.setTooltip('execute { /stamina setmax @a <amount> }');
    }
  };
  Blockly.Blocks['stamina_add'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('добавить')
        .appendField(new Blockly.FieldNumber(10, 0, 100000, 1), 'AMOUNT')
        .appendField('стамины');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#22c55e');
      this.setTooltip('execute { /stamina add @a <amount> }');
    }
  };
  Blockly.Blocks['stamina_sub'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('убрать')
        .appendField(new Blockly.FieldNumber(5, 0, 100000, 1), 'AMOUNT')
        .appendField('стамины');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#22c55e');
      this.setTooltip('execute { /stamina sub @a <amount> }');
    }
  };
  Blockly.Blocks['stamina_setregen'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('установить регенерацию стамины в секунду на')
        .appendField(new Blockly.FieldNumber(12.5, 0, 100000, 0.1), 'AMOUNT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#22c55e');
      this.setTooltip('execute { /stamina setregen @a <amount> }');
    }
  };

  // Генерация Kotlin
  Blockly.Kotlin = Blockly.Kotlin || {};

  // триггеры -> аннотации файла
  Blockly.Kotlin['trigger_entry_point'] = function(){
    return '@file:EntryPoint\n';
  };
  Blockly.Kotlin['trigger_join_script'] = function(){
    return '@file:JoinScript\n';
  };
  Blockly.Kotlin['trigger_after_script'] = function(block){
    const path = block.getFieldValue('PATH') || '';
    const esc = path.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    return `@file:AfterScript("${esc}")\n`;
  };
  Blockly.Kotlin['trigger_repeatable_script'] = function(){
    return '@file:RepeatableScript\n';
  };

  // управление
  Blockly.Kotlin['wait_seconds'] = function(block){
    const secs = Number(block.getFieldValue('SECS') || 0);
    return `wait { ${secs}.sec }\n`;
  };

  // КАТСЦЕНЫ — генерация Kotlin
  Blockly.Kotlin['camera_spline'] = function(block){
    const time = Number(block.getFieldValue('TIME')||60);
    const file = (block.getFieldValue('FILE')||'prologue.nbt.nbt').trim();
    const interp = block.getFieldValue('INTERP')||'Interpolation.QUAD_IN_OUT';
    const borders = (block.getFieldValue('BORDERS')||'FALSE') === 'TRUE';
    const bInterp = block.getFieldValue('BORDER_INTERP')||'Interpolation.QUAD_OUT';
    const esc = file.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    return `camera {\n  spline(${time}.sec, "${esc}", ${interp}, ${borders}, ${bInterp})\n}\n`;
  };
  Blockly.Kotlin['camera_static'] = function(block){
    const time = Number(block.getFieldValue('TIME')||25);
    const x = Number(block.getFieldValue('X')||0);
    const y = Number(block.getFieldValue('Y')||64);
    const z = Number(block.getFieldValue('Z')||0);
    const yaw = Number(block.getFieldValue('YAW')||0);
    const pitch = Number(block.getFieldValue('PITCH')||0);
    const roll = Number(block.getFieldValue('ROLL')||0);
    return `camera {\n  static(${time}.sec, pos(${x}, ${y}, ${z}), pos(${yaw}, ${pitch}, ${roll}))\n}\n`;
  };
  Blockly.Kotlin['camera_entity'] = function(block){
    const time = Number(block.getFieldValue('TIME')||25);
    const x = Number(block.getFieldValue('X')||0);
    const y = Number(block.getFieldValue('Y')||64);
    const z = Number(block.getFieldValue('Z')||0);
    const target = block.getFieldValue('TARGET')||'__PLAYER_FIRST__';
    const tgt = target === '__PLAYER_FIRST__' ? 'player().first()' : target; // NPC id уже валиден
    return `camera {\n  entity(${time}.sec, pos(${x}, ${y}, ${z}), ${tgt})\n}\n`;
  };

  // npc
  Blockly.Kotlin['create_npc'] = function(block){
    let id = (block.getFieldValue('ID') || 'npc').toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'');
    if(!id) id = 'npc';
    // гарантируем уникальность id на этапе генерации
    try{
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      if(ws){
        const blocks = ws.getAllBlocks(false);
        const used = new Set(blocks
          .filter(b => b && b.type === 'create_npc' && b !== block)
          .map(b => (b.getFieldValue && b.getFieldValue('ID')) || '')
          .map(s => String(s).toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,''))
          .filter(Boolean));
        if(used.has(id)){
          let base = id, idx = 2;
          while(used.has(`${base}_${idx}`)) idx++;
          id = `${base}_${idx}`;
        }
      }
    }catch(_){ }
    const name = block.getFieldValue('NAME') || 'НИП';
    const modelId = block.getFieldValue('MODEL_ID');
    const model = AutoHE.getModel(projectId, modelId);
    const modid = 'autohe';
    const modelFile = model ? `${sanitizeLettersLower(model.name||'model')}.${sanitizeLettersLowerExt(model.ext||'glb')}` : '';
    const modelPath = model ? `${modid}:models/${modelFile}` : '';
    const x = Number(block.getFieldValue('X') || 0);
    const y = Number(block.getFieldValue('Y') || 64);
    const z = Number(block.getFieldValue('Z') || 0);
    const showName = block.getFieldValue('SHOW_NAME') === 'TRUE';
    const world = block.getFieldValue('WORLD') || 'overworld';
    const escName = name.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    const escModel = modelPath.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    const escWorld = String(world).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    return `val ${id} by NPCEntity.creating {\n  name = "${escName}"\n  model = "${escModel}"\n  pos = pos(${x}, ${y}, ${z})\n  showName = ${showName}\n  world = "${escWorld}"\n}\n`;
  };

  // диалог
  Blockly.Kotlin['dialog_tellraw'] = function(block){
    const source = block.getFieldValue('SOURCE');
    const text = block.getFieldValue('TEXT') || '';
    const type = block.getFieldValue('TYPE') || 'CLASSIC';
    const escText = text.replace(/\\/g,'\\\\').replace(/"/g,'\\\"');
    
    if(type === 'CENTER'){
      // Генерируем /showmessage команду
      const head = block.getFieldValue('HEAD') || 'default.png';
      const time = Number(block.getFieldValue('TIME') || 3);
      const headEsc = String(head).replace(/\\/g,'\\\\').replace(/"/g,'\\\"');
      const color = (project && project.settings && project.settings.dialogNameColor) ? project.settings.dialogNameColor : '#66CDAA';
      const colorEsc = String(color).replace(/\\/g,'\\\\').replace(/"/g,'\\\"');
      
      if(source === '__PLAYER_FIRST__'){
        return `execute{"/showmessage @a \\"${headEsc}\\" [" + nameCompPlayerBy(player().first().name.string, "${colorEsc}") + ", {\\\"text\\\":\\\"${escText}\\\",\\\"color\\\":\\\"white\\\"}] | ${time}" }` + "\n";
      } else {
        const npcName = getNpcNameById(source) || source;
        const npcNameEsc = String(npcName).replace(/\\/g,'\\\\').replace(/"/g,'\\\"');
        return `execute{"/showmessage @a \\"${headEsc}\\" [" + nameCompNpc("${npcNameEsc}", "${colorEsc}") + ", {\\\"text\\\":\\\"${escText}\\\",\\\"color\\\":\\\"white\\\"}] | ${time}" }` + "\n";
      }
    } else {
      // Классический tellraw
      const color = (project && project.settings && project.settings.dialogNameColor) ? project.settings.dialogNameColor : '#66CDAA';
      const colorEsc = String(color).replace(/\\/g,'\\\\').replace(/"/g,'\\\"');
      if(source === '__PLAYER_FIRST__'){
        return `execute{"tellraw @a [\\"\\", " + nameCompPlayerBy(player().first().name.string, \"${colorEsc}\") + ", {\\\"text\\\":\\\"${escText}\\",\\\"color\\\":\\\"white\\\"}]" }` + "\n";
      } else {
        const npcName = getNpcNameById(source) || source;
        const npcNameEsc = String(npcName).replace(/\\/g,'\\\\').replace(/"/g,'\\\"');
        return `execute{"tellraw @a [\\"\\", " + nameCompNpc(\"${npcNameEsc}\", \"${colorEsc}\") + ", {\\\"text\\\":\\\"${escText}\\",\\\"color\\\":\\\"white\\\"}]" }` + "\n";
      }
    }
  };

  Blockly.Kotlin['dialog_notification'] = function(block){
    const item = (block.getFieldValue('ITEM')||'minecraft:diamond').trim();
    const textRaw = block.getFieldValue('TEXT') || '';
    const secs = Number(block.getFieldValue('TIME')||5);
    const itemEsc = item.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    const textEsc = textRaw.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    return `execute{"/notification @a ${itemEsc} \\\"${textEsc}\\\" ${secs}"}` + "\n";
  };

  // Механики: стамина — генерация Kotlin
  Blockly.Kotlin['stamina_off'] = function(){
    return 'execute{"/stamina off @a"}' + "\n";
  };
  Blockly.Kotlin['stamina_on'] = function(){
    return 'execute{"/stamina on @a"}' + "\n";
  };
  Blockly.Kotlin['stamina_setmax'] = function(block){
    const amount = Number(block.getFieldValue('AMOUNT')||0);
    return `execute{"/stamina setmax @a ${amount}"}` + "\n";
  };
  Blockly.Kotlin['stamina_add'] = function(block){
    const amount = Number(block.getFieldValue('AMOUNT')||0);
    return `execute{"/stamina add @a ${amount}"}` + "\n";
  };
  Blockly.Kotlin['stamina_sub'] = function(block){
    const amount = Number(block.getFieldValue('AMOUNT')||0);
    return `execute{"/stamina sub @a ${amount}"}` + "\n";
  };
  Blockly.Kotlin['stamina_setregen'] = function(block){
    const amount = Number(block.getFieldValue('AMOUNT')||0);
    return `execute{"/stamina setregen @a ${amount}"}` + "\n";
  };

  // Квесты — генерация Kotlin
  Blockly.Kotlin['quest_add'] = function(block){
    const qname = (block.getFieldValue('QNAME')||'').trim();
    const author = (block.getFieldValue('AUTHOR')||'').trim();
    const notify = (block.getFieldValue('NOTIFY')||'FALSE') === 'TRUE';
    const id = getQuestIdFromName(qname);
    const nameEsc = qname.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    const authorEsc = author.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    const flag = notify ? 'true' : 'false';
    return `execute{"/quest add @a ${id} \\\"${nameEsc}\\\" \\\"${authorEsc}\\\" ${flag}"}` + "\n";
  };
  Blockly.Kotlin['quest_remove'] = function(block){
    const qname = block.getFieldValue('QNAME');
    if(qname === '__NO_QUEST__') return `// Квест не выбран\n`;
    const notify = (block.getFieldValue('NOTIFY')||'FALSE') === 'TRUE';
    const id = getQuestIdFromName(qname);
    const flag = notify ? 'true' : 'false';
    return `execute{"/quest remove @a ${id} ${flag}"}` + "\n";
  };
  Blockly.Kotlin['quest_set_status'] = function(block){
    const qname = block.getFieldValue('QNAME');
    if(qname === '__NO_QUEST__') return `// Квест не выбран\n`;
    const status = block.getFieldValue('STATUS') || 'COMPLETE';
    const notify = (block.getFieldValue('NOTIFY')||'FALSE') === 'TRUE';
    const id = getQuestIdFromName(qname);
    const cmd = status === 'FAIL' ? 'fail' : 'complete';
    const flag = notify ? 'true' : 'false';
    return `execute{"/quest ${cmd} @a ${id} ${flag}"}` + "\n";
  };

  Blockly.Kotlin['quest_append'] = function(block){
    const qname = block.getFieldValue('QNAME');
    if(qname === '__NO_QUEST__') return `// Квест не выбран\n`;
    const notify = (block.getFieldValue('NOTIFY')||'FALSE') === 'TRUE';
    const id = getQuestIdFromName(qname);
    const raw = block.getFieldValue('QTEXT') || '';
    // Экранируем: \\ -> \\\\ ; \" -> \\\\\" ; переводы строк -> \\n
    const textEsc = String(raw).replace(/\\/g,'\\\\').replace(/\"/g,'\\\"').replace(/\n/g,'\\n');
    const flag = notify ? 'true' : 'false';
    return `execute{"/quest append @a ${id} \\\"${textEsc}\\\" ${flag}"}` + "\n";
  };

  Blockly.Kotlin['quest_goal'] = function(block){
    const qname = block.getFieldValue('QNAME');
    if(qname === '__NO_QUEST__') return `// Квест не выбран\n`;
    const goalName = (block.getFieldValue('GOAL_NAME')||'').trim();
    const notify = (block.getFieldValue('NOTIFY')||'FALSE') === 'TRUE';
    const x = Number(block.getFieldValue('X')||0);
    const y = Number(block.getFieldValue('Y')||64);
    const z = Number(block.getFieldValue('Z')||0);
    const radius = Number(block.getFieldValue('RADIUS')||3);
    
    const questId = getQuestIdFromName(qname);
    const goalNameEsc = goalName.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    const flag = notify ? 'true' : 'false';
    
    // Основная команда создания цели
    let result = `execute{"/quest goal @a ${questId} \\\"${goalNameEsc}\\\" ${flag}"}` + "\n";
    
    return result;
  };

  

  // Категория Kotlin — общие блоки языка
  toolbox.contents.splice(4, 0, { kind: 'category', name: 'Котлин', categorystyle: 'actions_category', contents: [
    { kind: 'block', type: 'kotlin_val' },
    { kind: 'block', type: 'kotlin_var' },
    { kind: 'block', type: 'kotlin_assign' },
    { kind: 'block', type: 'kotlin_if' },
    { kind: 'block', type: 'kotlin_while' },
    { kind: 'block', type: 'kotlin_for_range' },
    { kind: 'block', type: 'kotlin_fun_def' },
    { kind: 'block', type: 'kotlin_fun_call' },
    { kind: 'block', type: 'kotlin_comment' },
    { kind: 'block', type: 'kotlin_start_script' }
  ]});

  // Утилита для сбора кода из вложенных statement-инпутов
  function collectStatementInput(block, input){
    let code = '';
    const first = block.getInputTargetBlock(input);
    let cur = first;
    while(cur){
      code += emitBlock(cur);
      cur = cur.getNextBlock();
    }
    return code;
  }

  // Добавляем Kotlin-выражения
  toolbox.contents.splice(1, 0, { kind: 'category', name: 'Выражения', categorystyle: 'logic_category', contents: [
    { kind: 'block', type: 'kt_number' },
    { kind: 'block', type: 'kt_string' },
    { kind: 'block', type: 'kt_bool' },
    { kind: 'block', type: 'kt_variable_ref' },
    { kind: 'block', type: 'kt_binary' },
    { kind: 'block', type: 'kt_fun_call_expr' }
  ]});

  // Категория Механики
  toolbox.contents.push({
    kind: 'category',
    name: 'Механики',
    categorystyle: 'control_category',
    contents: [
      { kind: 'block', type: 'stamina_off' },
      { kind: 'block', type: 'stamina_on' },
      { kind: 'block', type: 'stamina_setmax' },
      { kind: 'block', type: 'stamina_add' },
      { kind: 'block', type: 'stamina_sub' },
      { kind: 'block', type: 'stamina_setregen' },
      { kind: 'block', type: 'dialog_notification' },
      { kind: 'block', type: 'quest_add' },
      { kind: 'block', type: 'quest_remove' },
      { kind: 'block', type: 'quest_set_status' },
      { kind: 'block', type: 'quest_append' },
      { kind: 'block', type: 'quest_goal' }
    ]
  });

  function valueToCode(block, name){
    const target = block.getInputTargetBlock(name);
    if(!target) return '';
    return emitExpr(target);
  }

  // Выражения (генерация отдельно от statement)
  function emitExpr(block){
    switch(block.type){
      case 'kt_number': return String(block.getFieldValue('NUM')||'0');
      case 'kt_string': {
        const t = block.getFieldValue('TXT')||'';
        const esc = t.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
        return `"${esc}"`;
      }
      case 'kt_bool': return block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false';
      case 'kt_variable_ref': return block.getFieldValue('NAME')||'x';
      case 'kt_binary': {
        const a = valueToCode(block, 'A')||'0';
        const op = block.getFieldValue('OP')||'+';
        const b = valueToCode(block, 'B')||'0';
        return `(${a} ${op} ${b})`;
      }
      case 'kt_fun_call_expr': {
        const call = block.getFieldValue('CALL')||'fn()';
        return call;
      }
      default: return '';
    }
  }

  // Определения блоков выражений
  Blockly.Blocks['kt_number'] = {
    init: function(){
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0, -1e9, 1e9, 1), 'NUM');
      this.setOutput(true, null);
      this.setColour('#9333ea');
    }
  };
  Blockly.Blocks['kt_string'] = {
    init: function(){
      this.appendDummyInput().appendField('"').appendField(new Blockly.FieldTextInput('text'), 'TXT').appendField('"');
      this.setOutput(true, null);
      this.setColour('#9333ea');
    }
  };
  Blockly.Blocks['kt_bool'] = {
    init: function(){
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([["true","TRUE"],["false","FALSE"]]), 'BOOL');
      this.setOutput(true, null);
      this.setColour('#9333ea');
    }
  };
  Blockly.Blocks['kt_variable_ref'] = {
    init: function(){
      this.appendDummyInput().appendField('var').appendField(new Blockly.FieldTextInput('x'), 'NAME');
      this.setOutput(true, null);
      this.setColour('#9333ea');
    }
  };
  Blockly.Blocks['kt_binary'] = {
    init: function(){
      this.appendValueInput('A').setCheck(null);
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([["+","+"],["-","-"],["*","*"],["/","/"]]), 'OP');
      this.appendValueInput('B').setCheck(null);
      this.setOutput(true, null);
      this.setColour('#9333ea');
    }
  };
  Blockly.Blocks['kt_fun_call_expr'] = {
    init: function(){
      this.appendDummyInput().appendField('вызов').appendField(new Blockly.FieldTextInput('fn()'), 'CALL');
      this.setOutput(true, null);
      this.setColour('#9333ea');
    }
  };

  Blockly.Blocks['kotlin_val'] = {
    init: function(){
      this.appendDummyInput().appendField('константа (val)').appendField(new Blockly.FieldTextInput('name'), 'NAME').appendField('=');
      this.appendValueInput('VALUE').setCheck(null);
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Создаёт константу: val имя = значение');
    }
  };
  Blockly.Kotlin['kotlin_val'] = function(block){
    const n = block.getFieldValue('NAME')||'value';
    const v = valueToCode(block, 'VALUE') || '0';
    return `val ${n} = ${v}\n`;
  };

  Blockly.Blocks['kotlin_var'] = {
    init: function(){
      this.appendDummyInput().appendField('переменная (var)').appendField(new Blockly.FieldTextInput('name'), 'NAME').appendField('=');
      this.appendValueInput('VALUE').setCheck(null);
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Создаёт изменяемую переменную: var имя = значение');
    }
  };
  Blockly.Kotlin['kotlin_var'] = function(block){
    const n = block.getFieldValue('NAME')||'value';
    const v = valueToCode(block, 'VALUE') || '0';
    return `var ${n} = ${v}\n`;
  };

  Blockly.Blocks['kotlin_assign'] = {
    init: function(){
      this.appendDummyInput().appendField('присвоить').appendField(new Blockly.FieldTextInput('name'), 'NAME').appendField('=');
      this.appendValueInput('VALUE').setCheck(null);
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Присваивает значение переменной: имя = выражение');
    }
  };
  Blockly.Kotlin['kotlin_assign'] = function(block){
    const n = block.getFieldValue('NAME')||'name';
    const v = valueToCode(block, 'VALUE') || '0';
    return `${n} = ${v}\n`;
  };

  Blockly.Blocks['kotlin_if'] = {
    init: function(){
      this.appendDummyInput().appendField('если (условие)')
        .appendField(new Blockly.FieldTextInput('true'), 'COND');
      this.appendStatementInput('DO').setCheck(null).appendField('то');
      this.appendStatementInput('ELSE').setCheck(null).appendField('иначе');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Условная конструкция: if (условие) { ... } else { ... }');
    }
  };
  Blockly.Kotlin['kotlin_if'] = function(block){
    const c = block.getFieldValue('COND')||'true';
    const doCode = collectStatementInput(block, 'DO');
    const elseCode = collectStatementInput(block, 'ELSE');
    let code = `if (${c}) {\n${doCode}}\n`;
    if(elseCode && elseCode.trim()) code += `else {\n${elseCode}}\n`;
    return code;
  };

  Blockly.Blocks['kotlin_while'] = {
    init: function(){
      this.appendDummyInput().appendField('пока (условие)')
        .appendField(new Blockly.FieldTextInput('true'), 'COND');
      this.appendStatementInput('DO').setCheck(null).appendField('делать');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Цикл while: пока (условие) { ... }');
    }
  };
  Blockly.Kotlin['kotlin_while'] = function(block){
    const c = block.getFieldValue('COND')||'true';
    const body = collectStatementInput(block, 'DO');
    return `while (${c}) {\n${body}}\n`;
  };

  Blockly.Blocks['kotlin_for_range'] = {
    init: function(){
      this.appendDummyInput().appendField('для i от')
        .appendField(new Blockly.FieldTextInput('0'), 'FROM')
        .appendField('до')
        .appendField(new Blockly.FieldTextInput('10'), 'TO');
      this.appendStatementInput('DO').setCheck(null).appendField('делать');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Цикл по диапазону: for (i in от..до) { ... }');
    }
  };
  Blockly.Kotlin['kotlin_for_range'] = function(block){
    const from = block.getFieldValue('FROM')||'0';
    const to = block.getFieldValue('TO')||'10';
    const body = collectStatementInput(block, 'DO');
    return `for (i in ${from}..${to}) {\n${body}}\n`;
  };

  Blockly.Blocks['kotlin_fun_def'] = {
    init: function(){
      this.appendDummyInput().appendField('функция')
        .appendField(new Blockly.FieldTextInput('doStuff'), 'NAME')
        .appendField('(')
        .appendField(new Blockly.FieldTextInput(''), 'PARAMS')
        .appendField(')');
      this.appendStatementInput('BODY').setCheck(null).appendField('тело');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Определяет функцию: fun имя(параметры) { тело }');
    }
  };
  Blockly.Kotlin['kotlin_fun_def'] = function(block){
    const name = block.getFieldValue('NAME')||'doStuff';
    const params = block.getFieldValue('PARAMS')||'';
    const body = collectStatementInput(block, 'BODY');
    return `fun ${name}(${params}) {\n${body}}\n`;
  };

  Blockly.Blocks['kotlin_fun_call'] = {
    init: function(){
      this.appendDummyInput().appendField('вызвать функцию')
        .appendField(new Blockly.FieldTextInput('doStuff()'), 'CALL');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Вызывает функцию: имя(аргументы)');
    }
  };
  Blockly.Kotlin['kotlin_fun_call'] = function(block){
    const call = block.getFieldValue('CALL')||'doStuff()';
    return `${call}\n`;
  };

  Blockly.Blocks['kotlin_comment'] = {
    init: function(){
      this.appendDummyInput().appendField('комментарий')
        .appendField(new Blockly.FieldTextInput('комментарий'), 'TEXT');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#64748b');
      this.setTooltip('Добавляет комментарий в код: // текст');
    }
  };
  Blockly.Kotlin['kotlin_comment'] = function(block){
    const t = block.getFieldValue('TEXT')||'';
    return `// ${t}\n`;
  };

  // HE: запуск другого скрипта
  Blockly.Blocks['kotlin_start_script'] = {
    init: function(){
      this.appendDummyInput().appendField('запустить скрипт')
        .appendField(new Blockly.FieldDropdown(() => {
          try{
            const prj = AutoHE.getProject(projectId) || { scripts: [] };
            const opts = (prj.scripts||[]).map(s => {
              const label = s.name + typeExt(s.type);
              const path = `scripts/${s.name}${typeExt(s.type)}`;
              return [label, path];
            });
            return opts.length ? opts : [["нет скриптов","scripts/main.se.kts"]];
          }catch(_){ return [["нет скриптов","scripts/main.se.kts"]]; }
        }), 'PATH');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#22c55e');
      this.setTooltip('Запускает другой скрипт: startScript { "путь" }');
    }
  };
  Blockly.Kotlin['kotlin_start_script'] = function(block){
    const p = block.getFieldValue('PATH')||'';
    const esc = p.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    return `startScript { \"${esc}\" }\n`;
  };

  // Вспомогательные утилиты для динамических списков
  function safeArray(v){ return Array.isArray(v) ? v : []; }
  function sanitizeModId(name){ return String(name||'autohe').toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,'') || 'autohe'; }
  function sanitizeLettersLower(name){
    const s = String(name||'model').toLowerCase().replace(/[^a-z]/g,'');
    return s || 'model';
  }
  function sanitizeLettersLowerExt(ext){
    const s = String(ext||'glb').toLowerCase().replace(/[^a-z]/g,'');
    return s || 'glb';
  }
  // Получить NPC, объявленных в импортированных скриптах (@file:Import)
  function getImportedNpcIds(){
    try {
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      const blocks = ws ? ws.getAllBlocks(false) : [];
      const importBlocks = safeArray(blocks).filter(b => b && b.type === 'kotlin_import_script');
      if(!importBlocks.length) return [];
      const prj = AutoHE.getProject(projectId);
      const scripts = prj && Array.isArray(prj.scripts) ? prj.scripts : [];
      const byId = new Map(scripts.map(s => [s.id, s]));
      const ids = new Set();
      importBlocks.forEach(b => {
        try {
          const sid = b.getFieldValue && b.getFieldValue('SCRIPT_ID');
          if(!sid || !byId.has(sid)) return;
          const s = byId.get(sid);
          const kotlin = String(s.kotlin||'');
          const re = /\bval\s+([A-Za-z_][A-Za-z0-9_]*)\s+by\s+NPCEntity\.creating\b/g;
          let m; while((m = re.exec(kotlin))){ ids.add(m[1]); }
        } catch(_) {}
      });
      return Array.from(ids);
    } catch(_) { return []; }
  }
  function getNpcIdOptions() {
    try {
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      const blocks = ws ? ws.getAllBlocks(false) : [];
      const npcIdsFromCreate = safeArray(blocks)
        .filter(b => b && b.type === 'create_npc')
        .map(b => (b.getFieldValue && b.getFieldValue('ID')) || 'npc')
        .filter(Boolean);
      // Собираем все текущие значения полей 'NPC' из любых блоков, чтобы не падать на восстановлении
      const npcIdsFromFields = safeArray(blocks)
        .map(b => (b && b.getFieldValue ? b.getFieldValue('NPC') : null))
        .filter(Boolean);
      const imported = getImportedNpcIds();
      const unique = Array.from(new Set([...npcIdsFromCreate, ...npcIdsFromFields, ...imported]))
        .map(id => String(id).toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/^_+|_+$/g,''))
        .filter(Boolean);
      const opts = unique.map(id => [`НИП: ${id}`, id]);
      return opts.length ? opts : [["НИП не создан", "__NO_NPC__"]];
    } catch (e) {
      return [["НИП не создан", "__NO_NPC__"]];
    }
  }
  function getSpeakerOptions() {
    const npcOpts = getNpcIdOptions().filter(o => o[1] !== "__NO_NPC__");
    return [["Игрок (первый)", "__PLAYER_FIRST__"], ...npcOpts];
  }
  function getEntityOptions(){
    const npcOpts = getNpcIdOptions().filter(o => o[1] !== "__NO_NPC__");
    return [["Игрок (первый)", "__PLAYER_FIRST__"], ...npcOpts];
  }

  // Обновление ссылок на НИПа при переименовании ID
  function updateNpcReferences(oldId, newId){
    try {
      if(!oldId || !newId || oldId === newId) return;
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      if(!ws) return;
      const blocks = ws.getAllBlocks(false);
      blocks.forEach(b => {
        if(b && typeof b.getFieldValue === 'function' && typeof b.setFieldValue === 'function'){
          const hasNpc = b.inputList && b.inputList.some(inp => inp.fieldRow && inp.fieldRow.some(f => f && f.name === 'NPC'));
          if(hasNpc){
            const cur = b.getFieldValue('NPC');
            if(cur === oldId){
              try { b.setFieldValue(newId, 'NPC'); } catch(_){ }
            }
          }
        }
      });
    } catch(_){ }
  }
  // Простейший модальный редактор многострочного текста
  function openMultilineEditor(block, fieldName, title){
    try {
      const cur = (block.getFieldValue(fieldName)||'').toString();
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      const dlg = document.createElement('div');
      dlg.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,0.2);width:640px;max-width:90vw;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;';
      const hdr = document.createElement('div');
      hdr.textContent = title || 'Редактор текста';
      hdr.style.cssText = 'padding:12px 16px;border-bottom:1px solid rgba(148,163,184,0.2);font-weight:600;';
      const ta = document.createElement('textarea');
      ta.value = cur;
      ta.style.cssText = 'min-height:200px;resize:vertical;background:#0b1220;color:#e2e8f0;border:none;outline:none;padding:12px 16px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:13px;';
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid rgba(148,163,184,0.2);';
      const cancel = document.createElement('button');
      cancel.textContent = 'Отмена';
      cancel.style.cssText = 'background:#1f2937;color:#e5e7eb;border:1px solid #374151;border-radius:6px;padding:6px 12px;cursor:pointer;';
      const ok = document.createElement('button');
      ok.textContent = 'Сохранить';
      ok.style.cssText = 'background:#2563eb;color:white;border:1px solid #1d4ed8;border-radius:6px;padding:6px 12px;cursor:pointer;';
      cancel.onclick = () => document.body.removeChild(overlay);
      ok.onclick = () => { try { block.setFieldValue(ta.value, fieldName); } catch(_){} document.body.removeChild(overlay); };
      btns.appendChild(cancel); btns.appendChild(ok);
      dlg.appendChild(hdr); dlg.appendChild(ta); dlg.appendChild(btns);
      overlay.appendChild(dlg);
      document.body.appendChild(overlay);
      setTimeout(()=>{ try { ta.focus(); ta.selectionStart = ta.value.length; ta.selectionEnd = ta.value.length; } catch(_){} }, 0);
    } catch(_){}
  }
  function getQuestIdFromName(name){
    const str = String(name||'quest');
    // Транслитерация русских букв в английские
    const translit = str
      .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v').replace(/г/g, 'g')
      .replace(/д/g, 'd').replace(/е/g, 'e').replace(/ё/g, 'yo').replace(/ж/g, 'zh')
      .replace(/з/g, 'z').replace(/и/g, 'i').replace(/й/g, 'y').replace(/к/g, 'k')
      .replace(/л/g, 'l').replace(/м/g, 'm').replace(/н/g, 'n').replace(/о/g, 'o')
      .replace(/п/g, 'p').replace(/р/g, 'r').replace(/с/g, 's').replace(/т/g, 't')
      .replace(/у/g, 'u').replace(/ф/g, 'f').replace(/х/g, 'h').replace(/ц/g, 'ts')
      .replace(/ч/g, 'ch').replace(/ш/g, 'sh').replace(/щ/g, 'sch').replace(/ъ/g, '')
      .replace(/ы/g, 'y').replace(/ь/g, '').replace(/э/g, 'e').replace(/ю/g, 'yu')
      .replace(/я/g, 'ya')
      .replace(/А/g, 'A').replace(/Б/g, 'B').replace(/В/g, 'V').replace(/Г/g, 'G')
      .replace(/Д/g, 'D').replace(/Е/g, 'E').replace(/Ё/g, 'Yo').replace(/Ж/g, 'Zh')
      .replace(/З/g, 'Z').replace(/И/g, 'I').replace(/Й/g, 'Y').replace(/К/g, 'K')
      .replace(/Л/g, 'L').replace(/М/g, 'M').replace(/Н/g, 'N').replace(/О/g, 'O')
      .replace(/П/g, 'P').replace(/Р/g, 'R').replace(/С/g, 'S').replace(/Т/g, 'T')
      .replace(/У/g, 'U').replace(/Ф/g, 'F').replace(/Х/g, 'H').replace(/Ц/g, 'Ts')
      .replace(/Ч/g, 'Ch').replace(/Ш/g, 'Sh').replace(/Щ/g, 'Sch').replace(/Ъ/g, '')
      .replace(/Ы/g, 'Y').replace(/Ь/g, '').replace(/Э/g, 'E').replace(/Ю/g, 'Yu')
      .replace(/Я/g, 'Ya');
    
    return sanitizeLettersLower(translit) || 'quest';
  }
  function getQuestNameOptions(){
    try {
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      const blocks = ws ? ws.getAllBlocks(false) : [];
      const names = safeArray(blocks)
        .filter(b => b && b.type === 'quest_add')
        .map(b => (b.getFieldValue && b.getFieldValue('QNAME')) || '')
        .map(s => String(s).trim())
        .filter(Boolean);
      const uniq = Array.from(new Set(names));
      const opts = uniq.map(n => [n, n]);
      return opts.length ? opts : [["Квест не создан", "__NO_QUEST__"]];
    } catch(_) {
      return [["Квест не создан", "__NO_QUEST__"]];
    }
  }
  function generateGoalScriptId(questName, goalName){
    const qid = getQuestIdFromName(questName);
    const gid = sanitizeLettersLower(String(goalName||'goal'));
    return `${qid}_goal_${gid}`;
  }
  function generateQuestCheckerScriptId(questName){
    const qid = getQuestIdFromName(questName);
    return `${qid}_checker`;
  }

  function getQuestGoalOptions(){
    try {
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      const blocks = ws ? ws.getAllBlocks(false) : [];
      const pairs = safeArray(blocks)
        .filter(b => b && b.type === 'quest_goal')
        .map(b => {
          const q = (b.getFieldValue && b.getFieldValue('QNAME')) || '';
          const g = (b.getFieldValue && b.getFieldValue('GOAL_NAME')) || '';
          return { q: String(q).trim(), g: String(g).trim() };
        })
        .filter(p => p.q && p.g);
      const uniqKey = new Set();
      const opts = [];
      pairs.forEach(p => {
        const key = p.q + '||' + p.g;
        if(!uniqKey.has(key)){
          uniqKey.add(key);
          opts.push([`${p.q} — ${p.g}`, key]);
        }
      });
      return opts.length ? opts : [["Цель не создана", "__NO_GOAL__"]];
    } catch(_) {
      return [["Цель не создана", "__NO_GOAL__"]];
    }
  }

  // Возвращает отображаемое имя НИПа по его id из блоков create_npc
  function getNpcNameById(npcId){
    try {
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      const blocks = ws ? ws.getAllBlocks(false) : [];
      for(const b of safeArray(blocks)){
        if(b && b.type === 'create_npc'){
          const id = (b.getFieldValue && b.getFieldValue('ID')) || '';
          if(id === npcId){
            return (b.getFieldValue && b.getFieldValue('NAME')) || npcId;
          }
        }
      }
      return npcId;
    } catch(_) { return npcId; }
  }

  // Возвращает MODEL_ID, выбранный в блоке create_npc для данного НИПа
  function getNpcModelIdById(npcId){
    try {
      const ws = typeof workspace !== 'undefined' ? workspace : null;
      const blocks = ws ? ws.getAllBlocks(false) : [];
      for(const b of safeArray(blocks)){
        if(b && b.type === 'create_npc'){
          const id = (b.getFieldValue && b.getFieldValue('ID')) || '';
          if(id === npcId){
            return (b.getFieldValue && b.getFieldValue('MODEL_ID')) || '';
          }
        }
      }
      return '';
    } catch(_) { return ''; }
  }

  // Heads options from project resources
  function getHeadOptions(){
    try {
      const prj = AutoHE.getProject(projectId);
      const res = prj && prj.resources ? prj.resources : { heads: [] };
      const heads = Array.isArray(res.heads) ? res.heads : [];
      const opts = heads.map(h => [h.name + '.png', (h.name + '.png').toLowerCase()]);
      return opts.length ? opts : [["zombie.png", "zombie.png"]];
    } catch(_) { return [["zombie.png", "zombie.png"]]; }
  }

  // Dropdown анимаций для модели выбранного НИПа
  function animDropdownFromNpcModel(block){
    return function(){
      const npcId = block.getFieldValue('NPC');
      const modelId = npcId && npcId !== '__NO_NPC__' ? getNpcModelIdById(npcId) : '';
      const type = block.getFieldValue('TYPE');
      // Список проигранных ранее анимаций для НИПа
      function getPlayedAnimationsForNpc(npc){
        try {
          const ws = typeof workspace !== 'undefined' ? workspace : null;
          const blocks = ws ? ws.getAllBlocks(false) : [];
          const played = new Set();
          for(const b of safeArray(blocks)){
            if(!b) continue;
            // Универсальный блок анимации
            if(b.type === 'npc_animation'){
              const who = (b.getFieldValue && b.getFieldValue('NPC')) || '';
              const kind = (b.getFieldValue && b.getFieldValue('TYPE')) || '';
              const anim = (b.getFieldValue && b.getFieldValue('ANIM')) || '';
              if(who === npcId && anim && anim !== '__NO_ANIM__' && kind !== 'STOP') played.add(anim);
            }
            // На случай, если старые блоки присутствуют
            if(b.type === 'npc_play_once' || b.type === 'npc_play_looped' || b.type === 'npc_play_freeze'){
              const who = (b.getFieldValue && b.getFieldValue('NPC')) || '';
              const anim = (b.getFieldValue && b.getFieldValue('ANIM')) || '';
              if(who === npcId && anim && anim !== '__NO_ANIM__') played.add(anim);
            }
          }
          return Array.from(played);
        } catch(_) { return []; }
      }
      if(type === 'STOP'){
        const played = getPlayedAnimationsForNpc(npcId);
        const opts = played.map(a => [a, a]);
        return opts.length ? opts : [['нет доступных', '__NO_ANIM__']];
      }
      const anims = modelId ? getModelAnimations(modelId) : [];
      const options = (anims||[]).map(a => [a, a]);
      return options.length ? options : [[ 'нет анимаций', '__NO_ANIM__' ]];
    };
  }

  // Хелперы моделей проекта (должны быть объявлены ДО определения блоков)
  function getProjectModels(){ try { return (AutoHE.getModels(projectId) || []); } catch(_) { return []; } }
  function getModelOptions(){
    const list = getProjectModels();
    if(!list.length) return [["Нет моделей", "__NO_MODEL__"]];
    return list.map(m => [m.name + (m.ext?` .${m.ext}`:''), m.id]);
  }
  function getModelAnimations(modelId){ const m = AutoHE.getModel(projectId, modelId); return m && Array.isArray(m.animations) ? m.animations : []; }
  // Расширение файла по типу скрипта
  function typeExt(t){ return t==='story'?'.se.kts': t==='content'?'.content.kts': t==='mod'?'.mod.kts':'.kts'; }
  // Скрипты проекта для импорта
  function getProjectScriptsOptions(){
    try{
      const prj = AutoHE.getProject(projectId);
      const list = Array.isArray(prj && prj.scripts) ? prj.scripts : [];
      const opts = list
        .filter(s => s && s.id && s.id !== scriptId)
        .map(s => [String(s.name||'script'), String(s.id)]);
      return opts.length ? opts : [["нет скриптов","__NONE__"]];
    }catch(_){ return [["нет скриптов","__NONE__"]]; }
  }

  // Хелпер: форматировать число как Kotlin Double-литерал (1 -> 1.0, 1.5 -> 1.5)
  function toDoubleLiteral(value){
    const n = Number(value);
    if(!Number.isNaN(n)){
      return Number.isInteger(n) ? n.toFixed(1) : String(n);
    }
    const s = String(value||'').trim();
    if(/^-?\d+(?:\.\d+)?$/.test(s)){
      return s.includes('.') ? s : (s + '.0');
    }
    return s;
  }

  // Справочный блок: список анимаций модели
  if(!Blockly.Blocks['npc_list_animations']){
    Blockly.Blocks['npc_list_animations'] = {
      init: function(){
        this.appendDummyInput().appendField('анимации модели')
          .appendField(new Blockly.FieldDropdown(()=>getModelOptions()), 'MODEL_ID');
        this.setPreviousStatement(true,null);
        this.setNextStatement(true,null);
        this.setColour('#06b6d4');
      }
    };
  }
  if(!Blockly.Kotlin['npc_list_animations']){
    Blockly.Kotlin['npc_list_animations'] = function(block){
      const mid = block.getFieldValue('MODEL_ID');
      const list = getModelAnimations(mid);
      return `// animations: ${list.join(', ')}` + "\n";
    };
  }

  // Выпадающий список анимаций по всем моделям проекта (упрощённо)
  function animDropdownForNpc(getNpc){
    return function(){
      const models = getProjectModels();
      const anims = new Set();
      models.forEach(m => (m.animations||[]).forEach(a => anims.add(a)));
      const options = Array.from(anims).map(a => [a, a]);
      return options.length ? options : [["нет анимаций", "__NO_ANIM__"]];
    };
  }

  // Анимации NPC: once
  if(!Blockly.Blocks['npc_play_once']){
    Blockly.Blocks['npc_play_once'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput().appendField('анимация (once)')
          .appendField(new Blockly.FieldDropdown(animDropdownForNpc(()=>this.getFieldValue('NPC'))), 'ANIM');
        this.setPreviousStatement(true,null);
        this.setNextStatement(true,null);
        this.setColour('#06b6d4');
      }
    };
  }
  if(!Blockly.Kotlin['npc_play_once']){
    Blockly.Kotlin['npc_play_once'] = function(block){
      const who = block.getFieldValue('NPC');
      const anim = block.getFieldValue('ANIM');
      if(who==='__NO_NPC__' || anim==='__NO_ANIM__') return `// нет анимации/НИПа\n`;
      const esc = (anim||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      return `${who} playOnce {"${esc}"}\n`;
    };
  }

  // Единый блок анимации: once/looped/freeze/stop
  if(!Blockly.Blocks['npc_animation']){
    Blockly.Blocks['npc_animation'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput().appendField('анимация')
          .appendField(new Blockly.FieldDropdown([["один раз","ONCE"],["зациклить","LOOP"],["заморозить","FREEZE"],["остановить","STOP"]]), 'TYPE')
          .appendField(new Blockly.FieldDropdown(animDropdownFromNpcModel(this)), 'ANIM');
        this.setPreviousStatement(true,null);
        this.setNextStatement(true,null);
        this.setColour('#06b6d4');
        this.setTooltip('Анимации НИПа: once/looped/freeze/stop; список берётся из модели НИПа');
        // Перерисовывать список анимаций при смене NPC или TYPE
        const typeField = this.getField('TYPE');
        if(typeField && typeField.setValidator){ typeField.setValidator((v)=>{ setTimeout(()=>this.getField('ANIM').menuGenerator_ = animDropdownFromNpcModel(this), 0); return v; }); }
        const npcField = this.getField('NPC');
        if(npcField && npcField.setValidator){ npcField.setValidator((v)=>{ setTimeout(()=>this.getField('ANIM').menuGenerator_ = animDropdownFromNpcModel(this), 0); return v; }); }
      }
    };
  }
  if(!Blockly.Kotlin['npc_animation']){
    Blockly.Kotlin['npc_animation'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для анимации\n`;
      const kind = block.getFieldValue('TYPE');
      const anim = block.getFieldValue('ANIM');
      if(kind === 'STOP'){
        if(!anim || anim==='__NO_ANIM__') return `// нет ранее запущенных анимаций для остановки у ${who}\n`;
        const esc = (anim||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
        return `${who} stop {"${esc}"}\n`;
      }
      const esc = (anim||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      if(anim==='__NO_ANIM__') return `// нет анимации для ${who}\n`;
      if(kind === 'ONCE') return `${who} playOnce {"${esc}"}\n`;
      if(kind === 'LOOP') return `${who} playLooped {"${esc}"}\n`;
      if(kind === 'FREEZE') return `${who} playFreeze {"${esc}"}\n`;
      return '';
    };
  }

  // Анимации NPC: looped
  if(!Blockly.Blocks['npc_play_looped']){
    Blockly.Blocks['npc_play_looped'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput().appendField('анимация (looped)')
          .appendField(new Blockly.FieldDropdown(animDropdownForNpc(()=>this.getFieldValue('NPC'))), 'ANIM');
        this.setPreviousStatement(true,null);
        this.setNextStatement(true,null);
        this.setColour('#06b6d4');
      }
    };
  }
  if(!Blockly.Kotlin['npc_play_looped']){
    Blockly.Kotlin['npc_play_looped'] = function(block){
      const who = block.getFieldValue('NPC');
      const anim = block.getFieldValue('ANIM');
      if(who==='__NO_NPC__' || anim==='__NO_ANIM__') return `// нет анимации/НИПа\n`;
      const esc = (anim||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      return `${who} playLooped {"${esc}"}\n`;
    };
  }

  // Анимации NPC: freeze
  if(!Blockly.Blocks['npc_play_freeze']){
    Blockly.Blocks['npc_play_freeze'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput().appendField('анимация (freeze)')
          .appendField(new Blockly.FieldDropdown(animDropdownForNpc(()=>this.getFieldValue('NPC'))), 'ANIM');
        this.setPreviousStatement(true,null);
        this.setNextStatement(true,null);
        this.setColour('#06b6d4');
      }
    };
  }
  if(!Blockly.Kotlin['npc_play_freeze']){
    Blockly.Kotlin['npc_play_freeze'] = function(block){
      const who = block.getFieldValue('NPC');
      const anim = block.getFieldValue('ANIM');
      if(who==='__NO_NPC__' || anim==='__NO_ANIM__') return `// нет анимации/НИПа\n`;
      const esc = (anim||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      return `${who} playFreeze {"${esc}"}\n`;
    };
  }

  // Анимации NPC: stop — с выбором анимации
  if(!Blockly.Blocks['npc_stop_animation']){
    Blockly.Blocks['npc_stop_animation'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput().appendField('стоп анимация')
          .appendField(new Blockly.FieldDropdown(animDropdownForNpc(()=>this.getFieldValue('NPC'))), 'ANIM');
        this.setPreviousStatement(true,null);
        this.setNextStatement(true,null);
        this.setColour('#06b6d4');
      }
    };
  }
  if(!Blockly.Kotlin['npc_stop_animation']){
    Blockly.Kotlin['npc_stop_animation'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа\n`;
      const anim = block.getFieldValue('ANIM');
      if(!anim || anim==='__NO_ANIM__') return `${who} stop {"*"}\n`;
      const esc = (anim||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      return `${who} stop {"${esc}"}\n`;
    };
  }

  // Триггер: ожидание взаимодействия с НИПом
  Blockly.Blocks['trigger_npc_wait_interact'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('ждать взаимодействия с')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('<npcID>.waitInteract()');
    }
  };
  Blockly.Kotlin['trigger_npc_wait_interact'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who === '__NO_NPC__') return `// Нет созданного НИПа для waitInteract\n`;
    return `${who}.waitInteract()\n`;
  };

  // Триггеры ожидания ДОПОЛНИТЕЛЬНЫЕ
  // 1) Любое сообщение
  Blockly.Blocks['trigger_players_input_any'] = {
    init: function(){
      this.appendDummyInput().appendField('ждать сообщение — любое');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('<players>.input()');
    }
  };
  Blockly.Kotlin['trigger_players_input_any'] = function(){
    return 'player.input()\n';
  };

  // 2) Конкретное сообщение (точное)
  Blockly.Blocks['trigger_players_input_text'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('ждать сообщение ==')
        .appendField(new Blockly.FieldTextInput('Привет'), 'TEXT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('<players>.input("<text>")');
    }
  };
  Blockly.Kotlin['trigger_players_input_text'] = function(block){
    const t = (block.getFieldValue('TEXT')||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    return `player.input("${t}")\n`;
  };

  // 3) Сообщение из списка
  Blockly.Blocks['trigger_players_input_list'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('ждать сообщение из списка')
        .appendField(new Blockly.FieldTextInput('Привет,Hello'), 'LIST');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('<players>.input("a", "b", ...)');
    }
  };
  Blockly.Kotlin['trigger_players_input_list'] = function(block){
    const raw = block.getFieldValue('LIST')||'';
    const parts = raw.split(',').map(s=>s.trim()).filter(Boolean)
      .map(s=>`"${s.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`)
      .join(', ');
    return `player.input(${parts})\n`;
  };

  // 4) Ожидание позиции (players.waitPos { ... })
  Blockly.Blocks['trigger_players_wait_pos'] = {
    init: function(){
      this.appendDummyInput().appendField('ждать позицию игроков');
      this.appendDummyInput().appendField('x').appendField(new Blockly.FieldNumber(0), 'X')
        .appendField('y').appendField(new Blockly.FieldNumber(64), 'Y')
        .appendField('z').appendField(new Blockly.FieldNumber(0), 'Z');
      this.appendDummyInput().appendField('радиус')
        .appendField(new Blockly.FieldNumber(5, 0, 999, 0.5), 'R');
      this.appendDummyInput().appendField('игнорировать Y')
        .appendField(new Blockly.FieldCheckbox('TRUE'), 'IGNORE_Y');
      this.appendDummyInput().appendField('создать иконку')
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'CREATE_ICON');
      this.appendDummyInput().appendField('иконка (mod:id)')
        .appendField(new Blockly.FieldTextInput(''), 'ICON');
      this.appendDummyInput().appendField('мир')
        .appendField(new Blockly.FieldTextInput('overworld'), 'WORLD');
      this.appendDummyInput().appendField('инвертировать')
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'INVERSE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('players.waitPos { ... }');
    }
  };
  Blockly.Kotlin['trigger_players_wait_pos'] = function(block){
    const x = Number(block.getFieldValue('X')||0);
    const y = Number(block.getFieldValue('Y')||64);
    const z = Number(block.getFieldValue('Z')||0);
    const r = Number(block.getFieldValue('R')||5);
    const ignoreY = block.getFieldValue('IGNORE_Y') === 'TRUE';
    const createIcon = block.getFieldValue('CREATE_ICON') === 'TRUE';
    const icon = (block.getFieldValue('ICON')||'').trim();
    const world = (block.getFieldValue('WORLD')||'overworld').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    const inverse = block.getFieldValue('INVERSE') === 'TRUE';
    const iconLine = icon ? `\n  icon = "${icon}".rl` : '';
    return `player.waitPos {\n  pos = pos(${x}, ${y}, ${z})\n  radius = ${toDoubleLiteral(r)}\n  ignoreY = ${ignoreY}\n  createIcon = ${createIcon}${iconLine}\n  world = "${world}"\n  inverse = ${inverse}\n}\n`;
  };
  
  // 4.1) Ждать ПКМ/ЛКМ по блоку на координатах x y z
  Blockly.Blocks['trigger_wait_block_interact'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('ждать')
        .appendField(new Blockly.FieldDropdown([["ПКМ","RIGHT"],["ЛКМ","LEFT"]]), 'BUTTON')
        .appendField('по блоку (mod:id)')
        .appendField(new Blockly.FieldTextInput('minecraft:stone'), 'BLOCK');
      this.appendDummyInput()
        .appendField('x').appendField(new Blockly.FieldNumber(0), 'X')
        .appendField('y').appendField(new Blockly.FieldNumber(64), 'Y')
        .appendField('z').appendField(new Blockly.FieldNumber(0), 'Z');
      this.appendDummyInput()
        .appendField('только координаты (без проверки id блока)')
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'ONLY_POS');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('Ждать клик по блоку на указанных координатах. Опционально — только позиция.');
    }
  };
  Blockly.Kotlin['trigger_wait_block_interact'] = function(block){
    const btn = block.getFieldValue('BUTTON');
    const blockId = (block.getFieldValue('BLOCK')||'minecraft:stone').trim();
    const x = Number(block.getFieldValue('X')||0);
    const y = Number(block.getFieldValue('Y')||64);
    const z = Number(block.getFieldValue('Z')||0);
    const onlyPos = block.getFieldValue('ONLY_POS') === 'TRUE';
    const fn = btn === 'LEFT' ? 'waitLeftBlockInteract' : 'waitRightBlockInteract';
    if(onlyPos){
      return `${fn}(${x}, ${y}, ${z})\n`;
    } else {
      const esc = blockId.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      return `${fn}("${esc}", ${x}, ${y}, ${z})\n`;
    }
  };

  // 4.2) Ждать пока у игрока будет N предметов по условию сравнения
  Blockly.Blocks['trigger_wait_item_count'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('ждать пока у игрока будет')
        .appendField(new Blockly.FieldDropdown([[">","GT"],["<","LT"],[">=","GTE"],["<=","LTE"],["=","EQ"]]), 'OP')
        .appendField('предмета (mod:id)')
        .appendField(new Blockly.FieldTextInput('minecraft:bucket'), 'ITEM')
        .appendField('в количестве')
        .appendField(new Blockly.FieldNumber(1, 0, 9999, 1), 'COUNT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('Ждать пока количество предмета удовлетворит сравнению');
    }
  };
  Blockly.Kotlin['trigger_wait_item_count'] = function(block){
    const map = { GT: '>', LT: '<', GTE: '>=', LTE: '<=', EQ: '==' };
    const opKey = block.getFieldValue('OP');
    const op = map[opKey] || '==';
    const itemId = (block.getFieldValue('ITEM')||'minecraft:bucket').trim();
    const cnt = Number(block.getFieldValue('COUNT')||1);
    const esc = itemId.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    // Возвращаем только тело, импорт добавляется в шапку скрипта сборщиком ниже
    return `waitItemCount("${op}", "${esc}", ${cnt})\n`;
  };

  // Импорт другого скрипта проекта
  Blockly.Blocks['kotlin_import_script'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('импорт скрипта')
        .appendField(new Blockly.FieldDropdown(() => getProjectScriptsOptions()), 'SCRIPT_ID');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#6b7280');
      this.setTooltip('Добавляет @file:Import("<имя>.se.kts") для выбранного скрипта');
    }
  };
  Blockly.Kotlin['kotlin_import_script'] = function(block){
    const sid = block.getFieldValue('SCRIPT_ID');
    if(!sid || sid === '__NONE__') return '// нет скрипта для импорта\n';
    try{
      const prj = AutoHE.getProject(projectId);
      const s = (prj && prj.scripts || []).find(x => x.id === sid);
      if(!s) return '// скрипт не найден\n';
      const base = (s.name||'script');
      // В шапке импорт добавим сборщиком, здесь оставим маркер
      return `// IMPORT_SCRIPT:${base}${typeExt(s.type)}\n`;
    }catch(_){ return '// импорт не доступен\n'; }
  };

  // 5) await { условие }
  Blockly.Blocks['trigger_await_condition'] = {
    init: function(){
      this.appendDummyInput().appendField('ждать пока условие истинно (await)');
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('npc().isAlive'), 'COND');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#14b8a6');
      this.setTooltip('await { <условие> }');
    }
  };
  Blockly.Kotlin['trigger_await_condition'] = function(block){
    const c = (block.getFieldValue('COND')||'').trim();
    return `await { ${c} }\n`;
  };

  // ДОП. действия NPC
  // 6) Идти к сущности (игрок/НИП)
  Blockly.Blocks['npc_move_to_entity'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
      this.appendDummyInput().appendField('идти к')
        .appendField(new Blockly.FieldDropdown(() => getEntityOptions()), 'TARGET');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#06b6d4');
      this.setTooltip('<npcID> moveTo { <Entity> }');
    }
  };
  Blockly.Kotlin['npc_move_to_entity'] = function(block){
    const who = block.getFieldValue('NPC');
    const tgt = block.getFieldValue('TARGET');
    if(who === '__NO_NPC__') return `// Нет НИПа для moveTo\n`;
    const expr = (tgt === '__PLAYER_FIRST__') ? 'player().first()' : `${tgt}()`;
    return `${who} moveTo { ${expr} }\n`;
  };

  // 7) Смотреть на сущность
  Blockly.Blocks['npc_look_at_entity'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
      this.appendDummyInput().appendField('смотреть на')
        .appendField(new Blockly.FieldDropdown(() => getEntityOptions()), 'TARGET');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#06b6d4');
      this.setTooltip('<npcID> lookAt { <Entity> }');
    }
  };
  Blockly.Kotlin['npc_look_at_entity'] = function(block){
    const who = block.getFieldValue('NPC');
    const tgt = block.getFieldValue('TARGET');
    if(who === '__NO_NPC__') return `// Нет НИПа для lookAt\n`;
    const expr = (tgt === '__PLAYER_FIRST__') ? 'player().first()' : `${tgt}()`;
    return `${who} lookAt { ${expr} }\n`;
  };

  // 8) Режим бега
  Blockly.Blocks['npc_set_running'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('бежать')
        .appendField(new Blockly.FieldCheckbox('TRUE'), 'RUN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#06b6d4');
      this.setTooltip('<npcID>.isRunning = true/false');
    }
  };
  Blockly.Kotlin['npc_set_running'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who === '__NO_NPC__') return `// Нет НИПа для isRunning\n`;
    const run = block.getFieldValue('RUN') === 'TRUE';
    return `${who}.isRunning = ${run}\n`;
  };

  // 9) Выдать предмет в руку (левая/правая)
  Blockly.Blocks['npc_give_right_hand'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
      this.appendDummyInput().appendField('рука')
        .appendField(new Blockly.FieldDropdown([["правая","RIGHT"],["левая","LEFT"]]), 'HAND');
      this.appendDummyInput('ACT_INPUT').appendField('действие')
        .appendField(new Blockly.FieldDropdown([["добавить","ADD"],["убрать","REMOVE"]]), 'ACT');
      this.appendDummyInput('ITEM_INPUT').appendField('предмет (mod:id)')
        .appendField(new Blockly.FieldTextInput('me:cheese'), 'ITEM');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#06b6d4');
      this.setTooltip('добавить/убрать предмет в руку: giveRightHand / giveLeftHand');
      const update = () => {
        const act = this.getFieldValue('ACT');
        const showItem = act !== 'REMOVE';
        this.getInput('ITEM_INPUT').setVisible(showItem);
        if (this.rendered) {
          this.render();
          if (this.workspace) try { Blockly.svgResize(this.workspace); } catch(_) {}
        }
      };
      const actField = this.getField('ACT');
      if (actField && actField.setValidator) { actField.setValidator((v)=>{ setTimeout(update, 0); return v; }); }
      this.setOnChange(function(){ update(); });
      update();
    }
  };
  Blockly.Kotlin['npc_give_right_hand'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who === '__NO_NPC__') return `// Нет НИПа для giveHand\n`;
    const act = block.getFieldValue('ACT') || 'ADD';
    const hand = block.getFieldValue('HAND') === 'LEFT' ? 'giveLeftHand' : 'giveRightHand';
    if(act === 'REMOVE'){
      return `${who} ${hand} { null }\n`;
    }
    const item = (block.getFieldValue('ITEM')||'').replace(/\\/g,'\\\\').replace(/\"/g,'\\"');
    return `${who} ${hand} { item("${item}") }\n`;
  };

  // 10) Удалить НИПа (despawn)
  Blockly.Blocks['npc_despawn'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(function(){
          return getNpcIdOptions();
        }, function(newVal){
          const opts = getNpcIdOptions();
          const allowed = opts.some(o => o[1] === newVal);
          return allowed ? newVal : '__NO_NPC__';
        }), 'NPC')
        .appendField('исчезнуть (despawn)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#06b6d4');
      this.setTooltip('npc.despawn()');
    }
  };
  Blockly.Kotlin['npc_despawn'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who === '__NO_NPC__') return `// Нет НИПа для despawn\n`;
    return `${who}.despawn()\n`;
  };

  // Выбросить предмет
  if(!Blockly.Blocks['npc_drop_item']){
    Blockly.Blocks['npc_drop_item'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
          .appendField('выбросить предмет');
        this.appendDummyInput().appendField('предмет (mod:id)')
          .appendField(new Blockly.FieldTextInput('me:cheese'), 'ITEM');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('<npcID> dropItem { item("<itemID>") }');
      }
    };
  }
  if(!Blockly.Kotlin['npc_drop_item']){
    Blockly.Kotlin['npc_drop_item'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who === '__NO_NPC__') return `// Нет НИПа для dropItem\n`;
      const item = (block.getFieldValue('ITEM')||'').replace(/\\/g,'\\\\').replace(/\"/g,'\\"');
      return `${who} dropItem { item("${item}") }\n`;
    };
  }

  // Верну блок и генератор для keybind
  if(!Blockly.Blocks['trigger_keybind']){
    Blockly.Blocks['trigger_keybind'] = {
      init: function(){
        this.appendDummyInput()
          .appendField('ждать нажатие клавиши')
          .appendField(new Blockly.FieldDropdown([
            ['H','H'], ['G','G'], ['F','F'], ['E','E'],
            ['T','T'], ['Y','Y'], ['U','U'], ['I','I'], ['O','O'], ['R','R']
          ]), 'KEY');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#14b8a6');
        this.setTooltip('keybind { Keybind.<KEY> }');
      }
    };
  }
  if(!Blockly.Kotlin['trigger_keybind']){
    Blockly.Kotlin['trigger_keybind'] = function(block){
      const key = block.getFieldValue('KEY');
      return `keybind { Keybind.${key} }\n`;
    };
  }

  // Обновляю тулбокс, чтобы точно присутствовали keybind и waitInteract
  (function(){
    const triggersCat = toolbox.contents.find(c => c.categorystyle === 'triggers_category');
    if(triggersCat){
      const types = triggersCat.contents.map(i=>i.type);
      if(!types.includes('trigger_keybind')) triggersCat.contents.push({ kind:'block', type:'trigger_keybind' });
      if(!types.includes('trigger_npc_wait_interact')) triggersCat.contents.push({ kind:'block', type:'trigger_npc_wait_interact' });
    }
    // Добавляем категории Квесты и Торговля
    toolbox.contents.push({ kind:'category', name:'Квесты', categorystyle:'quests_category', contents:[
      { kind:'block', type:'npc_request_items' },
      { kind:'block', type:'quest_item_req' },
      { kind:'block', type:'quest_add' },
      { kind:'block', type:'quest_remove' },
      { kind:'block', type:'quest_set_status' },
      { kind:'block', type:'quest_append' },
      { kind:'block', type:'quest_goal' }
    ]});
    toolbox.contents.push({ kind:'category', name:'Торговля', categorystyle:'trade_category', contents:[
      { kind:'block', type:'npc_trades' },
      { kind:'block', type:'trade_offer' },
      { kind:'block', type:'npc_clear_trades_uses' },
      { kind:'block', type:'npc_clear_trades' }
    ]});
    // Асинхронность
    toolbox.contents.push({ kind:'category', name:'Асинхронность', categorystyle:'async_category', contents:[
      { kind:'block', type:'async_simple' },
      { kind:'block', type:'async_define' },
      { kind:'block', type:'async_resume' },
      { kind:'block', type:'async_stop' },
      { kind:'block', type:'async_join' }
    ]});
    // Добавим story_branch в категорию Диалоги
    const dialogCat = toolbox.contents.find(c => c.categorystyle === 'dialog_category');
    if(dialogCat){
      const types = dialogCat.contents.map(i=>i.type);
      if(!types.includes('dialog_choices')) dialogCat.contents.push({ kind:'block', type:'dialog_choices' });
    }
  })();

  // Вставляем новые блоки в тулбокс
  (function(){
    const triggersCat = toolbox.contents.find(c => c.categorystyle === 'triggers_category');
    if(triggersCat){
      triggersCat.contents.push(
        { kind: 'block', type: 'trigger_players_input_any' },
        { kind: 'block', type: 'trigger_players_input_text' },
        { kind: 'block', type: 'trigger_players_input_list' },
        { kind: 'block', type: 'trigger_players_wait_pos' },
        { kind: 'block', type: 'trigger_wait_block_interact' },
        { kind: 'block', type: 'trigger_wait_item_count' },
        { kind: 'block', type: 'trigger_await_condition' }
      );
    }
    const npcCat = toolbox.contents.find(c => c.categorystyle === 'npc_category');
    if(npcCat){
      // Заменяем на универсальные + единый блок анимаций
      const filtered = npcCat.contents.filter(i => i.type !== 'npc_move_to_entity' && i.type !== 'npc_look_at_entity' && i.type !== 'npc_list_animations' && i.type !== 'npc_play_once' && i.type !== 'npc_play_looped' && i.type !== 'npc_play_freeze' && i.type !== 'npc_stop_animation');
      npcCat.contents = filtered.concat([
        { kind: 'block', type: 'npc_move_to' },
        { kind: 'block', type: 'npc_look_at' },
        { kind: 'block', type: 'npc_tp_to' },
        { kind: 'block', type: 'npc_set_target' },
        { kind: 'block', type: 'npc_clear_target' },
        { kind: 'block', type: 'npc_set_running' },
        { kind: 'block', type: 'npc_give_right_hand' },
        { kind: 'block', type: 'npc_drop_item' },
        { kind: 'block', type: 'npc_invulnerable' },
        { kind: 'block', type: 'npc_hitbox' },
        { kind: 'block', type: 'npc_despawn' },
        { kind: 'block', type: 'npc_animation' },
        { kind: 'block', type: 'npc_fdestroy_block' },
        { kind: 'block', type: 'npc_fuse_block' }
      ]);
    }
    // Добавим в Управление блоки для игроков и команды
    const controlCat = toolbox.contents.find(c => c.categorystyle === 'control_category');
    if(controlCat){
      const types = controlCat.contents.map(i=>i.type);
      if(!types.includes('fade_in')) controlCat.contents.push({ kind:'block', type:'fade_in' });
      if(!types.includes('fade_out')) controlCat.contents.push({ kind:'block', type:'fade_out' });
      if(!types.includes('players_tp_to')) controlCat.contents.push({ kind:'block', type:'players_tp_to' });
      if(!types.includes('players_inventory')) controlCat.contents.push({ kind:'block', type:'players_inventory' });
      if(!types.includes('mc_command')) controlCat.contents.push({ kind:'block', type:'mc_command' });
      if(!types.includes('kotlin_import_script')) controlCat.contents.push({ kind:'block', type:'kotlin_import_script' });
      if(!types.includes('kotlin_start_script')) controlCat.contents.push({ kind:'block', type:'kotlin_start_script' });
      // Cutscenes camera blocks
      if(!types.includes('camera_spline')) controlCat.contents.push({ kind:'block', type:'camera_spline' });
      if(!types.includes('camera_static')) controlCat.contents.push({ kind:'block', type:'camera_static' });
      if(!types.includes('camera_entity')) controlCat.contents.push({ kind:'block', type:'camera_entity' });
    }
  })();

  // Квесты (по документации: <npcID>.requestItems { +item("id", count, "nbt") })
  Blockly.Blocks['npc_request_items'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('задания: запросить предметы');
      this.appendStatementInput('REQS').setCheck(null).appendField('требования');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#e11d48');
    }
  };
  Blockly.Kotlin['npc_request_items'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who==='__NO_NPC__') return `// Нет НИПа для requestItems\n`;
    const inner = collectStatementInput(block, 'REQS');
    return `${who}.requestItems {\n${inner}}\n`;
  };

  Blockly.Blocks['quest_item_req'] = {
    init: function(){
      this.appendDummyInput()
        .appendField('+item')
        .appendField(new Blockly.FieldTextInput('minecraft:emerald'), 'ITEM')
        .appendField('x')
        .appendField(new Blockly.FieldNumber(1,1,999,1), 'COUNT')
        .appendField('nbt')
        .appendField(new Blockly.FieldTextInput(''), 'NBT');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#e11d48');
    }
  };
  Blockly.Kotlin['quest_item_req'] = function(block){
    const id = (block.getFieldValue('ITEM')||'').trim();
    const c = Number(block.getFieldValue('COUNT')||1);
    const nbt = (block.getFieldValue('NBT')||'').trim();
    const item = id.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    return nbt ? `  +item(\"${item}\", ${c}, \"${nbt.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"')}\")\n`
              : `  +item(\"${item}\", ${c})\n`;
  };

  // Торговля (по документации: <npcID> addTrade(MerchantOffer(...)))
  Blockly.Blocks['npc_add_trade'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('добавить трейд');
      this.appendDummyInput().appendField('цена1 id').appendField(new Blockly.FieldTextInput('minecraft:emerald'), 'P1_ID')
        .appendField('x').appendField(new Blockly.FieldNumber(1,1,999,1), 'P1_CNT')
        .appendField('nbt').appendField(new Blockly.FieldTextInput(''), 'P1_NBT');
      this.appendDummyInput().appendField('цена2 id').appendField(new Blockly.FieldTextInput(''), 'P2_ID')
        .appendField('x').appendField(new Blockly.FieldNumber(1,1,999,1), 'P2_CNT')
        .appendField('nbt').appendField(new Blockly.FieldTextInput(''), 'P2_NBT');
      this.appendDummyInput().appendField('товар id').appendField(new Blockly.FieldTextInput('minecraft:bread'), 'IT_ID')
        .appendField('x').appendField(new Blockly.FieldNumber(1,1,999,1), 'IT_CNT')
        .appendField('nbt').appendField(new Blockly.FieldTextInput(''), 'IT_NBT');
      this.appendDummyInput().appendField('maxTrades').appendField(new Blockly.FieldNumber(999,1,9999,1), 'MAX')
        .appendField('xpTrade').appendField(new Blockly.FieldNumber(0,0,9999,1), 'XP')
        .appendField('priceMultiple').appendField(new Blockly.FieldNumber(0,0,100,0.1), 'PM');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#f97316');
    }
  };
  function genItemCall(id, cnt, nbt){
    const idEsc = id.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
    if(!idEsc) return 'null';
    const nbtTrim = (nbt||'').trim();
    if(nbtTrim){
      const nbtEsc = nbtTrim.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
      return `item(\"${idEsc}\", ${cnt}, \"${nbtEsc}\")`;
    }
    return `item(\"${idEsc}\", ${cnt})`;
  }
  Blockly.Kotlin['npc_add_trade'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who==='__NO_NPC__') return `// Нет НИПа для addTrade\n`;
    const p1 = genItemCall((block.getFieldValue('P1_ID')||'').trim(), Number(block.getFieldValue('P1_CNT')||1), block.getFieldValue('P1_NBT'));
    const p2raw = (block.getFieldValue('P2_ID')||'').trim();
    const p2 = p2raw ? genItemCall(p2raw, Number(block.getFieldValue('P2_CNT')||1), block.getFieldValue('P2_NBT')) : 'item("minecraft:air", 0)';
    const it = genItemCall((block.getFieldValue('IT_ID')||'').trim(), Number(block.getFieldValue('IT_CNT')||1), block.getFieldValue('IT_NBT'));
    const max = Number(block.getFieldValue('MAX')||999);
    const xp = Number(block.getFieldValue('XP')||0);
    const pm = Number(block.getFieldValue('PM')||0);
    return `${who}.addTrade{\n  MerchantOffer(\n    ${p1},\n    ${p2},\n    ${it},\n    ${max},\n    ${xp},\n    ${pm}f\n  )\n}\n`;
  };

  Blockly.Blocks['npc_clear_trades_uses'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('обнулить счётчик торгов');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#f97316');
    }
  };
  Blockly.Kotlin['npc_clear_trades_uses'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who==='__NO_NPC__') return `// Нет НИПа для clearTradesUses\n`;
    return `${who}.clearTradesUses()\n`;
  };

  Blockly.Blocks['npc_clear_trades'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('удалить возможность торговать');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#f97316');
    }
  };
  Blockly.Kotlin['npc_clear_trades'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who==='__NO_NPC__') return `// Нет НИПа для clearTrades\n`;
    return `${who}.clearTrades()\n`;
  };

  // Торговля — контейнер для нескольких трейдов
  Blockly.Blocks['npc_trades'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('трейды');
      this.appendStatementInput('OFFERS').setCheck(null).appendField('предложения');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#f97316');
    }
  };
  Blockly.Blocks['trade_offer'] = {
    init: function(){
      this.appendDummyInput().appendField('оффер: цена1 id').appendField(new Blockly.FieldTextInput('minecraft:emerald'), 'P1_ID')
        .appendField('x').appendField(new Blockly.FieldNumber(1,1,999,1), 'P1_CNT')
        .appendField('nbt').appendField(new Blockly.FieldTextInput(''), 'P1_NBT');
      this.appendDummyInput().appendField('цена2 id').appendField(new Blockly.FieldTextInput(''), 'P2_ID')
        .appendField('x').appendField(new Blockly.FieldNumber(1,1,999,1), 'P2_CNT')
        .appendField('nbt').appendField(new Blockly.FieldTextInput(''), 'P2_NBT');
      this.appendDummyInput().appendField('товар id').appendField(new Blockly.FieldTextInput('minecraft:bread'), 'IT_ID')
        .appendField('x').appendField(new Blockly.FieldNumber(1,1,999,1), 'IT_CNT')
        .appendField('nbt').appendField(new Blockly.FieldTextInput(''), 'IT_NBT');
      this.appendDummyInput().appendField('maxTrades').appendField(new Blockly.FieldNumber(999,1,9999,1), 'MAX')
        .appendField('xpTrade').appendField(new Blockly.FieldNumber(0,0,9999,1), 'XP')
        .appendField('priceMultiple').appendField(new Blockly.FieldNumber(0,0,100,0.1), 'PM');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#f97316');
    }
  };
  // trade_offer сам по себе кода не генерирует (используется внутри npc_trades)
  Blockly.Kotlin['trade_offer'] = function(){ return ''; };

  function merchantOfferFromOfferBlock(offer){
    const p1 = genItemCall((offer.getFieldValue('P1_ID')||'').trim(), Number(offer.getFieldValue('P1_CNT')||1), offer.getFieldValue('P1_NBT'));
    const p2raw = (offer.getFieldValue('P2_ID')||'').trim();
    const p2 = p2raw ? genItemCall(p2raw, Number(offer.getFieldValue('P2_CNT')||1), offer.getFieldValue('P2_NBT')) : 'item("minecraft:air", 0)';
    const it = genItemCall((offer.getFieldValue('IT_ID')||'').trim(), Number(offer.getFieldValue('IT_CNT')||1), offer.getFieldValue('IT_NBT'));
    const max = Number(offer.getFieldValue('MAX')||999);
    const xp = Number(offer.getFieldValue('XP')||0);
    const pm = Number(offer.getFieldValue('PM')||0);
    return `MerchantOffer(\n    ${p1},\n    ${p2},\n    ${it},\n    ${max},\n    ${xp},\n    ${pm}f\n  )`;
  }
  Blockly.Kotlin['npc_trades'] = function(block){
    const who = block.getFieldValue('NPC');
    if(who==='__NO_NPC__') return `// Нет НИПа для трейдов\n`;
    let code = '';
    let child = block.getInputTargetBlock('OFFERS');
    while(child){
      if(child.type === 'trade_offer'){
        const mo = merchantOfferFromOfferBlock(child);
        code += `${who}.addTrade{\n  ${mo}\n}\n`;
      }
      child = child.getNextBlock();
    }
    return code;
  };

  // Асинхронность (по документации: async { ... } и управляемый async через переменную)
  Blockly.Blocks['async_simple'] = {
    init: function(){
      this.appendDummyInput().appendField('async { задачи параллельно }');
      this.appendStatementInput('BODY').setCheck(null).appendField('задачи');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#60a5fa');
    }
  };
  Blockly.Kotlin['async_simple'] = function(block){
    const inner = collectStatementInput(block, 'BODY');
    return `async {\n${inner}}\n`;
  };

  Blockly.Blocks['async_define'] = {
    init: function(){
      this.appendDummyInput().appendField('val')
        .appendField(new Blockly.FieldTextInput('myAsyncID'), 'NAME')
        .appendField('= async');
      this.appendStatementInput('BODY').setCheck(null).appendField('задачи');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour('#60a5fa');
    }
  };
  Blockly.Kotlin['async_define'] = function(block){
    const n = (block.getFieldValue('NAME')||'myAsyncID').replace(/[^a-zA-Z0-9_]/g,'_');
    const inner = collectStatementInput(block, 'BODY');
    return `val ${n} = async {\n${inner}}\n`;
  };

  function asyncName(block, field){ return (block.getFieldValue(field)||'myAsyncID').replace(/[^a-zA-Z0-9_]/g,'_'); }
  Blockly.Blocks['async_resume'] = {
    init: function(){ this.appendDummyInput().appendField('async').appendField(new Blockly.FieldTextInput('myAsyncID'), 'NAME').appendField('.resume()'); this.setPreviousStatement(true,null); this.setNextStatement(true,null); this.setColour('#60a5fa'); }
  };
  Blockly.Kotlin['async_resume'] = function(block){ return `${asyncName(block,'NAME')}.resume()\n`; };
  Blockly.Blocks['async_stop'] = {
    init: function(){ this.appendDummyInput().appendField('async').appendField(new Blockly.FieldTextInput('myAsyncID'), 'NAME').appendField('.stop()'); this.setPreviousStatement(true,null); this.setNextStatement(true,null); this.setColour('#60a5fa'); }
  };
  Blockly.Kotlin['async_stop'] = function(block){ return `${asyncName(block,'NAME')}.stop()\n`; };
  Blockly.Blocks['async_join'] = {
    init: function(){ this.appendDummyInput().appendField('async').appendField(new Blockly.FieldTextInput('myAsyncID'), 'NAME').appendField('.join()'); this.setPreviousStatement(true,null); this.setNextStatement(true,null); this.setColour('#60a5fa'); }
  };
  Blockly.Kotlin['async_join'] = function(block){ return `${asyncName(block,'NAME')}.join()\n`; };

  // Универсальный ходьбы: один раз / бесконечно / перестать, к позиции / игроку / НИПу / выражению
  if(!Blockly.Blocks['npc_move_to']){
    Blockly.Blocks['npc_move_to'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput()
          .appendField('идти')
          .appendField(new Blockly.FieldDropdown([["один раз","ONCE"],["бесконечно","ALWAYS"],["перестать","STOP"]]), 'MODE')
          .appendField('до')
          .appendField(new Blockly.FieldDropdown([["позиция","POS"],["игрок","PLAYER"],["НИП","NPC"],["выражение сущности","EXPR"]]), 'TARGET_KIND');
        this.appendDummyInput('POS_INPUT').appendField('x').appendField(new Blockly.FieldNumber(0), 'X')
          .appendField('y').appendField(new Blockly.FieldNumber(64), 'Y')
          .appendField('z').appendField(new Blockly.FieldNumber(0), 'Z');
        this.appendDummyInput('NPC_INPUT').appendField('цель НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'TARGET_NPC');
        this.appendDummyInput('EXPR_INPUT').appendField('выражение')
          .appendField(new Blockly.FieldTextInput('player().first()'), 'EXPR');
        this.appendDummyInput('DIST_INPUT').appendField('дистанция (POS)')
          .appendField(new Blockly.FieldNumber(1.0, 0.3, 999, 0.1), 'DIST');
        this.appendDummyInput('SPEED_INPUT').appendField('скорость (POS)')
          .appendField(new Blockly.FieldNumber(1.0, 0.1, 10, 0.1), 'SPEED');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('Идти к цели. Для POS в режиме "один раз" используется фикс fmoveTo с параметрами дистанции/скорости; в режиме "бесконечно" — стандартный moveAlwaysTo; "перестать" — остановить.');
        const updateAndRender = () => {
          const kind = this.getFieldValue('TARGET_KIND');
          const mode = this.getFieldValue('MODE');
          const showTarget = mode !== 'STOP';
          this.getInput('POS_INPUT').setVisible(showTarget && kind === 'POS');
          this.getInput('NPC_INPUT').setVisible(showTarget && kind === 'NPC');
          this.getInput('EXPR_INPUT').setVisible(showTarget && kind === 'EXPR');
          const showPosExtras = showTarget && kind === 'POS';
          this.getInput('DIST_INPUT').setVisible(showPosExtras);
          this.getInput('SPEED_INPUT').setVisible(showPosExtras);
          if (this.rendered) {
            this.render();
            if (this.workspace) try { Blockly.svgResize(this.workspace); } catch(_) {}
          }
        };
        const kindField = this.getField('TARGET_KIND');
        if (kindField && kindField.setValidator) { kindField.setValidator((v)=>{ setTimeout(updateAndRender, 0); return v; }); }
        const modeField = this.getField('MODE');
        if (modeField && modeField.setValidator) { modeField.setValidator((v)=>{ setTimeout(updateAndRender, 0); return v; }); }
        this.setOnChange(function(){ updateAndRender(); });
        updateAndRender();
      }
    };
  }
  if(!Blockly.Kotlin['npc_move_to']){
    Blockly.Kotlin['npc_move_to'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для moveTo\n`;
      const mode = block.getFieldValue('MODE');
      if(mode === 'STOP'){
        return `${who}.stopMoveAlways()\n`;
      }
      const kind = block.getFieldValue('TARGET_KIND');
      if(mode === 'ALWAYS'){
        const method = 'moveAlwaysTo';
        if(kind === 'POS'){
          const x = Number(block.getFieldValue('X')||0);
          const y = Number(block.getFieldValue('Y')||64);
          const z = Number(block.getFieldValue('Z')||0);
          return `${who} ${method} { pos(${x}, ${y}, ${z}) }\n`;
        }
        if(kind === 'PLAYER') return `${who} ${method} { player().first() }\n`;
        if(kind === 'NPC'){
          const tgt = block.getFieldValue('TARGET_NPC');
          if(tgt==='__NO_NPC__') return `// Нет целевого НИПа для moveAlwaysTo\n`;
          return `${who} ${method} { ${tgt}() }\n`;
        }
        const exprAlw = (block.getFieldValue('EXPR')||'player().first()').trim();
        return `${who} ${method} { ${exprAlw} }\n`;
      }
      // Иначе — используем новый фикс fmoveTo с дистанцией и скоростью
      const distInput = Number(block.getFieldValue('DIST')||1.0);
      const dist = Math.max(0.9, distInput);
      const speed = Number(block.getFieldValue('SPEED')||1.0);
      if(kind === 'POS'){
        const x = Number(block.getFieldValue('X')||0);
        const y = Number(block.getFieldValue('Y')||64);
        const z = Number(block.getFieldValue('Z')||0);
        return `fmoveTo(${who}, poz(${toDoubleLiteral(x)}, ${toDoubleLiteral(y)}, ${toDoubleLiteral(z)}), ${toDoubleLiteral(dist)}, ${toDoubleLiteral(speed)})\n`;
      }
      if(kind === 'PLAYER'){
        return `fmoveTo(${who}, { player().first().position() }, ${toDoubleLiteral(dist)}, ${toDoubleLiteral(speed)})\n`;
      }
      if(kind === 'NPC'){
        const tgt = block.getFieldValue('TARGET_NPC');
        if(tgt==='__NO_NPC__') return `// Нет целевого НИПа для fmoveTo\n`;
        return `fmoveTo(${who}, { ${tgt}().position() }, ${toDoubleLiteral(dist)}, ${toDoubleLiteral(speed)})\n`;
      }
      const expr = (block.getFieldValue('EXPR')||'player().first()').trim();
      // Если выражение похоже на ResourceLocation (modid:entity), не добавляем .position()
      const isRL = /^[a-z0-9_]+:[a-z0-9_./-]+$/i.test(expr);
      const exprPart = isRL ? `{ ${expr} }` : `{ ${expr}.position() }`;
      return `fmoveTo(${who}, ${exprPart}, ${toDoubleLiteral(dist)}, ${toDoubleLiteral(speed)})\n`;
    };
  }

  // Универсальный «смотреть на»: один раз / бесконечно / перестать
  if(!Blockly.Blocks['npc_look_at']){
    Blockly.Blocks['npc_look_at'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput()
          .appendField('смотреть')
          .appendField(new Blockly.FieldDropdown([["один раз","ONCE"],["бесконечно","ALWAYS"],["перестать","STOP"]]), 'MODE')
          .appendField('на')
          .appendField(new Blockly.FieldDropdown([["позицию","POS"],["игрока","PLAYER"],["НИПа","NPC"],["сущность (выражение)","EXPR"]]), 'TARGET_KIND');
        this.appendDummyInput('POS_INPUT').appendField('x').appendField(new Blockly.FieldNumber(0), 'X')
          .appendField('y').appendField(new Blockly.FieldNumber(64), 'Y')
          .appendField('z').appendField(new Blockly.FieldNumber(0), 'Z');
        this.appendDummyInput('NPC_INPUT').appendField('цель НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'TARGET_NPC');
        this.appendDummyInput('EXPR_INPUT').appendField('выражение')
          .appendField(new Blockly.FieldTextInput('player().first()'), 'EXPR');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('lookAt / lookAlwaysAt — на позицию, игрока, НИПа или произвольную сущность; перестать — прекратить слежение');
        const updateAndRender = () => {
          const kind = this.getFieldValue('TARGET_KIND');
          const mode = this.getFieldValue('MODE');
          const showTarget = mode !== 'STOP';
          this.getInput('POS_INPUT').setVisible(showTarget && kind === 'POS');
          this.getInput('NPC_INPUT').setVisible(showTarget && kind === 'NPC');
          this.getInput('EXPR_INPUT').setVisible(showTarget && kind === 'EXPR');
          if (this.rendered) {
            this.render();
            if (this.workspace) try { Blockly.svgResize(this.workspace); } catch(_) {}
          }
        };
        const kindField = this.getField('TARGET_KIND');
        if (kindField && kindField.setValidator) { kindField.setValidator((v)=>{ setTimeout(updateAndRender, 0); return v; }); }
        const modeField = this.getField('MODE');
        if (modeField && modeField.setValidator) { modeField.setValidator((v)=>{ setTimeout(updateAndRender, 0); return v; }); }
        this.setOnChange(function(){ updateAndRender(); });
        updateAndRender();
      }
    };
  }
  if(!Blockly.Kotlin['npc_look_at']){
    Blockly.Kotlin['npc_look_at'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для lookAt\n`;
      const mode = block.getFieldValue('MODE');
      if(mode === 'STOP'){
        return `${who}.stopLookAlways()\n`;
      }
      const method = mode === 'ALWAYS' ? 'lookAlwaysAt' : 'lookAt';
      const kind = block.getFieldValue('TARGET_KIND');
      if(kind === 'POS'){
        const x = Number(block.getFieldValue('X')||0);
        const y = Number(block.getFieldValue('Y')||64);
        const z = Number(block.getFieldValue('Z')||0);
        return `${who} ${method} { pos(${x}, ${y}, ${z}) }\n`;
      }
      if(kind === 'PLAYER'){
        return `${who} ${method} { player().first() }\n`;
      }
      if(kind === 'NPC'){
        const tgt = block.getFieldValue('TARGET_NPC');
        if(tgt==='__NO_NPC__') return `// Нет целевого НИПа для lookAt\n`;
        return `${who} ${method} { ${tgt}() }\n`;
      }
      const expr = (block.getFieldValue('EXPR')||'player().first()').trim();
      return `${who} ${method} { ${expr} }\n`;
    };
  }

  // Блоки фиксеров: fdestroyBlock / fuseBlock
  function genFixerAction(block, fn){
    const who = block.getFieldValue('NPC');
    if(who==='__NO_NPC__') return `// Нет НИПа для ${fn}\\n`;
    const x = Number(block.getFieldValue('X')||0);
    const y = Number(block.getFieldValue('Y')||64);
    const z = Number(block.getFieldValue('Z')||0);
    const delay = Number(block.getFieldValue('DELAY')||0);
    if(fn==='fdestroyBlock') return `${who} ${fn} { poz(${x}.toDouble(), ${y}.toDouble(), ${z}.toDouble()) } ${delay}\n`;
    return `${who} ${fn} { poz(${x}.toDouble(), ${y}.toDouble(), ${z}.toDouble()) } ${delay}\n`;
  }

  if(!Blockly.Blocks['npc_fdestroy_block']){
    Blockly.Blocks['npc_fdestroy_block'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput().appendField('дойти и сломать блок, цель poz(')
          .appendField(new Blockly.FieldNumber(0), 'X')
          .appendField(',').appendField(new Blockly.FieldNumber(64), 'Y')
          .appendField(',').appendField(new Blockly.FieldNumber(0), 'Z')
          .appendField(') задержка (сек)').appendField(new Blockly.FieldNumber(0, 0, 10000, 0.1), 'DELAY');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('fdestroyBlock(npc, poz(x,y,z), delay) — дойти к позиции и сломать блок; delay — задержка перед действием в секундах (будет конвертирована в тики)');
      }
    };
  }
  if(!Blockly.Kotlin['npc_fdestroy_block']){
    Blockly.Kotlin['npc_fdestroy_block'] = function(block){
      // конвертация секунд в тики
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для fdestroyBlock\n`;
      const x = Number(block.getFieldValue('X')||0);
      const y = Number(block.getFieldValue('Y')||64);
      const z = Number(block.getFieldValue('Z')||0);
      const sec = Number(block.getFieldValue('DELAY')||0);
      return `fdestroyBlock(${who}, poz(${toDoubleLiteral(x)}, ${toDoubleLiteral(y)}, ${toDoubleLiteral(z)}), (20*${sec}).toInt())\n`;
    };
  }

  if(!Blockly.Blocks['npc_fuse_block']){
    Blockly.Blocks['npc_fuse_block'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC');
        this.appendDummyInput().appendField('дойти и использовать блок, цель poz(')
          .appendField(new Blockly.FieldNumber(0), 'X')
          .appendField(',').appendField(new Blockly.FieldNumber(64), 'Y')
          .appendField(',').appendField(new Blockly.FieldNumber(0), 'Z')
          .appendField(') задержка (сек)').appendField(new Blockly.FieldNumber(0, 0, 10000, 0.1), 'DELAY');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('fuseBlock(npc, poz(x,y,z), delay) — дойти к позиции и использовать блок; delay — задержка перед действием в секундах (будет конвертирована в тики)');
      }
    };
  }
  if(!Blockly.Kotlin['npc_fuse_block']){
    Blockly.Kotlin['npc_fuse_block'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для fuseBlock\n`;
      const x = Number(block.getFieldValue('X')||0);
      const y = Number(block.getFieldValue('Y')||64);
      const z = Number(block.getFieldValue('Z')||0);
      const sec = Number(block.getFieldValue('DELAY')||0);
      return `fuseBlock(${who}, poz(${toDoubleLiteral(x)}, ${toDoubleLiteral(y)}, ${toDoubleLiteral(z)}), (20*${sec}).toInt())\n`;
    };
  }

  // Телепорт NPC: tpTo { pos = pos(x,y,z); world = "<dimension>" }
  if(!Blockly.Blocks['npc_tp_to']){
    Blockly.Blocks['npc_tp_to'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
          .appendField('телепорт');
        this.appendDummyInput().appendField('x').appendField(new Blockly.FieldNumber(0), 'X')
          .appendField('y').appendField(new Blockly.FieldNumber(64), 'Y')
          .appendField('z').appendField(new Blockly.FieldNumber(0), 'Z');
        this.appendDummyInput().appendField('мир').appendField(new Blockly.FieldTextInput('overworld'), 'WORLD');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('<npcID> tpTo { pos = pos(x, y, z)\\n  world = "<dimension>" }');
      }
    };
  }
  if(!Blockly.Kotlin['npc_tp_to']){
    Blockly.Kotlin['npc_tp_to'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для tpTo\n`;
      const x = Number(block.getFieldValue('X')||0);
      const y = Number(block.getFieldValue('Y')||64);
      const z = Number(block.getFieldValue('Z')||0);
      const world = (block.getFieldValue('WORLD')||'overworld').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      return `${who} tpTo {\n  pos = pos(${x}, ${y}, ${z})\n  world = "${world}"\n}\n`;
    };
  }

  // Атака: setTarget { <target> } и сброс цели clearTarget()
  if(!Blockly.Blocks['npc_set_target']){
    Blockly.Blocks['npc_set_target'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
          .appendField('установить цель');
        this.appendDummyInput().appendField('тип')
          .appendField(new Blockly.FieldDropdown([["Игрок (первый)","PLAYER"],["НИП","NPC"],["сущность (выражение)","EXPR"]]), 'KIND');
        this.appendDummyInput('NPC_INPUT').appendField('цель НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'TARGET_NPC');
        this.appendDummyInput('EXPR_INPUT').appendField('выражение')
          .appendField(new Blockly.FieldTextInput('player().first()'), 'EXPR');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('<npcID> setTarget { <target> } — цель: игрок/НИП/выражение');
        const update = () => {
          const k = this.getFieldValue('KIND');
          this.getInput('NPC_INPUT').setVisible(k === 'NPC');
          this.getInput('EXPR_INPUT').setVisible(k === 'EXPR');
          if (this.rendered) {
            this.render();
            if (this.workspace) try { Blockly.svgResize(this.workspace); } catch(_) {}
          }
        };
        const kindField = this.getField('KIND');
        if(kindField && kindField.setValidator){ kindField.setValidator((v)=>{ setTimeout(update, 0); return v; }); }
        this.setOnChange(function(){ update(); });
        update();
      }
    };
  }
  if(!Blockly.Kotlin['npc_set_target']){
    Blockly.Kotlin['npc_set_target'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для setTarget\n`;
      const kind = block.getFieldValue('KIND');
      if(kind === 'PLAYER') return `${who} setTarget { player().first() }\n`;
      if(kind === 'NPC'){
        const tgt = block.getFieldValue('TARGET_NPC');
        if(tgt==='__NO_NPC__') return `// Нет целевого НИПа для setTarget\n`;
        return `${who} setTarget { ${tgt}() }\n`;
      }
      const expr = (block.getFieldValue('EXPR')||'player().first()').trim();
      return `${who} setTarget { ${expr} }\n`;
    };
  }
  if(!Blockly.Blocks['npc_clear_target']){
    Blockly.Blocks['npc_clear_target'] = {
      init: function(){
        this.appendDummyInput().appendField('НИП')
          .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
          .appendField('перестать атаковать цель');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#06b6d4');
        this.setTooltip('<npcID>.clearTarget()');
      }
    };
  }
  if(!Blockly.Kotlin['npc_clear_target']){
    Blockly.Kotlin['npc_clear_target'] = function(block){
      const who = block.getFieldValue('NPC');
      if(who==='__NO_NPC__') return `// Нет НИПа для clearTarget\n`;
      return `${who}.clearTarget()\n`;
    };
  }

  // Телепорт игрока: players.tpTo { pos = pos(x,y,z); vec = vec(pitch,yaw); world = "..." }
  if(!Blockly.Blocks['players_tp_to']){
    Blockly.Blocks['players_tp_to'] = {
      init: function(){
        this.appendDummyInput().appendField('Игроки: телепорт');
        this.appendDummyInput().appendField('x').appendField(new Blockly.FieldNumber(0), 'X')
          .appendField('y').appendField(new Blockly.FieldNumber(64), 'Y')
          .appendField('z').appendField(new Blockly.FieldNumber(0), 'Z');
        this.appendDummyInput().appendField('pitch').appendField(new Blockly.FieldNumber(0, -90, 90, 1), 'PITCH')
          .appendField('yaw').appendField(new Blockly.FieldNumber(0, -180, 180, 1), 'YAW');
        this.appendDummyInput().appendField('мир').appendField(new Blockly.FieldTextInput('overworld'), 'WORLD');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#ef4444');
        this.setTooltip('<players>.tpTo { pos = pos(x,y,z) ; vec = vec(pitch,yaw) ; world = "<dimension_id>" }');
      }
    };
  }
  if(!Blockly.Kotlin['players_tp_to']){
    Blockly.Kotlin['players_tp_to'] = function(block){
      const x = Number(block.getFieldValue('X')||0);
      const y = Number(block.getFieldValue('Y')||64);
      const z = Number(block.getFieldValue('Z')||0);
      const pitch = Number(block.getFieldValue('PITCH')||0);
      const yaw = Number(block.getFieldValue('YAW')||0);
      const world = (block.getFieldValue('WORLD')||'overworld').replace(/\\/g,'\\\\').replace(/\"/g,'\\"');
      return `player.tpTo {\n  pos = pos(${x}, ${y}, ${z})\n  vec = vec(${pitch}, ${yaw})\n  world = "${world}"\n}\n`;
    };
  }

  // Инвентарь игроков: сохранить/загрузить/очистить
  if(!Blockly.Blocks['players_inventory']){
    Blockly.Blocks['players_inventory'] = {
      init: function(){
        this.appendDummyInput().appendField('Игроки: инвентарь')
          .appendField(new Blockly.FieldDropdown([["сохранить","SAVE"],["загрузить","LOAD"],["очистить","CLEAR"]]), 'ACT');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#ef4444');
        this.setTooltip('Сохранение/Загрузка/Очистка инвентаря игроков');
      }
    };
  }
  if(!Blockly.Kotlin['players_inventory']){
    Blockly.Kotlin['players_inventory'] = function(block){
      const act = block.getFieldValue('ACT');
      if(act==='SAVE') return `player.saveInventory()\n`;
      if(act==='LOAD') return `player.loadInventory()\n`;
      return `player.clearInventory()\n`;
    };
  }

  // Команда Minecraft через execute{"/command ..."}
  if(!Blockly.Blocks['mc_command']){
    Blockly.Blocks['mc_command'] = {
      init: function(){
        this.appendDummyInput().appendField('команда Minecraft')
          .appendField(new Blockly.FieldTextInput('/say Привет'), 'CMD');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#ef4444');
        this.setTooltip('execute{"/<команда>"} — кавычки будут экранированы');
      }
    };
  }
  if(!Blockly.Kotlin['mc_command']){
    Blockly.Kotlin['mc_command'] = function(block){
      const cmd = (block.getFieldValue('CMD')||'').replace(/\\/g,'\\\\').replace(/\"/g,'\\"');
      return `execute{"${cmd}"}\n`;
    };
  }

  // Варианты звуков из ресурсов проекта как ResourceLocation
  function getSoundOptionsAsResLoc(){
    try {
      const prj = AutoHE.getProject(projectId);
      const res = prj && prj.resources ? prj.resources : { sounds: [] };
      const sounds = Array.isArray(res.sounds) ? res.sounds : [];
      const toSafe = (s)=> String(s||'').toLowerCase().replace(/[^a-z0-9_]/g,'_');
      const opts = sounds.map(s => {
        const base = toSafe(s.name);
        const ext = (s.ext||'ogg').toLowerCase();
        const rl = `autohe:sounds/${base}.${ext}`;
        return [rl, rl];
      });
      return opts.length ? [["— выбрать из ресурсов —", "__NONE__"], ...opts] : [["— звуки не добавлены —", "__NONE__"]];
    } catch(_) { return [["— звуки не добавлены —", "__NONE__"]]; }
  }

  function ensureResourceLocation(value, defaultNs = 'autohe'){
    const v = String(value||'').trim().toLowerCase();
    let ns = defaultNs, path = '';
    if(v.includes(':')){ const parts = v.split(':'); ns = parts.shift() || defaultNs; path = parts.join(':'); }
    else { path = v; }
    ns = ns.replace(/[^a-z0-9_]/g, '_');
    // В пути разрешим a-z0-9_ / .
    path = path.replace(/[^a-z0-9_\/\.]/g, '_').replace(/\/+/, '/');
    if(!path){ path = 'sounds/sound.ogg'; }
    return `${ns}:${path}`;
  }

  // Воспроизведение звука: playSound { sound = "name"; volume = 1f; pitch = 1f; pos = pos(x,y,z) }
  if(!Blockly.Blocks['play_sound']){
    Blockly.Blocks['play_sound'] = {
      init: function(){
        this.appendDummyInput().appendField('воспроизвести звук');
        const block = this;
        this.appendDummyInput()
          .appendField('ресурс (ResourceLocation)')
          .appendField(new Blockly.FieldTextInput('autohe:sounds/bell.ogg', (val)=> ensureResourceLocation(val)), 'SOUND');
        this.appendDummyInput()
          .appendField('из ассетов')
          .appendField(new Blockly.FieldDropdown(()=> getSoundOptionsAsResLoc(), function(val){ if(val && val !== '__NONE__'){ try{ block.setFieldValue(val, 'SOUND'); }catch(_){} } return '__NONE__'; }), 'SOUND_PICK');
        this.appendDummyInput()
          .appendField('громкость (по умолчанию 1.0)')
          .appendField(new Blockly.FieldNumber(1, 0, 100, 0.1), 'VOLUME');
        this.appendDummyInput()
          .appendField('высота тона (по умолчанию 1.0)')
          .appendField(new Blockly.FieldNumber(1, 0.1, 4.0, 0.1), 'PITCH');
        this.appendDummyInput('POS_ROW')
          .appendField('позиция (необязательно) x')
          .appendField(new Blockly.FieldNumber(0), 'X')
          .appendField('y')
          .appendField(new Blockly.FieldNumber(64), 'Y')
          .appendField('z')
          .appendField(new Blockly.FieldNumber(0), 'Z');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#ef4444');
        this.setTooltip('playSound { sound = "<name>"; volume = <float>; pitch = <float>; pos = pos(x,y,z) }');
      }
    };
  }
  if(!Blockly.Kotlin['play_sound']){
    Blockly.Kotlin['play_sound'] = function(block){
      const name = (block.getFieldValue('SOUND')||'').trim().replace(/\\/g,'\\\\').replace(/\"/g,'\\"');
      const volume = Number(block.getFieldValue('VOLUME'));
      const pitch = Number(block.getFieldValue('PITCH'));
      const x = Number(block.getFieldValue('X'));
      const y = Number(block.getFieldValue('Y'));
      const z = Number(block.getFieldValue('Z'));
      const hasPos = [x,y,z].some(v => typeof v === 'number' && !Number.isNaN(v));
      const volPart = Number.isFinite(volume) && volume !== 1 ? `\n  volume = ${volume}f` : '';
      const pitchPart = Number.isFinite(pitch) && pitch !== 1 ? `\n  pitch = ${pitch}f` : '';
      const posPart = hasPos ? `\n  pos = pos(${x}, ${y}, ${z})` : '';
      return `playSound {\n  sound = "${name}"${volPart}${pitchPart}${posPart}\n}\n`;
    };
  }

  // Новые блоки для затемнения и осветления экрана
  Blockly.Blocks['fade_in'] = {
    init: function(){
      this.appendDummyInput().appendField('затемнить экран');
      this.appendDummyInput()
        .appendField('большой текст')
        .appendField(new Blockly.FieldTextInput(''), 'TEXT');
      this.appendDummyInput()
        .appendField('малый текст')
        .appendField(new Blockly.FieldTextInput(''), 'SUBTITLE');
      this.appendDummyInput()
        .appendField('цвет')
        .appendField(new Blockly.FieldTextInput('000000'), 'COLOR');
      this.appendDummyInput()
        .appendField('время')
        .appendField(new Blockly.FieldNumber(5, 0, 3600, 1), 'TIME')
        .appendField('сек');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#ef4444');
    }
  };
  Blockly.Kotlin['fade_in'] = function(block){
    const text = block.getFieldValue('TEXT') || '';
    const subtitle = block.getFieldValue('SUBTITLE') || '';
    const color = (block.getFieldValue('COLOR') || '000000').replace('#', '');
    const time = Number(block.getFieldValue('TIME') || 5);
    return `fadeIn {\n  text = "${text}"\n  subtitle = "${subtitle}"\n  color = 0x${color}\n  time = ${time}.sec\n}\n`;
  };

  Blockly.Blocks['fade_out'] = {
    init: function(){
      this.appendDummyInput().appendField('осветлить экран');
      this.appendDummyInput()
        .appendField('большой текст')
        .appendField(new Blockly.FieldTextInput(''), 'TEXT');
      this.appendDummyInput()
        .appendField('малый текст')
        .appendField(new Blockly.FieldTextInput(''), 'SUBTITLE');
      this.appendDummyInput()
        .appendField('цвет')
        .appendField(new Blockly.FieldTextInput('000000'), 'COLOR');
      this.appendDummyInput()
        .appendField('время')
        .appendField(new Blockly.FieldNumber(5, 0, 3600, 1), 'TIME')
        .appendField('сек');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#ef4444');
    }
  };
  Blockly.Kotlin['fade_out'] = function(block){
    const text = block.getFieldValue('TEXT') || '';
    const subtitle = block.getFieldValue('SUBTITLE') || '';
    const color = (block.getFieldValue('COLOR') || '000000').replace('#', '');
    const time = Number(block.getFieldValue('TIME') || 5);
    return `fadeOut {\n  text = "${text}"\n  subtitle = "${subtitle}"\n  color = 0x${color}\n  time = ${time}.sec\n}\n`;
  };

  // Блок для настройки бессмертия NPC
  Blockly.Blocks['npc_invulnerable'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('сделать')
        .appendField(new Blockly.FieldDropdown([['бессмертным', 'true'], ['смертным', 'false']]), 'STATE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#f97316');
    }
  };
  Blockly.Kotlin['npc_invulnerable'] = function(block){
    const who = block.getFieldValue('NPC');
    const state = block.getFieldValue('STATE');
    if(who==='__NO_NPC__') return `// Нет НИПа для настройки бессмертия\n`;
    return `${who}.invulnerable = ${state}\n`;
  };

  // Блок для настройки хитбокса NPC
  Blockly.Blocks['npc_hitbox'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('хитбокс')
        .appendField(new Blockly.FieldDropdown([
          ['блокирующий', 'BLOCKING'], 
          ['толкающий', 'PULLING'], 
          ['пустой', 'EMPTY']
        ]), 'MODE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#f97316');
    }
  };
  Blockly.Kotlin['npc_hitbox'] = function(block){
    const who = block.getFieldValue('NPC');
    const mode = block.getFieldValue('MODE');
    if(who==='__NO_NPC__') return `// Нет НИПа для настройки хитбокса\n`;
    return `${who}.hitboxMode = HitboxMode.${mode}\n`;
  };

  // Блок для настройки силы атаки NPC
  Blockly.Blocks['npc_attack_damage'] = {
    init: function(){
      this.appendDummyInput().appendField('НИП')
        .appendField(new Blockly.FieldDropdown(() => getNpcIdOptions()), 'NPC')
        .appendField('сила атаки')
        .appendField(new Blockly.FieldNumber(1, 0, 2048, 0.1), 'DAMAGE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#f97316');
    }
  };
  Blockly.Kotlin['npc_attack_damage'] = function(block){
    const who = block.getFieldValue('NPC');
    const damage = Number(block.getFieldValue('DAMAGE') || 1);
    if(who==='__NO_NPC__') return `// Нет НИПа для настройки силы атаки\n`;
    return `${who}.configure {\n  generic.attack_damage = ${damage}\n}\n`;
  };

  // Диалог с неограниченным числом выборов (динамический без Mutator: поле COUNT)
  (function(){
    if(!Blockly.Blocks['dialog_choices']){
      Blockly.Blocks['dialog_choices'] = {
        init: function(){
          this.appendDummyInput().appendField('диалог: выборы');
          this.appendDummyInput('COUNT_ROW')
            .appendField('вариантов')
            .appendField(new Blockly.FieldNumber(2, 1, 10, 1), 'COUNT');
          this.setPreviousStatement(true, null); this.setNextStatement(true, null);
          this.setColour('#f59e0b');
          this.choiceCount_ = 2;
          const countField = this.getField('COUNT');
          if(countField && countField.setValidator){
            countField.setValidator((v)=>{ const n = Math.max(1, Math.min(10, parseInt(v||'2',10))); this.choiceCount_ = n; setTimeout(()=>this.updateShape_(), 0); return String(n); });
          }
          this.updateShape_();
        },
        saveExtraState: function(){ return { choices: this.choiceCount_ }; },
        loadExtraState: function(state){ this.choiceCount_ = Math.max(1, state && state.choices || 2); const f=this.getField('COUNT'); if(f) f.setValue(String(this.choiceCount_)); this.updateShape_(); },
        updateShape_: function(){
          // Сохраняем текущие значения полей и подключённые блоки перед перестройкой
          const preservedTexts = {};
          const preservedChildren = {};
          let idx = 0;
          while (this.getInput('CHOICE_ROW_'+idx) || this.getInput('SCRIPT_'+idx)) {
            const textField = this.getField('OPT_'+idx);
            if (textField) preservedTexts[idx] = textField.getValue();
            const scriptInput = this.getInput('SCRIPT_'+idx);
            if (scriptInput && scriptInput.connection) {
              const child = scriptInput.connection.targetBlock && scriptInput.connection.targetBlock();
              if (child) preservedChildren[idx] = child;
            }
            if (this.getInput('CHOICE_ROW_'+idx)) this.removeInput('CHOICE_ROW_'+idx);
            if (this.getInput('SCRIPT_'+idx)) this.removeInput('SCRIPT_'+idx);
            idx++;
          }
          // Добавляем заново, восстанавливая значения и вложенные блоки, если были
          for (let i = 0; i < this.choiceCount_; i++) {
            const defaultText = (i === 0 ? 'Да' : (i === 1 ? 'Нет' : ''));
            const value = Object.prototype.hasOwnProperty.call(preservedTexts, i) ? preservedTexts[i] : defaultText;
            this.appendDummyInput('CHOICE_ROW_'+i)
              .appendField('вариант '+(i+1)+':')
              .appendField(new Blockly.FieldTextInput(value), 'OPT_'+i);
            this.appendStatementInput('SCRIPT_'+i).setCheck(null).appendField('выполнить:');
            if (Object.prototype.hasOwnProperty.call(preservedChildren, i)) {
              try {
                const childBlock = preservedChildren[i];
                const newInput = this.getInput('SCRIPT_'+i);
                if (newInput && newInput.connection && childBlock && childBlock.previousConnection) {
                  newInput.connection.connect(childBlock.previousConnection);
                }
              } catch(_) {}
            }
          }
        }
      };
    }
    if(!Blockly.Kotlin['dialog_choices']){
      Blockly.Kotlin['dialog_choices'] = function(block){
        const n = parseInt(block.getFieldValue('COUNT')||block.choiceCount_||2, 10);
        const opts = []; const bodies = [];
        for(let i=0;i<n;i++){
          const raw = (block.getFieldValue('OPT_'+i)||'').trim();
          if(!raw) continue;
          const esc = raw.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"');
          opts.push(esc);
          bodies.push(collectStatementInput(block, 'SCRIPT_'+i));
        }
        const limitedOpts = opts.slice(0,3);
        const limitedBodies = bodies.slice(0,3);
        let code = '';
        // Прокидываем настройки проекта (цвета и префикс для выборов)
        const prj = AutoHE.getProject(projectId) || { settings: {} };
        const qColor = (prj.settings && prj.settings.choicesQuestionColor) || '#ffffff';
        const oColor = (prj.settings && prj.settings.choicesOptionColor) || '#ffffff';
        const qInt = '0x' + String(qColor||'#ffffff').replace('#','').toUpperCase();
        const oInt = '0x' + String(oColor||'#ffffff').replace('#','').toUpperCase();
        const oPrefix = (prj.settings && prj.settings.choicesOptionPrefix) || '> ';
        code += 'choiceMenu(\n';
        code += '  question = "Сделайте выбор",\n';
        code += '  options = listOf(\n';
        for(let i=0;i<limitedOpts.length;i++){
          code += `    ChoiceOption(\"${limitedOpts[i]}\"){ \n${limitedBodies[i]||''}    }${i<limitedOpts.length-1?',':''}\n`;
        }
        const bg = (prj.settings && prj.settings.choicesBackgroundTexture) || 'autohe:textures/cyber_bg.png';
        code += '  ),\n';
        code += `  settings = ChoiceMenuSettings(${qInt}, ${oInt}, \"${oPrefix.replace(/\\/g,'\\\\').replace(/\"/g,'\\\"')}\", \"${bg}\"),\n`;
        code += '  npc = null\n';
        code += ')\n';
        return code;
      };
    }
  })();

  const workspace = Blockly.inject('blocklyDiv', {
    toolbox,
    theme,
    zoom: { controls: true, wheel: true },
    renderer: 'thrasos',
    trashcan: true,
    move: { scrollbars: true, wheel: true, drag: true },
    toolboxPosition: 'start'
  });
  // Принудительно обновим тулбокс на случай, если он не подхватился из JSON-объекта
  try { if(workspace && workspace.updateToolbox) workspace.updateToolbox(toolbox); } catch(_) {}
  // Повторим обновление на следующий тик
  try { setTimeout(()=>{ if(workspace && workspace.updateToolbox) workspace.updateToolbox(toolbox); }, 0); } catch(_) {}
  // Еще одно обновление через 100мс для гарантии загрузки всех блоков
  try { setTimeout(()=>{ if(workspace && workspace.updateToolbox) workspace.updateToolbox(toolbox); }, 100); } catch(_) {}

  // Патчим устаревший метод чтобы убрать предупреждение
  if(!workspace.getAllVariables){
    workspace.getAllVariables = function(){
      try { return this.getVariableMap().getAllVariables(); } catch(_) { return []; }
    };
  }
  // Подмена на уровне прототипов, чтобы внешние вызовы не триггерили предупреждение
  try {
    if(Blockly.Workspace && Blockly.Workspace.prototype){
      Blockly.Workspace.prototype.getAllVariables = function(){
        try { return this.getVariableMap().getAllVariables(); } catch(_) { return []; }
      };
    }
    if(Blockly.WorkspaceSvg && Blockly.WorkspaceSvg.prototype){
      Blockly.WorkspaceSvg.prototype.getAllVariables = function(){
        try { return this.getVariableMap().getAllVariables(); } catch(_) { return []; }
      };
    }
  } catch(_) {}
  // Точечно подавим предупреждение про getAllVariables, если Blockly его кидает внутри
  try {
    if(Blockly.utils && Blockly.utils.deprecation && typeof Blockly.utils.deprecation.warn === 'function'){
      const _origDepWarn = Blockly.utils.deprecation.warn;
      Blockly.utils.deprecation.warn = function(message){
        if(String(message||'').includes('getAllVariables')) return; // игнор только для этого сообщения
        return _origDepWarn.apply(this, arguments);
      };
    }
  } catch(_){ }

  // Загрузка состояния: сначала JSON (новый API) или ссылка на IndexedDB, fallback — XML
  if(script.blocksState){
    try {
      if (script.blocksState === '__IDXDB__') {
        // Храним крупное состояние в IndexedDB
        (async ()=>{
          try{
            const raw = await AutoHE.getBlocksState(scriptId);
            if (raw) {
              const state = JSON.parse(raw);
              Blockly.serialization.workspaces.load(state, workspace);
            }
          } catch(err){ console.warn('Failed to load blocksState from IndexedDB', err); }
        })();
      } else {
        const state = JSON.parse(script.blocksState);
        Blockly.serialization.workspaces.load(state, workspace);
      }
    } catch(e){ console.warn('Invalid blocks state JSON', e); }
  } else if(script.blocksXml){
    try {
      if(Blockly.utils && Blockly.utils.xml && Blockly.utils.xml.textToDom && Blockly.Xml && Blockly.Xml.domToWorkspace){
        const dom = Blockly.utils.xml.textToDom(script.blocksXml);
        Blockly.Xml.domToWorkspace(dom, workspace);
      } else {
        console.warn('XML API not available in this Blockly build, skipping XML load');
      }
    } catch(e){ console.warn('Invalid blocks XML', e); }
  } else {
    const start = workspace.newBlock('trigger_entry_point');
    start.initSvg(); start.render();
  }

  // Принудительное первичное обновление предпросмотра и сохранение
  try { setTimeout(() => { try { updateAndSave(); } catch(e){ console.warn('Initial update failed', e); } }, 0); } catch(_){}

  // Перевод контекстного меню Blockly на русский
  try {
    Object.assign(Blockly.Msg, {
      DUPLICATE_BLOCK: 'Дублировать',
      ADD_COMMENT: 'Добавить комментарий',
      REMOVE_COMMENT: 'Удалить комментарий',
      EXTERNAL_INPUTS: 'Многострочные вводы',
      INLINE_INPUTS: 'В одну строку',
      DELETE_BLOCK: 'Удалить блок',
      DELETE_X_BLOCKS: 'Удалить %1 блок(ов)',
      COLLAPSE_BLOCK: 'Свернуть блок',
      EXPAND_BLOCK: 'Развернуть блок',
      DISABLE_BLOCK: 'Отключить блок',
      ENABLE_BLOCK: 'Включить блок',
      HELP: 'Справка',
      UNDO: 'Отменить',
      REDO: 'Повторить',
      CLEAN_UP: 'Упорядочить блоки',
      COLLAPSE_ALL: 'Свернуть все блоки',
      EXPAND_ALL: 'Развернуть все блоки',
      DELETE_ALL: 'Удалить все блоки (%1)?'
    });
  } catch(_){ }

  async function updateAndSave(){
    const topBlocks = workspace.getTopBlocks(true);
    let headers = '';
    let body = '';
    topBlocks.forEach(block => {
      const gen = generateKotlinFromBlock(block);
      headers += gen.headers || '';
      body += gen.code || '';
    });
    let code = (headers ? headers + '\n' : '') + body;
    // Собираем импорты скриптов (автоматически)
    const importScriptMatches = [];

    const needsPlayer = /\bplayer\(\)|\bplayers\.|\bplayer\./.test(code);
    const needsStoryEventsImport = /\bnameComp(?:PlayerBy|Player|Npc)\s*\(/.test(code);
    const needsFixerImport = /\bfmoveTo\s*\(|\bfdestroyBlock\b|\bfuseBlock\b/.test(code);
    const needsBlockImport = /\bwait(?:Left|Right)BlockInteract\s*\(/.test(code);
    const needsItemImport = /\bwaitItemCount\s*\(/.test(code);

    const allHeaderLines = (headers||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const triggerHeaders = new Set(allHeaderLines.filter(l => l.startsWith('@file:') && !l.startsWith('@file:Import(')));

    const importHeaders = new Set();
    if(needsStoryEventsImport) importHeaders.add('@file:Import("storyevents.mod.kts")');
    if(needsFixerImport) importHeaders.add('@file:Import("he_fixer.kts")');
    if(needsBlockImport) importHeaders.add('@file:Import("block.kts")');
    if(needsItemImport) importHeaders.add('@file:Import("item.kts")');
    // Автоимпорт пресета меню, если используется choiceMenu
    if(/\bchoiceMenu\s*\(/.test(code)) importHeaders.add('@file:Import("choice_menu.kts")');
    importScriptMatches.forEach(path => {
      // Если пользователь импортирует сам себя — игнор
      try{
        const prj = AutoHE.getProject(projectId);
        const self = prj && prj.scripts && prj.scripts.find(s => s.id === scriptId);
        const selfBase = self ? (self.name + typeExt(self.type)) : '';
        if(path === selfBase) return;
      }catch(_){ }
      importHeaders.add(`@file:Import("${path}")`);
    });

    let finalHeaders = [...importHeaders, ...triggerHeaders].join('\n');
    if(needsPlayer){ finalHeaders = finalHeaders ? finalHeaders + '\n' + 'val player by server.players' : 'val player by server.players'; }

    const finalCode = (finalHeaders ? finalHeaders + '\n\n' : '') + body;
    kotlinPreview.textContent = finalCode.trim();

    try {
      const state = Blockly.serialization.workspaces.save(workspace);
      const json = JSON.stringify(state);
      if (json.length > 200000) {
        try { await AutoHE.saveBlocksState(scriptId, json); script.blocksState = '__IDXDB__'; }
        catch(err){ console.warn('saveBlocksState failed, storing inline', err); script.blocksState = json; }
      } else {
        script.blocksState = json;
      }
    } catch(e){ console.warn('Serialization save failed', e); }
    try { script.blockCount = Array.isArray(workspace.getAllBlocks(false)) ? workspace.getAllBlocks(false).length : workspace.getAllBlocks(false).length; } catch(_) { /* noop */ }
    script.blocksXml = undefined;
    AutoHE.updateScript(projectId, script);
  }

  function generateKotlinFromBlock(block){
    const headerTriggers = ['trigger_entry_point','trigger_join_script','trigger_after_script','trigger_repeatable_script'];
    if(headerTriggers.includes(block.type)){
      // триггерная «шапка» + последующий код
      let headers = emitBlock(block);
      headers = headers || '';
      const nextCode = collectNext(block);
      return { headers, code: nextCode };
    }
    let code = emitBlock(block) + collectNext(block);
    return { code };
  }

  function emitBlock(block){
    try { if(block && typeof block.isEnabled === 'function' && !block.isEnabled()) return ''; } catch(_) {}
    switch(block.type){
      case 'trigger_entry_point': return Blockly.Kotlin['trigger_entry_point'](block);
      case 'trigger_join_script': return Blockly.Kotlin['trigger_join_script'](block);
      case 'trigger_after_script': return Blockly.Kotlin['trigger_after_script'](block);
      case 'trigger_repeatable_script': return Blockly.Kotlin['trigger_repeatable_script'](block);
      case 'trigger_keybind': return Blockly.Kotlin['trigger_keybind'](block);
      case 'trigger_npc_wait_interact': return Blockly.Kotlin['trigger_npc_wait_interact'](block);
      case 'trigger_players_input_any': return Blockly.Kotlin['trigger_players_input_any'](block);
      case 'trigger_players_input_text': return Blockly.Kotlin['trigger_players_input_text'](block);
      case 'trigger_players_input_list': return Blockly.Kotlin['trigger_players_input_list'](block);
      case 'trigger_players_wait_pos': return Blockly.Kotlin['trigger_players_wait_pos'](block);
      case 'trigger_wait_block_interact': return Blockly.Kotlin['trigger_wait_block_interact'](block);
      case 'trigger_wait_item_count': return Blockly.Kotlin['trigger_wait_item_count'](block);
      case 'kotlin_import_script': return Blockly.Kotlin['kotlin_import_script'](block);
      case 'trigger_await_condition': return Blockly.Kotlin['trigger_await_condition'](block);
      case 'wait_seconds': return Blockly.Kotlin['wait_seconds'](block);
      case 'create_npc': return Blockly.Kotlin['create_npc'](block);
      case 'dialog_tellraw': return Blockly.Kotlin['dialog_tellraw'](block);
      case 'dialog_notification': return Blockly.Kotlin['dialog_notification'](block);
      case 'camera_spline': return Blockly.Kotlin['camera_spline'](block);
      case 'camera_static': return Blockly.Kotlin['camera_static'](block);
      case 'camera_entity': return Blockly.Kotlin['camera_entity'](block);
      case 'stamina_off': return Blockly.Kotlin['stamina_off'](block);
      case 'stamina_on': return Blockly.Kotlin['stamina_on'](block);
      case 'stamina_setmax': return Blockly.Kotlin['stamina_setmax'](block);
      case 'stamina_add': return Blockly.Kotlin['stamina_add'](block);
      case 'stamina_sub': return Blockly.Kotlin['stamina_sub'](block);
      case 'stamina_setregen': return Blockly.Kotlin['stamina_setregen'](block);
      case 'quest_add': return Blockly.Kotlin['quest_add'](block);
      case 'quest_remove': return Blockly.Kotlin['quest_remove'](block);
      case 'quest_set_status': return Blockly.Kotlin['quest_set_status'](block);
      case 'quest_append': return Blockly.Kotlin['quest_append'](block);
      case 'quest_goal': return Blockly.Kotlin['quest_goal'](block);
      case 'kotlin_val': return Blockly.Kotlin['kotlin_val'](block);
      case 'kotlin_var': return Blockly.Kotlin['kotlin_var'](block);
      case 'kotlin_assign': return Blockly.Kotlin['kotlin_assign'](block);
      case 'kotlin_if': return Blockly.Kotlin['kotlin_if'](block);
      case 'kotlin_while': return Blockly.Kotlin['kotlin_while'](block);
      case 'kotlin_for_range': return Blockly.Kotlin['kotlin_for_range'](block);
      case 'kotlin_fun_def': return Blockly.Kotlin['kotlin_fun_def'](block);
      case 'kotlin_fun_call': return Blockly.Kotlin['kotlin_fun_call'](block);
      case 'kotlin_comment': return Blockly.Kotlin['kotlin_comment'](block);
      case 'kotlin_start_script': return Blockly.Kotlin['kotlin_start_script'](block);
      case 'npc_move_to': return Blockly.Kotlin['npc_move_to'](block);
      case 'npc_look_at': return Blockly.Kotlin['npc_look_at'](block);
      case 'npc_set_running': return Blockly.Kotlin['npc_set_running'](block);
      case 'npc_give_right_hand': return Blockly.Kotlin['npc_give_right_hand'](block);
      case 'npc_despawn': return Blockly.Kotlin['npc_despawn'](block);
      case 'npc_drop_item': return Blockly.Kotlin['npc_drop_item'](block);
      case 'npc_animation': return Blockly.Kotlin['npc_animation'](block);
      case 'npc_fdestroy_block': return Blockly.Kotlin['npc_fdestroy_block'](block);
      case 'npc_fuse_block': return Blockly.Kotlin['npc_fuse_block'](block);
      case 'npc_move_to_pos': return Blockly.Kotlin['npc_move_to_pos'](block);
      case 'npc_look_at_pos': return Blockly.Kotlin['npc_look_at_pos'](block);
      case 'npc_tp_to': return Blockly.Kotlin['npc_tp_to'](block);
      case 'npc_set_target': return Blockly.Kotlin['npc_set_target'](block);
      case 'npc_clear_target': return Blockly.Kotlin['npc_clear_target'](block);
      case 'npc_request_items': return Blockly.Kotlin['npc_request_items'](block);
      case 'quest_item_req': return Blockly.Kotlin['quest_item_req'](block);
      case 'npc_add_trade': return Blockly.Kotlin['npc_add_trade'](block);
      case 'npc_clear_trades_uses': return Blockly.Kotlin['npc_clear_trades_uses'](block);
      case 'npc_clear_trades': return Blockly.Kotlin['npc_clear_trades'](block);
      case 'npc_trades': return Blockly.Kotlin['npc_trades'](block);
      case 'async_simple': return Blockly.Kotlin['async_simple'](block);
      case 'async_define': return Blockly.Kotlin['async_define'](block);
      case 'async_resume': return Blockly.Kotlin['async_resume'](block);
      case 'async_stop': return Blockly.Kotlin['async_stop'](block);
      case 'async_join': return Blockly.Kotlin['async_join'](block);
      case 'players_tp_to': return Blockly.Kotlin['players_tp_to'](block);
      case 'players_inventory': return Blockly.Kotlin['players_inventory'](block);
      case 'mc_command': return Blockly.Kotlin['mc_command'](block);
      case 'play_sound': return Blockly.Kotlin['play_sound'](block);
      case 'fade_in': return Blockly.Kotlin['fade_in'](block);
      case 'fade_out': return Blockly.Kotlin['fade_out'](block);
      case 'npc_invulnerable': return Blockly.Kotlin['npc_invulnerable'](block);
      case 'npc_hitbox': return Blockly.Kotlin['npc_hitbox'](block);
      case 'dialog_choices': return Blockly.Kotlin['dialog_choices'](block);
      default: return '';
    }
  }
  function collectNext(block){
    let code = '';
    let next = block.getNextBlock();
    while(next){ code += emitBlock(next); next = next.getNextBlock(); }
    return code;
  }

  // Автосохранение с дебаунсом + сохранение Kotlin-кода
  function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }
  const debouncedUpdate = debounce(updateAndSave, 400);
  workspace.addChangeListener(Blockly.Events.disableOrphans);
  workspace.removeChangeListener(updateAndSave);
  workspace.addChangeListener(debouncedUpdate);
  window.addEventListener('beforeunload', () => { try { updateAndSave(); } catch(_){} });

  // Переопределение updateAndSave для записи кода и времени
  const _updateAndSaveOrig = updateAndSave;
  updateAndSave = function(){
    const topBlocks = workspace.getTopBlocks(true);
    let headers = '';
    let body = '';
    topBlocks.forEach(block => {
      const gen = generateKotlinFromBlock(block);
      headers += gen.headers || '';
      body += gen.code || '';
    });
    let code = (headers ? headers + '\n' : '') + body;

    const needsPlayer = /\bplayer\(\)|\bplayers\.|\bplayer\./.test(code);
    const needsStoryEventsImport = /\bnameComp(?:PlayerBy|Player|Npc)\s*\(/.test(code);
    const needsFixerImport = /\bfmoveTo\s*\(|\bfdestroyBlock\b|\bfuseBlock\b/.test(code);
    const needsBlockImport = /\bwait(?:Left|Right)BlockInteract\s*\(/.test(code);
    const needsItemImport = /\bwaitItemCount\s*\(/.test(code);

    const allHeaderLines = (headers||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const triggerHeaders = new Set(allHeaderLines.filter(l => l.startsWith('@file:') && !l.startsWith('@file:Import(')));

    const importHeaders = new Set();
    if(needsStoryEventsImport) importHeaders.add('@file:Import("storyevents.mod.kts")');
    if(needsFixerImport) importHeaders.add('@file:Import("he_fixer.kts")');
    if(needsBlockImport) importHeaders.add('@file:Import("block.kts")');
    if(needsItemImport) importHeaders.add('@file:Import("item.kts")');

    let finalHeaders = [...importHeaders, ...triggerHeaders].join('\n');
    if(needsPlayer){ finalHeaders = finalHeaders ? finalHeaders + '\n' + 'val player by server.players' : 'val player by server.players'; }

    const finalCode = (finalHeaders ? finalHeaders + '\n\n' : '') + body;
    kotlinPreview.textContent = finalCode.trim();

    try {
      const state = Blockly.serialization.workspaces.save(workspace);
      script.blocksState = JSON.stringify(state);
    } catch(e){ console.warn('Serialization save failed', e); }
    try { script.blockCount = Array.isArray(workspace.getAllBlocks(false)) ? workspace.getAllBlocks(false).length : workspace.getAllBlocks(false).length; } catch(_) { /* noop */ }
    script.kotlin = finalCode;
    script.updatedAt = new Date().toISOString();
    script.blocksXml = undefined;
    AutoHE.updateScript(projectId, script);
  };

  (function(){
    const saveBtn = document.getElementById('saveScriptBtn');
    const fmtBtn = document.getElementById('formatBtn');
    const refreshBtn = document.getElementById('refreshCodeBtn');
    if(saveBtn) saveBtn.onclick = () => { updateAndSave(); alert('Сохранено'); };
    if(fmtBtn) fmtBtn.onclick = updateAndSave;
    if(refreshBtn) refreshBtn.onclick = () => { try { updateAndSave(); } catch(e){ console.warn('Refresh failed', e); } };
  })();

  function escapeHtml(s){
    return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  const area = document.getElementById('blocklyArea');
  const div = document.getElementById('blocklyDiv');

  function onResize() {
    const rect = area.getBoundingClientRect();
    div.style.width = rect.width + 'px';
    div.style.height = rect.height + 'px';
    Blockly.svgResize(workspace);
  }
  window.addEventListener('resize', onResize);
  // Обновляем после инициализации
  setTimeout(onResize, 0);

  // Full-height layout calculation
  const header = document.querySelector('.app-header');
  const toolbar = document.querySelector('.editor-toolbar');
  const layout = document.querySelector('.editor-layout');
  function resizeEditorHeight(){
    const vh = window.innerHeight;
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const toolbarH = toolbar ? toolbar.getBoundingClientRect().height : 0;
    const target = Math.max(0, vh - headerH - toolbarH);
    layout.style.height = target + 'px';
    onResize();
  }
  function afterFontsLoaded(cb){
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(cb); } else { cb(); }
  }
  function rafResize(){ requestAnimationFrame(resizeEditorHeight); }
  window.addEventListener('orientationchange', rafResize);
  window.addEventListener('load', rafResize);
  afterFontsLoaded(rafResize);

  // Открытие категорий по наведению
  function attachHoverOpen(){
    try {
      const tbx = workspace.getToolbox && workspace.getToolbox();
      const rootDom = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
      if(!rootDom) return;
      const rows = rootDom.querySelectorAll('[role="treeitem"], .blocklyTreeRow, .blocklyToolboxCategory');
      rows.forEach(row => {
        if(row.__hoverOpenBound) return;
        row.__hoverOpenBound = true;
        const trigger = ()=>{ try { row.click && row.click(); } catch(_) {} };
        row.addEventListener('mouseenter', trigger, { passive:true });
        row.addEventListener('mousemove', trigger, { passive:true });
        row.addEventListener('click', trigger);
      });
      // Наблюдатель за изменениями DOM тулбокса
      if(!rootDom.__hoverObserver){
        rootDom.__hoverObserver = new MutationObserver(()=>{ try { attachHoverOpen(); } catch(_) {} });
        rootDom.__hoverObserver.observe(rootDom, { childList:true, subtree:true });
      }
    } catch(_) {}
  }
  attachHoverOpen();
  // Поиск отключён
  var SEARCH_CAT_NAME = 'Поиск';
  // updateSearchCategory('');

  function selectSearchCategory(){ return; }

  // Поиск по блокам: динамически наполняем категорию «Поиск»
  function flattenToolboxTypes(){
    const types = [];
    function walk(node){
      (node.contents||[]).forEach(it => {
        if(it.kind === 'category') walk(it);
        else if(it.kind === 'block' && it.type) types.push(it.type);
      });
    }
    walk(toolbox);
    return Array.from(new Set(types));
  }
  function getBlockTooltip(type){
    try {
      const def = Blockly.Blocks[type];
      const tt = def && def.tooltip;
      if(typeof tt === 'function') return String(tt()) || '';
      if(typeof tt === 'string') return tt;
    } catch(_) {}
    return '';
  }
  function updateSearchCategory(){ return; }

  // Периодическое автосохранение каждые 30 секунд
  let autoSaveInterval;
  function startAutoSave(){
    if(autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
      try {
        updateAndSave();
        console.log('🔄 Автосохранение выполнено');
        showAutoSaveIndicator();
      } catch(e) {
        console.warn('Ошибка автосохранения:', e);
      }
    }, 30000); // 30 секунд
  }
  
  // Индикатор автосохранения
  function showAutoSaveIndicator(){
    const indicator = document.createElement('div');
    indicator.textContent = '✓ Сохранено';
    indicator.style.cssText = `
      position: fixed; top: 80px; right: 20px; z-index: 1000;
      background: #22c55e; color: white; padding: 8px 16px;
      border-radius: 8px; font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease; opacity: 0; transform: translateY(-10px);
    `;
    document.body.appendChild(indicator);
    
    // Анимация появления
    setTimeout(() => {
      indicator.style.opacity = '1';
      indicator.style.transform = 'translateY(0)';
    }, 10);
    
    // Удаление через 2 секунды
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(-10px)';
      setTimeout(() => indicator.remove(), 300);
    }, 2000);
  }
  
  // Запуск автосохранения
  startAutoSave();
  
  workspace.addChangeListener(Blockly.Events.disableOrphans);
  workspace.removeChangeListener(updateAndSave);
  workspace.addChangeListener((event) => {
    // Сохраняем только при изменениях блоков, не при выборе
    if(event.type !== Blockly.Events.SELECTED) {
      debouncedUpdate();
    }
  });
  window.addEventListener('beforeunload', () => { try { updateAndSave(); } catch(_){} });
  
  // Очистка интервала при выходе
  window.addEventListener('beforeunload', () => { 
    if(autoSaveInterval) clearInterval(autoSaveInterval);
  });
  
  // Функция сбора всех NPC из проекта
  function getAllProjectNPCs(projectId) {
    const allNPCs = new Set();
    
    try {
      const project = AutoHE.getProject(projectId);
      console.log('🔍 Проект для поиска NPC:', project);
      console.log('🔍 ID проекта:', projectId);
      
      if (project && project.scripts) {
        console.log('📜 Найдено скриптов:', project.scripts.length);
        
        project.scripts.forEach((script, index) => {
          console.log(`📝 Обрабатываем скрипт ${index}:`, script.name);
          console.log(`📝 Скрипт ID:`, script.id);
          console.log(`📝 Скрипт имеет поля:`, Object.keys(script));
          
          // Проверяем blocksState (основное хранилище Blockly блоков)
          if (script && script.blocksState) {
            console.log(`📄 Скрипт ${script.name} имеет blocksState длиной:`, script.blocksState.length);
            
            try {
              // Парсим blocksState как JSON
              const scriptData = JSON.parse(script.blocksState);
              console.log(`✅ Скрипт ${script.name} - blocksState JSON:`, scriptData);
              console.log(`✅ Структура blocksState:`, Object.keys(scriptData));
              
              const searchBlocks = (obj, path = '') => {
                if (typeof obj === 'object' && obj !== null) {
                  // Логируем каждый найденный блок
                  if (obj.type) {
                    console.log(`🔍 Найден блок ${obj.type} по пути ${path}:`, obj);
                  }
                  
                  if (obj.type === 'create_npc') {
                    console.log(`🎯 Найден create_npc блок:`, obj);
                    console.log(`📝 Поля блока:`, obj.fields);
                    
                    if (obj.fields && obj.fields.NAME) {
                      console.log(`✅ Найден NPC с NAME: ${obj.fields.NAME}`);
                      allNPCs.add(obj.fields.NAME);
                    } else {
                      console.log(`❌ Блок create_npc без поля NAME`);
                    }
                  }
                  
                  // Рекурсивно ищем во всех свойствах
                  Object.entries(obj).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                      searchBlocks(value, `${path}.${key}`);
                    }
                  });
                }
              };
              
              searchBlocks(scriptData, 'blocksState');
            } catch (e) {
              console.warn(`❌ Ошибка парсинга blocksState скрипта ${script.name}:`, e);
            }
          }
          
          // Также проверяем старое поле script для совместимости
          else if (script && script.script) {
            console.log(`📄 Скрипт ${script.name} имеет script длиной:`, script.script.length);
            
            try {
              // Сначала пробуем парсить как JSON (Blockly блоки)
              const scriptData = JSON.parse(script.script);
              console.log(`✅ Скрипт ${script.name} - script JSON:`, scriptData);
              
              const searchBlocks = (obj, path = '') => {
                if (typeof obj === 'object' && obj !== null) {
                  if (obj.type === 'create_npc' && obj.fields && obj.fields.NAME) {
                    console.log(`✅ Найден NPC с NAME: ${obj.fields.NAME}`);
                    allNPCs.add(obj.fields.NAME);
                  }
                  
                  Object.entries(obj).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                      searchBlocks(value, `${path}.${key}`);
                    }
                  });
                }
              };
              
              searchBlocks(scriptData, 'script');
            } catch (e) {
              // Если не JSON, то это Kotlin код - парсим его
              console.log(`📝 Скрипт ${script.name} - это Kotlin код`);
              const kotlinCode = script.script;
              
              // Ищем паттерн: val <name> by NPCEntity.creating
              const npcPattern = /val\s+(\w+)\s+by\s+NPCEntity\.creating/g;
              let match;
              
              while ((match = npcPattern.exec(kotlinCode)) !== null) {
                const npcName = match[1];
                console.log(`🎯 Найден NPC в Kotlin: ${npcName}`);
                allNPCs.add(npcName);
              }
              
              // Также ищем name = "..." в NPCEntity.creating блоках
              const namePattern = /name\s*=\s*"([^"]+)"/g;
              while ((match = namePattern.exec(kotlinCode)) !== null) {
                const npcName = match[1];
                console.log(`🎯 Найден NPC по имени в Kotlin: ${npcName}`);
                allNPCs.add(npcName);
              }
            }
          } else {
            console.log(`❌ Скрипт ${script.name} не имеет содержимого`);
          }
        });
      } else {
        console.log('❌ Проект не имеет скриптов или project.scripts не определен');
      }
    } catch (e) {
      console.warn('❌ Ошибка сбора NPC:', e);
    }
    
    console.log('🎯 Итоговый список NPC:', [...allNPCs]);
    return [...allNPCs];
  }

  // Обработчик кнопки текстового редактора
  document.getElementById('textEditorBtn').addEventListener('click', () => {
    const btn = document.getElementById('textEditorBtn');
    const originalText = btn.textContent;
    
    try {
      // Показываем индикацию сохранения
      btn.textContent = '💾 Сохранение...';
      btn.disabled = true;
      
      // Автосохранение перед переходом
      updateAndSave();
      console.log('✅ Автосохранение выполнено перед переходом в текстовый редактор');
      
      // Используем те же параметры, что и основной редактор
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get('projectId');
      const scriptId = urlParams.get('scriptId');
      
      if (projectId && scriptId) {
        // Собираем всех NPC из проекта
        btn.textContent = '🔍 Сбор NPC...';
        const allNPCs = getAllProjectNPCs(projectId);
        console.log('🎯 Найденные NPC в проекте:', allNPCs);
        console.log('📊 Всего NPC найдено:', allNPCs.length);
        
        // Показываем успех и переходим
        btn.textContent = '✅ Переход...';
        
        // Передаём NPC через URL (кодируем в base64)
        const npcData = btoa(encodeURIComponent(JSON.stringify(allNPCs)));
        console.log('🔗 Закодированные NPC для URL:', npcData);
        console.log('🌐 URL для перехода:', `text-editor.html?projectId=${projectId}&scriptId=${scriptId}&npcs=${npcData}`);
        
        setTimeout(() => {
          window.location.href = `text-editor.html?projectId=${projectId}&scriptId=${scriptId}&npcs=${npcData}`;
        }, 200);
      } else {
        // Восстанавливаем кнопку при ошибке
        btn.textContent = originalText;
        btn.disabled = false;
        alert('Ошибка: не удалось определить проект или скрипт');
      }
    } catch (error) {
      console.warn('Ошибка автосохранения:', error);
      
      // Восстанавливаем кнопку
      btn.textContent = originalText;
      btn.disabled = false;
      
      // Переходим даже если сохранение не удалось
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get('projectId');
      const scriptId = urlParams.get('scriptId');
      
      if (projectId && scriptId) {
        if (confirm('Ошибка автосохранения. Перейти в текстовый редактор без сохранения?')) {
          const allNPCs = getAllProjectNPCs(projectId);
          const npcData = btoa(encodeURIComponent(JSON.stringify(allNPCs)));
          window.location.href = `text-editor.html?projectId=${projectId}&scriptId=${scriptId}&npcs=${npcData}`;
        }
      } else {
        alert('Ошибка: не удалось определить проект или скрипт');
      }
    }
  });

})();
  