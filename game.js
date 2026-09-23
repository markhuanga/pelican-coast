import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// 风与鱼之歌 / Pelican Coast — an original procedural Three.js browser game.
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;
const LANES = [-2.65, 0, 2.65];
const cameras = ['经典追逐镜头', '电影环绕镜头', '鹈鹕第一视角', '公路侧拍镜头', '明信片远景镜头'];
const A = [
  ['🐟','初次邂逅','捕获第一条飞鱼',s=>s.fish>=1],
  ['🐠','海鲜收藏家','累计捕获 10 条飞鱼',s=>s.fish>=10],
  ['🦈','海洋传说','累计捕获 50 条飞鱼',s=>s.fish>=50],
  ['👑','鱼群之王','累计捕获 100 条飞鱼',s=>s.fish>=100],
  ['🔥','幸运三连','连续捕获 3 条飞鱼',s=>s.bestCombo>=3],
  ['⚡','神乎其技','连续捕获 8 条飞鱼',s=>s.bestCombo>=8],
  ['💨','追风少年','骑行速度达到 25 km/h',s=>s.maxSpeed>=25],
  ['🚀','闪电鹈鹕','骑行速度达到 40 km/h',s=>s.maxSpeed>=40],
  ['🪂','空中美味','在跳跃时捕获飞鱼',s=>s.jumpCatch],
  ['🪽','翅膀的胜利','展翅翘头时捕获飞鱼',s=>s.wingCatch],
  ['🌙','月光晚餐','在星空月夜下捕获飞鱼',s=>s.nightCatch],
  ['🧭','不问归期','单次骑行坚持 2 分钟',s=>s.rideTime>=120],
  ['🎬','镜头诗人','体验全部 5 种镜头',s=>s.cameraSet.size>=5],
  ['✨','随遇而安','让自动驾驶替你抓到一条鱼',s=>s.autoCatch],
];
const dom = {
  game:$('game'), hud:$('hud'), start:$('startScreen'), loading:$('loading'), toast:$('toast'), fatal:$('fatal'),
  score:$('score'), fish:$('fishCount'), combo:$('combo'), distance:$('distance'), achievements:$('achievementCount'),
  timeEmoji:$('timeEmoji'),timeText:$('timeText'),timeFill:$('timeFill'),speed:$('speed'),speedFill:$('speedFill'),
  pedalText:$('pedalText'),auto:$('autoIndicator'),cameraName:$('cameraName'),fps:$('fps'),comboBanner:$('comboBanner'),comboBig:$('comboBig'),
  pause:$('pauseScreen'), drawer:$('achievementPanel'), list:$('achievementList'),progress:$('drawerProgress'),sound:$('soundButton'), quality:$('qualityButton')
};

// Persistent badges; per-run scores are reset on replay.
let saved = {};
try { saved = JSON.parse(localStorage.getItem('pelican-coast-save-v1') || '{}'); } catch { saved = {}; }
let badges = new Set(Array.isArray(saved.badges) ? saved.badges : []);
const stats = () => ({score:0,fish:0,combo:0,bestCombo:0,maxSpeed:0,distance:0,rideTime:0,jumpCatch:false,wingCatch:false,nightCatch:false,autoCatch:false,cameraSet:new Set([0])});
let state = stats();
const game = {started:false,paused:false,time:0,speed:16,targetSpeed:16,lane:1,playerX:0,y:0,yVelocity:0,jumpTime:0,wingTime:0,wingCooldown:0,manualAt:-100, auto:true, camera:0, quality:'AUTO',activeKeys:new Set(), drift:0, pedal:0, cycle:0, comboShowUntil:0, lastCatch:-100, notice:false, freeze:false};
let timeNow=0, camera,scene,renderer,clock,canvas,waterMat,skyMat,lights={}, character={},env={},fishes=[],fishParticles=[], roadside=[], birds=[],stars,sun,moon;
let fpsSample=60,fpsAccum=0,fpsFrames=0, qualityDrop=0, lastUi=0, toastTimeouts=[];
const tempA=new THREE.Vector3(),tempB=new THREE.Vector3();
const rand=(a,b)=>a+Math.random()*(b-a);

const MAT = {
 white:new THREE.MeshStandardMaterial({color:0xfff9e9,roughness:.88}),
 warmWhite:new THREE.MeshStandardMaterial({color:0xffecce,roughness:.86}),
 feathers:new THREE.MeshStandardMaterial({color:0xf7f4e8,roughness:.89,side:THREE.DoubleSide}),
 orange:new THREE.MeshStandardMaterial({color:0xf4a742,roughness:.64}),
 beak:new THREE.MeshStandardMaterial({color:0xffb950,roughness:.49}),
 pouch:new THREE.MeshStandardMaterial({color:0xec9b48,roughness:.76}),
 amber:new THREE.MeshStandardMaterial({color:0xffd296,roughness:.53}),
 teal:new THREE.MeshStandardMaterial({color:0x83c5b5,roughness:.53,metalness:.08}),
 dark:new THREE.MeshStandardMaterial({color:0x23323a,metalness:.42,roughness:.39}),
 tire:new THREE.MeshStandardMaterial({color:0x1d3036,roughness:.93}),
 chrome:new THREE.MeshStandardMaterial({color:0xf0e2c5,metalness:.75,roughness:.24}),
 coral:new THREE.MeshStandardMaterial({color:0xf39b7c,metalness:.25,roughness:.45}),
 road:new THREE.MeshStandardMaterial({color:0x52616a,roughness:.95}),
 roadEdge:new THREE.MeshStandardMaterial({color:0xe4cdad,roughness:.84}),
 hill:new THREE.MeshStandardMaterial({color:0x6f917c,roughness:1}),
 beach:new THREE.MeshStandardMaterial({color:0xe2c4a0,roughness:1}),
 rock:new THREE.MeshStandardMaterial({color:0x8d9588,roughness:1,flatShading:true}),
 trunk:new THREE.MeshStandardMaterial({color:0x856d57,roughness:1}),
 leaf:new THREE.MeshStandardMaterial({color:0x668c76,roughness:1,side:THREE.DoubleSide}),
 lights:new THREE.MeshBasicMaterial({color:0xffe6b2}),
 barrier:new THREE.MeshStandardMaterial({color:0xf1e8d4,roughness:.8}),
 stripe:new THREE.MeshBasicMaterial({color:0xf9e1b9,transparent:true,opacity:.65}),
};
function mesh(geo,material,parent,x=0,y=0,z=0){ const m=new THREE.Mesh(geo,material);m.position.set(x,y,z); if(parent)parent.add(m);return m; }
function sphere(parent,material,x,y,z,sx,sy,sz,segments=18){const m=mesh(new THREE.SphereGeometry(1,segments,Math.max(9,Math.floor(segments*.65))),material,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
function rod(parent,from,to,r,material,r2=r){const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to), d=end.clone().sub(start);let ob=mesh(new THREE.CylinderGeometry(r2,r,d.length(),9),material,parent,...start.clone().add(end).multiplyScalar(.5).toArray());ob.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return ob;}
function tapered(parent,from,to,r1,r2,material){return rod(parent,from,to,r1,material,r2);}
function polyline(parent,points,r,material){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(c,20,r,9,false),material,parent);}
function plane(parent,mat,w,h,x,y,z){let p=mesh(new THREE.PlaneGeometry(w,h),mat,parent,x,y,z);p.rotation.x=-Math.PI/2;return p;}

function buildSky(){
  const vert=`varying vec3 d; void main(){ d=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; }`;
  const frag=`uniform float uNight;uniform float uTime;varying vec3 d;
  void main(){float h=clamp(d.y*1.55,0.,1.);float sunset=1.-uNight;vec3 horizon=mix(vec3(.97,.55,.40),vec3(.09,.19,.34),uNight);vec3 middle=mix(vec3(.43,.64,.68),vec3(.052,.112,.245),uNight);vec3 zenith=mix(vec3(.15,.35,.51),vec3(.012,.024,.095),uNight);
  vec3 col=mix(horizon,middle,smoothstep(.19,.56,h));col=mix(col,zenith,smoothstep(.53,.95,h));float glow=exp(-pow((h-.50)*15.,2.));col+=vec3(.21,.095,.01)*glow*sunset;
  gl_FragColor=vec4(col,1.);}`;
  skyMat=new THREE.ShaderMaterial({vertexShader:vert,fragmentShader:frag,side:THREE.BackSide,depthWrite:false,uniforms:{uNight:{value:0},uTime:{value:0}}});
  env.sky=mesh(new THREE.SphereGeometry(430,32,20),skyMat,scene);
  const starGeo=new THREE.BufferGeometry(),pos=[],colors=[];
  for(let i=0;i<660;i++){let th=rand(.08,Math.PI*.49),ph=rand(0,TAU),r=395;pos.push(Math.cos(ph)*Math.sin(th)*r,Math.cos(th)*r,Math.sin(ph)*Math.sin(th)*r);let v=rand(.63,1);colors.push(v,v*.95,v*rand(.85,1.07));}
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));starGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:1.05,vertexColors:true,transparent:true,opacity:0,sizeAttenuation:false,depthWrite:false,fog:false}));scene.add(stars);
  sun=sphere(scene,new THREE.MeshBasicMaterial({color:0xffe0a7,fog:false}),-235,25,-155,14,14,14,24);
  moon=sphere(scene,new THREE.MeshBasicMaterial({color:0xfff2d2,fog:false}),-160,106,-240,9,9,9,24);
  // Moon's subtle secondary halo.
  env.moonHalo=sphere(scene,new THREE.MeshBasicMaterial({color:0xb7d1db,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}),-160,106,-240,12,12,12,24);
  const cloudMat=new THREE.MeshBasicMaterial({color:0xffddd0,transparent:true,opacity:.17,depthWrite:false,fog:false});
  env.clouds=[];
  for(let i=0;i<16;i++){
    let group=new THREE.Group(),cx=rand(-250,210),cy=rand(38,118),cz=rand(-300,-110);scene.add(group);group.position.set(cx,cy,cz);
    for(let j=0;j<4;j++)sphere(group,cloudMat,j*rand(3,8),rand(-1,2),rand(-1,1),rand(13,23),rand(1.3,2.9),rand(2,5),12);
    env.clouds.push(group);
  }
}
function buildOcean(){
 const vert=`uniform float uTime;varying float wave;varying vec3 posWorld;varying float coast;
 float waves(vec2 p,float t){return sin(p.y*.19+t*1.7+p.x*.12)*.38+sin(p.y*.075-t*1.07+p.x*.23)*.25+sin(p.y*.35+t*2.1+p.x*.07)*.12;}
 void main(){vec3 p=position;wave=waves(p.xy,uTime);p.z+=wave;vec4 wp=modelMatrix*vec4(p,1.);posWorld=wp.xyz;coast=smoothstep(-24.,-11.,posWorld.x);gl_Position=projectionMatrix*viewMatrix*wp;}`;
 const frag=`uniform float uTime;uniform float uNight;varying float wave;varying vec3 posWorld;varying float coast;
 void main(){float ripple=sin(posWorld.z*.95+uTime*2.6+sin(posWorld.x*.3+uTime)*1.1)*.5+.5;float glint=pow(max(0.,sin(posWorld.z*.14+posWorld.x*.08+uTime*.3)),8.);
 vec3 dark=mix(vec3(.09,.39,.46),vec3(.045,.18,.31),uNight);vec3 light=mix(vec3(.35,.68,.66),vec3(.15,.38,.49),uNight);
 vec3 c=mix(dark,light,clamp(wave*.5+.48,0.,1.));c+=vec3(.32,.26,.14)*glint*(1.-uNight)*.5;
 float foam=coast*(smoothstep(.58,.88,ripple)*.46+smoothstep(.24,.57,abs(wave))*.21);c=mix(c,vec3(.82,.94,.88),clamp(foam,0.,.72));gl_FragColor=vec4(c,1.);}`;
 waterMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uNight:{value:0}},vertexShader:vert,fragmentShader:frag,side:THREE.DoubleSide});
 const w=mesh(new THREE.PlaneGeometry(450,490,85,90),waterMat,scene,-237,.04,-110);w.rotation.x=-Math.PI/2;env.water=w;
 // Fine shore foam line (separate organic strip at the beach's edge).
 env.foam=[];for(let i=0;i<30;i++){let m=plane(scene,new THREE.MeshBasicMaterial({color:0xe7f0df,transparent:true,opacity:rand(.20,.48),side:THREE.DoubleSide,depthWrite:false}),rand(3,6),rand(.11,.26),-12.5,.10,-190+i*8.5);m.rotation.z=rand(-.06,.06);env.foam.push(m);}
}
function buildWorld(){
  scene=new THREE.Scene();scene.background=new THREE.Color('#c79576');scene.fog=new THREE.FogExp2(0xa5c1b5,.0042);
  camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.06,650);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.34;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  canvas=renderer.domElement;dom.game.appendChild(canvas);
  lights.ambient=new THREE.HemisphereLight(0xffdcbc,0x496f79,2.1);scene.add(lights.ambient);
  lights.sun=new THREE.DirectionalLight(0xffd3a0,3.6);lights.sun.position.set(-60,70,-100);lights.sun.castShadow=true;
  lights.sun.shadow.mapSize.set(1024,1024);lights.sun.shadow.camera.left=-17;lights.sun.shadow.camera.right=17;
  lights.sun.shadow.camera.top=23;lights.sun.shadow.camera.bottom=-20;lights.sun.shadow.normalBias=.022;scene.add(lights.sun);scene.add(lights.sun.target);
  buildSky();buildOcean();
  // Asphalt, sand shoulders, vegetation, and the uninterrupted sea.
  const road=plane(scene,MAT.road,10.8,355,0,-.018,-80);road.receiveShadow=true;
  plane(scene,MAT.beach,6,355,-8.4,-.035,-80).receiveShadow=true;
  plane(scene,MAT.hill,20,355,14,-.055,-80).receiveShadow=true;
  plane(scene,new THREE.MeshStandardMaterial({color:0x849d7d,roughness:1}),6.4,355,9.5,-.04,-80);
  // Painted edges and lane markers are animated separately to communicate speed.
  env.dashes=[];
  for(let i=0;i<38;i++){
    for(const x of [-1.325,1.325]){let d=plane(scene,MAT.stripe,.095,2.45,x,.011,-195+i*6.3);env.dashes.push(d);}
  }
  for(const x of [-4.92,4.92]){let line=plane(scene,MAT.roadEdge,.085,355,x,.016,-80);line.material=new THREE.MeshBasicMaterial({color:0xffe6c1,transparent:true,opacity:.84});}
  const shoulderMat=new THREE.MeshStandardMaterial({color:0xbac6af,roughness:1});
  plane(scene,shoulderMat,.4,355,5.36,-.013,-80);
  // Hill silhouettes on the right and distant islands on the left.
  const hillGeo=new THREE.ConeGeometry(38,50,5);for(let i=0;i<17;i++){
    let h=mesh(hillGeo,new THREE.MeshStandardMaterial({color:i%2?0x819b87:0x688c86,roughness:1,flatShading:true}),scene,rand(29,85),rand(1,13),-300+i*21);
    h.scale.set(rand(.5,1.35),rand(.5,1.4),rand(.5,1.5));h.rotation.y=rand(0,TAU);
  }
  for(let i=0;i<5;i++){
    let h=mesh(new THREE.ConeGeometry(26,rand(13,27),7),new THREE.MeshStandardMaterial({color:0x708e88,roughness:1,flatShading:true}),scene,-90-i*75,-1,rand(-270,-100));h.scale.z=rand(1,1.9);}
  buildRoadside();buildLighthouse();buildBirds();createPelican();
  for(let i=0;i<11;i++)spawnFish(-29-i*18-Math.random()*6);
  clock=new THREE.Clock();
}
function buildRoadside(){
  function makePalm(parent){
    const trunk=new THREE.Group();parent.add(trunk);
    const tall=rand(4.5,7.8);
    polyline(trunk,[[0,0,0],[.25,tall*.33,0],[.55,tall*.66,-.1],[.75,tall,0]],.13,MAT.trunk);
    sphere(trunk,MAT.trunk,.75,tall,0,.2,.28,.2,10);
    for(let j=0;j<7;j++){
      let a=j*TAU/7,reach=rand(1.9,3.3),outer=[.75+Math.cos(a)*reach,tall-rand(.4,1.4),Math.sin(a)*reach];
      polyline(trunk,[[.75,tall,0],[.75+Math.cos(a)*reach*.55,tall+rand(.25,.5),Math.sin(a)*reach*.55],outer],.065,MAT.leaf);
      for(let k=1;k<=5;k++){let t=k/6,p=[.75+Math.cos(a)*reach*t,tall+Math.sin(Math.PI*t)*.35-Math.pow(t,2)*1.0,Math.sin(a)*reach*t];
        const leaf=mesh(new THREE.ConeGeometry(rand(.2,.35),rand(.5,.95),3),MAT.leaf,trunk,...p);leaf.rotation.x=1.15;leaf.rotation.y=-a+Math.PI*.5;leaf.scale.z=.17;
      }
    }
  }
  function makeLamp(parent){let h=rand(4.3,5.3);rod(parent,[0,0,0],[0,h,0],.075,MAT.dark);rod(parent,[0,h,0],[-.65,h+.13,-.13],.048,MAT.dark);
    sphere(parent,MAT.lights,-.68,h+.07,-.13,.17,.07,.24,10);
    let glowMat=new THREE.MeshBasicMaterial({color:0xffe4a4,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    let glow=sphere(parent,glowMat,-.68,h+.07,-.13,.4,.2,.45,9);env.lampGlows.push(glow);}
  env.lampGlows=[];
  for(let i=0;i<33;i++){
    let g=new THREE.Group();scene.add(g);let x= i%2===0?rand(7,11):rand(-7.5,-9.6),z=-185+i*7.4;g.position.set(x,0,z);
    if(i%5===0&&x>0)makePalm(g);
    else if(i%8===0&&x>0)makeLamp(g);
    else if(i%4===0){for(let j=0;j<3;j++){
      let m=mesh(new THREE.DodecahedronGeometry(rand(.14,.35),0),MAT.rock,g,rand(-.7,.7),.2,rand(-1,1));m.scale.set(1.4,rand(.5,1.2),1.3);}
    }else{
      for(let j=0;j<4;j++){
       let gr=new THREE.Group();g.add(gr);gr.position.set(rand(-.7,.7),.0,rand(-1.2,1.2));let ht=rand(.22,.59);
       for(let k=0;k<4;k++){let blade=mesh(new THREE.ConeGeometry(.08,ht,3),j%3===0?MAT.warmWhite:MAT.leaf,gr,rand(-.09,.09),ht/2,rand(-.09,.09));blade.rotation.x=rand(-.4,.4);blade.rotation.z=rand(-.4,.4);}
      }
    }
    roadside.push(g);
  }
  // Low seaside safety railing: separate independent repeating sections.
  env.barriers=[];
  for(let i=0;i<35;i++){
    const g=new THREE.Group();scene.add(g);g.position.set(-5.55,0,-193+i*6.6);
    rod(g,[0,.0,0],[0,.83,0],.07,MAT.barrier);
    rod(g,[0,.77,-3.3],[0,.77,3.3],.045,MAT.barrier);
    rod(g,[0,.39,-3.3],[0,.39,3.3],.032,MAT.barrier);
    env.barriers.push(g);
  }
}
function buildLighthouse(){
  const g=new THREE.Group();scene.add(g);g.position.set(-44,1,-135);env.lighthouse=g;
  mesh(new THREE.CylinderGeometry(4.5,6.2,3.0,11),MAT.rock,g,0,0,0);
  const tower=mesh(new THREE.CylinderGeometry(1.05,1.9,16,12),MAT.warmWhite,g,0,9.3,0);tower.castShadow=true;
  for(let i=0;i<3;i++)mesh(new THREE.CylinderGeometry(1.48+(i*.18),1.48+(i*.18),1.28,12),MAT.coral,g,0,3.6+i*4,0);
  mesh(new THREE.CylinderGeometry(1.7,1.7,2.1,12),new THREE.MeshStandardMaterial({color:0xb8d5d0,metalness:.4,roughness:.2,transparent:true,opacity:.85}),g,0,18.5,0);
  mesh(new THREE.ConeGeometry(2.2,2,12),MAT.coral,g,0,21,0);
  sphere(g,new THREE.MeshBasicMaterial({color:0xffeed0}),0,18.5,0,.65,.65,.65,12);
  const glow=new THREE.PointLight(0xffdfab,0,65);glow.position.set(0,19,0);g.add(glow);env.lighthouseLight=glow;
}
function buildBirds(){
 const wingMat=new THREE.MeshBasicMaterial({color:0xf6e3ce,side:THREE.DoubleSide});
 for(let i=0;i<11;i++){
  const g=new THREE.Group();scene.add(g);g.position.set(rand(-90,-15),rand(10,35),rand(-150,-30));
  const wingGeo=new THREE.BufferGeometry(); wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.62,0,0,0,.08,0,-.12,-.08,0,0,.08,0,.62,0,0,.12,-.08,0],3));
  wingGeo.computeVertexNormals();const wings=mesh(wingGeo,wingMat,g);birds.push({g,wings,phase:rand(0,TAU),speed:rand(.3,.7)});
 }
}
function createPelican(){
  const root=new THREE.Group();scene.add(root);root.position.set(0,0,4.6);
  const pivot=new THREE.Group();root.add(pivot);pivot.position.set(0,.65,.86);
  const art=new THREE.Group();pivot.add(art);art.position.set(0,-.65,-.86);
  character={root,pivot,art};
  // Geometrically assembled vintage bicycle: frame, hubs, chrome spokes and rotating pedals.
  const frame=new THREE.Group();art.add(frame);character.frame=frame;
  const frameMat=new THREE.MeshStandardMaterial({color:0xd96e55,metalness:.48,roughness:.36});
  const [rear,front,crank,seat,steer]=[
    [0,.66,1.04],[0,.66,-1.06],[0,1.15,.04],[0,1.76,.55],[0,1.75,-.76]
  ];
  [[rear,crank],[crank,steer],[steer,seat],[seat,crank],[seat,rear]].forEach(([a,b])=>rod(frame,a,b,.055,frameMat));
  // Fork, handlebar, saddle, chain casing.
  for(const x of [-.15,.15])rod(frame,[x,.67,-1.06],[x*.5,1.75,-.76],.045,MAT.chrome);
  rod(frame,[0,1.75,-.76],[0,1.91,-.80],.072,MAT.dark);
  rod(frame,[-.47,1.91,-.88],[.47,1.91,-.88],.05,MAT.chrome);
  for(const x of [-.48,.48])sphere(frame,MAT.dark,x,1.91,-.88,.13,.075,.075,10);
  const saddle=sphere(frame,MAT.dark,0,1.77,.56,.34,.09,.21,14);saddle.rotation.x=-.08;
  rod(frame,[0,1.72,.55],[0,1.3,.47],.045,MAT.chrome);
  const chain=mesh(new THREE.TorusGeometry(.24,.025,6,32),MAT.dark,frame,-.23,1.15,.04);chain.rotation.y=Math.PI/2;
  const wheels=[];
  for(const z of [1.04,-1.06]){
    const w=new THREE.Group();frame.add(w);w.position.set(0,.66,z);wheels.push(w);
    let tire=mesh(new THREE.TorusGeometry(.65,.075,9,48),MAT.tire,w);tire.rotation.y=Math.PI/2;tire.castShadow=true;
    let rim=mesh(new THREE.TorusGeometry(.59,.024,6,48),MAT.chrome,w);rim.rotation.y=Math.PI/2;
    for(let i=0;i<18;i++){
      let a=i*TAU/18,oy=Math.cos(a)*.585,oz=Math.sin(a)*.585;
      rod(w,[-.048,0,0],[-.028,oy,oz],.007,MAT.chrome);
      rod(w,[.048,0,0],[.028,oy,oz],.007,MAT.chrome);
    }
    mesh(new THREE.CylinderGeometry(.11,.11,.31,12),MAT.chrome,w).rotation.z=Math.PI/2;
  }
  character.wheels=wheels;
  // Front fender and rear fender.
  for(const [z,ofs] of [[-1.06,-.13],[1.04,.12]]){
    const arc=mesh(new THREE.TorusGeometry(.75,.042,7,33,Math.PI*.79),frameMat,frame,0,.66,z);arc.rotation.y=Math.PI/2;arc.rotation.x=0;arc.rotation.z=0;
  }
  // Pedal groups / crankarms. Rotation follows actual virtual wheel velocity.
  character.pedalR=sphere(frame,MAT.dark,.38,1.06,.0,.19,.055,.13,10);
  character.pedalL=sphere(frame,MAT.dark,-.38,1.06,.0,.19,.055,.13,10);
  character.crankR=rod(frame,[.23,1.15,.04],[.38,1.06,.0],.03,MAT.chrome);
  character.crankL=rod(frame,[-.23,1.15,.04],[-.38,1.06,.0],.03,MAT.chrome);
  // Pelican body with soft stylized silhouette and feathered tail.
  const body=sphere(art,MAT.white,0,2.29,.40,.49,.65,.65,28);body.castShadow=true;
  const breast=sphere(art,MAT.warmWhite,0,2.24,-.05,.38,.46,.29,22);breast.rotation.x=.12;
  for(let i=0;i<5;i++){
    const tail=mesh(new THREE.ConeGeometry(.14,.78,7),i%2?MAT.warmWhite:MAT.white,art,(i-2)*.12,2.10,1.04);
    tail.rotation.x=Math.PI/2+.38;tail.rotation.z=(i-2)*.12;tail.castShadow=true;
  }
  // Expressive C-shaped pelican neck, white head, bright bill and flexible lower pouch.
  const neck=polyline(art,[[0,2.41,-.09],[0,2.53,-.44],[0,2.79,-.52],[0,3.18,-.39]],.145,MAT.white);neck.castShadow=true;
  const head=sphere(art,MAT.white,0,3.26,-.48,.31,.34,.34,28);head.castShadow=true;
  // Long slightly tapered beak points forward down the coast (negative Z).
  const beak=mesh(new THREE.CylinderGeometry(.045,.16,1.1,12),MAT.beak,art,0,3.145,-1.03);
  beak.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,.055,1).normalize());beak.castShadow=true;
  sphere(art,MAT.amber,0,3.18,-1.60,.055,.055,.09,12);
  const pouch=sphere(art,MAT.pouch,0,2.99,-1.05,.20,.15,.49,19);pouch.rotation.x=-.10;
  sphere(art,MAT.orange,0,3.03,-.64,.2,.075,.16,16);
  // Eyes, raised brows and oversized retro sunglass lenses.
  for(const side of [-1,1]){
    sphere(art,MAT.white,side*.223,3.33,-.665,.12,.14,.065,14);
    let lens=sphere(art,new THREE.MeshStandardMaterial({color:0x182e3a,metalness:.34,roughness:.16}),side*.23,3.35,-.735,.137,.112,.05,18);lens.rotation.y=side*.18;
    sphere(art,new THREE.MeshBasicMaterial({color:0xa5e1d2,transparent:true,opacity:.6}),side*.25-.032,3.405,-.777,.038,.019,.006,8);
    rod(art,[side*.21,3.44,-.71],[side*.27,3.48,-.71],.026,MAT.dark);
  }
  rod(art,[-.09,3.39,-.766],[.09,3.39,-.766],.022,MAT.dark);
  for(const side of [-1,1])rod(art,[side*.31,3.39,-.72],[side*.35,3.39,-.49],.026,MAT.dark);
  // Golden-orange bike helmet: hemispherical shell, long peak, central stripe.
  const helmetMat=new THREE.MeshStandardMaterial({color:0xefb35c,metalness:.08,roughness:.43});
  const helmet=mesh(new THREE.SphereGeometry(.35,24,12,0,TAU,0,Math.PI*.53),helmetMat,art,0,3.49,-.48);helmet.scale.z=1.12;helmet.castShadow=true;
  const brim=sphere(art,helmetMat,0,3.51,-.74,.31,.055,.23,20);
  rod(art,[-.29,3.52,-.43],[-.26,3.16,-.49],.019,MAT.dark);
  rod(art,[.29,3.52,-.43],[.26,3.16,-.49],.019,MAT.dark);
  rod(art,[-.26,3.16,-.49],[.26,3.16,-.49],.018,MAT.dark);
  for(let i=0;i<3;i++){let vent=sphere(art,MAT.coral,0,3.79,-.51+i*.10,.04,.009,.056,8);vent.rotation.x=-.23;}
  // Wings fold alongside the body; T triggers an animated celebratory flap.
  character.wings=[];
  for(const side of [-1,1]){
    const wingRoot=new THREE.Group();wingRoot.position.set(side*.39,2.49,.25);art.add(wingRoot);
    wingRoot.rotation.z=side*.28;
    const w=sphere(wingRoot,MAT.white,side*.21,-.09,.1,.37,.25,.43,18);w.rotation.z=side*.25;w.castShadow=true;
    for(let i=0;i<7;i++){
      const feather=mesh(new THREE.ConeGeometry(.12,.52+(i%3)*.13,6),i%2?MAT.white:MAT.feathers,wingRoot,side*(.16+i*.065),-.30, -.12+i*.09);
      feather.rotation.z=side*-.23;feather.rotation.x=.13+i*.035;feather.castShadow=true;
    }
    character.wings.push(wingRoot);
  }
  // Articulated legs, knee joints, webbed feet and hand-on-handlebar wing tips.
  character.legs=[];
  const orangeLegMat=new THREE.MeshStandardMaterial({color:0xda8d48,roughness:.7});
  for(const side of [-1,1]){
    const upper=rod(art,[side*.30,2.0,.38],[side*.4,1.45,-.06],.075,orangeLegMat);
    const lower=rod(art,[side*.4,1.45,-.06],[side*.4,1.08,0],.053,orangeLegMat);
    const joint=sphere(art,orangeLegMat,side*.4,1.45,-.06,.084,.083,.08,12);
    const foot=sphere(art,MAT.orange,side*.4,1.08,-.07,.145,.065,.19,12);
    foot.rotation.x=.06;character.legs.push({side,upper,lower,joint,foot});
    const hand=polyline(art,[[side*.42,2.43,.1],[side*.57,2.13,-.30],[side*.42,1.91,-.88]],.046,MAT.white);hand.castShadow=true;
  }
  // Red scarf using a lightweight custom Verlet cloth solver (two rails + triangle mesh).
  const scarfMat=new THREE.MeshStandardMaterial({color:0xc8413b,metalness:0,roughness:.9,side:THREE.DoubleSide});
  const knot=sphere(art,scarfMat,0,2.96,-.26,.23,.125,.2,12);knot.rotation.z=.1;
  const scarfN=16,positions=new Float32Array(scarfN*2*3),idx=[];
  character.cloth=[];
  for(let i=0;i<scarfN;i++){
    let z=-.10+i*.155;
    character.cloth.push([0,1].map(side=>({x:(side?1:-1)*.145,y:2.96+i*.015,z,px:(side?1:-1)*.145,py:2.96+i*.015,pz:z})));
    if(i<scarfN-1){let a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const scarfGeo=new THREE.BufferGeometry();scarfGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));scarfGeo.setIndex(idx);scarfGeo.computeVertexNormals();
  character.scarf=mesh(scarfGeo,scarfMat,art);character.scarf.frustumCulled=false;
  // Fringes of the flowing scarf at the far end.
  character.fringes=[];
  for(let i=0;i<7;i++){const m=rod(art,[0,3,1.95],[0,2.94,2.15],.013,new THREE.MeshStandardMaterial({color:i%2?0xe06e50:0xa93c3a,roughness:1}));character.fringes.push(m);}
  // Tiny backpack patch for a whimsical handcrafted feel.
  const bag=sphere(art,new THREE.MeshStandardMaterial({color:0xb68b62,roughness:.95}),0,2.4,.89,.24,.31,.17,16);
  sphere(art,MAT.amber,0,2.50,1.043,.08,.044,.021,8);
  character.shadow=mesh(new THREE.CircleGeometry(1.3,30),new THREE.MeshBasicMaterial({color:0x0c212e,transparent:true,opacity:.17,depthWrite:false}),scene,0,.032,4.6);
  character.shadow.rotation.x=-Math.PI/2;character.shadow.scale.set(1.1,1.8,1);
  character.parts={body,head,helmet,pouch};
}
function alignRod(ob,a,b){
  const from=tempA.copy(a),to=tempB.copy(b),dir=to.sub(from),len=dir.length();
  ob.position.copy(from).addScaledVector(dir,.5);ob.scale.y=len / ob.geometry.parameters.height;
  ob.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
}
function updateIK(ped){
  for(let i=0;i<character.legs.length;i++){
    const leg=character.legs[i],side=leg.side,angle=ped+(side>0?0:Math.PI),footY=1.15+Math.sin(angle)*.22,footZ=.04+Math.cos(angle)*.22;
    const hipY=2.10,hipZ=.37,dy=footY-hipY,dz=footZ-hipZ,d=Math.hypot(dy,dz),L1=.70,L2=.75;
    const along=(L1*L1-L2*L2+d*d)/(2*d),height=Math.sqrt(Math.max(.002,L1*L1-along*along));
    const ky=hipY+dy/d*along-dz/d*height,kz=hipZ+dz/d*along+dy/d*height;
    const x=side*.33,kx=side*.43;
    alignRod(leg.upper,new THREE.Vector3(x,hipY,hipZ),new THREE.Vector3(kx,ky,kz));
    alignRod(leg.lower,new THREE.Vector3(kx,ky,kz),new THREE.Vector3(x,footY,footZ));
    leg.joint.position.set(kx,ky,kz);leg.foot.position.set(x,footY,footZ-.1);
    const pedal=i===0?character.pedalL:character.pedalR;
    pedal.position.set(side*.38,footY-.055,footZ);
    const crank=i===0?character.crankL:character.crankR;
    alignRod(crank,new THREE.Vector3(side*.23,1.15,.04),new THREE.Vector3(side*.38,footY,footZ));
  }
}
function updateCloth(dt,t){
  const cloth=character.cloth,n=cloth.length,acc=Math.min(.035,dt),strength=.12+game.speed*.007;
  for(let i=0;i<n;i++)for(let s=0;s<2;s++){
    let p=cloth[i][s];
    if(i===0){p.x=(s?1:-1)*.145;p.y=2.95;p.z=-.09;p.px=p.x;p.py=p.y;p.pz=p.z;continue;}
    const vx=(p.x-p.px)*.95,vy=(p.y-p.py)*.94,vz=(p.z-p.pz)*.96;
    p.px=p.x;p.py=p.y;p.pz=p.z;
    p.x+=vx+Math.sin(t*3.8+i*.46)*strength*.025*acc*60;
    p.y+=vy-.0053*acc*60 +(.024+game.speed*.00055)*acc*60+Math.sin(t*4.3-i*.35)*.002;
    p.z+=vz+(.010+game.speed*.0011)*acc*60;
  }
  // Iterative constraints: vertical edges and cloth width resist stretching.
  for(let iter=0;iter<5;iter++){
    for(let i=1;i<n;i++)for(let s=0;s<2;s++){
      const p=cloth[i][s],prev=cloth[i-1][s],dx=p.x-prev.x,dy=p.y-prev.y,dz=p.z-prev.z,d=Math.max(.001,Math.hypot(dx,dy,dz));
      const desired=.158,k=(d-desired)/d*(i===1?.85:.53);p.x-=dx*k;p.y-=dy*k;p.z-=dz*k;
      if(i>1){prev.x+=dx*k*.7;prev.y+=dy*k*.7;prev.z+=dz*k*.7;}
    }
    for(let i=1;i<n;i++){
      const left=cloth[i][0],right=cloth[i][1],dx=right.x-left.x,dy=right.y-left.y,dz=right.z-left.z,d=Math.max(.001,Math.hypot(dx,dy,dz)),k=(d-.28)/d*.42;
      left.x+=dx*k;right.x-=dx*k;left.y+=dy*k;right.y-=dy*k;left.z+=dz*k;right.z-=dz*k;
    }
  }
  const attr=character.scarf.geometry.attributes.position;
  for(let i=0;i<n;i++)for(let s=0;s<2;s++){let p=cloth[i][s];attr.setXYZ(i*2+s,p.x,p.y,p.z);}
  attr.needsUpdate=true;character.scarf.geometry.computeVertexNormals();
  const end=cloth[n-1];for(let i=0;i<character.fringes.length;i++){
    let w=i/6,p={x:lerp(end[0].x,end[1].x,w),y:lerp(end[0].y,end[1].y,w),z:lerp(end[0].z,end[1].z,w)};
    alignRod(character.fringes[i],new THREE.Vector3(p.x,p.y,p.z),new THREE.Vector3(p.x+Math.sin(t*5+i)*.025,p.y-.10,p.z+.13));
  }
}
function createFishMaterial(color){return new THREE.MeshStandardMaterial({color,metalness:.33,roughness:.35,emissive:color,emissiveIntensity:.08});}
const fishMats=[createFishMaterial(0xf6b66f),createFishMaterial(0x8dd8cf),createFishMaterial(0xfb8290),createFishMaterial(0xe3c48d),createFishMaterial(0x8cbad9)];
function buildFish(lane,z){
  const group=new THREE.Group();scene.add(group);
  const mat=fishMats[Math.floor(rand(0,fishMats.length))];
  const body=sphere(group,mat,0,0,0,.23,.20,.44,15);body.castShadow=true;
  // Pointed fish head in the direction of travel and two translucent fins.
  const nose=mesh(new THREE.ConeGeometry(.17,.32,10),mat,group,0,0,-.48);nose.rotation.x=-Math.PI/2;
  const tail=mesh(new THREE.ConeGeometry(.20,.36,3),mat,group,0,0,.51);tail.rotation.x=Math.PI/2;tail.rotation.z=Math.PI*.25;
  for(const s of [-1,1]){const fin=mesh(new THREE.ConeGeometry(.12,.43,3),mat,group,s*.15,.07,.12);fin.rotation.z=s*1.05;}
  for(const s of [-1,1])sphere(group,MAT.dark,s*.14,.06,-.20,.039,.042,.025,9);
  const ring=mesh(new THREE.TorusGeometry(.40,.022,5,28),new THREE.MeshBasicMaterial({color:0xffebac,transparent:true,opacity:.47}),group);ring.rotation.x=Math.PI/2;
  const shadow=mesh(new THREE.CircleGeometry(.38,16),new THREE.MeshBasicMaterial({color:0x22353a,transparent:true,opacity:.14,depthWrite:false}),scene,LANES[lane],.028,z);shadow.rotation.x=-Math.PI/2;
  return {group,shadow,ring,lane,baseY:rand(1.35,1.84),phase:rand(0,TAU),age:0,got:false};
}
function spawnFish(z=-110){const lane=Math.floor(rand(0,3)),f=buildFish(lane,z);f.group.position.set(LANES[lane],f.baseY,z);fishes.push(f);}
function resetFish(f,z){f.lane=Math.floor(rand(0,3));f.group.position.set(LANES[f.lane],f.baseY=rand(1.38,2),z);f.shadow.position.set(LANES[f.lane],.028,z);f.phase=rand(0,TAU);f.age=0;f.got=false;f.group.visible=f.shadow.visible=true;}
function spawnBurst(x,y,z,n,color=0xffe3a4){
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false});
  for(let i=0;i<n;i++){
    let ob=mesh(new THREE.OctahedronGeometry(rand(.035,.10),0),mat.clone(),scene,x,y,z);
    fishParticles.push({ob,v:new THREE.Vector3(rand(-2.3,2.3),rand(.7,3.5),rand(-2.2,2.2)),life:rand(.65,1.15),maxLife:1.15});
  }
}
function handleCatch(f){
  const since=game.time-game.lastCatch;
  state.combo=since<4.9?state.combo+1:1;state.bestCombo=Math.max(state.bestCombo,state.combo);game.lastCatch=game.time;
  const points=100*Math.min(state.combo,9);state.score+=points;state.fish++;
  state.jumpCatch ||=game.y>.36;
  state.wingCatch ||=game.wingTime>.20;
  state.nightCatch ||=getNight()> .72;
  state.autoCatch ||=game.auto;
  f.got=true;f.group.visible=f.shadow.visible=false;spawnBurst(f.group.position.x,f.group.position.y,f.group.position.z,16,f.group.children[0].material.color.getHex());
  Sound.catch(state.combo);
  if(state.combo>=3){dom.comboBig.textContent=state.combo;dom.comboBanner.classList.add('shown');game.comboShowUntil=timeNow+1.45;}
  if(state.combo===1||state.combo%5===0)toast(`${state.combo>1?'精彩连击！':'捕到一条飞鱼！'}`,`+${points} 分 · ${state.fish} 条飞鱼`,'🐟',1700);
  checkAchievements();
}
function toast(title,sub,icon='✦',duration=3200){
  const item=document.createElement('div');item.className='toastItem';
  const med=document.createElement('span');med.className='toastIcon';med.textContent=icon;
  const txt=document.createElement('div');txt.className='toastText';const b=document.createElement('b');b.textContent=title;const small=document.createElement('small');small.textContent=sub;txt.append(b,small);item.append(med,txt);dom.toast.prepend(item);
  while(dom.toast.children.length>3)dom.toast.lastElementChild.remove();
  toastTimeouts.push(setTimeout(()=>item.remove(),duration));
}
function checkAchievements(){
  let newly=[];for(let i=0;i<A.length;i++)if(!badges.has(i)&&A[i][3](state)){badges.add(i);newly.push(i);}
  for(let i of newly){toast(`成就解锁 · ${A[i][1]}`,A[i][2],A[i][0],5000);Sound.achievement();}
  if(newly.length){try{localStorage.setItem('pelican-coast-save-v1',JSON.stringify({badges:[...badges]}));}catch{}}
  dom.achievements.textContent=badges.size+' / 14';
}
function drawAchievements(){
  dom.progress.textContent=`${badges.size} / 14`;
  dom.list.replaceChildren();
  for(let i=0;i<A.length;i++){
    let a=A[i],yes=badges.has(i),row=document.createElement('div');row.className='achievement'+(yes?' unlocked':'');
    let medal=document.createElement('div');medal.className='medal';medal.textContent=a[0];
    let text=document.createElement('div');text.className='achText';let b=document.createElement('b');b.textContent=a[1];let sm=document.createElement('small');sm.textContent=a[2];text.append(b,sm);
    let st=document.createElement('div');st.className='achStatus';st.textContent=yes?'已获得':'未解锁';row.append(medal,text,st);dom.list.append(row);
  }
}

// Generative audio: all notes, tire hum, bells, waves, and catches use the browser's Web Audio API.
const Sound={
  ctx:null,master:null,wind:null,wave:null,muted:false,lastBeat:-1,lastChime:-1,
  init(){
    if(this.ctx){this.ctx.resume();return;}
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.43;this.master.connect(this.ctx.destination);
      const duration=2.5,samples=Math.floor(this.ctx.sampleRate*duration),noise=this.ctx.createBuffer(1,samples,this.ctx.sampleRate),data=noise.getChannelData(0);
      for(let i=0;i<samples;i++)data[i]=(Math.random()*2-1);
      const src=this.ctx.createBufferSource();src.buffer=noise;src.loop=true;
      const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=370;
      const gain=this.ctx.createGain();gain.gain.value=.035;src.connect(filter);filter.connect(gain);gain.connect(this.master);src.start();this.wind={filter,gain};
      const src2=this.ctx.createBufferSource();src2.buffer=noise;src2.loop=true;
      const f2=this.ctx.createBiquadFilter();f2.type='lowpass';f2.frequency.value=90;
      const g2=this.ctx.createGain();g2.gain.value=.24;src2.connect(f2);f2.connect(g2);g2.connect(this.master);src2.start();this.wave={gain:g2,filter:f2};
      this.ctx.resume();
    }catch(e){console.warn('Audio unavailable',e);}
  },
  note(freq=440,duration=.24,type='sine',amp=.09,when=0,up=0){
    if(!this.ctx||this.muted)return;
    const now=this.ctx.currentTime+when;
    const osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.type=type;
    osc.frequency.setValueAtTime(freq,now);if(up)osc.frequency.exponentialRampToValueAtTime(Math.max(22,freq+up),now+duration);
    g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(amp,now+.015);
    g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(g);g.connect(this.master);osc.start(now);osc.stop(now+duration+.02);
  },
  catch(combo){this.note(523.25,.13,'triangle',.12);this.note(659.25,.15,'sine',.08,.085);this.note(784,.31,'sine',.1,.19);if(combo>2)this.note(1046,.4,'triangle',.08,.32);},
  achievement(){this.note(659,.18,'triangle',.12);this.note(880,.2,'sine',.12,.14);this.note(1175,.5,'sine',.09,.30);},
  jump(){this.note(180,.24,'sine',.07,0,330);},
  flap(){this.note(125,.35,'triangle',.1,0,150);},
  toggle(){this.muted=!this.muted;if(this.master)this.master.gain.value=this.muted?0:.43;dom.sound.textContent=this.muted?'♩':'♫';toast(this.muted?'声音已关闭':'声音已开启',this.muted?'享受静谧海岸':'程序化配乐正跟随踏频','♫',1400);},
  update(t,speed,night,paused){
    if(!this.ctx)return;
    if(this.wind){this.wind.filter.frequency.setTargetAtTime(175+speed*31,this.ctx.currentTime,.15);this.wind.gain.gain.setTargetAtTime(paused?.012:.018+speed*.0015,this.ctx.currentTime,.3);}
    if(this.wave)this.wave.gain.gain.setTargetAtTime(.09+night*.07,this.ctx.currentTime,.2);
    if(!game.started||paused)return;
    const bpm=clamp(68+speed*1.78,68,151),beat=Math.floor(t*bpm/60),progress=beat%16;
    if(beat!==this.lastBeat){
      this.lastBeat=beat;
      const chord=[196,220,174.61,164.81][Math.floor(beat/16)%4];
      if(progress%2===0)this.note(chord/2,.20,'triangle',.045);
      if(progress%4===0)this.note(chord*.5,.60,'sine',.085);
      if(progress===2||progress===6||progress===10||progress===14)this.note(chord*(progress===14?1.5:2),.38,'sine',.056);
      if(progress===7||progress===15)this.note(chord*3,.14,'triangle',.024);
      if(progress%4===2)this.note(300,.045,'square',.008);
    }
    const chime=Math.floor(t/16);
    if(night>.58 && chime!==this.lastChime){this.lastChime=chime;this.note(523,.9,'sine',.025);this.note(784,1.1,'sine',.02,.21);}
  }
};

function smoothstep(a,b,v){const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
function getCycle(){return (game.cycle%228)/228;}
function getNight(){const p=getCycle();return smoothstep(.07,.53,p)*(1-smoothstep(.80,1,p));}
function getPhaseInfo(){const p=getCycle();if(p<.25)return ['☀','余晖黄昏'];if(p<.49)return ['✦','蓝调时刻'];if(p<.83)return ['☾','星空月夜'];return ['◒','黎明将至'];}
function markManual(){game.manualAt=game.time;game.auto=false;}
function changeLane(delta,manual=true){
  if(manual)markManual();const next=clamp(game.lane+delta,0,2);
  if(next!==game.lane){game.lane=next;game.drift=-delta*.27;}
}
function jump(){if(!game.started||game.paused)return;markManual();if(game.y<.055){game.yVelocity=6.1;game.jumpTime=0;Sound.jump();spawnBurst(game.playerX,1.2,character.root.position.z,5,0xffe4bd);}}
function flap(){if(!game.started||game.paused)return;markManual();if(game.wingCooldown<=0){game.wingTime=1.55;game.wingCooldown=2.1;Sound.flap();}}
function setCamera(id){game.camera=(id+5)%5;state.cameraSet.add(game.camera);dom.cameraName.textContent=cameras[game.camera];toast('镜头 · '+cameras[game.camera],`${game.camera+1} / 5 · 按 C 继续切换`,'🎬',1300);checkAchievements();}
function togglePause(){if(!game.started)return;game.paused=!game.paused;dom.pause.classList.toggle('hidden',!game.paused);$('pauseButton').textContent=game.paused?'▶':'Ⅱ';if(!game.paused){clock.getDelta();Sound.ctx?.resume();}}
function refreshHud(){
  dom.score.textContent=String(state.score).padStart(3,'0');dom.fish.textContent=state.fish;
  dom.combo.textContent='× '+Math.max(1,state.combo);dom.distance.textContent=state.distance.toFixed(2)+' km';
  dom.achievements.textContent=badges.size+' / 14';dom.speed.textContent=String(Math.round(game.speed));
  dom.speedFill.style.width=`${game.speed/44*100}%`;
  dom.pedalText.textContent=game.speed<5?'慢慢享受':game.speed>34?'快如闪电':game.speed>22?'追逐海风':'随风而行';
  dom.auto.textContent=game.auto?'✦ 自动巡航':'● 手动驾驶';dom.auto.style.color=game.auto?'#ddf5e2':'#ffdeb0';
  const [emoji,label]=getPhaseInfo();dom.timeEmoji.textContent=emoji;dom.timeText.textContent=label;dom.timeFill.style.width=(getCycle()*100).toFixed(1)+'%';
  dom.fps.textContent=Math.round(fpsSample)+' FPS';
}
function updateLighting(dt){
  const night=getNight();skyMat.uniforms.uNight.value=night;skyMat.uniforms.uTime.value=game.time;
  waterMat.uniforms.uNight.value=night;waterMat.uniforms.uTime.value=game.time;
  stars.material.opacity=night*.94;
  const skyFog=new THREE.Color('#9fbaae').lerp(new THREE.Color('#152f49'),night);
  scene.fog.color.copy(skyFog);scene.fog.density=.0036+night*.0008;
  renderer.toneMappingExposure=1.28-night*.18;
  lights.ambient.intensity=2.0-night*.95;
  lights.sun.intensity=3.4-night*2.9;lights.sun.color.set('#ffcf9c').lerp(new THREE.Color('#c4d6ed'),night);
  lights.sun.position.set(-60+getCycle()*20,65-getCycle()*39,-85);
  lights.sun.target.position.set(game.playerX,1,character.root.position.z-15);
  sun.position.y=25-getCycle()*64;sun.material.color.set('#ffe7bb').lerp(new THREE.Color('#e98e74'),smoothstep(0,.4,getCycle()));
  sun.visible=night<.62;
  moon.visible=night>.21;env.moonHalo.material.opacity=night*.13;env.moonHalo.visible=moon.visible;
  MAT.lights.color.set('#ffe9b7').multiplyScalar(1+night*.4);
  for(const g of env.lampGlows)g.material.opacity=night*.37;
  env.lighthouseLight.intensity=night*3.8;
  env.lighthouse.rotation.y+=dt*.12;
  for(let i=0;i<env.foam.length;i++){
    const f=env.foam[i];f.position.x=-12.4+Math.sin(game.time*1.9+i*.6)*.6;f.material.opacity=(.16+Math.sin(game.time*2.3+i*.8)*.10+night*.13);
  }
  for(const g of env.clouds){g.position.x+=dt*.55;if(g.position.x>260)g.position.x=-270;g.children.forEach(m=>m.material.opacity=.17-night*.095);}
  env.sky.position.set(camera.position.x,0,camera.position.z);stars.position.set(camera.position.x,0,camera.position.z);
}
function updateMovement(dt){
  game.cycle+=dt;game.time+=dt;
  game.auto=game.time-game.manualAt>8.5 || game.manualAt<0;
  const keys=game.activeKeys;
  if(keys.has('w')||keys.has('arrowup')){markManual();game.targetSpeed=clamp(game.targetSpeed+dt*12,0,43);}
  if(keys.has('s')||keys.has('arrowdown')){markManual();game.targetSpeed=clamp(game.targetSpeed-dt*19,0,43);}
  if(game.auto){
    game.targetSpeed=lerp(game.targetSpeed,24,dt*.25);
    const target=fishes.filter(f=>!f.got&&f.group.position.z<character.root.position.z-3&&f.group.position.z>character.root.position.z-48)
      .sort((a,b)=>b.group.position.z-a.group.position.z)[0];
    if(target&&game.lane!==target.lane)game.lane=target.lane;
  }else{
    // Momentum: gentle friction on the road whenever no throttle is pressed.
    if(!keys.has('w')&&!keys.has('arrowup')&&!keys.has('s')&&!keys.has('arrowdown'))game.targetSpeed=lerp(game.targetSpeed,16,dt*.055);
  }
  game.speed=lerp(game.speed,game.targetSpeed,1-Math.exp(-dt*1.6));
  if(state.combo&&game.time-game.lastCatch>5.0){state.combo=0;}
  state.maxSpeed=Math.max(state.maxSpeed,game.speed);
  state.rideTime+=dt;state.distance+=game.speed*dt/3600;
  const destination=LANES[game.lane];const steer=destination-game.playerX;
  game.playerX+=steer*Math.min(1,dt*4.5);game.drift=lerp(game.drift,0,dt*3);
  if(game.y>0||game.yVelocity>0){game.yVelocity-=dt*14;game.y=Math.max(0,game.y+game.yVelocity*dt);if(game.y===0)game.yVelocity=0;game.jumpTime+=dt;}
  game.wingCooldown=Math.max(0,game.wingCooldown-dt);game.wingTime=Math.max(0,game.wingTime-dt);
  game.pedal+=game.speed/3.6*dt/.65;
  const wheelie=game.wingTime>0?Math.sin(Math.min(1,(1.55-game.wingTime)*3.5)*Math.PI*.5)*smoothstep(0,.35,game.wingTime)*.28:0;
  character.root.position.set(game.playerX,game.y+Math.sin(game.pedal*2)*.022,4.6);
  character.pivot.rotation.x=lerp(character.pivot.rotation.x,wheelie,dt*5);
  character.pivot.rotation.z=lerp(character.pivot.rotation.z,-steer*.050+game.drift*.18,dt*5);
  const roll=game.speed/3.6*dt/.65;
  for(const w of character.wheels)w.rotation.x-=roll;
  updateIK(game.pedal);
  for(let i=0;i<2;i++){
    const side=i===0?-1:1,base=side*.28;
    character.wings[i].rotation.z=base+side*(game.wingTime>0?Math.sin((1.55-game.wingTime)*16)*.7+.9:Math.sin(game.pedal*.6+i)*.055);
    character.wings[i].rotation.x=Math.sin(game.pedal*.5+i)*.06;
  }
  updateCloth(dt,game.time);
  character.shadow.position.set(game.playerX,.028,character.root.position.z);
  character.shadow.material.opacity=.18-game.y*.065;
  character.shadow.scale.setScalar(1+game.y*.20);
}
function updateWorld(dt,travel){
  for(const d of env.dashes){d.position.z+=travel;if(d.position.z>35)d.position.z-=239.4;}
  for(const r of roadside){r.position.z+=travel;if(r.position.z>39)r.position.z-=244.2;}
  for(const r of env.barriers){r.position.z+=travel;if(r.position.z>39)r.position.z-=231;}
  for(const f of env.foam){f.position.z+=travel;if(f.position.z>39)f.position.z-=240;}
  for(const b of birds){b.phase+=dt*(2+b.speed);b.g.position.z+=travel*.20+b.speed*dt*.9;
    b.g.position.y+=Math.cos(b.phase)*dt*.23;b.wings.rotation.z=Math.sin(b.phase*2)*.26;
    if(b.g.position.z>42){b.g.position.z=rand(-155,-105);b.g.position.x=rand(-110,-15);}}
  // The lighthouse and islands stay offshore, drifting only with parallax.
  env.lighthouse.position.z+=travel*.13;if(env.lighthouse.position.z>10)env.lighthouse.position.z=-135;
  for(const f of fishes){
    f.age+=dt;f.group.position.z+=travel;f.shadow.position.z=f.group.position.z;
    f.group.position.y=f.baseY+Math.abs(Math.sin(game.time*2.5+f.phase))*.52;
    f.group.rotation.y=Math.sin(game.time*3.1+f.phase)*.20;
    f.group.rotation.z=Math.sin(game.time*5.8+f.phase)*.07;
    f.ring.rotation.y+=dt*2.5;
    f.shadow.material.opacity=.14-clamp((f.group.position.y-1.4)*.065,0,.11);
    if(game.started&&!f.got&&Math.abs(f.group.position.z-character.root.position.z)<1.28&&Math.abs(f.group.position.x-game.playerX)<.95){handleCatch(f);}
    if(f.group.position.z>character.root.position.z+11){resetFish(f,rand(-178,-109));}
  }
  for(let i=fishParticles.length-1;i>=0;i--){const p=fishParticles[i];p.life-=dt;
    if(p.life<=0){scene.remove(p.ob);p.ob.geometry.dispose();p.ob.material.dispose();fishParticles.splice(i,1);continue;}
    p.v.y-=dt*5;p.ob.position.addScaledVector(p.v,dt);p.ob.rotation.y+=dt*5;
    p.ob.material.opacity=p.life/p.maxLife;p.ob.scale.setScalar(p.life/p.maxLife);
  }
}
function updateCamera(dt){
  const cx=game.playerX,pz=character.root.position.z;
  let position,aim,fov=58;
  if(!game.started){
    const orbit=game.time*.105;
    position=new THREE.Vector3(cx+8+Math.sin(orbit)*1.7,4.5,pz+12.5-Math.cos(orbit)*2);
    aim=new THREE.Vector3(cx,2.1,pz-7.8);fov=51;
  }else switch(game.camera){
    case 0:position=new THREE.Vector3(cx+3.5+game.drift*.8,4.35+game.y*.2,pz+11.5+game.speed*.058);aim=new THREE.Vector3(cx,.96+game.y,pz-12);fov=62;break;
    case 1:{let angle=game.time*.25;position=new THREE.Vector3(cx+Math.sin(angle)*8.5,4.8+Math.sin(angle*.6)*1.8,pz+Math.cos(angle)*9.4);aim=new THREE.Vector3(cx,2.1+game.y,pz-.8);fov=48;break;}
    case 2:position=new THREE.Vector3(cx,3.31+game.y,pz-.63);aim=new THREE.Vector3(cx,2.8+game.y,pz-28);fov=77;break;
    case 3:position=new THREE.Vector3(cx+13,3.85+game.y*.4,pz+2.6);aim=new THREE.Vector3(cx,1.96+game.y,pz-1.3);fov=51;break;
    case 4:position=new THREE.Vector3(cx+17,9.2,pz+24);aim=new THREE.Vector3(cx-2,2,pz-17);fov=58;break;
  }
  // During jump, cinematic shots lift gently to emphasize the silhouette.
  const smoothing=game.camera===2?.20:.044;
  camera.position.lerp(position,Math.min(1,dt/smoothing*.17));
  if(!character.lookTarget)character.lookTarget=aim.clone();
  character.lookTarget.lerp(aim,Math.min(1,dt*2.5));
  camera.lookAt(character.lookTarget);camera.fov=lerp(camera.fov,fov,dt*1.6);camera.updateProjectionMatrix();
}
function adaptive(dt){
  fpsAccum+=dt;fpsFrames++;
  if(fpsAccum>2){fpsSample=fpsFrames/fpsAccum;fpsFrames=0;fpsAccum=0;
    if(game.quality==='AUTO'){
      if(fpsSample<39&&qualityDrop<3){qualityDrop++;applyQuality();}
      if(fpsSample>57&&qualityDrop>0){qualityDrop--;applyQuality();}
    }
  }
}
function applyQuality(){
  let ratio=1.35;
  if(game.quality==='HIGH')ratio=Math.min(devicePixelRatio,2);
  else if(game.quality==='LOW')ratio=.82;
  else ratio=Math.min(devicePixelRatio,1.45)*[1,.86,.71,.59][qualityDrop];
  renderer.setPixelRatio(ratio);
  const shadow=game.quality==='HIGH'||(game.quality==='AUTO'&&qualityDrop<2);
  renderer.shadowMap.enabled=shadow;
  // Never destroy geometry on an automatic switch; the page remains stable.
  renderer.setSize(innerWidth,innerHeight);
}
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);timeNow+=dt;
  if(!game.paused){
    if(game.started)updateMovement(dt);
    else {game.time+=dt*.25;game.cycle+=dt*.12;game.pedal+=dt*1.5;for(const w of character.wheels)w.rotation.x-=dt*1.5;updateIK(game.pedal);updateCloth(dt,game.time);}
    updateWorld(dt,(game.started?game.speed/3.6:2.0)*dt);
    updateCamera(dt);updateLighting(dt);
    Sound.update(game.time,game.speed,getNight(),game.paused);
    if(game.comboShowUntil<timeNow)dom.comboBanner.classList.remove('shown');
    if(timeNow-lastUi>.13){refreshHud();lastUi=timeNow;}
    if(game.started&&Math.floor(game.time)%3===0&&!game.notice){checkAchievements();game.notice=true;}
    if(Math.floor(game.time)%3!==0)game.notice=false;
  }else Sound.update(game.time,game.speed,getNight(),true);
  renderer.render(scene,camera);adaptive(dt);
}
function start(){
  if(game.started)return;
  game.started=true;game.time=0;game.cycle=0;game.manualAt=-100;game.lastCatch=-100;
  dom.start.classList.add('dismissed');setTimeout(()=>dom.start.classList.add('hidden'),730);
  dom.hud.classList.remove('hidden');
  Sound.init();toast('旅途已开启','W / S 加减速 · A / D 变道 · 不操作就自动追鱼','✦',4000);
  if(matchMedia('(pointer:coarse)').matches)toast('触屏操作已开启','左右变道 · 刹车加速 · 跳跃展翅','☀',3200);
}
function restart(){
  game.paused=false;game.time=0;game.cycle=0;game.speed=16;game.targetSpeed=16;game.lane=1;game.playerX=0;game.y=0;game.yVelocity=0;game.wingTime=0;game.manualAt=-100;game.camera=0;game.pedal=0;game.lastCatch=-100;
  game.activeKeys.clear();state=stats();fishes.forEach((f,i)=>resetFish(f,-30-i*18));
  dom.cameraName.textContent=cameras[0];dom.pause.classList.add('hidden');dom.comboBanner.classList.remove('shown');
  checkAchievements();toast('全新的一段旅程','记忆中的成就会继续保留','✦');
}
function bindInput(){
  $('startButton').addEventListener('click',start);
  $('resumeButton').addEventListener('click',togglePause);
  $('restartButton').addEventListener('click',restart);
  $('pauseButton').addEventListener('click',togglePause);
  $('cameraButton').addEventListener('click',()=>setCamera(game.camera+1));
  $('soundButton').addEventListener('click',()=>{if(!Sound.ctx)Sound.init();Sound.toggle();});
  $('achievementsButton').addEventListener('click',()=>{drawAchievements();dom.drawer.classList.remove('hidden');});
  $('closeAchievements').addEventListener('click',()=>dom.drawer.classList.add('hidden'));
  dom.quality.addEventListener('click',()=>{
    game.quality={AUTO:'HIGH',HIGH:'LOW',LOW:'AUTO'}[game.quality];dom.quality.textContent='画质 '+game.quality;qualityDrop=0;applyQuality();
    toast('渲染画质：'+game.quality,game.quality==='AUTO'?'根据帧率自动调节':'可随时切换回自动','◈',1700);
  });
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
    if(key==='enter'&&!game.started){start();return;}
    if(key==='escape'){if(!dom.drawer.classList.contains('hidden'))dom.drawer.classList.add('hidden');else togglePause();return;}
    if(!game.started||game.paused||!dom.drawer.classList.contains('hidden'))return;
    if(['w','s','arrowup','arrowdown'].includes(key)){game.activeKeys.add(key);markManual();}
    if(e.repeat)return;
    if(key==='a'||key==='arrowleft')changeLane(-1);
    if(key==='d'||key==='arrowright')changeLane(1);
    if(key===' ')jump();if(key==='t')flap();
    if(key==='c')setCamera(game.camera+1);if(key==='m'){if(!Sound.ctx)Sound.init();Sound.toggle();}
    if(key==='p')togglePause();
  });
  document.addEventListener('keyup',e=>game.activeKeys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>game.activeKeys.clear());
  for(const [id,action] of [['touchLeft',()=>changeLane(-1)],['touchRight',()=>changeLane(1)],['touchJump',jump],['touchWing',flap]]){
    const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();if(!game.paused)action();});
  }
  for(const [id,key] of [['touchGas','w'],['touchBrake','s']]){
    const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);game.activeKeys.add(key);markManual();});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>game.activeKeys.delete(key));
  }
  let touchX=0,touchY=0;
  canvas.addEventListener('touchstart',e=>{if(e.touches.length===1){touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;}},{passive:true});
  canvas.addEventListener('touchend',e=>{if(!game.started||game.paused||!e.changedTouches.length)return;
    const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;
    if(Math.abs(dx)>52&&Math.abs(dx)>Math.abs(dy)*1.25)changeLane(dx<0?-1:1);
    else if(dy< -55)jump();},{passive:true});
  window.addEventListener('resize',()=>{
    if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.started&&!game.paused)togglePause();});
}
try{
  buildWorld();bindInput();drawAchievements();refreshHud();
  game.time=0;clock.start();loop();
  dom.loading.style.opacity='0';setTimeout(()=>dom.loading.classList.add('hidden'),540);
  console.info('Pelican Coast loaded: procedural 3D, dynamic water, real-time audio, cloth physics, 14 achievements.');
}catch(e){console.error(e);dom.loading.classList.add('hidden');dom.fatal.classList.remove('hidden');dom.fatal.prepend(document.createTextNode('错误详情：'+e.message+' — '));}
