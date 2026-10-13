# Flags visual jumps: a consecutive-frame difference far above its neighbours (a pop/hard stop) around each cut.
import sys,glob,os,re
import numpy as np
from PIL import Image
d=sys.argv[1];groups={}
for f in sorted(glob.glob(os.path.join(d,'c*_*.jpg'))):groups.setdefault(re.match(r'c(\d+)_',os.path.basename(f)).group(1),[]).append(f)
bad=0
for c,fs in sorted(groups.items(),key=lambda x:int(x[0])):
    ims=[np.asarray(Image.open(f).convert('L').resize((270,480) if Image.open(f).height>Image.open(f).width else (480,270)),dtype=np.float32) for f in fs]
    diffs=np.array([np.abs(a-b).mean() for a,b in zip(ims,ims[1:])])
    med=np.median(diffs)+.5
    nb=np.maximum(np.r_[diffs[1:2],diffs[:-1]],np.r_[diffs[1:],diffs[-2:-1]])  # larger neighbouring step
    spike=diffs/(nb+.5);i=int(spike.argmax());peak=diffs[i]
    flag=peak>6.0 and spike[i]>2.5   # a pop: big step that its neighbours don't share (continuous fast motion ramps instead)
    print(f'cut {c}: median step {med-.5:.2f}, max step {peak:.2f} at {os.path.basename(fs[i+1])} {"JUMP" if flag else "ok"}')
    bad+=flag
sys.exit(1 if bad else 0)
