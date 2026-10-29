import type { GameContent } from '../types.ts'

// Built-in question library. With Supabase the `questions` table is the source
// of truth (seeded from this list by migration 0002); this copy powers the
// offline demo mode and the tests. Each entry completes "Who is most likely to …?"
export const questions: { category: string; text: string }[] = [
  { category: 'Funny', text: 'get lost in their own neighbourhood' },
  { category: 'Funny', text: 'laugh at their own joke before the punchline' },
  { category: 'Funny', text: 'trip over nothing in public' },
  { category: 'Funny', text: 'accidentally text the wrong person' },
  { category: 'Funny', text: 'fall asleep during a movie they picked' },
  { category: 'Funny', text: 'cry at a TV commercial' },
  { category: 'Funny', text: 'wave back at someone who wasn’t waving at them' },
  { category: 'Funny', text: 'get stuck in a revolving door' },

  { category: 'Flirty', text: 'slide into someone’s DMs first' },
  { category: 'Flirty', text: 'win a staring contest with a stranger' },
  { category: 'Flirty', text: 'get a stranger’s number at a coffee shop' },
  { category: 'Flirty', text: 'come up with the best pickup line' },
  { category: 'Flirty', text: 'be the last to leave a date' },
  { category: 'Flirty', text: 'flirt their way out of a parking ticket' },
  { category: 'Flirty', text: 'fall in love at first sight' },
  { category: 'Flirty', text: 'send a risky text and instantly regret it' },

  { category: 'Secrets', text: 'keep a secret for ten years' },
  { category: 'Secrets', text: 'have a hidden talent nobody knows about' },
  { category: 'Secrets', text: 'secretly binge a show everyone hates' },
  { category: 'Secrets', text: 'have a secret social media account' },
  { category: 'Secrets', text: 'know the group’s biggest secret' },
  { category: 'Secrets', text: 'hide an embarrassing childhood nickname' },
  { category: 'Secrets', text: 'pretend to be busy to skip plans' },
  { category: 'Secrets', text: 'have a guilty pleasure song' },

  { category: 'Friendship', text: 'show up with snacks when you’re sad' },
  { category: 'Friendship', text: 'still be your friend in 50 years' },
  { category: 'Friendship', text: 'remember everyone’s birthday' },
  { category: 'Friendship', text: 'plan the group trip' },
  { category: 'Friendship', text: 'give the best advice' },
  { category: 'Friendship', text: 'lend you money without asking why' },
  { category: 'Friendship', text: 'start a group chat for no reason' },
  { category: 'Friendship', text: 'drive across town to help a friend' },

  { category: 'Savage', text: 'leave the group chat without saying goodbye' },
  { category: 'Savage', text: 'be late to their own birthday' },
  { category: 'Savage', text: 'ghost a friend for a month' },
  { category: 'Savage', text: 'spoil the ending of a movie' },
  { category: 'Savage', text: 'eat the last slice without asking' },
  { category: 'Savage', text: 'reply with just “k” to a long message' },
  { category: 'Savage', text: 'steal food off your plate' },
  { category: 'Savage', text: 'cancel plans at the last minute' },

  { category: 'Relationships', text: 'get married first' },
  { category: 'Relationships', text: 'text their ex at 2am' },
  { category: 'Relationships', text: 'stay friends with all their exes' },
  { category: 'Relationships', text: 'propose in a really public way' },
  { category: 'Relationships', text: 'cry at a wedding' },
  { category: 'Relationships', text: 'have a whirlwind romance' },
  { category: 'Relationships', text: 'forget an anniversary' },
  { category: 'Relationships', text: 'go on a blind date just for fun' },

  { category: 'Hypothetical situations', text: 'survive a zombie apocalypse' },
  { category: 'Hypothetical situations', text: 'become famous overnight' },
  { category: 'Hypothetical situations', text: 'win the lottery and lose the ticket' },
  { category: 'Hypothetical situations', text: 'love being stranded on a deserted island' },
  { category: 'Hypothetical situations', text: 'become a billionaire and stay humble' },
  { category: 'Hypothetical situations', text: 'accidentally join a cult' },
  { category: 'Hypothetical situations', text: 'win a reality TV show' },
  { category: 'Hypothetical situations', text: 'panic when stuck in an elevator' },
]

export const builtinContent: GameContent = {
  questions: questions.map((q) => ({ text: q.text, source: 'builtin' as const })),
}
