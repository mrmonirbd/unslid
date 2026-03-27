"""
Static catalog of all supported AI providers and their models.
Exposed via GET /api/v1/admin/ai-providers so the admin UI can
render dynamic cascading dropdowns without any hardcoded lists.

type:
  "native"     — natively supported (openai, google, anthropic, ollama)
  "compatible" — OpenAI-compatible endpoint (custom llm_provider in backend)
  "image"      — image generation only (not available as LLM)

provider_backend:
  The value stored in plan_ai_configs.llm_provider / image_provider.
  For "compatible" providers this is always "custom".
"""

LLM_PROVIDERS: list[dict] = [
    # ── Native providers ────────────────────────────────────────────────────
    {
        "id": "openai",
        "label": "OpenAI",
        "type": "native",
        "provider_backend": "openai",
        "base_url": None,
        "needs_base_url": False,
        "api_key_url": "https://platform.openai.com/api-keys",
        "models": [
            {"id": "gpt-4.1-mini",   "label": "gpt-4.1-mini",   "notes": "Fast & cheap — good for Free plan",          "recommended_for": ["free"]},
            {"id": "gpt-4.1",        "label": "gpt-4.1",         "notes": "High quality — recommended for Pro/Team",    "recommended_for": ["pro", "team"]},
            {"id": "gpt-4o",         "label": "gpt-4o",           "notes": "Multimodal, strong reasoning"},
            {"id": "gpt-4o-mini",    "label": "gpt-4o-mini",      "notes": "Fast & cheap multimodal"},
            {"id": "o1",             "label": "o1",               "notes": "Advanced reasoning (slow, expensive)"},
            {"id": "o1-mini",        "label": "o1-mini",          "notes": "Reasoning, more affordable"},
            {"id": "o3-mini",        "label": "o3-mini",          "notes": "Latest reasoning model"},
            {"id": "gpt-3.5-turbo",  "label": "gpt-3.5-turbo",   "notes": "Legacy — cheapest option"},
        ],
    },
    {
        "id": "google",
        "label": "Google Gemini",
        "type": "native",
        "provider_backend": "google",
        "base_url": None,
        "needs_base_url": False,
        "api_key_url": "https://aistudio.google.com/app/apikey",
        "models": [
            {"id": "models/gemini-2.5-flash",      "label": "gemini-2.5-flash",      "notes": "Fast & cheap — recommended for Free", "recommended_for": ["free"]},
            {"id": "models/gemini-2.5-pro",        "label": "gemini-2.5-pro",        "notes": "Best quality",                         "recommended_for": ["pro", "team"]},
            {"id": "models/gemini-2.0-flash",      "label": "gemini-2.0-flash",      "notes": "Fast, low latency"},
            {"id": "models/gemini-2.0-flash-lite", "label": "gemini-2.0-flash-lite", "notes": "Cheapest Gemini option"},
            {"id": "models/gemini-1.5-pro",        "label": "gemini-1.5-pro",        "notes": "Strong long-context model"},
            {"id": "models/gemini-1.5-flash",      "label": "gemini-1.5-flash",      "notes": "Fast and affordable"},
        ],
    },
    {
        "id": "anthropic",
        "label": "Anthropic (Claude)",
        "type": "native",
        "provider_backend": "anthropic",
        "base_url": None,
        "needs_base_url": False,
        "api_key_url": "https://console.anthropic.com/settings/keys",
        "models": [
            {"id": "claude-3-5-haiku-20241022",  "label": "claude-3.5-haiku",  "notes": "Fastest & cheapest",           "recommended_for": ["free"]},
            {"id": "claude-3-5-sonnet-20241022", "label": "claude-3.5-sonnet", "notes": "Balanced quality and cost"},
            {"id": "claude-sonnet-4-20250514",   "label": "claude-sonnet-4",   "notes": "Recommended for Pro",          "recommended_for": ["pro"]},
            {"id": "claude-opus-4-20250514",     "label": "claude-opus-4",     "notes": "Best quality, most expensive", "recommended_for": ["team"]},
        ],
    },
    {
        "id": "ollama",
        "label": "Ollama (Self-hosted)",
        "type": "native",
        "provider_backend": "ollama",
        "base_url": "http://host.docker.internal:11434",
        "needs_base_url": True,
        "api_key_url": None,
        "models": [
            {"id": "llama3.2",       "label": "llama3.2",       "notes": "Meta — latest small model"},
            {"id": "llama3.1:70b",   "label": "llama3.1:70b",   "notes": "Meta — larger, better quality"},
            {"id": "mistral",        "label": "mistral",        "notes": "Good general purpose"},
            {"id": "mistral-nemo",   "label": "mistral-nemo",   "notes": "Mistral's efficient model"},
            {"id": "gemma3",         "label": "gemma3",         "notes": "Google's open model"},
            {"id": "gemma3:27b",     "label": "gemma3:27b",     "notes": "Larger Gemma"},
            {"id": "qwen2.5",        "label": "qwen2.5",        "notes": "Alibaba"},
            {"id": "qwen2.5:72b",    "label": "qwen2.5:72b",    "notes": "Larger Qwen"},
            {"id": "deepseek-r1",    "label": "deepseek-r1",    "notes": "Reasoning model"},
            {"id": "phi4",           "label": "phi4",           "notes": "Microsoft — small & efficient"},
            {"id": "codellama",      "label": "codellama",      "notes": "Code-focused"},
        ],
    },

    # ── OpenAI-compatible providers ─────────────────────────────────────────
    {
        "id": "kimi",
        "label": "Kimi (Moonshot AI)",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.moonshot.cn/v1",
        "needs_base_url": True,
        "api_key_url": "https://platform.moonshot.cn/console/api-keys",
        "models": [
            {"id": "moonshot-v1-8k",    "label": "moonshot-v1-8k",    "notes": "Short context, cheapest"},
            {"id": "moonshot-v1-32k",   "label": "moonshot-v1-32k",   "notes": "Medium context"},
            {"id": "moonshot-v1-128k",  "label": "moonshot-v1-128k",  "notes": "Long context — recommended", "recommended_for": ["pro", "team"]},
        ],
    },
    {
        "id": "deepseek",
        "label": "DeepSeek",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.deepseek.com/v1",
        "needs_base_url": True,
        "api_key_url": "https://platform.deepseek.com/api_keys",
        "models": [
            {"id": "deepseek-chat",      "label": "deepseek-chat",      "notes": "General purpose (DeepSeek V3)", "recommended_for": ["free", "pro"]},
            {"id": "deepseek-reasoner",  "label": "deepseek-reasoner",  "notes": "Reasoning model (DeepSeek R1)"},
        ],
    },
    {
        "id": "groq",
        "label": "Groq (Ultra-fast inference)",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.groq.com/openai/v1",
        "needs_base_url": True,
        "api_key_url": "https://console.groq.com/keys",
        "models": [
            {"id": "llama-3.3-70b-versatile",  "label": "llama-3.3-70b-versatile",  "notes": "Best quality on Groq", "recommended_for": ["pro", "team"]},
            {"id": "llama-3.1-8b-instant",     "label": "llama-3.1-8b-instant",     "notes": "Fastest & cheapest",   "recommended_for": ["free"]},
            {"id": "mixtral-8x7b-32768",       "label": "mixtral-8x7b-32768",       "notes": "Good quality, long context"},
            {"id": "gemma2-9b-it",             "label": "gemma2-9b-it",             "notes": "Google Gemma via Groq"},
        ],
    },
    {
        "id": "mistral",
        "label": "Mistral AI",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.mistral.ai/v1",
        "needs_base_url": True,
        "api_key_url": "https://console.mistral.ai/api-keys",
        "models": [
            {"id": "mistral-small-latest",   "label": "mistral-small-latest",   "notes": "Cheapest",           "recommended_for": ["free"]},
            {"id": "mistral-medium-latest",  "label": "mistral-medium-latest",  "notes": "Balanced"},
            {"id": "mistral-large-latest",   "label": "mistral-large-latest",   "notes": "Best quality",       "recommended_for": ["pro", "team"]},
            {"id": "codestral-latest",       "label": "codestral-latest",       "notes": "Code-focused"},
            {"id": "open-mistral-nemo",      "label": "open-mistral-nemo",      "notes": "Open source, affordable"},
        ],
    },
    {
        "id": "xai",
        "label": "xAI (Grok)",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.x.ai/v1",
        "needs_base_url": True,
        "api_key_url": "https://console.x.ai",
        "models": [
            {"id": "grok-3",       "label": "grok-3",       "notes": "Best quality", "recommended_for": ["team"]},
            {"id": "grok-3-mini",  "label": "grok-3-mini",  "notes": "Faster, cheaper", "recommended_for": ["pro"]},
            {"id": "grok-2",       "label": "grok-2",       "notes": "Previous generation"},
        ],
    },
    {
        "id": "together",
        "label": "Together AI",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.together.xyz/v1",
        "needs_base_url": True,
        "api_key_url": "https://api.together.ai/settings/api-keys",
        "models": [
            {"id": "meta-llama/Llama-3.3-70B-Instruct-Turbo",   "label": "Llama-3.3-70B-Instruct-Turbo",  "notes": "Recommended", "recommended_for": ["pro", "team"]},
            {"id": "meta-llama/Llama-3.1-8B-Instruct-Turbo",    "label": "Llama-3.1-8B-Instruct-Turbo",   "notes": "Cheapest",    "recommended_for": ["free"]},
            {"id": "mistralai/Mixtral-8x7B-Instruct-v0.1",      "label": "Mixtral-8x7B-Instruct",          "notes": "Good quality"},
            {"id": "Qwen/Qwen2.5-72B-Instruct-Turbo",           "label": "Qwen2.5-72B-Instruct-Turbo",    "notes": "Alibaba"},
            {"id": "deepseek-ai/DeepSeek-R1",                   "label": "DeepSeek-R1",                   "notes": "Reasoning model"},
        ],
    },
    {
        "id": "openrouter",
        "label": "OpenRouter (100+ models)",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://openrouter.ai/api/v1",
        "needs_base_url": True,
        "api_key_url": "https://openrouter.ai/settings/keys",
        "models": [
            {"id": "openai/gpt-4o",                           "label": "openai/gpt-4o"},
            {"id": "openai/gpt-4.1-mini",                     "label": "openai/gpt-4.1-mini",         "recommended_for": ["free"]},
            {"id": "anthropic/claude-3.5-sonnet",             "label": "anthropic/claude-3.5-sonnet"},
            {"id": "google/gemini-2.5-flash",                 "label": "google/gemini-2.5-flash",     "recommended_for": ["free"]},
            {"id": "meta-llama/llama-3.3-70b-instruct",      "label": "meta-llama/llama-3.3-70b",    "recommended_for": ["pro", "team"]},
            {"id": "deepseek/deepseek-chat",                  "label": "deepseek/deepseek-chat"},
            {"id": "x-ai/grok-3-mini",                        "label": "x-ai/grok-3-mini"},
            {"id": "mistralai/mistral-large",                 "label": "mistralai/mistral-large"},
        ],
    },
    {
        "id": "perplexity",
        "label": "Perplexity AI",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.perplexity.ai",
        "needs_base_url": True,
        "api_key_url": "https://www.perplexity.ai/settings/api",
        "models": [
            {"id": "sonar",            "label": "sonar",            "notes": "Online search, cheapest", "recommended_for": ["free"]},
            {"id": "sonar-pro",        "label": "sonar-pro",        "notes": "Online search, better quality"},
            {"id": "sonar-reasoning",  "label": "sonar-reasoning",  "notes": "Reasoning + search"},
        ],
    },
    {
        "id": "cohere",
        "label": "Cohere",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://api.cohere.com/compatibility/v1",
        "needs_base_url": True,
        "api_key_url": "https://dashboard.cohere.com/api-keys",
        "models": [
            {"id": "command-r",       "label": "command-r",       "notes": "Fast and affordable", "recommended_for": ["free"]},
            {"id": "command-r-plus",  "label": "command-r-plus",  "notes": "Best quality"},
        ],
    },
    {
        "id": "azure",
        "label": "Azure OpenAI",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT",
        "needs_base_url": True,
        "api_key_url": "https://portal.azure.com",
        "models": [
            {"id": "gpt-4o",       "label": "gpt-4o (deployment name)",       "notes": "Use your Azure deployment name"},
            {"id": "gpt-4-turbo",  "label": "gpt-4-turbo (deployment name)",  "notes": "Use your Azure deployment name"},
        ],
    },
    {
        "id": "nvidia",
        "label": "NVIDIA NIM",
        "type": "compatible",
        "provider_backend": "custom",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "needs_base_url": True,
        "api_key_url": "https://build.nvidia.com",
        "models": [
            {"id": "nvidia/llama-3.1-nemotron-70b-instruct",  "label": "nvidia/llama-3.1-nemotron-70b", "recommended_for": ["team"]},
            {"id": "meta/llama-3.3-70b-instruct",             "label": "meta/llama-3.3-70b"},
            {"id": "mistralai/mistral-large-2-instruct",      "label": "mistralai/mistral-large-2"},
        ],
    },
]

IMAGE_PROVIDERS: list[dict] = [
    {"id": "pexels",        "label": "Pexels (free stock photos)",      "needs_api_key": True,  "api_key_url": "https://www.pexels.com/api/"},
    {"id": "pixabay",       "label": "Pixabay (free stock photos)",     "needs_api_key": True,  "api_key_url": "https://pixabay.com/api/docs/"},
    {"id": "dall-e-3",      "label": "OpenAI DALL·E 3",                 "needs_api_key": True,  "api_key_url": "https://platform.openai.com/api-keys"},
    {"id": "gpt-image-1.5","label": "OpenAI GPT Image 1.5",            "needs_api_key": True,  "api_key_url": "https://platform.openai.com/api-keys"},
    {"id": "gemini_flash",  "label": "Google Gemini Flash (image gen)", "needs_api_key": True,  "api_key_url": "https://aistudio.google.com/app/apikey"},
    {"id": "comfyui",       "label": "ComfyUI (self-hosted)",           "needs_api_key": False, "api_key_url": None,  "base_url": "http://host.docker.internal:8188"},
    {"id": "none",          "label": "Disable image generation",        "needs_api_key": False, "api_key_url": None},
]


def get_provider_by_id(provider_id: str) -> dict | None:
    return next((p for p in LLM_PROVIDERS if p["id"] == provider_id), None)


def get_catalog() -> dict:
    return {"llm_providers": LLM_PROVIDERS, "image_providers": IMAGE_PROVIDERS}
