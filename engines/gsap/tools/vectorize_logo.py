# Separates the Selltly isotype into vector parts: black X (potrace path), 4 colored dots (circles), wordmark (potrace path).
# Usage: python3 tools/vectorize_logo.py brands/selltly   -> writes brands/selltly/isotype.json + isotype.svg + wordmark.svg
import sys,json,numpy as np,potrace
from PIL import Image
d=sys.argv[1]
def trace(mask,ox=0,oy=0,scale=1):
    bm=potrace.Bitmap(~mask);pl=bm.trace(turdsize=8,alphamax=1.0,opticurve=True,opttolerance=0.2);out=[]
    f=lambda p:f'{(p.x+ox)*scale:.2f} {(p.y+oy)*scale:.2f}'
    for c in pl:
        out.append('M'+f(c.start_point))
        for s in c.segments: out.append(('C'+f(s.c1)+' '+f(s.c2)+' '+f(s.end_point)) if not s.is_corner else ('L'+f(s.c)+' L'+f(s.end_point)))
        out.append('Z')
    return ''.join(out)
pal={'wine':(0x90,0x14,0x40),'crimson':(0xc6,0x14,0x3a),'orange':(0xe8,0x4d,0x20),'yellow':(0xf4,0xdc,0x2a)}
im=np.array(Image.open(f'{d}/icon.png').convert('RGBA')).astype(int);H,W=im.shape[:2]
a=im[...,3]>110;rgb=im[...,:3]
blk=a&(rgb.max(-1)<90)&((rgb.max(-1)-rgb.min(-1))<40)
cols=np.stack([np.abs(rgb-np.array(c)).sum(-1) for c in pal.values()],-1);near=cols.argmin(-1);ok=a&~blk&(cols.min(-1)<120)
dots=[]
for i,(n,c) in enumerate(pal.items()):
    m=ok&(near==i);ys,xs=np.nonzero(m);r=np.sqrt(m.sum()/np.pi)
    dots.append({'name':n,'color':'#%02x%02x%02x'%c,'cx':round(float(xs.mean()),2),'cy':round(float(ys.mean()),2),'r':round(float(r),2)})
xpath=trace(blk)
iso={'viewBox':[0,0,W,H],'x':xpath,'dots':dots}
# wordmark from full logo: black pixels right of the icon
L=np.array(Image.open(f'{d}/logo.png').convert('RGBA')).astype(int);lh,lw=L.shape[:2]
lb=(L[...,3]>110)&(L[...,:3].max(-1)<90)
cut=int(lw*0.33);wm=lb.copy();wm[:,:cut]=False;ys,xs=np.nonzero(wm);x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
iso['wordmark']={'viewBox':[0,0,int(x1-x0+1),int(y1-y0+1)],'path':trace(wm[y0:y1+1,x0:x1+1]),'heightRatioToIcon':round((y1-y0+1)/lh,4),'iconHeightInLogo':lh}
json.dump(iso,open(f'{d}/isotype.json','w'))
dsvg=''.join(f'<circle cx="{p["cx"]}" cy="{p["cy"]}" r="{p["r"]}" fill="{p["color"]}"/>' for p in dots)
open(f'{d}/isotype.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><path d="{xpath}" fill="#000"/>{dsvg}</svg>')
vb=iso['wordmark']['viewBox'];open(f'{d}/wordmark.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb[2]} {vb[3]}"><path d="{iso["wordmark"]["path"]}" fill="#000"/></svg>')
print(json.dumps(dots),len(xpath),vb)
