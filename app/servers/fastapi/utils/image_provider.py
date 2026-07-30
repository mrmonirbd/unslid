from enums.image_provider import ImageProvider
from utils.get_env import (
    get_comfyui_url_env,
    get_comfyui_workflow_env,
    get_disable_image_generation_env,
    get_image_provider_env,
    get_openai_api_key_env,
    get_google_api_key_env,
    get_pexels_api_key_env,
    get_pixabay_api_key_env,
)
from utils.parsers import parse_bool_or_none
from utils.plan_context import get_plan_config_value


def is_image_generation_disabled() -> bool:
    return parse_bool_or_none(get_disable_image_generation_env()) or False


def is_pixels_selected() -> bool:
    return ImageProvider.PEXELS == get_selected_image_provider()


def is_pixabay_selected() -> bool:
    return ImageProvider.PIXABAY == get_selected_image_provider()


def is_gemini_flash_selected() -> bool:
    return ImageProvider.GEMINI_FLASH == get_selected_image_provider()


def is_nanobanana_pro_selected() -> bool:
    return ImageProvider.NANOBANANA_PRO == get_selected_image_provider()


def is_dalle3_selected() -> bool:
    return ImageProvider.DALLE3 == get_selected_image_provider()


def is_gpt_image_1_5_selected() -> bool:
    return ImageProvider.GPT_IMAGE_1_5 == get_selected_image_provider()


def is_comfyui_selected() -> bool:
    return ImageProvider.COMFYUI == get_selected_image_provider()


def is_no_image_provider_selected() -> bool:
    return ImageProvider.NONE == get_selected_image_provider()


def _normalize_image_provider(value: str | None) -> str | None:
    if not value:
        return None

    normalized = value.strip().strip("'\"").lower()
    if not normalized:
        return None

    aliases = {
        "ai": ImageProvider.GPT_IMAGE_1_5.value,
        "openai": ImageProvider.GPT_IMAGE_1_5.value,
        "dalle": ImageProvider.DALLE3.value,
        "dall-e": ImageProvider.DALLE3.value,
        "gpt_image_1_5": ImageProvider.GPT_IMAGE_1_5.value,
        "google": ImageProvider.GEMINI_FLASH.value,
    }
    return aliases.get(normalized, normalized)


def _has_provider_credentials(provider: ImageProvider) -> bool:
    if provider == ImageProvider.NONE:
        return True
    if provider in {ImageProvider.DALLE3, ImageProvider.GPT_IMAGE_1_5}:
        return bool(get_plan_config_value("OPENAI_API_KEY", get_openai_api_key_env()))
    if provider in {ImageProvider.GEMINI_FLASH, ImageProvider.NANOBANANA_PRO}:
        return bool(get_plan_config_value("GOOGLE_API_KEY", get_google_api_key_env()))
    if provider == ImageProvider.PEXELS:
        return bool(get_plan_config_value("PEXELS_API_KEY", get_pexels_api_key_env()))
    if provider == ImageProvider.PIXABAY:
        return bool(get_plan_config_value("PIXABAY_API_KEY", get_pixabay_api_key_env()))
    if provider == ImageProvider.COMFYUI:
        return bool(get_comfyui_url_env() and get_comfyui_workflow_env())
    return False


def _first_configured_provider() -> ImageProvider | None:
    for provider in (
        ImageProvider.GPT_IMAGE_1_5,
        ImageProvider.GEMINI_FLASH,
        ImageProvider.PEXELS,
        ImageProvider.PIXABAY,
        ImageProvider.COMFYUI,
    ):
        if _has_provider_credentials(provider):
            return provider
    return None


def get_selected_image_provider() -> ImageProvider | None:
    """
    Get the selected image provider from plan context (DB config) or env fallback.
    Returns:
        ImageProvider: The selected image provider.
    """
    image_provider_env = _normalize_image_provider(
        get_plan_config_value("IMAGE_PROVIDER", get_image_provider_env())
    )
    if image_provider_env:
        try:
            selected_provider = ImageProvider(image_provider_env)
            if _has_provider_credentials(selected_provider):
                return selected_provider
        except ValueError:
            pass

    return _first_configured_provider()
