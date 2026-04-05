import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { analysisTasks, osProjectNotes, osProjects } from "@/server/db/schema";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    taskId: string;
    result?: string;
    error?: string;
  };

  if (!body.taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  // Fetch the task
  const [task] = await db
    .select()
    .from(analysisTasks)
    .where(eq(analysisTasks.id, body.taskId))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (body.error) {
    // Mark task as failed
    await db
      .update(analysisTasks)
      .set({ status: "failed", error: body.error, completedAt: new Date() })
      .where(eq(analysisTasks.id, body.taskId));

    // Update project status
    await db
      .update(osProjects)
      .set({
        analysisStatus: "failed",
        analysisError: body.error,
        updatedAt: new Date(),
      })
      .where(eq(osProjects.id, task.projectId));

    return NextResponse.json({ status: "failed" });
  }

  // Success path — persist note + update statuses
  const noteTitle =
    task.taskType === "analysis"
      ? "源码阅读笔记"
      : (task.question ?? "Follow-up").slice(0, 100);

  await db.insert(osProjectNotes).values({
    id: crypto.randomUUID(),
    projectId: task.projectId,
    userId: task.userId,
    title: noteTitle,
    content: body.result ?? "",
    plainText: body.result ?? "",
    tags: JSON.stringify(
      task.taskType === "analysis" ? ["source-analysis"] : ["followup"]
    ),
    noteType: task.taskType === "analysis" ? "analysis" : "followup",
  });

  // Mark task completed
  await db
    .update(analysisTasks)
    .set({
      status: "completed",
      result: body.result,
      completedAt: new Date(),
    })
    .where(eq(analysisTasks.id, body.taskId));

  // Update project status
  await db
    .update(osProjects)
    .set({
      analysisStatus: "completed",
      analysisError: null,
      updatedAt: new Date(),
    })
    .where(eq(osProjects.id, task.projectId));

  return NextResponse.json({ status: "completed" });
}
