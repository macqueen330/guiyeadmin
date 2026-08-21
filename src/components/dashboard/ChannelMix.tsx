import { RatioDonut } from "./RatioDonut";
import { fmtNumber } from "@/lib/tokens";
import type { ChannelSlice } from "@/lib/types";

// Renders the two distinct 口径 side by side: 销售渠道 (where the deal closes) and
// 客户来源 (where the customer came from). Keeping them apart is the core fix from
// the IA review — the old single "渠道占比" mixed 成交渠道、沟通工具 and 引流来源.
//
// 两张环形图的中心数字现在是各自切片的真实合计，不再是写死的 "3,642" / "962"
// （后者还与同页真实算出的新增客户数互相矛盾）。
export function ChannelMix({
  columns = 2,
  salesChannels,
  customerSources,
}: {
  columns?: 1 | 2;
  salesChannels: ChannelSlice[];
  customerSources: ChannelSlice[];
}) {
  const sum = (rows: ChannelSlice[]) => rows.reduce((s, r) => s + Math.max(0, r.val), 0);

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
        centerValue={fmtNumber(sum(salesChannels))}
        centerLabel="本月订单"
        slices={salesChannels}
      />
      <RatioDonut
        title="客户来源占比"
        subtitle="口径二 · 客户最早从哪里认识瑰野"
        centerValue={fmtNumber(sum(customerSources))}
        centerLabel="本月订单"
        slices={customerSources}
      />
    </div>
  );
}
