import { expect, test } from 'claude-code/testing'
import { longJob, sleepsTooLong } from './register'

test('long jobs are caught where a command starts', async () => {
  expect(longJob('npx remotion render src/index.ts LF out.mp4')).toBe(true)
  expect(longJob('cd /x && yt-dlp -f best https://youtu.be/abc')).toBe(true)
  expect(longJob('ffmpeg -i in.mp4 -c:v libx264 out.mp4')).toBe(true)
  expect(longJob('whisper talk.wav --model medium')).toBe(true)
})

test('quick ffmpeg jobs and mentions pass', async () => {
  expect(longJob('ffmpeg -i in.mp4 -vf "scale=320:-1,tile=4x4" sheet.jpg')).toBe(false)
  expect(longJob('ffmpeg -ss 12 -i in.mp4 -frames:v 1 still.png')).toBe(false)
  expect(longJob('ffprobe -v error in.mp4')).toBe(false)
  expect(longJob('grep -n "ffmpeg -i" build.sh')).toBe(false)
  expect(longJob('ls tooling/yt-dlp-cache')).toBe(false)
})

test('sleep loops and long sleeps are caught', async () => {
  expect(sleepsTooLong('sleep 60')).toBe(true)
  expect(sleepsTooLong('until [ -f done ]; do sleep 5; done')).toBe(true)
  expect(sleepsTooLong('sleep 2 && ls')).toBe(false)
})

test('a foreground render is denied, a background one runs', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  const fg = await $.tool.call({ tool: 'Bash', command: 'npx remotion render a b' })
  expect(fg.deny).toContain('run_in_background')
  const bg = await $.tool.call({ tool: 'Bash', command: 'npx remotion render a b', run_in_background: true })
  expect(bg.deny).toBe(undefined)
})

test('a big image read on Opus is denied, on Haiku it runs', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: 'img' }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 2_400_000, mtimeMs: 0, isLink: false } as never }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  const r = await $.tool.call({ tool: 'Read', file_path: '/x/frame.png' })
  expect(r.deny).toContain('contact sheet')
})

test('a small image read runs', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: 'img' }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 200_000, mtimeMs: 0, isLink: false } as never }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  const r = await $.tool.call({ tool: 'Read', file_path: '/x/sheet.jpg' })
  expect(r.deny).toBe(undefined)
})
