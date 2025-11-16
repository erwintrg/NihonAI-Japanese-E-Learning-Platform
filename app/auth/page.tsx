'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      }
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.push('/dashboard')
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
            NihonAI Tutor
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Sign in to start your Japanese learning journey
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#000000',
                    brandAccent: '#27272a',
                    inputText: '#000000',
                    inputBackground: '#ffffff',
                  },
                },
                dark: {
                  colors: {
                    brand: '#ffffff',
                    brandAccent: '#a1a1aa',
                    inputText: '#ffffff',
                    inputBackground: '#18181b',
                  },
                },
              },
            }}
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '/dashboard'}
            onlyThirdPartyProviders={false}
            magicLink={false}
          />
        </div>
      </div>
    </div>
  )
}
