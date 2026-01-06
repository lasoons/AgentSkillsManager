# Agent Skills Manager

A VSCode extension for managing, installing, and syncing Agent Skills from Git repositories.

## Features

- **Repository Management**: Add, remove, and switch branches of skill repositories
- **Skill Installation**: Browse and install skills to your project's `.agent/skills` directory
- **Sync to AGENTS.md**: Automatically sync installed skills to your IDE's rules file
- **Multi-IDE Support**: Works with VSCode, Cursor, Windsurf, Trae, and Antigravity

## Requirements

- Git installed and available in PATH
- [openskills CLI](https://github.com/whyuds/openskills) installed for sync functionality

## Usage

1. Open the **Agent Skills** panel in the Activity Bar
2. Click **+** to add a skill repository (e.g., `https://github.com/anthropics/skills`)
3. Expand the repository to browse available skills
4. Check the skills you want, then click **Install**
5. Click **Sync** to update your AGENTS.md file

## Commands

| Command | Description |
|---------|-------------|
| Add Skill Repository | Add a Git repository containing skills |
| Remove Repository | Remove a repository from the list |
| Switch Branch | Change the branch of a repository |
| Pull Latest | Fetch the latest changes from remote |
| Install Selected Skills | Install checked skills to your project |
| Delete Selected Skills | Remove installed skills from your project |
| Sync to AGENTS.md | Sync skills to your IDE's rules file |
| Refresh Skills | Refresh the skill tree view |

## Configuration

Skills are installed to `.agent/skills/<skill-name>/` in your workspace.

The sync target depends on your IDE:
- **VSCode**: `AGENTS.md`
- **Cursor**: `.cursor/rules/agentskills.mdc`
- **Windsurf**: `.windsurf/rules/agentskills.md`
- **Trae**: `.trae/rules/agentskills.md`
- **Antigravity**: `.agent/rules/agentskills.md`

## License

MIT
