import { checkBotId } from "botid/server";

/**
 * BotID 基础校验。E2E/AUTH_BYPASS 环境直接放行,避免测试误伤。
 * 返回 null = 通过;返回 Response = 已拦截,调用方直接 return。
 */
export async function guardBot(req?: Request): Promise<Response | null> {
  if (process.env.AUTH_BYPASS === "true") return null;

  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      const headerSnapshot = req
        ? {
            "x-is-human-len": req.headers.get("x-is-human")?.length ?? 0,
            "x-path": req.headers.get("x-path"),
            "x-method": req.headers.get("x-method"),
            "x-forwarded-host": req.headers.get("x-forwarded-host"),
            host: req.headers.get("host"),
            url: req.url,
          }
        : null;
      console.warn(
        "[botid] blocked",
        JSON.stringify(verification),
        "headers",
        JSON.stringify(headerSnapshot)
      );
      return Response.json(
        { error: "Request blocked" },
        { status: 403 }
      );
    }
  } catch (err) {
    console.warn("[botid] check threw", err);
    return null;
  }

  return null;
}
