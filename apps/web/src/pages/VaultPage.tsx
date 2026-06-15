import type { UserInfo } from "@odoginote/shared";
import AppShell from "../layout/AppShell";

interface Props {
  user: UserInfo;
  onUserUpdate: (user: UserInfo) => void;
}

export default function VaultPage({ user, onUserUpdate }: Props) {
  return <AppShell user={user} onUserUpdate={onUserUpdate} />;
}
