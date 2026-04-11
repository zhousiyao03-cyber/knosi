import { checkBotId } from "botid/server";

/**
 * BotID 观测器。当前项目没有 Deep Analysis,Basic 模式对 JSON POST 请求
 * 会偏保守地标为 bot,所以只记录判定结果,不拦截请求。真正的滥用防护依
 * 赖 checkAiRateLimit。未来升到 Pro 并启用 BotID Deep Analysis 后,可
 * 把 console.warn 改回 403 拦截。
 */
export async function guardBot(_req?: Request): Promise<Response | null> {
  if (process.env.AUTH_BYPASS === "true") return null;

  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      console.warn("[botid] would-block", JSON.stringify(verification));
    }
  } catch (err) {
    console.warn("[botid] check threw", err);
  }

  return null;
}
