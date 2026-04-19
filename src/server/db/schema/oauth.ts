import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

// ── OAuth integrations ─────────────────────────────

export const oauthClients = sqliteTable(
  "oauth_clients",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    redirectUris: text("redirect_uris").notNull(),
    allowedScopes: text("allowed_scopes").notNull(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method").notNull().default("none"),
    grantTypes: text("grant_types").notNull().default("authorization_code refresh_token"),
    clientUri: text("client_uri"),
    logoUri: text("logo_uri"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("oauth_clients_client_id_idx").on(table.clientId)]
);

export const oauthAuthorizationCodes = sqliteTable(
  "oauth_authorization_codes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    codeHash: text("code_hash").notNull(),
    codePreview: text("code_preview").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
    scopes: text("scopes").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    consumedAt: integer("consumed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("oauth_authorization_codes_code_hash_idx").on(table.codeHash),
    index("oauth_authorization_codes_user_client_idx").on(table.userId, table.clientId),
    index("oauth_authorization_codes_expires_at_idx").on(table.expiresAt),
  ]
);

export const oauthRefreshTokens = sqliteTable(
  "oauth_refresh_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPreview: text("token_preview").notNull(),
    scopes: text("scopes").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("oauth_refresh_tokens_token_hash_idx").on(table.tokenHash),
    index("oauth_refresh_tokens_user_client_idx").on(table.userId, table.clientId),
    index("oauth_refresh_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

export const oauthAccessTokens = sqliteTable(
  "oauth_access_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    refreshTokenId: text("refresh_token_id").references(() => oauthRefreshTokens.id, {
      onDelete: "set null",
    }),
    tokenHash: text("token_hash").notNull(),
    tokenPreview: text("token_preview").notNull(),
    scopes: text("scopes").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("oauth_access_tokens_token_hash_idx").on(table.tokenHash),
    index("oauth_access_tokens_user_client_idx").on(table.userId, table.clientId),
    index("oauth_access_tokens_refresh_token_idx").on(table.refreshTokenId),
    index("oauth_access_tokens_expires_at_idx").on(table.expiresAt),
  ]
);
