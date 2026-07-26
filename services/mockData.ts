export interface Tool {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  logoColor: string;
  logoIcon: string;
  rating: number;
  ratingCount: number;
  votes: number;
  developerName: string;
  developerBio: string;
  developerToolsCount: number;
  developerFollowers: number;
  tags: string[];
  pricing: string;
  url: string;
  screenshots: string[];
  featured: boolean;
  isNew: boolean;
  trending: boolean;
  editorPick: boolean;
  createdAt: string;
  status?: string;
  submittedBy?: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'vote' | 'comment' | 'tool_approved' | 'tool_rejected' | 'follow';
  title: string;
  body: string;
  toolId?: string;
  actorId?: string;
  isRead: boolean;
  createdAt: string;
}

export const categoryIcons: Record<string, string> = {
  'كتابة بالذكاء': 'edit',
  'أدوات الصور': 'image',
  'أدوات البيانات': 'analytics',
  'أدوات المطورين': 'code',
  'أدوات مالية': 'account-balance',
  'الإنتاجية': 'task-alt',
  'التصميم': 'palette',
  'التسويق': 'campaign',
};
