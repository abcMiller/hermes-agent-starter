# CLAUDE.md - @hermes-clone/skills

This package provides skill loading and matching capabilities.

## Structure

- `SkillLoader.ts` - Loads skills from filesystem based on keyword matching
- `index.ts` - Exports SkillLoader class

## Skill Format

Skills are markdown files stored as:

```
data/skills/<skill-id>/SKILL.md
```

Each skill contains "how-to" knowledge for specific workflows like frontend design, code review, documentation, etc.

## Loading Logic

`loadRelevantSkills(input, maxSkills = 3)`:

1. Scans `data/skills/` for directories containing `SKILL.md`
2. Matches against user input using keyword hints
3. Returns up to 3 matching skills as `LoadedSkill[]`

### Keyword Matching

The `matches()` function checks if input contains any of these hints:
- The skill ID itself
- `frontend`, `前端`, `页面`, `ui`, `design`
- `review`, `审查`, `代码`
- `playwright`, `浏览器`, `自动化`
- `document`, `文档`, `readme`

Both input and skill content are lowercased for case-insensitive matching.

## LoadedSkill Interface

```ts
interface LoadedSkill {
  id: string;      // Directory name (e.g., "frontend-design")
  path: string;    // Full path to SKILL.md
  content: string; // Markdown content
}
```

## Usage

Skills are injected into the system prompt by `PromptBuilder`:

```
## Skill: <skill-id>
<skill content>
```

## Future Enhancements

Planned improvements:
- Frontmatter metadata (name, tags, priority)
- Better search/relevance scoring
- Auto-generation of skill drafts
- Skill testing and validation
