import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
import { type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { learningNotes } from "./learning";

export const curriculumTracks = sqliteTable(
  "curriculum_tracks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    icon: text("icon"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("curriculum_tracks_user_idx").on(table.userId, table.orderIndex)]
);

export const curriculumAreas = sqliteTable(
  "curriculum_areas",
  {
    id: text("id").primaryKey(),
    trackId: text("track_id")
      .notNull()
      .references(() => curriculumTracks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("curriculum_areas_track_idx").on(table.trackId, table.orderIndex)]
);

export const curriculumTopics = sqliteTable(
  "curriculum_topics",
  {
    id: text("id").primaryKey(),
    areaId: text("area_id")
      .notNull()
      .references(() => curriculumAreas.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => curriculumTopics.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    mastery: text("mastery", {
      enum: ["blank", "heard", "learning", "mastered"],
    })
      .notNull()
      .default("blank"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("curriculum_topics_area_idx").on(table.areaId, table.orderIndex),
    index("curriculum_topics_parent_idx").on(table.areaId, table.parentId),
  ]
);

export const curriculumTopicNotes = sqliteTable(
  "curriculum_topic_notes",
  {
    topicId: text("topic_id")
      .notNull()
      .references(() => curriculumTopics.id, { onDelete: "cascade" }),
    noteId: text("note_id")
      .notNull()
      .references(() => learningNotes.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.topicId, table.noteId] }),
    index("curriculum_topic_notes_note_idx").on(table.noteId),
  ]
);

export const MASTERY_STATES = ["blank", "heard", "learning", "mastered"] as const;
export type MasteryState = (typeof MASTERY_STATES)[number];
