/**
 * cn()：clsx + tailwind-merge 类名合并（UI 美化 P1）。
 * 依赖策略：渲染层专用 UI 依赖 → devDependencies（照常打进 renderer JS，不进 asar node_modules），登记《技术栈.md》§4.2。
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
