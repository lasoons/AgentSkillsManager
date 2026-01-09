# Agent Skills Manager

AgentSkills Multi-Platform Management Plugin: Supports Agent/Claude Skills download and installation for Antigravity, Cursor, Windsurf, and Trae.

![image](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/image.png)

## Features

- **Repository Management**: Add, remove, and switch branches of skill repositories
- **Skill Installation**: Browse and install skills to your project's `.claude/skills` directory
- **Sync to AGENTS.md**: Automatically sync installed skills to your IDE's rules file
- **Multi-IDE Support**: Works with VSCode, Cursor, Windsurf, Trae, and Antigravity

## Usage

1. Open the **Agent Skills** panel in the Activity Bar ![icon](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/skills-icon.png)
2. Click **+** to add a skill repository (e.g., `https://github.com/anthropics/skills`)
3. Expand the repository to browse available skills
4. Check the skills you want, then click **Install**

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

Skills are installed to `.claude/skills/<skill-name>/` in your workspace.

The sync target depends on your IDE:
- **VSCode**: `AGENTS.md`
- **Cursor**: `.cursor/rules/agentskills.mdc`
- **Windsurf**: `.windsurf/rules/agentskills.md`
- **Trae**: `.trae/rules/agentskills.md`
- **Antigravity**: `.agent/rules/agentskills.md`

## License

MIT
