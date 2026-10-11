/* Opaque POST responses are never treated as proof of saving. A separate,
   read-only JSONP receipt confirms the whole batch was committed. */
class StudyLogger {
  constructor(endpoint, onStatus) {
    this.endpoint=endpoint;this.onStatus=onStatus;this.key='door-study-outbox-v1';this.archiveKey='door-study-backup-v1';this.busy=false;
    this.queue=this.read(this.key);this.archive=this.read(this.archiveKey);
    addEventListener('online',()=>this.flush());
    this.interval=setInterval(()=>this.flush(),15000);this.status();
  }
  read(key){try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.queue));localStorage.setItem(this.archiveKey,JSON.stringify(this.archive));this.storageFailed=false;}catch{this.storageFailed=true;}}
  add(event,session){const batch={batch_id:crypto.randomUUID(),events:[event],session};this.queue.push(batch);this.archive.push(batch);this.persist();this.status();}
  status(message){this.onStatus((message||(!this.endpoint?'Demo mode — data stays in this browser.':this.queue.length?`${this.queue.length} record(s) waiting for Google Sheets.`:'Saved to Google Sheets.'))+(this.storageFailed?' Browser backup unavailable — download a backup before leaving.':''));}
  receipt(id){return new Promise((resolve,reject)=>{
    const callback='receipt_'+crypto.randomUUID().replaceAll('-',''),script=document.createElement('script');
    const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];};
    const timer=setTimeout(()=>{cleanup();reject(Error('Receipt timeout'));},20000);
    window[callback]=data=>{cleanup();resolve(data.saved===true&&data.batch_id===id);};
    script.onerror=()=>{cleanup();reject(Error('Receipt unavailable'));};
    script.src=this.endpoint+'?batch_id='+encodeURIComponent(id)+'&callback='+callback+'&t='+Date.now();document.head.append(script);
  });}
  async flush(){
    if(this.busy||!this.endpoint||!this.queue.length)return;this.busy=true;
    try{
      // Combine consecutive events from one session to reduce Apps Script requests.
      const first=this.queue[0],items=[first];
      if(!first.frozen)for(let i=1;i<Math.min(20,this.queue.length);i++){const b=this.queue[i];if(b.frozen||b.session.session_id!==first.session.session_id)break;items.push(b);}
      const batch={batch_id:first.batch_id,events:items.flatMap(b=>b.events),session:items.at(-1).session,frozen:true};
      // Freeze a batch before sending so retries always have the identical receipt identity.
      this.queue.splice(0,items.length,batch);this.persist();
      await fetch(this.endpoint,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(batch),signal:AbortSignal.timeout(20000)});
      if(!await this.receipt(batch.batch_id))throw Error('Not confirmed');
      this.queue.shift();this.persist();this.status();
    }catch{this.status('Save not confirmed yet — keep this page open. Automatic retry is on; you can also download a backup.');}
    finally{this.busy=false;}
  }
  download(){const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),records:this.archive,pending:this.queue},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='door-study-backup-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
