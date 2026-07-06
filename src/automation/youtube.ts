import { authenticatePlatform } from "./shared.js";

export async function connectYoutube(): Promise<void> {
  await authenticatePlatform("youtube");
}
