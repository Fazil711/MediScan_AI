import os
import base64
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import httpx
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
from gtts import gTTS
import io

# Add this to your Pydantic Models section
class TTSRequest(BaseModel):
    text: str
    language: str

# Load environment variables
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

app = FastAPI(title="MediScan AI Backend")

# Allow React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update this to your React app's URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenRouter Configuration
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Using Gemini 1.5 Pro via OpenRouter as it supports both advanced reasoning and multimodal (vision) tasks
GEMINI_MODEL = "~google/gemini-flash-latest" 

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:8000", # Replace with your actual site URL
    "X-Title": "MediScan AI"
}

# --- Pydantic Models for JSON Requests ---
class InteractionRequest(BaseModel):
    medicines: List[str]

class TranslationRequest(BaseModel):
    text: str
    target_language: str

class ChatRequest(BaseModel):
    message: str
    context: str = ""

# --- Helper Functions ---
async def call_openrouter(messages: list) -> str:
    """Helper function to make asynchronous calls to OpenRouter API."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        payload = {
            "model": GEMINI_MODEL,
            "messages": messages
        }
        response = await client.post(OPENROUTER_URL, headers=HEADERS, json=payload)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
            
        data = response.json()
        return data["choices"][0]["message"]["content"]

def encode_image(file_bytes: bytes, content_type: str) -> str:
    """Encodes image bytes to a base64 data URI format expected by OpenRouter."""
    base64_str = base64.b64encode(file_bytes).decode('utf-8')
    return f"data:{content_type};base64,{base64_str}"

# --- API Endpoints ---

@app.post("/api/recognize-medicine")
async def recognize_medicine(image: UploadFile = File(...)):
    """
    POC 1: Core Module - Tablet Image Recognition
    Analyzes tablet shape, color, and packaging to identify medicine and return clinical data.
    """
    contents = await image.read()
    image_url = encode_image(contents, image.content_type)
    
    prompt = """
    You are an expert medical AI. Analyze this image of a medicine tablet, capsule, or strip.
    Identify the medicine and provide the following information in simple, plain language:
    1. Medicine Name
    2. What it treats (Purpose)
    3. How to take it (Dosage guidelines)
    4. Common side effects
    5. Precautions
    """
    
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image_url}}
        ]
    }]
    
    result = await call_openrouter(messages)
    return {"status": "success", "data": result}


@app.post("/api/check-interactions")
async def check_interactions(request: InteractionRequest):
    """
    POC 2: Safety Module - Drug Interaction Checker
    Flags dangerous combinations between multiple medicines.
    """
    if len(request.medicines) < 2:
        raise HTTPException(status_code=400, detail="Please provide at least two medicines to check interactions.")
    
    med_list = ", ".join(request.medicines)
    prompt = f"""
    You are a clinical pharmacist AI. The patient is taking the following medicines together: {med_list}.
    Check for any known drug interactions. Output your response in plain language.
    Clearly classify the safety level as: SAFE, CAUTION, or DANGEROUS.
    Provide specific guidance on why and what to do.
    """
    
    messages = [{"role": "user", "content": prompt}]
    result = await call_openrouter(messages)
    return {"status": "success", "data": result}


@app.post("/api/read-prescription")
async def read_prescription(image: UploadFile = File(...)):
    """
    POC 3: Accessibility Module - Prescription OCR Reader
    Digitizes handwritten/printed prescriptions and explains every medicine listed.
    """
    contents = await image.read()
    image_url = encode_image(contents, image.content_type)
    
    prompt = """
    You are a medical AI assistant. This is an image of a doctor's prescription or medical bill.
    1. Extract all the text from this image (OCR).
    2. Identify all the medicine names listed.
    3. Explain each medicine step-by-step in plain language (what it is, what it treats, how to take it).
    """
    
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image_url}}
        ]
    }]
    
    result = await call_openrouter(messages)
    return {"status": "success", "data": result}


@app.post("/api/translate")
async def translate_text(request: TranslationRequest):
    """
    POC 4: Inclusion Module - Multilingual Support
    Translates medicine summaries into native languages (e.g., Hindi, Marathi).
    """
    prompt = f"""
    Translate the following medical information into {request.target_language}.
    Ensure the translation is highly accurate, uses simple, conversational language suitable for elderly or rural patients, and retains all medical warnings clearly.
    
    Text to translate:
    {request.text}
    """
    
    messages = [{"role": "user", "content": prompt}]
    result = await call_openrouter(messages)
    return {"status": "success", "data": result}


@app.post("/api/chat")
async def chat_assistant(request: ChatRequest):
    """
    POC 5: Advanced Module - AI Chatbot
    Conversational assistant for follow-up medicine queries (e.g., missed doses, empty stomach).
    """
    system_prompt = "You are MediScan AI, a helpful and responsible medical assistant. Answer follow-up questions about the patient's medicines in simple language."
    
    user_prompt = f"Context about the patient's medicine: {request.context}\n\nPatient Question: {request.message}"
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    result = await call_openrouter(messages)
    return {"status": "success", "data": result}

@app.post("/api/speak")
async def generate_audio(request: TTSRequest):
    """
    POC 4: Voice Output
    Uses Google TTS to generate an MP3 audio file and streams it back to the frontend.
    """
    # Map frontend language names to Google TTS language codes
    # We use 'co.in' tld for English to give it an Indian accent
    lang_config = {
        "English": {"lang": "en", "tld": "co.in"},
        "Hindi": {"lang": "hi", "tld": "co.in"},
        "Marathi": {"lang": "mr", "tld": "co.in"}
    }
    
    config = lang_config.get(request.language, {"lang": "en", "tld": "co.in"})
    
    try:
        # Generate the audio
        tts = gTTS(text=request.text, lang=config["lang"], tld=config["tld"], slow=False)
        
        # Save it to an in-memory bytes buffer so we don't have to save files to the disk
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        
        # Return the audio file directly to the frontend
        return StreamingResponse(mp3_fp, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)