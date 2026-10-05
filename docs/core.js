(function(root){
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function maze(random){
    const grid=Array.from({length:12},()=>Array(12).fill(1)),stack=[[0,0]];grid[0][0]=0;
    while(stack.length){const [x,y]=stack.at(-1), options=dirs.filter(([dx,dy])=>grid[y+2*dy]?.[x+2*dx]===1);
      if(!options.length){stack.pop();continue;}const [dx,dy]=options[Math.floor(random()*options.length)];grid[y+dy][x+dx]=0;grid[y+2*dy][x+2*dx]=0;stack.push([x+2*dx,y+2*dy]);}
    let q=[[0,0]],seen=new Set(['0,0']);for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [dx,dy] of dirs){const p=[x+dx,y+dy];if(grid[p[1]]?.[p[0]]===0&&!seen.has(p.toString())){seen.add(p.toString());q.push(p);}}}return {grid,goal:q.at(-1)};
  }
  function path(grid,start,goal){const q=[[start]],seen=new Set([start.toString()]);for(let i=0;i<q.length;i++){const p=q[i],a=p.at(-1);if(a.toString()===goal.toString())return p;for(const [dx,dy] of dirs){const n=[a[0]+dx,a[1]+dy];if(grid[n[1]]?.[n[0]]===0&&!seen.has(n.toString())){seen.add(n.toString());q.push([...p,n]);}}}return [];}
  function decision(health,score,choice,correct,suggestion,penalty){return {correct:choice===correct,compliance:choice===suggestion,health_before:health,health_after:Math.max(0,health-(choice===correct?0:penalty)),score:score+(choice===correct?10:0)};}
  const api={rng,maze,path,decision};if(typeof module!=='undefined')module.exports=api;else root.GameCore=api;
})(globalThis);
