/**
 * Scores API — Submit and fetch leaderboard via Supabase
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

/** Submit score when game is completed. Uses upsert (one score per user per day). */
export async function submitScore(userId, puzzleDate, score, completedCorrect) {
  if (!isSupabaseConfigured()) return
  const { error } = await supabase.from('scores').upsert(
    {
      user_id: userId,
      puzzle_date: puzzleDate,
      score: Math.max(0, score),
      completed_correct: !!completedCorrect,
    },
    { onConflict: 'user_id,puzzle_date', ignoreDuplicates: false }
  )
  if (error) console.error('Score submit failed:', error)
}

/** Fetch today's leaderboard — top scores for puzzle_date, joined with profiles for username */
export async function getLeaderboard(puzzleDate, limit = 50) {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('scores')
    .select(`
      score,
      completed_correct,
      profiles(username)
    `)
    .eq('puzzle_date', puzzleDate)
    .order('score', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('Leaderboard fetch failed:', error)
    return []
  }
  if (!data?.length) return []
  return data.map((row, i) => ({
    rank: i + 1,
    name: row.profiles?.username || 'Anonymous',
    score: row.score,
    perfect: row.completed_correct,
  }))
}
