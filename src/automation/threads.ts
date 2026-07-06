import { authenticatePlatform } from "./shared.js";

export async function connectThreads(): Promise<void> {
  await authenticatePlatform("threads");
}
