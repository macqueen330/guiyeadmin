// Client-safe shape of every Server Action result.
// 服务端实现在 ./common.ts（server-only）；客户端组件只 import 这个类型文件。

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
}
