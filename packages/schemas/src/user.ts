import { z } from 'zod'

/**
 * User Role Enum
 */
export const UserRoleSchema = z.enum(['buyer', 'seller', 'builder', 'admin'])
export type UserRole = z.infer<typeof UserRoleSchema>

/**
 * User Schema - Updated for Clerk Integration
 * 
 * CRITICAL: Separates MongoDB _id from Clerk's user ID
 * - id: MongoDB ObjectId (internal primary key)
 * - clerk_user_id: Clerk's unique user identifier
 */
export const UserSchema = z.object({
  id: z.string().describe('MongoDB ObjectId - internal primary key'),
  clerk_user_id: z.string().describe('Clerk user ID - external identifier'),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  phone: z.string().optional(),
  profile_image: z.string().url().optional(),
  created_at: z.date(),
  updated_at: z.date(),
})

export type User = z.infer<typeof UserSchema>

/**
 * Create User Schema (for registration)
 */
export const CreateUserSchema = UserSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export type CreateUser = z.infer<typeof CreateUserSchema>

/**
 * Clerk Webhook Payload Schema
 */
export const ClerkWebhookPayloadSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string().describe('Clerk user ID'),
    email_addresses: z.array(z.object({
      email_address: z.string().email(),
      id: z.string(),
    })),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone_numbers: z.array(z.object({
      phone_number: z.string(),
      id: z.string(),
    })).optional(),
    image_url: z.string().url().optional(),
    public_metadata: z.record(z.any()).optional(),
    created_at: z.number(),
    updated_at: z.number(),
  }),
})

export type ClerkWebhookPayload = z.infer<typeof ClerkWebhookPayloadSchema>

/**
 * User Response Schema (for API responses) - Zod version
 * Note: This is the Zod validation schema, different from the generated TypeScript interface
 */
export const UserResponseSchema = UserSchema.omit({
  clerk_user_id: true, // Don't expose Clerk ID in responses
})

export type UserResponseZod = z.infer<typeof UserResponseSchema>
