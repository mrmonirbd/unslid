from fastapi import HTTPException
from anthropic import APIError as AnthropicAPIError
from openai import APIError as OpenAIAPIError
from google.genai.errors import APIError as GoogleAPIError
import traceback


def handle_llm_client_exceptions(e: Exception) -> HTTPException:
    traceback.print_exc()
    status_code = getattr(e, "status_code", None) or getattr(e, "code", None)
    message = getattr(e, "message", None) or str(e)

    if isinstance(e, OpenAIAPIError):
        return HTTPException(status_code=500, detail=f"OpenAI API error: {message}")
    if isinstance(e, GoogleAPIError):
        if status_code == 404 or str(message).strip().lower() == "not found":
            return HTTPException(
                status_code=500,
                detail=(
                    "Google Gemini model was not found. Check GOOGLE_MODEL in your .env "
                    "or set it to models/gemini-2.0-flash, then restart/rebuild FastAPI."
                ),
            )
        return HTTPException(status_code=500, detail=f"Google API error: {message}")
    if isinstance(e, AnthropicAPIError):
        return HTTPException(
            status_code=500, detail=f"Anthropic API error: {message}"
        )
    return HTTPException(status_code=500, detail=f"LLM API error: {message}")
