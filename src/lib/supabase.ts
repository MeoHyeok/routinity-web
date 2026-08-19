import { createClient } from '@supabase/supabase-js'

// These are the Supabase project's URL and *anon* key — the anon key is meant to be public
// (Row Level Security on the backend is what actually protects data), same as how the iOS
// client ships it in Secrets.plist. See docs/api-contract.md in the routinity-ios repo.
const SUPABASE_URL = 'https://noqvrfewkyfdrsoaszmz.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcXZyZmV3a3lmZHJzb2Fzem16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzA3NDksImV4cCI6MjEwMTkwNjc0OX0.rAZiVgHR1FLs66wNEiW28WERlY1NZEi__Y3iGk_-1kk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
