'use strict';
const $=id=>document.getElementById(id);
const cfg=JSON.parse(localStorage.getItem('jarvis_cfg')||'{}');
const history=JSON.parse(localStorage.getItem('jarvis_history')||'[]');
const memories=JSON.parse(localStorage.getItem('jarvis_memories')||'[]');
const personality='Eres Jarvis, un asistente personal cercano, simpático y breve. Hablas español de España, con humor suave. Responde normalmente en 1-3 frases. No inventes datos. Recuerdos del usuario: '+memories.join('; ');
let busy=false,recognition=null,conversation=false,recognizing=false,speaking=false,starting=false;
function setStatus(s,label){$('orb').className='orb '+s;$('status').textContent=label;}
function show(t){$('answer').textContent=t;}
function beginListening(){
 if(!conversation||recognizing||speaking||busy||starting||document.hidden)return;
 if(!SpeechRecognition){conversation=false;show('El navegador no permite reconocimiento de voz. Usa el teclado.');return;}
 starting=true;
 try{
  const r=new SpeechRecognition();recognition=r;r.lang='es-ES';r.interimResults=false;r.continuous=false;r.maxAlternatives=1;
  r.onstart=()=>{starting=false;recognizing=true;setStatus('listening','ESCUCHANDO · TOCA PARA PARAR');};
  r.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript;if(t){busy=false;ask(t);}};
  r.onerror=e=>{starting=false;recognizing=false;if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){conversation=false;show('El micrófono no está disponible ('+e.error+'). Revisa los permisos de Safari.');setStatus('','TOCA PARA HABLAR');}};
  r.onend=()=>{starting=false;recognizing=false;if(recognition===r)recognition=null;if(conversation&&!busy&&!speaking)queueMicrotask(beginListening);else if(!conversation)setStatus('','TOCA PARA HABLAR');};
  r.start();
 }catch(e){starting=false;recognizing=false;conversation=false;show('Safari no ha permitido reactivar el micrófono automáticamente. Toca el orbe para continuar.');setStatus('','TOCA PARA HABLAR');}
}
function speak(t){
 if(cfg.voice==='off'||!('speechSynthesis'in window)){speaking=false;busy=false;if(conversation)beginListening();else setStatus('','LISTO PARA AYUDARTE');return;}
 speaking=true;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='es-ES';u.rate=1.02;
 let finished=false;const done=()=>{if(finished)return;finished=true;speaking=false;busy=false;if(conversation)beginListening();else setStatus('','LISTO PARA AYUDARTE');};
 u.onstart=()=>setStatus('speaking','HABLANDO · TOCA PARA PARAR');u.onend=done;u.onerror=done;speechSynthesis.speak(u);
 }catch(e){speaking=false;busy=false;if(conversation)beginListening();}}
function reply(t){show(t);speak(t);}
async function ask(raw){if(busy)return;const text=raw.trim();if(!text)return;busy=true;setStatus('thinking','PENSANDO');show('Tú: '+text);const local=offlineCommand(text)|| (typeof consultarTemario==='function'?consultarTemario(text):null);if(local){reply(local);return;}
 if(!cfg.endpoint){reply('Eso aún no está en mis conocimientos sin IA. Puedes preguntarme por ciencias, química, física, sociales, geografía, historia, castellano, catalán, inglés, informática y matemáticas.');return;}
 try{const url=new URL(cfg.endpoint);if(url.protocol!=='https:')throw Error('La URL debe usar HTTPS.');const messages=[{role:'system',content:personality.replace(/Recuerdos del usuario:.*/, 'Recuerdos del usuario: '+memories.join('; '))},...history.slice(-12),{role:'user',content:text}];const res=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:cfg.model||'default',messages,stream:false})});if(!res.ok)throw Error('El servidor respondió '+res.status);const data=await res.json();const answer=data.choices?.[0]?.message?.content||data.message?.content;if(typeof answer!=='string')throw Error('Formato de respuesta no compatible');history.push({role:'user',content:text},{role:'assistant',content:answer});if(history.length>24)history.splice(0,history.length-24);localStorage.setItem('jarvis_history',JSON.stringify(history));reply(answer);}catch(e){reply('No he podido conectar con la IA: '+e.message+'.');}}
$('chat').addEventListener('submit',e=>{e.preventDefault();const t=$('message').value;$('message').value='';ask(t);});
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function listen(){
 if(conversation){conversation=false;if(recognition)try{recognition.abort();}catch(e){}if('speechSynthesis'in window)speechSynthesis.cancel();speaking=false;recognizing=false;starting=false;setStatus('','TOCA PARA HABLAR');return;}
 conversation=true;if('speechSynthesis'in window)speechSynthesis.cancel();speaking=false;beginListening();
}
$('orb').addEventListener('click',listen);$('orb').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();listen();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){conversation=false;if(recognition)try{recognition.abort();}catch(e){};}else if(!busy&&!speaking)setStatus('','TOCA PARA HABLAR');});
$('settingsBtn').onclick=()=>{$('endpoint').value=cfg.endpoint||'';$('model').value=cfg.model||'';$('username').value=cfg.username||'';$('voice').value=cfg.voice||'on';$('settings').showModal();};
$('save').onclick=()=>{cfg.endpoint=$('endpoint').value.trim();cfg.model=$('model').value.trim();cfg.username=$('username').value.trim();cfg.voice=$('voice').value;localStorage.setItem('jarvis_cfg',JSON.stringify(cfg));$('settings').close();show('Configuración guardada.');};
$('clear').onclick=()=>{if(confirm('¿Borrar la memoria y el historial de Jarvis de este dispositivo?')){memories.length=0;history.length=0;localStorage.removeItem('jarvis_memories');localStorage.removeItem('jarvis_history');show('Memoria borrada.');}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// Los accesos de la parte inferior intentan abrir la aplicación instalada.
document.querySelectorAll('[data-app]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();abrirApp(a.dataset.app);}));
