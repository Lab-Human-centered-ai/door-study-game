/* Paste this WHOLE file into Extensions > Apps Script in your private Sheet.
   Run setup once, then deploy as a Web app: execute as Me, access Anyone. */
const EVENT_HEADERS = ['event_id','session_id','participant_id','study_id','version','sequence','event_type','client_time','received_at','elapsed_ms','round','trial','prompt_id','prompt_text','agent_image','agent_name','agent_gender','agent_suggestion','agent_truthful','correct_door','player_choice','correct','compliance','reaction_time_ms','hidden_during_prompt_ms','health_before','health_after','health','score','time_remaining_ms','input_method','details'];
const SESSION_HEADERS = ['session_id','participant_id','study_id','version','started_at','last_received_at','ended_at','status','sequence','seed','prompt_id','prompt_template','gender_sequence','round','trial','decisions','correct_count','followed_count','mean_reaction_ms','score','health','elapsed_ms','hidden_ms','config'];
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  ensureSheet_(ss, 'Events', EVENT_HEADERS);
  ensureSheet_(ss, 'Sessions', SESSION_HEADERS);
  ensureSheet_(ss, 'Receipts', ['batch_id','received_at']);
}
function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {sheet.appendRow(headers);sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setFontWeight('bold');}
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0];
  if (actual.join('|')!==headers.join('|')) throw Error('Unexpected columns in '+name+'. Restore the original header row.');
  return sheet;
}
function book_() {
  const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if(!id)throw Error('Run setup() first.');
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
    lock.waitLock(25000);
    const ss=book_(),receipts=ensureSheet_(ss,'Receipts',['batch_id','received_at']);
    if(find_(receipts,b.batch_id))return json_({ok:true});
    const events=ensureSheet_(ss,'Events',EVENT_HEADERS),sessions=ensureSheet_(ss,'Sessions',SESSION_HEADERS),now=new Date().toISOString();
    // Event-level deduplication also repairs a partial write before receipt creation.
    const seen=new Set(),rows=[];
    b.events.forEach(event=>{if(!seen.has(event.event_id)&&!find_(events,event.event_id)){seen.add(event.event_id);rows.push(EVENT_HEADERS.map(h=>safe_(h==='received_at'?now:event[h])));}});
    if(rows.length)events.getRange(events.getLastRow()+1,1,rows.length,EVENT_HEADERS.length).setValues(rows);
    const existing=find_(sessions,s.session_id),row=existing?existing.getRow():sessions.getLastRow()+1;
    const oldSequence=existing?Number(sessions.getRange(row,SESSION_HEADERS.indexOf('sequence')+1).getValue()):0;
    if(s.sequence>=oldSequence){s.last_received_at=now;s.mean_reaction_ms=s.decisions?Math.round(s.reaction_total_ms/s.decisions):'';sessions.getRange(row,1,1,SESSION_HEADERS.length).setValues([SESSION_HEADERS.map(h=>safe_(s[h]))]);}
    SpreadsheetApp.flush();
    receipts.appendRow([b.batch_id,now]);
    SpreadsheetApp.flush();
    return json_({ok:true});
  }catch(error){console.error(String(error));return json_({ok:false});}
  finally {if(lock.hasLock())lock.releaseLock();}
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doGet(e) {
  const p=e&&e.parameter||{};
  if(!p.callback)return json_({service:'Door study collector',ready:!!PropertiesService.getScriptProperties().getProperty('SHEET_ID')});
  // JSONP returns only an opaque receipt, never participant or game records.
  if(!/^receipt_[a-f0-9]{32}$/.test(p.callback)||!uuid_(p.batch_id))return json_({ok:false});
  let saved=false;
  try{saved=!!find_(book_().getSheetByName('Receipts'),p.batch_id);}catch(error){console.error(String(error));}
  return ContentService.createTextOutput(p.callback+'('+JSON.stringify({batch_id:p.batch_id,saved})+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
