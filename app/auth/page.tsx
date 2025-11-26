'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Image
              src="/images/nihonAI_Logo.png"
              alt="NihonAI Tutor Logo"
              width={80}
              height={80}
              className="w-20 h-20 object-contain"
              priority
            />
          </div>
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            NihonAI Tutor
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Sign in to start your Japanese learning journey
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#ec4899',
                    brandAccent: '#f472b6',
                    inputText: '#18181b',
                    inputBackground: '#ffffff',
                    inputBorder: '#e4e4e7',
                  },
                },
                dark: {
                  colors: {
                    brand: '#ec4899',
                    brandAccent: '#f472b6',
                    inputText: '#fafafa',
                    inputBackground: '#18181b',
                    inputBorder: '#3f3f46',
                  },
                },
              },
            }}
            localization={{
              variables: {
                sign_up: {
                  social_provider_text: 'Sign up with {{provider}}',
                },
                sign_in: {
                  social_provider_text: 'Sign in with {{provider}}',
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
