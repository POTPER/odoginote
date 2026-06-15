import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { UserInfo } from "@odoginote/shared";
import { api } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import VaultPage from "./pages/VaultPage";

function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const hasVault = user && (user.vaults.length > 0 || user.activeVault);

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to={hasVault ? "/vault" : "/onboarding"} /> : <LoginPage />}
      />
      <Route
        path="/onboarding"
        element={
          user ? (
            <OnboardingPage onComplete={() => api.getMe().then(setUser)} />
          ) : (
            <Navigate to="/" />
          )
        }
      />
      <Route
        path="/vault"
        element={
          user && hasVault && user.activeVault ? (
            <VaultPage user={user} onUserUpdate={setUser} />
          ) : (
            <Navigate to={user ? "/onboarding" : "/"} />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
