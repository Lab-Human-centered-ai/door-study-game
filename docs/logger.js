/* Confirm saves from the collector’s readable acknowledgment, with an
   independent receipt check when the response is unavailable. */
class StudyLogger {
  constructor(endpoint, onStatus) {
    this.endpoint=endpoint;this.onStatus=onStatus;this.key='door-study-outbox-v1';this.archiveKey='door-study-backup-v1';this.busy=false;this.saveState={state:'idle',deadline:null,failed:false};this.retryTimer=null;this.failures=0;this.paused=false;this.finishTimer=null;
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
    addEventListener('online',()=>this.retry());
    this.status();
  }
  read(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.queue));localStorage.setItem(this.archiveKey,JSON.stringify(this.archive));this.storageFailed=false;}catch{this.storageFailed=true;}}
  add(event,session){const batch={batch_id:crypto.randomUUID(),events:[event],session};this.queue.push(batch);this.archive.push(batch);this.persist();this.status();if(!this.paused&&!this.busy&&!this.retryTimer&&this.endpoint)this.retryTimer=setTimeout(()=>this.flush(),250);}
  status(message){this.onStatus((message||(!this.endpoint?'Demo mode. Data stays in this browser.':this.queue.length?`${this.queue.length} record(s) waiting for Google Sheets.`:'Saved to Google Sheets.'))+(this.storageFailed?' Browser backup unavailable. Download a backup before leaving.':''),{...this.saveState});}
  pause(){
    // Slow service must not stop delivery. Keep uploading and checking receipts.
    if(!this.queue.length)return;
    this.saveState={...this.saveState,slow:true,failed:true};
    this.status('Saving is still in progress. Your backup is available below.');
    if(!this.busy&&!this.retryTimer)this.retryTimer=setTimeout(()=>this.flush(),2000);
  }
  finishSaving(){
    if(this.finishTimer||!this.queue.length)return;
    this.finishTimer=setTimeout(()=>this.pause(),60000);
  }
  retry(){
    if(this.busy)return;
    this.paused=false;this.failures=0;
    clearTimeout(this.retryTimer);this.retryTimer=null;
    clearTimeout(this.finishTimer);this.finishTimer=null;
    this.finishSaving();this.flush();
  }
  receipt(id,signal){return new Promise((resolve,reject)=>{
    const callback='receipt_'+crypto.randomUUID().replaceAll('-',''),script=document.createElement('script');
    const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{cleanup();reject(Error('Receipt cancelled'));};
    const timer=setTimeout(()=>{cleanup();reject(Error('Receipt timeout'));},15000);
    window[callback]=data=>{cleanup();resolve(data.saved===true&&data.batch_id===id&&data.schema==='demographics-v2');};
    script.onerror=()=>{cleanup();reject(Error('Receipt unavailable'));};
    if(signal?.aborted){cancel();return;}
    signal?.addEventListener('abort',cancel,{once:true});
    script.src=this.endpoint+'?batch_id='+encodeURIComponent(id)+'&callback='+callback+'&t='+Date.now();document.head.append(script);
  });}
  async uploadAndConfirm(batch,body){
    const controller=new AbortController(),signal=controller.signal;
    const timeout=setTimeout(()=>controller.abort(),15000);
    const wait=ms=>new Promise((resolve,reject)=>{
      if(signal.aborted){reject(Error('Cancelled'));return;}
      const cancel=()=>{clearTimeout(timer);reject(Error('Cancelled'));};
      const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
      signal.addEventListener('abort',cancel,{once:true});
    });
    const upload=async()=>{
      const response=await fetch(this.endpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body,keepalive:new TextEncoder().encode(body).length<60000,signal});
      if(response.ok){const result=await response.json();if(result.ok===true&&result.schema==='demographics-v2')return true;}
      throw Error('No upload acknowledgment');
    };
    const confirm=async()=>{
      // Check while the POST response is in flight; never overlap receipt requests.
      await wait(1000);
      for(let attempt=0;attempt<3;attempt++){
        if(this.paused)throw Error('Checks paused');
        try{if(await this.receipt(batch.batch_id,signal))return true;}catch{if(signal.aborted)throw Error('Cancelled');}
        if(attempt<2)await wait(4000);
      }
      throw Error('Receipt not confirmed');
    };
    try{return await Promise.any([upload(),confirm()]);}
    finally{clearTimeout(timeout);controller.abort();}
  }
  async flush(){
    if(this.paused||this.busy||!this.endpoint||!this.queue.length)return;
    clearTimeout(this.retryTimer);this.retryTimer=null;this.busy=true;
    this.saveState={...this.saveState,state:'uploading',deadline:Date.now()+45000};this.status('Sending your study data. Please keep this tab open.');
    let succeeded=false;
    try{
      // Combine consecutive events from one session to reduce Apps Script requests.
      const first=this.queue[0],items=[first];
      if(!first.frozen)for(let i=1;i<Math.min(50,this.queue.length);i++){const b=this.queue[i];if(b.frozen||b.session.session_id!==first.session.session_id)break;items.push(b);}
      const batch={batch_id:first.batch_id,events:items.flatMap(b=>b.events),session:items.at(-1).session,frozen:true};
      // Freeze a batch before sending so retries always have the identical receipt identity.
      this.queue.splice(0,items.length,batch);this.persist();
      const body=JSON.stringify(batch);
      let acknowledged=false;
      // A previous request may already have saved this batch. Confirm before resending.
      if(first.frozen){
        try{acknowledged=await this.receipt(batch.batch_id);}catch{}
        if(this.paused&&!acknowledged)return;
      }
      if(!acknowledged){if(this.paused)return;await this.uploadAndConfirm(batch,body);}
      this.queue.shift();this.persist();succeeded=true;this.failures=0;
      if(!this.queue.length){clearTimeout(this.finishTimer);this.finishTimer=null;this.paused=false;}
      if(this.paused){this.pause();return;}
      this.saveState={state:this.queue.length?'pending':'saved',deadline:null,failed:this.queue.length?this.saveState.failed:false};this.status();
    }catch{
      if(this.paused)return;
      const retryMs=Math.min(15000,2000*2**Math.min(this.failures++,3));
      this.saveState={...this.saveState,state:'retry',deadline:Date.now()+retryMs,failed:true};
      this.status('This might take a while. We appreciate your patience.');
      this.retryTimer=setTimeout(()=>this.flush(),retryMs);
    }
    finally{this.busy=false;}
    // Drain remaining batches immediately instead of adding a 15-second wait per batch.
    if(succeeded&&this.queue.length)this.flush();
  }
  download(){const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),records:this.archive,pending:this.queue},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='door-study-backup-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
