# Designer Template Guide

How to create a professional PPTX template that works with the platform.

---

## Overview

Designers create standard PowerPoint (.pptx) files and upload them via the Admin Panel → **Designer Templates**. The platform:

1. Extracts your color palette and font scheme
2. Generates thumbnail previews (one per slide) automatically
3. Applies your theme (colors, fonts, backgrounds) to any presentation the user exports as PPTX or PDF

---

## What you need: PowerPoint (or Keynote → export as .pptx)

Any version of Microsoft PowerPoint works. Keynote users can export as .pptx via File → Export To → PowerPoint.

---

## Slide convention (one slide per layout type)

Your .pptx file acts as a **layout library**. Each slide defines one visual style. The more layouts you include, the better the output will look.

| Slide | Layout type | Use for |
|-------|-------------|---------|
| 1 | Cover / Title | First slide of every presentation |
| 2 | Section header | Chapter dividers |
| 3 | Title + bullets | Most content slides |
| 4 | Two columns | Comparison slides |
| 5 | Image left + text right | Image-heavy slides |
| 6 | Big quote / stat | Emphasis slides |
| 7 | Closing / Thank you | Last slide |
| 8+ | Any additional layouts | Optional extras |

> **Tip:** A template with at least slides 1, 3, and 7 is already useful. More variety = better output.

---

## What controls the output theme

The platform reads these from your file at upload time:

| Element | Where to set it in PowerPoint | Effect on output |
|---------|-------------------------------|-----------------|
| **Accent colors** (accent1–accent6) | Design → Variants → Colors → Customize | Charts, shapes, highlights |
| **Dark/light colors** (dk1, lt1, dk2, lt2) | Same as above | Text and background defaults |
| **Heading font** (majorFont) | Design → Variants → Fonts → Customize | Slide titles |
| **Body font** (minorFont) | Same as above | Bullet points and body text |
| **Slide master background** | View → Slide Master → Background Styles | Applied to all slides |

### How to set a custom color palette in PowerPoint

1. Go to **Design** tab → **Variants** (right section) → dropdown → **Colors** → **Customize Colors…**
2. Set Accent 1–6 to your brand colors
3. Set Text/Background colors as needed
4. Save with your template name

### How to set custom fonts

1. **Design** → **Variants** → **Fonts** → **Customize Fonts…**
2. Set Heading font and Body font
3. Save

---

## Backgrounds

- Set the slide master background to your brand color, gradient, or image
- Go to **View → Slide Master**, click the first (master) slide, then **Format Background**
- This background will be extracted and applied to the user's exported presentation

---

## File requirements

| Requirement | Detail |
|-------------|--------|
| Format | .pptx only |
| Max file size | 50 MB |
| Slides | 1–50 slides recommended |
| Fonts | Embed fonts if using non-system fonts (File → Options → Save → Embed fonts) |
| Images | Keep image resolution reasonable (1920×1080 max per image) |

---

## Upload process

1. Log in as **Admin** → go to `/admin`
2. Scroll to **Designer Templates** section
3. Enter a name, optional description, and select Free or Premium tier
4. Select your .pptx file and click **Upload Template**
5. Thumbnails are generated automatically within ~30 seconds
6. Toggle **Show/Hide** and **Free/Premium** at any time

---

## What users see

- A new **"Designer"** tab appears on the Templates page once at least one designer template is uploaded
- Premium templates show a lock icon to free users and redirect to the billing/upgrade page
- Pro and Team users have full access

---

## FAQ

**Q: Do I need to use PowerPoint placeholders?**  
A: No. The platform reads the visual theme from your file — fonts, colors, backgrounds — and applies them at export time. Your slide content layout (shapes, text boxes, images) is for visual reference only.

**Q: Can I update a template after uploading?**  
A: Delete the old one and upload a new version. The delete button is in the Designer Templates admin section.

**Q: What if thumbnails don't appear?**  
A: Thumbnail generation takes up to 30 seconds after upload. Refresh the admin page. If they still don't appear, check that LibreOffice is installed in the FastAPI container (`docker exec fastapi libreoffice --version`).

**Q: Can designers use Canva, Figma, or Google Slides?**  
A: Export to .pptx format from any tool. Google Slides: File → Download → Microsoft PowerPoint. Canva: Share → Download → PPTX.

**Q: Are fonts embedded in the output?**  
A: The platform applies the theme's font names. If those fonts are not installed on the user's device, PowerPoint will substitute similar fonts. Embed fonts in your source file for best results.
