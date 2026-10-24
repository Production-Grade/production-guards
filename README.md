# production-guards

A Claude Code mod that stops three expensive habits before they run.

## Why

The prompt cache lasts about five minutes. A turn that sits waiting on a render, a download or
a `sleep` loop goes past it. The next request then pays to write the whole context again, and
an agent that polls does that on every check. Reading images costs too: a full-resolution frame
read on a big model costs far more than a contact sheet of sixteen frames.

## What it stops

| Habit | What the model is told instead |
|---|---|
| Reading an image over 800 KB on a model that isn't Haiku | Make a contact sheet (`ffmpeg -vf "scale=320:-1,tile=4x4"`, 1280 px wide or less) and read that, or hand the frames to a Haiku agent |
| A long job in the foreground: `remotion render`, `yt-dlp`, `whisper`, or `ffmpeg` writing video | Run it with `run_in_background`, write a `status.json` next to the output, and end the turn. Claude Code says when it exits |
| `sleep` of 30 s or more, or a `while`/`until` loop with `sleep` | Run the job in the background and end the turn |

Quick ffmpeg jobs pass: stills, `-frames:v 1`, and `tile=` contact sheets. So does `ffprobe`. So
does anything already set to `run_in_background`. Subagents can read images, because that's
where image triage belongs.

## Install

```
/plugin marketplace add Production-Grade/production-guards
/plugin install production-guards@production-guards
```

## Settings

Constants at the top of [`hooks/register.ts`](hooks/register.ts):

| Constant | Default | What it does |
|---|---|---|
| `IMAGE_MAX_BYTES` | `800_000` | Largest image a big model may read directly |
| `SLEEP_MAX_S` | `30` | Longest foreground `sleep` allowed |
| `LONG_JOB` | render, yt-dlp, whisper | Commands that must run in the background; add your own |

## Notes

Commands are matched where they start: at the beginning, or after `;`, `&&`, `|`, `(` or a newline.
`grep "ffmpeg"` passes. A pattern with a `|` in it, such as a sed expression that names one of
these tools, can still be caught. If that happens, make the edit with the file tools instead.

## More from Production Grade

Walkthroughs of these mods and of how I run Claude Code on real work:

- YouTube: [@productiongradeai](https://www.youtube.com/@productiongradeai)
- Substack: [productiongrade.substack.com](https://productiongrade.substack.com)

Part of [Claude Lean Mods](https://github.com/Production-Grade/claude-lean-mods). MIT licence.
