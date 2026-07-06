import { authenticatePlatform } from "./shared.js";

export async function connectPinterest(): Promise<void> {
  await authenticatePlatform("pinterest");
}
