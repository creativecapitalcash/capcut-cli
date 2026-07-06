import { authenticatePlatform } from "./shared.js";

export async function connectTiktok(): Promise<void> {
  await authenticatePlatform("tiktok");
}
