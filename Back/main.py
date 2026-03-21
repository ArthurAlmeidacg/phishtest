from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import json
import os
import time
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

@app.get("/")
async def root():
    return {"status": "PhishGuard rodando"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Rate limiting ──────────────────────────────────────────────
LIMITE_RPM = 4
LIMITE_RPD = 18
MAX_CHARS = 1500

requisicoes_por_minuto = defaultdict(list)
contador_diario = {"total": 0, "data": time.strftime("%Y-%m-%d")}

def checar_limites(ip: str, tamanho_msg: int):
    agora = time.time()

    hoje = time.strftime("%Y-%m-%d")
    if contador_diario["data"] != hoje:
        contador_diario["total"] = 0
        contador_diario["data"] = hoje

    if contador_diario["total"] >= LIMITE_RPD:
        raise HTTPException(status_code=429, detail="Limite diário atingido. Tente novamente amanhã.")

    minuto_atras = agora - 60
    requisicoes_por_minuto[ip] = [t for t in requisicoes_por_minuto[ip] if t > minuto_atras]
    if len(requisicoes_por_minuto[ip]) >= LIMITE_RPM:
        raise HTTPException(status_code=429, detail="Muitas requisições. Aguarde 1 minuto e tente novamente.")

    if tamanho_msg > MAX_CHARS:
        raise HTTPException(status_code=400, detail=f"Mensagem muito longa. Máximo {MAX_CHARS} caracteres.")

    requisicoes_por_minuto[ip].append(agora)
    contador_diario["total"] += 1
# ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Você é um especialista em segurança digital focado em detectar phishing e fraudes. Analise a mensagem do usuário e responda APENAS com um JSON válido, sem texto adicional, sem markdown, sem blocos de código.

O JSON deve ter exatamente este formato:
{
  "verdict": "phishing" | "suspeito" | "seguro",
  "risk_score": 0-100,
  "title": "título curto do veredicto em português",
  "summary": "resumo em 1-2 frases explicando o resultado",
  "signals": ["sinal 1", "sinal 2", "sinal 3"],
  "recommendation": "recomendação prática de 2-3 frases para o usuário"
}

Critérios:
- "phishing": mensagem claramente fraudulenta, com urgência falsa, links suspeitos, pedidos de dados pessoais/bancários
- "suspeito": mensagem duvidosa mas sem certeza de fraude
- "seguro": mensagem legítima, sem sinais de fraude
- risk_score: 0 = completamente seguro, 100 = phishing confirmado
- signals: liste de 3 a 5 sinais específicos encontrados (ou ausência deles)
- recommendation: oriente o usuário sobre o que fazer com essa mensagem"""


class AnalyzeRequest(BaseModel):
    message: str


@app.post("/analyze")
async def analyze(request: Request, body: AnalyzeRequest):
    ip = request.client.host
    checar_limites(ip, len(body.message))

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": body.message}
            ]
        )

        text = response.choices[0].message.content.strip()
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        result = json.loads(text)
        return result

    except json.JSONDecodeError as e:
        print("ERRO JSON:", e)
        raise HTTPException(status_code=500, detail="Erro ao interpretar resposta da IA")

    except Exception as e:
        print("ERRO GROQ:", e)
        raise HTTPException(status_code=502, detail=f"Erro na API: {str(e)}")