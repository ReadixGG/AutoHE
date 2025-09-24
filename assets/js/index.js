(function(){
  const examples = [
    {
      id: 'demo_greeting',
      title: '🎮 Приветствие игрока',
      typeLabel: 'Сюжетный',
      blocks: [
        { cls: 'event', text: 'при первом входе в мир (EntryPoint)' },
        { cls: 'action', text: 'диалог: источник [Игрок] текст "Добро пожаловать!"' }
      ],
      desc: 'Простейший проект, который приветствует игрока при первом заходе.'
    },
    {
      id: 'demo_trader',
      title: '💰 Торговец в деревне',
      typeLabel: 'Сюжетный',
      blocks: [
        { cls: 'event', text: 'при входе в мир (JoinScript)' },
        { cls: 'action', text: 'создать НИП id villager01, модель villager, pos 0 64 0' },
        { cls: 'action', text: 'трейды: изумруд → хлеб' }
      ],
      desc: 'Создаёт НИПа-торговца и добавляет простую сделку.'
    },
    {
      id: 'demo_quest',
      title: '🧭 Квест на ресурсы',
      typeLabel: 'Сюжетный',
      blocks: [
        { cls: 'event', text: 'при входе в мир (JoinScript)' },
        { cls: 'action', text: 'НИП запросить предметы: +item("wood", 16)' }
      ],
      desc: 'Пример простого задания на сбор ресурсов.'
    }
  ];

  const grid = document.getElementById('examplesGrid');
  if(!grid) return;

  function render(){
    grid.innerHTML = '';
    examples.forEach(ex => {
      const el = document.createElement('div'); el.className = 'example-card card pop-in';
      el.innerHTML = `
        <div class="example-header">
          <h3>${ex.title}</h3>
          <span class="example-type">${ex.typeLabel}</span>
        </div>
        <div class="example-blocks">
          ${ex.blocks.map(b=>`<div class="block ${b.cls}">${b.text}</div>`).join('')}
        </div>
        <p class="example-desc">${ex.desc}</p>
        <div class="card-actions">
          <button class="btn btn-primary" data-import>Импортировать</button>
        </div>
      `;
      el.querySelector('[data-import]').onclick = ()=> importExample(ex);
      grid.appendChild(el);
    });
  }

  function stateDemoGreeting(){
    return {
      blocks: {
        blocks: [
          {
            type: 'trigger_entry_point', x: 25, y: 25,
            next: { block: {
              type: 'create_npc',
              fields: { ID: 'guide', NAME: 'Гид', MODEL_ID: '__NO_MODEL__', X: 0, Y: 64, Z: 0 },
              next: { block: {
                type: 'dialog_tellraw',
                fields: { SOURCE: 'guide', TEXT: 'Добро пожаловать на сервер!' },
                next: { block: {
                  type: 'wait_seconds', fields: { SECS: 2 },
                  next: { block: {
                    type: 'npc_set_running', fields: { NPC: 'guide', RUN: 'TRUE' },
                    next: { block: {
                      type: 'npc_move_to',
                      fields: { NPC: 'guide', MODE: 'ALWAYS', TARGET_KIND: 'PLAYER' },
                      next: { block: {
                        type: 'wait_seconds', fields: { SECS: 4 },
                        next: { block: {
                          type: 'npc_set_running', fields: { NPC: 'guide', RUN: 'FALSE' },
                          next: { block: {
                            type: 'npc_look_at',
                            fields: { NPC: 'guide', MODE: 'ALWAYS', TARGET_KIND: 'PLAYER' },
                            next: { block: {
                              type: 'dialog_tellraw', fields: { SOURCE: 'guide', TEXT: 'Следуй за мной!' },
                              next: { block: {
                                type: 'wait_seconds', fields: { SECS: 2 },
                                next: { block: {
                                  type: 'npc_look_at', fields: { NPC: 'guide', MODE: 'STOP', TARGET_KIND: 'PLAYER' },
                                  next: { block: {
                                    type: 'npc_move_to', fields: { NPC: 'guide', MODE: 'STOP', TARGET_KIND: 'PLAYER' }
                                  }}
                                }}
                              }}
                            }}
                          }}
                        }}
                      }}
                    }}
                  }}
                }}
              }}
            }}
          }
        ]
      }
    };
  }

  function stateDemoTrader(){
    return {
      blocks: {
        blocks: [
          {
            type: 'trigger_join_script', x: 25, y: 25,
            next: { block: {
              type: 'create_npc',
              fields: { ID: 'villager01', NAME: 'Торговец', MODEL_ID: '__NO_MODEL__', X: 0, Y: 64, Z: 0 },
              next: { block: {
                type: 'npc_move_to',
                fields: { NPC: 'villager01', MODE: 'ONCE', TARGET_KIND: 'POS', X: 5, Y: 64, Z: 5 },
                next: { block: {
                  type: 'npc_look_at', fields: { NPC: 'villager01', MODE: 'ALWAYS', TARGET_KIND: 'PLAYER' },
                  next: { block: {
                    type: 'dialog_tellraw', fields: { SOURCE: 'villager01', TEXT: 'Подходи! Лучшие предложения в округе!' },
                    next: { block: {
                      type: 'npc_trades',
                      fields: { NPC: 'villager01' },
                      inputs: {
                        OFFERS: {
                          shadow: { type: 'trade_offer', fields: {} },
                          block: {
                            type: 'trade_offer',
                            fields: {
                              P1_ID: 'minecraft:emerald', P1_CNT: 1, P1_NBT: '',
                              P2_ID: '', P2_CNT: 1, P2_NBT: '',
                              IT_ID: 'minecraft:bread', IT_CNT: 3, IT_NBT: '',
                              MAX: 24, XP: 1, PM: 0
                            },
                            next: { block: {
                              type: 'trade_offer',
                              fields: {
                                P1_ID: 'minecraft:emerald', P1_CNT: 5, P1_NBT: '',
                                P2_ID: '', P2_CNT: 1, P2_NBT: '',
                                IT_ID: 'minecraft:iron_sword', IT_CNT: 1, IT_NBT: '',
                                MAX: 12, XP: 5, PM: 0
                              }
                            }}
                          }
                        }
                      },
                      next: { block: {
                        type: 'dialog_tellraw', fields: { SOURCE: 'villager01', TEXT: 'Возвращайся ещё!' },
                        next: { block: {
                          type: 'wait_seconds', fields: { SECS: 2 },
                          next: { block: {
                            type: 'npc_look_at', fields: { NPC: 'villager01', MODE: 'STOP', TARGET_KIND: 'PLAYER' }
                          }}
                        }}
                      }}
                    }}
                  }}
                }}
              }}
            }}
          }
        ]
      }
    };
  }

  function stateDemoQuest(){
    return {
      blocks: {
        blocks: [
          {
            type: 'trigger_join_script', x: 25, y: 25,
            next: { block: {
              type: 'create_npc',
              fields: { ID: 'quest_giver', NAME: 'Квестодатель', MODEL_ID: '__NO_MODEL__', X: 0, Y: 64, Z: 0 },
              next: { block: {
                type: 'dialog_tellraw', fields: { SOURCE: 'quest_giver', TEXT: 'Принеси мне 16 брёвен дуба.' },
                next: { block: {
                  type: 'npc_request_items', fields: { NPC: 'quest_giver' },
                  inputs: {
                    REQS: {
                      shadow: { type: 'quest_item_req', fields: {} },
                      block: {
                        type: 'quest_item_req',
                        fields: { ITEM: 'minecraft:oak_log', COUNT: 16, NBT: '' }
                      }
                    }
                  },
                  next: { block: {
                    type: 'trigger_players_input_text', fields: { TEXT: 'готово' },
                    next: { block: {
                      type: 'dialog_tellraw', fields: { SOURCE: 'quest_giver', TEXT: 'Отличная работа! Награда твоя.' },
                      next: { block: {
                        type: 'npc_move_to', fields: { NPC: 'quest_giver', MODE: 'ONCE', TARGET_KIND: 'POS', X: 0, Y: 64, Z: 10 },
                        next: { block: {
                          type: 'wait_seconds', fields: { SECS: 1 },
                          next: { block: {
                            type: 'npc_despawn', fields: { NPC: 'quest_giver' }
                          }}
                        }}
                      }}
                    }}
                  }}
                }}
              }}
            }}
          }
        ]
      }
    };
  }

  function buildStateById(id){
    if(id === 'demo_greeting') return stateDemoGreeting();
    if(id === 'demo_trader') return stateDemoTrader();
    if(id === 'demo_quest') return stateDemoQuest();
    return null;
  }

  async function importExample(ex){
    const p = AutoHE.createProject(ex.title.replace(/^[^\p{L}\p{N}]+/u,'').slice(0,40));
    const script = AutoHE.addScript(p.id, 'story', 'main_story');
    const state = buildStateById(ex.id);
    if(state){ script.blocksState = JSON.stringify(state); }
    script.kotlin = `// demo: ${ex.id}`;
    AutoHE.updateScript(p.id, script);
    try{
      const resp = await fetch('assets/presets/classic.gltf');
      if(resp.ok){
        const blob = await resp.blob();
        const entry = AutoHE.addModel(p.id, { name: 'classic', ext: 'gltf', resourceId: '', animations: [] });
        try { await AutoHE.saveModelBlob(p.id, entry.id, blob); } catch(_){ }
      }
    } catch(_){ }
    AutoHE.go(`project.html?id=${p.id}`);
  }

  render();
})();