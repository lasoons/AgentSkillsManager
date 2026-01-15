# Agent Skills Manager

AgentSkills 多 IDE 管理扩展：用于在 Antigravity、Cursor、Trae（以及 VS Code）中浏览与安装 skill 仓库。

![image](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/image.png)

## 功能

- **仓库管理**：添加、删除、切换 skill 仓库分支
- **Skill 安装**：安装到当前 IDE 对应的 skills 目录
- **多 IDE 支持**：支持 VSCode、Cursor、Trae、Antigravity
- **激活目录标识**：在本地 skills 分组上标识当前 IDE 的激活目录

## 使用方法

1. 在 Activity Bar 打开 **Agent Skills** 面板 ![icon](https://raw.githubusercontent.com/lasoons/AgentSkillsManager/refs/heads/main/resources/skills-icon.png)
2. 点击 **+** 添加 skill 仓库（例如 `https://github.com/anthropics/skills`）
3. 展开仓库浏览可用 skills
4. 勾选需要的 skills，点击 **Install**

默认内置的预置仓库：
- `https://github.com/anthropics/skills.git`
- `https://github.com/openai/skills`
- `https://github.com/skillcreatorai/Ai-Agent-Skills`
- `https://github.com/obra/superpowers`
- `https://github.com/ComposioHQ/awesome-claude-skills.git`

## Skill 仓库推荐

来自 [heilcheng/awesome-agent-skills](https://github.com/heilcheng/awesome-agent-skills) 的整理。

| 仓库 | 说明 |
|------|------|
| [anthropics/skills](https://github.com/anthropics/skills) | Anthropic 官方技能集合（文档编辑、数据分析等） |
| [openai/skills](https://github.com/openai/skills) | OpenAI Codex 官方 skills 目录 |
| [huggingface/skills](https://github.com/huggingface/skills) | HuggingFace skills（兼容 Claude、Codex、Gemini） |
| [skillcreatorai/Ai-Agent-Skills](https://github.com/skillcreatorai/Ai-Agent-Skills) | SkillCreator.ai skills 集合 |
| [karanb192/awesome-claude-skills](https://github.com/karanb192/awesome-claude-skills) | 50+ Claude Code/Claude.ai skills |
| [shajith003/awesome-claude-skills](https://github.com/shajith003/awesome-claude-skills) | 专业化 skills |
| [GuDaStudio/skills](https://github.com/GuDaStudio/skills) | 多智能体协作 skills |
| [DougTrajano/pydantic-ai-skills](https://github.com/DougTrajano/pydantic-ai-skills) | Pydantic AI 集成 skills |
| [OmidZamani/dspy-skills](https://github.com/OmidZamani/dspy-skills) | DSPy skills |
| [ponderous-dustiness314/awesome-claude-skills](https://github.com/ponderous-dustiness314/awesome-claude-skills) | 文档编辑、数据分析、项目管理 |
| [hikanner/agent-skills](https://github.com/hikanner/agent-skills) | Claude Agent Skills 精选集 |
| [gradion-ai/freeact-skills](https://github.com/gradion-ai/freeact-skills) | Freeact skills |
| [gotalab/skillport](https://github.com/gotalab/skillport) | 通过 CLI 或 MCP 分发 skills |
| [mhattingpete/claude-skills-marketplace](https://github.com/mhattingpete/claude-skills-marketplace) | Git/代码审查/测试 skills |

## 配置说明

Skills 会安装到工作区内“当前 IDE 激活的 skills 目录”：
- **VSCode**：`.claude/skills`
- **Cursor**：`.cursor/skills`
- **Trae**：`.trae/skills`
- **Antigravity**：`.agent/skills`

仓库扫描会包含隐藏目录中的 skills（例如 `.curated`、`.experimental`）。

## License

MIT

