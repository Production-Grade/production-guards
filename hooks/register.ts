import type { Register } from 'claude-code'

// Three of the most expensive habits, stopped before they run: a big model reading a full-size
// image, a long job run in the foreground (the turn then sits and the cache expires), and sleep loops.

const IMAGE = /\.(png|jpe?g|webp)$/i
const IMAGE_MAX_BYTES = 800_000
const SLEEP_MAX_S = 30

// Jobs that run for minutes. ffmpeg counts only when it writes video; stills and sheets are quick.
// Matched only where a command starts, so grep "ffmpeg" or a path that names yt-dlp passes.
const AT = String.raw`(?:^|[;&|(\n]\s*)(?:(?:time|nice|caffeinate|npx|python3?)\s+)?`
const LONG_JOB = new RegExp(String.raw`${AT}(?:remotion\s+render|yt-dlp|whisper(?:-cli)?)\b`)
const FFMPEG = new RegExp(String.raw`${AT}ffmpeg\s`)
const FFMPEG_QUICK = /tile=|-frames:v\s+1\b|-vframes\s+1\b|\.(png|jpe?g|webp)\b/
const LOOP_SLEEP = /\b(while|until)\b[\s\S]*\bsleep\b/

export const longJob = (command: string) =>
  LONG_JOB.test(command) || (FFMPEG.test(command) && !FFMPEG_QUICK.test(command))

export const sleepsTooLong = (command: string) => {
  if (LOOP_SLEEP.test(command)) return true
  return [...command.matchAll(/\bsleep\s+(\d+)/g)].some(m => Number(m[1]) >= SLEEP_MAX_S)
}

export const register: Register = on => {
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    if (e.agentId || !IMAGE.test(e.file_path)) return next(e)
    try {
      const [model, stat] = await Promise.all([$.session.model(), $.fs.stat(e.file_path)])
      if (/haiku/i.test(model) || stat.size <= IMAGE_MAX_BYTES) return next(e)
      return {
        deny: `this image is ${Math.round(stat.size / 1000)} KB, read on ${model}. Make a contact sheet first (ffmpeg -vf "scale=320:-1,tile=4x4", 1280 px wide or less) and read that, or hand the frames to a haiku-worker agent.`,
      }
    } catch {
      return next(e)
    }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.run_in_background) return next(e)
    if (longJob(e.command)) {
      return {
        deny: 'this is a long job. Run it again with run_in_background, write a status.json next to the output (what runs, PID, output path, how to check it), and end the turn. You are told when it exits.',
      }
    }
    if (sleepsTooLong(e.command)) {
      return {
        deny: `sleeping or polling in the foreground keeps the turn open while the cache expires. Run the job in the background and end the turn; you are told when it exits.`,
      }
    }
    return next(e)
  })
}
