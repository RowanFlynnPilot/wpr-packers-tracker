# Generates public/og-card.png — the 1200x630 social share card (og:image / twitter:image).
# One-time asset; rerun after a branding change:  python scripts/og-card.py
# Downloads brand fonts (Google Fonts repo) and the WPR logo at build time; nothing ships at runtime.
import io
import math
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og-card.png"

GREEN = (32, 55, 49)
GOLD = (255, 182, 18)
PAPER = (247, 245, 240)
MUTED_SAGE = (207, 216, 211)

FRAUNCES = "https://raw.githubusercontent.com/google/fonts/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
PUBLIC_SANS = "https://raw.githubusercontent.com/google/fonts/main/ofl/publicsans/PublicSans%5Bwght%5D.ttf"
WPR_LOGO = "https://wausaupilotandreview.com/wp-content/uploads/2024/04/WausauPilotandReviewLogo.png"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r:
        return r.read()


def font(data, size, weight=None):
    f = ImageFont.truetype(io.BytesIO(data), size)
    if weight is not None:
        try:
            axes = [weight if a.axis == "wght" else a.default for a in f.get_variation_axes()]
            f.set_variation_by_axes(axes)
        except Exception:
            pass
    return f


def football(img, cx, cy, rx, ry, angle=-32):
    """A gold football with laces, rotated onto the card's right side. Generic art, no team marks."""
    size = (rx * 2 + 40, ry * 2 + 40)
    ball = Image.new("RGBA", size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(ball)
    bcx, bcy = size[0] // 2, size[1] // 2
    bd.ellipse([bcx - rx, bcy - ry, bcx + rx, bcy + ry], fill=GOLD + (255,), outline=(214, 148, 0, 255), width=5)
    # Seam line + laces
    bd.line([bcx - rx * 0.55, bcy, bcx + rx * 0.55, bcy], fill=GREEN + (255,), width=8)
    for i in range(-2, 3):
        x = bcx + i * rx * 0.18
        bd.line([x, bcy - ry * 0.16, x, bcy + ry * 0.16], fill=GREEN + (255,), width=7)
    ball = ball.rotate(angle, expand=True, resample=Image.BICUBIC)
    img.paste(ball, (cx - ball.width // 2, cy - ball.height // 2), ball)


def main():
    fraunces = fetch(FRAUNCES)
    public_sans = fetch(PUBLIC_SANS)
    logo = Image.open(io.BytesIO(fetch(WPR_LOGO))).convert("RGBA")

    img = Image.new("RGB", (1200, 630), GREEN)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1200, 10], fill=GOLD)

    football(img, 990, 330, 190, 118)
    d = ImageDraw.Draw(img)

    kicker = font(public_sans, 26, weight=700)
    d.text((80, 96), "W A U S A U   P I L O T   &   R E V I E W", font=kicker, fill=GOLD)

    head = font(fraunces, 78, weight=600)
    d.text((76, 162), "The Packers,", font=head, fill="white")
    d.text((76, 254), "by the numbers", font=head, fill="white")

    sub = font(public_sans, 29, weight=400)
    d.text((80, 396), "Live standings · the NFC North race · the schedule ·", font=sub, fill=MUTED_SAGE)
    d.text((80, 438), "team leaders — updated all season long", font=sub, fill=MUTED_SAGE)

    # WPR logo on a white chip, bottom-left.
    logo_w = 300
    logo_h = round(logo.height * logo_w / logo.width)
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    pad = 16
    chip = Image.new("RGBA", (logo_w + pad * 2, logo_h + pad * 2), (255, 255, 255, 255))
    mask = Image.new("L", chip.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, chip.width, chip.height], radius=12, fill=255)
    img.paste(chip, (78, 630 - chip.height - 52), mask)
    img.paste(logo, (78 + pad, 630 - chip.height - 52 + pad), logo)

    OUT.parent.mkdir(exist_ok=True)
    img.save(OUT, "PNG")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
