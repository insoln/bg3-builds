import type { StructuredBuildReport } from "./types";
export const sampleReport: StructuredBuildReport = {
  title: "The Stormlit Duelist", summary: "A mobile swords bard built around reliable control, flourishes, and late-game acuity.",
  valid: true, confidence: "high", issues: [],
  build: { name: "Stormlit Duelist", gameVersion: "Patch 8", level: 12, raceId: "Wood Half-Elf", classes: [{ classId: "Swords Bard", level: 10 }, { classId: "Fighter", level: 2 }], abilityScores: { strength: 8, dexterity: 16, constitution: 14, intelligence: 8, wisdom: 10, charisma: 17 }, choices: [], feats: ["Sharpshooter", "Ability Improvement"], preparedSpells: [], equipment: [{ slot: "head", itemId: "Helmet of Arcane Acuity" }, { slot: "ranged-main-hand", itemId: "Titanstring Bow" }] },
  metrics: { armorClass: 21, hitPoints: 87, initiative: 7, spellSaveDc: 25, attackBonus: 13, custom: { "Flourishes": 5 } },
  calculations: [{ label: "Spell save DC", expression: "8 + proficiency 4 + CHA 5 + acuity 8", result: "25", citationIds: ["1"] }, { label: "Ranged attack", expression: "proficiency 4 + DEX 5 + weapon 2 + archery 2", result: "+13", citationIds: ["2"] }],
  assumptions: [{ id: "acuity", label: "Arcane Acuity", value: "8 stacks", impact: "The peak DC assumes you attacked before casting the control spell." }],
  acquisition: [{ act: 1, title: "Establish the core", location: "Waukeen’s Rest and the Underdark", items: ["Titanstring Bow", "Club of Hill Giant Strength"] }, { act: 2, title: "Turn attacks into control", location: "Reithwin Tollhouse", items: ["Helmet of Arcane Acuity"], missable: true }, { act: 3, title: "Finish the loadout", location: "Lower City", items: ["Band of the Mystic Scoundrel"] }],
  citations: [{ id: "1", label: "Arcane Acuity", source: "BG3 game data", detail: "Patch 8 status definition" }, { id: "2", label: "Archery fighting style", source: "BG3 game data", detail: "+2 ranged attack rolls" }],
  unsupportedMechanics: ["Conditional enemy resistances are not included in the displayed save chance."],
};
