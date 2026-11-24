tRock*.88+smoothstep(.42,.74,slope)*smoothstep(65.,150.,h)*.75),0.,1.);

 float gTint=vn(p*.021)*.65+.35*vn(p*.13);
 float gDry=smoothstep(.56,.8,vn(p*.013+9.));
 float meadowPatch=smoothstep(.42,.76,fbm(p*.014+7.3));
 vec3 forestGreen=mix(vec3(.042,.108,.022),vec3(.105,.185,.042),gTint);
 // Bright, vivid valley-floor and floodplain greens (References 1, 2, 4)
 vec3 meadowGreen=mix(vec3(.11,.22,.048),vec3(.22,.31,.078),gTint);
 float isLowMeadow=(1.-smoothstep(28.,95.,h))*(1.-smoothstep(.09,.26,slope));
 float floodBasin=freshSoil*(1.-smoothstep(0.,14.,h))*(1.-smoothstep(.08,.22,slope));
 vec3 grass=mix(forestGreen,meadowGreen,clamp(meadowPatch*.55+isLowMeadow*.68+floodBasin*.45,0.,1.))*(.86+.25*macro);
 grass=mix(grass,vec3(.30,.28,.10),gDry*.36*(1.-floodBasin));
 // the seaward fringe: salt-burnt, yellower turf
 grass=mix(grass,mix(vec3(.19,.21,.075),vec3(.31,.29,.13),gTint),margin*.8*(1.-freshSoil));
 // lush riparian floodplain and marsh greens
 grass=mix(grass,mix(vec3(.09,.20,.038),vec3(.20,.29,.068),gTint),freshSoil*.65);
 grass=mix(grass,mix(vec3(.08,.125,.035),vec3(.15,.185,.058),gTint),marsh*.68);
 vec3 highland=mix(vec3(.13,.165,.078),vec3(.22,.23,.13),macro)*(.88+.22*meso);
 float highlandMask=smoothstep(.46,.82,h/max(uPeak,80.)+macro*.12);
 // sandy soil, straw litter and creepers where the cover thins out onto the sand
 vec3 soil=mix(vec3(.29,.24,.165),vec3(.22,.185,.12),meso);
 sand=mix(sand,soil,margin*.6*(1.-wetDark)*(1.-freshSoil));
 float vineN=vn(l*.19+(vec2(vn(l*.8),vn(l*.8+4.))-.5)*1.4);
 float vine=smoothstep(.6,.7,vineN)*margin*(1.-smoothstep(.3,.7,wet));
 vec3 vineC=mix(vec3(.07,.13,.04),vec3(.14,.21,.06),bandLimit(vn(l*3.1),.5,.32,pixel));
 float straw=smoothstep(.55,.82,vn(l*.33+13.))*margin;

 vec3 color=mix(sand,grass,veg);
 if(freshSoil>.1&&h>.1){
  float nearGround=(1.-smoothstep(.3,1.3,pixel))*freshSoil;
  float litter=veg*(.32+.44*smoothstep(.34,.7,vn(l*.05)));
  vec2 forestUV=l*.21;
  vec3 floorColor=texture2D(uForestMap,forestUV).rgb;
  color=mix(color,floorColor*mix(.68,1.03,smoothstep(.3,3.,h)),litter*nearGround);
  bumpG+=(texture2D(uForestNormal,forestUV).xy*2.-1.)*litter*nearGround*.17;
 }
 color=mix(color,vec3(.33,.29,.15),straw*.4*(1.-veg));
 color=mix(color,vineC,vine*(1.-veg)*.72);
 color=mix(color,highland,highlandMask*veg);
 if(rockExposure>.002)color=mix(color,sampleRock(vW,Ng,pixel),rockExposure);
  float snow=smoothstep(480.,650.,h+35.*(macro-.5))*(1.-smoothstep(.26,.62,slope));
  color=mix(color,mix(vec3(.57,.63,.64),vec3(.83,.86,.82),meso),snow*.86*(1.-wetCell));

 // =============================== LAGOON & FRESHWATER BED ===============================
  float bedH=wetCell>.35?bankH:h;
  if(bedH<.3){
   float depthB=max(-bedH,0.);
  vec2 sdir=normalize(coast.zw+vec2(1e-4));
  float cw=.12+min(pixel*.02,.2);
  float coral=smoothstep(.62-cw,.62+cw,fbm(p*.035+3.))*smoothstep(.4,2.6,depthB)*(1.-smoothstep(9.,22.,depthB));
  vec3 reef=mix(vec3(.38,.25,.16),vec3(.20,.31,.17),meso);
  vec3 lag=mix(vec3(.52,.47,.35),vec3(.64,.58,.44),meso)*(.92+.16*bandLimit(vn(l*.35),.5,2.9,pixel));
  // seagrass meadows
  float sg=smoothstep(.55,.66,fbm(l*.026+21.))*smoothstep(.7,1.8,depthB)*(1.-smoothstep(8.,15.,depthB));
  vec3 sgC=mix(vec3(.09,.15,.06),vec3(.17,.23,.09),bandLimit(vn(l*2.1),.5,.48,pixel));
  vec3 seabed=mix(lag,sgC,sg);
  seabed=mix(seabed,reef,coral);
  float heads=.1;
  float hd=1.-smoothstep(.35,1.2,pixel);
  if(hd>.01)heads=mix(.1,smoothstep(.7,.92,fbm(p*.13+9.)),hd);
  seabed=mix(seabed,vec3(.33,.19,.24),heads*coral*.7);
  // wave ripples on bare lagoon sand, crests along the beach
  float uwA=(1.-smoothstep(.06,.2,pixel))*(1.-sg)*(1.-coral)*smoothstep(.15,.8,depthB)*(1.-smoothstep(6.,12.,depthB));
  if(uwA>.01){vec3 r=waveRipple(l,sdir,.75,.035);bumpG+=r.yz*uwA;seabed*=1.+r.x*1.5*uwA;}
  // coral rubble and shells
  float rbA=1.-smoothstep(.01,.03,pixel);
  if(rbA>.01){vec2 rb=grains(l*8.,.08,.22,pixel*8.,0x1f83d9abu);seabed=mix(seabed,mix(vec3(.28,.26,.22),vec3(.7,.66,.58),rb.y),rb.x*rbA*(1.-sg));}
  // caustics: drawn where resolved, their mean brightness beyond (no lattice, no flicker)
  float cDetail=1.-smoothstep(.035,.14,pixel);
 #ifdef LOWQ
 cDetail=0.;
 #endif
  float caus=.2;
  if(cDetail>.01)caus=mix(.2,causticNet(l,uTime),cDetail);
  caus*=smoothstep(.04,.7,depthB)*(1.-smoothstep(4.,13.,depthB))*smoothstep(.02,.15,uSun.y);
  seabed*=1.+uSunCol*caus*.28;
  // ---- kelp3-inspired underwater floor beneath lakes, rivers, and swamps ----
  // Pale sculpted rippled kelp-forest sand (#a8a090), rocky coralline/mossy reef
  // mats (#c88a8a & #8a9a5a), flowing variegated river cobbles & sunlit gravel bars,
  // golden-olive kelp meadow shadows, dark velvety swamp peat/moss pockets, and
  // luminous chromatic Voronoi caustics adapted faithfully from kelp3.
   float inlB=max(smoothstep(.25,.9,wm.r)*(1.-step(.3,h)),wetCell*(1.-step(.3,bankH)));
  if(inlB>.001){
   vec2 fl=wm.ba;float fsp=length(fl);
   float run=smoothstep(.08,.40,fsp);
   float swBed=clamp(wm.g,0.,1.)*(1.-run*.55);
   float bn=vn(l*.36)*.58+bandLimit(vn(l*1.8),.5,.56,pixel)*.42;
   float reefMask=smoothstep(.48,.76,fbm(l*.045+7.2))*smoothstep(.35,1.8,depthB);
   // 1) Lake floor: authentic kelp3 rippled warm sand (#a8a090), rich moss/coralline reef zones & lush kelp patches
   float litShelf=(1.-smoothstep(.35,4.8,depthB))*(1.-swBed*.85);
   vec3 kelpSand=mix(vec3(.26,.24,.185),vec3(.38,.35,.27),bn);
   vec3 deepSand=mix(vec3(.10,.17,.15),vec3(.20,.26,.22),bn);
   vec3 lakeBed=mix(deepSand,kelpSand,litShelf*.74+.26);
   float lkRip=(1.-smoothstep(.08,.38,pixel))*(1.-swBed*.65)*smoothstep(.12,1.0,depthB)*(1.-smoothstep(12.,20.,depthB));
   if(lkRip>.01){
    vec3 wr=waveRipple(l,normalize(coast.zw+vec2(.35,.65)),.76,.052);
    bumpG+=wr.yz*lkRip;
    lakeBed*=1.+wr.x*2.4*lkRip;
   }
   // kelp3 reef mats: olive velvet algae (#8a9a5a) & delicate pale pink coralline crust (#c88a8a)
   float corCrust=smoothstep(.56,.80,vn(l*.24+3.1))*reefMask;
   vec3 oliveMoss=mix(vec3(.16,.22,.095),vec3(.28,.33,.135),bn);
   vec3 roseCoral=mix(vec3(.40,.27,.27),vec3(.30,.27,.22),bn);
   lakeBed=mix(lakeBed,mix(oliveMoss,roseCoral,corCrust*.48),reefMask*.72);
   // Golden-olive macro kelp-bed & seagrass patches leaving sunlit rippled bare sand clearings!
   float weed=smoothstep(.42,.68,fbm(l*.060+4.3))*smoothstep(.35,1.6,depthB)*(1.-run*.45);
   vec3 kelpFloor=mix(vec3(.095,.148,.052),vec3(.24,.23,.075),bandLimit(vn(l*2.2),.5,.44,pixel));
   lakeBed=mix(lakeBed,kelpFloor,weed*.76);

   // 2) River floor: rich golden-earth sand + vivid multi-hued smooth river cobbles & mossy emerald stones
   vec3 rivSand=mix(vec3(.26,.225,.162),vec3(.37,.325,.242),bn);
   vec3 rivBed=rivSand;
   float scanFade=1.-smoothstep(.26,1.6,pixel);
   rivBed=mix(rivBed,texture2D(uGravelMap,l*.22).rgb*vec3(.78,.75,.68),scanFade*.82);
   bumpG+=(texture2D(uGravelNormal,l*.22).xy*2.-1.)*scanFade*(.16+.16*run);
   // Rich layered variegated river cobbles (ochre, sandstone, blue-grey river slate, mossy olive boulders)
   float cb=1.-smoothstep(.032,.15,pixel);
   if(cb>.01){
    vec2 c1=grains(l*1.75,.56,.36,pixel*1.75,0x9e3779b1u);
    vec2 c2=grains(l*4.6+1.7,.52,.34,pixel*4.6,0x85ebca77u);
    vec3 st1=mix(vec3(.18,.175,.155),vec3(.46,.41,.33),c1.y);
    st1=mix(st1,vec3(.23,.29,.29),step(.58,c1.y)*step(c1.y,.78));
    st1=mix(st1,vec3(.21,.27,.11),step(.78,c1.y)*smoothstep(.5,2.4,depthB));
    vec3 st2=mix(vec3(.20,.185,.155),vec3(.42,.38,.31),c2.y);
    rivBed=mix(rivBed,st1,c1.x*cb*(.55+.45*run));
    rivBed=mix(rivBed,st2,c2.x*cb*.75);
    rivBed*=.80+.36*c1.x*cb;
   }
   // Rich dark golden-emerald underwater river-kelp & stonewort beds tracing deep current channels!
   float rivWeed=smoothstep(.44,.72,fbm(l*.052+13.4))*smoothstep(.55,2.2,depthB);
   rivBed=mix(rivBed,mix(vec3(.095,.165,.062),vec3(.24,.24,.078),bn),rivWeed*.72);
   float frA=(1.-smoothstep(.07,.30,pixel))*smoothstep(.05,.24,fsp)*(1.-smoothstep(.7,1.3,fsp));
   if(frA>.01){vec3 r=waveRipple(l,normalize(fl+1e-4),.60,.042);bumpG+=r.yz*frA;rivBed*=1.+r.x*1.75*frA;}
   vec3 freshBed=mix(lakeBed,rivBed,clamp(run*.88+.22*(1.-smoothstep(.6,2.8,depthB))*run,0.,1.));

   // 3) Swamp floor: moody velvety dark organic peat, sunken mossy humus, amber-olive kelp carpet
   vec3 swampFloor=mix(vec3(.048,.056,.026),vec3(.115,.128,.052),bn*.68+reefMask*.32);
   float swMoss=smoothstep(.42,.72,fbm(l*.075+2.2));
   swampFloor=mix(swampFloor,vec3(.11,.165,.055),swMoss*.62);
   freshBed=mix(freshBed,swampFloor,swBed*.88);

   // 4) Iconic glowing kelp3 animated chromatic Voronoi caustic lace dancing brightly over every bed!
   float fc=1.-smoothstep(.10,.55,pixel);
   #ifdef LOWQ
   fc=0.;
   #endif
   if(fc>.01&&uSun.y>.01){
    // Refined golden-aqua kelp3 Voronoi caustics with whisper-subtle realistic dispersion (never cartoon rainbow!)
    vec2 cPos=l*.64+fl*uTime*.38;
    float dispOff=.016*(1.-swBed*.85);
    float cR=causticNet(cPos+vec2(dispOff,.007),uTime*1.04);
    float cG=causticNet(cPos,uTime*1.04);
    float cB=causticNet(cPos-vec2(dispOff,.007),uTime*1.04);
    vec3 cNet=mix(vec3(.14),pow(max(vec3(cR,cG,cB),0.),vec3(1.22)),fc);
    float flatFloor=smoothstep(.32,.82,Ng.y); // natural projection strongest on horizontal sunlit beds!
    // Adaptive caustic curve: delicate crisp lace in shallow streams (never blown out!), still softly luminous in deep 18m alpine lakes!
    float shallowSoft=smoothstep(.08,1.15,depthB);
    float deepReach=1.-smoothstep(11.5,24.0,depthB);
    float cDepthFade=shallowSoft*deepReach*flatFloor;
    float underBoost=cameraPosition.y<-.03?mix(1.18,1.72,smoothstep(1.5,7.5,depthB)):1.08;
    float cStr=mix(.86,.44,swBed)*mix(1.,.92,run)*cDepthFade*smoothstep(.01,.16,uSun.y)*(1.-uStorm*.65)*underBoost;
    vec3 cTint=mix(mix(vec3(.94,1.14,.98),vec3(1.06,1.08,.82),run),vec3(1.18,1.00,.46),swBed);
    freshBed+=freshBed*(uSunCol*.44+vec3(.30,.56,.46))*cNet*cTint*cStr;
   }
   seabed=mix(seabed,freshBed,inlB);
  }
   color=mix(color,seabed,1.-smoothstep(-1.1,0.,bedH));
 }

 // fine sand grain right under the viewer (keeps the beach crisp instead of smeared)
 float g9=1.-smoothstep(.03,.1,pixel),g23=1.-smoothstep(.012,.04,pixel);
 float micro=bandLimit(vn(p*.75),.5,1.33,pixel);
 float grain=0.;
 if(g9>.01)grain=(vn(l*9.)-.5)*.10*g9+(g23>.01?(vn(l*23.)-.5)*.06*g23:0.);
 color*=1.+(micro-.5)*.12*fine+grain*sandW;

 // micro relief -> shading normal (ripples light up under a low sun)
 vec3 N=Ng;
 if(fine>.01)N+=vec3(vn(p*.8)-.5,0.,vn(p*.8+11.)-.5)*.1*fine;
 float grainFade=1.-smoothstep(.03,.1,pixel);
 if(grainFade>.01)N+=vec3(vn(l*6.3)-.5,0.,vn(l*6.3+5.)-.5)*.07*grainFade;
 N=normalize(N+vec3(-bumpG.x,0.,-bumpG.y));
  if(rockExposure>.15&&pixel<1.4){
   vec3 tb=pow(abs(Ng),vec3(4.));tb/=dot(tb,vec3(1.));
   vec3 nx=texture2D(uRockNormal,vW.yz*.10).rgb*2.-1.;
   vec3 ny=texture2D(uRockNormal,vW.xz*.10+vec2(.31,.73)).rgb*2.-1.;
   vec3 nz=texture2D(uRockNormal,vW.xy*.10+vec2(.57,.19)).rgb*2.-1.;
   vec3 rn=normalize(vec3(nx.z*tb.x+ny.x*tb.y+nz.x*tb.z,
     nx.x*tb.x+ny.z*tb.y+nz.y*tb.z,nx.y*tb.x+ny.y*tb.y+nz.z*tb.z));
   N=normalize(mix(N,rn,rockExposure*.37*(1.-smoothstep(.5,1.4,pixel))));
  }

 float nl=max(dot(N,uSun),0.);
 float shadow=1.;
 if(dot(Ng,uSun)>-.05)shadow=sunShadow(vW+Ng*.6);
 #ifdef PROP_SHADOWS
 shadow*=propShadow(vW+Ng*.04);
 #endif
 shadow*=1.-.35*lipShadow;
 // Valley & under-canopy ambient occlusion: darkens concave gullies and dense forest slopes while keeping open floodplains bright
 float cavity=1.-.62*clamp(curv*2.5,0.,1.)+.24*clamp(-curv*2.4,0.,1.);
 float canopyShade=1.-.22*veg*(1.-isLowMeadow*.78)*(1.-rockExposure);
  float ambientOcclusion=(.72+.28*N.y)*mix(1.,cavity,smoothstep(-.3,.6,h))*canopyShade*hydro.b;
 vec3 ambient=hzSoft()*(.17+.16*N.y)*uLight*ambientOcclusion+vec3(.016,.024,.039)*uNight;
 color*=ambient+uSunCol*nl*.66*shadow+vec3(.08,.11,.17)*uNight*max(dot(N,uMoon),0.);
 color*=1.-.3*contact;
 color+=uSunCol*sparkle*shadow*.9;

 float mistBand=exp(-pow((h-46.)/34.,2.))*(1.-smoothstep(.05,.3,slope));
 if(mistBand>.01){
  float mistConcave=max(0.,-curv)*1.4;
  vec2 mistP=p*vec2(.006,.009)+vec2(uTime*.0045,uTime*.0022);
  float mistTex=smoothstep(.48,.82,fbm(mistP)*.75+vn(mistP*3.1)*.35);
  float mist=mistBand*mistTex*(.34+.66*mistConcave)*uLight*(1.-uStorm*.7)*(1.-uNight);
  color=mix(color,hzSoft()*.86+vec3(.02)*uLight,mist*.2);
 }

 if(gloss>.002){
  float nv=clamp(dot(N,V),.02,1.);
  float sheen=(.02+.26*pow(1.-nv,5.))*gloss*.5;
  vec3 R=reflect(-V,N);R.y=abs(R.y);
  color=mix(color,sky(R)*.85,sheen);
  color+=uSunCol*pow(max(dot(R,uSun),0.),220.)*gloss*.05*shadow;
 }

  // When submerged in a lake/river/swamp (Dive mode), seamlessly apply kelp3
  // red-first Beer-Lambert water absorption + sunward directional scattering haze!
  if(cameraPosition.y<-.03&&h<.4){
   float runUW=smoothstep(.08,.42,length(wm.ba));
   float swUW=clamp(wm.g,0.,1.)*(1.-runUW*.5);
   float litF=max(uLight,.12)*(1.-.42*uStorm);
   float lkUW=clamp(1.-runUW-swUW,0.,1.);
   vec3 vdUW=-V;
   vec3 sunUW=normalize(vec3(uSun.x*.48,max(uSun.y,.42),uSun.z*.48));
   // Exact kelp3 sunward(d) scatter: sunlit side glows bright aquamarine, opposite side falls into deep ocean teal
   float sunW=mix(.46,1.0,smoothstep(-.35,.85,dot(vdUW,sunUW)));
   vec3 uTop=(vec3(.20,.60,.58)*lkUW+vec3(.15,.49,.36)*runUW+vec3(.18,.24,.085)*swUW)*litF;
   vec3 uMid=(vec3(.048,.26,.31)*lkUW+vec3(.048,.22,.17)*runUW+vec3(.058,.090,.034)*swUW)*litF;
   vec3 uBot=(vec3(.013,.086,.128)*lkUW+vec3(.015,.080,.064)*runUW+vec3(.015,.024,.010)*swUW)*litF;
   vec3 uwCol=vdUW.y>=0.?mix(uMid,uTop,pow(clamp(vdUW.y,0.,1.),.62)):mix(uMid,uBot,pow(clamp(-vdUW.y,0.,1.),.72));
   uwCol*=sunW*(.66+.34*exp(-max(-cameraPosition.y,0.)*.038));
   float towardS=max(dot(vdUW,sunUW),0.);
   vec3 sGlow=mix(vec3(.55,.94,.86),vec3(.88,.78,.42),swUW*.72);
   uwCol+=sGlow*(pow(towardS,5.)*.22+pow(towardS,32.)*.38)*litF*(1.-.72*uStorm)*(1.-uNight);
   // Depth-adapted downwelling dim so shallow beds don't blow out and deep beds stay richly visible
   float bedD=max(-h,0.);
   float effD=bedD*mix(1.0,.52,smoothstep(5.5,18.0,bedD));
   vec3 downExt=mix(mix(vec3(.09,.044,.040),vec3(.12,.066,.078),runUW),vec3(.22,.18,.34),swUW);
   color*=mix(vec3(1.),exp(-downExt*effD),.56);
   float murk=mix(mix(.048,.064,runUW),.098,swUW);
   vec3 trans=exp(-mix(vec3(2.35,1.00,.85),vec3(1.42,1.08,1.65),swUW)*murk*dist);
   color=mix(uwCol,color,clamp(trans,0.,1.));
  }else{
  float dawnMist=uTwi*(1.-uNight)*marsh*exp(-max(h,0.)*.65)*exp(-max(cameraPosition.y,0.)*.07)*.0028;
  float fog=1.-exp(-dist*(uFog*1.12+dawnMist));
  vec3 aerialHz=mix(horizon(),mix(horizon(),vec3(.45,.61,.63)*uLight,.32),uDay*(1.-uStorm));
  color=mix(color,aerialHz,fog);
 }
 color=mix(horizon(),color,uFade);
 #ifdef FAR0
 color=mix(color,farCol,farMix);
 #endif
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
var na = 8;
function Br(o = 256) {
  let e = 2654435769,
    t = () => (
      (e ^= e << 13),
      (e ^= e >>> 17),
      (e ^= e << 5),
      (e >>> 0) / 4294967296
    ),
    r = (l) => {
      let u = new Float32Array(l * l);
      for (let x = 0; x < u.length; x++) u[x] = t();
      let d = new Float32Array(o * o),
        p = (x) => x * x * x * (x * (x * 6 - 15) + 10);
      for (let x = 0; x < o; x++)
        for (let f = 0; f < o; f++) {
          let v = (f / o) * l,
            b = (x / o) * l,
            g = Math.floor(v),
            M = Math.floor(b),
            w = p(v - g),
            E = p(b - M),
            k = g % l,
            R = (g + 1) % l,
            H = M % l,
            C = (M + 1) % l,
            W = u[H * l + k],
            T = u[H * l + R],
            P = u[C * l + k],
            L = u[C * l + R];
          d[x * o + f] = (W + (T - W) * w) * (1 - E) + (P + (L - P) * w) * E;
        }
      return d;
    },
    s = (l) => {
      let u = new Float32Array(o * o),
        d = 1,
        p = 0;
      for (let v = 0; v < 4; v++) {
        let b = r(l << v);
        for (let g = 0; g < u.length; g++) u[g] += b[g] * d;
        ((p += d), (d *= 0.5));
      }
      let x = 1e9,
        f = -1e9;
      for (let v = 0; v < u.length; v++)
        ((u[v] /= p), (x = Math.min(x, u[v])), (f = Math.max(f, u[v])));
      for (let v = 0; v < u.length; v++) u[v] = (u[v] - x) / (f - x);
      return u;
    },
    c = s(4),
    a = s(6),
    n = new Uint8Array(o * o * 4),
    i = (l, u) => c[((u + o) % o) * o + ((l + o) % o)],
    m = (l) =>
      Math.max(0, Math.min(255, Math.round(((l / na) * 0.5 + 0.5) * 255)));
  for (let l = 0; l < o; l++)
    for (let u = 0; u < o; u++) {
      let d = (l * o + u) * 4,
        p = (i(u + 1, l) - i(u - 1, l)) * 0.5 * o,
        x = (i(u, l + 1) - i(u, l - 1)) * 0.5 * o;
      ((n[d] = m(p * 0.045)),
        (n[d + 1] = m(x * 0.045)),
        (n[d + 2] = Math.round(c[l * o + u] * 255)),
        (n[d + 3] = Math.round(a[l * o + u] * 255)));
    }
  let h = new St.DataTexture(n, o, o, St.RGBAFormat, St.UnsignedByteType);
  return (
    (h.wrapS = h.wrapT = St.RepeatWrapping),
    (h.magFilter = St.LinearFilter),
    (h.minFilter = St.LinearMipmapLinearFilter),
    (h.generateMipmaps = !0),
    (h.colorSpace = St.NoColorSpace),
    (h.needsUpdate = !0),
    h
  );
}
var ui = 0.02;
export { Br, Nr, Wr, na, ui };
