import {
  Activity,
  FileText,
  LayoutDashboard,
  MessageCircle,
} from "lucide-react";

export const navigationItems = [
  { href: "/", label: "首页", icon: LayoutDashboard },
  { href: "/notes", label: "笔记", icon: FileText },
  ...(process.env.NEXT_PUBLIC_ENABLE_TOKEN_USAGE === "true"
    ? [{ href: "/usage", label: "Token 用量", icon: Activity }]
    : []),
  { href: "/ask", label: "Ask AI", icon: MessageCircle },
] as const;
