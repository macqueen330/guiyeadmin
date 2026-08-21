"use client";

import { useEffect, useState } from "react";
import type { Carrier, Shipment, ShipmentEvent, Warehouse, WarehouseStock } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/tokens";
import { StatusTag, Chip } from "@/components/ui/Tag";
import { FilterableTable, type FilterDef } from "@/components/ui/FilterableTable";
import type { Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ActionForm,
  ExportForm,
  Field,
  FieldGrid,
  Modal,
  ModalFooter,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/ui/Form";
import { useDict } from "@/components/shell/DictProvider";
import { useViewer } from "@/components/shell/AdminProvider";
import { can } from "@/lib/auth/permissions";
import {
  addTrackingEventAction,
  createShipmentAction,
  exportShipmentsAction,
  fetchShipmentEventsAction,
  saveCarrierAction,
  saveWarehouseAction,
  syncTrackingAction,
  updateShipmentStatusAction,
} from "./actions";

export interface PendingOrder {
  order_no: string;
  customer_name: string;
  destination: string;
  fulfill_status: string;
  created_at: string;
}

const VIEW_META: Record<string, { placeholder: string; status?: Shipment["status"] }> = {
  pending: { placeholder: "搜索订单 / 客户 / 目的地" },
  tracking: { placeholder: "搜索运单 / 物流单号 / 目的地" },
  exception: { placeholder: "搜索异常运单 / 目的地", status: "exception" },
};

export function LogisticsView({
  shipments,
  pendingOrders,
  warehouses,
  warehouseStock,
  carriers,
  view,
  query,
}: {
  shipments: Shipment[];
  pendingOrders: PendingOrder[];
  warehouses: Warehouse[];
  warehouseStock: WarehouseStock[];
  carriers: Carrier[];
  view: string;
  /** 全局搜索跳转过来时的初始关键词 */
  query?: string;
}) {
  const dict = useDict();
  const viewer = useViewer();
  const [shipFor, setShipFor] = useState<PendingOrder | null>(null);
  const [detail, setDetail] = useState<Shipment | null>(null);

  const canShip = can(viewer, "logistics", "填写物流");
  const canException = can(viewer, "logistics", "处理物流异常");
  const canWarehouse = can(viewer, "logistics", "分配仓库");

  const carrierById = new Map(carriers.map((c) => [c.id, c]));

  // ---- 仓库管理 ----
  if (view === "warehouse") {
    return (
      <WarehousePanel
        warehouses={warehouses}
        stock={warehouseStock}
        carriers={carriers}
        canEdit={canWarehouse}
        canEditCarrier={canException}
      />
    );
  }

  // ---- 待发货：来自订单，而不是运单 ----
  if (view === "pending") {
    const columns: Column<PendingOrder & { id: string }>[] = [
      {
        key: "order_no",
        header: "订单号",
        render: (o) => (
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{o.order_no}</span>
        ),
      },
      { key: "customer", header: "客户", render: (o) => <span>{o.customer_name}</span> },
      {
        key: "destination",
        header: "收货地",
        render: (o) => <span style={{ color: "#4a514c" }}>{o.destination || "—"}</span>,
      },
      {
        key: "status",
        header: "履约状态",
        align: "center",
        render: (o) => <StatusTag tone={dict.tone("fulfill_status", o.fulfill_status)} />,
      },
      {
        key: "created_at",
        header: "下单时间",
        render: (o) => (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDateTime(o.created_at)}</span>
        ),
      },
      {
        key: "actions",
        header: "操作",
        align: "right",
        render: (o) =>
          canShip ? (
            <Button
              variant="secondary"
              style={{ height: 28, padding: "0 10px", fontSize: 12 }}
              onClick={() => setShipFor(o)}
            >
              登记发货
            </Button>
          ) : null,
      },
    ];

    return (
      <>
        <FilterableTable
          rows={pendingOrders.map((o) => ({ ...o, id: o.order_no }))}
          columns={columns}
          filters={[
            {
              key: "fulfill_status",
              label: "履约状态",
              options: dict.filterOptions("fulfill_status").slice(1),
              match: (o, v) => o.fulfill_status === v,
            },
          ]}
          searchText={(o) => `${o.order_no} ${o.customer_name} ${o.destination}`}
          searchPlaceholder={VIEW_META.pending.placeholder}
          empty="没有待发货的订单"
        />
        <ShipModal order={shipFor} carriers={carriers} onClose={() => setShipFor(null)} />
      </>
    );
  }

  // ---- 物流跟踪 / 异常包裹 ----
  const meta = VIEW_META[view] ?? VIEW_META.tracking;
  const rows = meta.status ? shipments.filter((s) => s.status === meta.status) : shipments;

  const columns: Column<Shipment>[] = [
    {
      key: "order_no",
      header: "订单号",
      render: (s) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.order_no}</span>
      ),
    },
    {
      key: "carrier",
      header: "承运商",
      render: (s) => {
        const c = s.carrier_id ? carrierById.get(s.carrier_id) : null;
        const connected = Boolean(c?.api_provider);
        return (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span style={{ color: "#4a514c" }}>{s.carrier}</span>
            <span style={{ fontSize: 10.5, color: connected ? "#16894f" : "var(--muted)" }}>
              {connected ? "已接入 API" : "人工录单"}
            </span>
          </div>
        );
      },
    },
    {
      key: "tracking_no",
      header: "物流单号",
      render: (s) => {
        const c = s.carrier_id ? carrierById.get(s.carrier_id) : null;
        const url = c?.tracking_url_template
          ? c.tracking_url_template.replace("{tracking_no}", encodeURIComponent(s.tracking_no))
          : null;
        return url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}
          >
            {s.tracking_no}
          </a>
        ) : (
          <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
            {s.tracking_no}
          </span>
        );
      },
    },
    {
      key: "destination",
      header: "目的地",
      render: (s) => <span style={{ color: "#4a514c" }}>{s.destination}</span>,
    },
    {
      key: "exception",
      header: "异常",
      render: (s) =>
        s.exception ? (
          <span style={{ color: "#c0392b", fontWeight: 600 }}>{s.exception}</span>
        ) : (
          <span style={{ color: "var(--muted)" }}>—</span>
        ),
    },
    {
      key: "shipped_at",
      header: "发出 / 送达",
      render: (s) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, fontSize: 11.5 }}>
          <span style={{ color: "var(--muted)" }}>{fmtDate(s.shipped_at)}</span>
          {s.delivered_at && <span style={{ color: "#16894f" }}>{fmtDate(s.delivered_at)} 送达</span>}
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      align: "center",
      render: (s) => <StatusTag tone={dict.tone("shipment_status", s.status)} />,
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (s) => (
        <Button
          variant="secondary"
          style={{ height: 28, padding: "0 10px", fontSize: 12 }}
          onClick={() => setDetail(s)}
        >
          轨迹
        </Button>
      ),
    },
  ];

  const filters: FilterDef<Shipment>[] =
    view === "tracking"
      ? [
          {
            key: "status",
            label: "状态",
            options: dict.filterOptions("shipment_status").slice(1),
            match: (s, v) => s.status === v,
          },
          {
            key: "carrier",
            label: "承运商",
            options: carriers.map((c) => ({ value: c.id, label: c.name })),
            match: (s, v) => s.carrier_id === v,
          },
        ]
      : [];

  return (
    <>
      <FilterableTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchText={(s) => `${s.order_no} ${s.tracking_no} ${s.destination} ${s.carrier}`}
        searchPlaceholder={meta.placeholder}
        initialQuery={query}
        empty="该状态暂无包裹"
        rightAction={<ExportForm action={exportShipmentsAction} label="导出物流" />}
      />
      <TrackingModal
        shipment={detail}
        carrier={detail?.carrier_id ? (carrierById.get(detail.carrier_id) ?? null) : null}
        canEdit={canShip}
        canException={canException}
        onClose={() => setDetail(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function ShipModal({
  order,
  carriers,
  onClose,
}: {
  order: PendingOrder | null;
  carriers: Carrier[];
  onClose: () => void;
}) {
  if (!order) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="登记发货"
      subtitle={`${order.order_no} · ${order.customer_name}`}
    >
      <ActionForm action={createShipmentAction} hidden={{ order_no: order.order_no }} onSuccess={onClose}>
        <FieldGrid columns={2}>
          <Field label="承运商" required>
            <Select
              name="carrier_id"
              options={carriers
                .filter((c) => c.is_active)
                .map((c) => ({
                  value: c.id,
                  label: c.api_provider ? `${c.name}（已接入 API）` : `${c.name}（人工录单）`,
                }))}
            />
          </Field>
          <Field label="物流单号" required>
            <TextInput name="tracking_no" placeholder="承运商系统里的运单号" />
          </Field>
        </FieldGrid>
        <Field label="目的地" hint="留空则用订单收货地址">
          <TextInput name="destination" defaultValue={order.destination} />
        </Field>
        <FieldGrid columns={2}>
          <Field label="运费">
            <TextInput name="freight_cost" type="number" step="0.01" defaultValue={0} />
          </Field>
          <Field label="重量（克）">
            <TextInput name="weight_g" type="number" />
          </Field>
        </FieldGrid>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>登记并标记已发货</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}

function TrackingModal({
  shipment,
  carrier,
  canEdit,
  canException,
  onClose,
}: {
  shipment: Shipment | null;
  carrier: Carrier | null;
  canEdit: boolean;
  canException: boolean;
  onClose: () => void;
}) {
  const dict = useDict();
  const [events, setEvents] = useState<ShipmentEvent[] | null>(null);

  const load = () => {
    if (!shipment) return;
    void fetchShipmentEventsAction(shipment.id).then(setEvents);
  };

  // 切换运单时先清掉上一单的轨迹（渲染期重置，避免在 effect 里 setState）。
  const [shownFor, setShownFor] = useState(shipment);
  if (shipment !== shownFor) {
    setShownFor(shipment);
    setEvents(null);
  }

  useEffect(() => {
    if (!shipment) return;
    let cancelled = false;
    void fetchShipmentEventsAction(shipment.id).then((e) => {
      if (!cancelled) setEvents(e);
    });
    return () => {
      cancelled = true;
    };
  }, [shipment]);

  if (!shipment) return null;
  const apiConnected = Boolean(carrier?.api_provider);

  return (
    <Modal
      open
      onClose={onClose}
      title={`运单 ${shipment.tracking_no}`}
      subtitle={`${shipment.carrier} · ${shipment.destination}`}
      width={640}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 12.5,
          }}
        >
          <StatusTag tone={dict.tone("shipment_status", shipment.status)} />
          <span style={{ color: "var(--muted)" }}>发出 {fmtDate(shipment.shipped_at)}</span>
          {shipment.last_synced_at && (
            <span style={{ color: "var(--muted)" }}>
              上次同步 {fmtDateTime(shipment.last_synced_at)}
            </span>
          )}
          <div style={{ marginLeft: "auto" }}>
            {apiConnected ? (
              <ActionForm action={syncTrackingAction} hidden={{ shipment_id: shipment.id }} style={{ gap: 0 }}>
                <SubmitButton variant="secondary" style={{ height: 30, fontSize: 12 }}>
                  同步轨迹
                </SubmitButton>
              </ActionForm>
            ) : (
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {carrier ? `${carrier.name} 未接入 API，轨迹需人工补录` : "未关联承运商"}
              </span>
            )}
          </div>
        </div>

        {/* 轨迹 */}
        <div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>物流轨迹</span>
          {events === null ? (
            <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>加载中…</div>
          ) : events.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 0" }}>
              暂无轨迹记录
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              {events.map((e, i) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: i < events.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: i === 0 ? "var(--accent)" : "#cdd2cb",
                      marginTop: 6,
                      flex: "none",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, color: "#2c322e" }}>
                      {e.description ?? dict.label("shipment_status", e.status)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {[e.location, fmtDateTime(e.occurred_at), e.source === "manual" ? "人工" : "API"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <>
            <div style={{ height: 1, background: "var(--line)" }} />
            <ActionForm
              action={addTrackingEventAction}
              hidden={{ shipment_id: shipment.id }}
              onSuccess={load}
              resetOnSuccess
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>补录轨迹</span>
              <FieldGrid columns={3}>
                <Field label="状态">
                  <Select
                    name="status"
                    defaultValue="in_transit"
                    options={dict.filterOptions("shipment_status").slice(1)}
                  />
                </Field>
                <Field label="地点">
                  <TextInput name="location" placeholder="例如：苏州转运中心" />
                </Field>
                <Field label="时间">
                  <TextInput name="occurred_at" type="datetime-local" />
                </Field>
              </FieldGrid>
              <Field label="描述" required>
                <TextInput name="description" placeholder="例如：已到达目的城市" />
              </Field>
              <div>
                <SubmitButton variant="secondary">补录</SubmitButton>
              </div>
            </ActionForm>

            <div style={{ height: 1, background: "var(--line)" }} />
            <ActionForm
              action={updateShipmentStatusAction}
              hidden={{ shipment_id: shipment.id }}
              onSuccess={onClose}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>更新运单状态</span>
              <FieldGrid columns={2}>
                <Field label="状态">
                  <Select
                    name="status"
                    defaultValue={shipment.status}
                    options={dict.filterOptions("shipment_status").slice(1)}
                  />
                </Field>
                <Field label="异常说明" hint="仅在标记异常时填写">
                  <TextInput name="exception" defaultValue={shipment.exception ?? ""} disabled={!canException} />
                </Field>
              </FieldGrid>
              <Field label="备注">
                <TextArea name="note" rows={2} />
              </Field>
              <div>
                <SubmitButton>更新状态</SubmitButton>
              </div>
            </ActionForm>
          </>
        )}
      </div>
    </Modal>
  );
}

function WarehousePanel({
  warehouses,
  stock,
  carriers,
  canEdit,
  canEditCarrier,
}: {
  warehouses: Warehouse[];
  stock: WarehouseStock[];
  carriers: Carrier[];
  canEdit: boolean;
  canEditCarrier: boolean;
}) {
  const [whModal, setWhModal] = useState<Warehouse | "new" | null>(null);
  const [carrierModal, setCarrierModal] = useState<Carrier | "new" | null>(null);
  const stockById = new Map(stock.map((s) => [s.id, s]));

  const whColumns: Column<Warehouse>[] = [
    {
      key: "name",
      header: "仓库",
      render: (w) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600, color: "#2c322e" }}>{w.name}</span>
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{w.code}</span>
        </div>
      ),
    },
    { key: "region", header: "区域", render: (w) => <span style={{ color: "#4a514c" }}>{w.region}</span> },
    {
      key: "type",
      header: "类型",
      render: (w) => (
        <Chip
          tone={
            {
              own: { text: "自有仓", color: "#1f7a5c", bg: "#e9f5ef" },
              bonded: { text: "保税仓", color: "#2b6cb0", bg: "#eef4ff" },
              dealer: { text: "经销商仓", color: "#c2703d", bg: "#fbf0e6" },
              "3pl": { text: "第三方仓", color: "#8a6fb0", bg: "#f4f0fa" },
            }[w.type] ?? { text: w.type, color: "#5b6470", bg: "#eef0f2" }
          }
        />
      ),
    },
    {
      key: "contact",
      header: "联系人 / 电话",
      render: (w) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, fontSize: 12 }}>
          <span>{w.contact ?? "—"}</span>
          <span style={{ color: "var(--muted)", fontSize: 10.5 }}>{w.phone ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "stock",
      header: "可售 / 锁定 / 在途",
      align: "right",
      render: (w) => {
        const s = stockById.get(w.id);
        return (
          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
            {fmtNumber(s?.sellable ?? 0)} / {fmtNumber(s?.locked ?? 0)} / {fmtNumber(s?.transit ?? 0)}
          </span>
        );
      },
    },
    {
      key: "is_active",
      header: "启用",
      align: "center",
      render: (w) => (
        <StatusTag
          tone={
            w.is_active
              ? { text: "启用", color: "#16894f", bg: "#e9f5ef" }
              : { text: "停用", color: "#6b716d", bg: "#f1f2f0" }
          }
        />
      ),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (w) =>
        canEdit ? (
          <Button
            variant="secondary"
            style={{ height: 28, padding: "0 10px", fontSize: 12 }}
            onClick={() => setWhModal(w)}
          >
            编辑
          </Button>
        ) : null,
    },
  ];

  const carrierColumns: Column<Carrier>[] = [
    {
      key: "name",
      header: "承运商",
      render: (c) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600, color: "#2c322e" }}>{c.name}</span>
          <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{c.code}</span>
        </div>
      ),
    },
    { key: "region", header: "覆盖", render: (c) => <span style={{ color: "#4a514c" }}>{c.region ?? "—"}</span> },
    {
      key: "service",
      header: "服务",
      render: (c) => (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {c.service_levels.length > 0 ? c.service_levels.join(" · ") : "—"}
        </span>
      ),
    },
    {
      key: "api",
      header: "API 接入",
      align: "center",
      render: (c) => (
        <StatusTag
          tone={
            c.api_provider
              ? { text: "已接入", color: "#16894f", bg: "#e9f5ef" }
              : { text: "人工录单", color: "#6b716d", bg: "#f1f2f0" }
          }
        />
      ),
    },
    {
      key: "tracking",
      header: "查询链接",
      render: (c) => (
        <span style={{ fontSize: 11, color: "var(--muted)", wordBreak: "break-all" }}>
          {c.tracking_url_template ? "已配置" : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (c) =>
        canEditCarrier ? (
          <Button
            variant="secondary"
            style={{ height: 28, padding: "0 10px", fontSize: 12 }}
            onClick={() => setCarrierModal(c)}
          >
            编辑
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FilterableTable
        rows={warehouses}
        columns={whColumns}
        searchText={(w) => `${w.name} ${w.code} ${w.region} ${w.address ?? ""}`}
        searchPlaceholder="搜索仓库 / 编码 / 区域"
        empty="还没有仓库。新建后即可在订单里选择发货仓。"
        rightAction={
          canEdit ? (
            <Button variant="primary" icon="plus" onClick={() => setWhModal("new")}>
              新增仓库
            </Button>
          ) : null
        }
      />

      <Card padding="14px 20px">
        <span style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
          承运商的 <b>API 接入位</b>已经预留好：填上 <code>api_provider</code>、
          <code>api_base_url</code> 与凭据环境变量名后，登记发货、轨迹同步、Webhook 回调
          （<code>/api/logistics/&#123;code&#125;/webhook</code>）都会自动改走接口，界面无需改动。
          未接入的承运商如实标注「人工录单」。
        </span>
      </Card>

      <FilterableTable
        rows={carriers}
        columns={carrierColumns}
        searchText={(c) => `${c.name} ${c.code} ${c.region ?? ""}`}
        searchPlaceholder="搜索承运商"
        empty="还没有承运商"
        rightAction={
          canEditCarrier ? (
            <Button variant="primary" icon="plus" onClick={() => setCarrierModal("new")}>
              新增承运商
            </Button>
          ) : null
        }
      />

      <WarehouseModal target={whModal} onClose={() => setWhModal(null)} />
      <CarrierModal target={carrierModal} onClose={() => setCarrierModal(null)} />
    </div>
  );
}

function WarehouseModal({
  target,
  onClose,
}: {
  target: Warehouse | "new" | null;
  onClose: () => void;
}) {
  const editing = target && target !== "new" ? target : null;
  if (!target) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "编辑仓库" : "新增仓库"}
      subtitle="仓库改名 / 停用是运营动作，不该再写 SQL 迁移"
    >
      <ActionForm action={saveWarehouseAction} hidden={{ id: editing?.id }} onSuccess={onClose}>
        <FieldGrid columns={2}>
          <Field label="仓库名称" required>
            <TextInput name="name" defaultValue={editing?.name ?? ""} />
          </Field>
          <Field label="仓库编码" required hint="如 CN-SZ">
            <TextInput name="code" defaultValue={editing?.code ?? ""} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={3}>
          <Field label="区域">
            <TextInput name="region" defaultValue={editing?.region ?? "中国"} />
          </Field>
          <Field label="类型">
            <Select
              name="type"
              defaultValue={editing?.type ?? "own"}
              options={[
                { value: "own", label: "自有仓" },
                { value: "bonded", label: "保税仓" },
                { value: "dealer", label: "经销商仓" },
                { value: "3pl", label: "第三方仓" },
              ]}
            />
          </Field>
          <Field label="排序">
            <TextInput name="sort" type="number" defaultValue={editing?.sort ?? 0} />
          </Field>
        </FieldGrid>
        <Field label="地址">
          <TextInput name="address" defaultValue={editing?.address ?? ""} />
        </Field>
        <FieldGrid columns={2}>
          <Field label="联系人">
            <TextInput name="contact" defaultValue={editing?.contact ?? ""} />
          </Field>
          <Field label="联系电话">
            <TextInput name="phone" defaultValue={editing?.phone ?? ""} />
          </Field>
        </FieldGrid>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          <Toggle name="is_active" defaultChecked={editing?.is_active ?? true} />
          启用该仓库
        </label>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>{editing ? "保存" : "创建仓库"}</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}

function CarrierModal({ target, onClose }: { target: Carrier | "new" | null; onClose: () => void }) {
  const editing = target && target !== "new" ? target : null;
  if (!target) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "编辑承运商" : "新增承运商"}
      subtitle="填写 API 字段即可接入物流公司接口；留空则为人工录单"
      width={660}
    >
      <ActionForm action={saveCarrierAction} hidden={{ id: editing?.id }} onSuccess={onClose}>
        <FieldGrid columns={3}>
          <Field label="代码" required hint="英文，如 sf / dhl">
            <TextInput name="code" defaultValue={editing?.code ?? ""} />
          </Field>
          <Field label="名称" required>
            <TextInput name="name" defaultValue={editing?.name ?? ""} />
          </Field>
          <Field label="覆盖区域">
            <TextInput name="region" defaultValue={editing?.region ?? ""} />
          </Field>
        </FieldGrid>
        <Field label="单号查询链接模板" hint="用 {tracking_no} 占位">
          <TextInput name="tracking_url_template" defaultValue={editing?.tracking_url_template ?? ""} />
        </Field>
        <Field label="服务类型" hint="逗号分隔">
          <TextInput name="service_levels" defaultValue={editing?.service_levels.join(",") ?? ""} />
        </Field>

        <div style={{ height: 1, background: "var(--line)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>API 接入（可留空）</span>
        <FieldGrid columns={2}>
          <Field label="适配器" hint="http = 通用 REST；留空 = 人工录单">
            <Select
              name="api_provider"
              defaultValue={editing?.api_provider ?? ""}
              options={[
                { value: "", label: "未接入（人工录单）" },
                { value: "http", label: "通用 REST" },
              ]}
            />
          </Field>
          <Field label="API 地址">
            <TextInput name="api_base_url" defaultValue={editing?.api_base_url ?? ""} />
          </Field>
        </FieldGrid>
        <FieldGrid columns={2}>
          <Field label="凭据环境变量名" hint="密钥值配置在 Vercel，不入库">
            <TextInput name="api_credential_env" defaultValue={editing?.api_credential_env ?? ""} />
          </Field>
          <Field label="Webhook 密钥变量名">
            <TextInput name="webhook_secret_env" defaultValue={editing?.webhook_secret_env ?? ""} />
          </Field>
        </FieldGrid>
        <Field label="API 配置（JSON）" hint="track / create / webhook 的路径与字段映射">
          <TextArea
            name="api_config"
            rows={4}
            defaultValue={
              editing?.api_config && Object.keys(editing.api_config).length > 0
                ? JSON.stringify(editing.api_config, null, 2)
                : ""
            }
            placeholder={'{"track":{"path":"/v1/track?no={tracking_no}","eventsPath":"data.traces"}}'}
          />
        </Field>
        <FieldGrid columns={2}>
          <Field label="排序">
            <TextInput name="sort" type="number" defaultValue={editing?.sort ?? 0} />
          </Field>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, fontSize: 12.5 }}>
            <Toggle name="is_active" defaultChecked={editing?.is_active ?? true} />
            <span style={{ paddingBottom: 8 }}>启用</span>
          </div>
        </FieldGrid>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SubmitButton>{editing ? "保存" : "创建承运商"}</SubmitButton>
        </ModalFooter>
      </ActionForm>
    </Modal>
  );
}
