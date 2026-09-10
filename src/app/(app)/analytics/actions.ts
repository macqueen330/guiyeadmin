"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult, int } from "@/lib/actions/common";

// 官网日汇总的重算入口。
//
// 以前 gy_rollup_web_day() 全项目只有一个调用点 —— 采集端点，参数写死「今天」，
// 而且失败被 .then(()=>undefined, ()=>undefined) 彻底吞掉。于是：
//   * 某天的汇总挂了，那天的数字就永久停在错的值上，没人会知道；
//   * 改了日切时区或口径之后，历史数据没有任何办法重算。
// 现在后台可以指定区间重算，每次执行都会写进 web_rollup_runs。

const MODULE = "数据分析";

export async function rollupWebRangeAction(
  _prev: ActionResult<{ days: number }> | null,
  fd: FormData,
): Promise<ActionResult<{ days: number }>> {
  return runAction<{ days: number }>(
    {
      module: MODULE,
      permission: "查看数据分析",
      success: (r) => `已重算 ${r.days} 天的官网汇总`,
      audit: (r) => ({
        action: "rollup_web_range",
        module: "数据分析",
        detail: `重算官网日汇总 ${r.days} 天`,
      }),
    },
    async ({ sb }) => {
      const days = Math.max(1, Math.min(400, int(fd, "days", 30)));
      const to = new Date();
      const from = new Date(to.getTime() - (days - 1) * 86_400_000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const { data, error } = await sb.rpc("gy_rollup_web_range", {
        p_from: iso(from),
        p_to: iso(to),
      });
      if (error) throw new Error(`重算失败：${error.message}`);

      revalidatePath("/analytics");
      return { days: typeof data === "number" ? data : days };
    },
  );
}
