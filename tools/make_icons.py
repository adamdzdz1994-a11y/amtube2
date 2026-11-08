"""Draws the AMTube launcher icon (adaptive + legacy + monochrome) into app/src/main/res. Needs Pillow."""
import os
from PIL import Image, ImageDraw, ImageFilter

RES = os.path.join(os.path.dirname(__file__), "..", "app", "src", "main", "res")
BG = (15, 19, 32)
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def lerp(c0, c1, t):
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))


def art(S, mono=False):
    """The mark on a transparent S x S canvas (S = 108dp worth of pixels). Content stays inside the 66dp safe zone."""
    K = 4
    big = S * K
    u = big / 108.0                                    # 1 unit = 1dp
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    d.polygon([(36 * u, 30 * u), (36 * u, 76 * u), (76 * u, 53 * u)], fill=255)         # play triangle
    mask = mask.filter(ImageFilter.GaussianBlur(3.2 * u)).point(lambda v: 255 if v >= 128 else 0)
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if mono:
        out.paste(Image.new("RGBA", (big, big), (255, 255, 255, 255)), (0, 0), mask)
    else:
        g = Image.new("RGB", (64, 64))
        px = g.load()
        for y in range(64):
            for x in range(64):
                px[x, y] = lerp((255, 214, 64), (255, 128, 0), min(1.0, (x * .6 + y * 1.0) / 100))
        g = g.resize((big, big), Image.BICUBIC).convert("RGBA")
        g.putalpha(mask)
        glow = mask.filter(ImageFilter.GaussianBlur(5 * u)).point(lambda v: int(v * .45))
        gl = Image.new("RGBA", (big, big), (255, 150, 0, 0))
        gl.putalpha(glow)
        out.alpha_composite(gl)
        out.alpha_composite(g)
    # download badge (bottom-right)
    bd = ImageDraw.Draw(out)
    cx, cy, r = 68 * u, 68 * u, 14 * u
    if mono:
        bd.ellipse([cx - r - 3 * u, cy - r - 3 * u, cx + r + 3 * u, cy + r + 3 * u], fill=(0, 0, 0, 0))
        bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
        col = (0, 0, 0, 0)
    else:
        bd.ellipse([cx - r - 3 * u, cy - r - 3 * u, cx + r + 3 * u, cy + r + 3 * u], fill=BG + (255,))
        bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
        col = BG + (255,)
    w = 3.4 * u
    bd.line([(cx, cy - 6.5 * u), (cx, cy + 5 * u)], fill=col, width=int(w))
    bd.line([(cx - 6.5 * u, cy - 1.5 * u), (cx, cy + 6 * u), (cx + 6.5 * u, cy - 1.5 * u)], fill=col, width=int(w), joint="curve")
    for x, y in ((cx, cy - 7 * u), (cx - 6.5 * u, cy - 1.5 * u), (cx + 6.5 * u, cy - 1.5 * u), (cx, cy + 6 * u)):
        bd.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)
    return out.resize((S, S), Image.LANCZOS)


def legacy(S, round_=False):
    big = S * 4
    base = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    m = Image.new("L", (big, big), 0)
    dm = ImageDraw.Draw(m)
    if round_:
        dm.ellipse([0, 0, big - 1, big - 1], fill=255)
    else:
        dm.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * .22), fill=255)
    bg = Image.new("RGBA", (big, big), BG + (255,))
    # soft top-left light so the icon is not flat
    hl = Image.new("L", (big, big), 0)
    ImageDraw.Draw(hl).ellipse([-big * .3, -big * .5, big * .9, big * .5], fill=40)
    hl = hl.filter(ImageFilter.GaussianBlur(big * .08))
    w = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    w.putalpha(hl)
    bg.alpha_composite(w)
    a = art(int(S * 108 / 72 * 1.0), False).resize((int(big * 1.5 * 0.72 / 0.72 * 0.66 / 0.66), int(big * 1.5 * 0.72 / 0.72 * 0.66 / 0.66)), Image.LANCZOS) if False else art(S * 4, False)
    # the adaptive art uses a 108dp canvas with a 66dp safe zone; for legacy icons zoom so the mark fills ~64%
    z = 1.3
    a = a.resize((int(big * z), int(big * z)), Image.LANCZOS)
    off = (big - a.size[0]) // 2
    bg.alpha_composite(a, (off, off))
    base.paste(bg, (0, 0), m)
    return base.resize((S, S), Image.LANCZOS)


def main():
    for dens, f in DENS.items():
        d = os.path.join(RES, "mipmap-" + dens)
        os.makedirs(d, exist_ok=True)
        legacy(int(48 * f)).save(os.path.join(d, "ic_launcher.png"))
        legacy(int(48 * f), True).save(os.path.join(d, "ic_launcher_round.png"))
        art(int(108 * f)).save(os.path.join(d, "ic_launcher_foreground.png"))
        art(int(108 * f), True).save(os.path.join(d, "ic_launcher_monochrome.png"))
    art(432).save(os.path.join(os.path.dirname(__file__), "..", "docs", "icon_foreground.png"))
    legacy(512).save(os.path.join(os.path.dirname(__file__), "..", "docs", "icon_preview.png"))
    print("icons written")


if __name__ == "__main__":
    main()
