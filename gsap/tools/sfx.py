# Usage: python3 tools/sfx.py meta.json out.wav -- synthesizes the bumper's sound effects from meta["sfx"] events
import sys,json,wave,numpy as np
m=json.load(open(sys.argv[1]));sr=48000;D=m['duration']+.4;n=int(sr*D);out=np.zeros((n,2));rng=np.random.default_rng(7)
X=lambda L:np.arange(int(L*sr))/sr
def lp(x,k):return np.convolve(x,np.ones(k)/k,'same')
def whoosh(L=.45):x=X(L);nz=rng.standard_normal(len(x));e=np.sin(np.pi*np.clip(x/L,0,1))**2;
    # sweep: blend between heavy and light smoothing
def whoosh(L=.5):
    x=X(L);nz=rng.standard_normal(len(x));lo=lp(nz,40);hi=lp(nz,6);p=x/L;e=np.sin(np.pi*p)**1.5
    return (lo*(1-p)+hi*p)*e*1.6
def pop(f0=900,f1=300):x=X(.12);return np.sin(2*np.pi*np.cumsum(f1+(f0-f1)*np.exp(-x*40))/sr)*np.exp(-x*35)
def impact():x=X(1.2);boom=np.sin(2*np.pi*(40+80*np.exp(-x*10))*x)*np.exp(-x*3.5);nz=lp(rng.standard_normal(len(x)),8)*np.exp(-x*12)*.6;return boom+nz
def chime():
    x=X(1.6);s=0
    for f,a,d in [(1046.5,1,2.2),(1318.5,.6,2.6),(1568,.45,3),(2093,.25,4)]:s=s+a*np.sin(2*np.pi*f*x)*np.exp(-x*d)
    return s*.5*np.minimum(x/.005,1)
def draw(L=.95):x=X(L);nz=lp(rng.standard_normal(len(x)),3)*(.5+.5*np.sin(2*np.pi*14*x))**2;return nz*np.sin(np.pi*x/L)*.7
def swirl(L=1.0):x=X(L);f=200+900*(x/L)**2;return np.sin(2*np.pi*np.cumsum(f)/sr)*np.sin(np.pi*x/L)*.25+whoosh(L)*.6
def snap():x=X(.06);return rng.standard_normal(len(x))*np.exp(-x*120)
def click():x=X(.08);return (np.sin(2*np.pi*2400*x)*.5+rng.standard_normal(len(x))*.5)*np.exp(-x*90)
def blob(L=.8):x=X(L);f=90+40*np.sin(2*np.pi*6*x)+120*x/L;return np.sin(2*np.pi*np.cumsum(f)/sr)*np.sin(np.pi*x/L)*.8
def stretch():x=X(.5);f=150+500*x/.5;return np.sin(2*np.pi*np.cumsum(f)/sr)*np.exp(-((x-.25)/.15)**2)*.6
F={'whoosh':whoosh,'pop':pop,'impact':impact,'chime':chime,'draw':draw,'swirl':swirl,'snap':lambda:np.concatenate([snap(),np.zeros(int(.03*sr)),snap()*.7]),'click':click,'blob':blob,'stretch':stretch}
for i,e in enumerate(m['sfx']):
    s=F[e['type']]();st=int(e['t']*sr);s=s[:max(0,n-st)];pan=((i%3)-1)*.25
    out[st:st+len(s),0]+=s*e['gain']*(1-pan);out[st:st+len(s),1]+=s*e['gain']*(1+pan)
out=out[:int(m['duration']*sr)];tail=np.clip((m['duration']-X(m['duration']))/.25,0,1)[:len(out)];out*=tail[:,None]
out/=max(1e-6,np.abs(out).max())/.85
w=wave.open(sys.argv[2],'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((out*32767).astype('<i2').tobytes());w.close()
