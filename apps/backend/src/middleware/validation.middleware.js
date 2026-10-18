const { ZodError } = require('zod');
const { ERROR_CODES } = require('../lib/constants');

/**
 * Middleware factory: validates req.body against a Zod schema.
 * Returns 400 with structured errors on failure.
 *
 * Usage:
 *   router.post('/', validateBody(createOrderSchema), controller.create);
 */
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            // Zod 4 renamed .errors → .issues; support both for safety.
            const issues = result.error.issues || result.error.errors || [];
            const errors = issues.map(e => ({
                field: (e.path || []).join('.'),
                message: e.message,
            }));
            const detailMsg = errors.length > 0
                ? `Validation failed: ${errors.map(e => `${e.field ? e.field + ': ' : ''}${e.message}`).join(', ')}`
                : 'Validation failed';

            return res.status(400).json({
                success: false,
                message: detailMsg,
                code: ERROR_CODES.VALIDATION_ERROR,
                errors,
            });
        }

        // Replace req.body with the parsed+coerced value from Zod
        req.body = result.data;
        next();
    };
}

/**
 * Middleware factory: validates req.query against a Zod schema.
 */
function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);

        if (!result.success) {
            const issues = result.error.issues || result.error.errors || [];
            const errors = issues.map(e => ({
                field: (e.path || []).join('.'),
                message: e.message,
            }));
            const detailMsg = errors.length > 0
                ? `Invalid query parameters: ${errors.map(e => `${e.field ? e.field + ': ' : ''}${e.message}`).join(', ')}`
                : 'Invalid query parameters';

            return res.status(400).json({
                success: false,
                message: detailMsg,
                code: ERROR_CODES.VALIDATION_ERROR,
                errors,
            });
        }

        req.query = result.data;
        next();
    };
}

module.exports = { validateBody, validateQuery };
