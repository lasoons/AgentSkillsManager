# Agent Skills Manager

AgentSkills multi-IDE management extension: browse and install skill repositories for Antigravity, CodeBuddy, Cursor, Qoder, Trae, Windsurf (and VS Code).

![image](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/image.png)

## Features

- **Repository Management**: Add, remove, and switch branches of skill repositories
- **Skill Installation**: Install skills into the active IDE skills directory
- **Multi-IDE Support**: Works with VSCode, Cursor, Trae, Antigravity, Qoder, Windsurf, and CodeBuddy
- **Active Skills Directory**: The local skills group shows which directory is active

## Usage

1. Open the **Agent Skills** panel in the Activity Bar ![icon](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/skills-icon.png)
2. Click **+** to add a skill repository (e.g., `https://github.com/anthropics/skills`)
3. Expand the repository to browse available skills
4. Check the skills you want, then click **Install**

Preset repositories included by default:
- `https://github.com/anthropics/skills.git`
- `https://github.com/openai/skills`
- `https://github.com/skillcreatorai/Ai-Agent-Skills`
- `https://github.com/obra/superpowers`
- `https://github.com/ComposioHQ/awesome-claude-skills.git`

## Skill Collections

Sourced from [heilcheng/awesome-agent-skills](https://github.com/heilcheng/awesome-agent-skills).

| Repository | Description |
|------------|-------------|
| [anthropics/skills](https://github.com/anthropics/skills) | Official Anthropic collection (document editing, data analysis) |
| [openai/skills](https://github.com/openai/skills) | Official OpenAI Codex skills catalog |
| [huggingface/skills](https://github.com/huggingface/skills) | HuggingFace skills (compatible with Claude, Codex, Gemini) |
| [skillcreatorai/Ai-Agent-Skills](https://github.com/skillcreatorai/Ai-Agent-Skills) | SkillCreator.ai collection with CLI installer |
| [karanb192/awesome-claude-skills](https://github.com/karanb192/awesome-claude-skills) | 50+ verified skills for Claude Code and Claude.ai |
| [shajith003/awesome-claude-skills](https://github.com/shajith003/awesome-claude-skills) | Skills for specialized capabilities |
| [GuDaStudio/skills](https://github.com/GuDaStudio/skills) | Multi-agent collaboration skills |
| [DougTrajano/pydantic-ai-skills](https://github.com/DougTrajano/pydantic-ai-skills) | Pydantic AI integration |
| [OmidZamani/dspy-skills](https://github.com/OmidZamani/dspy-skills) | Skills for DSPy framework |
| [ponderous-dustiness314/awesome-claude-skills](https://github.com/ponderous-dustiness314/awesome-claude-skills) | Document editing, data analysis, project management |
| [hikanner/agent-skills](https://github.com/hikanner/agent-skills) | Curated Claude Agent Skills collection |
| [gradion-ai/freeact-skills](https://github.com/gradion-ai/freeact-skills) | Freeact agent library skills |
| [gotalab/skillport](https://github.com/gotalab/skillport) | Skills distribution via CLI or MCP |
| [mhattingpete/claude-skills-marketplace](https://github.com/mhattingpete/claude-skills-marketplace) | Git, code review, and testing skills |

## Configuration

Skills are installed to the active skills directory in your workspace:
- **VSCode**: `.github/skills`
- **Cursor**: `.cursor/skills`
- **Trae**: `.trae/skills`
- **Antigravity**: `.agent/skills`
- **Qoder**: `.qoder/skills`
- **Windsurf**: `.windsurf/skills`
- **CodeBuddy**: `.codebuddy/skills`

The extension also scans skills in hidden directories inside repositories (for example `.curated`, `.experimental`).

## License

MIT
