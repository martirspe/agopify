export type AssistantPanelAction = {
  id: string;
  label: string;
  link: string;
  queryParams?: Record<string, string>;
};

export type AssistantPanelMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: string;
  bullets?: string[];
  actions?: AssistantPanelAction[];
};

export type AssistantConversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: AssistantPanelMessage[];
};

export type AssistantConversationGroup = {
  id: string;
  label: string;
  items: AssistantConversation[];
};
