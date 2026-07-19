import {
  Briefcase,
  BarChart3,
  CalendarDays,
  NotebookPen,
  Code2,
  Shield,
  GitCompare,
  History,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 面包屑分组名（顶级前缀） */
  group: string;
};

export type NavSection = {
  section: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    section: '工作台',
    items: [
      { href: '/applications', label: '投递管理', icon: Briefcase, group: '工作台' },
      { href: '/applications/analytics', label: '数据分析', icon: BarChart3, group: '工作台' },
      { href: '/interviews', label: '面试日程', icon: CalendarDays, group: '工作台' },
      { href: '/review', label: '错题本', icon: NotebookPen, group: '工作台' },
    ],
  },
  {
    section: '工具库',
    items: [
      { href: '/tools/json', label: 'JSON 工具', icon: Code2, group: '工具库' },
      { href: '/tools/envvault', label: 'EnvVault', icon: Shield, group: '工具库' },
      { href: '/tools/snapshots', label: '快照对比', icon: GitCompare, group: '工具库' },
      { href: '/tools/changelog', label: 'Changelog', icon: History, group: '工具库' },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

/** 顶部独立项（不在分组内显示，但面包屑需要识别） */
export const standaloneItems: NavItem[] = [
  { href: '/settings', label: '设置', icon: Settings, group: '' },
];

export const everyNavItems: NavItem[] = [...allNavItems, ...standaloneItems];

/**
 * 已知的二级子页面后缀映射。
 * key 为后缀正则，value 为面包屑标签。
 * 用于 /applications/[id]、/tools/envvault/logs 等子页。
 */
export const subPageLabels: { suffix: RegExp; label: string }[] = [
  { suffix: /^\/logs$/, label: '审计日志' },
  { suffix: /^\/interviews$/, label: '面试记录' },
  { suffix: /^\/diff$/, label: '对比' },
];
