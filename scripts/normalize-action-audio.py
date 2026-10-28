from pathlib import Path
import numpy as np, json, wave, hashlib, math
import argparse
parser=argparse.ArgumentParser(description='Normalize decoded original audio; never modifies the sources.')
parser.add_argument('--decoded-dir',type=Path,required=True,help='Directory containing decoded.json and interleaved 48kHz float32 PCM (.f32).')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent; decoded=args.decoded_dir; dest=root/'assets/sounds/mixed';dest.mkdir(exist_ok=True)
def loudness(a,rate=48000):
 # BS.1770 K weighting in the frequency domain, then 400ms/100ms absolute/relative gating.
 # Zero-padding removes circular wraparound of the two IIR responses.
 n=1<<int(math.ceil(math.log2(len(a)+rate)));z=np.exp(-2j*np.pi*np.fft.rfftfreq(n,1/rate)/rate)
 h=(1.53512485958697-2.69169618940638*z+1.19839281085285*z*z)/(1-1.69065929318241*z+.73248077421585*z*z)
 h*=((1-2*z+z*z)/(1-1.99004745483398*z+.99007225036621*z*z))
 weighted=np.fft.irfft(np.fft.rfft(a,n=n,axis=0)*h[:,None],n=n,axis=0)[:len(a)]
 energy=np.sum(weighted**2,axis=1); size=min(len(a),19200);hop=min(size,4800)
 values=np.array([energy[i:i+size].mean() for i in range(0,max(1,len(a)-size+1),hop)])
 levels=-.691+10*np.log10(np.maximum(values,1e-15)); gated=values[levels>-70]
 if not len(gated): return -70.
 relative=-.691+10*np.log10(gated.mean())-10
 return float(-.691+10*np.log10(values[(levels>-70)&(levels>relative)].mean()))
rows=[]
for item in json.loads((decoded/'decoded.json').read_text()):
 a=np.fromfile(decoded/(item['name']+'.f32'),dtype='<f4').reshape(-1,item['channels']).astype(np.float64);peak=np.max(np.abs(a))
 envelope=np.max(np.abs(a),axis=1);valid=np.flatnonzero(envelope>max(1e-5,peak*.001));start=max(0,int(valid[0])-240);end=min(len(a),int(valid[-1])+4800)
 excerpt=False
 if item['name'].startswith('beepbeepcount'):
  # Each source is already a multi-beep countdown. Use its first complete pulse;
  # the game's paused clock supplies tracking/lock rhythm, not overlapping files.
  significant=envelope>peak*.04;first=int(np.flatnonzero(significant)[0]);end=first
  while end<len(a)-960:
   if not significant[end:end+960].any(): break
   end+=240
  start=max(0,first-240);end=min(len(a),end+240);excerpt=True
 a=a[start:end].copy();fade=min(240,len(a)//4);a[:fade]*=np.linspace(0,1,fade)[:,None];a[-fade:]*=np.linspace(1,0,fade)[:,None]
 measured=loudness(a);gain=10**((-26-measured)/20);a*=gain
 # 4x reconstructed intersample peak; lower the gain if needed, never clip samples.
 spectrum=np.fft.rfft(a,axis=0);inter=np.fft.irfft(spectrum,n=len(a)*4,axis=0)*4;true_peak=float(np.max(np.abs(inter)))
 if true_peak>10**(-3/20): a*=10**(-3/20)/true_peak
 lufs=loudness(a);p=float(np.max(np.abs(a)));output=item['name'].replace('.wav','')+'.wav'
 if '/sonidos por agregar/' not in item['source']:output='legacy-'+output
 with wave.open(str(dest/output),'wb') as w:w.setnchannels(item['channels']);w.setsampwidth(2);w.setframerate(48000);w.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
 rows.append({'source':item['source'],'sourceSha256':hashlib.sha256((root/item['source']).read_bytes()).hexdigest(),'output':'assets/sounds/mixed/'+output,'durationMs':round(len(a)/48),'trimStartMs':round(start/48,2),'trimEndMs':round(end/48,2),'firstPulseOnly':excerpt,'inputLufs':round(measured,2),'outputLufs':round(lufs,2),'peakDbfs':round(20*np.log10(max(p,1e-12)),2),'gainDb':round(lufs-measured,2),'outputSha256':hashlib.sha256((dest/output).read_bytes()).hexdigest()})
(dest/'sources.json').write_text(json.dumps({'targetLufs':-26,'truePeakCeilingDb':-3,'method':'BS.1770 K weighting; 400ms blocks / 100ms hop, -70 LUFS absolute / -10 LU relative gating; 4x intersample peak check. Short cues use full duration. No compression, source overwrite or music replacement.','cues':rows},indent=2),encoding='utf-8')
print('\n'.join(f"{r['output'].split('/')[-1]}: {r['outputLufs']} LUFS, {r['peakDbfs']} dBFS, {r['durationMs']}ms" for r in rows))
