import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

// Success envelope, applied globally in main.ts (ARCHITECTURE-SPINE.md AD-8).
// A controller method that needs `meta` (pagination totals, etc.) returns
// { data, meta } itself; this interceptor only wraps the bare-data case.
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === "object" && "data" in result) {
          return result;
        }
        return { data: result };
      }),
    );
  }
}
