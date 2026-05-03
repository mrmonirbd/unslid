import os
import shutil
import tempfile
import subprocess
from xml.sax.saxutils import escape
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import pdfplumber

from services.documents_loader import DocumentsLoader
from utils.asset_directory_utils import get_images_directory
import uuid
from constants.documents import PDF_MIME_TYPES


PDF_SLIDES_ROUTER = APIRouter(prefix="/pdf-slides", tags=["PDF Slides"])


def _is_pdf_upload(file: UploadFile) -> bool:
    filename = (file.filename or "").lower()
    return file.content_type in PDF_MIME_TYPES or filename.endswith(".pdf")


class PdfSlideData(BaseModel):
    slide_number: int
    screenshot_url: str
    xml_content: str = ""


class PdfSlidesResponse(BaseModel):
    success: bool
    slides: List[PdfSlideData]
    total_slides: int


@PDF_SLIDES_ROUTER.post("/process", response_model=PdfSlidesResponse)
async def process_pdf_slides(
    pdf_file: UploadFile = File(..., description="PDF file to process")
):
    """
    Process a PDF file to extract slide screenshots.

    This endpoint:
    1. Validates the uploaded PDF file
    2. Uses ImageMagick to convert PDF pages to PNG images
    3. Returns screenshot URLs for each slide/page

    Note: Font installation is not needed since PDFs already have fonts embedded.
    """

    # Validate PDF file
    if not _is_pdf_upload(pdf_file):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Expected PDF file, got {pdf_file.content_type}",
        )
    # Enforce 100MB size limit
    if (
        hasattr(pdf_file, "size")
        and pdf_file.size
        and pdf_file.size > (100 * 1024 * 1024)
    ):
        raise HTTPException(
            status_code=400,
            detail="PDF file exceeded max upload size of 100 MB",
        )

    # Create temporary directory for processing
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Save uploaded PDF file
            pdf_path = os.path.join(temp_dir, "presentation.pdf")
            with open(pdf_path, "wb") as f:
                pdf_content = await pdf_file.read()
                f.write(pdf_content)

            # Generate screenshots from PDF using ImageMagick
            screenshot_paths = await DocumentsLoader.get_page_images_from_pdf_async(
                pdf_path, temp_dir
            )
            text_xmls = _extract_pdf_text_as_synthetic_xml(pdf_path)
            print(f"Generated {len(screenshot_paths)} PDF screenshots")

            # Move screenshots to images directory and generate URLs
            images_dir = get_images_directory()
            presentation_id = uuid.uuid4()
            presentation_images_dir = os.path.join(images_dir, str(presentation_id))
            os.makedirs(presentation_images_dir, exist_ok=True)

            slides_data = []

            for i, screenshot_path in enumerate(screenshot_paths, 1):
                # Move screenshot to permanent location
                screenshot_filename = f"slide_{i}.png"
                permanent_screenshot_path = os.path.join(
                    presentation_images_dir, screenshot_filename
                )

                if (
                    os.path.exists(screenshot_path)
                    and os.path.getsize(screenshot_path) > 0
                ):
                    # Use shutil.copy2 instead of os.rename to handle cross-device moves
                    shutil.copy2(screenshot_path, permanent_screenshot_path)
                    screenshot_url = (
                        f"/app_data/images/{presentation_id}/{screenshot_filename}"
                    )
                else:
                    # Fallback if screenshot generation failed or file is empty placeholder
                    screenshot_url = "/static/images/placeholder.jpg"

                slides_data.append(
                    PdfSlideData(
                        slide_number=i,
                        screenshot_url=screenshot_url,
                        xml_content=text_xmls[i - 1] if i - 1 < len(text_xmls) else "",
                    )
                )

            return PdfSlidesResponse(
                success=True, slides=slides_data, total_slides=len(slides_data)
            )

        except Exception as e:
            print(f"Error processing PDF slides: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to process PDF: {str(e)}"
            )


def _extract_pdf_text_as_synthetic_xml(pdf_path: str) -> list[str]:
    """Return PPTX-like XML fragments so the frontend can create editable text boxes."""
    slides: list[str] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                words = page.extract_words(
                    x_tolerance=2,
                    y_tolerance=3,
                    keep_blank_chars=False,
                    use_text_flow=True,
                )
                lines: list[list[dict]] = []
                for word in words:
                    placed = False
                    word_top = float(word.get("top", 0))
                    for line in lines:
                        line_top = sum(float(w.get("top", 0)) for w in line) / max(len(line), 1)
                        if abs(line_top - word_top) <= 4:
                            line.append(word)
                            placed = True
                            break
                    if not placed:
                        lines.append([word])

                page_width = float(page.width or 1)
                page_height = float(page.height or 1)
                shape_xml = []
                for line in lines:
                    line.sort(key=lambda w: float(w.get("x0", 0)))
                    text = " ".join(w.get("text", "") for w in line).strip()
                    if not text:
                        continue
                    x0 = min(float(w.get("x0", 0)) for w in line)
                    x1 = max(float(w.get("x1", x0)) for w in line)
                    top = min(float(w.get("top", 0)) for w in line)
                    bottom = max(float(w.get("bottom", top + 12)) for w in line)
                    height = max(8, bottom - top)
                    emu_x = int((x0 / page_width) * 12192000)
                    emu_y = int((top / page_height) * 6858000)
                    emu_w = int(((x1 - x0) / page_width) * 12192000)
                    emu_h = int((height / page_height) * 6858000)
                    sz = int(max(8, min(72, height)) / 1.333 * 100)
                    shape_xml.append(
                        f"""
<sp>
  <xfrm><off x="{emu_x}" y="{emu_y}" /><ext cx="{emu_w}" cy="{emu_h}" /></xfrm>
  <txBody><p><r><rPr sz="{sz}" /><t>{escape(text)}</t></r></p></txBody>
</sp>"""
                    )
                slides.append(f"<slide>{''.join(shape_xml)}</slide>")
    except Exception as e:
        print(f"Warning: failed to extract PDF text boxes: {e}")
    return slides
