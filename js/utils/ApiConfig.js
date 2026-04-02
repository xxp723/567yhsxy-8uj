/**
 * 文件名: js/utils/ApiConfig.js
 * 用途: API 配置读取工具（占位实现）。
 *       统一从 Settings 读取外部 API（生图 / MiniMax TTS）配置，供各应用调用。
 *       后续可在此扩展鉴权头拼装、请求签名、重试策略等能力。
 * 位置: /js/utils/ApiConfig.js
 * 架构层: 公共工具层（Utils）
 */
export class ApiConfig {
  /**
   * @param {import('../core/logic/Settings.js').Settings} settings
   */
  constructor(settings) {
    this.settings = settings;
  }

  async getTextToImageConfig() {
    const all = await this.settings.getAll();
    return all.api?.textToImage || { baseUrl: '', apiKey: '' };
  }

  async getMiniMaxTTSConfig() {
    const all = await this.settings.getAll();
    return all.api?.minimaxTTS || { baseUrl: '', apiKey: '', voiceId: '' };
  }
}
