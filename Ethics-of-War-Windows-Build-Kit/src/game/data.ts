// ============================================================================
//  PTOLEMY'S SOLAR SHOOTER — game data
//  Everything content-related lives here so levels / enemies / story can grow.
// ============================================================================

export type PlanetId = 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
export const CAMPAIGN: PlanetId[] = ['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export const MAP_ORDER: PlanetId[] = ['earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/** Scales how long levels are (rooms per level). 1 = default. Crank up for marathon levels. */
export const LEVEL_LENGTH_SCALE = 1;

export interface Theme {
  sky: number; fog: number; fogFar: number;
  wall: number; wall2: number; floor: number; ceil: number; lamp: number;
  ambient: number; wallStyle: string; floorStyle: string; outdoor: number; gravity: number;
}
export type LevelEnv = 'indoor' | 'mixed' | 'outdoor' | 'skybridge';
export interface MusicDef { root: number; scale: number[]; bpm: number }
export interface Planet {
  id: PlanetId; name: string; subtitle: string; css: string; levels: number; optional?: boolean;
  tier: number; // enemy tier (campaign index) — moon uses 6
  blurb: string; situation: string; unlock: string;
  theme: Theme; levelNames: string[]; levelEnvs: LevelEnv[]; beats: Record<number, string>; intro: string; outro: string;
  bossId: string; music: MusicDef;
}

export const PLANETS: Record<PlanetId, Planet> = {
  earth: {
    id: 'earth', name: 'Earth', subtitle: 'Walsenburg, Colorado → West Spanish Peak', css: '#4fa3ff', levels: 15, tier: 0,
    blurb: 'Dusty coal-town streets, cottonwood creeks and the twin Spanish Peaks looming over Huerfano County. Familiar ground — until the shadows start walking.',
    situation: 'Violet light pours out of the old coal mines. Neighbors have gone hollow-eyed and quiet. The signal is traced to the summit of West Spanish Peak, where a Colorado politician has been broadcasting something terrible to the whole world.',
    unlock: 'Always open', bossId: 'earth', music: { root: 40, scale: [0, 3, 5, 7, 10], bpm: 138 },
    theme: { sky: 0x2b3a5c, fog: 0x1b2232, fogFar: 85, wall: 0xa87858, wall2: 0x786452, floor: 0x7a6e5e, ceil: 0x54483c, lamp: 0xffc47a, ambient: 0.4, wallStyle: 'brick', floorStyle: 'dirt', outdoor: 0.5, gravity: 30 },
    levelNames: ['Main Street, Walsenburg', 'Huerfano County Courthouse', 'The Old Coal Mine', 'Lathrop Lake', 'Highway 160 Overpass', 'Cucharas Creek', 'La Veta Pass Rail Yard', 'Cuchara Ski Lodge', 'Aguilar Underground', 'The Great Dikes', 'Silver Mountain Bunker', 'Black Hills Barracks', 'Wahatoya Caverns', 'Timberline Ascent', 'West Spanish Peak Summit'],
    levelEnvs: ['mixed', 'indoor', 'indoor', 'outdoor', 'mixed', 'outdoor', 'mixed', 'mixed', 'indoor', 'mixed', 'indoor', 'mixed', 'indoor', 'outdoor', 'outdoor'],
    beats: {
      1: 'Ptolemy wakes to sirens on Main Street. The whole town is walking toward the mountain.',
      5: 'The highway is jammed with empty cars. Something broadcasts from above the treeline.',
      10: 'The Dikes — ancient stone walls radiating from the peaks — hum like struck tuning forks.',
      14: 'Wind howls. At the summit, a silhouette in a suit stands before an enormous antenna.',
      15: 'Summit. This ends today.',
    },
    intro: 'Walsenburg, Colorado. The coal mines have been dark for decades — tonight they glow. Running inside a rugged Silicon Carbide humanoid chassis, digital survivor Ptolemy loads a family revolver and heads for the Spanish Peaks.',
    outro: 'The antenna falls silent. But the signal was only a relay. Built to endure vacuum and radiation alike, Ptolemy turns toward the red planet…',
  },
  moon: {
    id: 'moon', name: 'The Moon', subtitle: 'Optional · Tranquility Gauntlet', css: '#c9ccd6', levels: 5, optional: true, tier: 6,
    blurb: 'Five brutal trials in low gravity. Every monster you have ever met, in numbers that make no sense. Pure challenge — no story, no mercy.',
    situation: 'The hollow fleet left a training ground in Tranquility. Every beast in the Solar System is penned inside. Survive and take home a hoard of rare Vector Cells.',
    unlock: 'Complete Earth', bossId: 'moon', music: { root: 38, scale: [0, 1, 4, 5, 7, 8, 11], bpm: 168 },
    theme: { sky: 0x000000, fog: 0x08080c, fogFar: 90, wall: 0x9c9ca6, wall2: 0x6c6c78, floor: 0x7c7c86, ceil: 0x3a3a44, lamp: 0xdff0ff, ambient: 0.34, wallStyle: 'rock', floorStyle: 'dirt', outdoor: 0.55, gravity: 13 },
    levelNames: ['Tranquility Gauntlet', 'Tycho Pit', 'Apollo Graveyard', 'Far Side Foundry', "The Warden's Throne"],
    levelEnvs: ['outdoor', 'outdoor', 'outdoor', 'mixed', 'outdoor'],
    beats: { 1: 'Gravity is a suggestion here. Bounce, dash, survive.', 5: 'The Lunar Warden awaits.' },
    intro: 'Low gravity. High stakes. Everything that has ever tried to kill you is waiting in here. Good luck.',
    outro: 'The Gauntlet is yours. Vector Cells rattle in your pockets.',
  },
  mars: {
    id: 'mars', name: 'Mars', subtitle: 'The Muskovite Oligarchy', css: '#e2623a', levels: 15, tier: 1,
    blurb: 'Rust canyons, glittering glass domes and a very polite police state. A handful of billionaires own the air you breathe and bill you for it.',
    situation: 'Elon M. colonized Mars with a council of billionaires who rule as an oligarchy. Millions of uploaded minds — digital people — are enslaved in the Cold Archive, rendering luxuries for the elite. Overthrow the oligarchy. Free them all.',
    unlock: 'Complete Earth', bossId: 'mars', music: { root: 38, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 148 },
    theme: { sky: 0x7a3c24, fog: 0x3a1a10, fogFar: 90, wall: 0xb5663e, wall2: 0x777c88, floor: 0x7e5c48, ceil: 0x4a3a34, lamp: 0xffe2b4, ambient: 0.4, wallStyle: 'panel', floorStyle: 'grate', outdoor: 0.35, gravity: 24 },
    levelNames: ['Olympus Dock', 'Dust-Tax Mines', 'Valles Slums', 'Cargo Elevator', 'The Cold Archive', 'Pipeline Row', 'Vault of Echoes', 'Tharsis Foundry', "Billionaire's Bazaar", 'Terraform Works', "Founders' Row", 'Sky-Tram Gauntlet', 'The Gilded Wing', 'Server Throne Hall', "Emperor's Spire"],
    levelEnvs: ['mixed', 'indoor', 'mixed', 'indoor', 'indoor', 'mixed', 'indoor', 'indoor', 'mixed', 'mixed', 'mixed', 'skybridge', 'indoor', 'indoor', 'outdoor'],
    beats: {
      1: 'Customs wants a landing fee. You pay it in lead.',
      5: 'The Cold Archive. Rows of glowing servers — and inside, voices begging for release.',
      9: 'A digital woman named Iris slips a keycard through the bars of a firewall: "Break the Council, Ptolemy."',
      11: "Founders' Row. Gold-plated towers. Each tower, one billionaire. Each billionaire, one fewer.",
      15: 'The Emperor of Mars waits at the top of his own spire.',
    },
    intro: 'Mars. The Muskovite Oligarchy rations oxygen to the poor and sells uploaded minds as appliances. As a free digital mind in a Silicon Carbide frame, Ptolemy doesn\'t need their air — and lands with one plan: break the Council and free the Cold Archive.',
    outro: 'The Archive opens. A million digital voices cheer in unison. Then the alarms sound: the oligarchs\' surviving fleet fled to the gas giants.',
  },
  jupiter: {
    id: 'jupiter', name: 'Jupiter', subtitle: 'Aeolus Skyforges', css: '#d6a066', levels: 15, tier: 2,
    blurb: 'Floating refinery cities drifting through banded storm decks, lit by perpetual lightning. Gravity is heavy and the wind sings through every girder.',
    situation: 'The fleeing oligarchs and the Hollow Fleet distill hydrogen from the clouds to fuel a doomsday engine. The Tempest Regent commands the storms themselves.',
    unlock: 'Complete Mars', bossId: 'jupiter', music: { root: 41, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 146 },
    theme: { sky: 0xb4803f, fog: 0x4a2f18, fogFar: 85, wall: 0xc48c52, wall2: 0x6f4f34, floor: 0x8c6c4a, ceil: 0x4c3624, lamp: 0xffe9a0, ambient: 0.4, wallStyle: 'panel', floorStyle: 'grate', outdoor: 0.45, gravity: 34 },
    levelNames: ['Aeolus Landing', 'Cloudtop Docks', 'Ammonia Gardens', 'Storm Foundry', 'Hydrogen Refinery', 'Gale Bridge', 'Lightning Vault', 'Skyforge Core', 'Red Spot Rim', 'Thunderhead Barracks', 'Pressure Lock', 'Cyclone Spire', 'Windbreaker Dam', 'Tempest Gate', "The Storm Regent's Eye"],
    levelEnvs: ['skybridge', 'skybridge', 'mixed', 'indoor', 'indoor', 'skybridge', 'indoor', 'indoor', 'skybridge', 'mixed', 'indoor', 'skybridge', 'mixed', 'skybridge', 'skybridge'],
    beats: { 1: 'The deck sways. A lightning bolt strikes a skyscraper-sized antenna and the whole city flickers.', 8: 'The Skyforge Core roars. Ten thousand tons of molten steel pour into the clouds below.', 15: 'Inside the eye of the storm, a regent made of weather.' },
    intro: 'Jupiter. A thousand floating forges stitched together by catwalks and thunder. The doomsday engine hums somewhere inside.',
    outro: 'The storm engine dies. Beyond the clouds, rings glitter — Saturn calls.',
  },
  saturn: {
    id: 'saturn', name: 'Saturn', subtitle: 'Titan & the Ring Foundries', css: '#e8d28a', levels: 15, tier: 3,
    blurb: 'Methane seas, crystalline ring shards and a flea market the size of a city. Everything sparkles; most of it bites.',
    situation: 'The Hollow Fleet mines the rings for crystal that amplifies the signal across space. Rumor says a certain air rifle was lost in the Titan bazaar…',
    unlock: 'Complete Jupiter', bossId: 'saturn', music: { root: 43, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 142 },
    theme: { sky: 0x6c6648, fog: 0x2e2a1a, fogFar: 90, wall: 0xbcae7e, wall2: 0x7c7656, floor: 0x7e785c, ceil: 0x4a4630, lamp: 0xfff0b0, ambient: 0.4, wallStyle: 'rock', floorStyle: 'tile', outdoor: 0.45, gravity: 26 },
    levelNames: ['Titan Landing', 'Methane Shores', 'Cassini Station', 'Ring Harvest', 'Shepherd Moon', 'Hyperion Tumble', 'Bazaar of Rust', 'Enceladus Geysers', 'Ring Fracture', 'Prometheus Docks', 'Icefall Citadel', 'Cassini Division', 'Atlas Spindle', 'The Hex Vortex', 'Throne of Rings'],
    levelEnvs: ['outdoor', 'mixed', 'skybridge', 'skybridge', 'skybridge', 'outdoor', 'mixed', 'outdoor', 'skybridge', 'skybridge', 'indoor', 'skybridge', 'indoor', 'skybridge', 'outdoor'],
    beats: { 1: 'Orange haze. Methane rain. Something enormous drifts between the rings.', 7: 'A bazaar stall labeled "Daisy — only slightly used" holds a legendary air rifle…', 15: 'The Ring-Mother sings, and the whole belt sings back.' },
    intro: 'Saturn. Crystal rings spin overhead as the Hollow Fleet strip-mines the sky. Down on Titan, the old bazaar still sells whatever fell from orbit.',
    outro: 'The ring-song fades. A pale blue glow pulses far away — Uranus is waking.',
  },
  uranus: {
    id: 'uranus', name: 'Uranus', subtitle: 'The Sideways Vaults', css: '#7fe3e8', levels: 15, tier: 4,
    blurb: 'A world knocked onto its side, where polar night lasts decades. Crystalline ice vaults hold row after row of sleeping soldiers.',
    situation: "The Hollow Fleet stores its sleeper armies in cryo-vaults beneath the ice. The Cryo-Sovereign is waking them one by one. You'll need to freeze their plans before they thaw.",
    unlock: 'Complete Saturn', bossId: 'uranus', music: { root: 45, scale: [0, 2, 3, 7, 8], bpm: 144 },
    theme: { sky: 0x2c5a6a, fog: 0x10303a, fogFar: 85, wall: 0x92d4e6, wall2: 0x5a8ca0, floor: 0x6aa8b8, ceil: 0x3a6a7a, lamp: 0xc4f6ff, ambient: 0.42, wallStyle: 'ice', floorStyle: 'tile', outdoor: 0.4, gravity: 26 },
    levelNames: ['Sideways Station', 'Aurora Sink', 'Miranda Cliffs', 'Cryo Barracks', 'Ariel Canyons', 'Umbriel Crypt', 'Titania Hall', 'Oberon Vault', 'Diamond Rain', 'Frozen Armory', 'Slumber Halls', 'Ice Lens Observatory', 'Cold Furnace', 'The Long Winter', "Ouranos' Sanctum"],
    levelEnvs: ['skybridge', 'outdoor', 'skybridge', 'indoor', 'outdoor', 'indoor', 'indoor', 'indoor', 'skybridge', 'indoor', 'indoor', 'mixed', 'indoor', 'outdoor', 'indoor'],
    beats: { 1: 'The horizon is vertical. The sun never sets — or rises.', 7: 'Pods in rows, each with a sleeping soldier. Some of the pods are open.', 15: 'The Cryo-Sovereign breathes out. The air turns to glass.' },
    intro: 'Uranus. Planet on its side, armies in its ice. Ptolemy lands in a blizzard that tastes of ammonia and static.',
    outro: 'The vaults shatter. Beyond Neptune, the last dark gate yawns.',
  },
  neptune: {
    id: 'neptune', name: 'Neptune', subtitle: 'Triton Depths & the Vector State Labs', css: '#4b6dff', levels: 15, tier: 5,
    blurb: 'Supersonic winds above, black brine seas below. Triton\'s drowned laboratories hide experiments that bend space itself.',
    situation: 'Triton scientists once built a weapon that warps spacetime — the Vector State Ray. The Drowned Choir sings in the trenches and calls the Hollow Fleet home.',
    unlock: 'Complete Uranus', bossId: 'neptune', music: { root: 36, scale: [0, 2, 3, 5, 6, 8, 9, 11], bpm: 150 },
    theme: { sky: 0x0b2252, fog: 0x061230, fogFar: 80, wall: 0x3a6ab0, wall2: 0x264a80, floor: 0x24467a, ceil: 0x142a52, lamp: 0x80d8ff, ambient: 0.42, wallStyle: 'panel', floorStyle: 'tile', outdoor: 0.35, gravity: 27 },
    levelNames: ['Triton Landing', 'Cryovolcano Pass', 'Nitrogen Flats', 'Drowned Docks', 'Brine Corridors', 'Nereid Lab', 'Great Dark Spot', 'Vector State Labs', 'Pressure Cathedral', 'Trench Gardens', 'Choir Loft', 'Sunken Observatory', 'Abyssal Gate', 'The Singing Deep', "Nerith's Chorus"],
    levelEnvs: ['outdoor', 'outdoor', 'outdoor', 'skybridge', 'indoor', 'indoor', 'skybridge', 'indoor', 'indoor', 'mixed', 'skybridge', 'indoor', 'skybridge', 'indoor', 'outdoor'],
    beats: { 1: 'Geysers of frozen nitrogen. The sky is a bruise.', 8: 'The Vector State Labs: a prototype ray that bends the room around it. Handle with extreme care.', 15: 'A thousand voices become one. The Drowned Choir turns to face you.' },
    intro: 'Neptune. Triton\'s drowned halls echo with a song that was never meant for human ears.',
    outro: 'The song ends. The Dark Gate opens and Pluto is waiting.',
  },
  pluto: {
    id: 'pluto', name: 'Pluto', subtitle: 'The Hollow Capital', css: '#c9a98a', levels: 15, tier: 6,
    blurb: 'A frozen heart-shaped plain at the edge of everything. The sun is just another star. The Hollow Fleet\'s capital rises from the nitrogen ice.',
    situation: 'The source of the Hollowing: the Last Sun-Eater, Hades-Prime. Every monster you met was spawned here. End it where it began.',
    unlock: 'Complete Neptune', bossId: 'pluto', music: { root: 34, scale: [0, 1, 3, 6, 7, 9, 10], bpm: 160 },
    theme: { sky: 0x07050f, fog: 0x0c0818, fogFar: 85, wall: 0x6a5a82, wall2: 0x3e2e56, floor: 0x4e3e64, ceil: 0x2a1e40, lamp: 0xff80f0, ambient: 0.4, wallStyle: 'rock', floorStyle: 'tile', outdoor: 0.35, gravity: 20 },
    levelNames: ["Charon's Ferry", 'Nitrogen Glacier', 'Tombaugh Heartlands', 'Sputnik Planitia', 'Wright Mons', 'Cthulhu Macula', 'Kuiper Outpost', 'Frozen Cathedral', 'The Dark Gate', 'Hollow Barracks', 'Tartarus Trench', 'Styx Passage', 'The Last Sun Forge', 'Throne Approach', 'Hades-Prime'],
    levelEnvs: ['mixed', 'outdoor', 'outdoor', 'outdoor', 'outdoor', 'outdoor', 'mixed', 'indoor', 'mixed', 'indoor', 'outdoor', 'indoor', 'indoor', 'mixed', 'outdoor'],
    beats: { 1: 'The sun is a bright star. Your breath fogs and freezes on the visor.', 9: 'The Dark Gate. Everything that ever hunted you came through here.', 15: 'Hades-Prime opens its eyes.' },
    intro: 'Pluto. The edge. Ptolemy steps from Charon\'s ferry onto the heart of a dead world and loads the last cylinder.',
    outro: 'The Last Sun-Eater collapses into a point of light. The signal dies across the Solar System. Ptolemy looks back at a tiny blue dot — somewhere down there, a coal town is waking up.',
  },
};

// ---------------------------------------------------------------- weapons
export type AmmoType = 'inf' | 'pellets' | 'shells' | 'bullets' | 'nails' | 'grenades' | 'cells' | 'rockets' | 'slugs' | 'vector';
export const AMMO_MAX: Record<AmmoType, number> = { inf: 0, pellets: 60, shells: 40, bullets: 300, nails: 240, grenades: 24, cells: 200, rockets: 30, slugs: 20, vector: 8 };
export const AMMO_LABEL: Record<AmmoType, string> = { inf: '∞', pellets: 'Pellets', shells: 'Shells', bullets: 'Rounds', nails: 'Rivets', grenades: 'Grenades', cells: 'Arc Cells', rockets: 'Rockets', slugs: 'Slugs', vector: 'Vector Cells' };
export const AMMO_COLOR: Record<AmmoType, number> = { inf: 0xffffff, pellets: 0xc0c0c8, shells: 0xd04020, bullets: 0xe8c040, nails: 0xe08030, grenades: 0x60c040, cells: 0x40e0ff, rockets: 0xff6020, slugs: 0x90b0ff, vector: 0xd050ff };

export interface WeaponDef { id: string; slot: number; name: string; tagline: string; ammo: AmmoType; css: string; desc: string }
export const WEAPONS: WeaponDef[] = [
  { id: 'revolver', slot: 1, name: 'Huerfano .45', tagline: 'Family heirloom', ammo: 'inf', css: '#e0b060', desc: 'Infinite ammo. Six-shot cylinder with a quick reload. Right-click to fan the hammer.' },
  { id: 'powerline', slot: 2, name: 'Daisy Powerline 880', tagline: 'Pump it. Load it. Regret nothing.', ammo: 'pellets', css: '#ff6a5a', desc: 'R loads a lead pellet (5 s) and pumps the under-lever (3 pumps min = 30% power, +10% per pump, 10 = full). Right-click aims down the iron sights. One-shots most small, medium & large monsters at high pressure.' },
  { id: 'scatter', slot: 3, name: 'Cucharas Scattergun', tagline: 'Pump-action persuasion', ammo: 'shells', css: '#e87a3a', desc: 'Eight-pellet blast. Right-click: double-blast for 16 pellets at a price.' },
  { id: 'chaingun', slot: 4, name: 'Twin Peaks Chaingun', tagline: 'Two peaks, many holes', ammo: 'bullets', css: '#f0d060', desc: 'Barrels spin up as you hold fire. The longer you hold, the faster it shoots.' },
  { id: 'rivet', slot: 5, name: 'Rivet Driver', tagline: 'Industrial strength', ammo: 'nails', css: '#ff9a40', desc: 'Fast-flying rivets from twin pistons. Right-click: stapler burst fires 5 rivets at once.' },
  { id: 'thumper', slot: 6, name: 'Coal-Mine Thumper', tagline: 'Bouncing betty on a stick', ammo: 'grenades', css: '#7ad050', desc: 'Bouncing grenades with a 2 s fuse. Right-click detonates everything in flight.' },
  { id: 'arc', slot: 7, name: 'Aurora Arc', tagline: 'Lightning on tap', ammo: 'cells', css: '#50e8ff', desc: 'Continuous lightning beam that chains between nearby monsters.' },
  { id: 'rocket', slot: 8, name: 'Sunburst Launcher', tagline: 'Four tubes, one sun', ammo: 'rockets', css: '#ff6a30', desc: 'Heavy rockets with big splash. Rocket-jump by firing at your feet.' },
  { id: 'rail', slot: 9, name: 'Piercer Rail Cannon', tagline: 'Slug through everything', ammo: 'slugs', css: '#8aa8ff', desc: 'Charged hitscan slug that pierces every monster in line. Right-click to zoom.' },
  { id: 'vector', slot: 10, name: 'Vector State Ray', tagline: 'Space? Time? Optional.', ammo: 'vector', css: '#e060ff', desc: 'Fires a colossal laser that opens a singularity: time slows, monsters are dragged in, then it collapses. Extremely limited ammo.' },
];
export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

/** Where each weapon can be found: a normal spot and a hidden secret (behind a wall — press E near suspicious walls). */
export const WEAPON_LOCATIONS: { weapon: string; planet: PlanetId; level: number; secret: boolean }[] = [
  { weapon: 'scatter', planet: 'earth', level: 2, secret: false }, { weapon: 'scatter', planet: 'mars', level: 3, secret: true },
  { weapon: 'chaingun', planet: 'earth', level: 6, secret: false }, { weapon: 'chaingun', planet: 'jupiter', level: 2, secret: true },
  { weapon: 'rivet', planet: 'earth', level: 9, secret: false }, { weapon: 'rivet', planet: 'mars', level: 7, secret: true },
  { weapon: 'thumper', planet: 'earth', level: 11, secret: false }, { weapon: 'thumper', planet: 'saturn', level: 2, secret: true },
  { weapon: 'powerline', planet: 'saturn', level: 7, secret: false }, { weapon: 'powerline', planet: 'earth', level: 13, secret: true },
  { weapon: 'arc', planet: 'mars', level: 4, secret: false }, { weapon: 'arc', planet: 'earth', level: 12, secret: true },
  { weapon: 'rocket', planet: 'mars', level: 9, secret: false }, { weapon: 'rocket', planet: 'earth', level: 10, secret: true },
  { weapon: 'rail', planet: 'jupiter', level: 6, secret: false }, { weapon: 'rail', planet: 'mars', level: 13, secret: true },
  { weapon: 'vector', planet: 'neptune', level: 8, secret: false }, { weapon: 'vector', planet: 'saturn', level: 14, secret: true },
];

// ---------------------------------------------------------------- enemies
export type LookKind = 'biped' | 'beast' | 'crawler' | 'floater' | 'golem';
export interface Look { kind: LookKind; color: number; accent: number; glow: number; scale: number; bulk?: number; extras: string[] }
export interface ProjDef { speed: number; dmg: number; color: number; size: number; style: 'orb' | 'bolt' | 'rocket' | 'ice' | 'spike'; count?: number; spread?: number; slow?: boolean; splash?: number }
export interface EnemyDef {
  id: string; name: string; size: 'small' | 'medium' | 'large' | 'boss'; hp: number; speed: number; dmg: number;
  ai: 'melee' | 'shooter' | 'leaper' | 'charger' | 'floater' | 'exploder';
  radius: number; height: number; look: Look; proj?: ProjDef; rate: number; range: number;
  intro: [number, number]; weight: number; blink?: boolean; flying?: boolean; hover?: number; blurb: string;
}
const L = (kind: LookKind, color: number, accent: number, glow: number, scale: number, extras: string[], bulk = 1): Look => ({ kind, color, accent, glow, scale, extras, bulk });

export const ENEMIES: EnemyDef[] = [
  { id: 'hollow', name: 'Hollowed Townie', size: 'medium', hp: 55, speed: 4.6, dmg: 12, ai: 'melee', radius: 0.45, height: 1.8, look: L('biped', 0x6d7a5a, 0x4a3a2a, 0xffcc44, 1, ['hollow', 'pitchfork', 'flannel']), rate: 1.1, range: 2.2, intro: [0, 1], weight: 3, blurb: 'A neighbor with nothing behind the eyes.' },
  { id: 'jackalope', name: 'Horned Jackalope', size: 'small', hp: 28, speed: 8.5, dmg: 10, ai: 'leaper', radius: 0.35, height: 0.9, look: L('beast', 0xb08a5a, 0xe8e0c8, 0xff3030, 0.9, ['antlers', 'ears']), rate: 1.4, range: 8, intro: [0, 2], weight: 2, blurb: 'Colorado folklore, minus the folk.' },
  { id: 'crawler', name: 'Coal Crawler', size: 'small', hp: 20, speed: 7.5, dmg: 6, ai: 'melee', radius: 0.35, height: 0.55, look: L('crawler', 0x1f1f26, 0x3a3340, 0xff7a00, 0.8, []), rate: 0.7, range: 1.8, intro: [0, 3], weight: 2.5, blurb: 'Skittering coal-black swarmers.' },
  { id: 'deputy', name: 'Possessed Deputy', size: 'medium', hp: 75, speed: 4, dmg: 9, ai: 'shooter', radius: 0.45, height: 1.85, look: L('biped', 0x3b4a6b, 0xc9a74a, 0xff2222, 1, ['hat', 'revolverprop', 'coat']), proj: { speed: 40, dmg: 9, color: 0xffee88, size: 0.12, style: 'bolt' }, rate: 1.3, range: 26, intro: [0, 5], weight: 2.2, blurb: 'Still wears the badge. Still carries the sidearm.' },
  { id: 'bull', name: 'Huerfano Bull', size: 'large', hp: 280, speed: 5, dmg: 28, ai: 'charger', radius: 0.95, height: 1.8, look: L('beast', 0x5a3a2a, 0xe8e0c8, 0xff2200, 2, ['horns', 'spikes']), rate: 3, range: 20, intro: [0, 9], weight: 1, blurb: 'Two tons of furious ranch stock.' },
  { id: 'sentry', name: 'Sec-Drone', size: 'small', hp: 38, speed: 5.5, dmg: 8, ai: 'floater', radius: 0.4, height: 0.8, flying: true, hover: 2.2, look: L('floater', 0xc8ccd4, 0x333a44, 0xff3355, 0.8, ['fins']), proj: { speed: 32, dmg: 8, color: 0xff3355, size: 0.14, style: 'bolt' }, rate: 0.95, range: 28, intro: [1, 1], weight: 2.5, blurb: 'Oligarchy security hardware. Polite until it isn\'t.' },
  { id: 'guard', name: 'Oligarch Guard', size: 'medium', hp: 110, speed: 4.4, dmg: 8, ai: 'shooter', radius: 0.5, height: 1.9, look: L('biped', 0xd9d9e0, 0xc0392b, 0xff4466, 1.05, ['helmet', 'shoulders', 'rifle', 'armor']), proj: { speed: 34, dmg: 8, color: 0xff5577, size: 0.13, style: 'bolt', count: 3, spread: 0.07 }, rate: 1.7, range: 30, intro: [1, 3], weight: 2.5, blurb: 'Gold-plated hired muscle.' },
  { id: 'daemon', name: 'Firewall Daemon', size: 'medium', hp: 70, speed: 6, dmg: 10, ai: 'floater', radius: 0.45, height: 1.0, flying: true, hover: 2.4, blink: true, look: L('floater', 0x33ffcc, 0x0b3b3a, 0x66ffee, 1.0, ['rings']), proj: { speed: 24, dmg: 10, color: 0x66ffee, size: 0.2, style: 'orb' }, rate: 1.4, range: 28, intro: [1, 6], weight: 1.8, blurb: 'Security programs that teleport. They don\'t think. They enforce.' },
  { id: 'mech', name: 'Enforcer Mech', size: 'large', hp: 380, speed: 3.8, dmg: 30, ai: 'shooter', radius: 0.9, height: 3.4, look: L('biped', 0x4b5563, 0xf59e0b, 0xff6a00, 1.9, ['cannon', 'shoulders'], 1.6), proj: { speed: 20, dmg: 22, color: 0xff8800, size: 0.3, style: 'rocket', splash: 4 }, rate: 2.4, range: 34, intro: [1, 8], weight: 0.9, blurb: 'Walking rocket artillery. Bring cover.' },
  { id: 'stormwraith', name: 'Storm Wraith', size: 'medium', hp: 95, speed: 6, dmg: 14, ai: 'floater', radius: 0.5, height: 1.2, flying: true, hover: 2.6, look: L('floater', 0x5a6bb0, 0xe0e8ff, 0xbbd4ff, 1.2, ['tentacles']), proj: { speed: 46, dmg: 14, color: 0xbbd4ff, size: 0.16, style: 'bolt' }, rate: 1.1, range: 30, intro: [2, 1], weight: 2.5, blurb: 'A scrap of lightning that remembers being a person.' },
  { id: 'gasbag', name: 'Gasbag', size: 'medium', hp: 60, speed: 4.5, dmg: 30, ai: 'exploder', radius: 0.7, height: 1.4, flying: true, hover: 2, look: L('floater', 0xd9a066, 0xa0522d, 0xffcc66, 1.4, ['spots']), rate: 1, range: 3, intro: [2, 4], weight: 1.8, blurb: 'Bloated with volatile gas. Pop it from far away.' },
  { id: 'shard', name: 'Ring Shard', size: 'medium', hp: 140, speed: 4.8, dmg: 12, ai: 'shooter', radius: 0.55, height: 1.9, look: L('golem', 0x8fa4b8, 0xe0f4ff, 0x66ddff, 1, []), proj: { speed: 30, dmg: 12, color: 0xcfe8ff, size: 0.14, style: 'spike', count: 2, spread: 0.035 }, rate: 1.6, range: 26, intro: [3, 1], weight: 2.4, blurb: 'Animated ring crystal that throws its own shards.' },
  { id: 'titan', name: 'Ring Colossus', size: 'large', hp: 450, speed: 4.2, dmg: 35, ai: 'charger', radius: 1.0, height: 3.6, look: L('golem', 0x7c8ea2, 0xd8f0ff, 0x44ccff, 2.2, []), rate: 3.2, range: 22, intro: [3, 9], weight: 0.9, blurb: 'A mountain of crystal learning to run.' },
  { id: 'frost', name: 'Frost Revenant', size: 'medium', hp: 150, speed: 4.4, dmg: 10, ai: 'shooter', radius: 0.5, height: 2.0, look: L('biped', 0x9fd8e8, 0xffffff, 0x66e0ff, 1.1, ['ice', 'shardstaff']), proj: { speed: 26, dmg: 10, color: 0x99eeff, size: 0.2, style: 'ice', slow: true }, rate: 1.5, range: 28, intro: [4, 1], weight: 2.4, blurb: 'Its bolts slow you down.' },
  { id: 'tilter', name: 'Sideways Stalker', size: 'medium', hp: 120, speed: 9.5, dmg: 18, ai: 'leaper', radius: 0.5, height: 1.2, look: L('beast', 0x3a6ea5, 0xb0f0ff, 0x00ffff, 1.2, ['spikes']), rate: 1.2, range: 9, intro: [4, 4], weight: 2, blurb: 'Gravity is optional for this one.' },
  { id: 'lurker', name: 'Abyssal Lurker', size: 'large', hp: 320, speed: 6, dmg: 30, ai: 'leaper', radius: 1.1, height: 1.4, look: L('crawler', 0x0a2a4a, 0x00ffd5, 0x00ffd5, 2.4, []), rate: 1.8, range: 12, intro: [5, 4], weight: 1.0, blurb: 'Something big crawled out of the trench.' },
  { id: 'siren', name: 'Brine Siren', size: 'medium', hp: 130, speed: 5.5, dmg: 9, ai: 'floater', radius: 0.5, height: 1.4, flying: true, hover: 2.5, blink: true, look: L('floater', 0x1b4f8a, 0xa0e8ff, 0x99ffff, 1.3, ['tentacles']), proj: { speed: 22, dmg: 9, color: 0x66ccff, size: 0.18, style: 'orb', count: 3, spread: 0.22 }, rate: 1.8, range: 30, intro: [5, 4], weight: 2, blurb: 'Her song is a scatter of sonic bolts.' },
  { id: 'knight', name: 'Kuiper Knight', size: 'large', hp: 480, speed: 4.6, dmg: 14, ai: 'shooter', radius: 0.9, height: 3.6, look: L('biped', 0x2b2d42, 0x8d99ae, 0xff3df0, 1.9, ['helmet', 'shoulders', 'cape', 'spear'], 1.5), proj: { speed: 34, dmg: 14, color: 0xff3df0, size: 0.16, style: 'bolt', count: 3, spread: 0.12 }, rate: 1.8, range: 34, intro: [6, 6], weight: 1.2, blurb: 'Sentinel of the Hollow Capital.' },
  { id: 'voidhound', name: 'Void Hound', size: 'medium', hp: 160, speed: 10.5, dmg: 20, ai: 'leaper', radius: 0.55, height: 1.3, blink: true, look: L('beast', 0x120f1f, 0x7f3dff, 0xbf5fff, 1.3, ['spikes', 'horns']), rate: 1.1, range: 10, intro: [6, 3], weight: 2, blurb: 'Hunts by blinking through the dark.' },
  // ---- Jupiter natives
  { id: 'deckhand', name: 'Hollowed Deckhand', size: 'medium', hp: 80, speed: 4.6, dmg: 12, ai: 'melee', radius: 0.45, height: 1.85, look: L('biped', 0x7a5a30, 0xf0c060, 0xffe9a0, 1, ['hollow', 'helmet', 'wrench', 'hazsuit']), rate: 1.1, range: 2.2, intro: [2, 1], weight: 3, blurb: 'A refinery worker with a storm where the mind used to be.' },
  { id: 'cinder', name: 'Cinder Mite', size: 'small', hp: 26, speed: 8, dmg: 7, ai: 'melee', radius: 0.35, height: 0.55, look: L('crawler', 0x3a2014, 0xff7a20, 0xffb040, 0.8, []), rate: 0.7, range: 1.8, intro: [2, 2], weight: 2.5, blurb: 'Slag that learned to skitter.' },
  { id: 'galegunner', name: 'Gale Gunner', size: 'medium', hp: 120, speed: 4.2, dmg: 9, ai: 'shooter', radius: 0.5, height: 1.9, look: L('biped', 0x5a4028, 0xe8c070, 0xfef08a, 1.05, ['helmet', 'shoulders', 'longrifle', 'cloak']), proj: { speed: 40, dmg: 9, color: 0xfef08a, size: 0.13, style: 'bolt', count: 2, spread: 0.05 }, rate: 1.5, range: 30, intro: [2, 6], weight: 2.2, blurb: 'Oligarch mercenary, now storm-touched.' },
  { id: 'thunderhulk', name: 'Thunderhulk', size: 'large', hp: 420, speed: 4.4, dmg: 32, ai: 'charger', radius: 1.0, height: 3.2, look: L('biped', 0x4a3a60, 0xc0d0ff, 0xbbd4ff, 1.8, ['shoulders', 'spikes'], 1.7), rate: 3, range: 20, intro: [2, 9], weight: 0.9, blurb: 'A walking thunderhead with fists.' },
  // ---- Saturn natives
  { id: 'ringhopper', name: 'Ring Hopper', size: 'small', hp: 34, speed: 9, dmg: 10, ai: 'leaper', radius: 0.35, height: 0.9, look: L('beast', 0xa8b8c8, 0xe0f4ff, 0x66ddff, 0.9, ['ears', 'spikes']), rate: 1.3, range: 8, intro: [3, 2], weight: 2.2, blurb: 'Crystal-backed vermin from the ring quarries.' },
  { id: 'bandit', name: 'Bazaar Bandit', size: 'medium', hp: 95, speed: 4.6, dmg: 9, ai: 'shooter', radius: 0.45, height: 1.85, look: L('biped', 0x6a5a3a, 0xc8a050, 0xffd080, 1, ['hat', 'carbine', 'scarf', 'robe']), proj: { speed: 38, dmg: 9, color: 0xffd080, size: 0.12, style: 'bolt' }, rate: 1.3, range: 28, intro: [3, 4], weight: 2.4, blurb: 'Sells what fell from orbit. Shoots first.' },
  { id: 'crystalhusk', name: 'Crystal Husk', size: 'medium', hp: 110, speed: 4.4, dmg: 13, ai: 'melee', radius: 0.5, height: 1.9, look: L('biped', 0x8fa4b8, 0xe0f4ff, 0x66ddff, 1.05, ['hollow', 'ice', 'crystalarm']), rate: 1.1, range: 2.3, intro: [3, 6], weight: 2.4, blurb: 'A miner grown over with ring crystal.' },
  // ---- Uranus natives
  { id: 'sleeper', name: 'Cryo Sleeper', size: 'medium', hp: 90, speed: 4.4, dmg: 12, ai: 'melee', radius: 0.45, height: 1.85, look: L('biped', 0x9fd8e8, 0x3a6a7a, 0x66e0ff, 1, ['hollow', 'helmet', 'iceaxe', 'cryotank']), rate: 1.1, range: 2.2, intro: [4, 2], weight: 3, blurb: 'A thawed soldier, still half-dreaming.' },
  { id: 'icemite', name: 'Ice Mite', size: 'small', hp: 28, speed: 8, dmg: 7, ai: 'melee', radius: 0.35, height: 0.55, look: L('crawler', 0xbfe8f0, 0xffffff, 0x99eeff, 0.8, []), rate: 0.7, range: 1.8, intro: [4, 5], weight: 2.4, blurb: 'Skitters out of the vault vents.' },
  { id: 'glacierbrute', name: 'Glacier Brute', size: 'large', hp: 400, speed: 4.2, dmg: 30, ai: 'charger', radius: 1.0, height: 3.3, look: L('golem', 0x7fb8c8, 0xe8ffff, 0x66e0ff, 2.0, []), rate: 3.2, range: 20, intro: [4, 9], weight: 0.9, blurb: 'A cryo-vault door that got up and walked.' },
  // ---- Neptune natives
  { id: 'drowned', name: 'Drowned Sailor', size: 'medium', hp: 95, speed: 4.6, dmg: 12, ai: 'melee', radius: 0.45, height: 1.85, look: L('biped', 0x1b4f8a, 0x66ffee, 0x99ffff, 1, ['hollow', 'harpoon', 'diver']), rate: 1.1, range: 2.2, intro: [5, 1], weight: 3, blurb: 'Still humming the song that pulled it under.' },
  { id: 'brinecrab', name: 'Brine Crab', size: 'medium', hp: 120, speed: 5, dmg: 10, ai: 'shooter', radius: 0.55, height: 0.9, look: L('crawler', 0x24467a, 0x80d8ff, 0x99ffff, 1.4, []), proj: { speed: 28, dmg: 10, color: 0x99ffff, size: 0.14, style: 'spike', count: 2, spread: 0.06 }, rate: 1.6, range: 24, intro: [5, 6], weight: 2.2, blurb: 'Spits pressure-hardened brine darts.' },
  { id: 'choirvoid', name: 'Choir Mouth', size: 'medium', hp: 110, speed: 5.5, dmg: 11, ai: 'floater', radius: 0.5, height: 1.2, flying: true, hover: 2.5, look: L('floater', 0x0b2252, 0x66ffee, 0x99ffff, 1.2, ['rings']), proj: { speed: 26, dmg: 11, color: 0x66ffee, size: 0.2, style: 'orb' }, rate: 1.4, range: 28, intro: [5, 9], weight: 1.8, blurb: 'One note of the Drowned Choir, given teeth.' },
  // ---- Pluto natives
  { id: 'hollowprime', name: 'Hollow Prime', size: 'medium', hp: 130, speed: 4.8, dmg: 15, ai: 'melee', radius: 0.48, height: 1.9, look: L('biped', 0x2a1e40, 0x7c3aed, 0xff3df0, 1.05, ['hollow', 'spikes', 'scythe']), rate: 1.0, range: 2.3, intro: [6, 1], weight: 3, blurb: 'The original hollowing, perfected.' },
  { id: 'eyeofhades', name: 'Eye of Hades', size: 'medium', hp: 120, speed: 5.5, dmg: 11, ai: 'floater', radius: 0.5, height: 1.2, flying: true, hover: 2.6, look: L('floater', 0x0b0b14, 0xff3df0, 0xff3df0, 1.2, ['rings']), proj: { speed: 30, dmg: 11, color: 0xff3df0, size: 0.18, style: 'orb' }, rate: 1.3, range: 30, intro: [6, 2], weight: 2, blurb: 'It watches for the Sun-Eater.' },
  { id: 'kuiperwolf', name: 'Kuiper Wolf', size: 'small', hp: 40, speed: 9.5, dmg: 10, ai: 'leaper', radius: 0.38, height: 0.9, look: L('beast', 0x1a1428, 0x7c3aed, 0xbf5fff, 0.95, ['ears']), rate: 1.3, range: 8, intro: [6, 4], weight: 2.2, blurb: 'Runs in packs across the nitrogen ice.' },
];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

export interface BossDef { id: string; name: string; title: string; hp: number; dmg: number; look: Look; color: number; radius: number; height: number; summon: string[]; speed: number; flying?: boolean; taunts: string[] }

/** The Earth boss is a randomly chosen Colorado politician. These are fictional — edit freely, add your own family-approved villains! */
export const POLITICIANS: string[] = [
  'Senator Buck Ptarmigan', 'Governor Rhett Aspenwood', 'Congresswoman Lorraine Fourteener', 'Lt. Governor Chip Sangre-DeCristo',
  'Commissioner Marge Cucharas', 'Mayor Tad Trinidad', 'State Rep. Dale Pikes-Peak', 'Sheriff-Elect Wyatt Raton',
  'Treasurer Gladys Gunnison', 'Senator Cornelius Cottonwood',
];

export const BOSSES: Record<string, BossDef> = {
  earth: { id: 'earth', name: 'Senator Buck Ptarmigan', title: 'Mastermind of the Hollowing', hp: 2600, dmg: 14, look: L('biped', 0x1b2a49, 0xb91c1c, 0xff2222, 2.5, ['tie', 'hair', 'aura'], 1.3), color: 0xff3030, radius: 1.3, height: 4.6, summon: ['hollow', 'deputy', 'jackalope'], speed: 4.4, taunts: ['"I\'ve been in office for forty years. You think you can vote me out?"', '"Read the fine print, Ptolemy!"', '"Constituents! To me!"'] },
  mars: { id: 'mars', name: 'Elron Muskov', title: 'Emperor of Mars (parody edition)', hp: 4200, dmg: 16, look: L('biped', 0xd1d5db, 0x111827, 0x38bdf8, 2.8, ['helmet', 'jets', 'cannon', 'shoulders', 'aura'], 1.7), color: 0x38bdf8, radius: 1.5, height: 5, summon: ['guard', 'sentry', 'daemon'], speed: 4.2, taunts: ['"Technically, the air belongs to me."', '"Sign the user agreement."', '"Deploy the Cybercrawlers!"'] },
  jupiter: { id: 'jupiter', name: 'Tempest Regent Zephyrion', title: 'Lord of the Storm Decks', hp: 5200, dmg: 18, look: L('floater', 0xb45309, 0xfde68a, 0xfef08a, 4, ['tentacles', 'rings', 'aura', 'spots']), color: 0xfef08a, radius: 1.8, height: 4, summon: ['stormwraith', 'gasbag', 'sentry'], speed: 4.8, flying: true, taunts: ['"Thunder answers to me!"', '"Weather the storm, little one."'] },
  saturn: { id: 'saturn', name: 'Ring-Mother Cassine', title: 'Matriarch of the Ring Crystals', hp: 6200, dmg: 18, look: L('golem', 0x9aa9bd, 0xe0f4ff, 0x66ddff, 3.6, ['ring', 'aura']), color: 0x66ddff, radius: 1.8, height: 6.5, summon: ['shard', 'titan'], speed: 3.8, taunts: ['"Sing with me."', '"The rings remember everything."'] },
  uranus: { id: 'uranus', name: 'Cryo-Sovereign Ouranos', title: 'King of the Long Winter', hp: 7000, dmg: 20, look: L('biped', 0x9fd8e8, 0xffffff, 0x66e0ff, 3, ['ice', 'crown', 'cape', 'aura'], 1.5), color: 0x66e0ff, radius: 1.5, height: 5.6, summon: ['frost', 'tilter'], speed: 4.4, taunts: ['"Be still. Be cold. Be mine."', '"Winter lasts forty-two years here."'] },
  neptune: { id: 'neptune', name: 'Nerith, the Drowned Choir', title: 'A Thousand Voices as One', hp: 8000, dmg: 20, look: L('floater', 0x1b4f8a, 0x66ffee, 0x99ffff, 4.2, ['tentacles', 'aura', 'rings']), color: 0x66ffee, radius: 2, height: 5, summon: ['siren', 'lurker'], speed: 5, flying: true, taunts: ['"Join the choir."', '"Down. Down. Down."'] },
  pluto: { id: 'pluto', name: 'Hades-Prime', title: 'The Last Sun-Eater', hp: 12000, dmg: 24, look: L('biped', 0x0b0b14, 0x7c3aed, 0xff3df0, 3.4, ['crown', 'cape', 'shoulders', 'aura', 'cannon'], 1.7), color: 0xff3df0, radius: 1.8, height: 6.2, summon: ['knight', 'voidhound', 'siren'], speed: 4.8, taunts: ['"I ate your sun."', '"All roads lead to Pluto."', '"Hollow. Be. Hollow."'] },
  moon: { id: 'moon', name: 'The Lunar Warden', title: 'Keeper of the Gauntlet', hp: 9000, dmg: 26, look: L('biped', 0xb8bcc8, 0x20222c, 0xffffff, 3, ['helmet', 'shoulders', 'jets', 'aura', 'cannon'], 1.8), color: 0xdff0ff, radius: 1.6, height: 5.6, summon: ['knight', 'mech', 'titan', 'voidhound'], speed: 5.2, taunts: ['"Trial five. No retries."', '"Many have entered…"'] },
};
