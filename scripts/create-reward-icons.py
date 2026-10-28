"""Original 16px reward symbols; never modifies source artwork."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/ui/rewards'
OUT.mkdir(parents=True, exist_ok=True)
P = {'o': '#18161e', 'd': '#281923', 'w': '#9d6076', 'l': '#e6d1ac', 's': '#778e91', 'c': '#7dc4bd', 'h': '#f4e6cc'}
icons = []

def start():
    im = Image.new('RGBA', (16, 16))
    return im, ImageDraw.Draw(im)

def box(d, xy, color):
    d.rectangle(xy, fill=P[color])

def line(d, points, color, width=1):
    d.line(points, fill=P[color], width=width)

def poly(d, points, color):
    d.polygon(points, fill=P[color])

def save(name, im):
    im.resize((32, 32), Image.Resampling.NEAREST).save(OUT / (name + '.png'))
    icons.append(im)

im, d = start()
box(d,(5,2,10,4),'o');box(d,(6,3,9,4),'s');box(d,(2,4,13,13),'o');box(d,(3,5,12,12),'s');box(d,(3,5,12,6),'l');box(d,(3,10,12,12),'d')
box(d,(6,6,9,11),'o');box(d,(7,6,8,11),'c');box(d,(5,8,10,9),'c');box(d,(4,7,4,8),'h')
save('field-kit', im)

im, d = start()
for xy in [(6,1,9,3),(6,12,9,14),(1,6,3,9),(12,6,14,9)]:box(d,xy,'o')
poly(d,[(4,3),(11,3),(13,5),(13,10),(11,12),(4,12),(2,10),(2,5)],'o')
poly(d,[(5,4),(10,4),(12,6),(12,9),(10,11),(5,11),(3,9),(3,6)],'s');box(d,(5,5,10,10),'d')
line(d,[(6,10),(10,4)],'h',2);line(d,[(5,10),(8,12)],'w');box(d,(7,1,8,2),'l');box(d,(1,7,2,8),'l')
save('attack-servo', im)

im, d = start()
poly(d,[(5,2),(11,2),(11,9),(14,11),(14,13),(4,13),(3,11),(5,8)],'o')
poly(d,[(6,3),(10,3),(10,9),(13,11),(13,12),(5,12),(4,11),(6,8)],'s')
box(d,(6,3,10,4),'l');box(d,(6,6,9,6),'c');box(d,(6,8,9,8),'c');box(d,(4,12,13,12),'l')
line(d,[(1,5),(3,5)],'w');line(d,[(0,8),(3,8)],'c');line(d,[(1,11),(2,11)],'l')
save('assault-boots', im)

im, d = start()
box(d,(4,2,11,13),'o');box(d,(5,3,10,12),'d');box(d,(3,2,12,3),'s');box(d,(3,12,12,13),'s')
for y in [4,6,8,10]:line(d,[(3,y),(11,y+1)],'c');box(d,(3,y,4,y),'l')
poly(d,[(9,1),(6,7),(8,7),(6,14),(11,6),(9,6)],'l')
save('frenesis-coil', im)

im, d = start()
poly(d,[(2,2),(6,2),(6,9),(7,10),(8,10),(9,9),(9,2),(13,2),(13,10),(10,14),(5,14),(2,10)],'o')
poly(d,[(3,3),(5,3),(5,9),(7,12),(8,12),(10,9),(10,3),(12,3),(12,10),(9,13),(6,13),(3,10)],'s')
box(d,(3,3,5,5),'w');box(d,(10,3,12,5),'c');box(d,(3,3,5,3),'l');box(d,(10,3,12,3),'h')
save('magnet', im)

im, d = start()
line(d,[(2,3),(7,7),(2,12)],'o',3);line(d,[(8,3),(13,7),(8,12)],'o',3)
line(d,[(2,3),(7,7),(2,12)],'s');line(d,[(8,3),(13,7),(8,12)],'c');line(d,[(0,6),(3,6)],'l');line(d,[(0,9),(3,9)],'w')
save('dash', im)

im, d = start()
line(d,[(4,12),(12,2)],'o',4);line(d,[(5,11),(12,2)],'l',2);line(d,[(3,10),(8,14)],'s',2);line(d,[(2,14),(4,12)],'w',2)
line(d,[(2,2),(6,2)],'c');line(d,[(2,2),(2,6)],'c');line(d,[(10,13),(13,13),(13,10)],'c')
save('reach', im)

im, d = start()
poly(d,[(7,1),(13,6),(10,13),(6,15),(2,7)],'o');poly(d,[(7,2),(12,6),(9,12),(6,14),(3,7)],'c')
poly(d,[(7,2),(8,7),(3,7)],'h');poly(d,[(8,7),(12,6),(9,12),(6,14)],'s');line(d,[(8,7),(6,14)],'l')
save('experience', im)

im, d = start()
poly(d,[(2,3),(5,2),(8,4),(11,2),(14,3),(14,7),(8,14),(2,7)],'o');poly(d,[(3,4),(5,3),(8,5),(11,3),(13,4),(13,7),(8,12),(3,7)],'w')
box(d,(7,5,8,10),'l');box(d,(5,7,10,8),'l');box(d,(4,4,5,4),'c')
save('heal', im)

# Explicit opt-in review destination avoids shipping a contact sheet as an icon.
if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        review = Image.new('RGBA', (len(icons)*96, 96), (10,10,14,255))
        for i, image in enumerate(icons):
            review.alpha_composite(image.resize((64,64),Image.Resampling.NEAREST),(i*96+16,16))
        review.save(sys.argv[1])
