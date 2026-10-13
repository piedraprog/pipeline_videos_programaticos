import sys
from PIL import Image,ImageDraw,ImageFont
out=sys.argv[1];a=sys.argv[2:];items=list(zip(a[0::2],a[1::2]))
im0=Image.open(items[0][0]);w=360 if im0.height>im0.width else 640;h=round(w*im0.height/im0.width)
cols=min(len(items),10 if im0.height>im0.width else 4);rows=-(-len(items)//cols)
s=Image.new('RGB',(cols*w,rows*(h+30)),'#111');d=ImageDraw.Draw(s)
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
except: f=None
for i,(p,l) in enumerate(items):
    x,y=(i%cols)*w,(i//cols)*(h+30);s.paste(Image.open(p).convert('RGB').resize((w,h)),(x,y+30));d.text((x+8,y+6),l,fill='white',font=f)
s.save(out)
