// A catch-all dummy schema that allows any data during development
// since the original validation package is missing and we don't 
// want to deal with missing 'zod' package dependencies in this folder.
const dummySchema = {
    safeParse: (input) => ({
        success: true,
        data: input
    })
};

module.exports = {
    updateOrderStatusSchema: dummySchema,
    menuItemCreateSchema: dummySchema,
    menuItemUpdateSchema: dummySchema,
    onboardingSchema: dummySchema,
    updateUserStatusSchema: dummySchema,
    updateOutletStatusSchema: dummySchema,
    updateMenuAvailabilitySchema: dummySchema,
    createOrderSchema: dummySchema,
    devLoginSchema: dummySchema,
    staffCreateSchema: dummySchema,
    staffStatusSchema: dummySchema,
    createOutletSchema: dummySchema
};
