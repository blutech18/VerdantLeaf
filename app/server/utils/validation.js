/**
 * FreshTrack — Lightweight request validation helpers
 *
 * Keeps route handlers thin and guarantees enum/range/date integrity
 * before values ever reach the database. Throwing a ValidationError lets
 * each route map the failure to a 400 response with a clear message.
 */

export const ACTION_TYPES = ['discount', 'email', 'webhook'];

export const PRODUCT_CATEGORIES = [
  'green_tea', 'black_tea', 'oolong', 'white_tea',
  'puerh', 'herbal', 'matcha', 'other',
];

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

/**
 * Maps any thrown error to an Express JSON response.
 * ValidationErrors become 400s; everything else is a logged 500.
 */
export function respondWithError(res, error, fallbackMessage) {
  if (error instanceof ValidationError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`${fallbackMessage}:`, error);
  return res.status(500).json({ error: fallbackMessage });
}

export function requirePositiveInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return parsed;
}

export function requireNonNegativeInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
  return parsed;
}

export function requireEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

export function requireValidDateRange(manufacturedAt, expiresAt) {
  const manufactured = new Date(manufacturedAt);
  const expires = new Date(expiresAt);

  if (Number.isNaN(manufactured.getTime()) || Number.isNaN(expires.getTime())) {
    throw new ValidationError('manufacturedAt and expiresAt must be valid dates');
  }
  if (expires <= manufactured) {
    throw new ValidationError('expiresAt must be after manufacturedAt');
  }

  return { manufactured, expires };
}

export function requireThreshold(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 99) {
    throw new ValidationError('thresholdScore must be a number between 1 and 99');
  }
  return parsed;
}
