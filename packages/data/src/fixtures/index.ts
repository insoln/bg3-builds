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
};

const titanstringBowIconUrl =
  "https://bg3.wiki/w/images/thumb/3/36/Longbow_PlusOne_Icon.png/300px-Longbow_PlusOne_Icon.png.webp";

function wikiUrl(title: string): string {
  return `https://bg3.wiki/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

type FixtureDefinition = {
  id: string;
  slug: string;
  kind: EntityKind;
  name: string;
  wikiTitle: string;
  tags: readonly string[];
  engine?: Record<string, unknown>;
};

const classes: readonly FixtureDefinition[] = [
  { id: "class-barbarian", slug: "barbarian", kind: "class", name: "Barbarian", wikiTitle: "Barbarian", tags: ["martial", "frontliner", "striker", "tank", "melee", "damage", "act-1"], engine: { hitDie: 12, attackAbility: "strength" } },
  { id: "class-bard", slug: "bard", kind: "class", name: "Bard", wikiTitle: "Bard", tags: ["caster", "support", "controller", "control", "support", "act-1"], engine: { hitDie: 8, spellcastingAbility: "charisma" } },
  { id: "class-cleric", slug: "cleric", kind: "class", name: "Cleric", wikiTitle: "Cleric", tags: ["caster", "support", "frontliner", "tank", "support", "act-1"], engine: { hitDie: 8, spellcastingAbility: "wisdom" } },
  { id: "class-druid", slug: "druid", kind: "class", name: "Druid", wikiTitle: "Druid", tags: ["caster", "support", "controller", "control", "support", "act-1"], engine: { hitDie: 8, spellcastingAbility: "wisdom" } },
  { id: "class-fighter", slug: "fighter", kind: "class", name: "Fighter", wikiTitle: "Fighter", tags: ["martial", "frontliner", "striker", "tank", "melee", "ranged", "damage", "act-1"], engine: { availableAct: 1, hitDie: 10, attackAbility: "strength", ranged: { kind: "extra-attack", sourceEntityId: "class-fighter", minimumClassLevel: 5, attacksPerAction: 2 } } },
  { id: "class-monk", slug: "monk", kind: "class", name: "Monk", wikiTitle: "Monk", tags: ["martial", "striker", "melee", "damage", "control", "act-1"], engine: { hitDie: 8, attackAbility: "dexterity" } },
  { id: "class-paladin", slug: "paladin", kind: "class", name: "Paladin", wikiTitle: "Paladin", tags: ["martial", "frontliner", "support", "tank", "melee", "damage", "act-1"], engine: { hitDie: 10, attackAbility: "strength", spellcastingAbility: "charisma" } },
  { id: "class-ranger", slug: "ranger", kind: "class", name: "Ranger", wikiTitle: "Ranger", tags: ["martial", "striker", "ranged", "damage", "control", "act-1"], engine: { availableAct: 1, hitDie: 10, attackAbility: "dexterity", spellcastingAbility: "wisdom", ranged: { kind: "extra-attack", sourceEntityId: "class-ranger", minimumClassLevel: 5, attacksPerAction: 2 } } },
  { id: "class-rogue", slug: "rogue", kind: "class", name: "Rogue", wikiTitle: "Rogue", tags: ["martial", "striker", "ranged", "melee", "damage", "utility", "act-1"], engine: { hitDie: 8, attackAbility: "dexterity" } },
  { id: "class-sorcerer", slug: "sorcerer", kind: "class", name: "Sorcerer", wikiTitle: "Sorcerer", tags: ["caster", "striker", "controller", "damage", "control", "act-1"], engine: { hitDie: 6, spellcastingAbility: "charisma" } },
  { id: "class-warlock", slug: "warlock", kind: "class", name: "Warlock", wikiTitle: "Warlock", tags: ["caster", "striker", "controller", "ranged", "damage", "control", "act-1"], engine: { hitDie: 8, spellcastingAbility: "charisma" } },
  { id: "class-wizard", slug: "wizard", kind: "class", name: "Wizard", wikiTitle: "Wizard", tags: ["caster", "controller", "striker", "damage", "control", "utility", "act-1"], engine: { hitDie: 6, spellcastingAbility: "intelligence" } },
];

const subclasses: readonly FixtureDefinition[] = [
  { id: "subclass-berserker", slug: "berserker", kind: "subclass", name: "Berserker", wikiTitle: "Berserker", tags: ["melee", "damage", "act-1"] },
  { id: "subclass-college-of-swords", slug: "college-of-swords", kind: "subclass", name: "College of Swords", wikiTitle: "College of Swords", tags: ["ranged", "melee", "control", "act-1"] },
  { id: "subclass-light-domain", slug: "light-domain", kind: "subclass", name: "Light Domain", wikiTitle: "Light Domain", tags: ["damage", "support", "act-1"] },
  { id: "subclass-circle-of-the-moon", slug: "circle-of-the-moon", kind: "subclass", name: "Circle of the Moon", wikiTitle: "Circle of the Moon", tags: ["tank", "control", "act-1"] },
  { id: "subclass-battle-master", slug: "battle-master", kind: "subclass", name: "Battle Master", wikiTitle: "Battle Master", tags: ["melee", "ranged", "damage", "control", "act-1"], engine: { availableAct: 1, ranged: { kind: "battle-manoeuvre", sourceEntityId: "subclass-battle-master", damageDie: { count: 1, sides: 8 }, usesPerShortRest: 4 } } },
  { id: "subclass-way-of-the-open-hand", slug: "way-of-the-open-hand", kind: "subclass", name: "Way of the Open Hand", wikiTitle: "Way of the Open Hand", tags: ["melee", "damage", "control", "act-1"] },
  { id: "subclass-oath-of-the-ancients", slug: "oath-of-the-ancients", kind: "subclass", name: "Oath of the Ancients", wikiTitle: "Oath of the Ancients", tags: ["tank", "support", "act-1"] },
  { id: "subclass-gloom-stalker", slug: "gloom-stalker", kind: "subclass", name: "Gloom Stalker", wikiTitle: "Gloom Stalker", tags: ["ranged", "damage", "act-1"], engine: { availableAct: 1, ranged: { kind: "dread-ambusher", sourceEntityId: "subclass-gloom-stalker", firstRoundExtraAttacks: 1, extraAttackDamage: { count: 1, sides: 8 } } } },
  { id: "subclass-thief", slug: "thief", kind: "subclass", name: "Thief", wikiTitle: "Thief", tags: ["ranged", "melee", "damage", "act-1"] },
  { id: "subclass-draconic-bloodline", slug: "draconic-bloodline", kind: "subclass", name: "Draconic Bloodline", wikiTitle: "Draconic Bloodline", tags: ["damage", "tank", "act-1"] },
  { id: "subclass-the-fiend", slug: "the-fiend", kind: "subclass", name: "The Fiend", wikiTitle: "The Fiend", tags: ["damage", "control", "act-1"] },
  { id: "subclass-school-of-divination", slug: "school-of-divination", kind: "subclass", name: "School of Divination", wikiTitle: "Divination School", tags: ["control", "support", "act-1"] },
];

const races: readonly FixtureDefinition[] = [
  { id: "race-human", slug: "human", kind: "race", name: "Human", wikiTitle: "Human", tags: ["versatile", "support", "act-1"] },
  { id: "race-high-elf", slug: "high-elf", kind: "race", name: "High Elf", wikiTitle: "High Elf", tags: ["caster", "ranged", "act-1"] },
  { id: "race-wood-elf", slug: "wood-elf", kind: "race", name: "Wood Elf", wikiTitle: "Wood Elf", tags: ["ranged", "mobility", "act-1"] },
  { id: "race-half-elf", slug: "half-elf", kind: "race", name: "Half-Elf", wikiTitle: "Half-Elf", tags: ["versatile", "support", "act-1"] },
  { id: "race-drow", slug: "drow", kind: "race", name: "Drow", wikiTitle: "Drow", tags: ["caster", "control", "act-1"] },
  { id: "race-shield-dwarf", slug: "shield-dwarf", kind: "race", name: "Shield Dwarf", wikiTitle: "Shield Dwarf", tags: ["tank", "melee", "act-1"] },
  { id: "race-githyanki", slug: "githyanki", kind: "race", name: "Githyanki", wikiTitle: "Githyanki", tags: ["melee", "mobility", "act-1"] },
  { id: "race-half-orc", slug: "half-orc", kind: "race", name: "Half-Orc", wikiTitle: "Half-Orc", tags: ["melee", "damage", "act-1"] },
  { id: "race-halfling", slug: "halfling", kind: "race", name: "Halfling", wikiTitle: "Halfling", tags: ["ranged", "reliability", "act-1"] },
  { id: "race-deep-gnome", slug: "deep-gnome", kind: "race", name: "Deep Gnome", wikiTitle: "Deep Gnome", tags: ["stealth", "defence", "act-1"] },
  { id: "race-tiefling", slug: "tiefling", kind: "race", name: "Tiefling", wikiTitle: "Tiefling", tags: ["caster", "resistance", "act-1"] },
  { id: "race-dragonborn", slug: "dragonborn", kind: "race", name: "Dragonborn", wikiTitle: "Dragonborn", tags: ["damage", "resistance", "act-1"] },
];

const feats: readonly FixtureDefinition[] = [
  { id: "feat-ability-improvement", slug: "ability-improvement", kind: "feat", name: "Ability Improvement", wikiTitle: "Ability Improvement", tags: ["versatile", "act-1"] },
  { id: "feat-alert", slug: "alert", kind: "feat", name: "Alert", wikiTitle: "Alert", tags: ["initiative", "control", "act-1"] },
  { id: "feat-great-weapon-master", slug: "great-weapon-master", kind: "feat", name: "Great Weapon Master", wikiTitle: "Great Weapon Master", tags: ["melee", "damage", "act-1"] },
  { id: "feat-heavy-armour-master", slug: "heavy-armour-master", kind: "feat", name: "Heavy Armour Master", wikiTitle: "Heavy Armour Master", tags: ["tank", "defence", "act-1"] },
  { id: "feat-resilient", slug: "resilient", kind: "feat", name: "Resilient", wikiTitle: "Resilient", tags: ["defence", "concentration", "act-1"] },
  { id: "feat-sentinel", slug: "sentinel", kind: "feat", name: "Sentinel", wikiTitle: "Sentinel", tags: ["melee", "control", "tank", "act-1"] },
  { id: "feat-sharpshooter", slug: "sharpshooter", kind: "feat", name: "Sharpshooter", wikiTitle: "Sharpshooter", tags: ["ranged", "damage", "act-1"], engine: { ranged: { kind: "sharpshooter", sourceEntityId: "feat-sharpshooter", attackRollPenalty: -5, damageBonus: 10 } } },
  { id: "feat-tavern-brawler", slug: "tavern-brawler", kind: "feat", name: "Tavern Brawler", wikiTitle: "Tavern Brawler", tags: ["melee", "throwing", "damage", "act-1"] },
  { id: "feat-war-caster", slug: "war-caster", kind: "feat", name: "War Caster", wikiTitle: "War Caster", tags: ["caster", "concentration", "act-1"] },
];

const spellsAndActions: readonly FixtureDefinition[] = [
  { id: "spell-bless", slug: "bless", kind: "spell", name: "Bless", wikiTitle: "Bless", tags: ["support", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-command", slug: "command", kind: "spell", name: "Command", wikiTitle: "Command", tags: ["control", "act-1"] },
  { id: "spell-counterspell", slug: "counterspell", kind: "spell", name: "Counterspell", wikiTitle: "Counterspell", tags: ["control", "defence", "act-1"] },
  { id: "spell-darkness", slug: "darkness", kind: "spell", name: "Darkness", wikiTitle: "Darkness", tags: ["control", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-fireball", slug: "fireball", kind: "spell", name: "Fireball", wikiTitle: "Fireball", tags: ["damage", "area", "act-1"] },
  { id: "spell-haste", slug: "haste", kind: "spell", name: "Haste", wikiTitle: "Haste", tags: ["support", "damage", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-hold-person", slug: "hold-person", kind: "spell", name: "Hold Person", wikiTitle: "Hold Person", tags: ["control", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-hunger-of-hadar", slug: "hunger-of-hadar", kind: "spell", name: "Hunger of Hadar", wikiTitle: "Hunger of Hadar", tags: ["control", "damage", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-shield", slug: "shield", kind: "spell", name: "Shield", wikiTitle: "Shield", tags: ["tank", "defence", "act-1"] },
  { id: "spell-spirit-guardians", slug: "spirit-guardians", kind: "spell", name: "Spirit Guardians", wikiTitle: "Spirit Guardians", tags: ["damage", "control", "concentration", "act-1"], engine: { concentration: true } },
  { id: "spell-spike-growth", slug: "spike-growth", kind: "spell", name: "Spike Growth", wikiTitle: "Spike Growth", tags: ["control", "damage", "concentration", "act-1"], engine: { concentration: true } },
  { id: "action-action-surge", slug: "action-surge", kind: "action", name: "Action Surge", wikiTitle: "Action Surge", tags: ["damage", "nova", "act-1"] },
  { id: "passive-archery", slug: "archery", kind: "passive", name: "Archery", wikiTitle: "Archery", tags: ["ranged", "damage", "act-1"], engine: { availableAct: 1, ranged: { kind: "attack-bonus", sourceEntityId: "passive-archery", appliesTo: "ranged-weapon", bonus: 2 } } },
  { id: "passive-extra-attack", slug: "extra-attack", kind: "passive", name: "Extra Attack", wikiTitle: "Extra_Attack", tags: ["ranged", "melee", "damage", "act-1"], engine: { availableAct: 1, ranged: { kind: "extra-attack", sourceEntityId: "passive-extra-attack", minimumClassLevel: 5, attacksPerAction: 2 } } },
  { id: "action-flurry-of-blows", slug: "flurry-of-blows", kind: "action", name: "Flurry of Blows", wikiTitle: "Flurry of Blows", tags: ["melee", "damage", "act-1"] },
  { id: "action-sneak-attack", slug: "sneak-attack", kind: "action", name: "Sneak Attack", wikiTitle: "Sneak Attack", tags: ["ranged", "melee", "damage", "act-1"] },
  { id: "passive-eldritch-invocation", slug: "eldritch-invocation", kind: "passive", name: "Eldritch Invocation", wikiTitle: "Eldritch Invocation", tags: ["caster", "ranged", "utility", "act-1"] },
];

const items: readonly FixtureDefinition[] = [
  { id: "item-titanstring-bow", slug: "titanstring-bow", kind: "item", name: "Titanstring Bow", wikiTitle: "Titanstring Bow", tags: ["ranged", "damage", "act-1"], engine: { availableAct: 1, slot: "ranged-main-hand", handedness: "two-handed", ranged: { kind: "weapon", sourceEntityId: "item-titanstring-bow", weaponType: "longbow", baseDamage: { count: 1, sides: 8, flat: 1 }, damageType: "piercing", attackAbility: "dexterity", attackBonus: 1, strengthDamage: { ability: "strength", minimumModifier: 1 } } } },
  { id: "item-longbow-plus-one", slug: "longbow-plus-one", kind: "item", name: "Longbow +1", wikiTitle: "Longbow_%2B1", tags: ["ranged", "damage", "act-1"], engine: { availableAct: 1, slot: "ranged-main-hand", handedness: "two-handed", ranged: { kind: "weapon", sourceEntityId: "item-longbow-plus-one", weaponType: "longbow", baseDamage: { count: 1, sides: 8, flat: 1 }, damageType: "piercing", attackAbility: "dexterity", attackBonus: 1 } } },
  { id: "item-hunting-shortbow", slug: "hunting-shortbow", kind: "item", name: "Hunting Shortbow", wikiTitle: "Hunting_Shortbow", tags: ["ranged", "damage", "act-1"], engine: { availableAct: 1, slot: "ranged-main-hand", handedness: "two-handed", ranged: { kind: "weapon", sourceEntityId: "item-hunting-shortbow", weaponType: "shortbow", baseDamage: { count: 1, sides: 6, flat: 1 }, damageType: "piercing", attackAbility: "dexterity", attackBonus: 1 } } },
  { id: "item-joltshooter", slug: "joltshooter", kind: "item", name: "The Joltshooter", wikiTitle: "The_Joltshooter", tags: ["ranged", "lightning", "act-1"], engine: { availableAct: 1, slot: "ranged-main-hand", handedness: "two-handed", ranged: { kind: "weapon", sourceEntityId: "item-joltshooter", weaponType: "longbow", baseDamage: { count: 1, sides: 8 }, damageType: "piercing", attackAbility: "dexterity", attackBonus: 1 } } },
  { id: "item-club-of-hill-giant-strength", slug: "club-of-hill-giant-strength", kind: "item", name: "Club of Hill Giant Strength", wikiTitle: "Club of Hill Giant Strength", tags: ["melee", "utility", "act-1"] },
  { id: "item-adamantine-splint-armour", slug: "adamantine-splint-armour", kind: "item", name: "Adamantine Splint Armour", wikiTitle: "Adamantine Splint Armour", tags: ["tank", "heavy-armour", "act-1"] },
  { id: "item-adamantine-shield", slug: "adamantine-shield", kind: "item", name: "Adamantine Shield", wikiTitle: "Adamantine Shield", tags: ["tank", "shield", "act-1"] },
  { id: "item-gloves-of-dexterity", slug: "gloves-of-dexterity", kind: "item", name: "Gloves of Dexterity", wikiTitle: "Gloves of Dexterity", tags: ["ranged", "defence", "act-1"] },
  { id: "item-caustic-band", slug: "caustic-band", kind: "item", name: "Caustic Band", wikiTitle: "Caustic Band", tags: ["ranged", "melee", "damage", "act-1"] },
  { id: "item-the-sparkle-hands", slug: "the-sparkle-hands", kind: "item", name: "The Sparkle Hands", wikiTitle: "The Sparkle Hands", tags: ["melee", "lightning", "damage", "act-1"] },
  { id: "item-spell-sparkler", slug: "spell-sparkler", kind: "item", name: "The Spellsparkler", wikiTitle: "The Spellsparkler", tags: ["caster", "lightning", "damage", "act-1"] },
  { id: "item-melfs-first-staff", slug: "melfs-first-staff", kind: "item", name: "Melf's First Staff", wikiTitle: "Melf's First Staff", tags: ["caster", "control", "act-1"] },
  { id: "item-whispering-promise", slug: "whispering-promise", kind: "item", name: "The Whispering Promise", wikiTitle: "The Whispering Promise", tags: ["support", "healing", "act-1"] },
  { id: "item-skinburster", slug: "skinburster", kind: "item", name: "The Skinburster", wikiTitle: "The Skinburster", tags: ["melee", "tank", "damage", "act-1"] },
  { id: "item-phalar-aluve", slug: "phalar-aluve", kind: "item", name: "Phalar Aluve", wikiTitle: "Phalar Aluve", tags: ["melee", "support", "damage-rider-source", "act-1"] },
  { id: "item-haste-spores-grenade", slug: "haste-spores-grenade", kind: "item", name: "Haste Spore Grenade", wikiTitle: "Haste Spore Grenade", tags: ["consumable", "support", "act-1"] },
  { id: "item-elixir-of-hill-giant-strength", slug: "elixir-of-hill-giant-strength", kind: "item", name: "Elixir of Hill Giant Strength", wikiTitle: "Elixir of Hill Giant Strength", tags: ["consumable", "melee", "damage", "act-1"] },
  { id: "item-potion-of-speed", slug: "potion-of-speed", kind: "item", name: "Potion of Speed", wikiTitle: "Potion of Speed", tags: ["consumable", "support", "damage", "act-1"] },

  { id: "item-risky-ring", slug: "risky-ring", kind: "item", name: "Risky Ring", wikiTitle: "Risky Ring", tags: ["ranged", "melee", "damage", "act-2"] },
  { id: "item-cloak-of-protection", slug: "cloak-of-protection", kind: "item", name: "Cloak of Protection", wikiTitle: "Cloak of Protection", tags: ["tank", "defence", "act-2"] },
  { id: "item-hellfire-hand-crossbow", slug: "hellfire-hand-crossbow", kind: "item", name: "Hellfire Hand Crossbow", wikiTitle: "Hellfire Hand Crossbow", tags: ["ranged", "damage", "act-2"], engine: { availableAct: 2, slot: "ranged-main-hand", handedness: "one-handed", ranged: { kind: "weapon", sourceEntityId: "item-hellfire-hand-crossbow", weaponType: "hand-crossbow", baseDamage: { count: 1, sides: 6, flat: 2 }, damageType: "piercing", attackAbility: "dexterity", attackBonus: 1 } } },
  { id: "item-neer-misser", slug: "neer-misser", kind: "item", name: "Ne'er Misser", wikiTitle: "Ne'er Misser", tags: ["ranged", "damage", "act-2"], engine: { availableAct: 2, slot: "ranged-main-hand", handedness: "one-handed", ranged: { kind: "weapon", sourceEntityId: "item-neer-misser", weaponType: "hand-crossbow", baseDamage: { count: 1, sides: 6, flat: 1 }, damageType: "force", attackAbility: "dexterity" } } },
  { id: "item-helmet-of-arcane-acuity", slug: "helmet-of-arcane-acuity", kind: "item", name: "Helmet of Arcane Acuity", wikiTitle: "Helmet of Arcane Acuity", tags: ["caster", "control", "damage", "act-2"] },
  { id: "item-luminous-armour", slug: "luminous-armour", kind: "item", name: "Luminous Armour", wikiTitle: "Luminous Armour", tags: ["tank", "support", "control", "act-2"] },
  { id: "item-callous-glow-ring", slug: "callous-glow-ring", kind: "item", name: "Callous Glow Ring", wikiTitle: "Callous Glow Ring", tags: ["damage", "damage-rider", "act-2"] },
  { id: "item-coruscation-ring", slug: "coruscation-ring", kind: "item", name: "Coruscation Ring", wikiTitle: "Coruscation Ring", tags: ["caster", "control", "act-2"] },
  { id: "item-potent-robe", slug: "potent-robe", kind: "item", name: "Potent Robe", wikiTitle: "Potent Robe", tags: ["caster", "ranged", "damage", "act-2"] },
  { id: "item-sentinel-shield", slug: "sentinel-shield", kind: "item", name: "Sentinel Shield", wikiTitle: "Sentinel Shield", tags: ["tank", "shield", "initiative", "act-2"] },
  { id: "item-darkfire-shortbow", slug: "darkfire-shortbow", kind: "item", name: "Darkfire Shortbow", wikiTitle: "Darkfire Shortbow", tags: ["ranged", "support", "resistance", "act-2"] },
  { id: "item-blood-of-lathander", slug: "blood-of-lathander", kind: "item", name: "The Blood of Lathander", wikiTitle: "The Blood of Lathander", tags: ["melee", "support", "act-2"] },
  { id: "item-elixir-of-bloodlust", slug: "elixir-of-bloodlust", kind: "item", name: "Elixir of Bloodlust", wikiTitle: "Elixir of Bloodlust", tags: ["consumable", "damage", "act-2"] },
  { id: "item-elixir-of-peerless-focus", slug: "elixir-of-peerless-focus", kind: "item", name: "Elixir of Peerless Focus", wikiTitle: "Elixir of Peerless Focus", tags: ["consumable", "caster", "concentration", "act-2"] },

  { id: "item-armour-of-persistence", slug: "armour-of-persistence", kind: "item", name: "Armour of Persistence", wikiTitle: "Armour of Persistence", tags: ["tank", "heavy-armour", "act-3"] },
  { id: "item-gontr-mael", slug: "gontr-mael", kind: "item", name: "Gontr Mael", wikiTitle: "Gontr Mael", tags: ["ranged", "damage", "act-3"] },
  { id: "item-baldurans-giantslayer", slug: "baldurans-giantslayer", kind: "item", name: "Balduran's Giantslayer", wikiTitle: "Balduran's Giantslayer", tags: ["melee", "damage", "act-3"] },
  { id: "item-helm-of-balduran", slug: "helm-of-balduran", kind: "item", name: "Helm of Balduran", wikiTitle: "Helm of Balduran", tags: ["tank", "defence", "act-3"] },
  { id: "item-armour-of-agility", slug: "armour-of-agility", kind: "item", name: "Armour of Agility", wikiTitle: "Armour of Agility", tags: ["ranged", "tank", "defence", "act-3"] },
  { id: "item-dead-shot", slug: "dead-shot", kind: "item", name: "The Dead Shot", wikiTitle: "The Dead Shot", tags: ["ranged", "damage", "act-3"] },
  { id: "item-crimson-mischief", slug: "crimson-mischief", kind: "item", name: "Crimson Mischief", wikiTitle: "Crimson Mischief", tags: ["melee", "damage", "act-3"] },
  { id: "item-duellists-prerogative", slug: "duellists-prerogative", kind: "item", name: "Duellist's Prerogative", wikiTitle: "Duellist's Prerogative", tags: ["melee", "damage", "control", "act-3"] },
  { id: "item-markoheshkir", slug: "markoheshkir", kind: "item", name: "Markoheshkir", wikiTitle: "Markoheshkir", tags: ["caster", "damage", "control", "act-3"] },
  { id: "item-rapsody", slug: "rapsody", kind: "item", name: "Rhapsody", wikiTitle: "Rhapsody", tags: ["caster", "melee", "damage", "act-3"] },
  { id: "item-band-of-the-mystic-scoundrel", slug: "band-of-the-mystic-scoundrel", kind: "item", name: "Band of the Mystic Scoundrel", wikiTitle: "Band of the Mystic Scoundrel", tags: ["ranged", "caster", "control", "act-3"] },
  { id: "item-amulet-of-greater-health", slug: "amulet-of-greater-health", kind: "item", name: "Amulet of Greater Health", wikiTitle: "Amulet of Greater Health", tags: ["tank", "concentration", "act-3"] },
  { id: "item-gauntlets-of-hill-giant-strength", slug: "gauntlets-of-hill-giant-strength", kind: "item", name: "Gauntlets of Hill Giant Strength", wikiTitle: "Gauntlets of Hill Giant Strength", tags: ["melee", "damage", "act-3"] },
  { id: "item-helldusk-armour", slug: "helldusk-armour", kind: "item", name: "Helldusk Armour", wikiTitle: "Helldusk Armour", tags: ["tank", "heavy-armour", "resistance", "act-3"] },
  { id: "item-nyrulna", slug: "nyrulna", kind: "item", name: "Nyrulna", wikiTitle: "Nyrulna", tags: ["melee", "throwing", "damage", "act-3"] },
  { id: "item-elixir-of-cloud-giant-strength", slug: "elixir-of-cloud-giant-strength", kind: "item", name: "Elixir of Cloud Giant Strength", wikiTitle: "Elixir of Cloud Giant Strength", tags: ["consumable", "melee", "damage", "act-3"] },
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
    source: { ...source, url: wikiUrl(definition.wikiTitle) },
    ...(definition.id === "item-titanstring-bow" ? { iconUrl: titanstringBowIconUrl } : {}),
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

export const fixtureClaims: Claim[] = fixtureEntities.flatMap((entity) => [
  {
    id: `${entity.id}:tags`,
    entityId: entity.id,
    sourceId: "bg3-wiki-patch-8",
    field: "tags",
    value: entity.tags,
    evidence: `Classification curated for ${entity.text.name}.`,
    locator: entity.source.url,
  },
  ...(entity.metadata?.["engine"] ? [{
    id: `${entity.id}:engine`,
    entityId: entity.id,
    sourceId: "bg3-wiki-patch-8",
    field: "metadata.engine",
    value: entity.metadata["engine"],
    evidence: `Mechanic metadata transcribed from the ${entity.text.name} source page for Patch 8 baseline evaluation.`,
    locator: entity.source.url,
  }] : []),
]);

export const fixtureCoverage = {
  acts: ["act-1", "act-2", "act-3"],
  archetypes: ["ranged", "melee", "tank", "damage", "control", "support"],
  baseClasses: classes.map((entity) => entity.slug),
  itemCount: items.length,
} as const;
