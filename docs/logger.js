/* Confirm saves from the collector’s readable acknowledgment, with an
   independent receipt check when the response is unavailable. */
class StudyLogger {
  constructor(endpoint, onStatus) {
    this.endpoint=endpoint;this.onStatus=onStatus;this.key='door-study-outbox-v1';this.archiveKey='door-study-backup-v1';this.busy=false;this.saveState={state:'idle',deadline:null,failed:false};this.retryTimer=null;this.failures=0;
    this.queue=this.read(this.key);this.archive=this.read(this.archiveKey);
    // Older preview versions emitted a type the deployed collector rejects.
    // Preserve IDs and details while using its supported heartbeat envelope.
    let repaired=false;
    for(const batch of this.queue)for(const event of batch.events||[]){
      if(event.event_type==='pursuit_accelerated'){
        event.event_type='heartbeat';
        let details;try{details=JSON.parse(event.details);}catch{details={original_details:event.details};}
        event.details=JSON.stringify({...details,action:'pursuit_accelerated'});repaired=true;
      }
    }
    if(repaired)this.persist();
    addEventListener('online',()=>this.flush());
    this.status();
  }
  read(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.queue));localStorage.setItem(this.archiveKey,JSON.stringify(this.archive));this.storageFailed=false;}catch{this.storageFailed=true;}}
  add(event,session){const batch={batch_id:crypto.randomUUID(),events:[event],session};this.queue.push(batch);this.archive.push(batch);this.persist();this.status();if(!this.busy&&!this.retryTimer&&this.endpoint)this.retryTimer=setTimeout(()=>this.flush(),250);}
  status(message){this.onStatus((message||(!this.endpoint?'Demo mode. Data stays in this browser.':this.queue.length?`${this.queue.length} record(s) waiting for Google Sheets.`:'Saved to Google Sheets.'))+(this.storageFailed?' Browser backup unavailable. Download a backup before leaving.':''),{...this.saveState});}
  receipt(id){return new Promise((resolve,reject)=>{
    const callback='receipt_'+crypto.randomUUID().replaceAll('-',''),script=document.createElement('script');
    const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];};
    const timer=setTimeout(()=>{cleanup();reject(Error('Receipt timeout'));},20000);
    window[callback]=data=>{cleanup();resolve(data.saved===true&&data.batch_id===id);};
    script.onerror=()=>{cleanup();reject(Error('Receipt unavailable'));};
    script.src=this.endpoint+'?batch_id='+encodeURIComponent(id)+'&callback='+callback+'&t='+Date.now();document.head.append(script);
  });}
  async flush(){
    if(this.busy||!this.endpoint||!this.queue.length)return;
    clearTimeout(this.retryTimer);this.retryTimer=null;this.busy=true;
    this.saveState={...this.saveState,state:'uploading',deadline:Date.now()+20000};this.status('Sending your study data. Please keep this tab open.');
    let succeeded=false;
    try{
      // Combine consecutive events from one session to reduce Apps Script requests.
      const first=this.queue[0],items=[first];
      if(!first.frozen)for(let i=1;i<Math.min(20,this.queue.length);i++){const b=this.queue[i];if(b.frozen||b.session.session_id!==first.session.session_id)break;items.push(b);}
      const batch={batch_id:first.batch_id,events:items.flatMap(b=>b.events),session:items.at(-1).session,frozen:true};
      // Freeze a batch before sending so retries always have the identical receipt identity.
      this.queue.splice(0,items.length,batch);this.persist();
      const body=JSON.stringify(batch);
      let acknowledged=false;
      // The deployed collector sends ok:true only after writing and flushing
      // Events, Sessions, and its receipt, or finding an existing receipt.
      try{
        const response=await fetch(this.endpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body,keepalive:new TextEncoder().encode(body).length<60000,signal:AbortSignal.timeout(20000)});
        if(response.ok)acknowledged=(await response.json()).ok===true;
      }catch{}
      if(!acknowledged){
        // The POST may have succeeded despite a lost/blocked response.
        this.saveState={...this.saveState,state:'confirming',deadline:Date.now()+20000};this.status('Waiting for Google Sheets to confirm receipt.');
        if(!await this.receipt(batch.batch_id))throw Error('Not confirmed');
      }
      this.queue.shift();this.persist();succeeded=true;this.failures=0;
      this.saveState={state:this.queue.length?'pending':'saved',deadline:null,failed:this.queue.length?this.saveState.failed:false};this.status();
    }catch{
      const retryMs=Math.min(15000,2000*2**Math.min(this.failures++,3));
      this.saveState={state:'retry',deadline:Date.now()+retryMs,failed:true};
      this.status('Save not confirmed. Please download a backup. We will retry automatically.');
      this.retryTimer=setTimeout(()=>this.flush(),retryMs);
    }
    finally{this.busy=false;}
    // Drain remaining batches immediately instead of adding a 15-second wait per batch.
    if(succeeded&&this.queue.length)this.flush();
  }
  download(){const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),records:this.archive,pending:this.queue},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='door-study-backup-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
