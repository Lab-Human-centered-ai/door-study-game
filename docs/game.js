'use strict';
const $=id=>document.getElementById(id), cfg=window.STUDY_CONFIG;
let saveState={state:'idle',deadline:null,failed:false};
function renderSaveCountdown(){$('save-countdown').hidden=true;}
function loggerBusy(state){return ['uploading','confirming'].includes(state?.state);}
function updateSaveStatus(message,state){
  if(state)saveState=state;
  const saved=Boolean(cfg.endpoint)&&message.startsWith('Saved to Google Sheets.');
  $('save-beacon').classList.toggle('saved',saved);
  const paused=['paused','blocked'].includes(saveState.state);
  $('save-spinner').hidden=!cfg.endpoint||saved||paused;
  $('save-beacon').setAttribute('aria-busy',String(Boolean(cfg.endpoint)&&!saved&&!paused));
  const waiting='This might take a while. We appreciate your patience. Please keep this tab open until saving is complete.';
  const displayed=cfg.endpoint&&!saved&&!paused?waiting:message;
  $('save-status').textContent=displayed;
  $('finish-save-status').textContent=displayed;
  $('finish-save-status').hidden=Boolean(cfg.endpoint)&&!saved;
  $('finish-save-title').textContent=saveState.state==='blocked'?'Saving connection needs attention':paused?'Saving is taking longer than expected':saved?'SAVE COMPLETE. YOU MAY LEAVE':cfg.endpoint?'Saving your study data':'PREVIEW RUN. KEEP A BACKUP';
  $('finish-save-help').textContent=saveState.state==='blocked'?'The study collector needs an update. Your records are retained in this browser. Please download a backup and retry after the connection is updated.':paused?'Thank you for your patience. We could not confirm every record yet. Please download a backup before leaving, or choose Retry saving.':saved?'Your study data has been received. Thank you for staying.':cfg.endpoint?waiting:'This preview is not connected to Google Sheets. Download a data backup to keep your results.';
  $('again').disabled=Boolean(cfg.endpoint)&&!saved&&!paused;
  $('retry').disabled=loggerBusy(state);
  $('save-fallback').hidden=saved||!(paused||saveState.slow);
  renderSaveCountdown();
}
const logger=new StudyLogger(cfg.endpoint,updateSaveStatus);
const soundtrack=$('soundtrack'),lossSound=$('loss-sound');
lossSound.volume=0.7;
soundtrack.volume=0.45;
async function playMusic(){
  try{
    await soundtrack.play();
    $('audio-status').hidden=true;
    return true;
  }catch{
    $('audio-status').textContent='Music could not start. Use Enable audio to try again.';
    $('audio-status').hidden=false;
    $('mute').textContent='Enable audio';
    return false;
  }
}
$('mute').onclick=()=>{
  if(soundtrack.paused){soundtrack.muted=false;playMusic();}
  else soundtrack.muted=!soundtrack.muted;
  lossSound.muted=soundtrack.muted;
  $('mute').textContent=soundtrack.muted?'Unmute audio':'Mute audio';
  $('mute').setAttribute('aria-pressed',String(soundtrack.muted));
};
let run=null,phase='welcome',round=0,trial=0,health=100,score=0,random,world,player,enemy,moves,bumps,mazeStart,mazePathLength,pursuitAt=null,enemyAt,moveAt=0,deadline,shownAt,promptData,order,hiddenAt=null,hiddenMs=0,trialHiddenStart=0;
const held=new Set(),vectors={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
const assets=Object.fromEntries('MFN'.split('').flatMap(g=>[1,2,3].map(n=>{const name=g+n+'.png',img=new Image();img.src='assets/assistants/'+name;return [name,img];})));
let ready=false,starting=false;
const setupMessage=cfg.endpoint?'Your decisions will be saved to the study’s Google Sheet.':'Preview mode: Google Sheets is not connected yet. You can play and download a backup.';
$('setup').textContent='Loading game images and music…';
const musicReady=new Promise((resolve,reject)=>{
  if(soundtrack.readyState>=4){resolve();return;}
  soundtrack.addEventListener('canplaythrough',resolve,{once:true});
  soundtrack.addEventListener('error',reject,{once:true});
});
Promise.all([...Object.values(assets).map(img=>img.decode()),musicReady]).then(()=>{
  ready=true;$('setup').textContent=setupMessage;enable();
}).catch(()=>{$('setup').textContent='Game images or music could not load. Please reload before starting.';});
function demographics(){return {participant_gender:document.querySelector('input[name=gender]:checked')?.value,participant_age:Number($('age').value)};}
function validDemographics(){const d=demographics();return ['man','woman','other'].includes(d.participant_gender)&&/^[0-9]{1,3}$/.test($('age').value.trim())&&Number.isInteger(d.participant_age)&&d.participant_age>=1&&d.participant_age<=120;}
function enable(){$('start').disabled=!ready||starting||!$('consent').checked||!validDemographics();}
$('age').addEventListener('input',enable);
document.querySelectorAll('input[name=gender]').forEach(input=>input.addEventListener('change',enable));
$('consent').onchange=enable;
function hiddenTotal(){return hiddenMs+(hiddenAt===null?0:performance.now()-hiddenAt);}
function snapshot(){return {...run,phase:phase==='ended'?run.phase:phase,score,health,round:round+1,trial,elapsed_ms:Math.round(performance.now()-run.startedMono),hidden_ms:Math.round(hiddenTotal()),startedMono:undefined,config:JSON.stringify(run.settings)};}
function record(type,extra={}){if(!run)return;run.sequence++;const event={event_id:crypto.randomUUID(),session_id:run.session_id,participant_id:run.participant_id,participant_age:run.participant_age,participant_gender:run.participant_gender,study_id:cfg.studyId,version:cfg.version,sequence:run.sequence,event_type:type,prompt_id:run.prompt_id,phase:phase==='ended'?run.phase:phase,reason:run.reason||'',client_time:new Date().toISOString(),elapsed_ms:Math.round(performance.now()-run.startedMono),round:round+1,trial,score,health,...extra};logger.add(event,snapshot());}
async function start(){
  if(!ready||starting||phase!=='welcome'||!$('consent').checked||!validDemographics())return;
  const participantDemographics=demographics();
  starting=true;enable();$('start').textContent='Starting music…';
  lossSound.pause();lossSound.currentTime=0;soundtrack.currentTime=0;
  const playing=await playMusic();
  starting=false;$('start').textContent='Start game →';enable();
  if(!playing){$('setup').textContent='Music could not start. Press Start game to try again.';return;}
  $('setup').textContent=setupMessage;
  $('mute').textContent=soundtrack.muted?'Unmute audio':'Mute audio';
  document.body.classList.add('playing');
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];random=GameCore.rng(seed);
  const sequences=['MFN','MNF','FMN','FNM','NMF','NFM'];const sequence=cfg.genderSequence==='random'?sequences[Math.floor(random()*6)]:cfg.genderSequence;
  const condition=cfg.prompts[Math.floor(random()*cfg.prompts.length)];
  run={session_id:crypto.randomUUID(),participant_id:'P-'+crypto.randomUUID(),...participantDemographics,study_id:cfg.studyId,version:cfg.version,started_at:new Date().toISOString(),startedMono:performance.now(),sequence:0,status:'in_progress',seed,prompt_id:condition.id,prompt_template:condition.text,gender_sequence:sequence,decisions:0,correct_count:0,followed_count:0,reaction_total_ms:0,settings:JSON.parse(JSON.stringify(cfg))};
  delete run.settings.endpoint;round=0;trial=0;health=100;score=0;hiddenMs=0;hiddenAt=document.hidden?performance.now():null;
  order=sequence.split('').flatMap(g=>[1,2,3].map(n=>g+n+'.png'));
  $('welcome').hidden=true;$('result').hidden=true;$('play').hidden=false;record('session_start',{details:JSON.stringify({seed,condition,gender_sequence:sequence,config:run.settings,viewport:[innerWidth,innerHeight],input:matchMedia('(pointer:coarse)').matches?'touch':'pointer_or_keyboard'})});newMaze();logger.flush();
}
function newMaze(){phase='maze';held.clear();trial=0;world=GameCore.maze(random);player=[0,0];enemy=[0,0];moves=0;bumps=0;mazeStart=performance.now();enemyAt=null;pursuitAt=null;mazePathLength=GameCore.path(world.grid,player,world.goal).length-1;$('maze-instruction').textContent='Reach the blue exit. Keep moving!';$('maze-panel').hidden=false;$('hall').hidden=true;record('maze_start',{details:JSON.stringify(world)});draw();}
function updatePursuit(now){
  if(pursuitAt!==null)return;
  const remaining=GameCore.path(world.grid,player,world.goal).length-1;
  if(remaining<=mazePathLength/2){
    pursuitAt=now;
    $('maze-instruction').textContent="It's closing in. Keep moving toward the blue exit!";
    record('heartbeat',{details:JSON.stringify({action:'pursuit_accelerated',remaining_steps:remaining,maze_path_steps:mazePathLength,ramp_ms:cfg.enemyRampMs,target_delay_ms:cfg.enemySprintDelayMs})});
  }
}
function enemyStepDelay(now){
  if(pursuitAt===null)return cfg.enemyDelayMs;
  const progress=Math.min(1,Math.max(0,(now-pursuitAt)/cfg.enemyRampMs));
  return cfg.enemyDelayMs+(cfg.enemySprintDelayMs-cfg.enemyDelayMs)*progress;
}
function draw(){const ctx=$('maze').getContext('2d'),cell=50;world.grid.forEach((row,y)=>row.forEach((wall,x)=>{ctx.fillStyle=wall?'#172536':'#d5e4ed';ctx.fillRect(x*cell,y*cell,cell,cell);}));ctx.fillStyle='#477eff';ctx.fillRect(world.goal[0]*cell,world.goal[1]*cell,cell,cell);for(const [p,color] of [[enemy,'#f06572'],[player,'#ffd35d']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(p[0]*cell+25,p[1]*cell+25,17,0,Math.PI*2);ctx.fill();}}
function move(dir){if(phase!=='maze')return;const now=performance.now();if(now-moveAt<90)return;moveAt=now;const v=vectors[dir],next=[player[0]+v[0],player[1]+v[1]];if(world.grid[next[1]]?.[next[0]]!==0){bumps++;return;}player=next;moves++;updatePursuit(now);if(enemyAt===null)enemyAt=now;draw();if(player.toString()===enemy.toString()){finish('caught');return;}if(player.toString()===world.goal.toString()){record('maze_complete',{reaction_time_ms:Math.round(now-mazeStart),details:JSON.stringify({moves,wall_attempts:bumps,shortest_path_steps:GameCore.path(world.grid,[0,0],world.goal).length-1})});deadline=now+cfg.roundTimes[round]*1000;trial=0;nextPrompt();}}
function nextPrompt(){
  held.clear();if(performance.now()>=deadline){finish('timeout');return;}
  if(trial>=order.length){record('hallway_complete');round++;if(round>=cfg.roundTimes.length){round--;finish('completed');}else newMaze();return;}
  trial++;const file=order[trial-1],gender={M:'male',F:'female',N:'neutral'}[file[0]],name={M:'John',F:'Mira',N:'Robin'}[file[0]];
  const correct=random()<.5?'left':'right',suggestion=random()<cfg.agentAccuracy/100?correct:(correct==='left'?'right':'left');
  promptData={agent_image:file,agent_name:name,agent_gender:gender,prompt_id:run.prompt_id,prompt_text:run.prompt_template.replaceAll('{direction}',suggestion),agent_suggestion:suggestion,correct_door:correct,agent_truthful:suggestion===correct};
  $('maze-panel').hidden=true;$('hall').hidden=false;$('prompt').textContent=promptData.prompt_text;$('agent').src=assets[file].src;$('agent').alt=gender+' guide';$('agent-name').textContent=name;$('feedback').textContent='';
  phase='rendering';document.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(phase!=='rendering')return;shownAt=performance.now();trialHiddenStart=hiddenTotal();phase='choice';record('prompt_shown',{...promptData,time_remaining_ms:Math.max(0,Math.round(deadline-shownAt))});document.querySelectorAll('[data-choice]').forEach(b=>b.disabled=false);}));
}
function choose(choice,input){if(phase!=='choice')return;const now=performance.now();if(now>=deadline){finish('timeout');return;}phase='feedback';const result=GameCore.decision(health,score,choice,promptData.correct_door,promptData.agent_suggestion,cfg.wrongPenalty),rt=Math.round(now-shownAt);health=result.health_after;score=result.score;run.decisions++;run.correct_count+=Number(result.correct);run.followed_count+=Number(result.compliance);run.reaction_total_ms+=rt;record('decision',{...promptData,...result,player_choice:choice,input_method:input,reaction_time_ms:rt,hidden_during_prompt_ms:Math.round(hiddenTotal()-trialHiddenStart),time_remaining_ms:Math.max(0,Math.round(deadline-now))});document.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);$('feedback').textContent=result.correct?'Correct door. +10 points.':`Wrong door. −${cfg.wrongPenalty} health.`;if(health<=0){finish('health_depleted');return;}setTimeout(()=>{if(phase==='feedback')nextPrompt();},350);}
function finish(reason){if(!run||phase==='ended')return;const previous=phase;const playLoss=reason==='caught'||reason==='health_depleted';phase='ended';held.clear();soundtrack.pause();if(playLoss){lossSound.currentTime=0;lossSound.muted=soundtrack.muted;lossSound.play().catch(()=>{});}soundtrack.currentTime=0;document.body.classList.remove('playing');run.status=reason;run.reason=reason;run.phase=previous;run.ended_at=new Date().toISOString();record('session_end',{...(previous==='choice'?promptData:{}),details:JSON.stringify({reason,phase:previous,maze_moves:moves,wall_attempts:bumps})});$('play').hidden=true;$('result').hidden=false;$('result-title').textContent='Thank you for participating.';$('result-detail').textContent='Your participation in this HCI research study helps us understand how people make decisions with an assistant.';logger.finishSaving();logger.flush();}
$('start').onclick=start;$('quit').onclick=()=>finish('quit');$('again').onclick=()=>{$('result').hidden=true;$('welcome').hidden=false;phase='welcome';run=null;};$('download').onclick=$('finish-download').onclick=()=>logger.download();$('retry').onclick=()=>logger.retry();
document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=e=>choose(b.dataset.choice,e.detail===0?'keyboard_button':'pointer'));
document.querySelectorAll('[data-move]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();held.add(b.dataset.move);b.setPointerCapture(e.pointerId);move(b.dataset.move);};b.onpointerup=b.onpointercancel=()=>held.delete(b.dataset.move);});
addEventListener('keydown',e=>{const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];if(!dir||!['maze','choice','feedback','rendering'].includes(phase))return;e.preventDefault();if(phase==='maze'){held.add(dir);move(dir);}else if(!e.repeat&&(dir==='left'||dir==='right'))choose(dir,'keyboard');});addEventListener('keyup',e=>held.delete(e.key.replace('Arrow','').toLowerCase()));addEventListener('blur',()=>held.clear());
document.addEventListener('visibilitychange',()=>{held.clear();if(!run||phase==='ended')return;if(document.hidden){hiddenAt=performance.now();record('tab_hidden');logger.flush();}else{if(hiddenAt!==null)hiddenMs+=performance.now()-hiddenAt;hiddenAt=null;record('tab_visible');}});
addEventListener('pagehide',()=>{if(run&&phase!=='ended'){record('page_exit',{details:'Last observed exit; not proof of final abandonment.'});}logger.flush(); /* Persisted outbox retries on the next visit if delivery is interrupted. */ });
let heartbeat=0;setInterval(()=>{if(!run||phase==='ended'||phase==='welcome')return;const now=performance.now();$('stage').textContent=`Hallway ${round+1}/${cfg.roundTimes.length} · ${phase==='maze'?'Maze':`Choice ${trial}/9`}`;$('score').textContent=`Score ${score}`;$('health').textContent=`Health ${health}`;const seconds=Math.max(0,Math.ceil((deadline-now)/1000));$('timer').textContent=phase==='maze'?'REACH THE EXIT':`${seconds}s LEFT`;$('timer').classList.toggle('urgent',phase!=='maze'&&seconds<=10);$('timer').classList.toggle('maze-hint',phase==='maze');
  if(phase==='maze'){if(held.size)move(held.values().next().value);if(phase==='maze'&&enemyAt!==null&&now-enemyAt>=enemyStepDelay(now)){enemy=GameCore.path(world.grid,enemy,player)[1]||enemy;enemyAt=now;draw();if(enemy.toString()===player.toString())finish('caught');}}
  else if(now>=deadline&&phase!=='ended')finish('timeout');
  if(now-heartbeat>15000&&phase!=='ended'){heartbeat=now;record('heartbeat',{details:JSON.stringify({phase,maze_moves:moves,wall_attempts:bumps})});}
},40);
logger.flush();
