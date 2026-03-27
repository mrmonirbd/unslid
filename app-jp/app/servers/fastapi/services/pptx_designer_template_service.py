"""
Designer PPTX template service.

Handles:
- Storing uploaded .pptx files to /app_data/pptx_templates/
- Generating per-slide PNG thumbnails via LibreOffice
- Extracting color + font scheme from the PPTX theme XML
- Applying the designer template's theme to a generated Presentation object
"""
import asyncio
import logging
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

from pptx import Presentation
from pptx.util import Pt

from utils.get_env import get_app_data_directory_env

logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────

def _pptx_templates_dir() -> Path:
    return Path(get_app_data_directory_env()) / "pptx_templates"


def _thumbs_dir(template_uuid: str) -> Path:
    return _pptx_templates_dir() / "thumbs" / template_uuid


# ─── Storage ──────────────────────────────────────────────────────────────────

def save_pptx_file(file_bytes: bytes) -> tuple[str, str]:
    """
    Persist raw .pptx bytes.
    Returns (absolute_path, relative_path) where relative_path is stored in DB.
    """
    _pptx_templates_dir().mkdir(parents=True, exist_ok=True)
    uid = str(uuid.uuid4())
    rel = f"pptx_templates/{uid}.pptx"
    abs_path = Path(get_app_data_directory_env()) / rel
    abs_path.write_bytes(file_bytes)
    return str(abs_path), rel


def delete_pptx_files(file_path: str, template_uuid: str) -> None:
    """Remove stored PPTX and its thumbnails."""
    try:
        abs_pptx = Path(get_app_data_directory_env()) / file_path
        abs_pptx.unlink(missing_ok=True)
    except Exception as e:
        logger.warning("Could not delete pptx file %s: %s", file_path, e)
    try:
        thumb_dir = _thumbs_dir(template_uuid)
        shutil.rmtree(thumb_dir, ignore_errors=True)
    except Exception as e:
        logger.warning("Could not delete thumbs for %s: %s", template_uuid, e)


# ─── Thumbnail generation ─────────────────────────────────────────────────────

async def generate_thumbnails(abs_pptx_path: str, template_uuid: str) -> list[str]:
    """
    Convert each slide to a PNG thumbnail using LibreOffice.
    Returns list of relative paths (relative to app_data root) for storing in DB.
    """
    thumb_dir = _thumbs_dir(template_uuid)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    tmp_copy = thumb_dir / "source.pptx"
    shutil.copy(abs_pptx_path, tmp_copy)

    # LibreOffice exports all slides as PNGs named source0.png, source1.png, ...
    cmd = [
        "libreoffice",
        "--headless",
        "--convert-to", "png",
        "--outdir", str(thumb_dir),
        str(tmp_copy),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        if proc.returncode != 0:
            logger.error("LibreOffice thumbnail generation failed: %s", stderr.decode())
    except asyncio.TimeoutError:
        logger.error("LibreOffice thumbnail generation timed out for %s", abs_pptx_path)
    except Exception as e:
        logger.error("Thumbnail generation error: %s", e)

    tmp_copy.unlink(missing_ok=True)

    # Collect generated PNGs in slide order
    png_files = sorted(
        thumb_dir.glob("source*.png"),
        key=lambda p: _slide_index_from_name(p.stem),
    )

    app_data = get_app_data_directory_env()
    rel_paths = [str(p.relative_to(app_data)) for p in png_files]
    return rel_paths


def _slide_index_from_name(stem: str) -> int:
    """Extract numeric suffix from LibreOffice output filenames like 'source0', 'source1'."""
    m = re.search(r"(\d+)$", stem)
    return int(m.group(1)) if m else 0


# ─── Theme extraction ─────────────────────────────────────────────────────────

_THEME_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
_DML = f"{{{_THEME_NS}}}"


def _hex_from_srgb(element) -> Optional[str]:
    srgb = element.find(f"{_DML}srgbClr")
    if srgb is not None:
        return "#" + srgb.get("val", "000000").upper()
    sys_clr = element.find(f"{_DML}sysClr")
    if sys_clr is not None:
        last = sys_clr.get("lastClr")
        if last:
            return "#" + last.upper()
    return None


def extract_theme_info(abs_pptx_path: str) -> tuple[dict, dict]:
    """
    Parse the PPTX zip to extract color scheme and font scheme from theme1.xml.
    Returns (color_scheme_dict, font_scheme_dict).
    """
    color_scheme: dict = {}
    font_scheme: dict = {}

    try:
        import zipfile
        with zipfile.ZipFile(abs_pptx_path) as z:
            # Find theme file (usually ppt/theme/theme1.xml)
            theme_files = [n for n in z.namelist() if re.match(r"ppt/theme/theme\d+\.xml", n)]
            if not theme_files:
                return color_scheme, font_scheme

            with z.open(theme_files[0]) as f:
                tree = ET.parse(f)
                root = tree.getroot()

            # Color scheme
            clr_scheme = root.find(f".//{_DML}clrScheme")
            if clr_scheme is not None:
                slot_names = ["dk1", "lt1", "dk2", "lt2",
                              "accent1", "accent2", "accent3",
                              "accent4", "accent5", "accent6",
                              "hlink", "folHlink"]
                for slot in slot_names:
                    el = clr_scheme.find(f"{_DML}{slot}")
                    if el is not None:
                        hex_color = _hex_from_srgb(el)
                        if hex_color:
                            color_scheme[slot] = hex_color

            # Font scheme
            font_el = root.find(f".//{_DML}fontScheme")
            if font_el is not None:
                major = font_el.find(f".//{_DML}majorFont/{_DML}latin")
                minor = font_el.find(f".//{_DML}minorFont/{_DML}latin")
                if major is not None:
                    font_scheme["major"] = major.get("typeface", "Calibri Light")
                if minor is not None:
                    font_scheme["minor"] = minor.get("typeface", "Calibri")

    except Exception as e:
        logger.warning("Could not extract theme info from %s: %s", abs_pptx_path, e)

    return color_scheme, font_scheme


def count_slides(abs_pptx_path: str) -> int:
    """Return number of slides in the PPTX."""
    try:
        prs = Presentation(abs_pptx_path)
        return len(prs.slides)
    except Exception:
        return 0


# ─── Theme application at export time ────────────────────────────────────────

def apply_designer_theme(prs: Presentation, abs_template_path: str) -> None:
    """
    Copy the slide master and theme XML from the designer template into `prs`.
    This applies the designer's background, color scheme, and fonts to the
    generated presentation while keeping the AI-generated content layout intact.

    Strategy:
    1. Load the designer template.
    2. Replace prs's theme1.xml with the designer theme1.xml.
    3. Copy the slide master background fill so slides inherit it.
    """
    try:
        import zipfile, io, copy
        from lxml import etree

        # ── Copy theme XML ────────────────────────────────────────────────────
        with zipfile.ZipFile(abs_template_path) as zt:
            theme_files = [n for n in zt.namelist() if re.match(r"ppt/theme/theme\d+\.xml", n)]
            if not theme_files:
                return
            designer_theme_xml = zt.read(theme_files[0])

        # Find the theme part in the target presentation's package
        from pptx.opc.packuri import PackURI
        from pptx.opc.part import Part

        slide_master = prs.slide_master
        theme_part = None
        for rel in slide_master.part.rels.values():
            if "theme" in rel.reltype.lower():
                theme_part = rel._target
                break

        if theme_part is not None:
            # Replace the blob (raw XML bytes) of the theme part
            new_root = etree.fromstring(designer_theme_xml)
            theme_part._blob = etree.tostring(new_root, xml_declaration=True, encoding="UTF-8", standalone=True)

        # ── Copy slide master background fill ─────────────────────────────────
        designer_prs = Presentation(abs_template_path)
        if designer_prs.slide_masters:
            d_master = designer_prs.slide_masters[0]
            d_bg = d_master.element.find(
                ".//{http://schemas.openxmlformats.org/presentationml/2006/main}bg"
            )
            if d_bg is not None:
                t_master_el = slide_master.element
                existing_bg = t_master_el.find(
                    ".//{http://schemas.openxmlformats.org/presentationml/2006/main}bg"
                )
                if existing_bg is not None:
                    t_master_el.remove(existing_bg)
                # Insert after cSld element
                cSld = t_master_el.find(
                    "{http://schemas.openxmlformats.org/presentationml/2006/main}cSld"
                )
                if cSld is not None:
                    idx = list(t_master_el).index(cSld)
                    t_master_el.insert(idx + 1, copy.deepcopy(d_bg))

    except Exception as e:
        logger.warning("Could not apply designer theme (non-fatal): %s", e)


def resolve_template_abs_path(file_path: str) -> str:
    """Convert relative file_path (stored in DB) to absolute filesystem path."""
    return str(Path(get_app_data_directory_env()) / file_path)
