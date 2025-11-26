'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getBatchName, getTotalBatches, getKanaByBatchAndType, type KanaType } from '@/lib/kana'
import { getAllVocab } from '@/lib/data'
import Link from 'next/link'

type CompletedSession = {
  batch_type: KanaType | string
  batch_number: number
  completed_at: string
  score: number
}

type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced'

type CategoryGroup = {
  category: string
  sessions: CompletedSession[]
  expanded: boolean
}

function ArchivePageContent() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<ProficiencyLevel>('beginner')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
    
    async function loadArchive() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/auth')
        return
      }
      
      setUser(user)
      
      // Fetch all completed batches (excluding grammar sessions - they go to grammar library)
      const { data: batches, error } = await supabase
        .from('completed_batches')
        .select('batch_type, batch_number, completed_at, score')
        .eq('user_id', user.id)
        .neq('batch_type', 'grammar') // Exclude grammar sessions
        .order('completed_at', { ascending: false })
      
      if (error) {
        console.error('Error loading completed batches:', error)
      } else if (batches) {
        setCompletedSessions(batches as CompletedSession[])
      }
      
      setLoading(false)
    }
    
    loadArchive()
  }, [router, supabase])

  // Determine proficiency level for a session
  const getProficiencyLevel = (batchType: string): ProficiencyLevel => {
    // All Kana sessions are beginner (N5)
    if (batchType.startsWith('hiragana') || batchType.startsWith('katakana')) {
      return 'beginner'
    }
    
    // For future vocabulary/grammar/phrases sessions, check JLPT level
    // For now, assume all current sessions are beginner
    // TODO: When vocabulary/grammar/phrases are implemented, check their JLPT level
    if (batchType.startsWith('vocabulary_')) {
      // Extract JLPT level from batch_type (e.g., "vocabulary_n5" -> N5)
      const levelMatch = batchType.match(/_n([1-5])/)
      if (levelMatch) {
        const level = parseInt(levelMatch[1])
        if (level === 5) return 'beginner'
        if (level === 4 || level === 3) return 'intermediate'
        if (level === 2 || level === 1) return 'advanced'
      }
    }
    
    // Default to beginner for now
    return 'beginner'
  }

  // Filter sessions by proficiency level
  const filteredSessions = useMemo(() => {
    return completedSessions.filter(session => {
      const level = getProficiencyLevel(session.batch_type)
      return level === activeTab
    })
  }, [completedSessions, activeTab])

  // Group sessions by category (Hiragana, Katakana, Vocabulary, Phrases, Output)
  const groupedSessions = useMemo(() => {
    const groups: Record<string, CompletedSession[]> = {}
    
    filteredSessions.forEach(session => {
      let category = ''
      
      if (session.batch_type.startsWith('hiragana')) {
        category = 'Hiragana'
      } else if (session.batch_type.startsWith('katakana')) {
        category = 'Katakana'
      } else if (session.batch_type.startsWith('vocabulary')) {
        category = 'Vocabulary'
      } else if (session.batch_type.startsWith('phrases')) {
        category = 'Phrases'
      } else if (session.batch_type.startsWith('output')) {
        category = 'Output'
      } else {
        category = 'Other'
      }
      
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(session)
    })
    
    // Sort sessions within each category by batch_number
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => {
        // First sort by batch_type to keep related types together
        if (a.batch_type !== b.batch_type) {
          return a.batch_type.localeCompare(b.batch_type)
        }
        // Then by batch_number
        return a.batch_number - b.batch_number
      })
    })
    
    return groups
  }, [filteredSessions])

  // Filter sessions by search query
  const searchFilteredSessions = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedSessions
    }
    
    const query = searchQuery.toLowerCase().trim()
    const filtered: Record<string, CompletedSession[]> = {}
    
    Object.entries(groupedSessions).forEach(([category, sessions]) => {
      const matchingSessions = sessions.filter((session) => {
        // Search in batch name
        try {
          const batchName = getBatchName(session.batch_number, session.batch_type as KanaType)
          if (batchName.toLowerCase().includes(query)) {
            return true
          }
        } catch (e) {
          // Ignore errors
        }
        
        // Search in category name
        if (category.toLowerCase().includes(query)) {
          return true
        }
        
        // Search in batch type
        if (session.batch_type.toLowerCase().includes(query)) {
          return true
        }
        
        // Search in kana characters and romaji (synchronous)
        try {
          const batchKana = getKanaByBatchAndType(
            session.batch_number,
            session.batch_type as KanaType
          )
          
          // Check kana characters
          if (batchKana.some((k: any) => k.character.includes(query) || k.romaji.toLowerCase().includes(query))) {
            return true
          }
          
          // Check vocabulary
          const allVocab = getAllVocab()
          const kanaCharacters = batchKana.map((k: any) => k.character)
          const wordExamples = allVocab.filter((vocab: any) =>
            kanaCharacters.some((kana: string) => vocab.hiragana.includes(kana))
          )
          
          if (wordExamples.some((vocab: any) =>
            vocab.japanese.includes(query) ||
            vocab.hiragana.includes(query) ||
            vocab.english.toLowerCase().includes(query) ||
            (vocab.romaji && vocab.romaji.toLowerCase().includes(query))
          )) {
            return true
          }
        } catch (e) {
          // Ignore errors (e.g., special case sessions don't have kana)
        }
        
        return false
      })
      
      if (matchingSessions.length > 0) {
        filtered[category] = matchingSessions
      }
    })
    
    return filtered
  }, [groupedSessions, searchQuery])

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  // Get type label for display
  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'hiragana': 'Basics',
      'hiragana_dakuten': 'Dakuten',
      'hiragana_handakuten': 'Handakuten',
      'hiragana_combo': 'Combinations',
      'hiragana_special': 'Special Cases',
      'katakana': 'Basics',
      'katakana_dakuten': 'Dakuten',
      'katakana_handakuten': 'Handakuten',
      'katakana_combo': 'Combinations',
      'katakana_special': 'Special Cases',
    }
    return labels[type] || type
  }

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Check if output category should be shown (unlocks after first output session)
  const hasOutputSessions = useMemo(() => {
    return Object.values(completedSessions).some(s => s.batch_type.startsWith('output'))
  }, [completedSessions])

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            Course Archive
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Review completed sessions and revisit theory and examples
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search sessions by name, kana, romaji, or vocabulary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-black dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Proficiency Tabs */}
        <div className="mb-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex">
            <button
              onClick={() => setActiveTab('beginner')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'beginner'
                  ? 'bg-pink-500 text-white'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              Beginner (N5)
            </button>
            <button
              onClick={() => setActiveTab('intermediate')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-l border-zinc-200 dark:border-zinc-700 ${
                activeTab === 'intermediate'
                  ? 'bg-pink-500 text-white'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              Intermediate (N4-N3)
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-l border-zinc-200 dark:border-zinc-700 ${
                activeTab === 'advanced'
                  ? 'bg-pink-500 text-white'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              Advanced (N2-N1)
            </button>
          </div>
        </div>

        {/* Archive Content */}
        {completedSessions.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-12 border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-2">
              No completed sessions yet
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Complete some course sessions to see them here in your archive.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : Object.keys(searchFilteredSessions).length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-12 border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-2">
              No sessions found
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Try adjusting your search query.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(searchFilteredSessions).map(([category, sessions]) => {
              // Special handling for Output category - only show if user has completed at least one output session
              if (category === 'Output' && !hasOutputSessions) {
                return null
              }
              
              const isExpanded = expandedCategories.has(category)
              
              return (
                <div key={category} className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  {/* Category Header (Collapsible) */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                        {category}
                      </h2>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-zinc-600 dark:text-zinc-400 transition-transform ${
                        isExpanded ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Sessions Grid (Collapsible) */}
                  {isExpanded && (
                    <div className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sessions.map((session) => {
                          try {
                            const batchName = getBatchName(session.batch_number, session.batch_type as KanaType)
                            const totalBatches = getTotalBatches(session.batch_type as KanaType)
                            const typeLabel = getTypeLabel(session.batch_type)
                            
                            return (
                              <Link
                                key={`${session.batch_type}-${session.batch_number}`}
                                href={`/dashboard/archive/${session.batch_type}/${session.batch_number}`}
                                className="block p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-pink-500 dark:hover:border-pink-500 hover:shadow-md transition-all group"
                              >
                                <div className="mb-2">
                                  <h3 className="text-lg font-semibold text-black dark:text-zinc-50 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                    {batchName}
                                  </h3>
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                    {typeLabel} • Batch {session.batch_number} of {totalBatches}
                                  </p>
                                </div>
                                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                                    Completed {formatDate(session.completed_at)}
                                  </p>
                                </div>
                              </Link>
                            )
                          } catch (e) {
                            // Skip sessions that can't be loaded (e.g., invalid batch_type)
                            return null
                          }
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ArchivePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    }>
      <ArchivePageContent />
    </Suspense>
  )
}
