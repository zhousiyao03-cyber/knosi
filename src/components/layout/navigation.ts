import {
  Activity,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  FolderGit2,
  Timer,
  TrendingUp,
} from "lucide-react";

export const navigationItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/portfolio", label: "Portfolio", icon: TrendingUp },
  { href: "/usage", label: "Usage", icon: Activity },
  { href: "/ask", label: "Ask AI", icon: MessageCircle },
] as const;
