"""Render the original MIT project mark; no external brand assets. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
scale = 3
image = Image.new("RGB", (480*scale, 480*scale), "#146a59")
draw = ImageDraw.Draw(image)
def box(bounds, radius, color):
    draw.rounded_rectangle(tuple(v*scale for v in bounds), radius*scale, fill=color)
def line(bounds, width, color):
    draw.line(tuple(v*scale for v in bounds), fill=color, width=width*scale)
    r = width*scale/2
    for x, y in [(bounds[0]*scale,bounds[1]*scale),(bounds[2]*scale,bounds[3]*scale)]:
        draw.ellipse((x-r,y-r,x+r,y+r),fill=color)
box((111,105,325,365),19,"#a6c9b8")
box((141,79,355,339),19,"#f2f6f4")
for x2,y in [(305,136),(274,174),(305,212)]: line((179,y,x2,y),14,"#146a59")
for x,color in [(207,"#146a59"),(283,"#bd862e")]:
    draw.ellipse(((x-23)*scale,258*scale,(x+23)*scale,304*scale),fill=color)
line((230,281,260,281),10,"#547075")
out = root/"assets/logo.png"
image.resize((480,480),Image.Resampling.LANCZOS).save(out,optimize=True)
print(f"Original RGB logo: {out.name}, 480x480, {out.stat().st_size} bytes")
