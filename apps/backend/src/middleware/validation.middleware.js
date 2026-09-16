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
            const errors = result.error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
            }));

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
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
            const errors = result.error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
            }));

            return res.status(400).json({
                success: false,
                message: 'Invalid query parameters',
                code: ERROR_CODES.VALIDATION_ERROR,
                errors,
            });
        }

        req.query = result.data;
        next();
    };
}

module.exports = { validateBody, validateQuery };
