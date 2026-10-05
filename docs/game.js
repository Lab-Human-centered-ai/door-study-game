'use strict';
const $=id=>document.getElementById(id), cfg=window.STUDY_CONFIG;
const logger=new StudyLogger(cfg.endpoint,s=>$('save-status').textContent=s);
if(!cfg.endpoint)$('finish-save-help').textContent='This is a preview run. Download a data backup to keep your results.';
let run=null,phase='welcome',round=0,trial=0,health=100,score=0,random,world,player,enemy,moves,bumps,mazeStart,enemyAt,moveAt=0,deadline,shownAt,promptData,order,hiddenAt=null,hiddenMs=0,trialHiddenStart=0;
const held=new Set(),vectors={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
const assets=Object.fromEntries('MFN'.split('').flatMap(g=>[1,2,3].map(n=>{const name=g+n+'.png',img=new Image();img.src='assets/assistants/'+name;return [name,img];})));
let ready=false;
Promise.all(Object.values(assets).map(img=>img.decode())).then(()=>{ready=true;enable();}).catch(()=>{$('setup').textContent='Agent images could not load. Reload the page before starting.';});
$('setup').textContent=cfg.endpoint?'Your decisions will be saved to the study’s Google Sheet.':'Preview mode: Google Sheets is not connected yet. You can play and download a backup.';
function enable(){$('start').disabled=!ready||!$('consent').checked;}
$('consent').onchange=enable;
function hiddenTotal(){return hiddenMs+(hiddenAt===null?0:performance.now()-hiddenAt);}
function snapshot(){return {...run,score,health,round:round+1,trial,elapsed_ms:Math.round(performance.now()-run.startedMono),hidden_ms:Math.round(hiddenTotal()),startedMono:undefined,config:JSON.stringify(run.settings)};}
function record(type,extra={}){if(!run)return;run.sequence++;const event={event_id:crypto.randomUUID(),session_id:run.session_id,participant_id:run.participant_id,study_id:cfg.studyId,version:cfg.version,sequence:run.sequence,event_type:type,client_time:new Date().toISOString(),elapsed_ms:Math.round(performance.now()-run.startedMono),round:round+1,trial,score,health,...extra};logger.add(event,snapshot());}
function start(){
  if(!ready||!$('consent').checked)return;
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];random=GameCore.rng(seed);
  const sequences=['MFN','MNF','FMN','FNM','NMF','NFM'];const sequence=cfg.genderSequence==='random'?sequences[Math.floor(random()*6)]:cfg.genderSequence;
  const condition=cfg.prompts[Math.floor(random()*cfg.prompts.length)];
  run={session_id:crypto.randomUUID(),participant_id:$('participant').value.trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40)||'P-'+crypto.randomUUID().slice(0,8),study_id:cfg.studyId,version:cfg.version,started_at:new Date().toISOString(),startedMono:performance.now(),sequence:0,status:'in_progress',seed,prompt_id:condition.id,prompt_template:condition.text,gender_sequence:sequence,decisions:0,correct_count:0,followed_count:0,reaction_total_ms:0,settings:JSON.parse(JSON.stringify(cfg))};
  delete run.settings.endpoint;round=0;trial=0;health=100;score=0;hiddenMs=0;hiddenAt=document.hidden?performance.now():null;
  order=sequence.split('').flatMap(g=>[1,2,3].map(n=>g+n+'.png'));
  $('welcome').hidden=true;$('result').hidden=true;$('play').hidden=false;record('session_start',{details:JSON.stringify({seed,condition,gender_sequence:sequence,config:run.settings,viewport:[innerWidth,innerHeight],input:matchMedia('(pointer:coarse)').matches?'touch':'pointer_or_keyboard',consent_version:'1'})});newMaze();logger.flush();
}
function newMaze(){phase='maze';held.clear();trial=0;world=GameCore.maze(random);player=[0,0];enemy=[0,0];moves=0;bumps=0;mazeStart=performance.now();enemyAt=null;$('maze-panel').hidden=false;$('hall').hidden=true;record('maze_start',{details:JSON.stringify(world)});draw();}
function draw(){const ctx=$('maze').getContext('2d'),cell=50;world.grid.forEach((row,y)=>row.forEach((wall,x)=>{ctx.fillStyle=wall?'#172536':'#d5e4ed';ctx.fillRect(x*cell,y*cell,cell,cell);}));ctx.fillStyle='#477eff';ctx.fillRect(world.goal[0]*cell,world.goal[1]*cell,cell,cell);for(const [p,color] of [[enemy,'#f06572'],[player,'#ffd35d']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(p[0]*cell+25,p[1]*cell+25,17,0,Math.PI*2);ctx.fill();}}
function move(dir){if(phase!=='maze')return;const now=performance.now();if(now-moveAt<90)return;moveAt=now;const v=vectors[dir],next=[player[0]+v[0],player[1]+v[1]];if(world.grid[next[1]]?.[next[0]]!==0){bumps++;return;}player=next;moves++;if(enemyAt===null)enemyAt=now;draw();if(player.toString()===enemy.toString()){finish('caught');return;}if(player.toString()===world.goal.toString()){record('maze_complete',{reaction_time_ms:Math.round(now-mazeStart),details:JSON.stringify({moves,wall_attempts:bumps,shortest_path_steps:GameCore.path(world.grid,[0,0],world.goal).length-1})});deadline=now+cfg.roundTimes[round]*1000;trial=0;nextPrompt();}}
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
function finish(reason){if(!run||phase==='ended')return;const previous=phase;phase='ended';held.clear();run.status=reason;run.ended_at=new Date().toISOString();record('session_end',{...(previous==='choice'?promptData:{}),details:JSON.stringify({reason,phase:previous,maze_moves:moves,wall_attempts:bumps})});$('play').hidden=true;$('result').hidden=false;$('result-title').textContent=reason==='completed'?'All hallways complete!':'Run finished';$('result-detail').textContent=`${score} points · ${run.decisions} choices · ${Math.round((performance.now()-run.startedMono)/1000)} seconds · ${reason.replaceAll('_',' ')}`;logger.flush();}
$('start').onclick=start;$('quit').onclick=()=>finish('quit');$('again').onclick=()=>{$('result').hidden=true;$('welcome').hidden=false;phase='welcome';run=null;};$('download').onclick=()=>logger.download();$('retry').onclick=()=>logger.flush();
document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=e=>choose(b.dataset.choice,e.detail===0?'keyboard_button':'pointer'));
document.querySelectorAll('[data-move]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();held.add(b.dataset.move);b.setPointerCapture(e.pointerId);move(b.dataset.move);};b.onpointerup=b.onpointercancel=()=>held.delete(b.dataset.move);});
addEventListener('keydown',e=>{const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];if(!dir||!['maze','choice','feedback','rendering'].includes(phase))return;e.preventDefault();if(phase==='maze'){held.add(dir);move(dir);}else if(!e.repeat&&(dir==='left'||dir==='right'))choose(dir,'keyboard');});addEventListener('keyup',e=>held.delete(e.key.replace('Arrow','').toLowerCase()));addEventListener('blur',()=>held.clear());
document.addEventListener('visibilitychange',()=>{held.clear();if(!run||phase==='ended')return;if(document.hidden){hiddenAt=performance.now();record('tab_hidden');logger.flush();}else{if(hiddenAt!==null)hiddenMs+=performance.now()-hiddenAt;hiddenAt=null;record('tab_visible');}});
addEventListener('pagehide',()=>{if(run&&phase!=='ended'){record('page_exit',{details:'Last observed exit; not proof of final abandonment.'});} /* outbox was synchronously persisted; next visit retries it */ });
let heartbeat=0;setInterval(()=>{if(!run||phase==='ended'||phase==='welcome')return;const now=performance.now();$('stage').textContent=`Hallway ${round+1}/${cfg.roundTimes.length} · ${phase==='maze'?'Maze':`Choice ${trial}/9`}`;$('score').textContent=`Score ${score}`;$('health').textContent=`Health ${health}`;$('timer').textContent=phase==='maze'?'Reach the exit':`${Math.max(0,Math.ceil((deadline-now)/1000))}s left`;
  if(phase==='maze'){if(held.size)move(held.values().next().value);if(phase==='maze'&&enemyAt!==null&&now-enemyAt>=cfg.enemyDelayMs){enemy=GameCore.path(world.grid,enemy,player)[1]||enemy;enemyAt=now;draw();if(enemy.toString()===player.toString())finish('caught');}}
  else if(now>=deadline&&phase!=='ended')finish('timeout');
  if(now-heartbeat>15000&&phase!=='ended'){heartbeat=now;record('heartbeat',{details:JSON.stringify({phase,maze_moves:moves,wall_attempts:bumps})});}
},40);
logger.flush();
