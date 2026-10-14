import type { z } from "zod";
import type { domainSchema } from "./schema";

export type DomainDto = z.output<typeof domainSchema>;
