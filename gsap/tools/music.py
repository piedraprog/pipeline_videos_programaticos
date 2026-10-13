# Usage: python3 tools/music.py meta.json out.wav
# Beat-locked music bed synthesized in code. Style from meta["music"]: cinematic | corporate | punchy | minimal | playful.
# Every scene cut gets an accent (hit/chime/stab) on the beat.
import sys,json,wave,numpy as np
m=json.load(open(sys.argv[1]));sr=48000;D=m['duration'];bpm=m['bpm'];beat=60/bpm;n=int(sr*D);t=np.arange(n)/sr
style=m.get('music','cinematic');rng=np.random.default_rng(bpm);out=np.zeros((n,2))
cuts=m['cuts'][1:];outro=m['cuts'][m['scenes'].index('outro')] if 'outro' in m['scenes'] else D
def add(sig,start,gain=1,pan=0):
    i=int(start*sr)
    if i>=n:return
    s=sig[:n-i];out[i:i+len(s),0]+=s*gain*min(1,1-pan);out[i:i+len(s),1]+=s*gain*min(1,1+pan)
X=lambda L:np.arange(int(L*sr))/sr
def env(L,a,d):x=X(L);return np.minimum(x/a,1)*np.exp(-x/d)
mf=lambda q:440*2**((q-69)/12)
def kick(f0=45,f1=110,d=.16):x=X(.45);return np.sin(2*np.pi*np.cumsum(f0+f1*np.exp(-x*30))/sr)*env(.45,.001,d)
def hat(d=.02):return rng.standard_normal(int(.08*sr))*env(.08,.0005,d)*.5
def snare():x=X(.3);return (rng.standard_normal(len(x))*.6+np.sin(2*np.pi*190*x))*env(.3,.001,.09)
def clap():x=X(.25);nz=rng.standard_normal(len(x));return nz*(np.exp(-x/.03)+.4*np.exp(-np.maximum(x-.012,0)/.05))*.5
def pluck(f,L=.35,dec=9,h=.3):x=X(L);return (np.sin(2*np.pi*f*x)+h*np.sin(4*np.pi*f*x))*np.exp(-x*dec)
def marimba(f):x=X(.4);return (np.sin(2*np.pi*f*x)+.25*np.sin(2*np.pi*f*4*x)*np.exp(-x*30))*np.exp(-x*11)
def piano(f):x=X(1.6);return sum(a*np.sin(2*np.pi*f*k*x)*np.exp(-x*(1.6+k)) for k,a in [(1,1),(2,.4),(3,.2),(4,.08)])*np.minimum(x/.004,1)
def chime(f):x=X(1.2);return (np.sin(2*np.pi*f*x)+.4*np.sin(2*np.pi*f*2.01*x)+.2*np.sin(2*np.pi*f*3*x))*np.exp(-x*3)
def hit():x=X(1.6);nz=np.convolve(rng.standard_normal(len(x)),np.ones(6)/6,'same');return np.sin(2*np.pi*(38+60*np.exp(-x*8))*x)*np.exp(-x*2.2)+nz*np.exp(-x*5)*.5
def riser(L):x=X(L);return rng.standard_normal(len(x))*(x/L)**2*.25
def pad(c,L,g):x=X(L);p=sum(np.sin(2*np.pi*mf(q)*x+np.sin(2*np.pi*mf(q)*1.003*x)) for q in c)/len(c);return p*np.minimum(x/.3,1)*np.minimum((L-x)/.3,1)*g
def bass(f,L,drive=3):x=X(L);return np.tanh(drive*np.sin(2*np.pi*f*x))*np.exp(-x*5)
bar=4*beat;nb=int(D/beat)
if style=='cinematic':
    ch=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
    for b in range(nb):
        s=b*beat
        if not(outro<=s<outro+1.5):add(kick(),s,.9)
        if b%2:add(snare(),s,.35)
        add(hat(),s+beat/2,.25,.3);add(hat(),s+beat/4,.08,-.3)
    for i in range(int(np.ceil(D/bar))):
        c=ch[i%4];add(pad(c,bar,.12),i*bar)
        for k in range(4):add(bass(mf(c[0]-24),.45)*.22,i*bar+k*beat+beat/2)
    for c in cuts:add(hit(),c,.8);add(riser(min(1,2*beat)),c-min(1,2*beat),.6)
elif style=='corporate':
    ch=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65]]
    for b in range(nb):
        s=b*beat;c=ch[int(s//bar)%4]
        if not(outro<=s<outro+1):add(kick()*.6,s,.7)
        if b%2:add(clap(),s,.35)
        add(hat(),s+beat/2,.18,.3)
        for k in range(2):add(pluck(mf(c[(b*2+k)%4]+12)),s+k*beat/2,.12,(-.4 if k else .4))
    for i in range(int(np.ceil(D/bar))):
        c=ch[i%4];add(pad(c,bar,.07),i*bar)
        for k in range(4):x=X(.4);add(np.sin(2*np.pi*mf(c[0]-24)*x)*np.exp(-x*6)*.3,i*bar+k*beat)
    for c in cuts:add(chime(mf(84)),c,.18);add(riser(min(.6,beat)),c-min(.6,beat),.12)
elif style=='punchy':
    ch=[[57,60,64],[57,60,64],[53,57,60],[55,59,62]]
    for b in range(nb):
        s=b*beat;c=ch[int(s//bar)%4]
        add(kick(40,140,.2),s,1.0)
        if b%2:add(snare(),s,.5);add(clap(),s,.3)
        for k in range(4):add(hat(.012),s+k*beat/4,.12 if k%2 else .2,.2)
        add(bass(mf(c[0]-24),beat*.9,5)*.35,s+beat/2)
    for c in cuts:add(hit(),c,.7);x=X(.25);add(np.sign(np.sin(2*np.pi*mf(76)*x))*np.exp(-x*14)*.25,c,.6)
elif style=='minimal':
    ch=[[60,64,67],[57,60,64],[53,57,60],[55,59,62]]
    for b in range(nb):
        s=b*beat;c=ch[int(s//bar)%4]
        add(hat(.01),s+beat/2,.08,.3)
        if b%2==0:add(piano(mf(c[b%3]+12)),s,.13,-.2)
        if b%4==3:add(piano(mf(c[(b+1)%3]+24)),s+beat/2,.07,.3)
    for i in range(int(np.ceil(D/bar))):c=ch[i%4];add(pad(c,bar,.05),i*bar);add(piano(mf(c[0]-12)),i*bar,.16)
    for c in cuts:add(chime(mf(88)),c,.1)
elif style=='playful':
    ch=[[60,64,67],[65,69,72],[67,71,74],[60,64,67]]
    for b in range(nb):
        s=b*beat;c=ch[int(s//bar)%4]
        add(kick(55,90,.1)*.7,s,.7)
        if b%2:add(clap(),s,.3)
        add(marimba(mf(c[b%3]+12)),s,.25,-.3);add(marimba(mf(c[(b+1)%3]+24)),s+beat/2,.15,.3)
        x=X(beat*.45);add(np.sin(2*np.pi*mf(c[0]-24)*x)*np.exp(-x*7)*.35,s+beat/2*(b%2))
    for c in cuts:
        for k,q in enumerate([84,88,91]):add(pluck(mf(q),.3,14,.1),c+k*.06,.15)
out*=np.clip((D-t)/1.2,0,1)[:,None];out/=np.abs(out).max()/.89
w=wave.open(sys.argv[2],'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((out*32767).astype('<i2').tobytes());w.close()
