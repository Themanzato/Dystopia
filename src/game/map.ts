export type Box = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };
export type Sheet = 'tiles' | 'gunShop' | 'medic' | 'restaurant' | 'shed' | 'tower' | 'kiln' | 'door';
export type Prop = { id: string; sheet: Sheet; source: Box; destination: Box; depth: number; site: string; footprint?: Box; groundDetail?: boolean; terrain?: 'grass' | 'stone' | 'gravel'; variant?: number };
export type AnimatedProp = Prop & { animation: { frames: number; fps: number; phase: number } };
export type Route = { id: string; width: number; points: Point[] };

export const WORLD = { width: 3072, height: 3072 };
export const FLOOR_COLOR = '#513a3d';
export const OUTSIDE_COLOR = '#100d10';
export const ARENA = { x: 1536, y: 1536, radius: 1410, shadowStart: 1320, shadowEnd: 1536 };
export const BUILDING_SCALE = 1.75;
export const CAMERA_START = { x: 1425, y: 1225 };
export const DISTRICTS = [
  { id: 'market', name: 'Mercado viejo', center: { x: 1400, y: 1200 } },
  { id: 'north', name: 'Talleres del norte', center: { x: 1410, y: 610 } },
  { id: 'civic', name: 'Plaza de servicios', center: { x: 1550, y: 1780 } },
  { id: 'power', name: 'Subestación y depósitos', center: { x: 2380, y: 1610 } },
  { id: 'salvage', name: 'Manzana demolida', center: { x: 580, y: 1870 } },
  { id: 'freight', name: 'Terminal de carga', center: { x: 1430, y: 2510 } },
];
const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height });
const point = (x: number, y: number): Point => ({ x, y });
// These connected corridors are composition/navigation data, never painted onto the floor.
// The arterial bends through the city; branches follow service access, not a block grid.
export const ROUTES: Route[] = [
  { id: 'old-market-street', width: 144, points: [point(500,1230), point(900,1270), point(1240,1410), point(1600,1490), point(2000,1400), point(2390,1220)] },
  { id: 'evacuation-avenue', width: 180, points: [point(680,2500), point(990,2200), point(1250,1900), point(1600,1630), point(2000,1400), point(2390,1220), point(2610,920)] },
  { id: 'west-service-lane', width: 132, points: [point(500,1230), point(520,1630), point(700,1990), point(990,2200)] },
  { id: 'north-service-loop', width: 136, points: [point(900,1270), point(1020,890), point(1410,620), point(1830,700), point(2090,1000), point(2180,1150), point(2180,1320), point(2000,1400)] },
  { id: 'utilities-and-freight', width: 152, points: [point(2390,1220), point(2580,1570), point(2340,1910), point(2040,2180), point(1700,2350), point(1420,2500), point(990,2200)] },
  { id: 'south-service-link', width: 128, points: [point(1250,1900), point(1440,2200), point(1700,2350)] },
];
const sprite = (id: string, site: string, sheet: Sheet, source: Box, x: number, y: number, scale = BUILDING_SCALE): Prop => {
  const prop: Prop = { id, site, sheet, source, destination: box(x, y, source.width * scale, source.height * scale), depth: y + source.height * scale };
  // Ground footprints reserve street clearance; roof overhangs and baked shadows do not block a route.
  let footprint: number[] | undefined;
  if (sheet === 'tiles' && source.width === 80) footprint = [10,52,50,18];
  else if (sheet === 'tiles' && source.width === 32 && source.y === 16) footprint = [6,19,20,10];
  else if (sheet === 'tiles' && source.width === 32 && source.y === 48) footprint = [7,15,18,8];
  else if (sheet === 'door') footprint = [2,39,60,8];
  else if (sheet === 'kiln') footprint = [8,22,18,10];
  if (footprint) prop.footprint = box(x + footprint[0] * scale, y + footprint[1] * scale, footprint[2] * scale, footprint[3] * scale);
  if (sheet === 'tiles' && source.height === 16 && source.y >= 80) prop.groundDetail = true;
  return prop;
};
const tile = (id: string, site: string, source: Box, x: number, y: number, scale = BUILDING_SCALE) => sprite(id, site, 'tiles', source, x, y, scale);
type BuildingSheet = 'gunShop' | 'medic' | 'restaurant' | 'shed' | 'tower';
const building = (id: string, site: string, sheet: BuildingSheet, x: number, y: number): Prop => {
  const regions = { gunShop: [118,118,8,89,70,20], medic: [82,88,6,63,48,18], restaurant: [113,135,6,109,72,20], shed: [80,81,5,57,49,18], tower: [50,99,15,78,19,18] };
  const [w,h,fx,fy,fw,fh] = regions[sheet];
  const prop = sprite(id, site, sheet, box(0,0,w,h), x, y);
  prop.footprint = box(x + fx * BUILDING_SCALE, y + fy * BUILDING_SCALE, fw * BUILDING_SCALE, fh * BUILDING_SCALE);
  return prop;
};
const block = (variant: number) => box(16 + variant % 6 * 32,16,32,32);
const slab = (variant: number) => box(16 + variant % 6 * 32,48,32,32);
const cable = box(80,80,32,16);
const brokenPole = box(0,160,48,48);
const relay = { cyan: box(128,208,80,80), green: box(128,128,80,80), yellow: box(48,128,80,80), violet: box(48,208,80,80) };

const buildings: Prop[] = [
  // Old market frontage follows the inside of the bend, with side access for deliveries.
  building('market-repair', 'market', 'gunShop', 470, 910),
  building('market-back-store', 'market', 'shed', 720, 1000),
  building('market-canteen', 'market', 'restaurant', 1110, 1005),
  building('market-pharmacy', 'market', 'medic', 1360, 1145),
  building('market-electrician', 'market', 'gunShop', 1545, 1145),
  building('market-food-hall', 'market', 'restaurant', 1790, 1045),
  building('market-east-stockroom', 'market', 'shed', 2250, 980),
  // Northern workshops form two irregular compounds instead of isolated plots.
  building('north-west-store', 'north', 'shed', 750, 530),
  building('north-west-workshop', 'north', 'gunShop', 740, 700),
  building('north-small-depot', 'north', 'shed', 550, 720),
  building('north-gate-watch', 'north', 'tower', 1400, 260),
  building('north-gate-store', 'north', 'shed', 1150, 350),
  building('north-workshop', 'north', 'gunShop', 1510, 310),
  building('north-clinic', 'north', 'medic', 1810, 390),
  building('north-workers-canteen', 'north', 'restaurant', 1990, 500),
  building('north-east-garage', 'north', 'shed', 2215, 745),
  // Services stand around a shared open square, not four matching squares of ground.
  building('civic-west-clinic', 'civic', 'medic', 1130, 1570),
  building('civic-repair', 'civic', 'gunShop', 855, 1435),
  building('civic-garage', 'civic', 'shed', 670, 1430),
  building('civic-south-hall', 'civic', 'restaurant', 1490, 1850),
  building('civic-records-depot', 'civic', 'shed', 1780, 1625),
  building('civic-maintenance', 'civic', 'shed', 1710, 2020),
  // The damaged western block has empty foundations and a shared salvage yard.
  building('salvage-edge-garage', 'salvage', 'shed', 360, 1540),
  building('salvage-workshop', 'salvage', 'gunShop', 340, 1740),
  building('salvage-old-canteen', 'salvage', 'restaurant', 770, 1740),
  building('salvage-south-store', 'salvage', 'shed', 490, 2100),
  building('salvage-checkpoint', 'salvage', 'tower', 520, 2260),
  // Utility buildings share relay banks, one maintenance yard and a loading spur.
  building('power-control', 'power', 'gunShop', 2170, 1490),
  building('power-cable-store', 'power', 'shed', 2140, 1750),
  building('power-east-store', 'power', 'shed', 2670, 1280),
  building('power-perimeter-watch', 'power', 'tower', 2740, 1570),
  building('power-workers-canteen', 'power', 'restaurant', 2510, 1890),
  building('power-north-warehouse', 'power', 'shed', 2680, 1040),
  building('power-north-watch', 'power', 'tower', 2440, 670),
  building('power-northern-repair', 'power', 'gunShop', 2190, 500),
  building('power-spare-parts', 'power', 'shed', 2430, 470),
  // Freight frontage sits below the curved delivery road with an open loading yard.
  building('freight-dispatch', 'freight', 'gunShop', 940, 2450),
  building('freight-small-store', 'freight', 'shed', 1260, 2610),
  building('freight-infirmary', 'freight', 'medic', 1650, 2570),
  building('freight-last-watch', 'freight', 'tower', 1890, 2485),
  // Auxiliary workshops and depots share street fronts with their neighbours.
  building('north-inner-workshop', 'north', 'gunShop', 1420, 710),
  building('north-inner-parts', 'north', 'shed', 1240, 800),
  building('north-workers-aid', 'north', 'medic', 1680, 770),
  building('market-rear-store', 'market', 'shed', 1450, 970),
  building('market-back-delivery', 'market', 'shed', 1840, 860),
  building('civic-west-aid', 'civic', 'medic', 1340, 1480),
  building('civic-east-aid', 'civic', 'medic', 1940, 1690),
  building('civic-supply-yard', 'civic', 'shed', 1780, 1840),
  building('civic-south-workshop', 'civic', 'gunShop', 1200, 2040),
  building('civic-south-store', 'civic', 'shed', 1430, 2225),
  building('power-spare-equipment', 'power', 'shed', 2240, 2030),
  building('power-worker-aid', 'power', 'medic', 2290, 2240),
  building('salvage-recovery-store', 'salvage', 'shed', 650, 2180),
  building('freight-first-aid', 'freight', 'medic', 1230, 2430),
  building('freight-east-workshop', 'freight', 'gunShop', 2030, 2430),
  building('freight-east-store', 'freight', 'shed', 2255, 2420),
];

const equipment: Prop[] = [
  tile('market-dead-line','market',brokenPole,986,1185),
  tile('north-shared-relay','north',relay.yellow,1050,500),
  tile('north-broken-post','north',brokenPole,1830,585),
  tile('civic-unused-relay','civic',relay.violet,1620,1680),
  tile('salvage-dead-relay','salvage',relay.cyan,228,1335),
  tile('salvage-fallen-post','salvage',brokenPole,332,1410),
  tile('power-relay-a','power',relay.cyan,2000,1490),
  tile('power-relay-b','power',relay.green,1970,1905),
  tile('power-old-post','power',brokenPole,2620,1735),
  tile('freight-relay','freight',relay.green,1910,2665),
  sprite('north-closed-access','north','door',box(0,0,64,48),1265,233),
];
for(const p of [...equipment]) if(p.sheet==='tiles'&&p.source.width===80) {
  equipment.push(tile(`${p.id}-loose-lead`,p.site,cable,p.destination.x+12,p.destination.y+p.destination.height+1));
}

// Collapsed corners form traces of lost walls, not identical decoration rings.
const ruins: Prop[] = [];
const remnant = (id: string, site: string, kind: 'block' | 'slab', coords: [number,number][], offset = 0) => {
  coords.forEach(([x,y],i) => ruins.push(tile(`${id}-${i}`,site,kind === 'block' ? block(i+offset) : slab(i+offset),x,y)));
};
remnant('west-old-wall','salvage','block',[[588,1546],[635,1556],[680,1578],[715,1592]],1);
remnant('west-sunk-foundation','salvage','slab',[[608,1602],[654,1613],[699,1632],[740,1655],[778,1650]],3);
remnant('west-front-collapse','salvage','slab',[[340,1995],[390,2002],[442,2008],[460,2048]],0);
remnant('north-old-foundation','north','slab',[[1610,965],[1658,975],[1700,989]],2);
remnant('power-collapsed-wall','power','block',[[2470,2160],[2524,2155],[2567,2168]],4);
remnant('power-factory-foundation','power','slab',[[2460,2225],[2512,2228],[2560,2245],[2604,2241],[2610,2190]],1);
remnant('freight-broken-platform','freight','slab',[[1465,2580],[1517,2589],[1560,2595]],5);

// Native transparent cells audited visually in Tileset.png. None is a floor tile.
export const TERRAIN_SOURCES = {
  grass: [box(80,96,16,16),box(96,96,16,16),box(112,96,16,16),box(128,96,16,16),box(144,96,16,16),box(160,96,16,16),box(176,96,16,16),box(192,96,16,16),box(112,80,16,16),box(176,80,16,16)],
  stone: [box(16,80,16,16),box(32,80,16,16),box(48,80,16,16),box(64,80,16,16)],
  gravel: [box(128,80,16,16),box(192,80,16,16)],
};
type TerrainKind = keyof typeof TERRAIN_SOURCES;
type Habitat = { id: string; x: number; y: number; rx: number; ry: number; grass: number; stone: number };
// Vacant lots, failed service yards and perimeter wasteland. These ellipses are
// placement data only: their shapes and colours are never painted onto the floor.
export const TERRAIN_HABITATS: Habitat[] = [
  {id:'gate-west-verge',x:1180,y:295,rx:190,ry:95,grass:38,stone:8},
  {id:'gate-east-verge',x:1720,y:340,rx:215,ry:100,grass:44,stone:9},
  {id:'north-west-yard',x:810,y:660,rx:185,ry:125,grass:30,stone:10},
  {id:'north-inner-court',x:1275,y:745,rx:190,ry:130,grass:35,stone:10},
  {id:'north-workers-yard',x:1670,y:900,rx:225,ry:135,grass:38,stone:12},
  {id:'north-east-gap',x:2170,y:785,rx:170,ry:150,grass:34,stone:9},
  {id:'market-west-approach',x:540,y:1070,rx:160,ry:190,grass:30,stone:14},
  {id:'market-service-court',x:1030,y:1130,rx:190,ry:135,grass:24,stone:9},
  {id:'market-rear-court',x:1475,y:1040,rx:200,ry:140,grass:32,stone:10},
  {id:'market-east-verge',x:2210,y:1170,rx:245,ry:115,grass:30,stone:11},
  {id:'salvage-wall-garden',x:675,y:1640,rx:200,ry:140,grass:55,stone:30},
  {id:'salvage-work-yard',x:510,y:1880,rx:215,ry:200,grass:48,stone:25},
  {id:'salvage-abandoned-edge',x:555,y:2200,rx:210,ry:125,grass:44,stone:19},
  {id:'civic-west-approach',x:1070,y:1540,rx:210,ry:100,grass:27,stone:10},
  {id:'civic-square-fringe',x:1530,y:1790,rx:290,ry:150,grass:24,stone:9},
  {id:'civic-south-court',x:1590,y:2180,rx:240,ry:160,grass:37,stone:13},
  {id:'civic-east-maintenance',x:1920,y:1870,rx:210,ry:185,grass:31,stone:12},
  {id:'power-north-yard',x:2460,y:1005,rx:225,ry:140,grass:35,stone:14},
  {id:'power-control-yard',x:2370,y:1595,rx:195,ry:180,grass:34,stone:16},
  {id:'power-south-collapse',x:2500,y:2200,rx:205,ry:145,grass:47,stone:28},
  {id:'power-east-perimeter',x:2790,y:1695,rx:125,ry:280,grass:50,stone:17},
  {id:'freight-west-waste',x:890,y:2515,rx:200,ry:145,grass:39,stone:14},
  {id:'freight-service-court',x:1430,y:2430,rx:245,ry:140,grass:33,stone:17},
  {id:'freight-east-yard',x:1860,y:2565,rx:220,ry:160,grass:36,stone:14},
  {id:'freight-south-verge',x:1480,y:2830,rx:330,ry:110,grass:56,stone:17},
  {id:'west-wild-margin',x:360,y:1420,rx:135,ry:290,grass:52,stone:18},
  {id:'north-east-wasteland',x:2250,y:555,rx:210,ry:145,grass:38,stone:16},
  {id:'south-west-transition',x:910,y:2185,rx:225,ry:145,grass:26,stone:12},
];

const intersects = (a: Box, b: Box, margin = 0) => a.x < b.x+b.width+margin && a.x+a.width > b.x-margin && a.y < b.y+b.height+margin && a.y+a.height > b.y-margin;
const streetDistance = (p: Point, a: Point, b: Point) => {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
function roadClearance(p: Point) {
  let closest=Infinity;
  for(const route of ROUTES) for(let i=1;i<route.points.length;i++) closest=Math.min(closest,streetDistance(p,route.points[i-1],route.points[i])-route.width/2);
  return closest;
}
function nearestDistrict(x: number,y: number) {
  let best=DISTRICTS[0];
  for(const district of DISTRICTS) if(Math.hypot(x-district.center.x,y-district.center.y)<Math.hypot(x-best.center.x,y-best.center.y)) best=district;
  return best.id;
}
function createTerrain(structures: readonly Prop[]): Prop[] {
  // Fixed seed and contextual anchors yield the same composition on every load.
  // This generation runs once at import; movement never generates scenery.
  let seed=0x64797374;
  const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const details: Prop[]=[];
  const occupied=new Map<string,Point[]>();
  const spacing=17;
  const add=(kind:TerrainKind,x:number,y:number,dense=false):boolean=>{
    if(Math.hypot(x-ARENA.x,y-ARENA.y)>ARENA.radius-30 || Math.hypot(x-1425,y-1345)<48) return false;
    // Keep the square and carriageways readable. The short shoots can stray
    // into their edges; dense grass and rocks gather on the verges instead.
    const clearance=roadClearance({x,y});
    const sources=TERRAIN_SOURCES[kind];
    const variant=Math.floor(random()*sources.length);
    if(kind==='grass'&&clearance<0&&(dense||variant>=8||random()<0.55)) return false;
    if(dense&&Math.hypot(x-1530,y-1620)<160) return false;
    const scale=kind==='gravel'?1.35+Math.floor(random()*3)*0.15:1.5+Math.floor(random()*3)*0.2;
    const destination=box(Math.round(x-8*scale),Math.round(y-14*scale),16*scale,16*scale);
    if(structures.some(p=>intersects(destination,p.destination,3))) return false;
    const cx=Math.floor(x/spacing),cy=Math.floor(y/spacing);
    for(let yy=cy-1;yy<=cy+1;yy++) for(let xx=cx-1;xx<=cx+1;xx++) {
      for(const other of occupied.get(`${xx},${yy}`)??[]) if(Math.hypot(x-other.x,y-other.y)<spacing) return false;
    }
    const key=`${cx},${cy}`;
    const cell=occupied.get(key)??[];cell.push({x,y});occupied.set(key,cell);
    details.push({id:`terrain-${kind}-${details.length}`,site:nearestDistrict(x,y),sheet:'tiles',
      source:sources[variant],destination,depth:destination.y+destination.height,groundDetail:true,terrain:kind,variant});
    return true;
  };
  const scatter=(kind:TerrainKind,amount:number,position:()=>Point,dense=false)=>{
    let placed=0;
    for(let attempts=0;placed<amount&&attempts<amount*16;attempts++) {
      const p=position();if(add(kind,p.x,p.y,dense)) placed++;
    }
  };
  // Asymmetric foundations: a broken front verge and one neglected side. No
  // repeated rectangle of decoration or artificial building plot is created.
  for(const p of structures.filter(p=>['gunShop','medic','restaurant','shed','tower'].includes(p.sheet))) {
    const d=p.destination;
    const left=random()<0.7;
    scatter('grass',12,()=>random()<0.6
      ?{x:d.x+d.width*(0.08+random()*0.65),y:d.y+d.height+19+random()*25}
      :{x:d.x+(left?-24-random()*35:d.width+24+random()*35),y:d.y+d.height*(0.5+random()*0.48)},true);
    scatter('stone',3,()=>({x:d.x-30+random()*(d.width+60),y:d.y+d.height+17+random()*55}));
    scatter('gravel',3,()=>({x:d.x-45+random()*(d.width+90),y:d.y+d.height+20+random()*70}));
  }
  for(const area of TERRAIN_HABITATS) {
    // Three loose subgroups plus escaped shoots, rather than an even ellipse.
    const foci=Array.from({length:3},()=>({x:area.x+(random()-0.5)*area.rx,y:area.y+(random()-0.5)*area.ry}));
    const clustered=()=>{
      const focus=foci[Math.floor(random()*foci.length)];
      const theta=random()*Math.PI*2,r=Math.sqrt(random());
      return {x:focus.x+Math.cos(theta)*r*area.rx*0.48,y:focus.y+Math.sin(theta)*r*area.ry*0.48};
    };
    scatter('grass',area.grass,clustered,true);
    scatter('stone',area.stone,clustered);
    scatter('gravel',Math.ceil(area.stone*0.7),clustered);
  }
  // Irregular short runs along both street edges tie the individual compounds
  // together. Gaps and staggered offsets avoid drawing a botanical fence.
  for(const route of ROUTES) for(let segment=1;segment<route.points.length;segment++) {
    const a=route.points[segment-1],b=route.points[segment];
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    for(let distance=40+random()*55;distance<length;distance+=90+random()*95) {
      if(random()<0.22) continue;
      const side=random()<0.5?-1:1,offset=route.width/2+24+random()*40;
      const x=a.x+dx/length*distance-dy/length*offset*side;
      const y=a.y+dy/length*distance+dx/length*offset*side;
      scatter('grass',3,()=>({x:x+(random()-0.5)*65,y:y+(random()-0.5)*50}));
      scatter('gravel',1,()=>({x:x+(random()-0.5)*75,y:y+(random()-0.5)*60}));
    }
  }
  const openPoint=()=>{
    const angle=random()*Math.PI*2,r=Math.sqrt(random())*(ARENA.radius-70);
    return {x:ARENA.x+Math.cos(angle)*r,y:ARENA.y+Math.sin(angle)*r};
  };
  // A sparse background reaches the streets, transitions and outer map too;
  // most of the detail still belongs to foundations, verges and ruined yards.
  scatter('grass',160,openPoint);
  scatter('stone',145,openPoint);
  scatter('gravel',135,openPoint);
  for(const p of ruins) scatter('gravel',2,()=>({x:p.destination.x+(random()-0.35)*65,y:p.destination.y+p.destination.height+6+random()*38}));
  return details;
}

const furnace = (id: string, site: string, x: number, y: number, phase: number): AnimatedProp => ({
  ...sprite(id,site,'kiln',box(0,0,32,33),x,y), animation: { frames: 10, fps: 10, phase },
});
// Loot chests are intentionally absent until occasional spawning is implemented.
export const ANIMATED_PROPS: AnimatedProp[] = [
  furnace('salvage-working-kiln','salvage',238,1910,0),
  furnace('power-workshop-kiln','power',2105,1638,5),
];
const structures: Prop[]=[...buildings,...equipment,...ruins];
const terrain=createTerrain([...structures,...ANIMATED_PROPS]);
export const PROPS: Prop[]=[...structures,...terrain].sort((a,b)=>a.depth-b.depth);
