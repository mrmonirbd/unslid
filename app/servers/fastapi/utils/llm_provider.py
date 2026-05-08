import os

from fastapi import HTTPException

from constants.llm import (
    DEFAULT_ANTHROPIC_MODEL,
    DEFAULT_GOOGLE_MODEL,
    DEFAULT_OPENAI_MODEL,
)
from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_google_api_key_env,
    get_openai_api_key_env,
    get_anthropic_model_env,
    get_codex_model_env,
    get_custom_model_env,
    get_google_model_env,
    get_llm_provider_env,
    get_ollama_model_env,
    get_openai_model_env,
)
from utils.plan_context import get_plan_config_value


def get_llm_provider():
    # Plan context takes priority over env vars
    provider = get_plan_config_value("LLM", get_llm_provider_env())
    try:
        return LLMProvider(provider)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Invalid LLM provider. Please select one of: openai, google, anthropic, ollama, custom, codex",
        )


def is_openai_selected():
    return get_llm_provider() == LLMProvider.OPENAI


def is_google_selected():
    return get_llm_provider() == LLMProvider.GOOGLE


def is_anthropic_selected():
    return get_llm_provider() == LLMProvider.ANTHROPIC


def is_ollama_selected():
    return get_llm_provider() == LLMProvider.OLLAMA


def is_custom_llm_selected():
    return get_llm_provider() == LLMProvider.CUSTOM


def is_codex_selected():
    return get_llm_provider() == LLMProvider.CODEX


def get_model():
    selected_llm = get_llm_provider()
    if selected_llm == LLMProvider.OPENAI:
        return (
            get_plan_config_value("OPENAI_MODEL", get_openai_model_env())
            or DEFAULT_OPENAI_MODEL
        )
    elif selected_llm == LLMProvider.GOOGLE:
        return (
            get_plan_config_value("GOOGLE_MODEL", get_google_model_env())
            or DEFAULT_GOOGLE_MODEL
        )
    elif selected_llm == LLMProvider.ANTHROPIC:
        return (
            get_plan_config_value("ANTHROPIC_MODEL", get_anthropic_model_env())
            or DEFAULT_ANTHROPIC_MODEL
        )
    elif selected_llm == LLMProvider.OLLAMA:
        return get_plan_config_value("OLLAMA_MODEL", get_ollama_model_env())
    elif selected_llm == LLMProvider.CUSTOM:
        return get_plan_config_value("CUSTOM_MODEL", get_custom_model_env())
    elif selected_llm == LLMProvider.CODEX:
        return get_plan_config_value("CODEX_MODEL", get_codex_model_env())
    else:
        raise HTTPException(
            status_code=500,
            detail="Invalid LLM provider. Please select one of: openai, google, anthropic, ollama, custom, codex",
        )


def get_large_model():
    """Backward-compatible alias used by older schema tests."""
    return get_model()


def get_llm_client():
    """Backward-compatible OpenAI client factory used by older schema tests."""
    from openai import AsyncOpenAI

    api_key = get_plan_config_value("OPENAI_API_KEY", get_openai_api_key_env())
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API Key is not set")
    return AsyncOpenAI(api_key=api_key)


def get_google_llm_client():
    """Backward-compatible Google GenAI client factory used by older schema tests."""
    from google import genai

    api_key = get_plan_config_value("GOOGLE_API_KEY", get_google_api_key_env())
    if not api_key:
        raise HTTPException(status_code=500, detail="Google API Key is not set")
    return genai.Client(api_key=api_key)
