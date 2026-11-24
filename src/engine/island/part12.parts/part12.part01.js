// island.js - part 12/21 (statements 146-151 of the original module).
import * as St from "three";
import { or } from "./part05.js";
import { ft } from "./part06.js";
import { Wo } from "./part10.js";
import { aa } from "./part11.js";

var Wr = `
varying vec3 vW,vN;varying float vH;varying vec2 vL;
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vL=position.xz;vN=normalize(mat3(modelMatrix)*normal);vH=position.y;gl_Position=projectionMatrix*viewMatrix*w;}`,
  Nr =
    ft +
    aa +
    or +
    Wo +
    `
uniform sampler2D uHM,uHydro;
uniform sampler2D uForestMap,uForestNormal,uGravelMap,uGravelNormal,uRockMap,uRockNormal;
uniform vec4 uHB;
uniform float uHs,uFog,uPeak,uFade;
varying vec3 vW,vN;
varying float vH;
varying vec2 vL;
#define WIND vec2(.8253,.5646)
vec2 islandUV(vec2 p){return (p-uHB.xy)/uHB.z*.5+.5;}
// the island texture holds the terrain (left half) and the fresh-water fields (right half)
vec4 HM(vec2 uv){return texture2D(uHM,vec2(uv.x*.5,uv.y));}
vec4 WM(vec2 uv){return texture2D(uHM,vec2(uv.x*.5+.5,uv.y));}
#ifdef SHCHEAP
#define SH_N 6
#define SH_A 3.
#define SH_B 8.
#elif defined(LOWQ)
#define SH_N 8
#define SH_A 2.1
#define SH_B 6.
#else
#define SH_N 14
#define SH_A 1.52
#define SH_B 4.
#endif
float sunShadow(vec3 p){
 if(uSun.y<.02)return 0.;
 float sh=1.,t=4.5;
 for(int i=0;i<SH_N;i++){
  vec3 q=p+uSun*t;
  vec2 uv=islandUV(q.xz);
  if(max(abs(uv.x-.5),abs(uv.y-.5))>.495)break;
  float d=q.y-HM(uv).r;
  // Crisp relief shadow edge so ridges cast sharp silhouettes across valleys and lakes
  sh=min(sh,smoothstep(-.35,2.4+t*.016,d));
  if(sh<.01)break;
  t=t*SH_A+SH_B;
  if(t>2400.)break;
 }
 return clamp(sh,0.,1.);
}
vec3 sampleRock(vec3 p,vec3 n,float pixel){
 vec3 tb=pow(abs(n),vec3(4.5));tb/=dot(tb,vec3(1.));
 float broad=fbm(p.yz*.012)*tb.x+fbm(p.xz*.012)*tb.y+fbm(p.xy*.012)*tb.z;
 float dA=1.-smoothstep(1.5,5.,pixel);
 #ifdef LOWQ
 dA=0.;
 #endif
 float detail=.5;
 if(dA>.01)detail=mix(.5,fbm(p.yz*.095)*tb.x+fbm(p.xz*.095)*tb.y+fbm(p.xy*.095)*tb.z,dA);
 float rockNoise=clamp(broad*.68+detail*.32,0.,1.);
 float strata=mix(.5,sin(p.y*.48+broad*5.8+detail*2.)*.5+.5,1.-smoothstep(2.,7.,pixel));
 // Crisp dark grey mountain rock with pale sunlit limestone/granite crest facets
 float altPale=smoothstep(65.,195.,p.y)*(.45+.55*max(dot(n,uSun),0.));
  vec3 darkSlate=mix(vec3(.075,.085,.09),vec3(.18,.19,.19),rockNoise);
  vec3 paleCrest=mix(vec3(.21,.22,.21),vec3(.35,.35,.32),rockNoise);
  vec3 baseRock=mix(darkSlate,paleCrest,altPale*.42);
  baseRock=mix(baseRock,baseRock*vec3(1.1,1.05,.94),strata*.14);
  vec3 scan=texture2D(uRockMap,p.yz*.10).rgb*tb.x
    +texture2D(uRockMap,p.xz*.10+vec2(.31,.73)).rgb*tb.y
    +texture2D(uRockMap,p.xy*.10+vec2(.57,.19)).rgb*tb.z;
  baseRock*=mix(vec3(1.),scan*2.2,.43*dA);
 float moss=smoothstep(.38,.78,n.y+broad*.25)*smoothstep(.44,.8,detail)*(1.-smoothstep(120.,220.,p.y));
 return mix(baseRock,vec3(.075,.14,.042),moss*.5);
}
// fade a [0,1] pattern of the given period to its mean once a pixel covers ~half a period
float bandLimit(float v,float mean,float period,float pixel){return mix(mean,v,1.-smoothstep(period*.25,period*.6,pixel));}

// sparse round grains on a jittered grid, exact integer hash (no float-hash lattice):
// x = coverage of a grain here, y = that grain's random id. aa = pixel size in cells.
vec2 grains(vec2 q,float density,float radius,float aa,uint seed){
 vec2 i=floor(q),f=q-i;ivec2 c=ivec2(i);
 float id=bHash2(c,seed);
 vec2 o=vec2(bHash2(c,seed^0x9e3779b9u),bHash2(c,seed^0x7f4a7c15u))*.56+.22;
 float r=radius*(.55+.9*fract(id*13.17));
 float d=length(f-o);
 return vec2((1.-smoothstep(r-aa,r+aa,d))*step(id,density),fract(id*7.31));
}
// aeolian ripples across the constant trade wind; warped so crests bend, fork and fade.
// returns (height, dh/dx, dh/dz) in metres
vec3 ripple(vec2 l,float lambda,float amp,float warp){
 vec2 wq=l*(.11/lambda);
 float w=(vn(wq)-.5+(vn(wq*2.3+19.3)-.5)*.5)*warp;
 float ph=fract(dot(l,WIND)/lambda+w)*6.2831853;
 float a=ph+.55*sin(ph);
 float s=sin(a),ds=cos(a)*(1.+.55*cos(ph))*6.2831853/lambda;
 return vec3(s,WIND*ds)*amp;
}
// wave-formed ripples on the lagoon floor, crests parallel to the local shore
// (three fixed orientations blended by the shore direction: no large-coordinate drift)
vec3 waveRipple(vec2 l,vec2 dir,float lambda,float amp){
 vec3 r=vec3(0.);float ws=0.;
 for(int k=0;k<3;k++){
  float a=float(k)*1.0471976;
  vec2 D=vec2(cos(a),sin(a));
  float wgt=pow(abs(dot(D,dir)),8.)+1e-4;
  float wv=(vn(l*.27+float(k)*7.1)-.5)*1.1;
  float ph=fract(dot(l,D)/lambda+wv)*6.2831853;
  float b=ph+.35*sin(ph);
  r+=vec3(sin(b),D*cos(b)*(1.+.35*cos(ph))*6.2831853/lambda)*wgt;ws+=wgt;
 }
 return r/ws*amp;
}
// animated caustic network: distance to the borders of drifting Voronoi cells
float causticCell(vec2 q,float t){
 vec2 i=floor(q),f=q-i;float d1=8.,d2=8.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 g=vec2(float(x),float(y));
  vec2 hh=vec2(h12(i+g),h12(i+g+17.3));
  vec2 o=.5+.38*sin(t*(.7+.6*hh)+6.2831*hh.yx);
  vec2 r=g+o-f;float d=dot(r,r);
  if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;
 }
 return sqrt(d2)-sqrt(d1);
}
float causticNet(vec2 l,float t){
 vec2 w=l+(vec2(vn(l*.37+t*.11),vn(l*.37-t*.09+5.2))-.5)*.9;
 float a=causticCell(w*1.15,t*1.1);
 float b=causticCell(w*1.6+9.7,-t*.9+3.);
 float la=1.-smoothstep(0.,.16,a),lb=1.-smoothstep(0.,.16,b);
 return la*.65+lb*.45+la*lb*.9;
}

void main(){
 vec2 p=vW.xz,uv=islandUV(p);
 vec2 l=vL+uBiome.xy;
 float h=vH;
 float pixel=length(fwidth(p));
 vec3 V=cameraPosition-vW;float dist=length(V);V/=max(dist,.001);
 vec3 Ng=normalize(vN);
 float slope=1.-Ng.y;
 float grad=sqrt(max(1.-Ng.y*Ng.y,0.))/max(Ng.y,.08);
 #ifdef FAR0
 // Far-field path (mobile): beyond FAR0 the island is a few pixels of colour, so skip the shadow
 // march, the noise stacks, rock/beach/lagoon detail and caustics. Blends in over FAR0..FAR1.
 vec3 farCol=vec3(0.);float farMix=smoothstep(FAR0,FAR1,dist);
 if(farMix>0.){
  vec4 fh=texture2D(uHydro,uv);
  float sl=1.-Ng.y;
  vec3 sandF=mix(vec3(.50,.43,.31),vec3(.26,.21,.15),1.-smoothstep(-.2,.9,h));
  float lowMeadow=(1.-smoothstep(28.,95.,h))*(1.-smoothstep(.09,.26,sl));
  vec3 grassF=mix(vec3(.075,.147,.032),vec3(.165,.265,.063),lowMeadow*.7);
  float vegF=smoothstep(1.6,6.,h)*(1.-smoothstep(.55,.85,sl));
  vec3 colF=mix(sandF,grassF,vegF);
  colF=mix(colF,vec3(.17,.20,.10),smoothstep(.46,.82,h/max(uPeak,80.))*vegF);
  float rockF=clamp(max(smoothstep(.78,1.05,sl),smoothstep(.42,.74,sl)*smoothstep(65.,150.,h)*.75),0.,1.);
  colF=mix(colF,mix(vec3(.12,.13,.13),vec3(.26,.27,.25),smoothstep(65.,195.,h)*.5),rockF);
  colF=mix(colF,vec3(.7,.74,.72),smoothstep(480.,650.,h)*(1.-smoothstep(.26,.62,sl))*.86);
  colF=mix(colF,vec3(.52,.47,.35),1.-smoothstep(-1.1,0.,h));
  float nlF=max(dot(Ng,uSun),0.);
  vec3 ambF=hzSoft()*(.17+.16*Ng.y)*uLight*(.72+.28*Ng.y)*fh.b+vec3(.016,.024,.039)*uNight;
  colF*=ambF+uSunCol*nlF*.66+vec3(.08,.11,.17)*uNight*max(dot(Ng,uMoon),0.);
  float fogF=1.-exp(-dist*uFog*1.12);
  vec3 aerF=mix(horizon(),mix(horizon(),vec3(.45,.61,.63)*uLight,.32),uDay*(1.-uStorm));
  colF=mix(colF,aerF,fogF);
  farCol=mix(horizon(),colF,uFade);
  if(farMix>.999){
   gl_FragColor=vec4(farCol,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   return;
  }
 }
 #endif
 float macro=fbm(p*.009);
 float meso=fbm(p*.038)*.5+.5;
 float fine=1.-smoothstep(.3,.9,pixel);
 vec4 coast=HM(uv);
  vec4 hydro=texture2D(uHydro,uv);
  float wetCell=hydro.g;
  float bankH=h-hydro.r;
 float cd=max(-coast.g,0.);
 vec4 wm=WM(uv);
  float fresh=max(hydro.a,mix(wm.g,wm.r,1.-smoothstep(-.12,.1,h)));
  float marsh=wetCell>.4?wm.g:h>0.?wm.r:wm.g;
  // Tidal mud continues to the delta; open beaches remain sand unless the
  // heightfield marks them as a wetland or a riparian bank.
  float freshSoil=max(fresh*smoothstep(22.,135.,cd),marsh*.88);
 vec2 bumpG=vec2(0.);

 // ---- shoreline simulation: wetness left by the swash, contact line and the lip's shadow
 float wet=0.,contact=0.,film=0.,lipShadow=0.;
 {
  vec2 suv=surfUV(p);float m=surfMask(suv);
  float wetFar=1.-smoothstep(-.08,mix(.16+.035*min(uShH,6.),.1,freshSoil),h);
  wet=wetFar;
  if(m>0.&&h<7.){
   float lod=log2(max(pixel/uSurfBox.z,1.));
   vec4 Fs=textureLod(uSurfF,suv,lod);
   float hs=texCubic(uSurfS,suv,uSurfBox.w).r;
   wet=mix(wetFar,Fs.g,m);
   float nearSim=1.-smoothstep(.7,2.,lod);
   film=smoothstep(.004,.02,hs)*m;
   contact=smoothstep(.003,.008,hs)*exp(-pow((hs-.02)/.026,2.))*(1.-smoothstep(.06,.16,hs))*m*nearSim;
   if(nearSim>.01){
    vec2 sd=uSun.xz/max(length(uSun.xz),1e-3);
    float reach=clamp(.05/max(uSun.y,.12),.05,.45);
    float hsun=texCubic(uSurfS,surfUV(p+sd*reach),uSurfBox.w).r;
    lipShadow=smoothstep(.012,.06,hsun-hs)*smoothstep(0.,.15,uSun.y)*m*nearSim;
   }
  }
 }
 wet=max(wet,1.-smoothstep(-.2,.04,h));
  // capillary-wet darkened bank band along every river, lake, and swamp waterline
  float dampZone=freshSoil*(1.-smoothstep(.04,.58+.45*marsh,bankH));
  wet=max(wet,dampZone*.92);
 float wetDark=smoothstep(.02,.88,wet);
 float gloss=wet*wet*(.42+.58*max(film,dampZone*(1.-smoothstep(.0,.36,bankH))*.72));

 // ---- plant cover: the shared field, band-limited to its mean far away
 vec2 vc=h>.12?vegCover(l,h,cd,grad,fresh):vec2(0.);
 float cov=vc.x;
 float veg=mix(vc.y,smoothstep(.12,.72,cov),smoothstep(.5,2.4,pixel));
  // Open sculpted sandy/shingle riverbanks and sunny littoral lake beaches breathe naturally before grass rises
  float openShore=freshSoil*(1.-marsh*.75)*(1.-smoothstep(.35,1.65+.55*vn(l*.028+4.1),bankH))*(1.-smoothstep(.28,.55,grad)*.5);
  veg*=(1.-openShore*.86);
  cov*=(1.-openShore*.8);
  if(wetCell>.35&&bankH<.14){cov=0.;veg=0.;}
 float margin=smoothstep(0.,.18,cov)*(1.-smoothstep(.5,.92,cov));
 float cliffMask=smoothstep(.78,1.05,slope+.08*(meso-.5));
 float sandW=(1.-veg)*(1.-cliffMask);

 // =============================== SAND ===============================
 vec3 sand=vec3(.5,.43,.31);float sparkle=0.;
 if(sandW>.002||h<.6){
  // broad tints drifting along the coast: warm coral, pale shell sand, grey volcanic grit
  float zone=vn(l*.0085+3.1)*.65+vn(l*.031+7.7)*.35;
  vec3 dry=mix(vec3(.50,.425,.305),vec3(.60,.53,.395),smoothstep(.28,.78,zone));
  dry=mix(dry,vec3(.43,.40,.35),smoothstep(.6,.9,vn(l*.011+11.))*.5);
  // wind streaks elongated along the trade wind, compaction mottling
  vec2 lw=vec2(dot(l,WIND),dot(l,vec2(-WIND.y,WIND.x)));
  float streak=bandLimit(vn(lw*vec2(.07,.75)),.5,1.3,pixel)*.55+vn(lw*vec2(.025,.2))*.45;
  float mott=bandLimit(vn(l*.43),.5,2.3,pixel)*.55+bandLimit(vn(l*1.7),.5,.6,pixel)*.45;
  dry*=(.9+.2*streak)*(.94+.12*mott);
  // loose dry sand up the beach is paler, the firm berm below it darker
  dry*=mix(.93,1.04,smoothstep(1.8,4.5,h));
  // ---- wind ripples: in drifting fields, never on the wet face or under plants
  float ripField=smoothstep(.3,.62,vn(l*.06+5.3))*(1.-smoothstep(.15,.6,wet))*(1.-smoothstep(.04,.3,cov))*smoothstep(1.6,2.6,h);
  float rA=(1.-smoothstep(.05,.17,pixel))*ripField;
  if(rA>.01){
   vec3 r=ripple(l,.46,.02,1.3);
   bumpG+=r.yz*rA;
   dry*=1.+r.x*2.2*rA;
  }
  float rB=(1.-smoothstep(.012,.04,pixel))*ripField;
  if(rB>.01){vec3 r=ripple(l+3.7,.13,.0045,1.6);bumpG+=r.yz*rB;}
  // ---- shell hash, coral rubble and dark grains (resolved near; their mean tint beyond)
  float gA=1.-smoothstep(.008,.024,pixel);
  dry*=mix(1.025,1.,gA);
  if(gA>.01){
   vec2 sh=grains(l*13.,.07,.16,pixel*13.,0x51ed270bu);
   vec3 shellC=mix(vec3(.80,.77,.70),vec3(.74,.54,.47),step(.72,sh.y));
   shellC=mix(shellC,vec3(.56,.52,.47),step(.9,sh.y));
   dry=mix(dry,shellC,sh.x*gA*smoothstep(1.2,2.4,h));
   vec2 dk=grains(l*29.+5.,.14,.2,pixel*29.,0x2545f491u);
   dry=mix(dry,vec3(.13,.12,.105),dk.x*gA*.75);
  }
  // ---- wrack line: stranded weed and bleached debris at the spring-tide limit
  float wd=wrackDist(l);
  float wrW=.7+.9*vn(l*.13+2.);
  float wrB=(1.-smoothstep(wrW*.35,wrW,abs(cd-wd+(vn(l*.19)-.5)*2.6)))*smoothstep(.35,.62,vn(l*.045+8.));
  float wr2=(1.-smoothstep(.15,.5,abs(cd-wd+6.5+(vn(l*.23+4.)-.5)*2.)))*smoothstep(.45,.7,vn(l*.05+1.))*.6;
  float wrack=max(wrB,wr2)*(1.-smoothstep(.5,.9,wet))*(1.-smoothstep(.1,.4,cov));
  if(wrack>.01){
   float wrF=1.-smoothstep(.02,.07,pixel);
   float bits=.34;
   vec3 weedC=vec3(.11,.095,.055);
   if(wrF>.01){
    vec2 wg=grains(l*9.,.62,.3,pixel*9.,0x68e31da4u);
    vec2 wg2=grains(l*21.+2.,.55,.28,pixel*21.,0xb5297a4du);
    bits=mix(bits,max(wg.x,wg2.x),wrF);
    weedC=mix(weedC,mix(vec3(.16,.13,.07),vec3(.07,.07,.045),wg.y),wrF);
    weedC=mix(weedC,vec3(.62,.58,.5),step(.86,wg2.y)*wg2.x*wrF);
   }
   dry*=1.-.14*wrack;
   dry=mix(dry,weedC,wrack*bits*.65);
  }
  // ---- swash marks: faint arcs of fine dark grains left at old run-up limits
  float swL=(1.-smoothstep(1.2,2.6,h))*(1.-smoothstep(.5,.85,wet))*(1.-smoothstep(.06,.25,pixel));
  if(swL>.01){
   float sl=abs(fract(cd*.29+vn(l*.07)*1.6)-.5);
   dry*=1.-.12*(1.-smoothstep(.02,.05,sl))*swL;
  }
  // ---- wet sand: darker and redder, smoothed by the swash
  vec3 wetS=mix(vec3(.24,.195,.14),vec3(.31,.255,.185),meso)*(.9+.14*mott);
  sand=mix(dry,wetS,wetDark);
  bumpG*=1.-.85*wetDark;
  // ---- glints: single quartz and shell facets catching the sun (very near only)
  float spA=(1.-smoothstep(.0035,.011,pixel))*(1.-wetDark*.6);
  if(spA>.01&&uSun.y>.04){
   ivec2 c=ivec2(floor(l*70.));
   vec3 fn=normalize(vec3(bHash2(c,0xa54ff53au)-.5,.55,bHash2(c,0x510e527fu)-.5));
   sparkle=pow(max(dot(fn,normalize(V+uSun)),0.),90.)*step(.9,bHash2(c,0x3c6ef372u))*spA*smoothstep(.04,.2,uSun.y);
  }
 }

 // ---- enhanced river, lake & swamp shores and banks: sunlit alluvial sand,
 //      graded river-shingle pebble point bars, mossy rock shelves, damp earthy
 //      stratified cutbanks, glossy dark wet waterlines, and rich swamp peat/moss
 if(freshSoil>.01){
  float mn=vn(l*.19)*.58+bandLimit(vn(l*1.25),.5,.75,pixel)*.42;
  float patchN=fbm(l*.026+3.7)*.5+.5;
  float drySandBand=smoothstep(.28,.92,patchN)*(1.-marsh*.88)*(1.-smoothstep(.28,.6,grad));
  // Sun-warmed golden river sand & variegated shingle bars (never stark washed cream!)
  vec3 warmSand=mix(vec3(.28,.24,.172),vec3(.39,.335,.245),mn);
  vec3 silt=mix(vec3(.22,.188,.132),vec3(.31,.268,.192),mn);
  vec3 dryBank=mix(silt,warmSand,drySandBand*.76);
  // Rich realistic capillary-wet dark ochre sand / river stone right along the waterline
  vec3 wetBand=mix(vec3(.135,.114,.082),vec3(.205,.172,.122),mn);
  // Deep fertile glistening swamp peat, root-mottled humus & vibrant sphagnum moss cushions framing blackwater shores
  vec3 peat=mix(vec3(.048,.044,.026),vec3(.105,.092,.048),mn);
  float sphagnum=smoothstep(.34,.72,vn(l*.11+4.8)*.62+vn(l*.42-2.3)*.38)*marsh;
  float mossEdge=smoothstep(.88,.08,bankH)*(1.-drySandBand*.38)*smoothstep(.26,.68,vn(l*.14+9.4));
  vec3 bank=mix(dryBank,wetBand,wetDark*.86);
  bank=mix(bank,mix(vec3(.085,.155,.042),vec3(.175,.255,.072),mn),mossEdge*(.46+.44*marsh));
  bank=mix(bank,peat,marsh*.86);
  bank=mix(bank,mix(vec3(.078,.168,.038),vec3(.165,.265,.068),mn),sphagnum*smoothstep(.04,.55,bankH)*(1.-smoothstep(.9,2.8,bankH))*.72);
  // Delicate warm alluvial sand ripples on wide sunny inner-bend bars & lake shores
  float barRip=(1.-smoothstep(.04,.18,pixel))*drySandBand*(1.-wetDark*.55)*(1.-smoothstep(.8,2.2,bankH));
  if(barRip>.01){vec3 sr=ripple(l+5.1,.52,.015,1.2);bumpG+=sr.yz*barRip;bank*=1.+sr.x*1.5*barRip;}
  // Rich sculpted gravel & flat shingle cobblestone point bars fading smoothly cleanly into water
  float textureFade=1.-smoothstep(.35,2.0,pixel);
  vec2 uvBank=l*.22;
  vec3 gravel=texture2D(uGravelMap,uvBank).rgb;
  float barMask=(1.-smoothstep(.6,2.8,bankH))*(1.-marsh*.88)*smoothstep(.18,.58,vn(l*.030+12.));
  vec3 cobbleTint=mix(vec3(.68,.63,.55),vec3(.52,.54,.52),vn(l*.08+2.1));
  bank=mix(bank,gravel*cobbleTint*mix(.56,.96,1.-wetDark*.82),barMask*textureFade*.80);
  vec3 gravelN=texture2D(uGravelNormal,uvBank).rgb*2.-1.;
  bumpG+=gravelN.xy*barMask*textureFade*.28;
  // Stratified earthen warm-brown outer cutbanks (smooth slope transition, no harsh black seams!)
  float cutSlope=smoothstep(.16,.48,grad)*(1.-marsh*.65);
  float strata=smoothstep(.25,.75,vn(vec2(dot(l,vec2(.04,.04)),bankH*2.8)));
  vec3 cutEarth=mix(vec3(.155,.120,.082),vec3(.265,.202,.135),strata);
  float cutBand=freshSoil*smoothstep(.02,.22,bankH)*(1.-smoothstep(.45,2.8,bankH))*cutSlope;
  bank=mix(bank,cutEarth,cutBand*.58);
  // Subtle damp capillary rim smoothly kissing water edge (dark natural wet-sand tone, zero soot line)
  float waterMark=smoothstep(-.05,.04,bankH)*(1.-smoothstep(.06,.34,bankH))*freshSoil;
  bank*=1.-.18*waterMark;
  // Multi-scale crisp rounded pebbles & variegated mineral cobbles along river & lake edges
  float gvC=1.-smoothstep(.03,.11,pixel);
  if(gvC>.01&&marsh<.72){
   vec2 cBig=grains(l*2.6,.48,.34,pixel*2.6,0x51a7e31du);
   vec3 cCol=mix(vec3(.24,.23,.21),vec3(.56,.51,.43),cBig.y);
   cCol=mix(cCol,vec3(.36,.40,.41),step(.64,cBig.y)*step(cBig.y,.80));
   cCol=mix(cCol,vec3(.48,.38,.29),step(.80,cBig.y));
   float cobW=cBig.x*gvC*(1.-smoothstep(.45,1.85,bankH))*(1.-marsh*.85)*(0.45+0.55*barMask);
   bank=mix(bank,cCol*mix(1.,.58,wetDark),cobW*.82);
  }
  float gv=1.-smoothstep(.014,.052,pixel);
  if(gv>.01&&marsh<.8){
   vec2 gr=grains(l*6.8,.36,.32,pixel*6.8,0x7b8f1d3fu);
   vec3 pCol=mix(vec3(.26,.24,.21),vec3(.58,.53,.45),gr.y);
   bank=mix(bank,pCol*mix(1.,.64,wetDark),gr.x*gv*(1.-smoothstep(.35,1.35,bankH))*(1.-marsh*.85));
  }
  sand=mix(sand,bank,freshSoil);
 }
 // ========================= PLANT-COVERED GROUND =========================
 float ce=8./(2.*uHB.z);
 float hc=coast.r;
 float hn=(HM(uv+vec2(ce,0.)).r+HM(uv-vec2(ce,0.)).r+HM(uv+vec2(0.,ce)).r+HM(uv-vec2(0.,ce)).r)*.25;
 float curv=clamp((hn-hc)/8.,-.65,.65);
 // Bare rock shows through on steep cliff faces AND sharp mountain ridge crests
 float crestRock=smoothstep(-.06,-.24,curv)*smoothstep(38.,115.,h);
 float rockExposure=clamp(max(cliffMask,cres