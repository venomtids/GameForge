/* BOSQUE VIVO — jogo programado com a API pública GameForge 0.5.
   Edite este arquivo ou selecione "Controlador do jogo" → Scripts na engine.
   Os sistemas de sobrevivência estão AQUI, não embutidos no editor.
   O volume inicial está no projeto: edições de blocos no editor são preservadas.
   "Novo mundo" regenera pelo SEED abaixo e descarta apenas o estado da execução.
*/
const CONFIG = { seed:1729, daySeconds:240, hungerPerSecond:0.035, enemies:3,
  damage:3, reach:5.5, player:'survivor', healthMax:20, hungerMax:20 };
const ITEMS={dirt:'Terra',stone:'Pedra',wood:'Madeira',plank:'Tábuas',coal:'Carvão',iron:'Ferro',crystal:'Cristal',berry:'Frutas',stick:'Graveto',pickaxe:'Picareta',ironpick:'Picareta de ferro',sword:'Espada',torch:'Tocha',beacon:'Farol'};
const RECIPES=[
 {id:'plank',name:'4 tábuas',cost:{wood:1},count:4},
 {id:'stick',name:'4 gravetos',cost:{plank:2},count:4},
 {id:'pickaxe',name:'Picareta de madeira',cost:{plank:3,stick:2},count:1},
 {id:'sword',name:'Espada de madeira',cost:{plank:2,stick:1},count:1},
 {id:'ironpick',name:'Picareta de ferro',cost:{iron:3,stick:2},count:1},
 {id:'torch',name:'4 tochas decorativas',cost:{coal:1,stick:1},count:4},
 {id:'beacon',name:'Farol do bosque (objetivo)',cost:{stone:6,iron:2,crystal:1},count:1},
];
const SLOTS=['dirt','stone','wood','plank','torch','berry','pickaxe','beacon'];
const PLACE={dirt:3,stone:4,wood:5,plank:9,torch:13,beacon:14};
let inventory={},health=20,hunger=20,clock=0,deaths=0,won=false,selected=0;
let menu='welcome',message='Explore, colete madeira e construa seu abrigo.',messageUntil=6;
let mobs=[],mineKey='',mineTime=0,hitTimer=0,damageTimer=0,healTimer=0,hudTimer=0,saveTimer=0;
let falling=0,night=false,lastSave=null;
const menuIDs=['menu-bg','menu-title','menu-help','begin','load','new-world'];
const inventoryIDs=['bag-bg','bag-title','bag-items','bag-close','save','eat',...RECIPES.map((_,i)=>'craft-'+i)];
function count(k){return inventory[k]||0;}
function add(k,n=1){inventory[k]=Math.min(9999,count(k)+n);}
function notice(text){message=text;messageUntil=clock+6;engine.log(text);}
function showMenu(mode){
 menu=mode;engine.freeze(!!menu);
 menuIDs.forEach(id=>engine.ui(id,{visible:mode==='welcome'||mode==='dead'}));
 inventoryIDs.forEach(id=>engine.ui(id,{visible:mode==='bag'}));
 engine.ui('menu-title',{text:mode==='dead'?'Você caiu. Tente novamente!':'BOSQUE VIVO'});
 engine.ui('begin',{text:mode==='dead'?'Renascer (manter inventário)':'Começar / continuar'});
 engine.ui('menu-help',{text:mode==='dead'?'Vida e fome serão restauradas. O mundo construído e os itens continuam com você.':'Sobreviva e construa o Farol do Bosque.\nWASD: mover · Shift: correr · Espaço: pular\nEsquerdo: minerar / atacar · Direito: construir\n1–8: hotbar · E: mochila/receitas · F: comer\nMadeira → tábuas/graveto → picaretas → minérios → farol.\nSalve na mochila antes de encerrar.'});
 hudTimer=1;
}
function ground(x,z){for(let y=23;y>=0;y--){const t=engine.voxel.get(Math.floor(x),y,Math.floor(z));if(t&&t!==8&&t!==13)return y+1;}return 1;}
function spawnMobs(){
 mobs.forEach(m=>engine.remove(m.id));mobs=[];
 const size=engine.voxel.size;
 for(let i=0;i<CONFIG.enemies;i++){
  const x=4+(i*11+CONFIG.seed)%Math.max(8,size-8),z=4+(i*7+11)%Math.max(8,size-8),id='forest-creature-'+i,y=ground(x,z)+.6;
  const m={id,x,y,z,hp:8,wait:0};mobs.push(m);
  engine.spawn(id,{kind:'capsule',x,y,z,scale:[1.2,1.1,1.2],color:'#809d68'});
 }
}
function start(){
 inventory={berry:8};lastSave=engine.saved;
 spawnMobs();showMenu('welcome');paintHUD();engine.log('Bosque Vivo: projeto de jogo em JavaScript iniciado.');
}
function die(){health=0;deaths++;notice('Você perdeu a vida.');showMenu('dead');}
function hurt(amount){if(menu||health<=0)return;health=Math.max(0,health-amount);damageTimer=.8;if(health<=0)die();}
function eat(){if(count('berry')<1){notice('Sem frutas. Quebre folhas para procurar mais.');return;}if(hunger>=20){notice('Você já está alimentado.');return;}inventory.berry--;hunger=Math.min(20,hunger+5);health=Math.min(20,health+1);notice('Fruta consumida: +5 de fome.');hudTimer=1;}
function craft(index){const recipe=RECIPES[index];if(!recipe)return;
 if(Object.entries(recipe.cost).some(([k,v])=>count(k)<v)){notice('Faltam ingredientes para '+recipe.name+'.');return;}
 Object.entries(recipe.cost).forEach(([k,v])=>inventory[k]-=v);add(recipe.id,recipe.count);notice('Criado: '+recipe.name+'.');hudTimer=1;
}
function snapshot(){const p=engine.get(CONFIG.player);return {format:'bosque-vivo',version:1,size:engine.voxel.size,blocks:engine.voxel.snapshot(),inventory:{...inventory},health,hunger,clock,deaths,won,selected,position:p?[p.x,p.y,p.z]:null};}
function save(){lastSave=snapshot();engine.store(lastSave);}
function load(){const s=lastSave;if(!s||s.format!=='bosque-vivo'||s.version!==1||s.size!==engine.voxel.size||!Array.isArray(s.blocks)||!s.inventory){notice('Nenhum progresso compatível salvo neste aplicativo.');return;}
 try{
 engine.voxel.replace(s.blocks);inventory={};for(const k of Object.keys(ITEMS)){const v=s.inventory[k];if(Number.isInteger(v)&&v>=0&&v<=9999)inventory[k]=v;}
 health=engine.clamp(Number(s.health)||20,1,20);hunger=engine.clamp(Number(s.hunger)||10,0,20);clock=engine.clamp(Number(s.clock)||0,0,10000000);deaths=Math.max(0,Number(s.deaths)||0);won=!!s.won;selected=Number.isInteger(s.selected)?engine.clamp(s.selected,0,7):0;
 if(Array.isArray(s.position)&&s.position.length===3&&s.position.every(Number.isFinite))engine.set(CONFIG.player,{x:s.position[0],y:s.position[1],z:s.position[2],vx:0,vy:0,vz:0});
 spawnMobs();showMenu('');notice('Progresso carregado.');
 }catch(error){notice('Falha ao carregar: '+String(error));}
}
function newWorld(){engine.voxel.replace(createWorld(CONFIG.seed,engine.voxel.size));inventory={berry:8};health=hunger=20;clock=0;deaths=0;won=false;selected=0;engine.respawn();spawnMobs();showMenu('');notice('Novo mundo criado. O save anterior só muda quando você salvar.');}
function paintHUD(){
 engine.ui('life',{value:health/20,text:'VIDA  '+Math.ceil(health)+' / 20',color:health<6?'#da6961':'#d78475'});
 engine.ui('hunger',{value:hunger/20,text:'FOME  '+Math.ceil(hunger)+' / 20'});
 engine.ui('time',{text:(night?'NOITE':'DIA')+' '+(Math.floor(clock/CONFIG.daySeconds)+1)+' · '+deaths+' quedas'});
 engine.ui('message',{text:clock<messageUntil?message:'E: mochila/receitas · F: fruta · 1–8: selecionar'});
 const objective=won?'OBJETIVO CONCLUÍDO!\nFarol construído. Continue explorando e construindo.':count('beacon')?'OBJETIVO: coloque o Farol\nSelecione 8 e use o botão direito.':count('ironpick')?'OBJETIVO: encontre cristal e faça o Farol\n6 pedras + 2 ferros + 1 cristal.':count('pickaxe')?'OBJETIVO: minere ferro\n3 ferros + 2 gravetos → picareta de ferro.':'OBJETIVO: ferramentas\nColete madeira → tábuas → gravetos → picareta.';
 engine.ui('objective',{text:objective});
 SLOTS.forEach((k,i)=>engine.ui('slot-'+i,{text:(i+1)+' · '+ITEMS[k]+'\n'+(k==='pickaxe'?(count('ironpick')?'FERRO':count(k)?'MADEIRA':'—'):count(k)),background:i===selected?'#668054ee':'#182d24dd'}));
 engine.ui('bag-items',{text:Object.entries(ITEMS).filter(([k])=>count(k)>0).map(([k,label])=>label+': '+count(k)).join('  · ')});
 RECIPES.forEach((r,i)=>engine.ui('craft-'+i,{text:r.name+'  ←  '+Object.entries(r.cost).map(([k,v])=>v+' '+ITEMS[k]).join(' + '),background:Object.entries(r.cost).every(([k,v])=>count(k)>=v)?'#426848':'#3e433f'}));
}
function mining(dt,input,p){
 if(!input.mouse0){mineKey='';mineTime=0;engine.ui('mining',{visible:false});return;}
 const target=input.target;const mob=target&&mobs.find(m=>m.id===target.id&&m.hp>0);
 if(mob&&target.distance<=3&&(!input.ray||target.distance<input.ray.distance)){
  if(hitTimer<=0){hitTimer=.45;mob.hp-=count('sword')?4:2;engine.set(mob.id,{color:'#efb389'});if(mob.hp<=0){engine.remove(mob.id);add('berry',2);notice('Criatura afastada: +2 frutas.');}}return;
 }
 const ray=input.ray;if(!ray||ray.distance>CONFIG.reach)return;
 const [x,y,z]=ray.cell,t=engine.voxel.get(x,y,z),key=x+','+y+','+z;
 if(t===1||t===8||!t){engine.ui('mining',{visible:false});return;}
 if([4,10,11,12].includes(t)&&!count('pickaxe')&&!count('ironpick')){engine.ui('mining',{visible:true,text:'Precisa de uma picareta',value:0});return;}
 if(t===12&&!count('ironpick')){engine.ui('mining',{visible:true,text:'Cristal: precisa de picareta de ferro',value:0});return;}
 if(key!==mineKey){mineKey=key;mineTime=0;}mineTime+=dt;
 const duration=t===6?.2:t===5?.65:[4,10,11,12].includes(t)?(count('ironpick')?.35:1):.35;
 engine.ui('mining',{visible:true,value:mineTime/duration,text:'Minerando… '+Math.min(100,Math.floor(mineTime/duration*100))+'%'});
 if(mineTime>=duration){engine.voxel.set(x,y,z,0);mineTime=0;mineKey='';const drop=({2:'dirt',3:'dirt',4:'stone',5:'wood',6:'berry',7:'dirt',9:'plank',10:'coal',11:'iron',12:'crystal',13:'torch',14:'beacon'})[t];if(drop)add(drop,t===6?1:1);hudTimer=1;}
}
function place(input,p){const ray=input.ray;if(!ray||ray.distance>CONFIG.reach)return;const item=SLOTS[selected];if(item==='berry'){eat();return;}const block=PLACE[item];if(!block||count(item)<1){notice('Selecione um bloco disponível na hotbar.');return;}
 const cell=ray.cell.map((v,i)=>v+ray.normal[i]),[x,y,z]=cell;
 if(x<0||z<0||y<1||x>=engine.voxel.size||z>=engine.voxel.size||y>=24)return;
 if(Math.abs(x+.5-p.x)<.82&&Math.abs(z+.5-p.z)<.82&&y<p.y+.85&&y+1>p.y-.85){notice('Não é possível construir dentro do personagem.');return;}
 if(engine.voxel.get(x,y,z)!==0)return;
 if(engine.voxel.set(x,y,z,block)){inventory[item]--;if(item==='beacon'){won=true;notice('Farol construído! Objetivo concluído.');save();}hudTimer=1;}
}
function update(dt,time,input){
 for(const event of input.events||[]){
  if(event==='begin'){if(health<=0){health=hunger=20;engine.respawn();}showMenu('');}
  if(event==='load')load();if(event==='new-world')newWorld();
  if(event==='inventory')showMenu(menu==='bag'?'':'bag');if(event==='bag-close')showMenu('');if(event==='eat')eat();if(event==='save')save();
  if(event.startsWith('craft-'))craft(Number(event.slice(6)));if(event.startsWith('slot-'))selected=Number(event.slice(5));
  if(event==='storage-saved')notice('Progresso salvo neste aplicativo.');if(event==='storage-error')notice('Não foi possível salvar: verifique o espaço disponível.');
 }
 if(input.pressed.e&&health>0)showMenu(menu==='bag'?'':'bag');
 for(let i=0;i<8;i++)if(input.pressed[String(i+1)]){selected=i;hudTimer=1;}
 if(input.pressed.f)eat();
 hudTimer+=dt;if(hudTimer>.2){hudTimer=0;paintHUD();}
 if(menu)return;
 const p=engine.get(CONFIG.player);if(!p)return;
 clock+=dt;hitTimer-=dt;damageTimer-=dt;healTimer+=dt;saveTimer+=dt;
 const phase=clock/CONFIG.daySeconds%1;night=phase>.62;
 engine.sky(Math.sin(phase*Math.PI*2)*55+12,35+phase*150);
 hunger=Math.max(0,hunger-dt*CONFIG.hungerPerSecond*(input.shift?2:1));
 if(hunger===0&&damageTimer<=0)hurt(1);
 if(healTimer>5){healTimer=0;if(hunger>15&&health<20){health=Math.min(20,health+1);hunger=Math.max(0,hunger-.5);}}
 if(p.vy<falling)falling=p.vy;if(p.grounded){if(falling<-9)hurt(Math.floor((-falling-8)*1.5));falling=0;}
 if(p.y<-5){hurt(20);return;}
 if(engine.voxel.get(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z))===8&&input.space)engine.set(CONFIG.player,{vy:3});
 mining(dt,input,p);if(input.pressed.mouse2)place(input,p);
 for(const m of mobs){if(m.hp<=0)continue;
   const dx=p.x-m.x,dz=p.z-m.z,d=Math.hypot(dx,dz),speed=night?1.8:.25;
   let mx=night&&d<18?dx/Math.max(d,.01):Math.sin(clock*.3+m.x),mz=night&&d<18?dz/Math.max(d,.01):Math.cos(clock*.3+m.z);
   const nx=engine.clamp(m.x+mx*speed*dt,1,engine.voxel.size-2),nz=engine.clamp(m.z+mz*speed*dt,1,engine.voxel.size-2),gy=ground(nx,nz)+.6;
   if(Math.abs(gy-m.y)<1.3){m.x=nx;m.z=nz;m.y=gy;}
   engine.set(m.id,{x:m.x,y:m.y,z:m.z,ry:Math.atan2(mx,mz)*180/Math.PI,color:night?'#c57e6c':'#809d68'});
   if(night&&d<1.3&&Math.abs(p.y-m.y)<1.5&&damageTimer<=0)hurt(CONFIG.damage);
 }
 if(saveTimer>45){saveTimer=0;save();}
}
