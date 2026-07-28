'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { Building2, Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (user.role === 'admin') {
          router.replace('/admin')
        } else {
          router.replace('/tenant')
        }
      } else {
        router.replace('/login')
      }
    }
  }, [user, isLoading, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Building2 className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">SDMS</h1>
        <p className="text-muted-foreground">ระบบบริหารจัดการหอพัก</p>
        <Loader2 className="h-6 w-6 animate-spin text-primary mt-4" />
      </div>
    </div>
  );
}
