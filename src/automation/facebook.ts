import { authenticatePlatform } from "./shared.js";

export async function connectFacebook(): Promise<void> {
  await authenticatePlatform("facebook");
}
