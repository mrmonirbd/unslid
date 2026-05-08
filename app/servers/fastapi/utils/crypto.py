"""
Field-level encryption for sensitive values stored in the database (API keys).

Uses Fernet symmetric encryption (AES-128-CBC + HMAC-SHA256).
SECRET_KEY may be either a Fernet key or a long random application secret.
When it is not already a Fernet key, a stable Fernet key is derived from it.

If SECRET_KEY is missing or invalid the functions degrade gracefully:
- encrypt_value() returns the plaintext unchanged (still stored, just not encrypted)
- decrypt_value() returns the value unchanged (handles legacy plaintext rows)
This prevents data loss if the key is misconfigured while still working.
"""
import os
import logging
import base64
import hashlib

logger = logging.getLogger(__name__)

_fernet = None
_initialized = False


def _get_fernet():
    global _fernet, _initialized
    if _initialized:
        return _fernet
    _initialized = True
    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        logger.warning("SECRET_KEY not set — API keys will be stored unencrypted in the DB.")
        return None
    try:
        from cryptography.fernet import Fernet
        try:
            _fernet = Fernet(secret.encode())
        except Exception:
            derived = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
            _fernet = Fernet(derived)
    except Exception as exc:
        logger.error("Invalid SECRET_KEY — encryption disabled: %s", exc)
        _fernet = None
    return _fernet


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string. Returns ciphertext prefixed with 'enc:' so we can
    distinguish encrypted values from legacy plaintext in the DB."""
    if not plaintext:
        return plaintext
    f = _get_fernet()
    if f is None:
        return plaintext
    try:
        return "enc:" + f.encrypt(plaintext.encode()).decode()
    except Exception as exc:
        logger.error("Encryption failed: %s", exc)
        return plaintext


def decrypt_value(stored: str) -> str:
    """Decrypt a stored value.  Handles three cases:
    1. Empty / None → return as-is
    2. Starts with 'enc:' → decrypt
    3. Plaintext (legacy / SECRET_KEY was missing on write) → return as-is
    """
    if not stored:
        return stored
    if not stored.startswith("enc:"):
        return stored   # legacy plaintext row
    f = _get_fernet()
    if f is None:
        logger.warning("Cannot decrypt — SECRET_KEY not set. Returning raw value.")
        return stored
    try:
        return f.decrypt(stored[4:].encode()).decode()
    except Exception as exc:
        logger.error("Decryption failed: %s", exc)
        return stored
