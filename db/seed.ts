import {
  db,
  User,
  Character,
  NPC,
  Location,
  DiaryEntry,
  DiaryNote,
  Quest,
  Faction,
  LibraryEntry,
  TimelineEntry,
  Event,
  CampaignProgress,
  PageSettings,
  InitiativeTracker,
  CombatState,
  DMScreenState,
  Playlist,
} from '../src/db';
import { hashPassword } from '../src/lib/auth';

// Seeds an empty development database (npm run db:dev, sudo arandor-dev-reseed) with demo
// data for every table, so every page and component has something to show.
// Logins: admin/admin, dm/dm123, player1/player1, player2/player2.
// Images live in public/demo/.

const DAY = 24 * 60 * 60 * 1000;
const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY);
const img = (name: string) => `/demo/${name}.svg`;

export default async function seed() {
  // Only seed an empty database.
  const existingUsers = await db.select().from(User).limit(1);
  if (existingUsers.length > 0) {
    console.log('Database already seeded - skipping seed to preserve existing data');
    return;
  }

  console.log('Database is empty - seeding initial data...');

  // ── Users ────────────────────────────────────────────────────────────────
  await db.insert(User).values([
    { id: '1', username: 'admin', passwordHash: await hashPassword('admin'), role: 'admin', firstName: 'Alex', profileImageUrl: img('portrait-sage'), characterIds: [], favoritePages: ['/diary', '/tools/initiative', '/map'] },
    { id: '2', username: 'player1', passwordHash: await hashPassword('player1'), role: 'player', firstName: 'Sam', profileImageUrl: img('portrait-dwarf'), characterIds: ['1'], favoritePages: ['/characters', '/diary'] },
    { id: '3', username: 'dm', passwordHash: await hashPassword('dm123'), role: 'dungeonmaster', firstName: 'Bob', profileImageUrl: img('portrait-innkeeper'), characterIds: [], favoritePages: ['/tools/dm-screen', '/tools/initiative', '/npcs'] },
    { id: '4', username: 'player2', passwordHash: await hashPassword('player2'), role: 'player', firstName: 'Kim', profileImageUrl: img('portrait-elf'), characterIds: ['2', '3'], favoritePages: [] },
  ]);

  // ── Characters (HP states: full, wounded, critical, down, temp HP, inactive) ─
  const stats = (str: number, dex: number, con: number, int: number, wis: number, cha: number) => ({
    strength: str, dexterity: dex, constitution: con, intelligence: int, wisdom: wis, charisma: cha,
  });
  await db.insert(Character).values([
    { id: '1', name: 'Thorin Ironforge', class: 'Fighter', level: 6, race: 'Dwarf', player: 'Sam', userId: '2', avatarUrl: img('portrait-dwarf'), stats: stats(17, 12, 16, 10, 12, 8), hp: 58, maxHp: 58, gender: 'Male', alignment: 'Lawful Good', background: 'Soldier', age: 142, height: "4'5\"", weight: 180, eyes: 'Grey', skin: 'Ruddy', hair: 'Copper' },
    { id: '2', name: 'Elara Moonwhisper', class: 'Wizard', level: 6, race: 'Elf', player: 'Kim', userId: '4', avatarUrl: img('portrait-elf'), stats: stats(8, 15, 13, 18, 13, 11), hp: 22, maxHp: 38, tempHp: 5, alignment: 'Neutral Good', background: 'Sage' },
    { id: '3', name: 'Vex Shadowstep', class: 'Rogue', level: 5, race: 'Tiefling', player: 'Kim', userId: '4', avatarUrl: img('portrait-rogue'), stats: stats(10, 18, 12, 13, 11, 15), hp: 7, maxHp: 36, alignment: 'Chaotic Neutral', background: 'Criminal' },
    { id: '4', name: 'Brother Aldric', class: 'Cleric', level: 6, race: 'Human', player: 'Alex', userId: '1', avatarUrl: img('portrait-cleric'), stats: stats(14, 10, 14, 11, 17, 13), hp: 0, maxHp: 45, deathSaveSuccesses: 1, deathSaveFailures: 1, alignment: 'Lawful Good', background: 'Acolyte' },
    { id: '5', name: 'Seraphine Dawnblade', class: 'Paladin', level: 6, race: 'Aasimar', player: 'Guest', avatarUrl: img('portrait-paladin'), stats: stats(16, 10, 14, 9, 12, 16), hp: 49, maxHp: 52 },
    { id: '6', name: 'Old Pip', class: 'Bard', level: 3, race: 'Halfling', player: 'Retired', isActive: false, stats: stats(8, 14, 12, 12, 10, 16), hp: 20, maxHp: 20 },
  ]);

  // ── Locations (all types; visited + not; some on the map) ────────────────
  await db.insert(Location).values([
    { id: '1', name: 'Waterdeep', type: 'city', region: 'Sword Coast', visited: true, imageUrl: img('scene-city'), description: 'The City of Splendors, a bustling metropolis of trade, intrigue and adventure.', notes: 'Our home base. The **Yawning Portal** is the place to find work.', mapX: 42, mapY: 55, visibleOnMap: true },
    { id: '2', name: 'Ancient Ruins', type: 'dungeon', region: 'Waterdeep Undermountain', visited: true, imageUrl: img('scene-dungeon'), description: 'Mysterious ruins beneath Waterdeep, origin unknown. Goblins nest in the upper halls.', mapX: 45, mapY: 60, visibleOnMap: true },
    { id: '3', name: 'Neverwinter Wood', type: 'wilderness', region: 'Sword Coast North', visited: true, imageUrl: img('scene-forest'), description: 'An ancient forest where the trees whisper and the fey keep old grudges.', mapX: 38, mapY: 30, visibleOnMap: true },
    { id: '4', name: 'The Yawning Portal', type: 'building', region: 'Waterdeep', visited: true, description: 'A famous tavern built around the entrance to Undermountain.', mapX: 43, mapY: 56, visibleOnMap: false },
    { id: '5', name: 'Frostfell Pass', type: 'wilderness', region: 'Spine of the World', visited: false, imageUrl: img('scene-ice'), description: 'A treacherous mountain pass, snowed in for most of the year.', mapX: 55, mapY: 12, visibleOnMap: true },
    { id: '6', name: 'Sunscorch Dunes', type: 'wilderness', region: 'Calimshan', visited: false, imageUrl: img('scene-desert'), description: 'Endless dunes hiding the tombs of genie-lords.' },
    { id: '7', name: 'Mirewatch', type: 'other', region: 'Mere of Dead Men', visited: true, imageUrl: img('scene-swamp'), description: 'A stilted village in the swamp, half sunk and wholly suspicious.', mapX: 30, mapY: 45, visibleOnMap: true },
  ]);

  // ── NPCs (allies, neutrals, enemies; with and without portraits) ─────────
  await db.insert(NPC).values([
    { id: '1', name: 'Lord Neverember', race: 'Human', occupation: 'Noble', locationId: '1', relationship: 'neutral', avatarUrl: img('portrait-noble'), description: 'Former Open Lord of Waterdeep, wealthy and influential. Pays well, asks questions later.' },
    { id: '2', name: 'Durnan', race: 'Human', occupation: 'Innkeeper', locationId: '4', relationship: 'ally', avatarUrl: img('portrait-innkeeper'), description: 'Owner of the Yawning Portal. Retired adventurer with a sword behind the bar.' },
    { id: '3', name: 'Grimwald', race: 'Gnome', occupation: 'Merchant', locationId: '1', relationship: 'ally', avatarUrl: img('portrait-merchant'), description: 'Trader of curios. Went missing near the docks.' },
    { id: '4', name: 'Xanathar', race: 'Beholder', occupation: 'Crime lord', locationId: '2', relationship: 'enemy', avatarUrl: img('portrait-villain'), description: 'Paranoid crime lord of the sewers. Owns a goldfish named Sylgar.' },
    { id: '5', name: 'Mirt the Moneylender', race: 'Human', occupation: 'Lord', locationId: '1', relationship: 'neutral', description: 'Rotund, jovial and far more dangerous than he looks.' },
    { id: '6', name: 'Lady Morwen', race: 'Half-Elf', occupation: 'Archivist', locationId: '7', relationship: 'ally', avatarUrl: img('portrait-sage'), description: 'Keeper of the drowned archive of Mirewatch.' },
    { id: '7', name: 'Skrag', race: 'Goblin', occupation: 'Boss', locationId: '2', relationship: 'enemy', description: 'Self-proclaimed king of the upper ruins. Wears a teapot as a crown.' },
  ]);

  // ── Quests (statuses × priorities) ───────────────────────────────────────
  await db.insert(Quest).values([
    { id: '1', title: 'Investigate the Ruins', description: 'Explore the ancient ruins beneath Waterdeep and report findings to Lord Neverember.', status: 'active', priority: 'high' },
    { id: '2', title: 'Find the Missing Merchant', description: 'Locate Grimwald, a merchant who disappeared near the docks.', status: 'active', priority: 'medium' },
    { id: '3', title: 'The Drowned Archive', description: 'Recover the lost ledger from the flooded archive of Mirewatch for Lady Morwen.', status: 'active', priority: 'low' },
    { id: '4', title: 'Clear the Goblin Den', description: 'Drive Skrag and his goblins out of the upper ruins.', status: 'completed', priority: 'high' },
    { id: '5', title: 'Escort the Caravan', description: 'Protect the spice caravan through Neverwinter Wood.', status: 'failed', priority: 'medium' },
  ]);

  // ── Factions (all standings) ─────────────────────────────────────────────
  await db.insert(Faction).values([
    { id: '1', name: 'Xanathar Guild', status: 'enemy', progress: 10 },
    { id: '2', name: 'Zhentarim', status: 'suspicious', progress: 35 },
    { id: '3', name: 'City Watch', status: 'neutral', progress: 50 },
    { id: '4', name: 'Harpers', status: 'friendly', progress: 70 },
    { id: '5', name: 'Order of the Gauntlet', status: 'respectful', progress: 90 },
  ]);

  // ── Diary (sessions with covers, gallery, links to everything) ───────────
  await db.insert(DiaryEntry).values([
    { id: '1', session: 1, date: '2026-07-04', title: 'The Journey Begins', tags: ['introduction', 'waterdeep'], coverImageUrl: img('scene-city'),
      summary: 'The party meets at the Yawning Portal and takes a job from Lord Neverember.',
      content: 'Our party assembled at the **Yawning Portal** in Waterdeep. Durnan pointed us to a well-dressed stranger: Lord Neverember himself.\n\n## The job\nStrange lights in the ruins below the city. 500 gold to find out why.',
      npcIds: ['1', '2'], locationIds: ['1', '4'], characterIds: ['1', '2', '3', '4'], questIds: ['1'], createdAt: at(-104) },
    { id: '2', session: 2, date: '2026-07-18', title: 'Goblins and Teapots', tags: ['combat', 'ruins'], coverImageUrl: img('scene-dungeon'),
      summary: 'A goblin ambush in the upper ruins ends with Skrag fleeing, teapot and all.',
      content: 'Descended into the ancient ruins. **Skrag** and his goblins ambushed us at the old well.\n\n- Thorin held the bridge\n- Vex stole the teapot crown (it is now a teapot again)',
      npcIds: ['7'], locationIds: ['2'], characterIds: ['1', '2', '3', '4'], questIds: ['1', '4'], createdAt: at(-90) },
    { id: '3', session: 3, date: '2026-08-01', title: 'Whispers in the Wood', tags: ['travel', 'fey'], coverImageUrl: img('scene-forest'), galleryUrls: [img('scene-forest'), img('scene-swamp')],
      content: 'The caravan job went badly. Something in Neverwinter Wood did not want the spices to arrive, and it got its way.',
      locationIds: ['3'], characterIds: ['1', '2', '5'], questIds: ['5'], createdAt: at(-76) },
    { id: '4', session: 4, date: '2026-08-15', title: 'Into the Ruins', tags: ['discovery', 'ruins'], coverImageUrl: img('campfire'),
      summary: 'Deeper ruins, a mysterious amulet, and a campfire conversation nobody will forget.',
      content: 'Descended into the ancient ruins beneath the city. Encountered goblins and found a mysterious amulet with strange runes.\n\nAround the campfire Elara deciphered part of the inscription: *"the drowned will remember"*.',
      npcIds: ['1'], locationIds: ['2'], characterIds: ['1', '2', '3', '4', '5'], questIds: ['1'], createdAt: at(-62) },
    { id: '5', session: 5, date: '2026-09-26', title: 'The Mire Remembers', tags: ['swamp', 'mystery'], coverImageUrl: img('scene-swamp'),
      summary: 'Mirewatch, Lady Morwen and the drowned archive. The amulet hums when water is near.',
      content: 'We followed the amulet\'s hint to **Mirewatch**. Lady Morwen recognised the runes and asked for our help with the drowned archive.\n\nBrother Aldric fell to a bog hag\'s curse and is still fighting for his life.',
      npcIds: ['6'], locationIds: ['7'], characterIds: ['1', '2', '3', '4', '5'], questIds: ['3'], createdAt: at(-20) },
  ]);

  await db.insert(DiaryNote).values([
    { id: '1', diaryEntryId: '5', userId: '2', content: 'Remember: the hag said "three nights". Check the calendar!' },
  ]);

  // ── Library (markdown, tags, linked locations) ───────────────────────────
  await db.insert(LibraryEntry).values([
    { id: '1', title: 'The Runes of the Drowned', tags: ['docs', 'lore', 'magic'], locationId: '7', questIds: ['3'], content: '# The Runes of the Drowned\n\nAn old script used by the archivists of Mirewatch.\n\n| Rune | Meaning |\n|---|---|\n| ᚱ | water |\n| ᛗ | memory |\n\n> "The drowned will remember."' },
    { id: '2', title: 'A Short History of Waterdeep', tags: ['docs', 'history'], locationId: '1', questIds: ['1'], content: 'Founded as a trading post, Waterdeep grew into the **City of Splendors**. Its Masked Lords rule in secret.' },
    { id: '3', title: 'Bestiary: Bog Hag', tags: ['bestiary'], content: 'Bog hags curse those who trespass. *Cure: holy water and an honest apology.*' },
    { id: '4', title: 'House Rules', tags: ['rules'], content: '1. Critical hits: max damage + roll.\n2. Potions are a bonus action.\n3. Snacks are mandatory.' },
  ]);

  // ── Timeline (events and dividers) ───────────────────────────────────────
  await db.insert(TimelineEntry).values([
    { id: '1', entryType: 'event', year: 1203, month: 3, sortOrder: 1, headline: 'The Archive Floods', shortDescription: 'Mirewatch\'s great archive sinks into the swamp.', fullDescription: 'Nobody knows **why** the dams broke.', imageUrl: img('scene-swamp'), locationIds: ['7'], libraryDocsEntryIds: ['1'] },
    { id: '2', entryType: 'label', year: 1250, sortOrder: 2, label: 'Two centuries later' },
    { id: '3', entryType: 'event', year: 1491, month: 7, sortOrder: 3, headline: 'Ex Arena is formed', shortDescription: 'The party meets at the Yawning Portal.', diaryEntryIds: ['1'], characterIds: ['1', '2', '3', '4'], locationIds: ['4'] },
    { id: '4', entryType: 'event', year: 1491, month: 8, sortOrder: 4, headline: 'The amulet is found', shortDescription: 'Deep in the ruins, the party finds a humming amulet.', diaryEntryIds: ['4'], questIds: ['1'], locationIds: ['2'] },
  ]);

  // ── Calendar (one past, the next session, one later) ─────────────────────
  await db.insert(Event).values([
    { id: '1', title: 'Session: The Mire Remembers', description: 'Session 5.', date: isoDate(-20), time: '19:00', duration: 240, hostId: '3' },
    { id: '2', title: 'Session: Into the Drowned Archive', description: 'The party dives into the flooded archive of Mirewatch.', date: isoDate(3), time: '19:00', duration: 240, hostId: '3' },
    { id: '3', title: 'One-shot: Goblin Tea Party', description: 'A silly side adventure starring Skrag.', date: isoDate(17), time: '18:30', duration: 180, hostId: '1' },
  ]);

  // ── Campaign progress and page banners ───────────────────────────────────
  await db.insert(CampaignProgress).values([
    { id: '1', currentLevel: 6, progressPercent: 60, heroImageUrl: img('hero') },
  ]);
  const banners: Record<string, string> = {
    diary: 'campfire', characters: 'scene-city', npcs: 'scene-swamp', locations: 'scene-forest', quests: 'scene-desert',
    library: 'scene-ice', 'library-docs': 'scene-ice', tools: 'scene-dungeon', 'dice-roller': 'scene-dungeon', calendar: 'scene-city',
  };
  await db.insert(PageSettings).values(
    Object.entries(banners).map(([pageName, image], i) => ({ id: String(i + 1), pageName, heroImageUrl: img(image) }))
  );

  // ── Combat in progress (initiative tracker + dashboard "Combat Active") ──
  await db.insert(InitiativeTracker).values([
    { id: '1', name: 'Thorin Ironforge', initiative: 19, type: 'character', characterId: '1', hp: 58, maxHp: 58, ac: 18 },
    { id: '2', name: 'Bog Hag', initiative: 17, type: 'monster', hp: 31, maxHp: 65, ac: 17, notes: 'Cursed Aldric. Vulnerable to radiant?' },
    { id: '3', name: 'Elara Moonwhisper', initiative: 15, type: 'character', characterId: '2', hp: 22, maxHp: 38, tempHp: 5, ac: 13 },
    { id: '4', name: 'Lady Morwen', initiative: 12, type: 'npc', hp: 27, maxHp: 27, ac: 12 },
    { id: '5', name: 'Brother Aldric', initiative: 8, type: 'character', characterId: '4', hp: 0, maxHp: 45, ac: 16, deathSaveSuccesses: 1, deathSaveFailures: 1 },
  ]);
  await db.insert(CombatState).values([{ id: 'current-combat', currentRound: 3, currentTurnIndex: 1, status: 'active' }]);

  await db.insert(DMScreenState).values([
    { id: 'current-dm-screen', currentLocationId: '7', spotlightNpcIds: ['6', '4'], customAssets: [], showInitiativeTracker: true, screenVisible: true, placeholderImageUrl: img('hero') },
  ]);

  // ── Music: the site playlist (filled by the admin) ───────────────────────
  await db.insert(Playlist).values([
    { id: 'site-tavern-music', ownerId: '1', name: 'Tavern music', visibility: 'public', isSiteDefault: true },
  ]);

  console.log('Database seeded successfully!');
}

await seed();
