# TasteTogether

TasteTogether 是一个记住个人用餐偏好、帮助一人或两人选择餐厅的应用。

## 项目状态

项目处于开发初始化阶段，尚未创建应用代码或安装依赖。功能范围与验收要求见 [产品需求文档](TasteTogether_PRD.md)。

首版聚焦 Berkeley 及周边地区，通过真实 Qloo 候选、双方独立偏好和用餐历史过滤，提供三家选择或直接选定一家。

## 开发入口

- `TasteTogether_PRD.md`：产品需求、范围和验收标准。
- 技术栈、启动方式和环境变量将在应用搭建后补充。

## 本地配置

密钥和本地配置放在 `.env.local` 等被 Git 忽略的文件中。需要共享配置格式时，使用不含真实密钥的 `.env.example`。

运行 `bash scripts/setup-qloo.sh`，按提示输入 Qloo API key，即可写入项目的 `.env.local`。脚本会保留其他配置，更新 Qloo key 和服务器地址。该文件供应用加载，不会修改终端或系统的全局环境变量。
