/**
 * Scores API — Submit and fetch leaderboard via Supabase
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

/** Returns true if the user has a score for the given puzzle date (played today on any device). */
export async function hasScoreForDate(userId, puzzleDate) {
  if (!isSupabaseConfigured() || !userId) return false
  const { data, error } = await supabase
    .from('scores')
    .select('id')
    .eq('user_id', userId)
    .eq('puzzle_date', puzzleDate)
    .maybeSingle()
  if (error) {
    console.error('hasScoreForDate failed:', error)
    return false
  }
  return !!data
}

/** Returns the user's score and difficulty for a date, or null. Use when restoring completed game / feedback. */
export async function getScoreForDate(userId, puzzleDate) {
  if (!isSupabaseConfigured() || !userId) return null
  const { data, error } = await supabase
    .from('scores')
    .select('score, difficulty')
    .eq('user_id', userId)
    .eq('puzzle_date', puzzleDate)
    .maybeSingle()
  if (error) {
    console.error('getScoreForDate failed:', error)
    return null
  }
  return data
}

/** Submit score when game is completed. Uses upsert (one score per user per day). Returns { ok, error }. */
export async function submitScore(userId, puzzleDate, score, completedCorrect) {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Not configured' }
  const { error } = await supabase.from('scores').upsert(
    {
      user_id: userId,
      puzzle_date: puzzleDate,
      score: Math.max(0, score),
      completed_correct: !!completedCorrect,
    },
    { onConflict: 'user_id,puzzle_date', ignoreDuplicates: false }
  )
  if (error) {
    console.error('Score submit failed:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Valid difficulty values for feedback */
export const DIFFICULTY_VALUES = ['easy', 'just_right', 'challenging']

/** Submit difficulty feedback for a completed puzzle. Updates the existing score row. */
export async function submitDifficulty(userId, puzzleDate, difficulty) {
  if (!isSupabaseConfigured() || !userId || !DIFFICULTY_VALUES.includes(difficulty)) return
  const { error } = await supabase
    .from('scores')
    .update({ difficulty })
    .eq('user_id', userId)
    .eq('puzzle_date', puzzleDate)
  if (error) console.error('Difficulty submit failed:', error)
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
