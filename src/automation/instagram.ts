import { authenticatePlatform } from "./shared.js";

export async function connectInstagram(): Promise<void> {
  await authenticatePlatform("instagram");
}
