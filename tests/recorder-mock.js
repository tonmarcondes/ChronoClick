// Only a transport substitute: the actual production content script runs on this page.
const messageHandlers=[];
window.chrome={runtime:{onMessage:{addListener:fn=>messageHandlers.push(fn)},sendMessage:async message=>{
  if(message.type==='GET_STATE')return {state:'recording',recording:{pageViews:false}};
  if(message.type==='RECORD_EVENT'){
    const li=document.createElement('li'); li.textContent=JSON.stringify(message.payload); document.querySelector('#events').append(li);
    return {ok:true};
  }
}}};
document.querySelector('#finish').onclick=async()=>{
  await Promise.all(messageHandlers.map(fn=>new Promise(resolve=>{if(fn({type:'FLUSH_PENDING'},null,resolve)!==true)resolve();})));
  for(const fn of messageHandlers)fn({type:'SET_STATE',state:'finished'},null,()=>{});
  document.querySelector('#finish').textContent='Teste finalizado';
};
