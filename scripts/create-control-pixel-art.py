"""Draw new Dystopia control icons on integer grids; originals are never read or changed."""
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/ui/controls/pixel'
PAL={'edge':'#110e15','body':'#281923','shadow':'#382531','line':'#778e91','cream':'#e6d1ac','bright':'#fff0d1','cyan':'#7dc4bd','wine':'#9d6076'}
def tile(size):
 im=Image.new('RGBA',(size,size));d=ImageDraw.Draw(im);m=size-2
 d.polygon([(5,1),(m-4,1),(m,5),(m,m-4),(m-4,m),(5,m),(1,m-4),(1,5)],fill=PAL['edge'])
 d.polygon([(6,3),(m-5,3),(m-2,6),(m-2,m-5),(m-5,m-2),(6,m-2),(3,m-5),(3,6)],fill=PAL['line'])
 d.polygon([(7,4),(m-6,4),(m-3,7),(m-3,m-6),(m-6,m-3),(7,m-3),(4,m-6),(4,7)],fill=PAL['body'])
 d.line([(6,m-5),(m-6,m-5),(m-5,m-6)],fill=PAL['wine'],width=1)
 d.line([(6,7),(6,m-8)],fill=PAL['shadow'],width=1)
 return im,d
def attack():
 im,d=tile(44)
 # One broad, readable katana silhouette, ivory blade and a diagonal steel spine.
 d.polygon([(12,30),(26,16),(35,8),(32,19),(19,32),(16,34)],fill=PAL['edge'])
 d.polygon([(14,29),(27,16),(34,10),(30,20),(18,32)],fill=PAL['cream'])
 d.line([(17,29),(29,17),(32,13)],fill=PAL['bright'],width=2)
 d.line([(18,31),(29,20),(31,16)],fill=PAL['line'],width=1)
 d.line([(10,26),(21,37)],fill=PAL['edge'],width=4)
 d.line([(11,27),(20,36)],fill=PAL['wine'],width=2)
 d.line([(14,33),(9,38)],fill=PAL['edge'],width=5)
 d.line([(14,34),(10,38)],fill=PAL['line'],width=2)
 d.rectangle((8,37,10,39),fill=PAL['cream'])
 d.line([(29,7),(29,4)],fill=PAL['cyan']);d.line([(27,5),(31,5)],fill=PAL['cyan'])
 return im
def dash():
 im,d=tile(36)
 # Two bright directional afterimages with a compact forward slash; no text.
 for x,c in [(9,PAL['line']),(16,PAL['cyan'])]:
  d.polygon([(x,9),(x+5,9),(x+13,17),(x+5,26),(x,26),(x+8,17)],fill=PAL['edge'])
  d.polygon([(x+1,10),(x+4,10),(x+11,17),(x+4,25),(x+1,25),(x+8,17)],fill=c)
 d.line([(5,13),(9,13)],fill=PAL['wine'],width=1)
 d.line([(4,18),(11,18)],fill=PAL['cream'],width=1)
 d.line([(5,22),(8,22)],fill=PAL['line'],width=1)
 d.line([(25,12),(29,16)],fill=PAL['bright'],width=1)
 return im
OUT.mkdir(parents=True,exist_ok=True)
for name,im in [('attack',attack()),('dash',dash())]:
 im=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST)
 im.save(OUT/f'{name}.png',optimize=True)
 print(name,im.size,len(im.getcolors()),'RGBA',im.getpixel((0,0)))
