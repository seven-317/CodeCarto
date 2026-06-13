import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// locale-aware Link / usePathname / useRouter,自動處理 [locale] 前綴
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
