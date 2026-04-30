from typing import List, Optional
from datetime import datetime
import uuid

from pydantic import BaseModel

from models.sql.slide import SlideModel


class PresentationWithSlides(BaseModel):
    id: uuid.UUID
    content: str
    n_slides: int
    language: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tone: Optional[str] = None
    verbosity: Optional[str] = None
    theme: Optional[dict] = None
    pptx_template_id: Optional[int] = None
    slides: List[SlideModel]
    visibility: str = "private"
    user_id: Optional[int] = None
    org_id: Optional[int] = None
