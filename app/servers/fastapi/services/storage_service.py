"""
Geo-aware Wasabi S3 storage service.

Each user is assigned a storage region at signup (stored on user.storage_region).
All file operations use the bucket for that region, ensuring data residency compliance (GDPR).

Region → Bucket mapping is driven by environment variables so it works for both
development (single dev bucket) and production (one bucket per region).
"""

import os
import uuid
from typing import Optional
from contextlib import asynccontextmanager

import aioboto3
from botocore.config import Config

# ─── Region Configuration ────────────────────────────────────────────────────

WASABI_ENDPOINT_URL = os.getenv("WASABI_ENDPOINT_URL", "https://s3.eu-central-1.wasabisys.com")
WASABI_ACCESS_KEY_ID = os.getenv("WASABI_ACCESS_KEY_ID", "")
WASABI_SECRET_ACCESS_KEY = os.getenv("WASABI_SECRET_ACCESS_KEY", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Map region code → bucket name
REGION_BUCKETS: dict[str, str] = {
    "eu": os.getenv("WASABI_BUCKET_EU", ""),
    "us": os.getenv("WASABI_BUCKET_US", ""),
    "ap-se": os.getenv("WASABI_BUCKET_AP_SE", ""),
    "ap-ne": os.getenv("WASABI_BUCKET_AP_NE", ""),
}
DEV_BUCKET = os.getenv("WASABI_BUCKET_DEV", "aipresentation")

# Country code → storage region mapping
EU_COUNTRIES = {
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
    "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
    "NL", "PL", "PT", "RO", "SE", "SI", "SK",
    # Non-EU but GDPR-adjacent
    "GB", "NO", "IS", "LI", "CH",
}
US_COUNTRIES = {"US", "CA", "MX", "BR", "AR", "CL", "CO", "PE"}
AP_NE_COUNTRIES = {"JP", "KR", "TW", "HK", "MN"}
AP_SE_COUNTRIES = {"SG", "MY", "ID", "TH", "PH", "VN", "AU", "NZ", "IN", "BD", "LK"}


def country_to_region(country_code: str) -> str:
    """Map an ISO 3166-1 alpha-2 country code to a storage region code."""
    code = country_code.upper()
    if code in EU_COUNTRIES:
        return "eu"
    if code in US_COUNTRIES:
        return "us"
    if code in AP_NE_COUNTRIES:
        return "ap-ne"
    if code in AP_SE_COUNTRIES:
        return "ap-se"
    # Default: EU (strictest privacy standards — safe fallback)
    return "eu"


def get_bucket_for_region(region: str) -> str:
    """Return the bucket name for a given region code."""
    if ENVIRONMENT == "development":
        return DEV_BUCKET

    bucket = REGION_BUCKETS.get(region)
    if not bucket:
        # Fallback to EU bucket if specific region not configured
        bucket = REGION_BUCKETS.get("eu") or DEV_BUCKET
    return bucket


def get_bucket_for_user(storage_region: str) -> str:
    """Return the correct bucket name for a user based on their storage region."""
    return get_bucket_for_region(storage_region)


# ─── S3 Client ───────────────────────────────────────────────────────────────

_session = aioboto3.Session()


@asynccontextmanager
async def get_s3_client():
    """Async context manager for an S3-compatible client (Wasabi)."""
    async with _session.client(
        "s3",
        endpoint_url=WASABI_ENDPOINT_URL,
        aws_access_key_id=WASABI_ACCESS_KEY_ID,
        aws_secret_access_key=WASABI_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    ) as client:
        yield client


# ─── File Operations ─────────────────────────────────────────────────────────

async def upload_file(
    storage_region: str,
    key: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """
    Upload bytes to the correct regional bucket.
    Returns the S3 key (path within the bucket).
    """
    bucket = get_bucket_for_user(storage_region)
    async with get_s3_client() as s3:
        await s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    return key


async def upload_file_from_path(
    storage_region: str,
    key: str,
    file_path: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload a file from local disk to S3. Returns the S3 key."""
    bucket = get_bucket_for_user(storage_region)
    async with get_s3_client() as s3:
        await s3.upload_file(
            Filename=file_path,
            Bucket=bucket,
            Key=key,
            ExtraArgs={"ContentType": content_type},
        )
    return key


async def download_file(storage_region: str, key: str) -> bytes:
    """Download a file from S3 and return its bytes."""
    bucket = get_bucket_for_user(storage_region)
    async with get_s3_client() as s3:
        response = await s3.get_object(Bucket=bucket, Key=key)
        return await response["Body"].read()


async def delete_file(storage_region: str, key: str) -> None:
    """Delete a single file from S3."""
    bucket = get_bucket_for_user(storage_region)
    async with get_s3_client() as s3:
        await s3.delete_object(Bucket=bucket, Key=key)


async def delete_all_user_files(storage_region: str, user_prefix: str) -> int:
    """
    Delete all files for a user (used for account deletion / GDPR right to erasure).
    user_prefix should be e.g. 'users/{user_id}/'
    Returns the number of files deleted.
    """
    bucket = get_bucket_for_user(storage_region)
    deleted_count = 0

    async with get_s3_client() as s3:
        paginator = s3.get_paginator("list_objects_v2")
        async for page in paginator.paginate(Bucket=bucket, Prefix=user_prefix):
            objects = page.get("Contents", [])
            if not objects:
                continue
            delete_keys = [{"Key": obj["Key"]} for obj in objects]
            await s3.delete_objects(
                Bucket=bucket,
                Delete={"Objects": delete_keys, "Quiet": True},
            )
            deleted_count += len(delete_keys)

    return deleted_count


async def get_presigned_url(
    storage_region: str,
    key: str,
    expires_in: int = 3600,
) -> str:
    """
    Generate a pre-signed URL for temporary access to a private file.
    Default expiry: 1 hour.
    """
    bucket = get_bucket_for_user(storage_region)
    async with get_s3_client() as s3:
        url = await s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    return url


async def get_file_size(storage_region: str, key: str) -> Optional[int]:
    """Return file size in bytes, or None if the file doesn't exist."""
    bucket = get_bucket_for_user(storage_region)
    try:
        async with get_s3_client() as s3:
            response = await s3.head_object(Bucket=bucket, Key=key)
            return response.get("ContentLength")
    except Exception:
        return None


# ─── Key Helpers ─────────────────────────────────────────────────────────────

def make_presentation_key(user_id: int, presentation_id: str, filename: str) -> str:
    """Build the S3 key for a presentation export file."""
    return f"users/{user_id}/presentations/{presentation_id}/exports/{filename}"


def make_upload_key(user_id: int, original_filename: str) -> str:
    """Build the S3 key for a user-uploaded file (input documents)."""
    unique = uuid.uuid4().hex[:8]
    return f"users/{user_id}/uploads/{unique}_{original_filename}"


def make_image_key(user_id: int, presentation_id: str, filename: str) -> str:
    """Build the S3 key for a generated slide image."""
    return f"users/{user_id}/presentations/{presentation_id}/images/{filename}"


# ─── Connectivity Test ───────────────────────────────────────────────────────

async def test_connection() -> dict:
    """Test that the S3 credentials and bucket are accessible. Used at startup."""
    bucket = get_bucket_for_region("eu")
    try:
        async with get_s3_client() as s3:
            await s3.head_bucket(Bucket=bucket)
        return {"status": "ok", "bucket": bucket, "endpoint": WASABI_ENDPOINT_URL}
    except Exception as e:
        return {"status": "error", "error": str(e), "bucket": bucket}
