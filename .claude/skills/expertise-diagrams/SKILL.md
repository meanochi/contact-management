---
name: expertise-diagrams
description: 'Generates and updates the project''s two architecture diagrams as Mermaid, straight from the code: the ERD (database tables, columns, keys and relations, from packages/db/src/schema/index.ts) and the Class Diagram (NestJS modules, controllers, services and their dependencies in apps/api/src). Use when asked for an ERD, entity-relationship diagram, class diagram or "draw the DB/architecture", and after any change to the Drizzle schema or to an apps/api module/controller/service, to refresh docs/diagrams/. Not for flowcharts of a business process or UI screens (UX specs live in _bmad-output), not for changing the schema itself (see expertise-postgres-drizzle), and not for where new files belong (see expertise-code-quality).'
---

# ERD & Class Diagram Generation

> Universal code-quality principles live in `expertise-code-quality`. This skill only covers how the two diagrams are produced and kept honest.

## What each diagram is

| Diagram | Answers | Source of truth | Output file |
|---|---|---|---|
| **ERD** (Entity-Relationship) | How is the data stored: tables, columns, keys, relations | `packages/db/src/schema/index.ts` | `docs/diagrams/erd.md` |
| **Class Diagram** | How is the backend code built: which class calls which | `apps/api/src/**` (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `common/**`) | `docs/diagrams/class-diagram.md` |

Both are **generated from the code, never invented and never edited by hand**. If a diagram and the code disagree, the code wins: regenerate the diagram. `apps/web` is out of scope until it has classes worth drawing (React components are functions, not classes; a component tree is a different diagram).

## Format

- **Mermaid**, in a fenced ```` ```mermaid ```` block inside a Markdown file. It renders on GitHub and in VS Code's Markdown preview, is plain text (diff-able in git), and needs no extra tool.
- Each output file starts with a short header: what it shows, the source file(s) it was generated from, and the generation date (ISO). No prose beyond that, except the "Not expressed in the diagram" notes below.
- Diagram text is in English, exactly as the names appear in the code (a diagram that renames things cannot be grepped).

## Procedure

1. **Read the source of truth** named in the table above. Read the whole schema file, and for the class diagram every module, controller and service (not only the one that changed).
2. **Write the diagram** by the rules below, replacing the previous content of the output file.
3. **Check the syntax**: every entity/class referenced in a relation is declared, no name contains a space, every block is closed. A diagram that does not render is worse than none.
4. **Report what changed** compared with the previous version (tables/classes added, removed, relations changed) in one or two lines.

## ERD rules

- One entity per `pgTable`, named by its **database table name** (`"Contact"` becomes `Contact`, `"SupportedBodyOnDomain"` becomes `SupportedBodyOnDomain`), and one attribute per column, named by its **database column name** (`first_name`, not `firstName`).
- Attribute format: `<type> <column> <keys> "<note>"`. Types: `text`, `boolean`, `timestamp`, `jsonb`, `text[]`, or the enum's name (`ContactStatus`).
- Keys: `PK`, `FK`, `UK` (unique). A column can have several: `PK, FK`. Mark every FK, including the composite ones.
- A nullable column gets the note `"nullable"`. A column with a default does not need a note.
- **Relations** come from `references()` and `foreignKey()`, not from `relations()` blocks (those are a query convenience). Cardinality: a join table is always the "many" side (`||--o{`). A composite FK is drawn as one relation with the label `"composite FK"`.
- Enums: list the values in a Mermaid comment line (`%% ContactStatus: ACTIVE | INACTIVE`) under the diagram, since Mermaid ERD has no enum entity.
- Tables with no relations (e.g. `AuditLog`) are still drawn.
- **Not expressed in the diagram** (a short bullet list under it): rules the schema cannot hold, e.g. "a contact's domains must be a subset of the body's own domains is enforced in `ContactsService`, there is no FK for it" and "Contact is soft-delete only (`status`), never deleted". Take these from the comments in the schema file and from `expertise-postgres-drizzle`.

## Class Diagram rules

- Use `classDiagram`. One class per `@Controller` and per `@Injectable` service, plus the cross-cutting classes registered globally in `main.ts` (`ResponseInterceptor`, `LoggingInterceptor`, `AllExceptionsFilter`) and the `ZodValidationPipe`.
- Mark the role with a stereotype: `<<controller>>`, `<<service>>`, `<<interceptor>>`, `<<filter>>`, `<<pipe>>`, `<<module>>`.
- **Members:** list only **public methods** of controllers and services (name and parameter names, no bodies). Private helpers are an implementation detail: leave them out. Do not list fields except an injected dependency that is not obvious from an arrow.
- **Relations** (the point of the diagram):
  - `XModule --> XController` and `XModule --> XService` ("registers").
  - `XController --> XService` ("calls") for the injected service.
  - Every service that touches the database `--> DrizzleDb` ("queries"). Draw `DrizzleDb` once, labelled with its package (`class DrizzleDb["DrizzleDb (packages/db)"]` and the stereotype `<<package>>`; Mermaid stereotypes cannot contain a colon or slash): the layer rule (only services reach `packages/db`) then becomes visible, and a controller with an arrow to it is a visible violation.
  - Controllers `..> ZodValidationPipe` ("validates with").
  - The global interceptors and filter appear once, linked to nothing but a note that they wrap every controller, so the diagram does not turn into a hairball.
- Group modules visually with a `namespace` per resource module (Contacts, Domains, SupportedBodies) when there are more than two.
- A class that exists in code but is not wired anywhere (no module provides it) is a finding: draw it, and mention it in the report.

## When to regenerate

- When the user asks for either diagram.
- After any change to `packages/db/src/schema/index.ts` (ERD) or to an `apps/api` module, controller or service that adds, removes or renames a class, a public method or a dependency (Class Diagram).
- Before presenting the architecture to anyone.

A change that only edits a method body or a Zod schema does not need a refresh.

## Before you finish: checklist

- [ ] Every `pgTable` in the schema file is an entity in the ERD, and every `references()` / `foreignKey()` is a relation.
- [ ] Every controller and service in `apps/api/src` is a class in the Class Diagram, and every controller-to-service dependency is an arrow.
- [ ] No name was translated, shortened or "tidied" compared with the code.
- [ ] The header states the source file(s) and the date, and the diagram renders (syntax checked).
- [ ] Rules the diagram cannot show are listed under it, not silently dropped.
- [ ] The diagram files were written to `docs/diagrams/`, not edited by hand afterward.
