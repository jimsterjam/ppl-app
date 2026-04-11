/**
 * Zod-basierte Request-Validierungs-Middleware.
 * Stellt ein einfaches, wiederverwendbares Framework für Schema-Validierung bereit.
 */

/**
 * Erstellt eine Middleware, die req.query gegen ein Zod-Schema validiert.
 * Bei Erfolg: validierte/gecastete Werte in req.validatedQuery.
 * Bei Fehler: 400 mit feldgenauen Fehlermeldungen.
 *
 * @param {import('zod').ZodSchema} schema
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Ungültige Query-Parameter',
        details: result.error.flatten().fieldErrors
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

/**
 * Erstellt eine Middleware, die req.body gegen ein Zod-Schema validiert.
 * Bei Erfolg: validierte Werte in req.validatedBody.
 * Bei Fehler: 400 mit feldgenauen Fehlermeldungen.
 *
 * @param {import('zod').ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Ungültiger Request-Body',
        details: result.error.flatten().fieldErrors
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
