import { router } from "../trpc";
import { notesRouter } from "./notes";
import { bookmarksRouter } from "./bookmarks";
import { todosRouter } from "./todos";
import { workflowsRouter } from "./workflows";
import { dashboardRouter } from "./dashboard";
import { focusRouter } from "./focus";
import { usageRouter } from "./usage";
import { portfolioRouter } from "./portfolio";
import { ossProjectsRouter } from "./oss-projects";

export const appRouter = router({
  notes: notesRouter,
  bookmarks: bookmarksRouter,
  todos: todosRouter,
  ossProjects: ossProjectsRouter,
  workflows: workflowsRouter,
  dashboard: dashboardRouter,
  focus: focusRouter,
  usage: usageRouter,
  portfolio: portfolioRouter,
});

export type AppRouter = typeof appRouter;
