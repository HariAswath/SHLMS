import { z } from "zod";

/**
 * Middleware factory for validating request body, query, and/or params against Zod schemas.
 * @param {Object} schemas - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */
export const validate = (schemas) => {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({
          success: false,
          message: "Validation failed",
          errors: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      next(error);
    }
  };
};

export default validate;
