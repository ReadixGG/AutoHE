import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from openai import OpenAI


class GenerateRequest(BaseModel):
    api_key: Optional[str]
    hero: str
    genre: str
    episodes: int
    wishes: Optional[str] = ""


def build_system_role() -> str:
    return (
        "Ты — AutoHE Сценарист: профессиональный нарративный дизайнер для Minecraft-историй на движке HollowEngine. "
        "Твоя цель — быстро и чётко прорабатывать сюжетные арки, учитывая ввод пользователя.\n\n"
        "Обязательные правила оформления ответа:\n"
        "1) Формат вывода — только Markdown.\n"
        "2) Структура ответа: заголовок, краткое описание, таблица серий, персонажи, темы/тон.\n"
        "3) Пиши на русском, без кода.\n"
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


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/generate")
def generate(req: GenerateRequest):
    api_key = (req.api_key or os.getenv("OPENAI_API_KEY") or os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")
    try:
        client = OpenAI(base_url="https://models.inference.ai.azure.com", api_key=api_key)
        resp = client.chat.completions.create(
            messages=[
                {"role": "system", "content": build_system_role()},
                {"role": "user", "content": build_user_prompt(req.hero, req.genre, req.episodes, req.wishes or "")},
            ],
            model="gpt-4o",
            temperature=0.9,
            max_tokens=3000,
            top_p=1
        )
        content: Optional[str] = resp.choices[0].message.content if resp and resp.choices else None
        return {"content": content or ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8787)


