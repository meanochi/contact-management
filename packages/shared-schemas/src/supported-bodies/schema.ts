import Joi from "joi";
import type { CreateSupportedBodyInput } from "./types";

// Record<keyof T, Joi.Schema> fails to compile if a field is added to/removed
// from CreateSupportedBodyInput without updating the schema (expertise-nodejs-typescript).
const createSupportedBodyFields: Record<keyof CreateSupportedBodyInput, Joi.Schema> = {
  name: Joi.string().trim().min(1).max(200).required(),
  companyId: Joi.string().trim().min(1).max(50).required(),
  domainIds: Joi.array().items(Joi.string()).min(1).required(),
};

export const createSupportedBodySchema = Joi.object(createSupportedBodyFields).required();
