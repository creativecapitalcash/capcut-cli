export type SocialPlatform = "twitter" | "instagram" | "linkedin" | "facebook";

export interface BrandVoice {
  tone: string;
  audience: string;
  style: string;
  topics: string[];
  hashtags: string[];
  personality: string;
  dos: string[];
  donts: string[];
}

export interface ContentPost {
  id: string;
  platform: SocialPlatform;
  text: string;
  imagePath?: string;
  imagePrompt?: string;
  scheduledAt?: string;
  status: "draft" | "scheduled" | "posted" | "failed";
  createdAt: string;
  error?: string;
}

export type LlmProvider = "anthropic" | "openrouter";

export interface SocialConfig {
  brandVoice?: BrandVoice;
  anthropicApiKey?: string;
  openRouterApiKey?: string;
  llmProvider?: LlmProvider;
  credentials: Partial<Record<SocialPlatform, { profileUrl: string }>>;
  defaultPlatforms: SocialPlatform[];
}

export interface ContentCalendar {
  version: number;
  posts: ContentPost[];
}

export const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  facebook: 63206,
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  twitter: "Twitter/X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
};

export const ALL_PLATFORMS: SocialPlatform[] = ["twitter", "instagram", "linkedin", "facebook"];
