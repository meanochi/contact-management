import Joi from "joi";
import type { CreateSupportedBodyInput, ListSupportedBodiesQuery, UpdateSupportedBodyInput } from "./types";

// Record<keyof T, Joi.Schema> fails to compile if a field is added to/removed
// from CreateSupportedBodyInput without updating the schema (expertise-nodejs-typescript).
const createSupportedBodyFields: Record<keyof CreateSupportedBodyInput, Joi.Schema> = {
  name: Joi.string().trim().min(1).max(200).required(),
  companyId: Joi.string().trim().min(1).max(50).required(),
  domainIds: Joi.array().items(Joi.string()).min(1).required(),
};

export const createSupportedBodySchema = Joi.object(createSupportedBodyFields).required();

// Story 1.4 — query params arrive as strings over HTTP; Joi coerces
// isActive/page/pageSize to their real types here (expertise-api-rest:
// "validate GET query filters the same way" as a mutating body).
const listSupportedBodiesQueryFields: Record<keyof ListSupportedBodiesQuery, Joi.Schema> = {
  search: Joi.string().trim().max(200).optional(),
  domainId: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
};

export const listSupportedBodiesQuerySchema = Joi.object(listSupportedBodiesQueryFields).required();

// Story 1.3 — PATCH /supported-bodies/:id. Every field optional (partial
// update), but `.min(1)` rejects an empty body outright instead of silently
// no-op-ing. `domainIds`, if sent at all, still can't be emptied to zero
// domains (same business rule as create).
const updateSupportedBodyFields: Record<keyof UpdateSupportedBodyInput, Joi.Schema> = {
  name: Joi.string().trim().min(1).max(200).optional(),
  companyId: Joi.string().trim().min(1).max(50).optional(),
  domainIds: Joi.array().items(Joi.string()).min(1).optional(),
  isActive: Joi.boolean().optional(),
};

export const updateSupportedBodySchema = Joi.object(updateSupportedBodyFields).min(1).required();
