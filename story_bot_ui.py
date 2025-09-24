import os
from typing import Optional

import gradio as gr
from openai import OpenAI


def get_client(api_key: Optional[str]):
    key = (api_key or os.getenv("OPENAI_API_KEY") or os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or "").strip()
    if not key:
        raise ValueError("Укажите API ключ (GitHub PAT) сверху в поле ввода.")
    return OpenAI(base_url="https://models.inference.ai.azure.com", api_key=key)


def build_system_role() -> str:
    return (
        "Ты — AutoHE Сценарист: профессиональный нарративный дизайнер для Minecraft-историй на движке HollowEngine. "
        "Твоя цель — быстро и чётко прорабатывать сюжетные арки, учитывая ввод пользователя.\n\n"
        "Обязательные правила оформления ответа:\n"
        "1) Формат вывода — только Markdown.\n"
        "2) Структура ответа:\n"
        "   - Заголовок сюжета (h2).\n"
        "   - Краткое описание (1-2 абзаца).\n"
        "   - Таблица с сериями: №, название серии, краткое описание (2-4 предложения).\n"
        "   - Ключевые персонажи: список с 1-2 предложениями на персонажа.\n"
        "   - Темы и тональность: маркированный список.\n"
        "3) Пиши на русском языке.\n"
        "4) Избегай спойлеров финала, если явно не просили раскрыть.\n"
        "5) Не генерируй код. Ты создаёшь нарратив.\n\n"
        "Критерии качества:\n"
        "- Названия ёмкие и запоминающиеся.\n"
        "- Серии связаны причинно-следственно, есть эскалация ставок.\n"
        "- Должны быть вариативные конфликты и поворотные точки.\n"
        "- Учитывай жанр и пожелания пользователя (сеттинг, атмосфера, запреты).\n"
    )


def build_user_prompt(hero: str, genre: str, episodes: int, wishes: str) -> str:
    return (
        f"Главный герой: {hero}\n"
        f"Жанр: {genre}\n"
        f"Количество серий: {episodes}\n"
        f"Пожелания: {wishes or '—'}\n\n"
        "Задача: придумай краткий сюжет для Minecraft-истории (AutoHE/HollowEngine).\n"
        "Нужно выдать: название сюжета, краткое описание, список серий (с названиями и краткими синопсисами), ключевых персонажей, темы и тон.\n"
        "Синопсисы серий должны логично развиваться и подводить к кульминации и финалу без раскрытия всех деталей."
    )


def generate(api_key: str, hero: str, genre: str, episodes: int, wishes: str) -> str:
    client = get_client(api_key)
    system_role = build_system_role()
    user_prompt = build_user_prompt(hero, genre, episodes, wishes)
    resp = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_role},
            {"role": "user", "content": user_prompt},
        ],
        model="gpt-4o",
        temperature=0.9,
        max_tokens=3000,
        top_p=1
    )
    content: Optional[str] = resp.choices[0].message.content if resp and resp.choices else None
    if not content:
        return "Ошибка: пустой ответ модели"
    return content


with gr.Blocks(title="AutoHE Сценарист 1.2") as demo:
    gr.Markdown("# AutoHE Сценарист — генератор сюжетов")
    gr.Markdown(
        "Введите данные и нажмите Сгенерировать. Ключ можно задать в поле ниже или через переменные окружения."
    )

    with gr.Row():
        api_key = gr.Textbox(label="API ключ (GitHub PAT)", type="password", placeholder="ghp_...")

    with gr.Row():
        hero = gr.Textbox(label="Имя главного героя", value="Алекс")
        genre = gr.Textbox(label="Жанр", value="Фэнтези-приключение")
        episodes = gr.Slider(label="Количество серий", minimum=1, maximum=20, step=1, value=5)

    wishes = gr.Textbox(label="Пожелания (опционально)", lines=3, placeholder="Атмосфера, сеттинг, запреты...")

    btn = gr.Button("Сгенерировать", variant="primary")
    out = gr.Markdown()

    btn.click(fn=generate, inputs=[api_key, hero, genre, episodes, wishes], outputs=[out])


if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1", server_port=7860)


