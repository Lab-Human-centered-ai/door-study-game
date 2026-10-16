const COLLECTOR_SCHEMA = 'demographics-v2';
const COLLECTOR_BUILD = 'door-study-20261016.1';
const TARGET_SHEET_ID = '1e5ppc5OfJoeXG6h5lsV6Rc16XbAywZOiMMkgWikqMKA';
const EVENT_HEADERS = ['event_id','session_id','participant_id','study_id','version','sequence','event_type','client_time','received_at','elapsed_ms','round','trial','prompt_id','prompt_text','agent_image','agent_name','agent_gender','agent_suggestion','agent_truthful','correct_door','player_choice','correct','compliance','reaction_time_ms','hidden_during_prompt_ms','health_before','health_after','health','score','time_remaining_ms','input_method','details','participant_age','participant_gender','reason','phase'];
const SESSION_HEADERS = ['session_id','participant_id','study_id','version','started_at','last_received_at','ended_at','status','sequence','seed','prompt_id','prompt_template','gender_sequence','round','trial','decisions','correct_count','followed_count','mean_reaction_ms','score','health','elapsed_ms','hidden_ms','config','participant_age','participant_gender','reason','phase'];
function setup() {
  const ss = SpreadsheetApp.openById(TARGET_SHEET_ID);
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  ensureSheet_(ss, 'Events', EVENT_HEADERS);
  ensureSheet_(ss, 'Sessions', SESSION_HEADERS);
  ensureSheet_(ss, 'Receipts', ['batch_id','received_at']);
  backfillOutcomes_(ss);
  ensureDecisions_(ss);
}
function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  // Remove the retired tracking column from existing collector tabs.
  if((name==='Events'||name==='Sessions')&&sheet.getLastRow()>0){
    const oldHeaders=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const retired=oldHeaders.indexOf('consent_version');
    if(retired!==-1)sheet.deleteColumn(retired+1);
  }
  if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
  if (sheet.getLastRow() === 0) {sheet.appendRow(headers);sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setFontWeight('bold');}
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0];
  // Append new columns without moving or overwriting historical study records.
  const existing=actual.filter((value,index)=>index<sheet.getLastColumn());
  while(existing.length&&existing[existing.length-1]==='')existing.pop();
  if(existing.some((value,index)=>value!==headers[index]))throw Error('Unexpected columns in '+name+'. Check the header row.');
  if(existing.length<headers.length)sheet.getRange(1,existing.length+1,1,headers.length-existing.length).setValues([headers.slice(existing.length)]).setFontWeight('bold');
  return sheet;
}
// Live view: one row per door choice, with each metric in its own column.
function ensureDecisions_(ss) {
  const sheet=ss.getSheetByName('Decisions')||ss.insertSheet('Decisions');
  if(sheet.getMaxColumns()<EVENT_HEADERS.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),EVENT_HEADERS.length-sheet.getMaxColumns());
  // FILTER preserves booleans and mixed types that QUERY can omit.
  sheet.getRange(1,1).setFormula('={Events!A1:AJ1;IFNA(FILTER(Events!A2:AJ,Events!G2:G="decision"),MAKEARRAY(1,36,LAMBDA(r,c,"")))}');
  sheet.setFrozenRows(1);
}
function outcome_(event){
  let details={};try{details=JSON.parse(event.details||'{}');}catch{}
  return {reason:event.reason||details.reason||'',phase:event.phase||details.phase||({maze_start:'maze',maze_complete:'maze',prompt_shown:'choice',decision:'choice'}[event.event_type])||''};
}
function backfillOutcomes_(ss){
  const events=ss.getSheetByName('Events'),sessions=ss.getSheetByName('Sessions'),lastBySession={};
  if(events.getLastRow()>1){
    const rows=events.getRange(2,1,events.getLastRow()-1,EVENT_HEADERS.length).getValues();
    const values=rows.map(row=>{
      const event=Object.fromEntries(EVENT_HEADERS.map((h,i)=>[h,row[i]])),outcome=outcome_(event);
      lastBySession[event.session_id]=outcome;
      return [outcome.reason,outcome.phase];
    });
    events.getRange(2,EVENT_HEADERS.indexOf('reason')+1,values.length,2).setValues(values);
  }
  if(sessions.getLastRow()>1){
    const rows=sessions.getRange(2,1,sessions.getLastRow()-1,SESSION_HEADERS.length).getValues();
    const values=rows.map(row=>{
      const session=Object.fromEntries(SESSION_HEADERS.map((h,i)=>[h,row[i]])),outcome=lastBySession[session.session_id]||{};
      return [session.reason||outcome.reason||(session.status!=='in_progress'?session.status:''),session.phase||outcome.phase||''];
    });
    sessions.getRange(2,SESSION_HEADERS.indexOf('reason')+1,values.length,2).setValues(values);
  }
}
function book_() {
  const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if(!id)throw Error('Run setup() first.');
  if(id!==TARGET_SHEET_ID)throw Error('Wrong spreadsheet configured. Run setup().');
  return SpreadsheetApp.openById(id);
}
function find_(sheet, id) {
  if(sheet.getLastRow()<2)return null;
  return sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).useRegularExpression(false).findNext();
}
function uuid_(s){return typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);}
function safe_(v){
  if(v===undefined||v===null)return '';
  if(typeof v==='boolean'||typeof v==='number')return v;
  const text=String(v).slice(0,12000);
  return /^[\s]*[=+@-]/.test(text)?"'"+text:text; // Prevent spreadsheet formula injection.
}
function doPost(e) {
  const lock=LockService.getScriptLock();
  try {
    if(!e.postData||e.postData.contents.length>250000)throw Error('Invalid body');
    const b=JSON.parse(e.postData.contents),s=b.session;
    if(!uuid_(b.batch_id)||!s||!uuid_(s.session_id)||!Array.isArray(b.events)||b.events.length<1||b.events.length>100)throw Error('Invalid batch');
    if(!Number.isInteger(s.sequence)||s.sequence<1)throw Error('Invalid sequence');
    for(const event of b.events){
      if(!uuid_(event.event_id)||event.session_id!==s.session_id||!Number.isInteger(event.sequence)||event.sequence<1||event.sequence>s.sequence)throw Error('Invalid event');
      if(!['session_start','maze_start','maze_complete','prompt_shown','decision','hallway_complete','session_end','tab_hidden','tab_visible','page_exit','heartbeat'].includes(event.event_type))throw Error('Invalid event type');
      if(event.event_type==='decision'&&(!['left','right'].includes(event.player_choice)||!Number.isFinite(event.reaction_time_ms)||event.reaction_time_ms<0))throw Error('Invalid decision');
    }
    // Validate demographics when present; legacy sessions without them remain accepted.
    if(s.participant_age!==undefined||s.participant_gender!==undefined){
      if(!Number.isInteger(s.participant_age)||s.participant_age<1||s.participant_age>120||!['man','woman','other'].includes(s.participant_gender))throw Error('Invalid demographics');
      for(const event of b.events)if(event.participant_age!==s.participant_age||event.participant_gender!==s.participant_gender)throw Error('Inconsistent demographics');
    }
    for(const event of b.events)Object.assign(event,outcome_(event));
    const last=b.events[b.events.length-1];
    s.reason=s.reason||last.reason||(s.status!=='in_progress'?s.status:'');
    s.phase=s.phase||last.phase||'';
    lock.waitLock(25000);
    const ss=book_(),receipts=ensureSheet_(ss,'Receipts',['batch_id','received_at']);
    const received=!!find_(receipts,b.batch_id);
    const events=ensureSheet_(ss,'Events',EVENT_HEADERS),sessions=ensureSheet_(ss,'Sessions',SESSION_HEADERS),now=new Date().toISOString();
    // Event-level deduplication also repairs a partial write before receipt creation.
    const seen=new Set(),rows=[];
    b.events.forEach(event=>{
      if(seen.has(event.event_id))return;
      seen.add(event.event_id);
      const existingEvent=find_(events,event.event_id);
      if(!existingEvent)rows.push(EVENT_HEADERS.map(h=>safe_(h==='received_at'?now:event[h])));
      // Recover fields dropped by an older collector when the original batch retries.
      else if(s.participant_age!==undefined||s.participant_gender!==undefined){
        const row=existingEvent.getRow();
        ['participant_age','participant_gender','reason','phase'].forEach(h=>{
          const cell=events.getRange(row,EVENT_HEADERS.indexOf(h)+1);
          if(cell.getValue()==='')cell.setValue(safe_(event[h]));
        });
      }
    });
    if(rows.length)events.getRange(events.getLastRow()+1,1,rows.length,EVENT_HEADERS.length).setValues(rows);
    const existing=find_(sessions,s.session_id),row=existing?existing.getRow():sessions.getLastRow()+1;
    const oldSequence=existing?Number(sessions.getRange(row,SESSION_HEADERS.indexOf('sequence')+1).getValue()):0;
    if(s.sequence>=oldSequence){s.last_received_at=now;s.mean_reaction_ms=s.decisions?Math.round(s.reaction_total_ms/s.decisions):'';sessions.getRange(row,1,1,SESSION_HEADERS.length).setValues([SESSION_HEADERS.map(h=>safe_(s[h]))]);}
    SpreadsheetApp.flush();
    ensureDecisions_(ss);
    if(!received)receipts.appendRow([b.batch_id,now]);
    SpreadsheetApp.flush();
    return json_({ok:true,batch_id:b.batch_id,schema:COLLECTOR_SCHEMA,build:COLLECTOR_BUILD});
  }catch(error){
    console.error(String(error));
    const message=String(error),errorCode=/Unexpected columns/.test(message)?'SCHEMA_MISMATCH':/Run setup|Wrong spreadsheet/.test(message)?'SETUP_REQUIRED':/Invalid|Inconsistent/.test(message)?'INVALID_BATCH':'TEMPORARY_FAILURE';
    return json_({ok:false,schema:COLLECTOR_SCHEMA,build:COLLECTOR_BUILD,error_code:errorCode});
  }
  finally {if(lock.hasLock())lock.releaseLock();}
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doGet(e) {
  const p=e&&e.parameter||{};
  if(!p.callback)return json_({service:'Door study collector',schema:COLLECTOR_SCHEMA,build:COLLECTOR_BUILD,event_columns:EVENT_HEADERS,session_columns:SESSION_HEADERS,ready:!!PropertiesService.getScriptProperties().getProperty('SHEET_ID')});
  // JSONP returns only an opaque receipt, never participant or game records.
  if(!/^receipt_[a-f0-9]{32}$/.test(p.callback)||!uuid_(p.batch_id))return json_({ok:false});
  let saved=false;
  try{saved=!!find_(book_().getSheetByName('Receipts'),p.batch_id);}catch(error){console.error(String(error));}
  return ContentService.createTextOutput('typeof '+p.callback+'==="function"&&'+p.callback+'('+JSON.stringify({batch_id:p.batch_id,saved,schema:COLLECTOR_SCHEMA,build:COLLECTOR_BUILD})+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
