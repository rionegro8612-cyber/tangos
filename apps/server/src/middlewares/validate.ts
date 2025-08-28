import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { AppError, ErrorCodes } from "../errors/AppError";

export const validate =
  (schema: ZodSchema<any>) => (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      return next(new AppError(ErrorCodes.VALIDATION_ERROR, 400, "Validation failed", { errors }));
    }

    // 검증된 데이터로 req.body 교체
    Object.assign(req, { body: parsed.data });
    next();
  };
