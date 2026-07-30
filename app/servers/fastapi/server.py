import argparse
import os
from pathlib import Path

import uvicorn
from dotenv import dotenv_values


def load_local_ai_env() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    allowed_keys = {
        "LLM",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "GOOGLE_API_KEY",
        "GOOGLE_MODEL",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_MODEL",
        "CUSTOM_LLM_API_KEY",
        "CUSTOM_LLM_URL",
        "CUSTOM_MODEL",
        "OLLAMA_URL",
        "OLLAMA_MODEL",
        "IMAGE_PROVIDER",
        "PEXELS_API_KEY",
        "PIXABAY_API_KEY",
        "DISABLE_IMAGE_GENERATION",
        "TOOL_CALLS",
        "DISABLE_THINKING",
        "EXTENDED_REASONING",
        "WEB_GROUNDING",
        "DALL_E_3_QUALITY",
        "GPT_IMAGE_1_5_QUALITY",
    }

    for key, value in dotenv_values(env_path).items():
        if key in allowed_keys and value:
            os.environ.setdefault(key, value)


load_local_ai_env()
from api.main import app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the FastAPI server")
    parser.add_argument(
        "--port", type=int, required=True, help="Port number to run the server on"
    )
    parser.add_argument(
        "--reload", type=str, default="false", help="Reload the server on code changes"
    )
    args = parser.parse_args()
    reload = args.reload == "true"
    
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=args.port,
        log_level="info",
        reload=reload,
    )
