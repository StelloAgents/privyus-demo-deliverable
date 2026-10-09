import {
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  Bookmark,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CircleDollarSign,
  Ellipsis,
  FileCheck,
  FileText,
  Flag,
  Gavel,
  Globe,
  Handshake,
  Landmark,
  Megaphone,
  MessageSquare,
  MessageSquareQuote,
  Mic,
  Newspaper,
  Plane,
  Quote,
  Scale,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  UserRound,
  Users,
  Vote,
  Factory,
  Lightbulb,
  MapPin,
  Receipt,
  Earth,
  Library,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Entity } from "./types";

/**
 * A curated map of lucide icons. Data files can name an icon in any of these
 * forms: "FileText", "file-text", "file_text" or "filetext".
 */
const ICONS: Record<string, LucideIcon> = {
  arrowright: ArrowRight,
  badgedollarsign: BadgeDollarSign,
  banknote: Banknote,
  bookmark: Bookmark,
  briefcase: Briefcase,
  building: Building,
  building2: Building2,
  calendar: Calendar,
  calendardays: CalendarDays,
  check: Check,
  circledollarsign: CircleDollarSign,
  dollarsign: CircleDollarSign,
  ellipsis: Ellipsis,
  morehorizontal: Ellipsis,
  filecheck: FileCheck,
  filetext: FileText,
  file: FileText,
  document: FileText,
  flag: Flag,
  gavel: Gavel,
  globe: Globe,
  handshake: Handshake,
  landmark: Landmark,
  megaphone: Megaphone,
  messagesquare: MessageSquare,
  messagesquarequote: MessageSquareQuote,
  mic: Mic,
  newspaper: Newspaper,
  plane: Plane,
  quote: Quote,
  scale: Scale,
  scrolltext: ScrollText,
  shield: Shield,
  shieldcheck: ShieldCheck,
  sparkles: Sparkles,
  user: User,
  userround: UserRound,
  users: Users,
  vote: Vote,
  factory: Factory,
  lightbulb: Lightbulb,
  mappin: MapPin,
  receipt: Receipt,
  globe2: Earth,
  earth: Earth,
  library: Library,
  usersround: UsersRound,
};

/** Default icon per category label (DESIGN.md section 5). */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  votes: Vote,
  trips: Plane,
  travel: Plane,
  meetings: Users,
  contributions: CircleDollarSign,
  opinions: Quote,
  statements: Quote,
  others: Ellipsis,
  other: Ellipsis,
};

const TYPE_ICONS: Record<Entity["type"], LucideIcon> = {
  topic: Globe,
  bill: FileText,
  person: User,
  category: Ellipsis,
  detail: FileText,
  org: Landmark,
};

export function iconByName(name?: string): LucideIcon | undefined {
  if (!name) return undefined;
  return ICONS[name.toLowerCase().replace(/[-_\s]/g, "")];
}

/** The icon for a graph entity: its own icon, then its category, then its type. */
export function iconForEntity(entity: Entity): LucideIcon {
  return (
    iconByName(entity.icon) ??
    (entity.type === "category" ? CATEGORY_ICONS[entity.label.toLowerCase()] : undefined) ??
    TYPE_ICONS[entity.type]
  );
}
