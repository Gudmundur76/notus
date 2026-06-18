import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarView = "files" | "search" | "git" | "extensions" | null;
export type BottomPanelView = "terminal" | "preview" | "problems" | "output";
export type Theme = "dark" | "light";

interface UIStore {
  // Sidebar
  sidebarOpen: boolean;
  sidebarView: SidebarView;
  sidebarWidth: number;

  // Bottom panel
  bottomPanelOpen: boolean;
  bottomPanelView: BottomPanelView;
  bottomPanelHeight: number;

  // Chat panel
  chatOpen: boolean;
  chatWidth: number;

  // Command palette
  commandPaletteOpen: boolean;

  // Theme
  theme: Theme;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarWidth: (w: number) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelView: (view: BottomPanelView) => void;
  setBottomPanelHeight: (h: number) => void;
  setChatOpen: (open: boolean) => void;
  setChatWidth: (w: number) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarView: "files",
      sidebarWidth: 240,
      bottomPanelOpen: true,
      bottomPanelView: "terminal",
      bottomPanelHeight: 200,
      chatOpen: true,
      chatWidth: 360,
      commandPaletteOpen: false,
      theme: "dark",

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarView: (view) => set({ sidebarView: view, sidebarOpen: view !== null }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
      setBottomPanelView: (bottomPanelView) => set({ bottomPanelView, bottomPanelOpen: true }),
      setBottomPanelHeight: (bottomPanelHeight) => set({ bottomPanelHeight }),
      setChatOpen: (chatOpen) => set({ chatOpen }),
      setChatWidth: (chatWidth) => set({ chatWidth }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    {
      name: "notus-ui",
    }
  )
);
