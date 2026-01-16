# Agent Skills Manager

AgentSkills multi-IDE management extension: browse and install skill repositories for Antigravity, CodeBuddy, Cursor, Qoder, Trae, Windsurf (and VS Code).

![image](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/image.png)

## Features

- **Repository Management**: Add, remove, and switch branches of skill repositories
- **Skill Installation**: Install skills into the active IDE skills directory
- **Registry Search**: Search skills from claude-plugins.dev and add repositories
- **Multi-IDE Support**: Works with VSCode, Cursor, Trae, Antigravity, Qoder, Windsurf, and CodeBuddy
- **Active Skills Directory**: The local skills group shows which directory is active

## Usage

1. Open the **Agent Skills** panel in the Activity Bar ![icon](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/skills-icon.png)
2. Click **+** to add a skill repository (e.g., `https://github.com/anthropics/skills`)
3. Expand the repository to browse available skills
4. Check the skills you want, then click **Install**
5. Use **Search** to filter local repos and see Registry Results

## Skill Collections

Preset repositories bundled by default:

| Repository | Description |
|------------|-------------|
| [anthropics/skills](https://github.com/anthropics/skills) | Official Anthropic skills collection |
| [openai/skills](https://github.com/openai/skills) | Official OpenAI skills catalog |
| [skillcreatorai/Ai-Agent-Skills](https://github.com/skillcreatorai/Ai-Agent-Skills) | Community skills collection |
| [obra/superpowers](https://github.com/obra/superpowers) | Superpowers skill collection |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | Curated awesome-claude-skills collection |

For more repositories, see [heilcheng/awesome-agent-skills](https://github.com/heilcheng/awesome-agent-skills).

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
