// Resolves external binaries the same way on Linux and Windows.
// ffmpeg: $FFMPEG > repo dependency ffmpeg-static > ffmpeg on PATH. python: $PYTHON > python3/python.
import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const req=createRequire(import.meta.url);
let staticFF=null;try{staticFF=req('ffmpeg-static')}catch{}
export const FF=process.env.FFMPEG||staticFF||'ffmpeg';
function findPy(){if(process.env.PYTHON)return process.env.PYTHON;for(const c of process.platform==='win32'?['python','py','python3']:['python3','python']){try{execFileSync(c,['-c','import numpy,PIL'],{stdio:'ignore'});return c}catch{}}return process.platform==='win32'?'python':'python3'}
export const PY=findPy();
