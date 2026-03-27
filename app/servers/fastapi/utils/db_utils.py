import os
import ssl
from urllib.parse import urlsplit, urlunsplit, parse_qsl, unquote, quote

from utils.get_env import get_app_data_directory_env, get_database_url_env


def get_database_url_and_connect_args() -> tuple[str, dict]:
    database_url = get_database_url_env() or "sqlite:///" + os.path.join(
        get_app_data_directory_env() or "/tmp/unslid", "fastapi.db"
    )

    # Swap scheme to async driver
    if database_url.startswith("sqlite://"):
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("mysql://"):
        database_url = database_url.replace("mysql://", "mysql+aiomysql://", 1)

    connect_args: dict = {}
    if "sqlite" in database_url:
        connect_args["check_same_thread"] = False
        return database_url, connect_args

    # For PostgreSQL with asyncpg: parse the URL, decode any %-encoded password,
    # then re-encode it cleanly so asyncpg receives the actual password bytes.
    # This prevents "Tenant or user not found" errors caused by asyncpg receiving
    # a still-encoded password like "D%2C%40..." instead of "D,@...".
    try:
        split = urlsplit(database_url)
        password = split.password or ""

        # URL-decode the password (handles %2C → , etc.)
        decoded_password = unquote(password)

        # Re-encode only the characters that must be percent-encoded in a URL
        # (keep it minimal so asyncpg/SQLAlchemy parse it correctly)
        safe_password = quote(decoded_password, safe="")

        # Rebuild netloc with the cleaned-up password
        userinfo = split.username or ""
        if safe_password:
            userinfo = f"{userinfo}:{safe_password}"
        host = split.hostname or ""
        if split.port:
            host = f"{host}:{split.port}"
        netloc = f"{userinfo}@{host}"

        database_url = urlunsplit((
            split.scheme,
            netloc,
            split.path,
            "",           # strip query params (handle ssl separately)
            "",
        ))

        # Handle sslmode query parameter
        if split.query:
            for k, v in parse_qsl(split.query, keep_blank_values=True):
                if k.lower() == "sslmode" and v.lower() != "disable":
                    connect_args["ssl"] = ssl.create_default_context()
    except Exception:
        pass

    return database_url, connect_args
