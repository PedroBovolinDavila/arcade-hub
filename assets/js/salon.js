import * as THREE from 'three';

    const $ = (s, root=document) => root.querySelector(s);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gs = window.gsap || {to:(o,p)=>Object.assign(o,p),fromTo:()=>{},from:()=>{},timeline:()=>({to(){return this},from(){return this}}),delayedCall:(d,f)=>setTimeout(f,d),killTweensOf:()=>{}};
    const world = $('#world');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#170d20');
    scene.fog = new THREE.FogExp2('#170d20', .025);
    const camera = new THREE.PerspectiveCamera(43, innerWidth/innerHeight, .1, 90);
    camera.position.set(0, innerWidth<600?6.0:4.4, innerWidth<600?20.5:13.2);
    const cameraLook = new THREE.Vector3(0, innerWidth<600?2.1:2.15, innerWidth<600?-1.1:-1.3);
    camera.lookAt(cameraLook);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({antialias:false, alpha:false, powerPreference:'high-performance'});
    } catch (error) {
      $('#loader').classList.add('done'); $('#webgl-error').style.display='flex'; throw error;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 700 ? .54 : .68));
    renderer.setSize(innerWidth, innerHeight, false);
    const lowPowerDevice = innerWidth < 700 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    renderer.shadowMap.enabled = !lowPowerDevice;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute('aria-hidden','true');
    world.appendChild(renderer.domElement);

    const mats = {};
    function mat(name,color,roughness=.82,metalness=0,extra={}){
      if(!mats[name]) mats[name]=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
      return mats[name];
    }
    const wood=mat('wood','#3a2026'), woodLight=mat('woodLight','#67402e'), woodDark=mat('woodDark','#24141d'), brass=mat('brass','#bd8b4a',.36,.68), brassBright=mat('brassBright','#edc579',.3,.7), wine=mat('wine','#632b3d'), velvet=mat('velvet','#713b50'), teal=mat('teal','#28565b'), felt=mat('felt','#285e52'), black=mat('black','#100d16'), cream=mat('cream','#e9d7b5'), blue=mat('blue','#345783'), red=mat('red','#a54250');
    const emissive=(name,color,intensity=1)=>mat(name,color,.4,.08,{emissive:new THREE.Color(color),emissiveIntensity:intensity});
    const glowGold=emissive('glowGold','#e7ae58',1.7), glowRed=emissive('glowRed','#d64f60',1.45), glowBlue=emissive('glowBlue','#4f90cc',1.45), glowTeal=emissive('glowTeal','#55b3a5',1.15);

    // A low-resolution procedural shader: same visual family as Coringa, now used as the world beyond the room.
    const skyUniforms={uTime:{value:0},uResolution:{value:new THREE.Vector2(innerWidth,innerHeight)}};
    const skyMat=new THREE.ShaderMaterial({uniforms:skyUniforms,vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`precision highp float; varying vec2 vUv; uniform float uTime; uniform vec2 uResolution; void main(){vec2 p=(vUv-.5)*vec2(uResolution.x/uResolution.y,1.);float l=length(p);float a=atan(p.y,p.x)+uTime*.045+l*.9;p=vec2(cos(a),sin(a))*l;for(int i=1;i<6;i++){float f=float(i);p+=vec2(sin(p.y*f*.9+uTime*.25+f),cos(p.x*f*.9-uTime*.18+f*1.2))*.20/f;}float v=sin(p.x*3.2+p.y*2.1)*.5+.5;float w=sin(length(p)*4.2+uTime*.18)*.5+.5;vec3 c=mix(vec3(.055,.025,.075),vec3(.39,.10,.20),smoothstep(.28,.72,v));c=mix(c,vec3(.08,.20,.34),smoothstep(.38,.85,w)*.46);float grain=step(.992,fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233))+floor(uTime*2.))*43758.5453));c+=grain*.12;c=floor(c*7.0+.5)/7.0;gl_FragColor=vec4(c,1.);}`});
    const sky=new THREE.Mesh(new THREE.PlaneGeometry(90,55),skyMat);sky.position.set(0,12,-19);scene.add(sky);

    // Lighting: warm practicals and cool color spill, not a flat ambient wash.
    scene.add(new THREE.HemisphereLight('#b5a0c5','#241522',1.1));
    const keyLight=new THREE.DirectionalLight('#f4c98b',2.2);keyLight.position.set(-5,10,7);keyLight.castShadow=true;keyLight.castShadow=!lowPowerDevice;keyLight.shadow.mapSize.set(512,512);keyLight.shadow.camera.left=-11;keyLight.shadow.camera.right=11;keyLight.shadow.camera.top=10;keyLight.shadow.camera.bottom=-7;scene.add(keyLight);
    const warmFill=new THREE.PointLight('#d98455',48,18,2);warmFill.position.set(-4.8,4.5,-1.4);scene.add(warmFill);
    const coolFill=new THREE.PointLight('#4778b5',38,17,2);coolFill.position.set(4.5,4.0,-2.5);scene.add(coolFill);
    const centerFill=new THREE.PointLight('#d9a363',32,12,2);centerFill.position.set(0,5,-.8);scene.add(centerFill);

    const boxGeo=new THREE.BoxGeometry(1,1,1);
    function box(parent,name,position,scale,material,opts={}){
      const mesh=new THREE.Mesh(boxGeo,material);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=opts.cast!==false;mesh.receiveShadow=opts.receive!==false;parent.add(mesh);return mesh;
    }
    function cylinder(parent,position,rTop,rBottom,height,material,segments=8){
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments),material);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    }
    function plane(parent,position,scale,material,rotation=[0,0,0]){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;
    }
    function makeCanvasTexture(draw,w=256,h=128){
      const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');draw(ctx,w,h);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestMipmapNearestFilter;return tex;
    }
    function signTexture(title,sub,color='#edbd73'){
      return makeCanvasTexture((ctx,w,h)=>{ctx.fillStyle='#1a101b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#6b3543';ctx.fillRect(5,5,w-10,h-10);ctx.strokeStyle='#d5aa65';ctx.lineWidth=4;ctx.strokeRect(8,8,w-16,h-16);ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 25px monospace';ctx.fillText(title,w/2,59);ctx.fillStyle='#e8d3ad';ctx.font='12px monospace';ctx.fillText(sub,w/2,83);},256,112);
    }
    const dustTex=makeCanvasTexture((ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,237,188,1)');g.addColorStop(.25,'rgba(255,210,140,.75)');g.addColorStop(1,'rgba(255,180,90,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);},32,32);

    // Floor, perimeter and wall architecture.
    const floor=box(scene,'floor',[0,-.18,1],[20,.35,24],woodDark);floor.receiveShadow=true;
    const floorInset=box(scene,'floor inset',[0,.005,1],[15,.025,20],wood);floor.receiveShadow=true;
    const rug=box(scene,'central rug',[.1,.035,1.1],[8,.035,8.8],wine);rug.receiveShadow=true;
    box(scene,'rug inner border',[.1,.058,1.1],[7.65,.018,8.45],brass);
    box(scene,'rug center',[.1,.073,1.1],[7.38,.015,8.18],wine);
    // Pixel-like floorboards, deliberately geometric rather than photorealistic.
    for(let i=-9;i<=9;i++){
      box(scene,'floor plank seam',[i,.024,1],[.018,.008,19],woodDark,{cast:false});
      if(i%2===0) for(let j=-7;j<=8;j+=3) box(scene,'floor nail',[i+.15,.031,j],[.045,.012,.045],brass,{cast:false});
    }
    // Rear wall is framed in segments so the animated shader is visible through high windows.
    box(scene,'rear wall left',[-6.5,3.15,-7],[6.2,6.4,.55],woodDark);
    box(scene,'rear wall right',[6.5,3.15,-7],[6.2,6.4,.55],woodDark);
    box(scene,'rear upper lintel',[0,6.1,-7],[7,.45,.7],wood);
    box(scene,'rear lower panel',[0,.95,-6.72],[7,1.9,.45],wood);
    for(const x of [-9,-6,-3,0,3,6,9]){
      box(scene,'wall pilaster',[x,3.15,-6.58],[.22,6.1,.38],woodLight);
      box(scene,'pilaster brass cap',[x,5.95,-6.36],[.34,.14,.18],brass);
      box(scene,'pilaster base',[x,.26,-6.35],[.36,.5,.2],brass);
    }
    // Tall back windows, lit from the shader beyond.
    for(const x of [-4.5,4.5]){
      const pane=plane(scene,[x,3.85,-6.62],[2.55,3.65],new THREE.MeshBasicMaterial({color:'#8d4b72',map:null}));
      pane.material=new THREE.MeshBasicMaterial({color:'#a65b74',transparent:true,opacity:.25});
      box(scene,'window frame top',[x,5.72,-6.35],[2.9,.16,.24],brass);
      box(scene,'window frame bottom',[x,1.97,-6.35],[2.9,.16,.24],brass);
      box(scene,'window frame left',[x-1.37,3.85,-6.35],[.14,3.85,.24],brass);
      box(scene,'window frame right',[x+1.37,3.85,-6.35],[.14,3.85,.24],brass);
      box(scene,'window mullion',[x,3.85,-6.30],[.08,3.65,.24],woodLight);
    }
    // Side walls and skirting.
    box(scene,'left wall',[-10,3.25,0],[.5,6.5,14],woodDark);
    box(scene,'right wall',[10,3.25,0],[.5,6.5,14],woodDark);
    box(scene,'left skirting',[-9.7,.3,0],[.18,.55,14],brass);
    box(scene,'right skirting',[9.7,.3,0],[.18,.55,14],brass);
    // Wall panelling and framed art.
    for(const x of [-8.6,-7.1,7.1,8.6]){
      box(scene,'wall panel',[x,2.8,-6.22],[1.05,3.8,.12],wood);
      box(scene,'wall panel inset',[x,2.8,-6.12],[.9,3.55,.035],woodDark,{cast:false});
    }

    // Framed pixel illustrations on the rear wall.
    function wallPicture(x,y,title,accent){
      const group=new THREE.Group();group.position.set(x,y,-6.08);scene.add(group);
      box(group,'picture backing',[0,0,0],[1.35,1.55,.16],brass);
      box(group,'picture dark',[0,0,.1],[1.2,1.4,.045],black);
      const tex=makeCanvasTexture((ctx,w,h)=>{ctx.fillStyle='#16101c';ctx.fillRect(0,0,w,h);ctx.fillStyle=accent;ctx.fillRect(54,24,148,148);ctx.fillStyle='#16101c';ctx.fillRect(87,52,82,95);ctx.fillStyle='#f2d18b';ctx.fillRect(108,68,38,12);ctx.fillRect(116,105,22,22);ctx.fillStyle='#8e4255';ctx.fillRect(36,178,184,9);ctx.fillStyle='#e8d8b8';ctx.textAlign='center';ctx.font='bold 18px monospace';ctx.fillText(title,w/2,212);},256,240);
      const p=plane(group,[0,0,.13],[1.12,1.3],new THREE.MeshBasicMaterial({map:tex}));return group;
    }
    wallPicture(-7.5,4.1,'NAIPES','#9c4c58');wallPicture(7.5,4.1,'SALÃO','#345e86');

    // Brass chandelier and suspended lamps.
    const chandelier=new THREE.Group();chandelier.position.set(0,5.7,-.8);scene.add(chandelier);
    cylinder(chandelier,[0,.0,0],.13,.13,.4,brass,8);
    cylinder(chandelier,[0,-.3,0],1.1,.75,.16,brass,8);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=Math.cos(a)*.83,z=Math.sin(a)*.83;
      cylinder(chandelier,[x,-.48,z],.07,.07,.34,brass,6);
      const bulb=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),glowGold);bulb.position.set(x,-.72,z);chandelier.add(bulb);
    }
    const chandelierLight=new THREE.PointLight('#f5c77d',lowPowerDevice?2.8:5,5,2);chandelierLight.position.set(0,-.8,0);chandelier.add(chandelierLight);
    for(const [x,z,c] of [[-5,-2,'#e3a45d'],[5,-2,'#5a91bf']]){
      const lamp=new THREE.Group();lamp.position.set(x,4.95,z);scene.add(lamp);
      cylinder(lamp,[0,.35,0],.035,.035,.7,brass,6);
      cylinder(lamp,[0,0,0],.23,.4,.35,brass,8);
      const bulb=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),c==='#e3a45d'?glowGold:glowBlue);bulb.position.y=-.13;lamp.add(bulb);
      const light=new THREE.PointLight(c,11,5,2);light.position.set(0,-.22,0);lamp.add(light);
    }

    // A low-resolution label texture is used on the fascia and screens.
    function makeCabinet({id,x,z,label,sub,body,accent,screen,available=false,rotation=0}){
      const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rotation;root.userData.hotspot=id;scene.add(root);
      box(root,'cabinet base',[0,.22,0],[1.28,.42,.9],black);
      box(root,'cabinet body',[0,1.36,0],[1.45,2.55,.92],body);
      box(root,'cabinet side trim',[-.75,1.38,.02],[.09,2.5,.98],brass);
      box(root,'cabinet side trim',[.75,1.38,.02],[.09,2.5,.98],brass);
      box(root,'marquee frame',[0,2.65,.48],[1.24,.43,.11],brass);
      box(root,'marquee inset',[0,2.65,.55],[1.13,.32,.035],black);
      const signMat=new THREE.MeshBasicMaterial({map:signTexture(label,sub,accent),toneMapped:false});
      plane(root,[0,2.65,.58],[1.08,.27],signMat);
      box(root,'screen bezel',[0,1.77,.49],[1.13,1.12,.14],black);
      box(root,'screen trim',[0,1.77,.57],[1.02,1.01,.025],brass);
      const screenTex=makeCanvasTexture((ctx,w,h)=>{
        ctx.fillStyle='#100c16';ctx.fillRect(0,0,w,h);
        ctx.fillStyle=screen;ctx.fillRect(8,8,w-16,h-16);
        ctx.fillStyle='#130d1a';ctx.fillRect(22,18,w-44,h-36);
        ctx.fillStyle='#e8d4a7';ctx.textAlign='center';ctx.font='bold 24px monospace';ctx.fillText(label,w/2,56);
        ctx.fillStyle=accent;ctx.fillRect(36,72,w-72,7);
        ctx.fillStyle='#f1d9a5';ctx.font='12px monospace';ctx.fillText('CASA DE JOGOS',w/2,104);
        ctx.fillStyle=accent;ctx.fillRect(102,122,52,7);ctx.fillStyle='#4d8fd2';ctx.fillRect(80,133,96,7);
      },256,160);
      plane(root,[0,1.77,.592],[.94,.91],new THREE.MeshBasicMaterial({map:screenTex}));
      // Control panel and physical controls.
      box(root,'control shelf',[0,1.08,.56],[1.22,.18,.44],woodLight);
      cylinder(root,[-.31,1.23,.68],.075,.075,.13,brass,8).rotation.x=Math.PI/2;
      const stick=cylinder(root,[-.31,1.34,.68],.045,.055,.16,red,6);stick.rotation.x=.22;
      for(let i=0;i<3;i++){
        const b=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.055,8),i===0?glowRed:i===1?glowGold:glowBlue);b.rotation.x=Math.PI/2;b.position.set(.05+i*.18,1.23,.69);root.add(b);
      }
      box(root,'coin slot',[0,.68,.47],[.28,.055,.025],brass);
      box(root,'lower panel',[0,.4,.48],[.94,.43,.035],woodLight);
      for(let i=-2;i<=2;i++) box(root,'speaker slot',[i*.12,.4,.51],[.035,.22,.012],black,{cast:false});
      // Side panel jewel.
      const jewel=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),accent==='#4f90cc'?glowBlue:glowRed);jewel.position.set(.77,2.08,.18);root.add(jewel);
      // Hover halo: restrained light around the cabinet, animated on selection.
      const halo=new THREE.PointLight(accent,0,4,2);halo.position.set(0,2,.9);root.add(halo);
      root.userData.halo=halo;root.userData.jewel=jewel;root.userData.available=available;root.userData.label=label;
      return root;
    }
    const machines={
      coringa:makeCabinet({id:'coringa',x:-3.55,z:-2.15,label:'ARCADE',sub:'CASA DE JOGOS',body:teal,accent:'#f0c77d',screen:'#315b63',available:false,rotation:.13}),
      arcade:makeCabinet({id:'arcade',x:0,z:-2.75,label:'FLIPERAMA',sub:'DESDE 1987',body:wine,accent:'#e78c7c',screen:'#633248',available:false,rotation:0}),
      puzzle:makeCabinet({id:'puzzle',x:3.55,z:-2.15,label:'O SALÃO',sub:'JOGOS & DIVERSÃO',body:blue,accent:'#79b6d2',screen:'#2d4a70',available:false,rotation:-.13})
    };

    // A shared game table: deliberately fictional, social and non-monetary.
    const tableRoot=new THREE.Group();tableRoot.position.set(.85,0,2.5);tableRoot.userData.hotspot='table';scene.add(tableRoot);
    box(tableRoot,'table pedestal',[0,.65,0],[.45,1.3,.48],woodDark);
    box(tableRoot,'table foot',[0,.12,0],[1.5,.18,1.5],brass);
    const tableTop=box(tableRoot,'felt table top',[0,1.35,0],[3.35,.25,2.45],woodLight);
    box(tableRoot,'felt inset',[0,1.49,0],[3.1,.045,2.18],felt);
    box(tableRoot,'table rail',[0,1.53,0],[2.86,.025,1.96],brass);
    box(tableRoot,'felt center',[0,1.555,0],[2.72,.025,1.82],felt);
    // Decorative card silhouettes, not a playable gambling interface.
    for(let i=0;i<3;i++){
      const card=new THREE.Group();card.position.set(-.63+i*.62,1.62,.02+i%2*.1);card.rotation.y=(i-1)*-.13;card.rotation.z=(i-1)*.06;tableRoot.add(card);
      box(card,'card shadow',[0,-.008,0],[.42,.025,.62],black,{cast:false});
      box(card,'card face',[0,.012,0],[.38,.025,.58],cream,{cast:false});
      const suit=plane(card,[0,.028,.02],[.23,.36],new THREE.MeshBasicMaterial({map:makeCanvasTexture((ctx,w,h)=>{ctx.fillStyle='#f3e7cc';ctx.fillRect(0,0,w,h);ctx.fillStyle=i===1?'#345b8b':'#9d3d4c';ctx.textAlign='center';ctx.font='bold 68px monospace';ctx.fillText(['♠','♦','♣'][i],w/2,76);},96,128)}));suit.rotation.x=-Math.PI/2;
    }
    // Seats around the table.
    for(const [x,z,rot] of [[-1.15,1.5,0],[1.15,1.5,0],[-1.15,3.55,Math.PI],[1.15,3.55,Math.PI]]){
      const seat=new THREE.Group();seat.position.set(x,0,z);seat.rotation.y=rot;tableRoot.add(seat);
      box(seat,'chair seat',[0,.72,0],[.78,.18,.72],wine);
      box(seat,'chair back',[0,1.2,-.28],[.78,.95,.18],woodLight);
      for(const sx of [-.32,.32]) box(seat,'chair leg',[sx,.34,.25],[.09,.65,.09],woodDark);
    }
    const tableLight=new THREE.PointLight('#74b5a0',0,5,2);tableLight.position.set(0,2.3,0);tableRoot.add(tableLight);

    // A lounge corner and shelving to give the place believable lived-in depth.
    const lounge=new THREE.Group();lounge.position.set(-6.5,0,3.25);scene.add(lounge);
    box(lounge,'bench base',[0,.5,0],[2.2,.55,.85],woodDark);
    box(lounge,'bench cushion',[0,.88,.06],[2.15,.3,.88],velvet);
    box(lounge,'bench back',[0,1.45,-.34],[2.2,1.05,.22],wine);
    for(const x of [-.65,0,.65]) box(lounge,'cushion seam',[x,1.45,-.21],[.025,.75,.02],brass);
    box(lounge,'side table',[-1.65,.55,.1],[.8,.12,.75],woodLight);
    cylinder(lounge,[-1.65,.28,.1],.22,.3,.48,woodDark,8);
    const bookshelf=new THREE.Group();bookshelf.position.set(-8.9,0,-2.8);scene.add(bookshelf);
    box(bookshelf,'bookcase',[0,2.05,0],[1.05,4.1,.5],woodLight);
    for(let y=.75;y<=3.45;y+=.9){box(bookshelf,'shelf',[0,y,.3],[1.12,.09,.65],brass);for(let i=0;i<5;i++){const colors=[wine,teal,blue,woodDark,red];box(bookshelf,'book',[-.4+i*.19,y+.22,.28],[.13,.35+((i%2)*.12),.32],colors[i]);}}

    // Hanging pennants and tiny wall lamps add motion cues to the far background.
    for(let i=0;i<7;i++){
      const x=-5.6+i*1.85;
      box(scene,'ceiling beam',[x,5.95,-2.8],[.075,.11,5.8],woodLight);
      const pennant=new THREE.Mesh(new THREE.ConeGeometry(.18,.48,4),i%2?wine:teal);pennant.position.set(x,5.43,-5.65);pennant.rotation.z=Math.PI;scene.add(pennant);
    }

    // Dust motes are real particles, moving slowly in the light cones.
    const particleCount=lowPowerDevice?82:170;const particlePositions=new Float32Array(particleCount*3);const particleSpeeds=new Float32Array(particleCount);
    for(let i=0;i<particleCount;i++){particlePositions[i*3]=(Math.random()-.5)*17;particlePositions[i*3+1]=Math.random()*5.5+.35;particlePositions[i*3+2]=(Math.random()-.5)*14;particleSpeeds[i]=.08+Math.random()*.22;}
    const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
    const particleMat=new THREE.PointsMaterial({color:'#f3d29a',size:.055,map:dustTex,transparent:true,opacity:.62,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
    const dust=new THREE.Points(particleGeo,particleMat);scene.add(dust);

    // A few drifting paper/card silhouettes near the chandelier: decorative, not UI cards.
    const floaters=[];
    for(let i=0;i<5;i++){
      const g=new THREE.Group();g.position.set(-2.2+i*1.1,2.65+(i%2)*.5,-.3-(i%3)*.5);g.rotation.set(.15+i*.07,(i*.7),-.2+i*.08);scene.add(g);
      box(g,'floating card shadow',[0,0,0],[.34,.025,.5],black,{cast:false});box(g,'floating card face',[0,.018,0],[.31,.02,.47],i%2?cream:woodLight,{cast:false});
      const sig=plane(g,[0,.033,.0],[.2,.3],new THREE.MeshBasicMaterial({map:makeCanvasTexture((ctx,w,h)=>{ctx.fillStyle='#e9d7b5';ctx.fillRect(0,0,w,h);ctx.fillStyle=i%2?'#365f90':'#a74451';ctx.font='bold 60px monospace';ctx.textAlign='center';ctx.fillText(i%2?'♠':'♦',w/2,83);},96,120)}));sig.rotation.x=-Math.PI/2;
      floaters.push(g);
    }

    // Touch hit targets are larger than the visible meshes, while remaining invisible.
    const touchTargetMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false,side:THREE.DoubleSide});
    for(const machine of Object.values(machines)){
      const target=new THREE.Mesh(new THREE.BoxGeometry(2.05,3.35,1.55),touchTargetMaterial);
      target.position.set(0,1.55,0);target.userData.hotspot=machine.userData.hotspot;machine.add(target);
    }
    const tableTouchTarget=new THREE.Mesh(new THREE.BoxGeometry(4.35,2.9,4.15),touchTargetMaterial);
    tableTouchTarget.position.set(0,1.25,0);tableTouchTarget.userData.hotspot='table';tableRoot.add(tableTouchTarget);
    const interactives=[...Object.values(machines),tableRoot];
    const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let hovered=null,selected=null;
    const itemData={
      arcade:{type:'ÁREA · FLIPERAMAS',state:'✦ ESPAÇO DO SALÃO',title:'FLIPERAMAS',description:'Máquinas clássicas com telas, controles e iluminação retrô. Elas fazem parte do cenário; os jogos disponíveis ficam reunidos no catálogo.',meta:'MÁQUINAS CLÁSSICAS · JOGOS NO CATÁLOGO',action:'ABRIR CATÁLOGO ↗',available:true,area:'arcade'},
      table:{type:'ÁREA · CONVIVÊNCIA',state:'✦ ESPAÇO DO SALÃO',title:'MESAS DE CONVIVÊNCIA',description:'Um canto com mesas e assentos para reunir pessoas, conversar e jogar juntas. As mesas fazem parte do ambiente; escolha os títulos no catálogo.',meta:'MESAS E ASSENTOS · JOGOS NO CATÁLOGO',action:'ABRIR CATÁLOGO ↗',available:true,area:'tables'}
    };
    const areaData={
      lobby:{overline:'O SALÃO / RECEPÇÃO',title:'ENTRE.<br>DESCUBRA.<br>JOGUE.',description:'Um salão para descobrir jogos, reunir pessoas e começar novas partidas.',hintTitle:'BEM-VINDO AO SALÃO',hint:'Explore o ambiente ou abra o catálogo para encontrar seu próximo jogo.',footer:'O SALÃO ESTÁ ABERTO',footerHint:'SEU PRÓXIMO JOGO ESTÁ NO CATÁLOGO',markers:['arcade','table']},
      arcade:{overline:'O SALÃO / FLIPERAMAS',title:'MÁQUINAS.<br>LUZES.<br>NOSTALGIA.',description:'Uma área com máquinas clássicas de fliperama. Elas compõem o cenário; os jogos para iniciar estão no catálogo.',hintTitle:'ÁREA DOS FLIPERAMAS',hint:'Toque nas máquinas ou arraste a cena para olhar ao redor. Para jogar, abra o catálogo.',footer:'ÁREA DOS FLIPERAMAS',footerHint:'OS JOGOS ESTÃO NO CATÁLOGO',markers:['arcade']},
      tables:{overline:'O SALÃO / CONVIVÊNCIA',title:'MESAS PARA<br>FICAR À VONTADE.',description:'Um espaço com mesas e assentos para conversar e jogar em grupo. Os jogos são escolhidos no catálogo.',hintTitle:'MESAS DE CONVIVÊNCIA',hint:'Explore o espaço ou abra o catálogo para escolher uma partida.',footer:'ÁREA DE CONVIVÊNCIA',footerHint:'ESCOLHA UMA PARTIDA NO CATÁLOGO',markers:['table']}
    };
    const cameraPresets={
      lobby:{pos:[0,4.4,13.2],look:[0,2.15,-1.3],mobile:[0,6.0,20.5]},
      arcade:{pos:[0,3.5,8.4],look:[0,1.8,-2.75],mobile:[0,4.9,14.8]},
      tables:{pos:[1.1,4.15,8.8],look:[.85,1.1,2.5],mobile:[.85,5.5,15.2]},
      catalog:{pos:[0,3.65,6.8],look:[0,1.65,-3.9],mobile:[0,6.0,20.5]}
    };
    let activeArea='lobby';
    const cameraState={x:camera.position.x,y:camera.position.y,z:camera.position.z,lx:cameraLook.x,ly:cameraLook.y,lz:cameraLook.z};
    const explorationOffset={yaw:0,pitch:0};
    let currentCameraKey='lobby';
    function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
    function lookWithOffset(pos,look,offset=explorationOffset){
      const dx=look[0]-pos[0],dy=look[1]-pos[1],dz=look[2]-pos[2];
      const radius=Math.hypot(dx,dy,dz)||1;
      const yaw=Math.atan2(dx,-dz)+offset.yaw;
      const pitch=clamp(Math.asin(clamp(dy/radius,-1,1))+offset.pitch,-.4,.48);
      const flat=Math.cos(pitch)*radius;
      return [pos[0]+Math.sin(yaw)*flat,pos[1]+Math.sin(pitch)*radius,pos[2]-Math.cos(yaw)*flat];
    }
    function getCameraPose(key,offset=explorationOffset){
      const preset=cameraPresets[key]||cameraPresets.lobby;
      const mobile=innerWidth<600;
      const pos=mobile&&preset.mobile?preset.mobile:preset.pos;
      return {pos,look:lookWithOffset(pos,preset.look,offset)};
    }
    function applyTouchView(){
      const pose=getCameraPose(currentCameraKey);
      cameraLook.set(pose.look[0],pose.look[1],pose.look[2]);
      camera.lookAt(cameraLook);
      Object.assign(cameraState,{x:camera.position.x,y:camera.position.y,z:camera.position.z,lx:pose.look[0],ly:pose.look[1],lz:pose.look[2]});
      updateHotspotPositions();
    }
    const markerElements=[...document.querySelectorAll('.hotspot-marker')];
    const markerAnchors={
      arcade:{object:machines.arcade,offset:[0,3.2,.2]},
      table:{object:tableRoot,offset:[0,2.45,0]}
    };
    const areaButtons=[...document.querySelectorAll('.nav [data-area], .mobile-area-links [data-area], .mobile-dock [data-area]')];

    let toastTimer=0;
    function showToast(message){
      const toast=$('#toast');toast.textContent=message;toast.style.opacity='1';toast.style.transform='translate(-50%,0)';
      window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>{toast.style.opacity='0';toast.style.transform='translate(-50%,20px)';},1700);
    }
    function findHotspot(object){let o=object;while(o){if(o.userData&&o.userData.hotspot)return o.userData.hotspot;o=o.parent;}return null;}
    let areaCopyTimer=0;
    function setAreaUI(area){
      const data=areaData[area]||areaData.lobby;
      $('#scene-intro').classList.add('is-changing');
      window.clearTimeout(areaCopyTimer);
      areaCopyTimer=window.setTimeout(()=>{
        $('#scene-overline').textContent=data.overline;
        $('#scene-title').innerHTML=data.title;
        $('#scene-description').textContent=data.description;
        $('#hint-title').textContent=data.hintTitle;
        $('#hint-description').textContent=data.hint;
        $('#footer-state').textContent=data.footer;
        $('#footer-hint').textContent=data.footerHint;
        $('#scene-intro').classList.remove('is-changing');
      },120);
      areaButtons.forEach(button=>{
        const active=button.dataset.area===area;
        button.classList.toggle('active',active);
        if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
      });
      const visible=new Set(data.markers);
      markerElements.forEach(marker=>{
        const show=visible.has(marker.dataset.hotspot);
        marker.classList.toggle('is-visible',show);
        marker.hidden=!show;
      });
    }
    function moveCamera(key,options={}){
      const state={x:camera.position.x,y:camera.position.y,z:camera.position.z,lx:cameraLook.x,ly:cameraLook.y,lz:cameraLook.z};
      gs.killTweensOf(cameraState);
      currentCameraKey=cameraPresets[key]?key:'lobby';
      if(!options.keepOffset){explorationOffset.yaw=0;explorationOffset.pitch=0;}
      const pose=getCameraPose(currentCameraKey);
      const [x,y,z]=pose.pos,[lx,ly,lz]=pose.look;
      if(!window.gsap||reducedMotion){
        camera.position.set(x,y,z);cameraLook.set(lx,ly,lz);camera.lookAt(cameraLook);
        Object.assign(cameraState,{x,y,z,lx,ly,lz});updateHotspotPositions();
        return;
      }
      Object.assign(cameraState,{x:state.x,y:state.y,z:state.z,lx:state.lx,ly:state.ly,lz:state.lz});
      gs.to(cameraState,{x,y,z,lx,ly,lz,duration:.92,ease:'power3.inOut',overwrite:true,onUpdate:()=>{camera.position.set(cameraState.x,cameraState.y,cameraState.z);cameraLook.set(cameraState.lx,cameraState.ly,cameraState.lz);camera.lookAt(cameraLook);}});
    }
    function dismissSelection(){
      selected=null;
      const panel=$('#selection');
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden','true');
      panel.inert=true;
      document.body.classList.remove('has-selection');
      markerElements.forEach(marker=>marker.classList.remove('is-active'));
    }
    function navigateToArea(area){
      if(!areaData[area])return;
      activeArea=area;dismissSelection();setHover(null);
      setAreaUI(area);moveCamera(area);
      if(window.gsap&&!reducedMotion)gs.fromTo('#scene-hint',{opacity:.35,y:5},{opacity:1,y:0,duration:.35,ease:'power2.out',overwrite:true});
    }
    function exploreSalon(){
      dismissSelection();
      navigateToArea('lobby');
      showToast('SALÃO PRINCIPAL');
    }
    function showSelection(id){
      const data=itemData[id];if(!data)return;
      selected=id;
      $('#selection-type').textContent=data.type;$('#selection-state').textContent=data.state;
      $('#selection-title').textContent=data.title;$('#selection-description').textContent=data.description;
      $('#selection-meta').textContent=data.meta;
      $('#selection-action').textContent=data.action;$('#selection-action').disabled=!data.available;
      const panel=$('#selection');
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden','false');
      panel.inert=false;
      document.body.classList.add('has-selection');
      markerElements.forEach(marker=>marker.classList.toggle('is-active',marker.dataset.hotspot===id));
      if(window.gsap&&!reducedMotion)gs.fromTo('#selection',{y:18,opacity:0},{y:0,opacity:1,duration:.35,ease:'back.out(1.35)',overwrite:true});
    }
    function selectHotspot(id){
      // Todas as máquinas levam à mesma área: os jogos individuais ficam no catálogo.
      const areaId=(id==='coringa'||id==='arcade'||id==='puzzle')?'arcade':id;
      const data=itemData[areaId];if(!data)return;
      if(data.area!==activeArea){activeArea=data.area;setAreaUI(activeArea);}
      showSelection(areaId);moveCamera(data.area);
    }
    function backFromSelection(){
      if(!selected)return;
      dismissSelection();
      moveCamera(activeArea);
    }
    function goBack(){
      if(selected){backFromSelection();return;}
      if(activeArea!=='lobby'){navigateToArea('lobby');return;}
      showToast('VOCÊ JÁ ESTÁ NO SALÃO PRINCIPAL');
    }
    function setHover(id){
      if(hovered===id)return;
      if(hovered&&machines[hovered]){const m=machines[hovered];gs.to(m.userData.halo,{intensity:0,duration:.18});gs.to(m.scale,{x:1,y:1,z:1,duration:.2});}
      if(hovered==='table')gs.to(tableLight,{intensity:0,duration:.18});
      hovered=id;
      if(id&&machines[id]){const m=machines[id];gs.to(m.userData.halo,{intensity:5,duration:.24});gs.to(m.scale,{x:1.025,y:1.025,z:1.025,duration:.22,ease:'power2.out'});}
      if(id==='table')gs.to(tableLight,{intensity:14,duration:.24});
      markerElements.forEach(marker=>marker.classList.toggle('is-active',marker.dataset.hotspot===id||marker.dataset.hotspot===selected));
      document.body.style.cursor=id?'pointer':'default';
    }
    function hitTest(clientX,clientY){pointer.x=(clientX/innerWidth)*2-1;pointer.y=-(clientY/innerHeight)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(interactives,true);for(const h of hits){const id=findHotspot(h.object);if(id)return id;}return null;}
    const projected=new THREE.Vector3();
    function updateHotspotPositions(){
      for(const marker of markerElements){
        if(marker.hidden)continue;
        const config=markerAnchors[marker.dataset.hotspot];if(!config)continue;
        config.object.updateWorldMatrix(true,false);
        projected.set(...config.offset).applyMatrix4(config.object.matrixWorld).project(camera);
        const inFront=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.16&&Math.abs(projected.y)<1.16;
        marker.classList.toggle('is-visible',inFront);
        if(!inFront)continue;
        const margin=innerWidth<700?100:80;
        const x=Math.min(innerWidth-margin,Math.max(margin,(projected.x*.5+.5)*innerWidth));
        const y=Math.min(innerHeight-(innerWidth<700?205:70),Math.max(innerWidth<700?145:105,(-projected.y*.5+.5)*innerHeight));
        marker.style.left=x+'px';
        marker.style.top=y+'px';
      }
    }
    let touchGesture=null;
    renderer.domElement.addEventListener('pointermove',e=>{
      if(e.pointerType==='touch'&&touchGesture&&touchGesture.pointerId===e.pointerId){
        const dx=e.clientX-touchGesture.startX,dy=e.clientY-touchGesture.startY;
        if(Math.hypot(dx,dy)>7)touchGesture.moved=true;
        if(touchGesture.moved){
          gs.killTweensOf(cameraState);
          explorationOffset.yaw=clamp(touchGesture.startYaw-dx*.0045,-.92,.92);
          explorationOffset.pitch=clamp(touchGesture.startPitch+dy*.0032,-.28,.32);
          applyTouchView();
        }
        return;
      }
      if(e.pointerType!=='touch')setHover(hitTest(e.clientX,e.clientY));
    });
    renderer.domElement.addEventListener('pointerleave',()=>setHover(null));
    renderer.domElement.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch'){
        if(catalogScreen?.classList.contains('open')||modal?.classList.contains('open'))return;
        touchGesture={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,startYaw:explorationOffset.yaw,startPitch:explorationOffset.pitch,moved:false};
        renderer.domElement.setPointerCapture?.(e.pointerId);
        return;
      }
      const id=hitTest(e.clientX,e.clientY);if(id)selectHotspot(id);
    });
    function finishTouchGesture(e){
      if(!touchGesture||touchGesture.pointerId!==e.pointerId)return;
      const gesture=touchGesture;touchGesture=null;
      if(!gesture.moved){const id=hitTest(e.clientX,e.clientY);if(id)selectHotspot(id);}
      try{renderer.domElement.releasePointerCapture?.(e.pointerId);}catch{}
    }
    renderer.domElement.addEventListener('pointerup',finishTouchGesture);
    renderer.domElement.addEventListener('pointercancel',e=>{if(touchGesture?.pointerId===e.pointerId)touchGesture=null;});
    $('#camera-reset').addEventListener('click',()=>{explorationOffset.yaw=0;explorationOffset.pitch=0;moveCamera(selected||activeArea);showToast('VISÃO CENTRALIZADA');});
    markerElements.forEach(marker=>{
      marker.addEventListener('pointerenter',()=>setHover(marker.dataset.hotspot));
      marker.addEventListener('pointerleave',()=>setHover(null));
      marker.addEventListener('click',()=>selectHotspot(marker.dataset.hotspot));
    });
    areaButtons.forEach(button=>button.addEventListener('click',()=>navigateToArea(button.dataset.area)));
    const selectionBackButton=$('#selection-back');
    function returnFromSelectionToLobby(){
      if(!selected)return;
      navigateToArea('lobby');
    }
    selectionBackButton.addEventListener('click',returnFromSelectionToLobby);
    // Alguns navegadores móveis sintetizam o click de maneira inconsistente após gestos no canvas.
    // Tratar o pointerup de toque diretamente garante que o botão responda ao dedo.
    selectionBackButton.addEventListener('pointerup',e=>{
      if(e.pointerType==='touch'){
        e.preventDefault();
        returnFromSelectionToLobby();
      }
    });
    $('#selection-action').addEventListener('click',openCatalog);
    setAreaUI('lobby');

    // Catálogo: um único grid pesquisável que cresce conforme novos jogos forem cadastrados.
    const catalogScreen=$('#catalog-screen');
    const catalogMain=$('#catalog-main');
    const gameGrid=$('#game-grid');
    const gameSearch=$('#game-search');
    const catalogEmpty=$('#catalog-empty');
    const gameDetailView=$('#game-detail-view');
    let catalogPreviousArea='lobby';
    let selectedGame=null;
    let catalogGames=[];
    const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    async function loadCatalogGames(){
      try{
        const response=await fetch('./data/games.json',{cache:'no-store'});
        if(!response.ok)throw new Error(`Não foi possível carregar o catálogo (${response.status}).`);
        const entries=await response.json();
        catalogGames=Array.isArray(entries)?entries.filter(game=>game&&game.id&&game.name&&game.path):[];
      }catch(error){
        console.error('Falha ao carregar data/games.json:',error);
        catalogGames=[];
      }
      renderCatalog();
    }

    function renderCatalog(){
      const query=normalizeSearch(gameSearch.value);
      const matches=catalogGames.filter(game=>normalizeSearch(`${game.name} ${game.description}`).includes(query));
      $('#catalog-result-count').textContent=`${matches.length} ${matches.length===1?'JOGO':'JOGOS'}`;
      $('#catalog-result-caption').textContent=query?'ENCONTRADOS':'NO CATÁLOGO';
      gameGrid.innerHTML=matches.map(game=>`<button class="game-card" type="button" data-game-id="${escapeHTML(game.id)}" aria-label="Ver detalhes de ${escapeHTML(game.name)}">
        <span class="game-art game-art-${escapeHTML(game.kind||'default')}" aria-hidden="true">
          <span class="art-stamp">O SALÃO <i>·</i> ${escapeHTML(game.number)}</span>
          <span class="art-card art-card-back">♠</span><span class="art-card art-card-front">✦</span>
          <span class="art-wordmark">${escapeHTML(game.name)}</span>
          <span class="art-bottomline">CASA DE JOGOS · DESDE 1987</span>
        </span>
        <span class="game-card-info"><span class="game-card-status"><i></i>${escapeHTML(game.status)}</span><strong>${escapeHTML(game.name)}</strong><span class="game-card-desc">${escapeHTML(game.shortDescription)}</span><span class="game-card-open">VER JOGO <b>↗</b></span></span>
      </button>`).join('');
      catalogEmpty.hidden=matches.length!==0;
      gameGrid.hidden=matches.length===0;
      gameGrid.querySelectorAll('[data-game-id]').forEach(card=>card.addEventListener('click',()=>openGameDetails(card.dataset.gameId)));
    }
    function openCatalog(){
      if(catalogScreen.classList.contains('open'))return;
      catalogPreviousArea=activeArea;
      selected=null;$('#selection').classList.add('hidden');document.body.classList.remove('has-selection');
      catalogScreen.classList.add('open');catalogScreen.setAttribute('aria-hidden','false');
      document.body.classList.add('catalog-open');
      gameDetailView.hidden=true;catalogMain.hidden=false;gameSearch.value='';renderCatalog();
      if(innerWidth>700)moveCamera('catalog');
      if(innerWidth>700)window.setTimeout(()=>gameSearch.focus({preventScroll:true}),220);
      $('#catalog-close').focus({preventScroll:true});
    }
    function closeCatalog(){
      if(!catalogScreen.classList.contains('open'))return;
      catalogScreen.classList.remove('open');catalogScreen.setAttribute('aria-hidden','true');
      document.body.classList.remove('catalog-open');
      gameDetailView.hidden=true;catalogMain.hidden=false;selectedGame=null;
      const returnArea=areaData[catalogPreviousArea]?catalogPreviousArea:'lobby';
      if(innerWidth<=700)moveCamera(returnArea,{keepOffset:true});else moveCamera(returnArea);
      const focusTarget=innerWidth<=700?$('#mobile-open-catalog'):$('#open-catalog');
      requestAnimationFrame(()=>focusTarget?.focus({preventScroll:true}));
    }
    function openGameDetails(gameId){
      const game=catalogGames.find(item=>item.id===gameId);if(!game)return;
      selectedGame=game;
      catalogMain.hidden=true;
      gameDetailView.hidden=false;
      gameDetailView.innerHTML=`<button class="detail-back" id="detail-back">← VOLTAR AO CATÁLOGO</button>
        <div class="detail-layout">
          <div class="detail-art game-art-${escapeHTML(game.kind||'default')}"><span class="art-stamp">O SALÃO <i>·</i> ${escapeHTML(game.number)}</span><span class="art-card art-card-back">♠</span><span class="art-card art-card-front">✦</span><span class="art-wordmark">${escapeHTML(game.name)}</span><span class="art-bottomline">CASA DE JOGOS · DESDE 1987</span></div>
          <div class="detail-copy"><div class="catalog-overline">JOGO · ${escapeHTML(game.number)} <span class="detail-status"><i></i>${escapeHTML(game.status)}</span></div>
            <h2>${escapeHTML(game.name)}</h2><p>${escapeHTML(game.description)}</p>
            <div class="detail-rule"></div><div class="detail-meta"><span>ACESSO</span><strong>${game.status==='DISPONÍVEL'?'PRONTO PARA JOGAR':'EM PREPARAÇÃO'}</strong></div>
            <button class="primary detail-play" id="detail-play" ${game.status==='DISPONÍVEL'?'':'disabled'}>JOGAR AGORA <span>↗</span></button>
          </div>
        </div>`;
      $('#detail-back').addEventListener('click',backToCatalog);
      $('#detail-play').addEventListener('click',()=>{const gamePath=selectedGame?.path||'games/coringa/index.html';closeCatalog();openGame(gamePath);});
      gameDetailView.scrollTop=0;
    }
    function backToCatalog(){gameDetailView.hidden=true;catalogMain.hidden=false;selectedGame=null;catalogMain.scrollTop=0;}
    $('#open-catalog').addEventListener('click',openCatalog);
    $('#scene-open-catalog').addEventListener('click',openCatalog);
    $('#mobile-open-catalog').addEventListener('click',openCatalog);
    $('#mobile-dock-catalog').addEventListener('click',openCatalog);
    $('#catalog-close').addEventListener('click',closeCatalog);
    gameSearch.addEventListener('input',renderCatalog);
    loadCatalogGames();
    $('#clear-game-search').addEventListener('click',()=>{gameSearch.value='';renderCatalog();gameSearch.focus({preventScroll:true});});
    $('#scene-explore').addEventListener('click',exploreSalon);

    const modal=$('#game-modal'),frame=$('#game-frame');
    function openGame(gamePath='games/coringa/index.html'){
      modal.classList.add('open');modal.setAttribute('aria-hidden','false');
      if(frame.getAttribute('src')==='about:blank'||frame.dataset.gamePath!==gamePath){frame.src=gamePath;frame.dataset.gamePath=gamePath;}
      if(window.gsap&&!reducedMotion)gs.fromTo('.game-shell',{y:24,scale:.985,opacity:0},{y:0,scale:1,opacity:1,duration:.34,ease:'power2.out',overwrite:true});
      document.body.style.overflow='hidden';pauseWorld();
      $('#game-close').focus({preventScroll:true});
    }
    function closeGame(){
      if(!modal.classList.contains('open'))return;
      modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
      document.body.style.overflow='';
      resumeWorld();
      const focusTarget=innerWidth<=700?$('#mobile-open-catalog'):$('#scene-open-catalog');
      requestAnimationFrame(()=>focusTarget?.focus({preventScroll:true}));
    }
    $('#game-close').addEventListener('click',closeGame);
    $('#game-close').addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();closeGame();}});
    $('#game-fullscreen').addEventListener('click',()=>{const shell=$('.game-shell');if(!document.fullscreenElement)shell.requestFullscreen?.();else document.exitFullscreen?.();});
    window.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        if(modal.classList.contains('open'))closeGame();
        else if(catalogScreen.classList.contains('open')&&!gameDetailView.hidden)backToCatalog();
        else if(catalogScreen.classList.contains('open'))closeCatalog();
        else goBack();
        return;
      }
      if(modal.classList.contains('open'))return;
      if(e.key==='/'&&!catalogScreen.classList.contains('open')){e.preventDefault();openCatalog();return;}
      const quickAreas={'1':'lobby','2':'arcade','3':'tables'};
      if(quickAreas[e.key])navigateToArea(quickAreas[e.key]);
    });

    // The render loop sleeps while the game iframe is open or the tab is hidden.
    const clock=new THREE.Clock();
    let animationFrame=0,worldRunning=false,hotspotTick=0;
    const motionScale=reducedMotion?0:.55;
    function renderFrame(){
      if(!worldRunning)return;
      animationFrame=requestAnimationFrame(renderFrame);
      const dt=Math.min(clock.getDelta(),.05);const t=clock.elapsedTime;
      skyUniforms.uTime.value=t;
      const pos=particleGeo.attributes.position.array;
      for(let i=0;i<particleCount;i++){
        pos[i*3+1]+=(particleSpeeds[i]*dt*motionScale);
        pos[i*3]+=(Math.sin(t*.5+i)*.0008*motionScale);
        if(pos[i*3+1]>6)pos[i*3+1]=.35;
      }
      particleGeo.attributes.position.needsUpdate=true;
      if(!reducedMotion){
        floaters.forEach((g,i)=>{g.position.y+=Math.sin(t*.7+i)*.0009;g.rotation.z+=Math.sin(t*.5+i)*.00007;});
        chandelier.rotation.y=Math.sin(t*.18)*.035;
        warmFill.intensity=46+Math.sin(t*1.7)*2.4;coolFill.intensity=37+Math.sin(t*1.25+1.8)*2;
      }
      if((hotspotTick++&1)===0)updateHotspotPositions();
      renderer.render(scene,camera);
    }
    function resumeWorld(){
      if(worldRunning||document.hidden||modal.classList.contains('open'))return;
      worldRunning=true;clock.start();renderFrame();
    }
    function pauseWorld(){
      worldRunning=false;
      if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0;}
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseWorld();else resumeWorld();});
    resumeWorld();
    window.__salonBooted = true;

    let lastMobileViewport=innerWidth<600;
    function resize(){
      const w=innerWidth,h=innerHeight;camera.aspect=w/h;
      const mobileViewport=w<600;
      camera.fov=mobileViewport?53:43;
      camera.updateProjectionMatrix();
      const isSmall=w<700;
      const dpr=Math.min(devicePixelRatio||1,isSmall?1.35:1.5)*(isSmall?.72:.85);
      renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
      skyUniforms.uResolution.value.set(w,h);camera.lookAt(cameraLook);
      if(mobileViewport!==lastMobileViewport){lastMobileViewport=mobileViewport;moveCamera(selected?itemData[selected].area:activeArea,{keepOffset:true});}
      updateHotspotPositions();
    }
    window.addEventListener('resize',resize);

    // Initial reveal follows the staggered, springy entrance language of the original game.
    const loader=$('#loader');
    window.addEventListener('load',()=>{
      setTimeout(()=>loader.classList.add('done'),reducedMotion?80:650);
      if(!reducedMotion&&window.gsap){gs.from('.brand',{y:-22,opacity:0,duration:.62,ease:'back.out(1.5)',delay:.12});gs.from('.nav button',{y:-12,opacity:0,duration:.38,stagger:.055,ease:'back.out(1.6)',delay:.2});gs.from('#scene-intro>*',{y:20,opacity:0,duration:.58,stagger:.08,ease:'back.out(1.25)',delay:.35});gs.from('.hint',{x:18,opacity:0,duration:.55,ease:'power2.out',delay:.58});gs.from('.bottom-left>*',{y:12,opacity:0,duration:.42,stagger:.06,ease:'power2.out',delay:.7});}
      updateHotspotPositions();
    });

    // Keep the first render visible even if the optional GSAP CDN is unavailable.
    if(!window.gsap)loader.classList.add('done');
