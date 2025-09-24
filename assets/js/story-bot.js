(() => {
  // Используем локальный прокси, чтобы избежать CORS и скрыть прямой вызов
  const endpoint = 'http://127.0.0.1:8787/api/generate';

  function systemRole(){
    return (
      'Ты — AutoHE Сценарист: профессиональный нарративный дизайнер для Minecraft-историй на движке HollowEngine. '
      + 'Твоя цель — быстро и чётко прорабатывать сюжетные арки, учитывая ввод пользователя.\n\n'
      + 'Обязательные правила оформления ответа:\n'
      + '1) Формат вывода — только Markdown.\n'
      + '2) Структура ответа:\n'
      + '   - Заголовок сюжета (h2).\n'
      + '   - Краткое описание (1-2 абзаца).\n'
      + '   - Таблица с сериями: №, название серии, краткое описание (2-4 предложения).\n'
      + '   - Ключевые персонажи: список с 1-2 предложениями на персонажа.\n'
      + '   - Темы и тональность: маркированный список.\n'
      + '3) Пиши на русском языке.\n'
      + '4) Избегай спойлеров финала, если явно не просили раскрыть.\n'
      + '5) Не генерируй код. Ты создаёшь нарратив.\n\n'
      + 'Критерии качества:\n'
      + '- Названия ёмкие и запоминающиеся.\n'
      + '- Серии связаны причинно-следственно, есть эскалация ставок.\n'
      + '- Должны быть вариативные конфликты и поворотные точки.\n'
      + '- Учитывай жанр и пожелания пользователя (сеттинг, атмосфера, запреты).\n'
    );
  }

  function buildUserPrompt(hero, genre, episodes, wishes){
    return (
      `Главный герой: ${hero}\n`+
      `Жанр: ${genre}\n`+
      `Количество серий: ${episodes}\n`+
      `Пожелания: ${wishes || '—'}\n\n`+
      'Задача: придумай краткий сюжет для Minecraft-истории (AutoHE/HollowEngine).\n'
      + 'Нужно выдать: название сюжета, краткое описание, список серий (с названиями и краткими синопсисами), ключевых персонажей, темы и тон.\n'
      + 'Синопсисы серий должны логично развиваться и подводить к кульминации и финалу без раскрытия всех деталей.'
    );
  }

  async function generate(){
    const apiKey = document.getElementById('apiKey').value.trim();
    const hero = document.getElementById('hero').value.trim();
    const genre = document.getElementById('genre').value.trim();
    const episodes = parseInt(document.getElementById('episodes').value, 10) || 5;
    const wishes = document.getElementById('wishes').value.trim();
    const status = document.getElementById('status');
    const out = document.getElementById('output');

    out.textContent = '';
    if(!apiKey){ status.textContent = 'Укажите API ключ'; return; }
    status.textContent = 'Генерация...';

    const body = {
      api_key: apiKey,
      hero,
      genre,
      episodes,
      wishes
    };

    try{
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if(!resp.ok){
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      const content = (data && data.content) || '';
      out.textContent = content || 'Пустой ответ модели';
      status.textContent = 'Готово';
    }catch(e){
      status.textContent = 'Ошибка';
      out.textContent = String(e && e.message || e || 'Unknown error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generateBtn');
    if(btn) btn.addEventListener('click', generate);
  });
})();


