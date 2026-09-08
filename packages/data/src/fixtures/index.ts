import {
  gameEntitySchema,
  type EntityKind,
  type GameEntity,
} from "@bg3-builds/domain";
import type { Claim, SourceRecord } from "../types.js";

const version = "Patch 8";
const source = {
  source: "BG3 Wiki",
  gameVersion: version,
  url: "https://bg3.wiki/",
};

type FixtureDefinition = {
  id: string;
  slug: string;
  kind: EntityKind;
  name: string;
  tags: readonly string[];
  engine?: Record<string, unknown>;
};

const classes: readonly FixtureDefinition[] = [
  { id: "class-barbarian", slug: "barbarian", kind: "class", name: "Barbarian", tags: ["martial", "frontliner", "striker", "tank", "melee", "damage", "act-1"], engine: { hitDie: 12, attackAbility: "strength" } },
  { id: "class-bard", slug: "bard", kind: "class", name: "Bard", tags: ["caster", "support", "controller", "control", "support", "act-1"], engine: { hitDie: 8, spellcastingAbility: "charisma" } },
  { id: "class-cleric", slug: "cleric", kind: "class", name: "Cleric", tags: ["caster", "support", "frontliner", "tank", "support", "act-1"], engine: { hitDie: 8, spellcastingAbility: "wisdom" } },
  { id: "class-druid", slug: "druid", kind: "class", name: "Druid", tags: ["caster", "support", "controller", "control", "support", "act-1"], engine: { hitDie: 8, spellcastingAbility: "wisdom" } },
  { id: "class-fighter", slug: "fighter", kind: "class", name: "Fighter", tags: ["martial", "frontliner", "striker", "tank", "melee", "ranged", "damage", "act-1"], engine: { hitDie: 10, attackAbility: "strength" } },
  { id: "class-monk", slug: "monk", kind: "class", name: "Monk", tags: ["martial", "striker", "melee", "damage", "control", "act-1"], engine: { hitDie: 8, attackAbility: "dexterity" } },
  { id: "class-paladin", slug: "paladin", kind: "class", name: "Paladin", tags: ["martial", "frontliner", "support", "tank", "melee", "damage", "act-1"], engine: { hitDie: 10, attackAbility: "strength", spellcastingAbility: "charisma" } },
  { id: "class-ranger", slug: "ranger", kind: "class", name: "Ranger", tags: ["martial", "striker", "ranged", "damage", "control", "act-1"], engine: { hitDie: 10, attackAbility: "dexterity", spellcastingAbility: "wisdom" } },
  { id: "class-rogue", slug: "rogue", kind: "class", name: "Rogue", tags: ["martial", "striker", "ranged", "melee", "damage", "utility", "act-1"], engine: { hitDie: 8, attackAbility: "dexterity" } },
  { id: "class-sorcerer", slug: "sorcerer", kind: "class", name: "Sorcerer", tags: ["caster", "striker", "controller", "damage", "control", "act-1"], engine: { hitDie: 6, spellcastingAbility: "charisma" } },
  { id: "class-warlock", slug: "warlock", kind: "class", name: "Warlock", tags: ["caster", "striker", "controller", "ranged", "damage", "control", "act-1"], engine: { hitDie: 8, spellcastingAbility: "charisma" } },
  { id: "class-wizard", slug: "wizard", kind: "class", name: "Wizard", tags: ["caster", "controller", "striker", "damage", "control", "utility", "act-1"], engine: { hitDie: 6, spellcastingAbility: "intelligence" } },
];

const subclasses: readonly FixtureDefinition[] = [
  { id: "subclass-berserker", slug: "berserker", kind: "subclass", name: "Berserker", tags: ["melee", "damage", "act-1"] },
  { id: "subclass-college-of-swords", slug: "college-of-swords", kind: "subclass", name: "College of Swords", tags: ["ranged", "melee", "control", "act-1"] },
  { id: "subclass-light-domain", slug: "light-domain", kind: "subclass", name: "Light Domain", tags: ["damage", "support", "act-1"] },
  { id: "subclass-circle-of-the-moon", slug: "circle-of-the-moon", kind: "subclass", name: "Circle of the Moon", tags: ["tank", "control", "act-1"] },
  { id: "subclass-battle-master", slug: "battle-master", kind: "subclass", name: "Battle Master", tags: ["melee", "ranged", "damage", "control", "act-1"] },
  { id: "subclass-way-of-the-open-hand", slug: "way-of-the-open-hand", kind: "subclass", name: "Way of the Open Hand", tags: ["melee", "damage", "control", "act-1"] },
  { id: "subclass-oath-of-the-ancients", slug: "oath-of-the-ancients", kind: "subclass", name: "Oath of the Ancients", tags: ["tank", "support", "act-1"] },
  { id: "subclass-gloom-stalker", slug: "gloom-stalker", kind: "subclass", name: "Gloom Stalker", tags: ["ranged", "damage", "act-1"] },
  { id: "subclass-thief", slug: "thief", kind: "subclass", name: "Thief", tags: ["ranged", "melee", "damage", "act-1"] },
  { id: "subclass-draconic-bloodline", slug: "draconic-bloodline", kind: "subclass", name: "Draconic Bloodline", tags: ["damage", "tank", "act-1"] },
  { id: "subclass-the-fiend", slug: "the-fiend", kind: "subclass", name: "The Fiend", tags: ["damage", "control", "act-1"] },
  { id: "subclass-school-of-divination", slug: "school-of-divination", kind: "subclass", name: "School of Divination", tags: ["control", "support", "act-1"] },
];

const races: readonly FixtureDefinition[] = [
  { id: "race-human", slug: "human", kind: "race", name: "Human", tags: ["versatile", "support", "act-1"] },
  { id: "race-high-elf", slug: "high-elf", kind: "race", name: "High Elf", tags: ["caster", "ranged", "act-1"] },
  { id: "race-wood-elf", slug: "wood-elf", kind: "race", name: "Wood Elf", tags: ["ranged", "mobility", "act-1"] },
  { id: "race-half-elf", slug: "half-elf", kind: "race", name: "Half-Elf", tags: ["versatile", "support", "act-1"] },
  { id: "race-drow", slug: "drow", kind: "race", name: "Drow", tags: ["caster", "control", "act-1"] },
  { id: "race-shield-dwarf", slug: "shield-dwarf", kind: "race", name: "Shield Dwarf", tags: ["tank", "melee", "act-1"] },
  { id: "race-githyanki", slug: "githyanki", kind: "race", name: "Githyanki", tags: ["melee", "mobility", "act-1"] },
  { id: "race-half-orc", slug: "half-orc", kind: "race", name: "Half-Orc", tags: ["melee", "damage", "act-1"] },
  { id: "race-halfling", slug: "halfling", kind: "race", name: "Halfling", tags: ["ranged", "reliability", "act-1"] },
  { id: "race-deep-gnome", slug: "deep-gnome", kind: "race", name: "Deep Gnome", tags: ["stealth", "defence", "act-1"] },
  { id: "race-tiefling", slug: "tiefling", kind: "race", name: "Tiefling", tags: ["caster", "resistance", "act-1"] },
  { id: "race-dragonborn", slug: "dragonborn", kind: "race", name: "Dragonborn", tags: ["damage", "resistance", "act-1"] },
];

const feats: readonly FixtureDefinition[] = [
  { id: "feat-ability-improvement", slug: "ability-improvement", kind: "feat", name: "Ability Improvement", tags: ["versatile", "act-1"] },
  { id: "feat-alert", slug: "alert", kind: "feat", name: "Alert", tags: ["initiative", "control", "act-1"] },
  { id: "feat-great-weapon-master", slug: "great-weapon-master", kind: "feat", name: "Great Weapon Master", tags: ["melee", "damage", "act-1"] },
  { id: "feat-heavy-armour-master", slug: "heavy-armour-master", kind: "feat", name: "Heavy Armour Master", tags: ["tank", "defence", "act-1"] },
  { id: "feat-resilient", slug: "resilient", kind: "feat", name: "Resilient", tags: ["defence", "concentration", "act-1"] },
  { id: "feat-sentinel", slug: "sentinel", kind: "feat", name: "Sentinel", tags: ["melee", "control", "tank", "act-1"] },
  { id: "feat-sharpshooter", slug: "sharpshooter", kind: "feat", name: "Sharpshooter", tags: ["ranged", "damage", "act-1"] },
  { id: "feat-tavern-brawler", slug: "tavern-brawler", kind: "feat", name: "Tavern Brawler", tags: ["melee", "throwing", "damage", "act-1"] },
  { id: "feat-war-caster", slug: "war-caster", kind: "feat", name: "War Caster", tags: ["caster", "concentration", "act-1"] },
];

const spellsAndActions: readonly FixtureDefinition[] = [
  { id: "spell-bless", slug: "bless", kind: "spell", name: "Bless", tags: ["support", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-command", slug: "command", kind: "spell", name: "Command", tags: ["control", "act-1"] },
  { id: "spell-counterspell", slug: "counterspell", kind: "spell", name: "Counterspell", tags: ["control", "defence", "act-1"] },
  { id: "spell-darkness", slug: "darkness", kind: "spell", name: "Darkness", tags: ["control", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-fireball", slug: "fireball", kind: "spell", name: "Fireball", tags: ["damage", "area", "act-1"] },
  { id: "spell-haste", slug: "haste", kind: "spell", name: "Haste", tags: ["support", "damage", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-hold-person", slug: "hold-person", kind: "spell", name: "Hold Person", tags: ["control", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-hunger-of-hadar", slug: "hunger-of-hadar", kind: "spell", name: "Hunger of Hadar", tags: ["control", "damage", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-shield", slug: "shield", kind: "spell", name: "Shield", tags: ["tank", "defence", "act-1"] },
  { id: "spell-spirit-guardians", slug: "spirit-guardians", kind: "spell", name: "Spirit Guardians", tags: ["damage", "control", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-spike-growth", slug: "spike-growth", kind: "spell", name: "Spike Growth", tags: ["control", "damage", "concentration", "act-1"], engine: { concentration: true } },
  { id: "action-action-surge", slug: "action-surge", kind: "action", name: "Action Surge", tags: ["damage", "nova", "act-1"] },
  { id: "action-flurry-of-blows", slug: "flurry-of-blows", kind: "action", name: "Flurry of Blows", tags: ["melee", "damage", "act-1"] },
  { id: "action-sneak-attack", slug: "sneak-attack", kind: "action", name: "Sneak Attack", tags: ["ranged", "melee", "damage", "act-1"] },
  { id: "passive-eldritch-invocation", slug: "eldritch-invocation", kind: "passive", name: "Eldritch Invocation", tags: ["caster", "ranged", "utility", "act-1"] },
];

const items: readonly FixtureDefinition[] = [
  { id: "item-titanstring-bow", slug: "titanstring-bow", kind: "item", name: "Titanstring Bow", tags: ["ranged", "damage", "act-1"] },
  { id: "item-club-of-hill-giant-strength", slug: "club-of-hill-giant-strength", kind: "item", name: "Club of Hill Giant Strength", tags: ["melee", "utility", "act-1"] },
  { id: "item-adamantine-splint-armour", slug: "adamantine-splint-armour", kind: "item", name: "Adamantine Splint Armour", tags: ["tank", "heavy-armour", "act-1"] },
  { id: "item-adamantine-shield", slug: "adamantine-shield", kind: "item", name: "Adamantine Shield", tags: ["tank", "shield", "act-1"] },
  { id: "item-gloves-of-dexterity", slug: "gloves-of-dexterity", kind: "item", name: "Gloves of Dexterity", tags: ["ranged", "defence", "act-1"] },
  { id: "item-caustic-band", slug: "caustic-band", kind: "item", name: "Caustic Band", tags: ["ranged", "melee", "damage", "act-1"] },
  { id: "item-the-sparkle-hands", slug: "the-sparkle-hands", kind: "item", name: "The Sparkle Hands", tags: ["melee", "lightning", "damage", "act-1"] },
  { id: "item-spell-sparkler", slug: "spell-sparkler", kind: "item", name: "The Spellsparkler", tags: ["caster", "lightning", "damage", "act-1"] },
  { id: "item-melfs-first-staff", slug: "melfs-first-staff", kind: "item", name: "Melf's First Staff", tags: ["caster", "control", "act-1"] },
  { id: "item-whispering-promise", slug: "whispering-promise", kind: "item", name: "The Whispering Promise", tags: ["support", "healing", "act-1"] },
  { id: "item-skinburster", slug: "skinburster", kind: "item", name: "The Skinburster", tags: ["melee", "tank", "damage", "act-1"] },
  { id: "item-phalar-aluve", slug: "phalar-aluve", kind: "item", name: "Phalar Aluve", tags: ["melee", "support", "damage-rider-source", "act-1"] },
  { id: "item-haste-spores-grenade", slug: "haste-spores-grenade", kind: "item", name: "Haste Spore Grenade", tags: ["consumable", "support", "act-1"] },
  { id: "item-elixir-of-hill-giant-strength", slug: "elixir-of-hill-giant-strength", kind: "item", name: "Elixir of Hill Giant Strength", tags: ["consumable", "melee", "damage", "act-1"] },
  { id: "item-potion-of-speed", slug: "potion-of-speed", kind: "item", name: "Potion of Speed", tags: ["consumable", "support", "damage", "act-1"] },

  { id: "item-risky-ring", slug: "risky-ring", kind: "item", name: "Risky Ring", tags: ["ranged", "melee", "damage", "act-2"] },
  { id: "item-cloak-of-protection", slug: "cloak-of-protection", kind: "item", name: "Cloak of Protection", tags: ["tank", "defence", "act-2"] },
  { id: "item-hellfire-hand-crossbow", slug: "hellfire-hand-crossbow", kind: "item", name: "Hellfire Hand Crossbow", tags: ["ranged", "damage", "act-2"] },
  { id: "item-neer-misser", slug: "neer-misser", kind: "item", name: "Ne'er Misser", tags: ["ranged", "damage", "act-2"] },
  { id: "item-helmet-of-arcane-acuity", slug: "helmet-of-arcane-acuity", kind: "item", name: "Helmet of Arcane Acuity", tags: ["caster", "control", "damage", "act-2"] },
  { id: "item-luminous-armour", slug: "luminous-armour", kind: "item", name: "Luminous Armour", tags: ["tank", "support", "control", "act-2"] },
  { id: "item-callous-glow-ring", slug: "callous-glow-ring", kind: "item", name: "Callous Glow Ring", tags: ["damage", "damage-rider", "act-2"] },
  { id: "item-coruscation-ring", slug: "coruscation-ring", kind: "item", name: "Coruscation Ring", tags: ["caster", "control", "act-2"] },
  { id: "item-potent-robe", slug: "potent-robe", kind: "item", name: "Potent Robe", tags: ["caster", "ranged", "damage", "act-2"] },
  { id: "item-sentinel-shield", slug: "sentinel-shield", kind: "item", name: "Sentinel Shield", tags: ["tank", "shield", "initiative", "act-2"] },
  { id: "item-darkfire-shortbow", slug: "darkfire-shortbow", kind: "item", name: "Darkfire Shortbow", tags: ["ranged", "support", "resistance", "act-2"] },
  { id: "item-blood-of-lathander", slug: "blood-of-lathander", kind: "item", name: "The Blood of Lathander", tags: ["melee", "support", "act-2"] },
  { id: "item-elixir-of-bloodlust", slug: "elixir-of-bloodlust", kind: "item", name: "Elixir of Bloodlust", tags: ["consumable", "damage", "act-2"] },
  { id: "item-elixir-of-peerless-focus", slug: "elixir-of-peerless-focus", kind: "item", name: "Elixir of Peerless Focus", tags: ["consumable", "caster", "concentration", "act-2"] },

  { id: "item-armour-of-persistence", slug: "armour-of-persistence", kind: "item", name: "Armour of Persistence", tags: ["tank", "heavy-armour", "act-3"] },
  { id: "item-gontr-mael", slug: "gontr-mael", kind: "item", name: "Gontr Mael", tags: ["ranged", "damage", "act-3"] },
  { id: "item-baldurans-giantslayer", slug: "baldurans-giantslayer", kind: "item", name: "Balduran's Giantslayer", tags: ["melee", "damage", "act-3"] },
  { id: "item-helm-of-balduran", slug: "helm-of-balduran", kind: "item", name: "Helm of Balduran", tags: ["tank", "defence", "act-3"] },
  { id: "item-armour-of-agility", slug: "armour-of-agility", kind: "item", name: "Armour of Agility", tags: ["ranged", "tank", "defence", "act-3"] },
  { id: "item-dead-shot", slug: "dead-shot", kind: "item", name: "The Dead Shot", tags: ["ranged", "damage", "act-3"] },
  { id: "item-crimson-mischief", slug: "crimson-mischief", kind: "item", name: "Crimson Mischief", tags: ["melee", "damage", "act-3"] },
  { id: "item-duellists-prerogative", slug: "duellists-prerogative", kind: "item", name: "Duellist's Prerogative", tags: ["melee", "damage", "control", "act-3"] },
  { id: "item-markoheshkir", slug: "markoheshkir", kind: "item", name: "Markoheshkir", tags: ["caster", "damage", "control", "act-3"] },
  { id: "item-rapsody", slug: "rapsody", kind: "item", name: "Rhapsody", tags: ["caster", "melee", "damage", "act-3"] },
  { id: "item-band-of-the-mystic-scoundrel", slug: "band-of-the-mystic-scoundrel", kind: "item", name: "Band of the Mystic Scoundrel", tags: ["ranged", "caster", "control", "act-3"] },
  { id: "item-amulet-of-greater-health", slug: "amulet-of-greater-health", kind: "item", name: "Amulet of Greater Health", tags: ["tank", "concentration", "act-3"] },
  { id: "item-gauntlets-of-hill-giant-strength", slug: "gauntlets-of-hill-giant-strength", kind: "item", name: "Gauntlets of Hill Giant Strength", tags: ["melee", "damage", "act-3"] },
  { id: "item-helldusk-armour", slug: "helldusk-armour", kind: "item", name: "Helldusk Armour", tags: ["tank", "heavy-armour", "resistance", "act-3"] },
  { id: "item-nyrulna", slug: "nyrulna", kind: "item", name: "Nyrulna", tags: ["melee", "throwing", "damage", "act-3"] },
  { id: "item-elixir-of-cloud-giant-strength", slug: "elixir-of-cloud-giant-strength", kind: "item", name: "Elixir of Cloud Giant Strength", tags: ["consumable", "melee", "damage", "act-3"] },
];

const fixtureDefinitions: readonly FixtureDefinition[] = [
  ...classes,
  ...subclasses,
  ...races,
  ...feats,
  ...spellsAndActions,
  ...items,
];

function fixtureDescription(definition: FixtureDefinition): string {
  const roles = definition.tags.filter((tag) =>
    ["ranged", "melee", "tank", "damage", "control", "support"].includes(tag),
  );
  return `Curated fixture supporting ${roles.join(", ") || "general"} build searches.`;
}

function createFixtureEntity(definition: FixtureDefinition): GameEntity {
  const act = definition.tags.find((tag) => tag.startsWith("act-"));
  return gameEntitySchema.parse({
    id: definition.id,
    slug: definition.slug,
    kind: definition.kind,
    text: {
      name: definition.name,
      description: fixtureDescription(definition),
    },
    tags: [...definition.tags],
    source,
    metadata: {
      fixture: true,
      ...(act ? { act } : {}),
      ...(definition.engine ? { engine: definition.engine } : {}),
    },
  });
}

export const fixtureEntities: GameEntity[] =
  fixtureDefinitions.map(createFixtureEntity);

export const fixtureSources: SourceRecord[] = [
  {
    id: "bg3-wiki-patch-8",
    name: "BG3 Wiki",
    kind: "curated",
    gameVersion: version,
    url: "https://bg3.wiki/",
    retrievedAt: "2026-09-07T00:00:00.000Z",
    license: "CC BY-NC-SA 4.0; curated facts and original fixture descriptions",
  },
];

export const fixtureClaims: Claim[] = fixtureEntities.map((entity) => ({
  id: `${entity.id}:tags`,
  entityId: entity.id,
  sourceId: "bg3-wiki-patch-8",
  field: "tags",
  value: entity.tags,
  evidence: `Classification curated for ${entity.text.name}.`,
  locator: entity.source.url,
}));

export const fixtureCoverage = {
  acts: ["act-1", "act-2", "act-3"],
  archetypes: ["ranged", "melee", "tank", "damage", "control", "support"],
  baseClasses: classes.map((entity) => entity.slug),
  itemCount: items.length,
} as const;
