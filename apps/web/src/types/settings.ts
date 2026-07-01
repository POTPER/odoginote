import type { AppSettings, UiStyle } from "../hooks/useAppState";
import type { UserInfo } from "@odoginote/shared";

export interface SettingsBundle {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  user: UserInfo;
  onVaultChange: () => void;
  onOpenVaultSwitcher: () => void;
}

export type { UiStyle };
