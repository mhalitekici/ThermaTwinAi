import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Mode, Snapshot } from "./lib";
export const Context = createContext<{
  mode: Mode;
  setMode: (m: Mode) => void;
  snap: Snapshot | null;
  loading: boolean;
  error: string;
  session: Session | null;
  authReady: boolean;
  signOut: () => Promise<void>;
  refresh: () => void;
  notify: (message: string) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  selectReplay: (eventId: string) => void;
}>(null!);
export const useApp = () => useContext(Context);
