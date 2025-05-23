import Joi from 'joi';

// User validation schemas
const userSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')).required()
});

const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

const updateProfileSchema = Joi.object({
    isGenesis: Joi.boolean().required()
});

// Payment validation schemas
const createPaymentSchema = Joi.object({
    publicKey: Joi.string().required(),
    amount: Joi.number().positive().required()
});

const updatePaymentSchema = Joi.object({
    status: Joi.string().valid('pending', 'completed', 'failed').required()
});

const paymentSchema = Joi.object({
    userId: Joi.number().required(),
    amount: Joi.number().positive().required(),
    status: Joi.string().valid('pending', 'completed', 'failed').required(),
    transactionHash: Joi.string().allow(null)
});

// Admin validation schemas
const adminLoginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

// User schemas
const createUserSchema = Joi.object({
    walletAddress: Joi.string().required()
});

const updateUserSchema = Joi.object({
    isGenesis: Joi.boolean().required()
});

// Settings schemas
const updateSettingsSchema = Joi.object({
    accessPassword: Joi.string().min(8),
    recipientWallet: Joi.string(),
    rateLimitWindow: Joi.number().integer().positive(),
    rateLimitMax: Joi.number().integer().positive(),
    entryPrice: Joi.string().optional(),
    countdownDate: Joi.string().optional(),
    randomCountdown: Joi.boolean().optional(),
    pauseWhitelist: Joi.boolean().optional(),
    disableHiddenSection: Joi.boolean().optional(),
    shareText: Joi.string().optional()
}).min(1);

// Access log schemas
const createLogSchema = Joi.object({
    userId: Joi.number().required(),
    action: Joi.string().required(),
    details: Joi.string()
});

// Whitelist schema
const whitelistEntrySchema = Joi.object({
    name: Joi.string().max(100).required(),
    email: Joi.string().email().required(),
    walletAddress: Joi.string().required()
});

// Validation function
const validate = (schema, data) => {
    return schema.validate(data, { abortEarly: false });
};

export {
    userSchema,
    loginSchema,
    updateProfileSchema,
    createPaymentSchema,
    updatePaymentSchema,
    paymentSchema,
    createUserSchema,
    updateUserSchema,
    adminLoginSchema,
    updateSettingsSchema,
    createLogSchema,
    whitelistEntrySchema,
    validate
}; 