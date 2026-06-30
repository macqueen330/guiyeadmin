import { RatioDonut } from "./RatioDonut";
import { salesChannels, customerSources } from "@/lib/mock/data";

// Renders the two distinct口径 side by side: 销售渠道 (where the deal closes) and
// 客户来源 (where the customer came from). Keeping them apart is the core fix from
// the IA review — the old single "渠道占比" mixed成交渠道、沟通工具 and 引流来源.
export function ChannelMix({ columns = 2 }: { columns?: 1 | 2 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns === 2 ? "1fr 1fr" : "1fr",
        gap: 16,
      }}
    >
      <RatioDonut
        title="销售渠道占比"
        subtitle="口径一 · 订单最终在哪里成交"
        centerValue="3,642"
        centerLabel="成交订单"
        slices={salesChannels}
      />
      <RatioDonut
        title="客户来源占比"
        subtitle="口径二 · 客户最早从哪里认识瑰野"
        centerValue="962"
        centerLabel="新增客户"
        slices={customerSources}
      />
    </div>
  );
}
