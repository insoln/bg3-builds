import type { EntityKind, GameEntity } from "../schemas/index.js";

export interface EngineRepository {
  getEntity(id: string): GameEntity | undefined;
  listEntities(kind?: EntityKind): readonly GameEntity[];
}

export class InMemoryEngineRepository implements EngineRepository {
  private readonly byId: ReadonlyMap<string, GameEntity>;
  private readonly entities: readonly GameEntity[];

  constructor(entities: Iterable<GameEntity>) {
    this.entities = [...entities].sort((a, b) => a.id.localeCompare(b.id));
    this.byId = new Map(this.entities.map((entity) => [entity.id, entity]));
  }

  getEntity(id: string): GameEntity | undefined { return this.byId.get(id); }
  listEntities(kind?: EntityKind): readonly GameEntity[] {
    return kind === undefined ? this.entities : this.entities.filter((entity) => entity.kind === kind);
  }
}
