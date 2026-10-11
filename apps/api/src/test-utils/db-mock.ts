// Shared mock of @contact-management/db for service unit tests
// (expertise-testing / expertise-postgres-prisma: mock Prisma for unit tests).
// Wire it in a spec with:
//   jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").createDbModuleMock());
// then `import { prisma } from "@contact-management/db"` gives the mock.

// Stand-in for Prisma's error class so services' `instanceof` checks work
// without loading the generated client (which needs DATABASE_URL).
export class FakePrismaKnownRequestError extends Error {
  constructor(
    message: string,
    public readonly meta: { code: string },
  ) {
    super(message);
  }
  get code(): string {
    return this.meta.code;
  }
}

const model = (...methods: string[]) => Object.fromEntries(methods.map((m) => [m, jest.fn()]));

export function createDbModuleMock() {
  const prisma: Record<string, unknown> = {
    contact: model("findMany", "count", "create", "update", "findUnique"),
    contactOnSupportedBody: model("create", "count", "findUnique", "delete"),
    contactOnSupportedBodyDomain: model("createMany", "deleteMany"),
    supportedBody: model("findMany", "count", "create", "update", "findUnique"),
    supportedBodyOnDomain: model("findMany", "createMany", "deleteMany"),
    domain: model("findMany"),
  };
  // Callback form runs against the same mock (acts as `tx`); array form
  // resolves the already-created promises, like the real client. A plain
  // function, not jest.fn, so `jest.resetAllMocks()` in a spec's beforeEach
  // can't wipe its implementation.
  prisma["$transaction"] = (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[]);

  return {
    prisma,
    Prisma: { PrismaClientKnownRequestError: FakePrismaKnownRequestError },
  };
}

export const knownError = (code: string) => new FakePrismaKnownRequestError(`prisma ${code}`, { code });
export type DbMock = Record<string, Record<string, jest.Mock>>;
