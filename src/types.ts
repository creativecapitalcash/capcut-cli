export type SocialPlatform = "twitter" | "instagram" | "linkedin" | "facebook";

export type AutomationPlatform = "facebook" | "instagram" | "tiktok" | "youtube" | "threads" | "pinterest" | "linkedin";

export const ALL_AUTOMATION_PLATFORMS: AutomationPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "threads",
  "pinterest",
  "linkedin",
];

export const AUTOMATION_PLATFORM_LABELS: Record<AutomationPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
};

export const AUTOMATION_LOGIN_URLS: Record<AutomationPlatform, string> = {
  facebook: "https://www.facebook.com/login",
  instagram: "https://www.instagram.com/accounts/login/",
  tiktok: "https://www.tiktok.com/login",
  youtube: "https://accounts.google.com/ServiceLogin?service=youtube",
  threads: "https://www.threads.net/login",
  pinterest: "https://www.pinterest.com/login/",
  linkedin: "https://www.linkedin.com/login",
};

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

export interface SocialConfig {
  brandVoice?: BrandVoice;
  openRouterApiKey?: string;
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
