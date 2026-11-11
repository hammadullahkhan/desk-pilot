import type { AssistantApi } from "../shared/contracts";

declare global {
  interface Window {
    assistant: AssistantApi;
  }
}
