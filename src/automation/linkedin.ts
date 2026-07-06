import { authenticatePlatform } from "./shared.js";

export async function connectLinkedin(): Promise<void> {
  await authenticatePlatform("linkedin");
}
