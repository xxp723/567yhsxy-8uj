import { App } from '../../core/logic/AppManager.js';

export class ArchiveApp extends App {
    constructor() {
        super('档案', 'archive');
    }

    async render(container) {
        container.innerHTML = `
            <div class="archive-app-container" style="padding: 20px; color: var(--c-text); height: 100%; box-sizing: border-box; overflow-y: auto; background-color: var(--c-black);">
                <h2 style="color: var(--c-cyan); border-bottom: 1px solid var(--c-cyan); padding-bottom: 10px; text-shadow: 0 0 8px var(--c-cyan-glow); margin-top: 0; display: flex; justify-content: space-between; align-items: center;">
                    <span>SYSTEM.ARCHIVE</span>
                    <span style="font-size: 12px; color: var(--c-pink); letter-spacing: 2px;">SECURE_ENCLAVE</span>
                </h2>
                
                <div class="archive-content" style="margin-top: 20px;">
                    <p style="opacity: 0.8; font-size: 14px; letter-spacing: 1px;">> Accessing encrypted data stream...</p>
                    <div style="margin-top: 15px; border-left: 2px solid var(--c-pink); padding-left: 10px; background: linear-gradient(90deg, rgba(224, 36, 213, 0.1), transparent);">
                        <div style="font-weight: bold; color: var(--c-pink); margin-bottom: 10px;">CLASSIFIED DIRECTORIES</div>
                        <ul style="list-style: none; padding-left: 0; font-size: 13px; line-height: 2.5; margin: 0;">
                            <li style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--c-cyan)'" onmouseout="this.style.color='var(--c-text)'">[ 01 ] PROJECT_GENESIS // 创世纪档案</li>
                            <li style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--c-cyan)'" onmouseout="this.style.color='var(--c-text)'">[ 02 ] SUBJECT_RECORDS // 实验体代号记录</li>
                            <li style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--c-cyan)'" onmouseout="this.style.color='var(--c-text)'">[ 03 ] UNKNOWN_ARTIFACTS // 未知截获信标</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
}
