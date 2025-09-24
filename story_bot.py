import os
import sys
from typing import Optional

try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.prompt import Prompt, IntPrompt
    from rich.panel import Panel
except ImportError:
    print("Missing dependencies. Run: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    print("Missing OpenAI client. Run: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


console = Console()


def read_api_key() -> str:
    # Prefer env var; fallback to prompt for quick tests (do NOT hardcode tokens in code)
    key = os.getenv("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") or os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    if not key:
        key = Prompt.ask("Введите API ключ (GitHub PAT для Azure Inference)")
    return key.strip()


def build_system_role() -> str:
    # AutoHE Сценарист — подробная роль
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
        "4) Раскрывай всех и все, включая сеттинг мира.\n"
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
        "Задача: придумай краткий сюжет для истории.\n"
        "Нужно выдать: название сюжета, краткое описание, список серий (с названиями и краткими синопсисами), ключевых персонажей, темы и тон.\n"
        "Синопсисы серий должны логично развиваться и подводить к кульминации и финалу."
    )


def run_cli():
    console.print(Panel.fit("AutoHE Сценарист — генератор сюжетов", style="bold cyan"))
    hero = Prompt.ask("Имя главного героя", default="Алекс")
    genre = Prompt.ask("Жанр", default="Фэнтези-приключение")
    episodes = IntPrompt.ask("Количество серий", default=5)
    wishes = Prompt.ask("Пожелания (опционально)", default="")

    api_key = read_api_key()

    client = OpenAI(
        base_url="https://models.inference.ai.azure.com",
        api_key=api_key
    )

    system_role = build_system_role()
    user_prompt = build_user_prompt(hero, genre, episodes, wishes)

    console.print("\n[bold]Генерация сюжета...[/bold]\n")
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
        console.print("[red]Ошибка: пустой ответ модели[/red]")
        sys.exit(2)

    console.print(Markdown(content))


if __name__ == "__main__":
    try:
        run_cli()
    except KeyboardInterrupt:
        console.print("\n[red]Прервано пользователем[/red]")
        sys.exit(130)

