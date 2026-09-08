import {
  InMemoryEngineRepository,
  optimizeBuild,
  rankBuilds,
  validateBuild,
  type Build,
  type EntityKind,
  type GameEntity,
  type OptimizationRequest,
  type OptimizerResult,
} from "@bg3-builds/domain";
import type { GameDataReader } from "./tools.js";

export class FixtureGameDataReader implements GameDataReader {
  readonly #repository: InMemoryEngineRepository;

  constructor(entities: Iterable<GameEntity>) {
    this.#repository = new InMemoryEngineRepository(entities);
  }

  async searchEntities(input: {
    query?: string;
    kind?: EntityKind;
    limit: number;
  }): Promise<GameEntity[]> {
    const query = input.query?.toLocaleLowerCase();
    return this.#repository
      .listEntities(input.kind)
      .filter((entity) =>
        query === undefined
          ? true
          : [entity.text.name, entity.text.description, ...entity.tags]
              .filter((value): value is string => value !== undefined)
              .some((value) => value.toLocaleLowerCase().includes(query)),
      )
      .slice(0, input.limit);
  }

  async getEntity(id: string): Promise<GameEntity | undefined> {
    return this.#repository.getEntity(id);
  }

  async validateBuild(build: Build): Promise<unknown> {
    return validateBuild(build, this.#repository);
  }

  async compareBuilds(left: Build, right: Build): Promise<unknown> {
    return rankBuilds([left, right], this.#repository);
  }

  async optimizeBuild(input: OptimizationRequest): Promise<OptimizerResult> {
    return optimizeBuild(this.#repository, input);
  }
}
