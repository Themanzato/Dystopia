"""Build a reusable pixel alphabet from Dystopia's original UI words.
All source PNGs stay untouched. Missing glyphs are assembled from the pack's
own strokes; no font, external image or generated artwork is downloaded.
Run normally to regenerate; --check verifies the reproducible atlas/metadata.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/assets/UI/UI - Words/Words without BG'
OUT=ROOT/'assets/ui/font'
CROPS={
 'A':(2,56,11),'B':(8,25,9),'C':(1,8,9),'D':(6,44,9),
 'E':(1,79,6),'G':(4,64,9),'I':(1,51,3),'K':(8,58,10),
 'L':(7,39,6),'M':(10,4,11),'N':(1,30,9),'O':(1,19,9),
 'P':(9,23,9),'Q':(3,28,10),'R':(6,24,9),'S':(4,10,9),
 'T':(1,41,9),'U':(1,68,9),'V':(13,48,9),'W':(2,25,15),'X':(14,38,9),
}
def crop(region):
 word,x,w=region
 return Image.open(SRC/f'UI - Words{word}.png').convert('RGBA').crop((x,7,x+w,25))
def build():
 glyphs={c:crop(r) for c,r in CROPS.items()}
 # F is E without its lower arm. Other absent letters reuse I/U/X strokes.
 glyphs['F']=glyphs['E'].copy()
 glyphs['F'].paste((0,0,0,0),(3,15,6,18))
 h=Image.new('RGBA',(9,18));h.paste(glyphs['I'],(0,0));h.paste(glyphs['I'],(6,0))
 h.paste(glyphs['T'].crop((0,0,9,3)),(0,7));glyphs['H']=h
 j=glyphs['U'].copy();j.paste((0,0,0,0),(0,0,6,12));glyphs['J']=j
 y=Image.new('RGBA',(9,18));y.paste(glyphs['X'].crop((0,0,9,9)),(0,0));y.paste(glyphs['I'].crop((0,9,3,18)),(3,9));glyphs['Y']=y
 z=Image.new('RGBA',(9,18));z.paste(glyphs['T'].crop((0,0,9,3)),(0,0));z.paste(glyphs['T'].crop((0,0,9,3)),(0,15))
 for yy,x in [(3,6),(6,4),(9,2),(12,0)]:z.paste(glyphs['I'].crop((0,yy,3,yy+3)),(x,yy))
 glyphs['Z']=z
 # Digits use the same 3px vertical stem and sampled original UI palette.
 patterns={'0':['111','101','101','101','101','111'],'1':['010','110','010','010','010','111'],
 '2':['111','001','001','111','100','111'],'3':['111','001','011','001','001','111'],
 '4':['101','101','111','001','001','001'],'5':['111','100','111','001','001','111'],
 '6':['111','100','111','101','101','111'],'7':['111','001','001','010','010','010'],
 '8':['111','101','111','101','101','111'],'9':['111','101','111','001','001','111']}
 for c,rows in patterns.items():
  im=Image.new('RGBA',(9,18))
  for yy,row in enumerate(rows):
   for xx,on in enumerate(row):
    if on=='1':im.paste(glyphs['I'].crop((0,yy*3,3,yy*3+3)),(xx*3,yy*3))
  glyphs[c]=im
 white=glyphs['I'].getpixel((1,1));gray=glyphs['I'].getpixel((1,16))
 punctuation={'.':(3,[(0,15,2,17)]),',':(3,[(0,14,2,16),(0,17,1,17)]),
 ':':(3,[(0,5,2,7),(0,13,2,15)]),';':(3,[(0,5,2,7),(0,13,2,15),(0,16,1,17)]),
 '-':(6,[(0,8,5,10)]),'_':(9,[(0,15,8,17)]),
 '!':(3,[(0,0,2,11),(0,15,2,17)]),'?':(9,[(0,0,8,2),(6,3,8,7),(3,7,8,9),(3,9,5,11),(3,15,5,17)]),
 "'":(3,[(0,0,2,5)]),'"':(7,[(0,0,2,5),(4,0,6,5)]),
 '(':(6,[(3,0,5,2),(0,3,2,14),(3,15,5,17)]),')':(6,[(0,0,2,2),(3,3,5,14),(0,15,2,17)]),
 '%':(15,[(0,0,5,1),(0,0,1,6),(4,0,5,6),(0,5,5,6),
 (9,11,14,12),(9,11,10,17),(13,11,14,17),(9,16,14,17),
 (12,0,14,2),(9,3,11,5),(6,6,8,8),(3,9,5,11),(0,12,2,14)]),
 '/':(9,[(6,0,8,5),(3,6,5,11),(0,12,2,17)]),'+':(9,[(3,3,5,14),(0,7,8,9)])}
 for c,(w,rects) in punctuation.items():
  im=Image.new('RGBA',(w,18));d=ImageDraw.Draw(im)
  for r in rects:d.rectangle(r,fill=white)
  glyphs[c]=im
 glyphs[' ']=Image.new('RGBA',(6,18))
 extended={}
 for c,im in glyphs.items():
  canvas=Image.new('RGBA',(im.width,24));canvas.paste(im,(0,6));extended[c]=canvas
 for c,base in [('Á','A'),('É','E'),('Í','I'),('Ó','O'),('Ú','U')]:
  im=extended[base].copy();d=ImageDraw.Draw(im);x=max(0,im.width//2-1);d.rectangle((x,2,x+1,4),fill=white);d.point((min(im.width-1,x+2),1),fill=white);extended[c]=im
 n=extended['N'].copy();d=ImageDraw.Draw(n);d.line([(1,3),(2,2),(4,3),(6,4),(7,2)],fill=white,width=2);extended['Ñ']=n
 u=extended['U'].copy();d=ImageDraw.Draw(u);d.rectangle((1,2,2,4),fill=white);d.rectangle((6,2,7,4),fill=white);extended['Ü']=u
 for c,base in [('¿','?'),('¡','!')]:
  im=Image.new('RGBA',(extended[base].width,24));im.paste(glyphs[base].transpose(Image.Transpose.ROTATE_180),(0,6));extended[c]=im
 chars=sorted(extended)
 atlas=Image.new('RGBA',(128,26*((len(chars)+7)//8)))
 meta={}
 for i,c in enumerate(chars):
  im=extended[c];x=(i%8)*16;y=(i//8)*26
  atlas.paste(im,(x,y));meta[c]={'x':x,'y':y,'width':im.width,'height':24}
 return atlas,meta

def main():
 atlas,meta=build();check='--check' in sys.argv
 metadata='// Reproducibly derived by scripts/create-pixel-font.py; original UI files stay unchanged.\nexport const PIXEL_FONT_WIDTH = %d;\nexport const PIXEL_FONT_HEIGHT = %d;\nexport const PIXEL_GLYPHS = %s as const;\n'%(atlas.width,atlas.height,json.dumps(meta,ensure_ascii=False,indent=2))
 if check:
  actual=Image.open(OUT/'ui-alphabet.png').convert('RGBA')
  assert actual.size==atlas.size and actual.tobytes()==atlas.tobytes(),'Atlas pixels changed'
  assert (ROOT/'src/ui/pixelGlyphs.ts').read_text(encoding='utf8')==metadata,'Glyph metadata changed'
  for c,region in CROPS.items():
   r=meta[c];actual=atlas.crop((r['x'],r['y']+6,r['x']+r['width'],r['y']+24))
   assert actual.tobytes()==crop(region).tobytes(),f'{c}: original glyph pixels changed'
  print(f'Pixel font verified: {len(meta)} glyphs; 21 original UI crops byte-identical, atlas/coordinates reproducible, originals untouched.')
 else:
  OUT.mkdir(parents=True,exist_ok=True);atlas.save(OUT/'ui-alphabet.png')
  (ROOT/'src/ui/pixelGlyphs.ts').write_text(metadata,encoding='utf8')
  print(f'Generated {len(meta)} glyphs from the original UI pack.')
if __name__=='__main__':main()
