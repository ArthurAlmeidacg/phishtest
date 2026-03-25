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
    return {"status": "PhishDetector running"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://phishdetector-frontend.onrender.com",  
        "*" 
    ],
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*"],
    allow_credentials=False,
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Rate limiting ──────────────────────────────────────────────
LIMITE_RPM = 4
LIMITE_RPD = 18
MAX_CHARS = 1500

requests_per_minute = defaultdict(list)
daily_counter = {"total": 0, "data": time.strftime("%Y-%m-%d")}

def check_limits(ip: str, message_size: int):
    time_now = time.time()

    today = time.strftime("%Y-%m-%d")
    if daily_counter["data"] != today:
        daily_counter["total"] = 0
        daily_counter["data"] = today

    if daily_counter["total"] >= LIMITE_RPD:
        raise HTTPException(status_code=429, detail="Daily limit reached. Please try again tomorrow.")

    minute_ago = time_now - 60
    requests_per_minute[ip] = [t for t in requests_per_minute[ip] if t > minute_ago]
    if len(requests_per_minute[ip]) >= LIMITE_RPM:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait 1 minute and try again.")

    if message_size > MAX_CHARS:
        raise HTTPException(status_code=400, detail=f"Very long message. Maximum {MAX_CHARS} characters.")

    requests_per_minute[ip].append(time_now)
    daily_counter["total"] += 1
# ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a digital security expert focused on detecting phishing and fraud. Analyze the user's message and respond ONLY with valid JSON, without additional text, markdown, or code blocks.

The JSON must have exactly this format:
{
  "verdict": "phishing" | "suspect" | "safe",
  "risk_score": 0-100,
  "title": "Short title of the verdict in English.",
  "summary": "Summary in 1-2 sentences explaining the result.",
  "signals": ["signal 1", "signal 2", "signal 3"],
  "recommendation": "Practical recommendation of 2-3 sentences for the user."
}

Criteria:
- "phishing": a clearly fraudulent message, with false urgency, suspicious links, and requests for personal/banking information.
- "suspect": The message is dubious, but there's no certainty it's fraudulent.
- "safe": Legitimate message, with no signs of fraud.
- risk_score: 0 = completely safe, 100 = confirmed phishing
- signals: List 3 to 5 specific signs found (or the absence thereof).
- recommendation: Guide the user on what to do with this message."""


class AnalyzeRequest(BaseModel):
    message: str


@app.post("/analyze")
async def analyze(request: Request, body: AnalyzeRequest):
    ip = request.client.host
    check_limits(ip, len(body.message))

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
        raise HTTPException(status_code=500, detail="Error interpreting AI response.")

    except Exception as e:
        print("ERRO GROQ:", e)
        raise HTTPException(status_code=502, detail=f"API error: {str(e)}")
